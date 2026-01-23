import { Router } from 'express';
import * as CourseController from '../controllers/courseController';
import { verifyToken, isAdmin, optionalAuth } from '../middlewares/authMiddleware';

const router = Router();

/**
 * @openapi
 * /courses:
 *   get:
 *     summary: Listar todos los cursos disponibles
 *     tags: [Cursos]
 *     parameters:
 *       - in: query
 *         name: level
 *         schema: { type: 'string', enum: [beginner, intermediate, advanced] }
 *     responses:
 *       200:
 *         description: Lista de cursos
 */
router.get('/', optionalAuth, CourseController.listAllCourses);

/**
 * @openapi
 * /courses/enrolled:
 *   get:
 *     summary: Listar mis cursos inscritos
 *     tags: [Cursos]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de cursos del alumno
 */
router.get('/enrolled', verifyToken, CourseController.listEnrolledCourses);

/**
 * @openapi
 * /courses/{id}:
 *   get:
 *     summary: Obtener detalles y lecciones de un curso
 *     tags: [Cursos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: 'integer' }
 *     responses:
 *       200:
 *         description: Detalles del curso con progreso
 */
router.get('/:id', optionalAuth, CourseController.getCourse);

// Course Management (Admin)
/**
 * @openapi
 * /courses:
 *   post:
 *     summary: Crear un nuevo curso (Admin)
 *     tags: [Cursos]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Curso creado
 */
router.post('/', verifyToken, isAdmin, CourseController.createCourse);

router.put('/:id', verifyToken, isAdmin, CourseController.updateCourse);

router.delete('/:id', verifyToken, isAdmin, CourseController.deleteCourse);

// Module Management
router.post('/:id/modules', verifyToken, isAdmin, CourseController.addModule);
router.put('/modules/:moduleId', verifyToken, isAdmin, CourseController.updateModule);
router.delete('/modules/:moduleId', verifyToken, isAdmin, CourseController.deleteModule);

/**
 * @openapi
 * /courses/{id}/lessons:
 *   post:
 *     summary: Añadir lección a un curso (Admin)
 *     tags: [Cursos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: 'integer' }
 *     responses:
 *       201:
 *         description: Lección añadida
 */
router.post('/:id/lessons', verifyToken, isAdmin, CourseController.addLesson);

/**
 * @openapi
 * /courses/lessons/order/{id}:
 *   put:
 *     summary: Cambiar orden de lección (Admin)
 *     tags: [Cursos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: 'string' }
 *     responses:
 *       200:
 *         description: Orden actualizado
 */
router.put('/lessons/order/:id', verifyToken, isAdmin, CourseController.updateLessonOrder);

router.put('/lessons/:id', verifyToken, isAdmin, CourseController.updateLesson);

router.delete('/lessons/:id', verifyToken, isAdmin, CourseController.deleteLesson);

// Enrollment & Progress
/**
 * @openapi
 * /courses/{id}/enroll:
 *   post:
 *     summary: Inscribirse en un curso
 *     tags: [Cursos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: 'integer' }
 *     responses:
 *       200:
 *         description: Inscripción exitosa
 */
router.post('/:id/enroll', verifyToken, CourseController.enroll);

/**
 * @openapi
 * /courses/lessons/{lessonId}/complete:
 *   post:
 *     summary: Marcar lección como completada
 *     tags: [Cursos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: lessonId
 *         required: true
 *         schema: { type: 'integer' }
 *     responses:
 *       200:
 *         description: Progreso guardado
 */
router.post('/lessons/:lessonId/complete', verifyToken, CourseController.completeLesson);

/**
 * @openapi
 * /courses/lessons/{lessonId}/complete:
 *   delete:
 *     summary: Desmarcar lección como completada
 *     tags: [Cursos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: lessonId
 *         required: true
 *         schema: { type: 'integer' }
 *     responses:
 *       200:
 *         description: Marcado como no completado
 */
router.delete('/lessons/:lessonId/complete', verifyToken, CourseController.uncompleteLesson);

export default router;
