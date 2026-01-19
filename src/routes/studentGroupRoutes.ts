import { Router } from 'express';
import * as StudentGroupController from '../controllers/studentGroupController';
import { verifyToken, isStaff } from '../middlewares/authMiddleware';

const router = Router();

// Staff/Admin only can create and manage groups
router.post('/', verifyToken, isStaff, StudentGroupController.createGroup);
router.get('/', verifyToken, isStaff, StudentGroupController.listGroups);
router.get('/:id', verifyToken, isStaff, StudentGroupController.getGroup);
router.put('/:id', verifyToken, isStaff, StudentGroupController.updateGroup);
router.delete('/:id', verifyToken, isStaff, StudentGroupController.deleteGroup);

// Member management
router.get('/:id/members', verifyToken, isStaff, StudentGroupController.getGroupMembers);
router.post('/:id/members', verifyToken, isStaff, StudentGroupController.addMember);
router.delete('/:id/members/:userId', verifyToken, isStaff, StudentGroupController.removeMember);

export default router;
