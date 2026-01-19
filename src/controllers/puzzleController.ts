import { Request, Response } from 'express';
import * as PuzzleModel from '../models/puzzleModel';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse';

const puzzleSchema = z.object({
    externalId: z.string().optional(),
    fen: z.string(),
    solution: z.array(z.string()),
    rating: z.number(),
    ratingDeviation: z.number().optional(),
    popularity: z.number().optional(),
    nbPlays: z.number().optional(),
    turn: z.enum(['w', 'b']),
    tags: z.array(z.string()).optional(),
    gameUrl: z.string().optional(),
    openingTags: z.array(z.string()).optional(),
});

const updatePuzzleSchema = puzzleSchema.partial();

export const listPuzzles = async (req: Request, res: Response) => {
    try {
        const { ratingMin, ratingMax, tags, page, limit } = req.query;
        const result = await PuzzleModel.getPuzzles({
            ratingMin: ratingMin ? parseInt(ratingMin as string) : undefined,
            ratingMax: ratingMax ? parseInt(ratingMax as string) : undefined,
            tags: tags ? (tags as string).split(',') : undefined,
            page: page ? parseInt(page as string) : 1,
            limit: limit ? parseInt(limit as string) : 20
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
        const { puzzleId, moves } = req.body; // moves is an array of strings

        const puzzle = await PuzzleModel.getPuzzleById(puzzleId);
        if (!puzzle) return res.status(404).json({ message: "Puzzle not found" });

        // Check if moves match sequence exactly
        const isCorrect = JSON.stringify(puzzle.solution) === JSON.stringify(moves);

        await PuzzleModel.recordPuzzleSolve(userId, puzzleId, isCorrect);

        return res.json({
            correct: isCorrect,
            message: isCorrect ? "Excellent! You solved it." : "Incorrect solution. Try again."
        });
    } catch (error) {
        return res.status(500).json({ message: "Error processing solution" });
    }
};

export const createPuzzle = async (req: Request, res: Response) => {
    try {
        const data = puzzleSchema.parse(req.body);
        const result = await PuzzleModel.createPuzzle(data as any);
        return res.status(201).json({ message: "Puzzle created", id: Number(result.lastInsertRowid) });
    } catch (error) {
        return res.status(400).json({ message: "Invalid data", error });
    }
};

export const updatePuzzle = async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id as string);
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
        const id = parseInt(req.params.id as string);
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
            const ratingDeviation = parseInt(record.RatingDeviation || record.ratingDeviation || '0');
            const popularity = parseInt(record.Popularity || record.popularity || '0');
            const nbPlays = parseInt(record.NbPlays || record.nbPlays || '0');
            const themesStr = record.Themes || record.themes || '';
            const gameUrl = record.GameUrl || record.gameUrl || '';
            const openingTagsStr = record.OpeningTags || record.openingTags || '';

            if (!fen || !movesStr) continue;

            const solution = movesStr.split(' ');
            const tags = themesStr.split(' ').filter((t: string) => t.length > 0);
            const openingTags = openingTagsStr.split(' ').filter((t: string) => t.length > 0);
            const turn = fen.split(' ')[1] === 'w' ? 'w' : 'b';

            await PuzzleModel.createPuzzle({
                externalId,
                fen,
                solution,
                rating,
                ratingDeviation,
                popularity,
                nbPlays,
                turn,
                tags,
                gameUrl,
                openingTags
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
