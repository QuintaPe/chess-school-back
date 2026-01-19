import { db } from "../config/db";
import { randomUUID } from "crypto";

export interface Course {
    id?: string;
    title: string;
    description?: string;
    level: 'beginner' | 'intermediate' | 'advanced';
    category?: string;
    price: number;
    thumbnail_url?: string;
    is_published: boolean;
}

export interface Lesson {
    id?: string;
    course_id: string;
    title: string;
    content?: string; // Markdown
    video_url?: string;
    order_index: number;
}

export const getCourses = async (filters: { level?: string; category?: string; publishedOnly?: boolean; search?: string; userId?: string }) => {
    let query = `
        SELECT c.*, 
        (SELECT COUNT(*) FROM user_lesson_progress ulp JOIN lessons l ON ulp.lesson_id = l.id WHERE ulp.user_id = ? AND l.course_id = c.id) as completed_lessons,
        (SELECT COUNT(*) FROM lessons WHERE course_id = c.id) as total_lessons,
        EXISTS(SELECT 1 FROM course_enrollments ce WHERE ce.user_id = ? AND ce.course_id = c.id) as is_enrolled
        FROM courses c 
        WHERE 1=1
    `;
    const args: any[] = [filters.userId || null, filters.userId || null];

    if (filters.level) {
        query += " AND level = ?";
        args.push(filters.level);
    }
    if (filters.category) {
        query += " AND category = ?";
        args.push(filters.category);
    }
    if (filters.publishedOnly) {
        query += " AND is_published = 1";
    }
    if (filters.search) {
        query += " AND (title LIKE ? OR description LIKE ?)";
        const search = `%${filters.search}%`;
        args.push(search, search);
    }

    const result = await db.execute({ sql: query, args });

    return result.rows.map((row: any) => ({
        ...row,
        progress_percentage: row.total_lessons > 0 ? Math.round((row.completed_lessons / row.total_lessons) * 100) : 0,
        is_enrolled: Boolean(row.is_enrolled)
    }));
};

export const getEnrolledCourses = async (userId: string) => {
    const query = `
        SELECT c.*, 
        (SELECT COUNT(*) FROM user_lesson_progress ulp JOIN lessons l ON ulp.lesson_id = l.id WHERE ulp.user_id = ? AND l.course_id = c.id) as completed_lessons,
        (SELECT COUNT(*) FROM lessons WHERE course_id = c.id) as total_lessons
        FROM courses c
        JOIN course_enrollments ce ON c.id = ce.course_id
        WHERE ce.user_id = ?
    `;
    const result = await db.execute({ sql: query, args: [userId, userId] });

    return result.rows.map((row: any) => ({
        ...row,
        progress_percentage: row.total_lessons > 0 ? Math.round((row.completed_lessons / row.total_lessons) * 100) : 0
    }));
};

export const getCourseById = async (id: string, userId?: string) => {
    const courseRes = await db.execute({
        sql: "SELECT * FROM courses WHERE id = ?",
        args: [id]
    });
    const course = courseRes.rows[0];
    if (!course) return null;

    const lessonsRes = await db.execute({
        sql: `SELECT l.*, 
              EXISTS(SELECT 1 FROM user_lesson_progress ulp WHERE ulp.user_id = ? AND ulp.lesson_id = l.id) as is_completed
              FROM lessons l WHERE l.course_id = ? ORDER BY l.order_index ASC`,
        args: [userId || null, id]
    });

    const lessons = lessonsRes.rows.map((l: any) => ({ ...l, is_completed: Boolean(l.is_completed) }));
    const total_lessons = lessons.length;
    const completed_lessons = lessons.filter(l => l.is_completed).length;

    return {
        ...course,
        lessons,
        progress_percentage: total_lessons > 0 ? Math.round((completed_lessons / total_lessons) * 100) : 0
    };
};

export const createCourse = async (course: Course) => {
    const id = randomUUID();
    const result = await db.execute({
        sql: `INSERT INTO courses (id, title, description, level, category, price, thumbnail_url, is_published)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [id, course.title, course.description || '', course.level, course.category || '', course.price, course.thumbnail_url || '', course.is_published ? 1 : 0]
    });
    return { ...result, lastInsertRowid: id };
};

export const updateCourse = async (id: string, updates: Partial<Course>) => {
    const fields = Object.keys(updates);
    if (fields.length === 0) return;

    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const args = [...Object.values(updates).map(v => typeof v === 'boolean' ? (v ? 1 : 0) : v), id];

    await db.execute({
        sql: `UPDATE courses SET ${setClause} WHERE id = ?`,
        args
    });
};

export const createLesson = async (lesson: Lesson) => {
    const id = randomUUID();
    const result = await db.execute({
        sql: `INSERT INTO lessons (id, course_id, title, content, video_url, order_index)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [id, lesson.course_id, lesson.title, lesson.content || '', lesson.video_url || '', lesson.order_index]
    });
    return { ...result, lastInsertRowid: id };
};

export const updateLessonOrder = async (lessonId: string, oldIndex: number, newIndex: number, courseId: string) => {
    if (newIndex < oldIndex) {
        await db.execute({
            sql: "UPDATE lessons SET order_index = order_index + 1 WHERE course_id = ? AND order_index >= ? AND order_index < ?",
            args: [courseId, newIndex, oldIndex]
        });
    } else {
        await db.execute({
            sql: "UPDATE lessons SET order_index = order_index - 1 WHERE course_id = ? AND order_index > ? AND order_index <= ?",
            args: [courseId, oldIndex, newIndex]
        });
    }
    await db.execute({
        sql: "UPDATE lessons SET order_index = ? WHERE id = ?",
        args: [newIndex, lessonId]
    });
};

export const enrollUser = async (userId: string, courseId: string) => {
    await db.execute({
        sql: "INSERT OR IGNORE INTO course_enrollments (user_id, course_id) VALUES (?, ?)",
        args: [userId, courseId]
    });
};

export const isUserEnrolled = async (userId: string, courseId: string) => {
    const result = await db.execute({
        sql: "SELECT 1 FROM course_enrollments WHERE user_id = ? AND course_id = ?",
        args: [userId, courseId]
    });
    return result.rows.length > 0;
};

export const completeLesson = async (userId: string, lessonId: string) => {
    await db.execute({
        sql: "INSERT OR IGNORE INTO user_lesson_progress (user_id, lesson_id) VALUES (?, ?)",
        args: [userId, lessonId]
    });
};

export const uncompleteLesson = async (userId: string, lessonId: string) => {
    await db.execute({
        sql: "DELETE FROM user_lesson_progress WHERE user_id = ? AND lesson_id = ?",
        args: [userId, lessonId]
    });
};
