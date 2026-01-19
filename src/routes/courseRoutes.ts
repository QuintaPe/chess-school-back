import { Router } from 'express';
import * as CourseController from '../controllers/courseController';
import { verifyToken, isAdmin, optionalAuth } from '../middlewares/authMiddleware';

const router = Router();

router.get('/', optionalAuth, CourseController.listAllCourses);
router.get('/enrolled', verifyToken, CourseController.listEnrolledCourses);
router.get('/:id', optionalAuth, CourseController.getCourse);

// Course Management (Admin)
router.post('/', verifyToken, isAdmin, CourseController.createCourse);
router.post('/:id/lessons', verifyToken, isAdmin, CourseController.addLesson);
router.put('/lessons/:id', verifyToken, isAdmin, CourseController.updateLessonOrder);

// Enrollment & Progress
router.post('/:id/enroll', verifyToken, CourseController.enroll);
router.post('/lessons/:lessonId/complete', verifyToken, CourseController.completeLesson);
router.delete('/lessons/:lessonId/complete', verifyToken, CourseController.uncompleteLesson);

export default router;
