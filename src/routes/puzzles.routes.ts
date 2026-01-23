import { Router } from 'express';
import * as PuzzleController from '../controllers/puzzles.controller';
import { verifyToken, isAdmin, optionalAuth } from '../middlewares/authMiddleware';
import multer from 'multer';

const upload = multer({ dest: 'uploads/' });

const router = Router();

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

