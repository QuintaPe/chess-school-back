import { db } from "../../config/db";
import { randomUUID } from "crypto";

export interface Group {
    id?: string;
    name: string;
    teacher_id?: string | null;
    level_tag?: string | null;
}

export const createGroup = async (g: Group) => {
    const id = g.id || randomUUID();
    const res = await db.execute({
        sql: "INSERT INTO groups (id, name, teacher_id, level_tag) VALUES (?, ?, ?, ?)",
        args: [id, g.name, g.teacher_id ?? null, g.level_tag ?? null]
    });
    return { ...res, lastInsertRowid: id };
};

export const listGroups = async (filters: { teacherId?: string }) => {
    let query = `
        SELECT g.*, u.name as teacher_name,
        (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as student_count
        FROM groups g
        LEFT JOIN users u ON g.teacher_id = u.id
        WHERE 1=1
    `;
    const args: any[] = [];

    if (filters.teacherId) {
        query += " AND g.teacher_id = ?";
        args.push(filters.teacherId);
    }

    const res = await db.execute({ sql: query, args });
    return res.rows as any;
};

export const getGroupById = async (id: string) => {
    const res = await db.execute({
        sql: "SELECT * FROM groups WHERE id = ?",
        args: [id]
    });
    return (res.rows[0] as any) || null;
};

export const updateGroup = async (id: string, updates: Partial<Group>) => {
    const fields = Object.keys(updates);
    if (fields.length === 0) return;

    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const args = fields.map(f => (updates as any)[f]);
    args.push(id);

    await db.execute({
        sql: `UPDATE groups SET ${setClause} WHERE id = ?`,
        args
    });
};

export const deleteGroup = async (id: string) => {
    await db.execute({
        sql: "DELETE FROM groups WHERE id = ?",
        args: [id]
    });
};
