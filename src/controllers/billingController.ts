import { Request, Response } from 'express';
import * as ProductModel from '../models/billing/productModel';
import * as TransactionModel from '../models/billing/transactionModel';
import * as ProductResourceModel from '../models/billing/productResourceModel';

// --- Products ---

export const getProducts = async (req: Request, res: Response) => {
    try {
        const products = await ProductModel.listProducts(false);
        return res.json(products);
    } catch (error) {
        console.error("Error listing products:", error);
        return res.status(500).json({ error: "Error al listar productos" });
    }
};

export const createProduct = async (req: Request, res: Response) => {
    try {
        const productData: ProductModel.Product = req.body;
        const result = await ProductModel.createProduct(productData);
        return res.status(201).json({ id: result.lastInsertRowid, ...productData });
    } catch (error) {
        console.error("Error creating product:", error);
        return res.status(500).json({ error: "Error al crear producto" });
    }
};

export const updateProduct = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const updates: Partial<ProductModel.Product> = req.body;
        await ProductModel.updateProduct(id, updates);
        return res.json({ message: "Producto actualizado correctamente" });
    } catch (error) {
        console.error("Error updating product:", error);
        return res.status(500).json({ error: "Error al actualizar producto" });
    }
};

export const deleteProduct = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        await ProductModel.deleteProduct(id);
        return res.json({ message: "Producto eliminado correctamente" });
    } catch (error) {
        console.error("Error deleting product:", error);
        return res.status(500).json({ error: "Error al eliminar producto" });
    }
};

// --- Product Resources ---

export const getProductResources = async (req: Request, res: Response) => {
    try {
        const productId = req.params.productId as string;
        const resources = await ProductResourceModel.listProductResources(productId);
        return res.json(resources);
    } catch (error) {
        console.error("Error listing product resources:", error);
        return res.status(500).json({ error: "Error al listar recursos del producto" });
    }
};

export const addProductResource = async (req: Request, res: Response) => {
    try {
        const productId = req.params.productId as string;
        const { resource_type, resource_id } = req.body;
        const result = await ProductResourceModel.addProductResource({
            product_id: productId,
            resource_type,
            resource_id
        });
        return res.status(201).json({ id: result.lastInsertRowid, product_id: productId, resource_type, resource_id });
    } catch (error) {
        console.error("Error adding product resource:", error);
        return res.status(500).json({ error: "Error al añadir recurso al producto" });
    }
};

export const removeProductResource = async (req: Request, res: Response) => {
    try {
        const resourceId = req.params.resourceId as string;
        await ProductResourceModel.deleteProductResource(resourceId);
        return res.json({ message: "Recurso eliminado del producto correctamente" });
    } catch (error) {
        console.error("Error removing product resource:", error);
        return res.status(500).json({ error: "Error al eliminar recurso del producto" });
    }
};

// --- Transactions ---

export const getTransactions = async (req: Request, res: Response) => {
    try {
        const { limit, userId } = req.query;
        // Reusing existing model logic but extending it for admin view
        // If no userId, we want all transactions. Let's create a listAllTransactions in the model
        // Wait, I should probably add it to the model.
        // For now, let's assume we want ALL.

        // I will need a more comprehensive query for transactions with user emails and product names
        const { db } = await import("../config/db");
        const query = `
            SELECT t.*, u.email as user_email, u.name as user_name, p.name as product_name
            FROM transactions t
            LEFT JOIN users u ON t.user_id = u.id
            LEFT JOIN products p ON t.product_id = p.id
            ORDER BY t.created_at DESC
            LIMIT ?
        `;
        const resList = await db.execute({
            sql: query,
            args: [Number(limit) || 100]
        });

        return res.json(resList.rows);
    } catch (error) {
        console.error("Error listing transactions:", error);
        return res.status(500).json({ error: "Error al listar transacciones" });
    }
};

export const updateTransactionStatus = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const { status } = req.body;
        await TransactionModel.updateTransactionStatus(id, status);
        return res.json({ message: "Estado de transacción actualizado" });
    } catch (error) {
        console.error("Error updating transaction status:", error);
        return res.status(500).json({ error: "Error al actualizar estado de transacción" });
    }
};
