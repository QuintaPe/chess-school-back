import { Router } from 'express';
import * as BillingController from '../controllers/billings.controller';
import { verifyToken, isAdmin } from '../middlewares/authMiddleware';

const router = Router();

// All routes here require admin privileges
router.use(verifyToken, isAdmin);

// Products
router.get('/products', BillingController.getProducts);
router.post('/products', BillingController.createProduct);
router.patch('/products/:id', BillingController.updateProduct);
router.delete('/products/:id', BillingController.deleteProduct);

// Product Resources
router.get('/products/:productId/resources', BillingController.getProductResources);
router.post('/products/:productId/resources', BillingController.addProductResource);
router.delete('/resources/:resourceId', BillingController.removeProductResource);

// Transactions
router.get('/transactions', BillingController.getTransactions);
router.patch('/transactions/:id/status', BillingController.updateTransactionStatus);

export default router;

