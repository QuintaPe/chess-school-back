import { db } from "../../config/db";
import { randomUUID } from "crypto";

export interface Permission {
    id?: string;
    code: string;
    description?: string | null;
}

export const createPermission = async (p: Permission) => {
    const id = p.id || randomUUID();
    const res = await db.execute({
        sql: "INSERT INTO permissions (id, code, description) VALUES (?, ?, ?)",
        args: [id, p.code, p.description ?? null]
    });
    return { ...res, lastInsertRowid: id };
};

export const listPermissions = async (): Promise<Permission[]> => {
    const res = await db.execute({
        sql: "SELECT id, code, description FROM permissions ORDER BY code ASC",
        args: []
    });
    return res.rows as any;
};

export const getPermissionById = async (id: string): Promise<Permission | null> => {
    const res = await db.execute({
        sql: "SELECT id, code, description FROM permissions WHERE id = ?",
        args: [id]
    });
    return (res.rows[0] as any) || null;
};

export const getPermissionByCode = async (code: string): Promise<Permission | null> => {
    const res = await db.execute({
        sql: "SELECT id, code, description FROM permissions WHERE code = ?",
        args: [code]
    });
    return (res.rows[0] as any) || null;
};

export const deletePermission = async (id: string) => {
    await db.execute({
        sql: "DELETE FROM permissions WHERE id = ?",
        args: [id]
    });
};
