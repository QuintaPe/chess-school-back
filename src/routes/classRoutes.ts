import { Router } from 'express';
import * as ClassController from '../controllers/classController';
import { verifyToken, isStaff, optionalAuth } from '../middlewares/authMiddleware';

const router = Router();

router.get('/', ClassController.listClasses);
router.get('/:id', optionalAuth, ClassController.getClass);
router.post('/', verifyToken, isStaff, ClassController.createClass);
router.put('/:id', verifyToken, isStaff, ClassController.updateClass);
router.delete('/:id', verifyToken, isStaff, ClassController.deleteClass);
router.post('/:id/register', verifyToken, ClassController.registerToClass);

export default router;
