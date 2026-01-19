import { db } from "../config/db";
import { randomUUID } from 'crypto';

export interface User {
    id?: string;
    name: string;
    email: string;
    password?: string;
    role: 'student' | 'teacher' | 'admin';
    status?: 'active' | 'inactive' | 'pending';
    subscription_plan?: 'free' | 'premium';
    avatar_url?: string;
    bio?: string;
    discord_id?: string;
    discord_username?: string;
    discord_access_token?: string;
    discord_refresh_token?: string;
}

export const createUser = async (user: User) => {
    const id = user.id || randomUUID();
    const result = await db.execute({
        sql: `INSERT INTO users (id, name, email, password, role, status, subscription_plan, avatar_url, bio, discord_id, discord_username, discord_access_token, discord_refresh_token) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
            id,
            user.name,
            user.email,
            user.password || '',
            user.role,
            user.status || 'active',
            user.subscription_plan || 'free',
            user.avatar_url || null,
            user.bio || null,
            user.discord_id || null,
            user.discord_username || null,
            user.discord_access_token || null,
            user.discord_refresh_token || null
        ]
    });

    // Create empty stats for the user
    await db.execute({
        sql: "INSERT INTO user_stats (user_id) VALUES (?)",
        args: [id]
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
    let query = "SELECT id, name, email, role, status, subscription_plan, avatar_url FROM users WHERE 1=1";
    const args = [];

    if (filters.role) {
        query += " AND role = ?";
        args.push(filters.role);
    }
    if (filters.search) {
        query += " AND (name LIKE ? OR email LIKE ?)";
        args.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    const result = await db.execute({ sql: query, args });
    return result.rows;
};

export const getUserStats = async (userId: string) => {
    const statsResult = await db.execute({
        sql: "SELECT * FROM user_stats WHERE user_id = ?",
        args: [userId]
    });
    return statsResult.rows[0];
};

export const deleteUser = async (id: string) => {
    await db.execute({
        sql: "DELETE FROM users WHERE id = ?",
        args: [id]
    });
};
