import { db } from "../../config/db";
import { randomUUID } from "crypto";

export interface Lesson {
    id?: string;
    module_id: string;
    title: string;
    lesson_type: 'video' | 'article' | 'interactive_board';
    content_md?: string | null;
    video_url?: string | null;
    order_index: number;
}

export const createLesson = async (lesson: Lesson) => {
    const id = lesson.id || randomUUID();
    const res = await db.execute({
        sql: `
            INSERT INTO lessons (id, module_id, title, lesson_type, content_md, video_url, order_index)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
            id,
            lesson.module_id,
            lesson.title,
            lesson.lesson_type,
            lesson.content_md ?? null,
            lesson.video_url ?? null,
            lesson.order_index
        ]
    });
    return { ...res, lastInsertRowid: id };
};

export const listLessonsByCourse = async (courseId: string) => {
    const res = await db.execute({
        sql: `
            SELECT l.*, m.id as module_id
            FROM lessons l
            JOIN modules m ON m.id = l.module_id
            WHERE m.course_id = ?
            ORDER BY m.order_index ASC, l.order_index ASC
        `,
        args: [courseId]
    });
    return res.rows as any;
};

export const getLessonById = async (id: string) => {
    const res = await db.execute({
        sql: "SELECT * FROM lessons WHERE id = ?",
        args: [id]
    });
    return (res.rows[0] as any) || null;
};

export const getLessonWithCourseId = async (lessonId: string) => {
    const res = await db.execute({
        sql: `
            SELECT l.*, m.course_id
            FROM lessons l
            JOIN modules m ON m.id = l.module_id
            WHERE l.id = ?
        `,
        args: [lessonId]
    });
    return (res.rows[0] as any) || null;
};

export const updateLessonOrder = async (lessonId: string, oldIndex: number, newIndex: number, moduleId: string) => {
    if (newIndex < oldIndex) {
        await db.execute({
            sql: "UPDATE lessons SET order_index = order_index + 1 WHERE module_id = ? AND order_index >= ? AND order_index < ?",
            args: [moduleId, newIndex, oldIndex]
        });
    } else {
        await db.execute({
            sql: "UPDATE lessons SET order_index = order_index - 1 WHERE module_id = ? AND order_index > ? AND order_index <= ?",
            args: [moduleId, oldIndex, newIndex]
        });
    }

    await db.execute({
        sql: "UPDATE lessons SET order_index = ? WHERE id = ?",
        args: [newIndex, lessonId]
    });
};

export const updateLesson = async (id: string, updates: Partial<Lesson>) => {
    const fields = Object.keys(updates);
    if (fields.length === 0) return;

    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const args = [...Object.values(updates), id];

    await db.execute({
        sql: `UPDATE lessons SET ${setClause} WHERE id = ?`,
        args
    });
};

export const deleteLesson = async (id: string) => {
    await db.execute({
        sql: "DELETE FROM lessons WHERE id = ?",
        args: [id]
    });
};
