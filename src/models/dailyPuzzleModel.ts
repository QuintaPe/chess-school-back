import { db } from "../config/db";
import { Puzzle, getPuzzleById } from "./puzzleModel";
import { randomUUID } from "crypto";

export interface DailyPuzzle extends Puzzle {
    dailyPuzzleId: string;
    date: string;
    userAttempt?: {
        solved: boolean;
        attempts: number;
        timeSpent: number;
        completedAt: string | null;
    };
}

export interface DailyPuzzleAttempt {
    userId: string;
    dailyPuzzleId: string;
    solved: boolean;
    attempts: number;
    timeSpent: number;
    completedAt?: string;
}

export const getDailyPuzzleByDate = async (date: string, userId?: string): Promise<any | null> => {
    const result = await db.execute({
        sql: `
            SELECT 
                dp.id as dailyPuzzleId,
                dp.date,
                p.*,
                dpa.solved,
                dpa.attempts,
                dpa.time_spent as timeSpent,
                dpa.completed_at as completedAt
            FROM daily_puzzles dp
            JOIN puzzles p ON dp.puzzle_id = p.id
            LEFT JOIN daily_puzzle_attempts dpa ON dp.id = dpa.daily_puzzle_id 
                AND dpa.user_id = ?
            WHERE dp.date = ?
        `,
        args: [userId || null, date]
    });

    if (!result.rows[0]) return null;

    const row: any = result.rows[0];
    const puzzle = {
        ...row,
        id: row.id,
        dailyPuzzleId: row.dailyPuzzleId,
        date: row.date,
        solution: JSON.parse(row.solution),
        tags: JSON.parse(row.tags || '[]'),
        openingTags: JSON.parse(row.opening_tags || '[]'),
        userAttempt: row.attempts !== null ? {
            solved: Boolean(row.solved),
            attempts: row.attempts,
            timeSpent: row.timeSpent,
            completedAt: row.completedAt
        } : null
    };

    return puzzle;
};

export const createDailyPuzzle = async (puzzleId: string, date: string) => {
    const id = randomUUID();
    return await db.execute({
        sql: "INSERT INTO daily_puzzles (id, puzzle_id, date) VALUES (?, ?, ?)",
        args: [id, puzzleId, date]
    });
};

export const upsertDailyPuzzleAttempt = async (attempt: DailyPuzzleAttempt) => {
    // Check if attempt exists
    const existing = await db.execute({
        sql: "SELECT * FROM daily_puzzle_attempts WHERE user_id = ? AND daily_puzzle_id = ?",
        args: [attempt.userId, attempt.dailyPuzzleId]
    });

    if (existing.rows.length > 0) {
        const current = existing.rows[0] as any;

        // Only update if not already solved, or if it was just solved now
        const newSolved = current.solved ? true : attempt.solved;
        const newAttempts = (current.attempts || 0) + 1;
        const newTimeSpent = (current.time_spent || 0) + attempt.timeSpent;
        const newCompletedAt = (!current.solved && attempt.solved) ? new Date().toISOString() : current.completed_at;

        return await db.execute({
            sql: `
                UPDATE daily_puzzle_attempts 
                SET solved = ?, attempts = ?, time_spent = ?, completed_at = ?, updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ? AND daily_puzzle_id = ?
            `,
            args: [
                newSolved ? 1 : 0,
                newAttempts,
                newTimeSpent,
                newCompletedAt,
                attempt.userId,
                attempt.dailyPuzzleId
            ]
        });
    } else {
        const id = randomUUID();
        return await db.execute({
            sql: `
                INSERT INTO daily_puzzle_attempts (id, user_id, daily_puzzle_id, solved, attempts, time_spent, completed_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `,
            args: [
                id,
                attempt.userId,
                attempt.dailyPuzzleId,
                attempt.solved ? 1 : 0,
                1, // First attempt
                attempt.timeSpent,
                attempt.solved ? new Date().toISOString() : null
            ]
        });
    }
};

export const getDailyLeaderboard = async (date: string) => {
    const result = await db.execute({
        sql: `
            SELECT 
                u.id as userId,
                u.name as userName,
                dpa.time_spent as timeSpent,
                dpa.attempts,
                dpa.completed_at as completedAt
            FROM daily_puzzle_attempts dpa
            JOIN users u ON dpa.user_id = u.id
            JOIN daily_puzzles dp ON dpa.daily_puzzle_id = dp.id
            WHERE dp.date = ? 
                AND dpa.solved = 1
            ORDER BY dpa.time_spent ASC, dpa.attempts ASC
            LIMIT 100
        `,
        args: [date]
    });

    return result.rows.map((row, index) => ({
        rank: index + 1,
        ...row
    }));
};

