// backend/src/routes/teamRoutes.js
import express from 'express';
import * as teamController from '../controllers/teamController.js';
import { authMiddleware } from '../middleware/betterAuthMiddleware.js';

const router = express.Router();

// Apply authentication to all team routes
router.use(authMiddleware);

// Custom team endpoints that handle Better Auth team table with custom properties
// We use custom endpoints because Better Auth's client methods don't support our custom fields

/**
 * @swagger
 * /teams:
 *   get:
 *     summary: Get all teams
 *     description: Get all teams with custom properties from Better Auth team table
 *     tags: [Team Management]
 */
router.get('/', teamController.getAllTeams);

/**
 * @swagger
 * /teams:
 *   post:
 *     summary: Create team with custom properties
 *     description: Create team in Better Auth table with custom properties (color, order)
 *     tags: [Team Management]
 */
router.post('/', teamController.createTeam);

/**
 * @swagger
 * /teams/reorder:
 *   put:
 *     summary: Reorder teams
 *     description: Update the display order of teams
 *     tags: [Team Management]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               orderedIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of team IDs in desired order
 *     responses:
 *       200:
 *         description: Teams reordered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */
router.put('/reorder', teamController.reorderTeams);

/**
 * @swagger
 * /teams/{id}:
 *   put:
 *     summary: Update team with custom properties
 *     description: Update team in Better Auth table with custom properties
 *     tags: [Team Management]
 */
router.put('/:id', teamController.updateTeam);

/**
 * @swagger
 * /teams/{id}:
 *   delete:
 *     summary: Delete team with analysis migration
 *     description: Handle analysis migration before team deletion
 *     tags: [Team Management]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               moveAnalysesTo:
 *                 type: string
 *                 description: Team ID to move analyses to, or 'uncategorized'
 *                 default: 'uncategorized'
 */
router.delete('/:id', teamController.deleteTeam);

/**
 * @swagger
 * /teams/{id}/count:
 *   get:
 *     summary: Get analysis count for team
 *     description: Get the number of analyses assigned to a specific team
 *     tags: [Team Management]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Team ID
 *     responses:
 *       200:
 *         description: Analysis count retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: number
 *                   description: Number of analyses in the team
 */
router.get('/:id/count', teamController.getTeamAnalysisCount);

// Analysis-team routes
router.put('/analyses/:name/team', teamController.moveAnalysisToTeam);

export default router;
