import { db } from "../../config/db";

export const markLessonCompleted = async (userId: string, lessonId: string) => {
    await db.execute({
        sql: `
            INSERT INTO user_progress (user_id, lesson_id, status, completed_at)
            VALUES (?, ?, 'completed', CURRENT_TIMESTAMP)
            ON CONFLICT(user_id, lesson_id) DO UPDATE SET
                status = 'completed',
                completed_at = CURRENT_TIMESTAMP
        `,
        args: [userId, lessonId]
    });
};

export const uncompleteLesson = async (userId: string, lessonId: string) => {
    await db.execute({
        sql: "DELETE FROM user_progress WHERE user_id = ? AND lesson_id = ?",
        args: [userId, lessonId]
    });
};

export const listUserProgressByCourse = async (userId: string, courseId: string) => {
    const res = await db.execute({
        sql: `
            SELECT up.*
            FROM user_progress up
            JOIN lessons l ON l.id = up.lesson_id
            JOIN modules m ON m.id = l.module_id
            WHERE up.user_id = ? AND m.course_id = ?
        `,
        args: [userId, courseId]
    });
    return res.rows as any;
};
