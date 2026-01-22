import { db } from "../../config/db";

export interface UserRole {
    user_id: string;
    role_id: string;
}

export const assignRoleToUser = async (userId: string, roleId: string) => {
    await db.execute({
        sql: "INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)",
        args: [userId, roleId]
    });
};

export const removeRoleFromUser = async (userId: string, roleId: string) => {
    await db.execute({
        sql: "DELETE FROM user_roles WHERE user_id = ? AND role_id = ?",
        args: [userId, roleId]
    });
};

export const listUserRoleIds = async (userId: string): Promise<string[]> => {
    const res = await db.execute({
        sql: "SELECT role_id FROM user_roles WHERE user_id = ?",
        args: [userId]
    });
    return res.rows.map((r: any) => r.role_id as string);
};

export const getUserRoles = async (userId: string): Promise<string[]> => {
    return listUserRoleIds(userId);
};

// Helper: Check if a user has a specific role
export const hasRole = async (userId: string, roleId: string): Promise<boolean> => {
    const roles = await listUserRoleIds(userId);
    return roles.includes(roleId);
};

export const listUsersByRole = async (roleId: string) => {
    const res = await db.execute({
        sql: "SELECT user_id, role_id FROM user_roles WHERE role_id = ?",
        args: [roleId]
    });
    return res.rows as any;
};
