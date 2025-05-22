// backend/src/utils/websocket.ts
import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import { analysisService } from "services/analysisService.js";
import { WebSocketMessage, WebSocketMessageType } from "types/index.js";

let wss: WebSocketServer | null = null;
const clients: Set<WebSocket> = new Set();

function setupWebSocket(server: Server): WebSocketServer {
  // Ensure we don't create multiple WebSocket servers
  if (wss !== null) {
    console.warn("WebSocket server already exists");
    return wss;
  }

  wss = new WebSocketServer({
    server,
    path: "/ws",
    clientTracking: true,
  });

  console.log("Setting up WebSocket server");

  wss.on("connection", async (ws: WebSocket) => {
    console.log("New WebSocket connection established");
    clients.add(ws);

    try {
      const analyses = await analysisService.getRunningAnalyses();

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "init",
            analyses,
          }),
        );
      }
    } catch (error) {
      console.error("Error sending initial state:", error);
    }

    ws.on("close", () => {
      console.log("WebSocket connection closed");
      clients.delete(ws);
    });

    ws.on("error", (error) => {
      console.error("WebSocket connection error:", error);
      clients.delete(ws);
    });
  });

  return wss;
}

function broadcastUpdate<T = any>(type: WebSocketMessageType, data: T): void {
  // Add check to prevent unnecessary broadcasts
  if (!wss || clients.size === 0) return;

  const message: WebSocketMessage<T> = { type, data };
  const messageStr = JSON.stringify(message);

  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(messageStr);
      } catch (error) {
        console.error("Error broadcasting to client:", error);
        clients.delete(client);
      }
    }
  });
}

export { setupWebSocket, broadcastUpdate };
