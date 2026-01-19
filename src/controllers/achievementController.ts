import { Request, Response } from 'express';
import * as AchievementModel from '../models/achievementModel';

export const listAchievements = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        const achievements = await AchievementModel.getAllAchievements(userId);
        return res.json(achievements);
    } catch (error) {
        console.error("Error listing achievements:", error);
        return res.status(500).json({ error: "Error interno del servidor" });
    }
};

export const getMyAchievements = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const achievements = await AchievementModel.getUnlockedAchievements(userId);
        return res.json(achievements);
    } catch (error) {
        console.error("Error getting user achievements:", error);
        return res.status(500).json({ error: "Error interno del servidor" });
    }
};
