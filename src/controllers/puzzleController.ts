import { Request, Response } from 'express';
import * as PuzzleModel from '../models/puzzles/puzzlesModel';
import * as UserModel from '../models/auth/userModel';
import * as PuzzleAttemptModel from '../models/puzzles/puzzleAttemptsModel';
import { z } from 'zod';
import fs from 'fs';
import { parse } from 'csv-parse';
import { logActivity } from '../models/audit/activityLogModel';

const puzzleSchema = z.object({
    externalId: z.string().optional(),
    initial_fen: z.string(),
    solution_moves: z.array(z.string()),
    rating: z.number(),
    themes: z.array(z.string()).optional(),
});

const updatePuzzleSchema = puzzleSchema.partial();

export const listPuzzles = async (req: Request, res: Response) => {
    try {
        const { ratingMin, ratingMax, tags, page, limit, sort, order } = req.query;
        const result = await PuzzleModel.getPuzzles({
            ratingMin: ratingMin ? parseInt(ratingMin as string) : undefined,
            ratingMax: ratingMax ? parseInt(ratingMax as string) : undefined,
            themes: tags ? (tags as string).split(',') : undefined,
            page: page ? parseInt(page as string) : 1,
            limit: limit ? parseInt(limit as string) : 20,
            sort: sort as string,
            order: order as 'asc' | 'desc'
        });
        return res.json(result);
    } catch (error) {
        console.error("Error fetching puzzles:", error);
        return res.status(500).json({ message: "Error fetching puzzles" });
    }
};

export const solvePuzzle = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { puzzleId, moves, solution, timeSpent } = req.body;

        const puzzle = await PuzzleModel.getPuzzleById(String(puzzleId));
        if (!puzzle) return res.status(404).json({ message: "Puzzle not found" });

        // Normalize user moves: support both array and space-separated string
        let userMoves: string[] = [];
        if (Array.isArray(moves)) userMoves = moves;
        else if (typeof solution === 'string') userMoves = solution.split(' ');
        else if (Array.isArray(solution)) userMoves = solution;

        // Check if moves match sequence exactly
        const isCorrect = JSON.stringify(puzzle.solution_moves) === JSON.stringify(userMoves);

        await PuzzleAttemptModel.recordPuzzleAttempt({
            userId,
            puzzleId: String(puzzleId),
            solved: isCorrect,
            timeSpent: typeof timeSpent === 'number' ? timeSpent : undefined,
            ratingDelta: null as any
        });

        if (isCorrect) {
            const user = await UserModel.findUserById(userId);
            if (user) {
                await logActivity('puzzle_solved', `El alumno ${(user as any).name} ha resuelto el puzzle #${puzzleId}`);
            }
        }

        return res.json({
            correct: isCorrect,
            message: isCorrect ? "Excellent! You solved it." : "Incorrect solution. Try again."
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Error processing solution" });
    }
};

export const createPuzzle = async (req: Request, res: Response) => {
    try {
        const data = puzzleSchema.parse(req.body);
        const result = await PuzzleModel.createPuzzle(data as any);
        return res.status(201).json({ message: "Puzzle created", id: result.lastInsertRowid });
    } catch (error) {
        return res.status(400).json({ message: "Invalid data", error });
    }
};

export const updatePuzzle = async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        const data = updatePuzzleSchema.parse(req.body);
        await PuzzleModel.updatePuzzle(id, data as any);
        return res.json({ message: "Puzzle updated" });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ message: "Validation error", errors: error.issues });
        }
        return res.status(400).json({ message: "Error updating puzzle", error });
    }
};

export const deletePuzzle = async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        await PuzzleModel.deletePuzzle(id);
        return res.json({ message: "Puzzle deleted" });
    } catch (error) {
        return res.status(500).json({ message: "Error deleting puzzle", error });
    }
};

export const importCSV = async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        const filePath = req.file.path;
        const parser = fs.createReadStream(filePath).pipe(parse({
            columns: true,
            skip_empty_lines: true,
            trim: true
        }));

        let importedCount = 0;
        for await (const record of parser) {
            const externalId = record.PuzzleId || record.puzzleId;
            const fen = record.FEN || record.fen;
            const movesStr = record.Moves || record.moves;
            const rating = parseInt(record.Rating || record.rating || '800');
            const themesStr = record.Themes || record.themes || '';

            if (!fen || !movesStr) continue;

            const solution = movesStr.split(' ');
            const tags = themesStr.split(' ').filter((t: string) => t.length > 0);

            await PuzzleModel.createPuzzle({
                externalId,
                initial_fen: fen,
                solution_moves: solution,
                rating,
                themes: tags
            });
            importedCount++;
        }

        // Clean up
        fs.unlinkSync(filePath);

        return res.json({
            message: `Successfully imported ${importedCount} puzzles from CSV`,
            count: importedCount
        });
    } catch (error) {
        console.error("Error importing CSV:", error);
        return res.status(500).json({ message: "Error importing CSV", error });
    }
};
