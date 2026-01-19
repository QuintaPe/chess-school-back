import { db } from "../config/db";

export interface Class {
    id?: number;
    title: string;
    level: 'beginner' | 'intermediate' | 'advanced';
    start_time: string;
    end_time?: string;
    capacity: number;
    teacher_id?: string;
    status: 'scheduled' | 'live' | 'completed' | 'canceled';
    meeting_link?: string;
    recording_url?: string;
    platform?: string;
    video_url?: string;
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

export const getClassById = async (id: number) => {
    const result = await db.execute({
        sql: "SELECT * FROM classes WHERE id = ?",
        args: [id]
    });
    return result.rows[0];
};

export const getRegistrationCount = async (classId: number) => {
    const result = await db.execute({
        sql: "SELECT COUNT(*) as count FROM class_registrations WHERE class_id = ?",
        args: [classId]
    });
    return (result.rows[0] as any).count;
};

export const registerUser = async (userId: string, classId: number) => {
    await db.execute({
        sql: "INSERT INTO class_registrations (user_id, class_id) VALUES (?, ?)",
        args: [userId, classId]
    });
};

export const createClass = async (cls: Class) => {
    const result = await db.execute({
        sql: `INSERT INTO classes (title, level, start_time, end_time, capacity, teacher_id, status, meeting_link, recording_url, platform, video_url)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
            cls.title,
            cls.level,
            cls.start_time,
            cls.end_time || null,
            cls.capacity,
            cls.teacher_id || null,
            cls.status,
            cls.meeting_link || null,
            cls.recording_url || null,
            cls.platform || null,
            cls.video_url || null
        ]
    });
    return result;
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

export const updateClass = async (id: number, updates: Partial<Class>) => {
    const fields = Object.keys(updates);
    if (fields.length === 0) return;

    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const args = [...Object.values(updates), id];

    await db.execute({
        sql: `UPDATE classes SET ${setClause} WHERE id = ?`,
        args
    });
};

export const deleteClass = async (id: number) => {
    await db.execute({
        sql: "DELETE FROM classes WHERE id = ?",
        args: [id]
    });
};
