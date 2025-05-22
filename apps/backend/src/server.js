// backend/src/server.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const fileUpload = require('express-fileupload');
const config = require('./config/default');
const { setupWebSocket } = require('./utils/websocket');
const analysisController = require('./controllers/analysisController');
const errorHandler = require('./middleware/errorHandler');
const {
  analysisService,
  initializeAnalyses,
} = require('./services/analysisService');
const StatusController = require('./controllers/statusController');

const app = express();
const server = http.createServer(app);

// Container state tracking
const containerState = {
  status: 'starting', // starting, initializing, restarting_processes, ready, error
  startTime: new Date(),
  message: 'Container is starting',
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

// Health check with container state
const statusController = new StatusController(analysisService, containerState);
app.get('/status', statusController.getSystemStatus);

// Routes
app.post('/upload', analysisController.uploadAnalysis);
app.get('/analyses', analysisController.getAnalyses);
app.post('/run/:fileName', analysisController.runAnalysis);
app.post('/stop/:fileName', analysisController.stopAnalysis);
app.delete('/analyses/:fileName', analysisController.deleteAnalysis);
app.get('/analyses/:fileName/content', analysisController.getAnalysisContent);
app.put('/analyses/:fileName', analysisController.updateAnalysis);
app.put('/analyses/:fileName/rename', analysisController.renameAnalysis);
app.get('/analyses/:fileName/logs/download', analysisController.downloadLogs);
app.get('/analyses/:fileName/logs', analysisController.getLogs);
app.delete('/analyses/:fileName/logs', analysisController.clearLogs);
app.get('/analyses/:fileName/environment', analysisController.getEnvironment);
app.put(
  '/analyses/:fileName/environment',
  analysisController.updateEnvironment,
);
app.get('/analyses/:fileName/download', analysisController.downloadAnalysis);

// Error handling
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

// Function to restart processes that were running before
async function restartRunningProcesses() {
  try {
    containerState.status = 'restarting_processes';
    containerState.message = 'Restarting previously running analyses';
    console.log('Checking for analyses that need to be restarted...');

    // Get all saved analyses from configuration
    const configuration = analysisService.getConfig();

    // Loop through and restart any that were previously running or enabled
    for (const [analysisName, config] of Object.entries(configuration)) {
      if (config.status === 'running' || config.enabled === true) {
        console.log(
          `Restarting analysis: ${analysisName} (type: ${config.type})`,
        );
        await analysisService.runAnalysis(analysisName, config.type);
      }
    }

    containerState.status = 'ready';
    containerState.message = 'Container is fully initialized and ready';
    console.log('Process restart check completed');
  } catch (error) {
    containerState.status = 'error';
    containerState.message = `Error during process restart: ${error.message}`;
    console.error('Error restarting processes:', error);
  }
}

async function startServer() {
  try {
    console.log(`Starting server in ${config.env} mode`);
    containerState.status = 'initializing';
    containerState.message = 'Initializing analyses';

    console.log('Storage configuration:', {
      base: config.storage.base,
      analysis: config.paths.analysis,
      config: config.paths.config,
    });

    // Initialize analyses before starting the server
    await initializeAnalyses();

    // Restart analyses that were previously running
    await restartRunningProcesses();

    // Start the server
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    containerState.status = 'error';
    containerState.message = `Failed to start server: ${error.message}`;
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  containerState.status = 'error';
  containerState.message = `Uncaught Exception: ${error.message}`;
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  containerState.status = 'error';
  containerState.message = `Unhandled Rejection: ${reason}`;
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

startServer();
