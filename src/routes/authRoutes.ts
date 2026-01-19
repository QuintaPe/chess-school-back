import { Router } from 'express';
import { register, login, getMe, getStats, updateProfile, getAllUsers, adminUpdateUser, adminDeleteUser } from '../controllers/authController';
import { verifyToken, isAdmin } from '../middlewares/authMiddleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', verifyToken, getMe);
router.get('/me/stats', verifyToken, getStats);
router.patch('/me', verifyToken, updateProfile);

// Admin Routes
router.get('/users', verifyToken, isAdmin, getAllUsers);
router.patch('/users/:id', verifyToken, isAdmin, adminUpdateUser);
router.delete('/users/:id', verifyToken, isAdmin, adminDeleteUser);

export default router;
