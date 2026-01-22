import { db } from "../../config/db";
import { randomUUID } from "crypto";

export interface ActivityLog {
    id?: string;
    user_id?: string | null;
    action: string;
    metadata?: any;
    created_at?: string;
}

export const logActivity = async (action: string, message: string, userId?: string) => {
    try {
        const id = randomUUID();
        await db.execute({
            sql: "INSERT INTO activity_log (id, user_id, action, metadata) VALUES (?, ?, ?, ?)",
            args: [id, userId || null, action, JSON.stringify({ message })]
        });
    } catch (error) {
        console.error("Error logging activity:", error);
    }
};

export const getRecentActivity = async (limit: number = 20) => {
    const result = await db.execute({
        sql: "SELECT * FROM activity_log ORDER BY created_at DESC LIMIT ?",
        args: [limit]
    });
    return result.rows.map((row: any) => ({
        id: row.id,
        type: row.action,
        message: (() => {
            try {
                const meta = row.metadata ? JSON.parse(row.metadata) : null;
                return meta?.message || '';
            } catch {
                return '';
            }
        })(),
        createdAt: row.created_at
    }));
};
