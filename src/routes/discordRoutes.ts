import { Router } from 'express';
import { redirectToDiscord, handleDiscordCallback, getSettings, updateSettings, unlinkDiscord, syncAllRoles } from '../controllers/discordController';
import { verifyToken, isAdmin } from '../middlewares/authMiddleware';

const router = Router();

// OAuth2 Flow
router.get('/link', verifyToken, redirectToDiscord);
router.get('/callback', handleDiscordCallback);
router.post('/unlink', verifyToken, unlinkDiscord);

// Admin / Internal
router.post('/sync-roles', verifyToken, isAdmin, syncAllRoles);
router.get('/settings', verifyToken, isAdmin, getSettings);
router.patch('/settings', verifyToken, isAdmin, updateSettings);

export default router;
