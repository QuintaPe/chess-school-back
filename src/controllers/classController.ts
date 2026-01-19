import { Request, Response } from 'express';
import * as ClassModel from '../models/classModel';
import { z } from 'zod';
import { db } from '../config/db';
import { logActivity } from '../models/activityModel';

const classSchema = z.object({
    title: z.string(),
    level: z.enum(['beginner', 'intermediate', 'advanced']),
    start_time: z.string(),
    teacher_id: z.string().optional().nullable(),
    group_id: z.string().optional().nullable(),
    status: z.enum(['scheduled', 'live', 'completed', 'canceled']).default('scheduled'),
    meeting_link: z.string().optional().nullable(),
    video_url: z.string().optional().nullable(),
    recurring_days: z.array(z.number()).optional().nullable(),
});

const updateClassSchema = classSchema.partial();

export const listClasses = async (req: Request, res: Response) => {
    try {
        const { level, status, groupId } = req.query;
        const user = (req as any).user;
        const userId = user?.id;
        const userRole = user?.role;

        let query = "SELECT * FROM classes WHERE 1=1";
        const args: any[] = [];

        // Access Control for Students: only public classes (group_id is null) or classes from their groups
        if (userRole === 'student') {
            query += ` AND (group_id IS NULL OR group_id IN (SELECT group_id FROM group_members WHERE user_id = ?))`;
            args.push(userId);
        }

        if (level) { query += " AND level = ?"; args.push(level); }
        if (status) { query += " AND status = ?"; args.push(status); }
        if (groupId) { query += " AND group_id = ?"; args.push(groupId); }

        const result = await db.execute({ sql: query, args });

        // Convert sqlite results to match Model (parse JSON)
        const formattedClasses = (result.rows as any[]).map(c => ({
            ...c,
            recurring_days: JSON.parse(c.recurring_days || '[]')
        }));

        return res.json(formattedClasses);
    } catch (error) {
        return res.status(500).json({ message: "Error fetching classes" });
    }
};

export const getClass = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const cls = await ClassModel.getClassById(id) as any;
        if (!cls) return res.status(404).json({ message: "Class not found" });

        // For security, if student, check access again
        const user = (req as any).user;
        if (user.role === 'student' && cls.group_id) {
            const isMemberRes = await db.execute({
                sql: "SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?",
                args: [cls.group_id, user.id]
            });
            if (isMemberRes.rows.length === 0) {
                return res.status(403).json({ message: "Access denied to this group class" });
            }
        }

        return res.json({
            ...cls,
            recurring_days: JSON.parse(cls.recurring_days || '[]')
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

        // Capacity check removed as per request

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

        const result = await ClassModel.createClass(body as any);
        const createdId = result.lastInsertRowid as string;

        // Send Discord Webhook
        try {
            const settings = await ClassModel.getDiscordSettings();
            const webhookUrl = settings['webhook_url'];

            if (webhookUrl) {
                const discordMessage = {
                    embeds: [{
                        title: "🚀 ¡Nueva Clase Programada!",
                        description: `**${body.title}**\nNivel: ${body.level}\nFecha: ${new Date(body.start_time).toLocaleString()}`,
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

        await logActivity('class_created', `Nueva clase programada: ${body.title}`);

        return res.status(201).json({
            message: "Clase creada",
            id: createdId
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
