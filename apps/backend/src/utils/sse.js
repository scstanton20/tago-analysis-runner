// backend/src/utils/sse.js
import { auth } from '../lib/auth.js';
import { fromNodeHeaders } from 'better-auth/node';

class SSEManager {
  // Add authenticated SSE client
  addClient(userId, res, req) {
    const clientId = Math.random().toString(36).substring(7);
    const client = {
      id: clientId,
      userId,
      res,
      req,
      createdAt: new Date(),
    };

    // Add to user-specific clients
    if (!this.clients.has(userId)) {
      this.clients.set(userId, new Set());
    }
    this.clients.get(userId).add(client);

    // Add to global clients
    this.globalClients.add(client);

    console.log(`SSE client connected: userId=${userId}, clientId=${clientId}`);

    // Handle client disconnect
    req.on('close', () => {
      this.removeClient(userId, clientId);
    });

    req.on('error', (error) => {
      // Only log actual errors, not normal disconnections
      if (error.code !== 'ECONNRESET' && error.code !== 'EPIPE') {
        console.error(
          `SSE client error: userId=${userId}, clientId=${clientId}`,
          error.message,
        );
      }
      this.removeClient(userId, clientId);
    });

    return client;
  }

  // Remove SSE client
  removeClient(userId, clientId) {
    const userClients = this.clients.get(userId);
    if (userClients) {
      const clientToRemove = Array.from(userClients).find(
        (c) => c.id === clientId,
      );
      if (clientToRemove) {
        userClients.delete(clientToRemove);
        this.globalClients.delete(clientToRemove);

        if (userClients.size === 0) {
          this.clients.delete(userId);
        }

        console.log(
          `SSE client disconnected: userId=${userId}, clientId=${clientId}`,
        );
      }
    }
  }

  // Send message to specific user's connections
  sendToUser(userId, data) {
    const userClients = this.clients.get(userId);
    if (!userClients) return 0;

    const message = this.formatSSEMessage(data);
    let sentCount = 0;

    for (const client of userClients) {
      try {
        if (!client.res.destroyed) {
          client.res.write(message);
          sentCount++;
        }
      } catch (error) {
        console.error(`Error sending SSE to user ${userId}:`, error);
        this.removeClient(userId, client.id);
      }
    }

    return sentCount;
  }

  // Broadcast to all connected clients
  broadcast(data) {
    const message = this.formatSSEMessage(data);
    let sentCount = 0;
    const failedClients = [];

    for (const client of this.globalClients) {
      try {
        if (!client.res.destroyed) {
          client.res.write(message);
          sentCount++;
        } else {
          failedClients.push(client);
        }
      } catch (error) {
        console.error(
          `Error broadcasting SSE to user ${client.userId}:`,
          error,
        );
        failedClients.push(client);
      }
    }

    // Clean up failed clients
    failedClients.forEach((client) => {
      this.removeClient(client.userId, client.id);
    });

    return sentCount;
  }

  // Format data as SSE message
  formatSSEMessage(data) {
    const timestamp = new Date().toISOString();
    const messageData = {
      ...data,
      timestamp,
    };

    // SSE format: data: JSON\n\n
    return `data: ${JSON.stringify(messageData)}\n\n`;
  }

  // Get connection stats
  getStats() {
    return {
      totalClients: this.globalClients.size,
      uniqueUsers: this.clients.size,
      userConnections: Array.from(this.clients.entries()).map(
        ([userId, clients]) => ({
          userId,
          connectionCount: clients.size,
        }),
      ),
    };
  }

  // Send initial data to a client
  async sendInitialData(client) {
    try {
      const { analysisService } = await import(
        '../services/analysisService.js'
      );
      const teamService = (await import('../services/teamService.js')).default;

      const [analyses, teams] = await Promise.all([
        analysisService.getAllAnalyses(),
        teamService.getAllTeams(),
      ]);

      const initData = {
        type: 'init',
        analyses,
        teams,
        version: '3.0',
      };

      const message = this.formatSSEMessage(initData);
      client.res.write(message);

      // Send initial status
      await this.sendStatusUpdate(client);
    } catch (error) {
      console.error('Error sending initial SSE data:', error);
    }
  }

