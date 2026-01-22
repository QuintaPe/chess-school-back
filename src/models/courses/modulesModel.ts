import { db } from "../../config/db";
import { randomUUID } from "crypto";

export interface Module {
    id?: string;
    course_id: string;
    title: string;
    order_index: number;
}

export const createModule = async (m: Module) => {
    const id = m.id || randomUUID();
    const res = await db.execute({
        sql: "INSERT INTO modules (id, course_id, title, order_index) VALUES (?, ?, ?, ?)",
        args: [id, m.course_id, m.title, m.order_index]
    });
    return { ...res, lastInsertRowid: id };
};

export const listModulesByCourse = async (courseId: string) => {
    const res = await db.execute({
        sql: "SELECT * FROM modules WHERE course_id = ? ORDER BY order_index ASC",
        args: [courseId]
    });
    return res.rows as any;
};

export const getFirstModuleIdForCourse = async (courseId: string) => {
    const res = await db.execute({
        sql: "SELECT id FROM modules WHERE course_id = ? ORDER BY order_index ASC LIMIT 1",
        args: [courseId]
    });
    return (res.rows[0] as any)?.id as string | undefined;
};
