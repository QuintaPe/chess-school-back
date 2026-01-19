import { db } from "../config/db";
import { randomUUID } from "crypto";

export interface Puzzle {
    id?: string;
    externalId?: string;
    fen: string;
    solution: string[]; // Sequence of moves
    rating: number;
    ratingDeviation?: number;
    popularity?: number;
    nbPlays?: number;
    turn: 'w' | 'b';
    tags: string[]; // Themes
    gameUrl?: string;
    openingTags?: string[];
}

export const getPuzzles = async (filters: {
    ratingMin?: number;
    ratingMax?: number;
    tags?: string[];
    page?: number;
    limit?: number;
    sort?: string;
    order?: 'asc' | 'desc';
}) => {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    let query = "SELECT * FROM puzzles WHERE 1=1";
    const args: any[] = [];

    if (filters.ratingMin) {
        query += " AND rating >= ?";
        args.push(filters.ratingMin);
    }
    if (filters.ratingMax) {
        query += " AND rating <= ?";
        args.push(filters.ratingMax);
    }

    // Sorting
    if (filters.sort) {
        const allowedSorts = ['rating', 'popularity', 'nb_plays', 'rating_deviation', 'created_at'];
        if (allowedSorts.includes(filters.sort)) {
            query += ` ORDER BY ${filters.sort} ${filters.order === 'desc' ? 'DESC' : 'ASC'}`;
        }
    } else {
        query += " ORDER BY id ASC";
    }

    const result = await db.execute({ sql: query, args });

    // Simple filter for tags in JS for now as SQLite doesn't have native JSON array search without extensions
    let rows = result.rows.map((row: any) => ({
        ...row,
        externalId: row.external_id,
        solution: JSON.parse(row.solution),
        tags: JSON.parse(row.tags || '[]'),
        openingTags: JSON.parse(row.opening_tags || '[]'),
        ratingDeviation: row.rating_deviation,
        nbPlays: row.nb_plays,
        gameUrl: row.game_url
    }));

    if (filters.tags && filters.tags.length > 0) {
        rows = rows.filter(r => filters.tags!.every(t => r.tags.includes(t)));
    }

    const total = rows.length;
    // Note: Pagination should ideally be in SQL, but since we are doing Tag filtering in JS, we slice here.
    // If tags are NOT provided, we could paginate in SQL for performance.
    // For now, keeping it simple as we load all matches then slice.
    const paginatedRows = rows.slice(offset, offset + limit);

    return {
        data: paginatedRows,
        meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        }
    };
};

export const getPuzzleById = async (id: string) => {
    const result = await db.execute({
        sql: "SELECT * FROM puzzles WHERE id = ?",
        args: [id]
    });
    if (!result.rows[0]) return null;

    const row: any = result.rows[0];
    return {
        ...row,
        externalId: row.external_id,
        solution: JSON.parse(row.solution),
        tags: JSON.parse(row.tags || '[]'),
        openingTags: JSON.parse(row.opening_tags || '[]'),
        ratingDeviation: row.rating_deviation,
        nbPlays: row.nb_plays,
        gameUrl: row.game_url
    };
};

export const createPuzzle = async (puzzle: Puzzle) => {
    const id = randomUUID();
    const result = await db.execute({
        sql: `INSERT INTO puzzles (id, external_id, fen, solution, rating, rating_deviation, popularity, nb_plays, turn, tags, game_url, opening_tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
            id,
            puzzle.externalId || null,
            puzzle.fen,
            JSON.stringify(puzzle.solution),
            puzzle.rating,
            puzzle.ratingDeviation || null,
            puzzle.popularity || null,
            puzzle.nbPlays || null,
            puzzle.turn,
            JSON.stringify(puzzle.tags || []),
            puzzle.gameUrl || null,
            JSON.stringify(puzzle.openingTags || [])
        ]
    });
    return { ...result, lastInsertRowid: id };
};

export const recordPuzzleSolve = async (userId: string, puzzleId: string, isCorrect: boolean) => {
    await db.execute({
        sql: "INSERT OR REPLACE INTO user_puzzle_history (user_id, puzzle_id, is_correct) VALUES (?, ?, ?)",
        args: [userId, puzzleId, isCorrect ? 1 : 0]
    });

    if (isCorrect) {
        await db.execute({
            sql: "UPDATE user_stats SET puzzles_solved = puzzles_solved + 1 WHERE user_id = ?",
            args: [userId]
        });
    }
};

export const updatePuzzle = async (id: string, updates: Partial<Puzzle>) => {
    const fields = Object.keys(updates);
    if (fields.length === 0) return;

    const mappedFields = fields.map(field => {
        if (field === 'externalId') return 'external_id';
        if (field === 'ratingDeviation') return 'rating_deviation';
        if (field === 'nbPlays') return 'nb_plays';
        if (field === 'gameUrl') return 'game_url';
        if (field === 'openingTags') return 'opening_tags';
        return field;
    });

    const args = fields.map(field => {
        const val = (updates as any)[field];
        if (field === 'solution' || field === 'tags' || field === 'openingTags') return JSON.stringify(val || []);
        return val;
    });
    args.push(id);

    const setClause = mappedFields.map(field => `${field} = ?`).join(', ');

    await db.execute({
        sql: `UPDATE puzzles SET ${setClause} WHERE id = ?`,
        args
    });
};

export const deletePuzzle = async (id: string) => {
    await db.execute({
        sql: "DELETE FROM puzzles WHERE id = ?",
        args: [id]
    });
};