  // Send status update to specific client
  async sendStatusUpdate(client) {
    try {
      const { analysisService } = await import(
        '../services/analysisService.js'
      );
      const { createRequire } = await import('module');
      const require = createRequire(import.meta.url);
      const ms = (await import('ms')).default;

      // Get container state
      const containerState = this.getContainerState();

      let runningAnalyses = [];
      try {
        const analyses = analysisService?.analyses;
        if (analyses && typeof analyses.values === 'function') {
          runningAnalyses = Array.from(analyses.values()).filter(
            (analysis) => analysis && analysis.status === 'running',
          );
        }
      } catch (filterError) {
        console.error('Error filtering analyses:', filterError);
      }

      let tagoVersion;
      try {
        const packageJson = require('@tago-io/sdk/package.json');
        tagoVersion = packageJson.version;
      } catch (error) {
        console.error('Error reading tago SDK version:', error);
        tagoVersion = 'unknown';
      }

      const status = {
        type: 'statusUpdate',
        container_health: {
          status:
            containerState.status === 'ready' ? 'healthy' : 'initializing',
          message: containerState.message,
          uptime: {
            seconds: Math.floor((new Date() - containerState.startTime) / 1000),
            formatted: ms(new Date() - containerState.startTime, {
              long: true,
            }),
          },
        },
        tagoConnection: {
          sdkVersion: tagoVersion,
          runningAnalyses: runningAnalyses.length,
        },
        serverTime: new Date().toString(),
      };

      const message = this.formatSSEMessage(status);
      client.res.write(message);
    } catch (error) {
      console.error('Error sending SSE status update:', error);
    }
  }

  // Container state management
  constructor() {
    this.clients = new Map(); // userId -> Set of SSE connections
    this.globalClients = new Set(); // All connections for global broadcasts
    this.containerState = {
      status: 'ready',
      startTime: new Date(),
      message: 'Container is ready',
    };
  }

  setContainerState(state) {
    this.containerState = { ...this.containerState, ...state };
  }

  getContainerState() {
    return this.containerState;
  }

  updateContainerState(newState) {
    this.setContainerState(newState);
    // Broadcast status update when container state changes
    this.broadcastStatusUpdate();
  }

  // Broadcast status update to all clients
  broadcastStatusUpdate() {
    if (this.globalClients.size === 0) return;

    for (const client of this.globalClients) {
      this.sendStatusUpdate(client);
    }
  }

  // Enhanced broadcast functions
  broadcastRefresh() {
    this.broadcast({ type: 'refresh' });
  }

  broadcastTeamUpdate(team, action) {
    this.broadcast({
      type: 'teamUpdate',
      action,
      team,
    });
  }

  broadcastAnalysisMove(analysisName, fromTeam, toTeam) {
    this.broadcast({
      type: 'analysisMovedToTeam',
      analysis: analysisName,
      from: fromTeam,
      to: toTeam,
    });
  }

  broadcastUpdate(type, data) {
    if (type === 'log') {
      this.broadcast({
        type: 'log',
        data: data,
      });
    } else {
      this.broadcast({
        type: 'analysisUpdate',
        analysisName: type,
        update: data,
      });
    }
  }
}

// Export singleton instance
export const sseManager = new SSEManager();

// Authentication middleware for SSE using Better Auth
export async function authenticateSSE(req, res, next) {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session?.session || !session?.user) {
      console.log('SSE authentication failed: No valid session');
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Attach user to request
    Object.assign(req, { user: session.user });
    next();
  } catch (error) {
    console.error('SSE authentication failed:', error.message);
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

// SSE route handler
export function handleSSEConnection(req, res) {
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': req.headers.origin || '*',
    'Access-Control-Allow-Credentials': 'true',
  });

  // Send initial connection confirmation
  res.write('data: {"type":"connection","status":"connected"}\n\n');

  // Add client to manager
  const client = sseManager.addClient(req.user.id, res, req);

  // Send initial data
  sseManager.sendInitialData(client);

  // Keep connection alive with periodic heartbeat
  const heartbeatInterval = setInterval(() => {
    if (!res.destroyed) {
      res.write('data: {"type":"heartbeat"}\n\n');
    } else {
      clearInterval(heartbeatInterval);
    }
  }, 30000); // 30 seconds

  // Clean up on disconnect
  req.on('close', () => {
    clearInterval(heartbeatInterval);
  });
}