export const getDailyStats = async (userId: string) => {
    const totalAttempted = await db.execute({
        sql: "SELECT COUNT(*) as count FROM daily_puzzle_attempts WHERE user_id = ?",
        args: [userId]
    });

    const totalSolved = await db.execute({
        sql: "SELECT COUNT(*) as count FROM daily_puzzle_attempts WHERE user_id = ? AND solved = 1",
        args: [userId]
    });

    const averageAttempts = await db.execute({
        sql: "SELECT AVG(attempts) as avg FROM daily_puzzle_attempts WHERE user_id = ? AND solved = 1",
        args: [userId]
    });

    const averageTime = await db.execute({
        sql: "SELECT AVG(time_spent) as avg FROM daily_puzzle_attempts WHERE user_id = ? AND solved = 1",
        args: [userId]
    });

    const recentPuzzles = await db.execute({
        sql: `
            SELECT dp.date, dpa.solved, dpa.attempts, dpa.time_spent as timeSpent
            FROM daily_puzzles dp
            LEFT JOIN daily_puzzle_attempts dpa ON dp.id = dpa.daily_puzzle_id AND dpa.user_id = ?
            ORDER BY dp.date DESC
            LIMIT 10
        `,
        args: [userId]
    });

    const currentStreak = await calculateCurrentStreak(userId);
    const longestStreak = await calculateLongestStreak(userId);

    const attemptedCount = Number(totalAttempted.rows[0].count);
    const solvedCount = Number(totalSolved.rows[0].count);

    return {
        totalAttempted: attemptedCount,
        totalSolved: solvedCount,
        currentStreak,
        longestStreak,
        averageAttempts: Number(averageAttempts.rows[0].avg || 0).toFixed(1),
        averageTime: Math.round(Number(averageTime.rows[0].avg || 0)),
        solveRate: attemptedCount > 0 ? Number((solvedCount / attemptedCount) * 100).toFixed(1) : 0,
        recentPuzzles: recentPuzzles.rows.map((r: any) => ({
            ...r,
            solved: Boolean(r.solved)
        }))
    };
};

async function calculateCurrentStreak(userId: string): Promise<number> {
    // 1. Get the latest date the user solved a puzzle
    const latestSolve = await db.execute({
        sql: `
            SELECT MAX(dp.date) as last_date
            FROM daily_puzzles dp
            JOIN daily_puzzle_attempts dpa ON dp.id = dpa.daily_puzzle_id
            WHERE dpa.user_id = ? AND dpa.solved = 1
        `,
        args: [userId]
    });

    const lastDateStr = latestSolve.rows[0]?.last_date as string;
    if (!lastDateStr) return 0;

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    // If the latest solve was not today or yesterday, the streak is broken
    if (lastDateStr !== today && lastDateStr !== yesterday) {
        return 0;
    }

    // 2. Calculate streak backwards from the latest solve date
    const result = await db.execute({
        sql: `
            WITH RECURSIVE streak(date, streak_length) AS (
                SELECT ? as date, 1
                
                UNION ALL
                
                SELECT dp.date, s.streak_length + 1
                FROM daily_puzzles dp
                JOIN daily_puzzle_attempts dpa ON dp.id = dpa.daily_puzzle_id
                JOIN streak s ON dp.date = date(s.date, '-1 day')
                WHERE dpa.user_id = ? AND dpa.solved = 1
            )
            SELECT MAX(streak_length) as current_streak FROM streak;
        `,
        args: [lastDateStr, userId]
    });

    return Number(result.rows[0]?.current_streak || 0);
}

async function calculateLongestStreak(userId: string): Promise<number> {
    const result = await db.execute({
        sql: `
            SELECT DISTINCT dp.date
            FROM daily_puzzles dp
            JOIN daily_puzzle_attempts dpa ON dp.id = dpa.daily_puzzle_id
            WHERE dpa.user_id = ? AND dpa.solved = 1
            ORDER BY dp.date DESC
        `,
        args: [userId]
    });

    if (result.rows.length === 0) return 0;

    const dates = result.rows.map((r: any) => new Date(r.date));
    let longest = 0;
    let current = 0;

    for (let i = 0; i < dates.length; i++) {
        current++;
        if (i === dates.length - 1) {
            longest = Math.max(longest, current);
            break;
        }

        const diff = (dates[i].getTime() - dates[i + 1].getTime()) / (1000 * 3600 * 24);
        if (diff !== 1) {
            longest = Math.max(longest, current);
            current = 0;
        }
    }

    return longest;
}

export const selectRandomPuzzleForDaily = async () => {
    const result = await db.execute({
        sql: `
            SELECT p.id 
            FROM puzzles p
            WHERE p.id NOT IN (
                SELECT puzzle_id FROM daily_puzzles 
                WHERE date > date('now', '-30 days')
            )
            AND p.rating BETWEEN 1200 AND 1800
            ORDER BY RANDOM()
            LIMIT 1
        `
    });

    if (!result.rows[0]) {
        // Fallback: any puzzle not used in last 30 days
        const fallback = await db.execute({
            sql: `
                SELECT id FROM puzzles 
                WHERE id NOT IN (
                    SELECT puzzle_id FROM daily_puzzles 
                    WHERE date > date('now', '-30 days')
                )
                ORDER BY RANDOM()
                LIMIT 1
            `
        });
        return fallback.rows[0]?.id as string || null;
    }

    return result.rows[0].id as string;
};
