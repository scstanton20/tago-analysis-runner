// backend/src/server.ts 
import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import fileUpload from "express-fileupload";
import config from "config/default.js";
import { setupWebSocket } from "utils/websocket.js";
import analysisController from "controllers/analysisController.js";
import errorHandler from "middleware/errorHandler.js";
import { analysisService, initializeAnalyses } from "services/analysisService.js";
import StatusController from "controllers/statusController.js";

const app = express();
const server = http.createServer(app);

// Single WebSocket setup
let wsInitialized = false;

if (!wsInitialized) {
  setupWebSocket(server);
  wsInitialized = true;
}

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(fileUpload());

// Health check
const statusController = new StatusController(analysisService);
app.get("/status", statusController.getSystemStatus);

// Routes
app.post("/upload", analysisController.uploadAnalysis);
app.get("/analyses", analysisController.getAnalyses);
app.post("/run/:fileName", analysisController.runAnalysis);
app.post("/stop/:fileName", analysisController.stopAnalysis);
app.delete("/analyses/:fileName", analysisController.deleteAnalysis);
app.get("/analyses/:fileName/content", analysisController.getAnalysisContent);
app.put("/analyses/:fileName", analysisController.updateAnalysis);
app.put("/analyses/:fileName/rename", analysisController.renameAnalysis);
app.get("/analyses/:fileName/logs/download", analysisController.downloadLogs);
app.get("/analyses/:fileName/logs", analysisController.getLogs);
app.delete("/analyses/:fileName/logs", analysisController.clearLogs);
app.get("/analyses/:fileName/environment", analysisController.getEnvironment);
app.put(
  "/analyses/:fileName/environment",
  analysisController.updateEnvironment,
);
app.get("/analyses/:fileName/download", analysisController.downloadAnalysis);

// Error handling
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    console.log(`Starting server in ${config.env} mode`);
    console.log("Storage configuration:", {
      base: config.storage.base,
      analysis: config.paths.analysis,
      config: config.paths.config,
    });

    // Initialize analyses before starting the server
    await initializeAnalyses();

    // Start the server
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

startServer();
