import { db } from "../../config/db";
import { randomUUID } from 'crypto';

export interface User {
    id?: string;
    name: string;
    email: string;
    password_hash?: string;
    status?: 'active' | 'banned' | 'pending';
    avatar_url?: string;
    last_login_at?: string;
    created_at?: string;
}

export const createUser = async (user: User) => {
    const id = user.id || randomUUID();
    const result = await db.execute({
        sql: `INSERT INTO users (id, email, password_hash, name, avatar_url, status)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [
            id,
            user.email,
            user.password_hash || '',
            user.name,
            user.avatar_url || null,
            user.status || 'active'
        ]
    });

    return { ...result, lastInsertRowid: id };
};

export const findUserByEmail = async (email: string) => {
    const result = await db.execute({
        sql: "SELECT * FROM users WHERE email = ?",
        args: [email]
    });
    return result.rows[0];
};

export const findUserById = async (id: string) => {
    const result = await db.execute({
        sql: "SELECT * FROM users WHERE id = ?",
        args: [id]
    });
    return result.rows[0];
};

export const updateLastLogin = async (id: string) => {
    await db.execute({
        sql: "UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?",
        args: [id]
    });
};

export const updateUser = async (id: string, updates: Partial<User>) => {
    const fields = Object.keys(updates);
    if (fields.length === 0) return;

    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const args = [...Object.values(updates), id];

    await db.execute({
        sql: `UPDATE users SET ${setClause} WHERE id = ?`,
        args
    });
};

export const listUsers = async (filters: { role?: string; search?: string }) => {
    let query = `
        SELECT u.id, u.name, u.email, u.status, u.avatar_url, u.created_at, 
               GROUP_CONCAT(ur.role_id) as roles
        FROM users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id
        WHERE 1=1
    `;
    const args = [];

    if (filters.role) {
        // This filter is tricky with GROUP BY. 
        // Better to filter using HAVING or subquery, but for simplicity let's rely on the WHERE clause filtering the initial set if possible, 
        // OR simpler: Filter users who have the role in the user_roles table.
        query += " AND u.id IN (SELECT user_id FROM user_roles WHERE role_id = ?)";
        args.push(filters.role);
    }
    if (filters.search) {
        query += " AND (u.name LIKE ? OR u.email LIKE ?)";
        args.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    query += " GROUP BY u.id";

    const result = await db.execute({ sql: query, args });

    return result.rows.map((row: any) => ({
        ...row,
        roles: row.roles ? row.roles.split(',') : []
    }));
};

export const deleteUser = async (id: string) => {
    await db.execute({
        sql: "DELETE FROM users WHERE id = ?",
        args: [id]
    });
};
