import { db } from "../../config/db";
import { randomUUID } from "crypto";

export interface Product {
    id?: string;
    name: string;
    product_type: 'course_lifetime' | 'subscription' | 'bundle';
    price: number;
    currency: string;
    external_reference?: string | null;
    is_active?: boolean;
}

export const createProduct = async (product: Product) => {
    const id = product.id || randomUUID();
    const res = await db.execute({
        sql: `
            INSERT INTO products (id, name, product_type, price, currency, external_reference, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
            id,
            product.name,
            product.product_type,
            product.price,
            product.currency,
            product.external_reference ?? null,
            product.is_active === false ? 0 : 1
        ]
    });
    return { ...res, lastInsertRowid: id };
};

export const updateProduct = async (id: string, updates: Partial<Product>) => {
    const fields = Object.keys(updates);
    if (fields.length === 0) return;

    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const args = fields.map(f => {
        const val = (updates as any)[f];
        if (f === 'is_active' && typeof val === 'boolean') return val ? 1 : 0;
        return val;
    });
    args.push(id);

    await db.execute({
        sql: `UPDATE products SET ${setClause} WHERE id = ?`,
        args
    });
};

export const getProductById = async (id: string) => {
    const res = await db.execute({
        sql: "SELECT * FROM products WHERE id = ?",
        args: [id]
    });
    const row: any = res.rows[0];
    if (!row) return null;
    return {
        ...row,
        is_active: Boolean(row.is_active)
    };
};

export const listProducts = async (onlyActive?: boolean) => {
    const res = await db.execute({
        sql: `SELECT * FROM products ${onlyActive ? 'WHERE is_active = 1' : ''} ORDER BY name ASC`,
        args: []
    });
    return res.rows.map((r: any) => ({ ...r, is_active: Boolean(r.is_active) }));
};

export const deleteProduct = async (id: string) => {
    await db.execute({
        sql: "DELETE FROM products WHERE id = ?",
        args: [id]
    });
};
