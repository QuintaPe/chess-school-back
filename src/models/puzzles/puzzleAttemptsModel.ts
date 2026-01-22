import { db } from "../../config/db";
import { randomUUID } from "crypto";

export interface PuzzleAttempt {
    id?: string;
    user_id: string;
    puzzle_id: string;
    solved: boolean;
    time_spent?: number | null;
    rating_delta?: number | null;
}

export const recordPuzzleAttempt = async (args: {
    userId: string;
    puzzleId: string;
    solved: boolean;
    timeSpent?: number;
    ratingDelta?: number;
}) => {
    const id = randomUUID();
    await db.execute({
        sql: "INSERT INTO puzzle_attempts (id, user_id, puzzle_id, solved, time_spent, rating_delta) VALUES (?, ?, ?, ?, ?, ?)",
        args: [
            id,
            args.userId,
            args.puzzleId,
            args.solved ? 1 : 0,
            args.timeSpent ?? null,
            args.ratingDelta ?? null
        ]
    });
    return id;
};

export const listAttemptsByUser = async (userId: string, limit: number = 50) => {
    const res = await db.execute({
        sql: "SELECT * FROM puzzle_attempts WHERE user_id = ? ORDER BY id DESC LIMIT ?",
        args: [userId, limit]
    });
    return res.rows as any;
};

export const listAttemptsByPuzzle = async (puzzleId: string, limit: number = 50) => {
    const res = await db.execute({
        sql: "SELECT * FROM puzzle_attempts WHERE puzzle_id = ? ORDER BY id DESC LIMIT ?",
        args: [puzzleId, limit]
    });
    return res.rows as any;
};
