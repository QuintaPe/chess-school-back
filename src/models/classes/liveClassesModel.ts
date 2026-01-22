import { db } from "../../config/db";
import { randomUUID } from "crypto";

export interface LiveClass {
    id?: string;
    title: string;
    teacher_id?: string | null;
    scheduled_at: string;
    duration_mins: number;
    room_url?: string | null;
    status: 'scheduled' | 'live' | 'finished';
}

export const listLiveClasses = async (filters: { status?: string }) => {
    let query = "SELECT * FROM live_classes WHERE 1=1";
    const args: any[] = [];

    if (filters.status) {
        query += " AND status = ?";
        args.push(filters.status);
    }

    query += " ORDER BY scheduled_at ASC";

    const res = await db.execute({ sql: query, args });
    return res.rows as any;
};

export const getLiveClassById = async (id: string) => {
    const res = await db.execute({
        sql: "SELECT * FROM live_classes WHERE id = ?",
        args: [id]
    });
    return (res.rows[0] as any) || null;
};

export const createLiveClass = async (lc: LiveClass) => {
    const id = lc.id || randomUUID();
    const res = await db.execute({
        sql: `
            INSERT INTO live_classes (id, title, teacher_id, scheduled_at, duration_mins, room_url, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
            id,
            lc.title,
            lc.teacher_id ?? null,
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
