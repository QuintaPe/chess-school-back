import { Router } from 'express';
import * as AchievementController from '../controllers/achievementController';
import { verifyToken, optionalAuth } from '../middlewares/authMiddleware';

const router = Router();

/**
 * @openapi
 * /achievements:
 *   get:
 *     summary: Listar todos los logros y el estado del usuario
 *     tags: [Logros]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de logros con metadatos de desbloqueo
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Achievement'
 */
router.get('/', optionalAuth, AchievementController.listAchievements);

/**
 * @openapi
 * /achievements/me:
 *   get:
 *     summary: Obtener solo mis logros desbloqueados
 *     tags: [Logros]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de logros desbloqueados por el usuario actual
 */
router.get('/me', verifyToken, AchievementController.getMyAchievements);

export default router;
