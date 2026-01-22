import { db } from "../../config/db";
import { randomUUID } from "crypto";

export interface Course {
    id?: string;
    title: string;
    slug: string;
    level: 'beginner' | 'intermediate' | 'advanced';
    is_published: boolean;
}

export const createCourse = async (course: Course) => {
    const id = course.id || randomUUID();
    const res = await db.execute({
        sql: `
            INSERT INTO courses (id, title, slug, level, is_published)
            VALUES (?, ?, ?, ?, ?)
        `,
        args: [id, course.title, course.slug, course.level, course.is_published ? 1 : 0]
    });
    return { ...res, lastInsertRowid: id };
};

export const updateCourse = async (id: string, updates: Partial<Course>) => {
    const fields = Object.keys(updates);
    if (fields.length === 0) return;

    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const args = fields.map(f => {
        const val = (updates as any)[f];
        if (f === 'is_published' && typeof val === 'boolean') return val ? 1 : 0;
        return val;
    });
    args.push(id);

    await db.execute({
        sql: `UPDATE courses SET ${setClause} WHERE id = ?`,
        args
    });
};

export const getCourseById = async (id: string) => {
    const res = await db.execute({
        sql: "SELECT * FROM courses WHERE id = ?",
        args: [id]
    });
    const row: any = res.rows[0];
    if (!row) return null;
    return {
        ...row,
        is_published: Boolean(row.is_published)
    };
};

export const getCourseBySlug = async (slug: string) => {
    const res = await db.execute({
        sql: "SELECT * FROM courses WHERE slug = ?",
        args: [slug]
    });
    const row: any = res.rows[0];
    if (!row) return null;
    return {
        ...row,
        is_published: Boolean(row.is_published)
    };
};

export const listCourses = async (filters: { level?: string; publishedOnly?: boolean; search?: string }) => {
    let query = "SELECT * FROM courses WHERE 1=1";
    const args: any[] = [];

    if (filters.level) {
        query += " AND level = ?";
        args.push(filters.level);
    }
    if (filters.publishedOnly) {
        query += " AND is_published = 1";
    }
    if (filters.search) {
        query += " AND (title LIKE ? OR slug LIKE ?)";
        args.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    query += " ORDER BY title ASC";

    const res = await db.execute({ sql: query, args });
    return res.rows.map((r: any) => ({ ...r, is_published: Boolean(r.is_published) }));
};
