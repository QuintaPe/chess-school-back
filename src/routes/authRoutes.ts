import { Router } from 'express';
import { register, login, getMe, updateProfile, getAllUsers, adminUpdateUser, adminDeleteUser } from '../controllers/authController';
import * as RoleController from '../controllers/roleController';
import { verifyToken, isAdmin } from '../middlewares/authMiddleware';

const router = Router();

/**
 * @openapi
 * /auth/register:
 *   post:
 *     summary: Registrar un nuevo usuario
 *     tags: [Autenticación]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, name]
 *             properties:
 *               email: { type: 'string', format: 'email' }
 *               password: { type: 'string', minLength: 6 }
 *               name: { type: 'string' }
 *     responses:
 *       201:
 *         description: Usuario creado exitosamente
 *       400:
 *         description: Datos inválidos o el usuario ya existe
 */
router.post('/register', register);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Iniciar sesión
 *     tags: [Autenticación]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: 'string', format: 'email' }
 *               password: { type: 'string' }
 *     responses:
 *       200:
 *         description: Login exitoso, devuelve JWT
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token: { type: 'string' }
 *                 user: { $ref: '#/components/schemas/User' }
 *       401:
 *         description: Credenciales inválidas
 */
router.post('/login', login);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     summary: Obtener perfil del usuario actual
 *     tags: [Perfil]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Datos del perfil del usuario
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 */
router.get('/me', verifyToken, getMe);

/**
 * @openapi
 * /auth/me:
 *   patch:
 *     summary: Actualizar perfil del usuario
 *     tags: [Perfil]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: 'string' }
 *               bio: { type: 'string' }
 *               avatar_url: { type: 'string' }
 *     responses:
 *       200:
 *         description: Perfil actualizado
 */
router.patch('/me', verifyToken, updateProfile);

// Admin Routes
/**
 * @openapi
 * /auth/users:
 *   get:
 *     summary: Listar todos los usuarios (Admin)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de usuarios
 */
router.get('/users', verifyToken, isAdmin, getAllUsers);

/**
 * @openapi
 * /auth/users/{id}:
 *   patch:
 *     summary: Actualizar usuario por ID (Admin)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *         name: id
 *         required: true
 *         schema: { type: 'string' }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               roles:
 *                 type: array
 *                 items:
 *                   type: string
 *               subscription_plan: { type: 'string', enum: [free, premium] }
 *               status: { type: 'string', enum: [active, inactive] }
 *     responses:
 *       200:
 *         description: Usuario actualizado
 */
router.patch('/users/:id', verifyToken, isAdmin, adminUpdateUser);

/**
 * @openapi
 * /auth/users/{id}:
 *   delete:
 *     summary: Eliminar usuario (Admin)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: 'string' }
 *     responses:
 *       200:
 *         description: Usuario eliminado
 */
router.delete('/users/:id', verifyToken, isAdmin, adminDeleteUser);

// Role Management Routes
router.get('/admin/roles', verifyToken, isAdmin, RoleController.getRoles);
router.post('/admin/roles', verifyToken, isAdmin, RoleController.createRole);
router.put('/admin/roles/:id', verifyToken, isAdmin, RoleController.updateRole);
router.delete('/admin/roles/:id', verifyToken, isAdmin, RoleController.deleteRole);

// Permission Management Routes
router.get('/admin/permissions', verifyToken, isAdmin, RoleController.getPermissions);
router.get('/admin/roles/:id/permissions', verifyToken, isAdmin, RoleController.getRolePermissions);
router.post('/admin/roles/:id/permissions', verifyToken, isAdmin, RoleController.updateRolePermissions);

export default router;
