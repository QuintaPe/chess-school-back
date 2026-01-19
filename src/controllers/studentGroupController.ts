import { Request, Response } from 'express';
import * as StudentGroupModel from '../models/studentGroupModel';
import { z } from 'zod';
import { logActivity } from '../models/activityModel';

const groupSchema = z.object({
    name: z.string(),
    description: z.string().optional(),
    teacher_id: z.string().optional(),
});

export const createGroup = async (req: Request, res: Response) => {
    try {
        const data = groupSchema.parse(req.body);
        const teacherId = data.teacher_id || (req as any).user.id;

        const result = await StudentGroupModel.createGroup({
            ...data,
            teacher_id: teacherId
        });

        const groupId = result.lastInsertRowid;
        await logActivity('group_created', `Nuevo grupo de alumnos creado: ${data.name}`);

        return res.status(201).json({ message: "Grupo creado", id: groupId });
    } catch (error: any) {
        console.error("Error creating group:", error);
        return res.status(400).json({
            message: "Datos inválidos o error de servidor",
            error: error.message || error
        });
    }
};

export const listGroups = async (req: Request, res: Response) => {
    try {
        const { teacherId } = req.query;
        const groups = await StudentGroupModel.getGroups({ teacherId: teacherId as string });
        return res.json(groups);
    } catch (error) {
        return res.status(500).json({ message: "Error al listar grupos" });
    }
};

export const getGroup = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const group = await StudentGroupModel.getGroupById(id);
        if (!group) return res.status(404).json({ message: "Grupo no encontrado" });
        return res.json(group);
    } catch (error) {
        return res.status(500).json({ message: "Error al obtener grupo" });
    }
};

export const addMember = async (req: Request, res: Response) => {
    try {
        const groupId = req.params.id as string;
        const { userId } = req.body;
        await StudentGroupModel.addMemberToGroup(groupId, userId);
        return res.json({ message: "Alumno añadido al grupo" });
    } catch (error) {
        return res.status(500).json({ message: "Error al añadir alumno" });
    }
};

export const removeMember = async (req: Request, res: Response) => {
    try {
        const groupId = req.params.id as string;
        const userId = req.params.userId as string;
        await StudentGroupModel.removeMemberFromGroup(groupId, userId);
        return res.json({ message: "Alumno eliminado del grupo" });
    } catch (error) {
        return res.status(500).json({ message: "Error al eliminar alumno" });
    }
};

export const deleteGroup = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        await StudentGroupModel.deleteGroup(id);
        return res.json({ message: "Grupo eliminado" });
    } catch (error) {
        return res.status(500).json({ message: "Error al eliminar grupo" });
    }
};
