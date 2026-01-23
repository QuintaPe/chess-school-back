import { db } from "../../config/db";
import { randomUUID } from "crypto";

export interface Role {
    id: string;
    name: string;
    role_type: 'admin' | 'membership';
}

export const listRoles = async (): Promise<Role[]> => {
    const res = await db.execute({
        sql: "SELECT id, name, role_type FROM roles ORDER BY name ASC",
        args: []
    });
    return res.rows as any;
};

export const getRoleById = async (id: string): Promise<Role | null> => {
    const res = await db.execute({
        sql: "SELECT id, name, role_type FROM roles WHERE id = ?",
        args: [id]
    });
    return (res.rows[0] as any) || null;
};

export const createRole = async (role: Omit<Role, 'id'> & { id?: string }) => {
    const id = role.id || randomUUID();
    const res = await db.execute({
        sql: "INSERT INTO roles (id, name, role_type) VALUES (?, ?, ?)",
        args: [id, role.name, role.role_type]
    });
    return { ...res, lastInsertRowid: id };
};

export const updateRole = async (id: string, updates: Partial<Role>) => {
    const fields = Object.keys(updates).filter(k => k !== 'id');
    if (fields.length === 0) return;

    const setClause = fields.map(k => `${k} = ?`).join(", ");
    const args = fields.map(k => (updates as any)[k]);
    args.push(id);

    await db.execute({
        sql: `UPDATE roles SET ${setClause} WHERE id = ?`,
        args
    });
};

export const deleteRole = async (id: string) => {
    await db.execute({
        sql: "DELETE FROM roles WHERE id = ?",
        args: [id]
    });
};
