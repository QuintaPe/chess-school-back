import { db } from "../config/db";

export interface Achievement {
    id: string;
    name: string;
    description: string;
    icon_url: string | null;
    criteria_type: string;
    criteria_value: number;
    unlocked_at?: string;
}

export const getAllAchievements = async (userId?: string) => {
    let query = `
        SELECT a.*, ua.unlocked_at
        FROM achievements a
        LEFT JOIN user_achievements ua ON a.id = ua.achievement_id AND ua.user_id = ?
        ORDER BY a.criteria_value ASC
    `;
    const result = await db.execute({
        sql: query,
        args: [userId || null]
    });
    return result.rows.map((row: any) => ({
        ...row,
        isUnlocked: !!row.unlocked_at
    }));
};

export const getUnlockedAchievements = async (userId: string) => {
    const result = await db.execute({
        sql: `
            SELECT a.*, ua.unlocked_at
            FROM achievements a
            JOIN user_achievements ua ON a.id = ua.achievement_id
            WHERE ua.user_id = ?
            ORDER BY ua.unlocked_at DESC
        `,
        args: [userId]
    });
    return result.rows;
};

export const unlockAchievement = async (userId: string, achievementId: string) => {
    try {
        await db.execute({
            sql: "INSERT OR IGNORE INTO user_achievements (user_id, achievement_id) VALUES (?, ?)",
            args: [userId, achievementId]
        });
        return true;
    } catch (error) {
        console.error("Error unlocking achievement:", error);
        return false;
    }
};

/**
 * Checks for new achievements for a user based on criteria
 */
export const checkAndUnlockAchievements = async (userId: string, criteriaType: string, currentValue: number) => {
    // Find achievements of this type that the user hasn't unlocked yet but meets the criteria
    const result = await db.execute({
        sql: `
            SELECT id FROM achievements 
            WHERE criteria_type = ? 
            AND criteria_value <= ?
            AND id NOT IN (SELECT achievement_id FROM user_achievements WHERE user_id = ?)
        `,
        args: [criteriaType, currentValue, userId]
    });

    const newlyUnlocked = [];
    for (const row of result.rows) {
        const achievementId = row.id as string;
        const success = await unlockAchievement(userId, achievementId);
        if (success) {
            newlyUnlocked.push(achievementId);
        }
    }

    return newlyUnlocked;
};
