import { db } from "../../config/db";

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
