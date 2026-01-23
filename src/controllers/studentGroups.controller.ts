import { Request, Response } from 'express';
import * as GroupModel from '../models/studentGroups/group.model';
import * as GroupMembersModel from '../models/studentGroups/groupMember.model';
import { z } from 'zod';
import { logActivity } from '../models/audit/activityLog.model';

const groupSchema = z.object({
    name: z.string(),
    level_tag: z.string().optional().nullable(),
    teacher_id: z.string().optional().nullable(),
});

export const createGroup = async (req: Request, res: Response) => {
    try {
        const data = groupSchema.parse(req.body);
        const teacherId = data.teacher_id || (req as any).user.id;

        const result = await GroupModel.createGroup({
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
        const groups = await GroupModel.listGroups({ teacherId: teacherId as string });
        return res.json(groups);
    } catch (error) {
        return res.status(500).json({ message: "Error al listar grupos" });
    }
};

export const getGroup = async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        const group = await GroupModel.getGroupById(id);
        if (!group) return res.status(404).json({ message: "Grupo no encontrado" });

        const members = await GroupMembersModel.listMembers(id);
        return res.json({
            ...group,
            members
        });
    } catch (error) {
        return res.status(500).json({ message: "Error al obtener grupo" });
    }
};

export const addMember = async (req: Request, res: Response) => {
    try {
        const groupId = String(req.params.id);
        const { userId } = req.body;
        await GroupMembersModel.addMember(groupId, userId);
        return res.json({ message: "Alumno añadido al grupo" });
    } catch (error) {
        return res.status(500).json({ message: "Error al añadir alumno" });
    }
};

export const removeMember = async (req: Request, res: Response) => {
    try {
        const groupId = String(req.params.id);
        const userId = String(req.params.userId);
        await GroupMembersModel.removeMember(groupId, userId);
        return res.json({ message: "Alumno eliminado del grupo" });
    } catch (error) {
        return res.status(500).json({ message: "Error al eliminar alumno" });
    }
};

export const deleteGroup = async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        await GroupModel.deleteGroup(id);
        return res.json({ message: "Grupo eliminado" });
    } catch (error) {
        return res.status(500).json({ message: "Error al eliminar grupo" });
    }
};

export const updateGroup = async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        const data = groupSchema.partial().parse(req.body);
        await GroupModel.updateGroup(id, data as any);
        return res.json({ message: "Grupo actualizado" });
    } catch (error) {
        return res.status(400).json({ message: "Datos inválidos", error });
    }
};

export const getGroupMembers = async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        const group = await GroupModel.getGroupById(id);
        if (!group) return res.status(404).json({ message: "Grupo no encontrado" });
        const members = await GroupMembersModel.listMembers(id);
        return res.json(members);
    } catch (error) {
        return res.status(500).json({ message: "Error al obtener miembros del grupo" });
    }
};

