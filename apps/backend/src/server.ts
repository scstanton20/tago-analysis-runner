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
import {
  analysisService,
  initializeAnalyses,
} from "services/analysisService.js";
import StatusController from "controllers/statusController.js";

const app = express();
const server = http.createServer(app);

// Container state tracking
const containerState = {
  status: "starting",
  startTime: new Date(),
  message: "Container is starting",
};
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
const statusController = new StatusController(analysisService, containerState);
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
// Function to restart processes that were running before
async function restartRunningProcesses() {
  try {
    containerState.status = "restarting_processes";
    containerState.message = "Restarting previously running analyses";
    console.log("Checking for analyses that need to be restarted...");

    // Get all saved analyses from configuration
    const configuration = analysisService.getConfig();

    // Loop through and restart any that were previously running or enabled
    for (const [analysisName, config] of Object.entries(configuration)) {
      if (config.status === "running" || config.enabled === true) {
        console.log(
          `Restarting analysis: ${analysisName} (type: ${config.type})`,
        );
        await analysisService.runAnalysis(analysisName, config.type);
      }
    }

    containerState.status = "ready";
    containerState.message = "Container is fully initialized and ready";
    console.log("Process restart check completed");
  } catch (error: any) {
    containerState.status = "error";
    containerState.message = `Error during process restart: ${error.message}`;
    console.error("Error restarting processes:", error);
  }
}

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

    await restartRunningProcesses();
    // Start the server
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error: any) {
    console.error("Failed to start server:", error.message);
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
