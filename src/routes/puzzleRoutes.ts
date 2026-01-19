import { Router } from 'express';
import * as PuzzleController from '../controllers/puzzleController';
import * as DailyPuzzleController from '../controllers/dailyPuzzleController';
import { verifyToken, isAdmin, optionalAuth } from '../middlewares/authMiddleware';
import multer from 'multer';

const upload = multer({ dest: 'uploads/' });

const router = Router();

/**
 * @openapi
 * /puzzles/daily:
 *   get:
 *     summary: Obtener el problema del día
 *     tags: [Puzzles]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: El puzzle del día con el progreso del usuario
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DailyPuzzle'
 *       404:
 *         description: No hay puzzle disponible para hoy
 */
router.get('/daily', verifyToken, DailyPuzzleController.getDailyPuzzle);

/**
 * @openapi
 * /puzzles/daily/attempt:
 *   post:
 *     summary: Registrar un intento en el puzzle del día
 *     tags: [Puzzles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               dailyPuzzleId: { type: 'integer' }
 *               moves: { type: 'array', items: { type: 'string' } }
 *               solved: { type: 'boolean' }
 *               timeSpent: { type: 'integer' }
 *     responses:
 *       200:
 *         description: Intento registrado exitosamente
 */
router.post('/daily/attempt', verifyToken, DailyPuzzleController.recordAttempt);

/**
 * @openapi
 * /puzzles/daily/stats:
 *   get:
 *     summary: Obtener estadísticas de racha y puzzles diarios del usuario
 *     tags: [Puzzles]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estadísticas detalladas
 */
router.get('/daily/stats', verifyToken, DailyPuzzleController.getStats);

/**
 * @openapi
 * /puzzles/daily/leaderboard:
 *   get:
 *     summary: Obtener el ranking del problema del día
 *     tags: [Puzzles]
 *     parameters:
 *       - in: query
 *         name: date
 *         schema: { type: 'string', format: 'date' }
 *         description: Fecha específica (opcional)
 *     responses:
 *       200:
 *         description: Leaderboard para la fecha seleccionada
 */
router.get('/daily/leaderboard', optionalAuth, DailyPuzzleController.getLeaderboard);

// Standard Puzzle Routes
/**
 * @openapi
 * /puzzles:
 *   get:
 *     summary: Listar todos los puzzles con filtros
 *     tags: [Puzzles]
 *     parameters:
 *       - in: query
 *         name: ratingMin
 *         schema: { type: 'integer' }
 *       - in: query
 *         name: page
 *         schema: { type: 'integer' }
 *     responses:
 *       200:
 *         description: Lista paginada de puzzles
 */
router.get('/', optionalAuth, PuzzleController.listPuzzles);
router.post('/solve', verifyToken, PuzzleController.solvePuzzle);
router.post('/', verifyToken, isAdmin, PuzzleController.createPuzzle);
router.put('/:id', verifyToken, isAdmin, PuzzleController.updatePuzzle);
router.delete('/:id', verifyToken, isAdmin, PuzzleController.deletePuzzle);
router.post('/import-csv', verifyToken, isAdmin, upload.single('file'), PuzzleController.importCSV);

export default router;
