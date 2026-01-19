import { db } from "../config/db";
import { randomUUID } from "crypto";

export interface Activity {
    id?: string;
    type: string;
    message: string;
    created_at?: string;
}

export const logActivity = async (type: string, message: string) => {
    try {
        const id = randomUUID();
        await db.execute({
            sql: "INSERT INTO activity_log (id, type, message) VALUES (?, ?, ?)",
            args: [id, type, message]
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
        type: row.type,
        message: row.message,
        createdAt: row.created_at
    }));
};
