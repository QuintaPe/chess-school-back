import { Request, Response } from 'express';
import * as DailyPuzzleModel from '../models/dailyPuzzleModel';
import * as UserModel from '../models/userModel';
import { db } from '../config/db';
import { z } from 'zod';
import { checkAndUnlockAchievements } from '../models/achievementModel';

const attemptSchema = z.object({
    dailyPuzzleId: z.string(),
    moves: z.array(z.string()),
    solved: z.boolean(),
    timeSpent: z.number()
});

export const getDailyPuzzle = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        const today = new Date().toISOString().split('T')[0];

        let dailyPuzzle = await DailyPuzzleModel.getDailyPuzzleByDate(today, userId);

        if (!dailyPuzzle) {
            // Select automatically if none exists
            const puzzleId = await DailyPuzzleModel.selectRandomPuzzleForDaily();
            if (!puzzleId) {
                return res.status(404).json({ error: "No hay puzzle disponible para hoy" });
            }
            await DailyPuzzleModel.createDailyPuzzle(puzzleId, today);
            dailyPuzzle = await DailyPuzzleModel.getDailyPuzzleByDate(today, userId);
        }

        return res.json(dailyPuzzle);
    } catch (error) {
        console.error("Error fetching daily puzzle:", error);
        return res.status(500).json({ error: "Error interno del servidor" });
    }
};

export const recordAttempt = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const body = attemptSchema.parse(req.body);

        // Fetch daily puzzle to verify solution
        const dailyPuzzle = await DailyPuzzleModel.getDailyPuzzleByDate(new Date().toISOString().split('T')[0], userId);

        if (!dailyPuzzle || dailyPuzzle.dailyPuzzleId !== body.dailyPuzzleId) {
            return res.status(400).json({ error: "ID de puzzle diario inválido o puzzle no corresponde a hoy" });
        }

        // Validate solution if solved is true
        const isSolutionCorrect = JSON.stringify(dailyPuzzle.solution) === JSON.stringify(body.moves);
        const solved = body.solved && isSolutionCorrect;

        // Save attempt
        await DailyPuzzleModel.upsertDailyPuzzleAttempt({
            userId,
            dailyPuzzleId: body.dailyPuzzleId,
            solved: solved,
            attempts: 1, // Will be incremented in model
            timeSpent: body.timeSpent
        });

        // Get updated attempt data
        const updatedPuzzle = await DailyPuzzleModel.getDailyPuzzleByDate(new Date().toISOString().split('T')[0], userId);
        const attempt = updatedPuzzle.userAttempt;

        if (solved) {
            // Calculate ELO reward
            // +5 points for 1st attempt
            // +3 points for 2-3 attempts
            // +1 point for >3 attempts
            let eloGained = 1;
            if (attempt.attempts === 1) eloGained = 5;
            else if (attempt.attempts <= 3) eloGained = 3;

            const userStats = await UserModel.getUserStats(userId);
            const currentRating = Number(userStats?.rating || 1200);
            const newRating = currentRating + eloGained;

            await UserModel.updateUserStats(userId, {
                rating: newRating,
                puzzles_solved: Number(userStats?.puzzles_solved || 0) + 1
            });

            // --- Check achievements ---
            const totalSolved = Number(userStats?.puzzles_solved || 0) + 1;
            const streak = await DailyPuzzleModel.getDailyStats(userId).then(s => s.currentStreak);

            const unlockedTotal = await checkAndUnlockAchievements(userId, 'puzzle_solve_total', totalSolved);
            const unlockedStreak = await checkAndUnlockAchievements(userId, 'puzzle_streak', streak);

            const newAchievements = [...unlockedTotal, ...unlockedStreak];

            return res.json({
                success: true,
                solved: true,
                attempts: attempt.attempts,
                totalTimeSpent: attempt.timeSpent,
                completedAt: attempt.completedAt,
                message: "¡Felicidades! Has resuelto el puzzle del día",
                eloGained,
                newAchievements // Inform the frontend if achievements were unlocked
            });
        }

        return res.json({
            success: true,
            solved: false,
            attempts: attempt.attempts,
            totalTimeSpent: attempt.timeSpent,
            message: "Intento registrado"
        });

    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: "Datos de intento inválidos", details: error.issues });
        }
        console.error("Error recording daily attempt:", error);
        return res.status(500).json({ error: "Error interno del servidor" });
    }
};

export const getStats = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const stats = await DailyPuzzleModel.getDailyStats(userId);
        return res.json(stats);
    } catch (error) {
        console.error("Error fetching daily stats:", error);
        return res.status(500).json({ error: "Error interno del servidor" });
    }
};

export const getLeaderboard = async (req: Request, res: Response) => {
    try {
        const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
        const leaderboard = await DailyPuzzleModel.getDailyLeaderboard(date);

        // Additional stats for leaderboard response
        // This is a bit simplified, but follows the spec
        const stats = await db.execute({
            sql: `
                SELECT 
                    COUNT(*) as totalAttempted,
                    SUM(CASE WHEN solved = 1 THEN 1 ELSE 0 END) as totalSolved
                FROM daily_puzzle_attempts dpa
                JOIN daily_puzzles dp ON dpa.daily_puzzle_id = dp.id
                WHERE dp.date = ?
            `,
            args: [date]
        });

        return res.json({
            date,
            leaderboard,
            totalSolved: Number(stats.rows[0]?.totalSolved || 0),
            totalAttempted: Number(stats.rows[0]?.totalAttempted || 0)
        });
    } catch (error) {
        console.error("Error fetching leaderboard:", error);
        return res.status(500).json({ error: "Error interno del servidor" });
    }
};
