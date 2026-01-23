import { db } from "../../config/db";

export interface LiveAttendance {
    live_class_id: string;
    user_id: string;
    joined_at?: string;
}

export const registerAttendance = async (liveClassId: string, userId: string) => {
    await db.execute({
        sql: "INSERT OR IGNORE INTO live_attendance (live_class_id, user_id) VALUES (?, ?)",
        args: [liveClassId, userId]
    });
};

export const removeAttendance = async (liveClassId: string, userId: string) => {
    await db.execute({
        sql: "DELETE FROM live_attendance WHERE live_class_id = ? AND user_id = ?",
        args: [liveClassId, userId]
    });
};

export const listAttendanceForClass = async (liveClassId: string) => {
    const res = await db.execute({
        sql: `
            SELECT u.id, u.name, u.email, u.avatar_url, la.joined_at
            FROM live_attendance la
            JOIN users u ON u.id = la.user_id
            WHERE la.live_class_id = ?
            ORDER BY la.joined_at ASC
        `,
        args: [liveClassId]
    });
    return res.rows as any;
};
