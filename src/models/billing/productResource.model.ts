import { db } from "../../config/db";
import { randomUUID } from "crypto";

export interface ProductResource {
    id?: string;
    product_id: string;
    resource_type: 'course' | 'role';
    resource_id: string;
}

export const addProductResource = async (pr: ProductResource) => {
    const id = pr.id || randomUUID();
    const res = await db.execute({
        sql: `
            INSERT INTO product_resources (id, product_id, resource_type, resource_id)
            VALUES (?, ?, ?, ?)
        `,
        args: [id, pr.product_id, pr.resource_type, pr.resource_id]
    });
    return { ...res, lastInsertRowid: id };
};

export const listProductResources = async (productId: string) => {
    const res = await db.execute({
        sql: "SELECT * FROM product_resources WHERE product_id = ?",
        args: [productId]
    });
    return res.rows as any;
};

export const deleteProductResource = async (id: string) => {
    await db.execute({
        sql: "DELETE FROM product_resources WHERE id = ?",
        args: [id]
    });
};
