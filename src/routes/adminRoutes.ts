import { Router } from 'express';
import * as AdminController from '../controllers/adminController';
import { verifyToken, isAdmin } from '../middlewares/authMiddleware';

const router = Router();

/**
 * @openapi
 * /admin/stats:
 *   get:
 *     summary: Obtener estadísticas globales para el dashboard administrativo
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Datos agregados de alumnos, clases, ingresos y actividad reciente
 */
router.get('/stats', verifyToken, isAdmin, AdminController.getDashboardStats);

export default router;
