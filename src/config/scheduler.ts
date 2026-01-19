import cron from 'node-cron';
import * as DailyPuzzleModel from '../models/dailyPuzzleModel';

export const initScheduler = () => {
    // Schedule tomorrow's puzzle creation at 23:55 daily
    // to ensure it's ready for the next day
    cron.schedule('55 23 * * *', async () => {
        try {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const dateStr = tomorrow.toISOString().split('T')[0];

            // Check if already exists
            const existing = await DailyPuzzleModel.getDailyPuzzleByDate(dateStr);
            if (!existing) {
                const puzzleId = await DailyPuzzleModel.selectRandomPuzzleForDaily();
                if (puzzleId) {
                    await DailyPuzzleModel.createDailyPuzzle(puzzleId, dateStr);
                    console.log(`[Scheduler] Daily puzzle created for ${dateStr}`);
                }
            }
        } catch (error) {
            console.error("[Scheduler] Error creating next daily puzzle:", error);
        }
    });

    console.log("[Scheduler] Daily Puzzle scheduler initialized");
};
