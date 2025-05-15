// controllers/statusController.ts
import { createRequire } from 'module';
import { Request, Response } from 'express';
import { SystemStatusResponse, IAnalysisService, StatusController as IStatusController } from 'types/index.js';

const requireTago = createRequire(import.meta.url);

export default class StatusController implements IStatusController {
  analysisService: IAnalysisService;

  constructor(analysisService: IAnalysisService) {
    this.analysisService = analysisService;
    this.getSystemStatus = this.getSystemStatus.bind(this);
  }

  async getSystemStatus(_req: Request, res: Response): Promise<void> {
    try {
      const runningAnalyses = Array.from(
        this.analysisService.analyses.values(),
      ).filter((analysis) => analysis.status === "running");

      // Get Tago SDK version from package.json using the created require function
      const tagoVersion = requireTago("@tago-io/sdk/package.json").version;

      const status: SystemStatusResponse = {
        health: {
          status: "healthy",
        },
        tagoConnection: {
          sdkVersion: tagoVersion,
          status: "disconnected",
          runningAnalyses: runningAnalyses.length,
        },
        serverTime: new Date().toString(),
      };

      // If there are running analyses, check connection status
      if (runningAnalyses.length > 0) {
        // Get the connection monitor for the first running analysis
        const firstRunning = runningAnalyses[0];
        const monitor = this.analysisService.connectionMonitors.get(
          firstRunning.analysisName,
        );

        if (monitor) {
          const isConnected = await monitor.checkConnection();
          status.tagoConnection.status = isConnected
            ? "connected"
            : "disconnected";
        }
      }

      res.json(status);
    } catch (error: any) {
      console.error("Status check error:", error);
      res.status(500).json({
        health: { status: "unhealthy" },
        tagoConnection: {
          sdkVersion: "unknown",
          status: "unknown",
          runningAnalyses: 0,
        },
        message: error.message,
      });
    }
  }
}