import { db } from "../../config/db";
import { randomUUID } from "crypto";

export const grantCourseLifetimeEntitlement = async (userId: string, courseId: string) => {
    const existing = await db.execute({
        sql: `
            SELECT id FROM user_entitlements
            WHERE user_id = ? AND resource_type = 'course' AND resource_id = ?
            LIMIT 1
        `,
        args: [userId, courseId]
    });

    if (existing.rows[0]) return (existing.rows[0] as any).id as string;

    const id = randomUUID();
    await db.execute({
        sql: `
            INSERT INTO user_entitlements (id, user_id, resource_type, resource_id, access_mode, starts_at, expires_at)
            VALUES (?, ?, 'course', ?, 'lifetime', CURRENT_TIMESTAMP, NULL)
        `,
        args: [id, userId, courseId]
    });

    return id;
};

export const listEntitledCourses = async (userId: string) => {
    const res = await db.execute({
        sql: `
            SELECT c.*
            FROM user_entitlements ue
            JOIN courses c ON c.id = ue.resource_id
            WHERE ue.user_id = ?
            AND ue.resource_type = 'course'
            AND ue.starts_at <= CURRENT_TIMESTAMP
            AND (ue.expires_at IS NULL OR ue.expires_at > CURRENT_TIMESTAMP)
        `,
        args: [userId]
    });

    return res.rows as any;
};
