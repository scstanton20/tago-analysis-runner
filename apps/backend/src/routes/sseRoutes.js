// backend/src/routes/sseRoutes.js
import { Router } from 'express';
import {
  authenticateSSE,
  handleSSEConnection,
  sseManager,
} from '../utils/sse.js';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     SSEEvent:
 *       type: object
 *       properties:
 *         type:
 *           type: string
 *           description: Event type
 *           enum: [init, statusUpdate, analysisUpdate, log, departmentUpdate, sessionInvalidated]
 *         data:
 *           type: object
 *           description: Event data payload
 *         timestamp:
 *           type: string
 *           format: date-time
 *           description: Event timestamp
 *       example:
 *         type: "analysisUpdate"
 *         data: { fileName: "example-analysis", status: "running" }
 *         timestamp: "2024-06-29T10:30:00.000Z"
 */

/**
//  * @swagger
 * /sse/events:
 *   get:
 *     summary: Server-Sent Events stream for real-time updates
 *     description: |
 *       Establishes a Server-Sent Events (SSE) connection for receiving real-time updates about:
 *       - Analysis status changes and logs
 *       - System status updates
 *       - Department changes
 *       - Session invalidation notifications
 *
 *       **Authentication:** Uses existing session cookies - same auth as API access.
 *
 *       **Connection:** Keep-alive with automatic browser reconnection support.
 *
 *       **Events Sent:**
 *       - `init`: Initial data load (analyses, departments)
 *       - `statusUpdate`: Server health and Tago connection status
 *       - `analysisUpdate`: Analysis state changes
 *       - `log`: Real-time analysis log entries
 *       - `departmentUpdate`: Department creation/modification/deletion
 *       - `sessionInvalidated`: Authentication session expired
 *
 *     tags: [Real-time Events]
 *     responses:
 *       200:
 *         description: SSE connection established successfully
 *         content:
 *           text/event-stream:
 *             schema:
 *               $ref: "..."
 *       401:
 *         description: Authentication required or failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               no_token:
 *                 summary: No authentication token
 *                 value:
 *                   error: "Authentication required"
 *               invalid_token:
 *                 summary: Invalid authentication token
 *                 value:
 *                   error: "Authentication failed"
 *               invalid_user:
 *                 summary: User not found
 *                 value:
 *                   error: "Invalid user"
 */
router.get('/events', authenticateSSE, handleSSEConnection);

/**
//  * @swagger
 * /sse/logout-notification:
 *   post:
 *     summary: Send logout notification to other sessions
 *     description: Notify all other active sessions of the same user about logout event via SSE
 *     tags: [Real-time Events]
 *     responses:
 *       200:
 *         description: Logout notification sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Failed to send logout notification
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/logout-notification', authenticateSSE, (req, res) => {
  try {
    const userId = req.user.id;

    // Send SSE logout notification to all user's other sessions
    sseManager.sendToUser(userId, {
      type: 'userLogout',
      userId: userId,
      timestamp: new Date().toISOString(),
    });

    console.log(`Sent logout notification to user ${userId}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Logout notification error:', error);
    res.status(500).json({ error: 'Failed to send logout notification' });
  }
});

export default router;
