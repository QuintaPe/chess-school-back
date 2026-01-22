import { db } from "../../config/db";

export interface RolePermission {
    role_id: string;
    permission_id: string;
}

export const addPermissionToRole = async (roleId: string, permissionId: string) => {
    await db.execute({
        sql: "INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)",
        args: [roleId, permissionId]
    });
};

export const removePermissionFromRole = async (roleId: string, permissionId: string) => {
    await db.execute({
        sql: "DELETE FROM role_permissions WHERE role_id = ? AND permission_id = ?",
        args: [roleId, permissionId]
    });
};

export const listRolePermissions = async (roleId: string) => {
    const res = await db.execute({
        sql: "SELECT role_id, permission_id FROM role_permissions WHERE role_id = ?",
        args: [roleId]
    });
    return res.rows as any;
};

export const listRolePermissionCodes = async (roleId: string): Promise<string[]> => {
    const res = await db.execute({
        sql: `
            SELECT p.code
            FROM role_permissions rp
            JOIN permissions p ON p.id = rp.permission_id
            WHERE rp.role_id = ?
            ORDER BY p.code ASC
        `,
        args: [roleId]
    });
    return res.rows.map((r: any) => r.code as string);
};
