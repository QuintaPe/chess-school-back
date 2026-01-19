import { db } from "../config/db";
import { randomUUID } from "crypto";

export interface StudentGroup {
    id?: string;
    name: string;
    teacher_id?: string | null;
    description?: string | null;
    created_at?: string;
}

export const createGroup = async (group: StudentGroup) => {
    const id = randomUUID();
    const result = await db.execute({
        sql: "INSERT INTO student_groups (id, name, teacher_id, description) VALUES (?, ?, ?, ?)",
        args: [id, group.name, group.teacher_id ?? null, group.description ?? null]
    });
    return { ...result, lastInsertRowid: id };
};

export const getGroups = async (filters: { teacherId?: string }) => {
    let query = `
        SELECT g.*, u.name as teacher_name,
        (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as student_count
        FROM student_groups g
        LEFT JOIN users u ON g.teacher_id = u.id
        WHERE 1=1
    `;
    const args: any[] = [];

    if (filters.teacherId) {
        query += " AND g.teacher_id = ?";
        args.push(filters.teacherId);
    }

    const result = await db.execute({ sql: query, args });
    return result.rows;
};

export const getGroupById = async (id: string) => {
    const groupRes = await db.execute({
        sql: "SELECT g.*, u.name as teacher_name FROM student_groups g LEFT JOIN users u ON g.teacher_id = u.id WHERE g.id = ?",
        args: [id]
    });
    const group = groupRes.rows[0];
    if (!group) return null;

    const membersRes = await db.execute({
        sql: `SELECT u.id, u.name, u.email, u.avatar_url 
              FROM group_members gm 
              JOIN users u ON gm.user_id = u.id 
              WHERE gm.group_id = ?`,
        args: [id]
    });

    return {
        ...group,
        members: membersRes.rows
    };
};

export const addMemberToGroup = async (groupId: string, userId: string) => {
    await db.execute({
        sql: "INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)",
        args: [groupId, userId]
    });
};

export const removeMemberFromGroup = async (groupId: string, userId: string) => {
    await db.execute({
        sql: "DELETE FROM group_members WHERE group_id = ? AND user_id = ?",
        args: [groupId, userId]
    });
};

export const deleteGroup = async (id: string) => {
    await db.execute({
        sql: "DELETE FROM student_groups WHERE id = ?",
        args: [id]
    });
};

export const updateGroup = async (id: string, updates: Partial<StudentGroup>) => {
    const fields = Object.keys(updates);
    if (fields.length === 0) return;

    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const args = [...Object.values(updates), id];

    await db.execute({
        sql: `UPDATE student_groups SET ${setClause} WHERE id = ?`,
        args
    });
};
