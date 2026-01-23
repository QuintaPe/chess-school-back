import { db } from "../../config/db";
import { randomUUID } from "crypto";

export interface Puzzle {
    id?: string;
    externalId?: string;
    initial_fen: string;
    solution_moves: string[];
    rating: number;
    themes: string[];
}

export const getPuzzles = async (filters: {
    ratingMin?: number;
    ratingMax?: number;
    themes?: string[];
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

    if (filters.sort) {
        const allowedSorts = ['rating', 'id'];
        if (allowedSorts.includes(filters.sort)) {
            query += ` ORDER BY ${filters.sort} ${filters.order === 'desc' ? 'DESC' : 'ASC'}`;
        }
    } else {
        query += " ORDER BY id ASC";
    }

    const result = await db.execute({ sql: query, args });

    let rows = result.rows.map((row: any) => ({
        ...row,
        externalId: row.external_id,
        initial_fen: row.initial_fen,
        solution_moves: JSON.parse(row.solution_moves),
        themes: JSON.parse(row.themes || '[]'),
    }));

    if (filters.themes && filters.themes.length > 0) {
        rows = rows.filter(r => filters.themes!.every(t => r.themes.includes(t)));
    }

    const total = rows.length;
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
        initial_fen: row.initial_fen,
        solution_moves: JSON.parse(row.solution_moves),
        themes: JSON.parse(row.themes || '[]')
    };
};

export const createPuzzle = async (puzzle: Puzzle) => {
    const id = randomUUID();
    const result = await db.execute({
        sql: `INSERT INTO puzzles (id, external_id, initial_fen, solution_moves, rating, themes) VALUES (?, ?, ?, ?, ?, ?)`,
        args: [
            id,
            puzzle.externalId || null,
            puzzle.initial_fen,
            JSON.stringify(puzzle.solution_moves),
            puzzle.rating,
            JSON.stringify(puzzle.themes || [])
        ]
    });
    return { ...result, lastInsertRowid: id };
};

export const updatePuzzle = async (id: string, updates: Partial<Puzzle>) => {
    const fields = Object.keys(updates);
    if (fields.length === 0) return;

    const mappedFields = fields.map(field => {
        if (field === 'externalId') return 'external_id';
        return field;
    });

    const args = fields.map(field => {
        const val = (updates as any)[field];
        if (field === 'solution_moves' || field === 'themes') return JSON.stringify(val || []);
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
