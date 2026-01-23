import { Router } from 'express';
import * as ClassController from '../controllers/classController';
import { verifyToken, isStaff, optionalAuth } from '../middlewares/authMiddleware';

const router = Router();

/**
 * @openapi
 * /classes:
 *   get:
 *     summary: Listar todas las clases disponibles
 *     tags: [Clases]
 *     parameters:
 *       - in: query
 *         name: level
 *         schema: { type: 'string', enum: [beginner, intermediate, advanced] }
 *     responses:
 *       200:
 *         description: Lista de clases
 */
router.get('/', optionalAuth, ClassController.listClasses);

/**
 * @openapi
 * /classes/{id}:
 *   get:
 *     summary: Obtener detalles de una clase específica
 *     tags: [Clases]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: 'integer' }
 *     responses:
 *       200:
 *         description: Detalles de la clase
 *       404:
 *         description: Clase no encontrada
 */
router.get('/:id', optionalAuth, ClassController.getClass);

/**
 * @openapi
 * /classes:
 *   post:
 *     summary: Crear una nueva clase (Staff/Admin)
 *     tags: [Clases]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, start_time]
 *             properties:
 *               title: { type: 'string' }
 *               level: { type: 'string', enum: [beginner, intermediate, advanced] }
 *               start_time: { type: 'string', format: 'date-time' }
 *               capacity: { type: 'integer' }
 *               platform: { type: 'string' }
 *     responses:
 *       201:
 *         description: Clase creada
 */
router.post('/', verifyToken, isStaff, ClassController.createClass);

/**
 * @openapi
 * /classes/{id}:
 *   put:
 *     summary: Actualizar una clase existente (Staff/Admin)
 *     tags: [Clases]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: 'integer' }
 *     responses:
 *       200:
 *         description: Clase actualizada
 */
router.put('/:id', verifyToken, isStaff, ClassController.updateClass);

/**
 * @openapi
 * /classes/{id}:
 *   delete:
 *     summary: Eliminar una clase (Staff/Admin)
 *     tags: [Clases]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: 'integer' }
 *     responses:
 *       200:
 *         description: Clase eliminada
 */
router.delete('/:id', verifyToken, isStaff, ClassController.deleteClass);

/**
 * @openapi
 * /classes/{id}/register:
 *   post:
 *     summary: Inscribirse en una clase
 *     tags: [Clases]
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
 *       400:
 *         description: La clase está llena
 *       409:
 *         description: Ya estás inscrito
 */
router.post('/:id/register', verifyToken, ClassController.registerToClass);

export default router;
