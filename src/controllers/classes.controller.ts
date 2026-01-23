import { Request, Response } from 'express';
import * as LiveClassModel from '../models/classes/liveClass.model';
import * as LiveAttendanceModel from '../models/classes/liveAttendance.model';
import { z } from 'zod';
import { logActivity } from '../models/audit/activityLog.model';

const classSchema = z.object({
    title: z.string(),
    scheduled_at: z.string(),
    duration_mins: z.number(),
    teacher_id: z.string().optional().nullable(),
    group_id: z.string().optional().nullable(),
    room_url: z.string().optional().nullable(),
    status: z.enum(['scheduled', 'live', 'finished']).default('scheduled'),
});

const updateClassSchema = classSchema.partial();

export const listClasses = async (req: Request, res: Response) => {
    try {
        const { status, group_id } = req.query;
        const userId = (req as any).user?.id;

        const classes = await LiveClassModel.listLiveClasses({
            status: status as string,
            group_id: group_id as string,
            userId
        });

        return res.json(classes);
    } catch (error) {
        return res.status(500).json({ message: "Error fetching classes" });
    }
};

export const getClass = async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        const userId = (req as any).user?.id;
        const cls = await LiveClassModel.getLiveClassById(id, userId) as any;
        if (!cls) return res.status(404).json({ message: "Class not found" });

        return res.json(cls);
    } catch (error) {
        return res.status(500).json({ message: "Error fetching class" });
    }
};

export const registerToClass = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const classId = String(req.params.id);

        const cls = await LiveClassModel.getLiveClassById(classId) as any;
        if (!cls) return res.status(404).json({ message: "Class not found" });

        await LiveAttendanceModel.registerAttendance(classId, userId);
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

        const result = await LiveClassModel.createLiveClass(body as any);
        const createdId = result.lastInsertRowid as string;

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
        const id = String(req.params.id);
        const data = updateClassSchema.parse(req.body);
        await LiveClassModel.updateLiveClass(id, data as any);
        return res.json({ message: "Class updated" });
    } catch (error) {
        return res.status(400).json({ message: "Invalid data", error });
    }
};

export const deleteClass = async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        await LiveClassModel.deleteLiveClass(id);
        return res.json({ message: "Class deleted" });
    } catch (error) {
        return res.status(500).json({ message: "Error deleting class" });
    }
};

