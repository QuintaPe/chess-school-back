import { Request, Response } from 'express';
import * as ClassModel from '../models/classModel';
import { z } from 'zod';
import { db } from '../config/db';

const classSchema = z.object({
    title: z.string(),
    level: z.enum(['beginner', 'intermediate', 'advanced']),
    start_time: z.string(),
    end_time: z.string().optional(),
    capacity: z.number().default(0),
    teacher_id: z.string().optional(),
    status: z.enum(['scheduled', 'live', 'completed', 'canceled']).default('scheduled'),
    meeting_link: z.string().optional(),
    recording_url: z.string().optional(),
    platform: z.string().optional(),
    video_url: z.string().optional(),
});

const updateClassSchema = classSchema.partial();

export const listClasses = async (req: Request, res: Response) => {
    try {
        const { level, status } = req.query;
        const userId = (req as any).user?.id;
        const classes = await ClassModel.getClasses({
            level: level as string,
            status: status as string,
            userId
        });

        // Convert sqlite numeric boolean (0/1) to true/false
        const formattedClasses = (classes as any[]).map(c => ({
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
        const id = parseInt(req.params.id as string);
        const userId = (req as any).user?.id;

        const cls = await ClassModel.getClassById(id);
        if (!cls) return res.status(404).json({ message: "Class not found" });

        const count = await ClassModel.getRegistrationCount(id);
        const isRegistered = userId ? await db.execute({
            sql: "SELECT 1 FROM class_registrations WHERE class_id = ? AND user_id = ?",
            args: [id, userId]
        }).then(r => r.rows.length > 0) : false;

        return res.json({
            ...cls,
            registration_count: count,
            is_registered: isRegistered,
            can_access: isRegistered || (req as any).user?.role === 'admin' || (req as any).user?.role === 'teacher'
        });
    } catch (error) {
        return res.status(500).json({ message: "Error fetching class" });
    }
};

export const registerToClass = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const classId = parseInt(req.params.id as string);

        const cls = await ClassModel.getClassById(classId);
        if (!cls) return res.status(404).json({ message: "Class not found" });

        const count = await ClassModel.getRegistrationCount(classId);

        // Fix TypeScript errors with manual cast and null check
        const capacity = Number(cls.capacity || 0);

        if (capacity > 0 && count >= capacity) {
            return res.status(400).json({ message: "Class is full" });
        }

        await ClassModel.registerUser(userId, classId);
        return res.json({ message: "Registered successfully" });
    } catch (error: any) {
        // Handle unique constraint if user already registered
        if (error.code && error.code.includes('SQLITE_CONSTRAINT')) {
            return res.status(409).json({ message: "Already registered for this class" });
        }
        return res.status(500).json({ message: "Error registering", error });
    }
};

export const createClass = async (req: Request, res: Response) => {
    try {
        const data = classSchema.parse(req.body);
        console.log("DEBUG: Creating class with data:", JSON.stringify(data, null, 2));

        // Optional: Check if teacher_id exists if provided
        if (data.teacher_id) {
            const teacher = await db.execute({
                sql: "SELECT id FROM users WHERE id = ?",
                args: [data.teacher_id]
            });
            console.log(`DEBUG: Teacher ${data.teacher_id} exists?`, teacher.rows.length > 0);
        }

        const result = await ClassModel.createClass(data as any);
        const classId = Number(result.lastInsertRowid);

        // Send Discord Webhook
        try {
            const settings = await ClassModel.getDiscordSettings();
            const webhookUrl = settings['webhook_url'];

            if (webhookUrl) {
                const discordMessage = {
                    embeds: [{
                        title: "🚀 ¡Nueva Clase Programada!",
                        description: `**${data.title}**\nNivel: ${data.level}\nFecha: ${new Date(data.start_time).toLocaleString()}\nPlataforma: ${data.platform || 'General'}`,
                        color: 5814783, // Color Discord Blurple
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

        return res.status(201).json({ message: "Class created", id: classId });
    } catch (error: any) {
        if (error.code && error.code.includes('SQLITE_CONSTRAINT')) {
            return res.status(400).json({ message: "Database constraint violation (check if fields like teacher_id are valid)", error });
        }
        return res.status(400).json({ message: "Invalid data", error });
    }
};

export const updateClass = async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id as string);
        const data = updateClassSchema.parse(req.body);
        await ClassModel.updateClass(id, data as any);
        return res.json({ message: "Class updated" });
    } catch (error) {
        return res.status(400).json({ message: "Invalid data", error });
    }
};

export const deleteClass = async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id as string);
        await ClassModel.deleteClass(id);
        return res.json({ message: "Class deleted" });
    } catch (error) {
        return res.status(500).json({ message: "Error deleting class" });
    }
};
