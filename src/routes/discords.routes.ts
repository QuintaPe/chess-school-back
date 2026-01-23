import { Router } from 'express';
import { redirectToDiscord, handleDiscordCallback, getSettings, updateSettings, unlinkDiscord, syncAllRoles } from '../controllers/discords.controller';
import { verifyToken, isAdmin } from '../middlewares/authMiddleware';

const router = Router();

// OAuth2 Flow
/**
 * @openapi
 * /auth/discord/link:
 *   get:
 *     summary: Iniciar flujo de vinculación con Discord
 *     tags: [Discord]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       302:
 *         description: Redirige a la página de autorización de Discord
 */
router.get('/link', verifyToken, redirectToDiscord);

/**
 * @openapi
 * /auth/discord/callback:
 *   get:
 *     summary: Callback de Discord para completar la vinculación
 *     tags: [Discord]
 *     responses:
 *       200:
 *         description: Vinculación completada
 */
router.get('/callback', handleDiscordCallback);

/**
 * @openapi
 * /auth/discord/unlink:
 *   post:
 *     summary: Desvincular cuenta de Discord
 *     tags: [Discord]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cuenta desvinculada
 */
router.post('/unlink', verifyToken, unlinkDiscord);

// Admin / Internal
/**
 * @openapi
 * /admin/discord/sync-roles:
 *   post:
 *     summary: Sincronizar roles de todos los usuarios con Discord (Admin)
 *     tags: [Discord Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sincronización iniciada
 */
router.post('/sync-roles', verifyToken, isAdmin, syncAllRoles);

/**
 * @openapi
 * /admin/discord/settings:
 *   get:
 *     summary: Obtener configuración de Discord (Admin)
 *     tags: [Discord Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Configuración actual
 */
router.get('/settings', verifyToken, isAdmin, getSettings);

/**
 * @openapi
 * /admin/discord/settings:
 *   patch:
 *     summary: Actualizar configuración de Discord (Admin)
 *     tags: [Discord Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Configuración actualizada
 */
router.patch('/settings', verifyToken, isAdmin, updateSettings);

export default router;

