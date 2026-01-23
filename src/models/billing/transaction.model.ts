import { db } from "../../config/db";
import { randomUUID } from "crypto";

export interface Transaction {
    id?: string;
    user_id: string;
    product_id: string;
    gateway_name: string;
    external_tx_id?: string | null;
    amount_paid: number;
    status: 'completed' | 'refunded' | 'failed' | 'pending';
    created_at?: string;
}

export const createTransaction = async (t: Transaction) => {
    const id = t.id || randomUUID();
    const res = await db.execute({
        sql: `
            INSERT INTO transactions (id, user_id, product_id, gateway_name, external_tx_id, amount_paid, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
            id,
            t.user_id,
            t.product_id,
            t.gateway_name,
            t.external_tx_id ?? null,
            t.amount_paid,
            t.status
        ]
    });
    return { ...res, lastInsertRowid: id };
};

export const getTransactionById = async (id: string) => {
    const res = await db.execute({
        sql: "SELECT * FROM transactions WHERE id = ?",
        args: [id]
    });
    return (res.rows[0] as any) || null;
};

export const listUserTransactions = async (userId: string, limit: number = 50) => {
    const res = await db.execute({
        sql: "SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
        args: [userId, limit]
    });
    return res.rows as any;
};

export const updateTransactionStatus = async (id: string, status: Transaction['status']) => {
    await db.execute({
        sql: "UPDATE transactions SET status = ? WHERE id = ?",
        args: [status, id]
    });
};
