// backend/src/controllers/analysisController.ts
import { Request, Response } from "express";
import { analysisService } from "services/analysisService.js";
import { broadcastUpdate } from "utils/websocket.js";
import path from "path";
import config from "config/default.js";
import fs from "fs/promises";
import {
  CombinedController,
  FileNameParams,
  AnalysisUpdateBody,
  AnalysisRenameBody,
  EnvironmentUpdateBody,
  PaginationQuery,
  LogDownloadQuery,
  LogTimeRange,
} from "types/index.js";

const analysisController: CombinedController = {
  async uploadAnalysis(req: Request, res: Response): Promise<void> {
    try {
      if (!req.files || !req.files.analysis) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }

      const analysis = req.files.analysis;
      const type = req.body.type || "listener";

      const result = await analysisService.uploadAnalysis(analysis, type);

      // Broadcast the complete analysis object
      broadcastUpdate("analysisCreated", {
        fileName: result.analysisName,
        analysis: {
          name: result.analysisName,
          type: type,
          status: "stopped",
          enabled: false,
          logs: [],
        },
      });

      res.json(result);
    } catch (error: any) {
      console.error("Upload error:", error);
      res.status(500).json({ error: error.message });
    }
  },

  async getAnalyses(_req: Request, res: Response): Promise<void> {
    try {
      const analyses = await analysisService.getRunningAnalyses();
      res.json(analyses);
    } catch (error: any) {
      console.error("List analyses error:", error);
      res.status(500).json({ error: error.message });
    }
  },

  async runAnalysis(
    req: Request<FileNameParams>,
    res: Response,
  ): Promise<void> {
    try {
      const { fileName } = req.params;
      const { type } = req.body;

      const result = await analysisService.runAnalysis(fileName, type);

      // Broadcast status change
      broadcastUpdate("status", {
        fileName,
        status: "running",
        enabled: true,
        type,
      });

      res.json(result);
    } catch (error: any) {
      console.error("Run analysis error:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },

  async stopAnalysis(
    req: Request<FileNameParams>,
    res: Response,
  ): Promise<void> {
    try {
      const { fileName } = req.params;
      const result = await analysisService.stopAnalysis(fileName);

      // Broadcast status change
      broadcastUpdate("status", {
        fileName,
        status: "stopped",
        enabled: false,
      });

      res.json(result);
    } catch (error: any) {
      console.error("Stop analysis error:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },

  async deleteAnalysis(
    req: Request<FileNameParams>,
    res: Response,
  ): Promise<void> {
    try {
      const { fileName } = req.params;
      await analysisService.deleteAnalysis(fileName);

      // Broadcast deletion
      broadcastUpdate("analysisDeleted", { fileName });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete analysis error:", error);
      res.status(500).json({ error: error.message });
    }
  },

  async getAnalysisContent(
    req: Request<FileNameParams>,
    res: Response,
  ): Promise<void> {
    try {
      const { fileName } = req.params;
      console.log("Getting content for analysis:", fileName);

      try {
        const content = await analysisService.getAnalysisContent(fileName);
        res.set("Content-Type", "text/plain");
        res.send(content);
      } catch (error: any) {
        console.error("Error getting analysis content:", error);
        if (error.code === "ENOENT") {
          res.status(404).json({
            error: `Analysis file ${fileName} not found`,
          });
          return;
        }
        throw error;
      }
    } catch (error: any) {
      console.error("Controller error:", error);
      res.status(500).json({
        error: error.message,
      });
    }
  },

  async updateAnalysis(
    req: Request<FileNameParams, any, AnalysisUpdateBody>,
    res: Response,
  ): Promise<void> {
    try {
      const { fileName } = req.params;
      const { content } = req.body;

      if (!content) {
        console.warn("No content provided in request body");
        res.status(400).json({
          error: "Content is required",
        });
        return;
      }

      if (typeof content !== "string") {
        console.warn("Invalid content type:", typeof content);
        res.status(400).json({
          error: "Content must be a string",
        });
        return;
      }

      const result = await analysisService.updateAnalysis(fileName, content);

      // Broadcast update with restart status
      broadcastUpdate("analysisUpdated", {
        fileName,
        status: "updated",
        restarted: result.restarted,
      });

      res.json({
        success: true,
        message: "Analysis updated successfully",
        restarted: result.restarted,
      });
    } catch (error: any) {
      console.error("Controller error:", error);
      res.status(500).json({
        error: error.message,
      });
    }
  },

  async renameAnalysis(
    req: Request<FileNameParams, any, AnalysisRenameBody>,
    res: Response,
  ): Promise<void> {
    try {
      const { fileName } = req.params;
      const { newFileName } = req.body;

      if (!newFileName) {
        console.warn("No new filename provided in request body");
        res.status(400).json({
          error: "newFileName is required",
        });
        return;
      }

      if (typeof newFileName !== "string") {
        console.warn("Invalid content type:", typeof newFileName);
        res.status(400).json({
          error: "newFileName must be a string",
        });
        return;
      }

      const result = await analysisService.renameAnalysis(
        fileName,
        newFileName,
      );

      // Broadcast update with restart status
      broadcastUpdate("analysisRenamed", {
        oldFileName: fileName,
        newFileName: newFileName,
        status: "updated",
        restarted: result.restarted,
      });

      res.json({
        success: true,
        message: "Analysis updated successfully",
        restarted: result.restarted,
      });
    } catch (error: any) {
      console.error("Controller error:", error);
      res.status(500).json({
        error: error.message,
      });
    }
  },

  async getLogs(
    req: Request<FileNameParams, any, any, PaginationQuery>,
    res: Response,
  ): Promise<void> {
    try {
      const { fileName } = req.params;
      const { page = "1", limit = "100" } = req.query;
      const logFile = path.join(
        config.paths.analysis,
        fileName,
        "logs",
        "analysis.log",
      );

      try {
        const content = await fs.readFile(logFile, "utf8");
        const allLogs = content
          .trim()
          .split("\n")
          .map((line) => {
            const match = line.match(/\[(.*?)\] (.*)/);
            return match
              ? {
                  timestamp: match[1],
                  message: match[2],
                }
              : null;
          })
          .filter(Boolean)
          .reverse(); // Most recent first

        // Calculate pagination
        const startIndex =
          (parseInt(page || "1") - 1) * parseInt(limit || "100");
        const endIndex = startIndex + parseInt(limit || "100");
        const paginatedLogs = allLogs.slice(startIndex, endIndex);

        res.json(paginatedLogs);
      } catch (error: any) {
        if (error.code === "ENOENT") {
          res.json([]);
        } else {
          throw error;
        }
      }
    } catch (error: any) {
      console.error("Get logs error:", error);
      res.status(500).json({ error: error.message });
    }
  },

  async downloadLogs(
    req: Request<FileNameParams, any, any, LogDownloadQuery>,
    res: Response,
  ): Promise<void> {
    try {
      const { fileName } = req.params;
      const { timeRange } = req.query;

      if (!fileName) {
        res.status(400).json({ error: "fileName is required" });
        return;
      }

      if (!timeRange) {
        res.status(400).json({ error: "timeRange is required" });
        return;
      }

      // Validate time range
      if (!analysisService.validateTimeRange(timeRange)) {
        res.status(400).json({
          error: "Invalid time range. Must be one of: 1h, 24h, 7d, 30d, all",
        });
        return;
      }

      // Get logs from analysisService
      const { logFile, content } = await analysisService.getLogsForDownload(
        fileName,
        timeRange as LogTimeRange,
      );

      // Define log path inside the analysis subfolder
      const analysisLogsDir = path.join(
        config.paths.analysis,
        fileName,
        "logs",
      );
      await fs.mkdir(analysisLogsDir, { recursive: true });

      if (timeRange === "all") {
        // Directly download the full log file
        res.download(logFile, `${path.parse(fileName).name}.log`, (err) => {
          if (err && !res.headersSent) {
            res.status(500).json({ error: "Failed to download file" });
          }
        });
        return;
      }

      // Create a temporary file in the correct logs directory
      const tempLogFile = path.join(
        analysisLogsDir,
        `${path.parse(fileName).name}_${timeRange}_temp.log`,
      );

      try {
        await fs.writeFile(tempLogFile, content);

        // Send the file
        res.download(tempLogFile, `${path.parse(fileName).name}.log`, (err) => {
          fs.unlink(tempLogFile).catch(console.error); // Clean up temp file

          if (err && !res.headersSent) {
            res.status(500).json({ error: "Failed to download file" });
          }
        });
      } catch (writeError: any) {
        console.error("Error writing temporary file:", writeError);
        res.status(500).json({ error: "Failed to generate download file" });
        return;
      }
    } catch (error: any) {
      console.error("Download logs error:", error);

      if (error.message.includes("Log file not found")) {
        res.status(404).json({ error: error.message });
        return;
      }

      res.status(500).json({ error: error.message });
    }
  },

  async clearLogs(req: Request<FileNameParams>, res: Response): Promise<void> {
    try {
      const { fileName } = req.params;

      if (!fileName) {
        res.status(400).json({ error: "fileName is required" });
        return;
      }

      const result = await analysisService.clearLogs(fileName);

      // Broadcast to all clients that logs were cleared
      broadcastUpdate("clearLogs", {
        fileName,
        status: "cleared",
      });

      res.json(result);
    } catch (error: any) {
      console.error("Clear logs error:", error);
      res.status(500).json({ error: error.message });
    }
  },

  async downloadAnalysis(
    req: Request<FileNameParams>,
    res: Response,
  ): Promise<void> {
    try {
      const { fileName } = req.params;

      if (!fileName) {
        res.status(400).json({ error: "fileName is required" });
        return;
      }

      // Define the path to the analysis file
      const analysisPath = path.join(
        config.paths.analysis,
        fileName,
        "index.cjs",
      );

      try {
        // Check if file exists
        await fs.access(analysisPath);

        // Set headers for file download
        res.setHeader("Content-Type", "application/javascript");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename=${fileName}.cjs`,
        );

        // Stream the file to response
        res.download(analysisPath, `${fileName}.cjs`, (err) => {
          if (err && !res.headersSent) {
            res.status(500).json({ error: "Failed to download file" });
          }
        });
      } catch (error: any) {
        if (error.code === "ENOENT") {
          res.status(404).json({ error: "Analysis file not found" });
          return;
        }
        throw error;
      }
    } catch (error: any) {
      console.error("Download analysis error:", error);
      res.status(500).json({ error: error.message });
    }
  },

  async getEnvironment(
    req: Request<FileNameParams>,
    res: Response,
  ): Promise<void> {
    try {
      const { fileName } = req.params;
      const env = await analysisService.getEnvironment(fileName);
      res.json(env);
      console.log("Getting ENV content for analysis:", fileName);
    } catch (error: any) {
      console.error("Get environment error:", error);
      res.status(500).json({ error: error.message });
    }
  },

  async updateEnvironment(
    req: Request<FileNameParams, any, EnvironmentUpdateBody>,
    res: Response,
  ): Promise<void> {
    try {
      const { fileName } = req.params;
      const { env } = req.body;

      if (!env || typeof env !== "object") {
        res.status(400).json({
          error: "Environment variables must be provided as an object",
        });
        return;
      }

      const result = await analysisService.updateEnvironment(fileName, env);

      // Broadcast update with restart status
      broadcastUpdate("environmentUpdated", {
        fileName,
        status: "updated",
        restarted: result.restarted,
      });

      res.json({
        success: true,
        message: "Environment updated successfully",
        restarted: result.restarted,
      });
    } catch (error: any) {
      console.error("Update environment error:", error);
      res.status(500).json({ error: error.message });
    }
  },
};

export default analysisController;
