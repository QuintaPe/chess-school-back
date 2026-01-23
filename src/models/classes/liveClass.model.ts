import { db } from "../../config/db";
import { randomUUID } from "crypto";

export interface LiveClass {
    id?: string;
    title: string;
    teacher_id?: string | null;
    group_id?: string | null;
    scheduled_at: string;
    duration_mins: number;
    room_url?: string | null;
    status: 'scheduled' | 'live' | 'finished';
}

export const listLiveClasses = async (filters: { status?: string, group_id?: string, userId?: string }) => {
    let query = `
        SELECT lc.*, u.name as teacher_name, g.name as group_name 
        ${filters.userId ? ', (SELECT 1 FROM live_attendance la WHERE la.live_class_id = lc.id AND la.user_id = ?) as is_registered' : ''}
        FROM live_classes lc
        LEFT JOIN users u ON lc.teacher_id = u.id
        LEFT JOIN groups g ON lc.group_id = g.id
        WHERE 1=1
    `;
    const args: any[] = [];
    if (filters.userId) args.push(filters.userId);

    if (filters.status) {
        query += " AND lc.status = ?";
        args.push(filters.status);
    }

    if (filters.group_id) {
        query += " AND lc.group_id = ?";
        args.push(filters.group_id);
    }

    query += " ORDER BY lc.scheduled_at ASC";

    const res = await db.execute({ sql: query, args });
    return res.rows as any;
};

export const getLiveClassById = async (id: string, userId?: string) => {
    const res = await db.execute({
        sql: `
            SELECT lc.*, u.name as teacher_name, g.name as group_name 
            ${userId ? ', (SELECT 1 FROM live_attendance la WHERE la.live_class_id = lc.id AND la.user_id = ?) as is_registered' : ''}
            FROM live_classes lc
            LEFT JOIN users u ON lc.teacher_id = u.id
            LEFT JOIN groups g ON lc.group_id = g.id
            WHERE lc.id = ?
        `,
        args: userId ? [userId, id] : [id]
    });
    return (res.rows[0] as any) || null;
};

export const createLiveClass = async (lc: LiveClass) => {
    const id = lc.id || randomUUID();
    const res = await db.execute({
        sql: `
            INSERT INTO live_classes (id, title, teacher_id, group_id, scheduled_at, duration_mins, room_url, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
            id,
            lc.title,
            lc.teacher_id ?? null,
            lc.group_id ?? null,
            lc.scheduled_at,
            lc.duration_mins,
            lc.room_url ?? null,
            lc.status
        ]
    });
    return { ...res, lastInsertRowid: id };
};

export const updateLiveClass = async (id: string, updates: Partial<LiveClass>) => {
    const fields = Object.keys(updates);
    if (fields.length === 0) return;

    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const args = fields.map(f => (updates as any)[f]);
    args.push(id);

    await db.execute({
        sql: `UPDATE live_classes SET ${setClause} WHERE id = ?`,
        args
    });
};

export const deleteLiveClass = async (id: string) => {
    await db.execute({
        sql: "DELETE FROM live_classes WHERE id = ?",
        args: [id]
    });
};
