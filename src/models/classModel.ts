import { db } from "../config/db";
import { randomUUID } from "crypto";

export interface Class {
    id?: string;
    title: string;
    level: 'beginner' | 'intermediate' | 'advanced';
    start_time: string;
    teacher_id?: string | null;
    group_id?: string | null;
    status: 'scheduled' | 'live' | 'completed' | 'canceled';
    meeting_link?: string | null;
    video_url?: string | null;
    recurring_days?: number[] | null; // [1, 3, 5] for Mon, Wed, Fri
}

export const getClasses = async (filters: { level?: string; status?: string; userId?: string }) => {
    let query = `
        SELECT c.*, 
        EXISTS(SELECT 1 FROM class_registrations cr WHERE cr.class_id = c.id AND cr.user_id = ?) as is_registered
        FROM classes c WHERE 1=1
    `;
    const args: any[] = [filters.userId || null];

    if (filters.level) {
        query += " AND level = ?";
        args.push(filters.level);
    }
    if (filters.status) {
        query += " AND status = ?";
        args.push(filters.status);
    }

    const result = await db.execute({ sql: query, args });
    return result.rows;
};

export const getClassById = async (id: string) => {
    const result = await db.execute({
        sql: "SELECT * FROM classes WHERE id = ?",
        args: [id]
    });
    return result.rows[0];
};

export const getRegistrationCount = async (classId: string) => {
    const result = await db.execute({
        sql: "SELECT COUNT(*) as count FROM class_registrations WHERE class_id = ?",
        args: [classId]
    });
    return (result.rows[0] as any).count;
};

export const registerUser = async (userId: string, classId: string) => {
    await db.execute({
        sql: "INSERT INTO class_registrations (user_id, class_id) VALUES (?, ?)",
        args: [userId, classId]
    });
};

export const createClass = async (cls: Class) => {
    const id = randomUUID();

    // Logic: if group_id is provided, we can fetch teacher_id from group, 
    // but for now, we follow the rule: "teacher_id solo si no hay group_id"
    // If group_id exists, we set teacher_id to null in this table instance if desired, 
    // or just pass what's provided.
    const finalTeacherId = cls.group_id ? null : cls.teacher_id;

    const result = await db.execute({
        sql: `INSERT INTO classes (id, title, level, start_time, teacher_id, group_id, status, meeting_link, video_url, recurring_days)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
            id,
            cls.title,
            cls.level,
            cls.start_time,
            finalTeacherId ?? null,
            cls.group_id ?? null,
            cls.status,
            cls.meeting_link ?? null,
            cls.video_url ?? null,
            JSON.stringify(cls.recurring_days || [])
        ]
    });
    return { ...result, lastInsertRowid: id };
};

export const getDiscordSettings = async () => {
    const result = await db.execute("SELECT * FROM discord_settings");
    const settings: Record<string, string> = {};
    result.rows.forEach((row: any) => {
        settings[row.key] = row.value;
    });
    return settings;
};

export const updateDiscordSetting = async (key: string, value: string) => {
    await db.execute({
        sql: "UPDATE discord_settings SET value = ? WHERE key = ?",
        args: [value, key]
    });
};

export const updateClass = async (id: string, updates: Partial<Class>) => {
    const fields = Object.keys(updates);
    if (fields.length === 0) return;

    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const args = fields.map(field => {
        const val = (updates as any)[field];
        if (field === 'recurring_days') return JSON.stringify(val || []);
        return val;
    });
    args.push(id);

    await db.execute({
        sql: `UPDATE classes SET ${setClause} WHERE id = ?`,
        args
    });
};

export const deleteClass = async (id: string) => {
    await db.execute({
        sql: "DELETE FROM classes WHERE id = ?",
        args: [id]
    });
};
