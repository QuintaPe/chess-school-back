import { db } from "../../config/db";

export interface GroupMember {
    group_id: string;
    user_id: string;
    joined_at?: string;
}

export const addMember = async (groupId: string, userId: string) => {
    await db.execute({
        sql: "INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)",
        args: [groupId, userId]
    });
};

export const removeMember = async (groupId: string, userId: string) => {
    await db.execute({
        sql: "DELETE FROM group_members WHERE group_id = ? AND user_id = ?",
        args: [groupId, userId]
    });
};

export const listMembers = async (groupId: string) => {
    const res = await db.execute({
        sql: `
            SELECT u.id, u.name, u.email, u.avatar_url, gm.joined_at
            FROM group_members gm
            JOIN users u ON u.id = gm.user_id
            WHERE gm.group_id = ?
            ORDER BY gm.joined_at ASC
        `,
        args: [groupId]
    });
    return res.rows as any;
};
