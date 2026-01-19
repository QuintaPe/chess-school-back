import { Request, Response } from 'express';
import * as ClassModel from '../models/classModel';
import { z } from 'zod';
import { db } from '../config/db';
import { logActivity } from '../models/activityModel';

const classSchema = z.object({
    title: z.string(),
    level: z.enum(['beginner', 'intermediate', 'advanced']),
    start_time: z.string(), // If recurring, this is the start date or just an instance
    end_time: z.string().optional(),
    capacity: z.number().default(20),
    teacher_id: z.string().optional(),
    group_id: z.string().optional(),
    status: z.enum(['scheduled', 'live', 'completed', 'canceled']).default('scheduled'),
    meeting_link: z.string().optional(),
    recording_url: z.string().optional(),
    platform: z.string().optional(),
    video_url: z.string().optional(),
    // Recurrence fields
    is_recurring: z.boolean().default(false),
    recurring_days: z.array(z.number()).optional(), // [1, 3, 5] for Mon, Wed, Fri
    recurring_until: z.string().optional(), // ISO date
});

const updateClassSchema = classSchema.partial();

export const listClasses = async (req: Request, res: Response) => {
    try {
        const { level, status, groupId } = req.query;
        const userId = (req as any).user?.id;

        let query = `
            SELECT c.*, u.name as teacher_name,
            EXISTS(SELECT 1 FROM class_registrations cr WHERE cr.class_id = c.id AND cr.user_id = ?) as is_registered
            FROM classes c 
            LEFT JOIN users u ON c.teacher_id = u.id
            WHERE 1=1
        `;
        const args: any[] = [userId || null];

        if (level) { query += " AND c.level = ?"; args.push(level); }
        if (status) { query += " AND c.status = ?"; args.push(status); }
        if (groupId) { query += " AND c.group_id = ?"; args.push(groupId); }

        const result = await db.execute({ sql: query, args });

        // Convert sqlite numeric boolean (0/1) to true/false
        const formattedClasses = (result.rows as any[]).map(c => ({
            ...c,
            is_registered: Boolean(c.is_registered)
        }));

        return res.json(formattedClasses);
    } catch (error) {
        return res.status(500).json({ message: "Error fetching classes" });
    }
};

export const getClass = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const userId = (req as any).user?.id;

        const cls = await ClassModel.getClassById(id) as any;
        if (!cls) return res.status(404).json({ message: "Class not found" });

        const count = await ClassModel.getRegistrationCount(id);
        const isRegistered = userId ? await db.execute({
            sql: "SELECT 1 FROM class_registrations WHERE class_id = ? AND user_id = ?",
            args: [id, userId]
        }).then(r => r.rows.length > 0) : false;

        // Check group access
        let hasGroupAccess = false;
        if (cls.group_id && userId) {
            const memberCount = await db.execute({
                sql: "SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?",
                args: [cls.group_id, userId]
            });
            hasGroupAccess = memberCount.rows.length > 0;
        }

        return res.json({
            ...cls,
            registration_count: count,
            is_registered: isRegistered,
            can_access: isRegistered || hasGroupAccess || (req as any).user?.role === 'admin' || (req as any).user?.role === 'teacher'
        });
    } catch (error) {
        return res.status(500).json({ message: "Error fetching class" });
    }
};

export const registerToClass = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const classId = req.params.id as string;

        const cls = await ClassModel.getClassById(classId) as any;
        if (!cls) return res.status(404).json({ message: "Class not found" });

        // If class is restricted to a group, check if user is member
        if (cls.group_id) {
            const isMember = await db.execute({
                sql: "SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?",
                args: [cls.group_id, userId]
            }).then(r => r.rows.length > 0);

            if (!isMember) {
                return res.status(403).json({ message: "Esta clase es exclusiva para un grupo al que no perteneces" });
            }
        }

        const count = await ClassModel.getRegistrationCount(classId);
        const capacity = Number(cls.capacity || 0);

        if (capacity > 0 && count >= capacity) {
            return res.status(400).json({ message: "Class is full" });
        }

        await ClassModel.registerUser(userId, classId);
        return res.json({ message: "Registered successfully" });
    } catch (error: any) {
        if (error.code && error.code.includes('SQLITE_CONSTRAINT')) {
            return res.status(409).json({ message: "Already registered for this class" });
        }
        return res.status(500).json({ message: "Error registering", error });
    }
};

export const createClass = async (req: Request, res: Response) => {
    try {
        const body = classSchema.parse(req.body);
        const classesToCreate: any[] = [];

        if (body.is_recurring && body.recurring_days && body.recurring_until) {
            const startDate = new Date(body.start_time);
            const endDate = new Date(body.recurring_until);
            const durationMs = body.end_time ? (new Date(body.end_time).getTime() - startDate.getTime()) : 3600000; // 1h default

            // Helper to add days
            const addDays = (date: Date, days: number) => {
                const result = new Date(date);
                result.setDate(result.getDate() + days);
                return result;
            };

            let current = new Date(startDate);
            while (current <= endDate) {
                if (body.recurring_days.includes(current.getDay())) {
                    const sessionStart = new Date(current);
                    const sessionEnd = new Date(sessionStart.getTime() + durationMs);

                    classesToCreate.push({
                        ...body,
                        start_time: sessionStart.toISOString(),
                        end_time: sessionEnd.toISOString()
                    });
                }
                current = addDays(current, 1);
            }
        } else {
            classesToCreate.push(body);
        }

        const createdIds: string[] = [];
        for (const clsData of classesToCreate) {
            const result = await ClassModel.createClass(clsData as any);
            createdIds.push(result.lastInsertRowid as string);
        }

        // Send Discord Webhook (only for first if multiple, or a single notification)
        try {
            const settings = await ClassModel.getDiscordSettings();
            const webhookUrl = settings['webhook_url'];

            if (webhookUrl) {
                const discordMessage = {
                    embeds: [{
                        title: body.is_recurring ? "📅 ¡Serie de Clases Programada!" : "🚀 ¡Nueva Clase Programada!",
                        description: `**${body.title}**\nNivel: ${body.level}\n${body.is_recurring ? 'Serie periódica' : 'Fecha: ' + new Date(body.start_time).toLocaleString()}\nPlataforma: ${body.platform || 'General'}`,
                        color: 5814783,
                        url: "https://reinoajedrez.com/dashboard/clases"
                    }]
                };

                await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(discordMessage)
                });
            }
        } catch (webhookError) {
            console.error("Discord Webhook Error:", webhookError);
        }

        await logActivity('class_created', `Nueva(s) clase(s) programada(s): ${body.title} (${createdIds.length} sesiones)`);

        return res.status(201).json({
            message: body.is_recurring ? `Serie de ${createdIds.length} clases creada` : "Clase creada",
            ids: createdIds
        });
    } catch (error: any) {
        console.error("Error creating class:", error);
        return res.status(400).json({ message: "Invalid data", error });
    }
};

export const updateClass = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const data = updateClassSchema.parse(req.body);
        await ClassModel.updateClass(id, data as any);
        return res.json({ message: "Class updated" });
    } catch (error) {
        return res.status(400).json({ message: "Invalid data", error });
    }
};

export const deleteClass = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        await ClassModel.deleteClass(id);
        return res.json({ message: "Class deleted" });
    } catch (error) {
        return res.status(500).json({ message: "Error deleting class" });
    }
};
