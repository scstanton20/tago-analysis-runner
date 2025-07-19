// backend/src/controllers/analysisController.js
import { analysisService } from '../services/analysisService.js';
import { sseManager } from '../utils/sse.js';
import path from 'path';
import config from '../config/default.js';
import { promises as fs } from 'fs';
import sanitize from 'sanitize-filename';

// Helper function to validate that a path is within the expected directory
function validatePath(targetPath, allowedBasePath) {
  const resolvedTarget = path.resolve(targetPath);
  const resolvedBase = path.resolve(allowedBasePath);

  // Check if the resolved target path starts with the resolved base path
  if (
    !resolvedTarget.startsWith(resolvedBase + path.sep) &&
    resolvedTarget !== resolvedBase
  ) {
    throw new Error('Path traversal attempt detected');
  }

  return resolvedTarget;
}

// Helper function to sanitize and validate filename
function sanitizeAndValidateFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    throw new Error('Invalid filename');
  }

  const sanitized = sanitize(filename, { replacement: '_' });

  if (
    !sanitized ||
    sanitized.length === 0 ||
    sanitized === '.' ||
    sanitized === '..'
  ) {
    throw new Error('Filename cannot be empty or invalid after sanitization');
  }

  return sanitized;
}

const analysisController = {
  async uploadAnalysis(req, res) {
    try {
      if (!req.files || !req.files.analysis) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const analysis = req.files.analysis;
      const type = req.body.type || 'listener';
      const teamId = req.body.teamId;

      const result = await analysisService.uploadAnalysis(
        analysis,
        type,
        teamId,
      );

      // Get the complete analysis data to broadcast
      const analysisData = await analysisService.getAllAnalyses();
      const createdAnalysis = analysisData[result.analysisName];

      // Broadcast analysis creation with complete data
      sseManager.broadcast({
        type: 'analysisCreated',
        data: {
          analysis: result.analysisName,
          teamId: teamId,
          analysisData: createdAnalysis,
        },
      });

      res.json(result);
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ error: error.message });
    }
  },

  async getAnalyses(_req, res) {
    try {
      const analyses = await analysisService.getAllAnalyses();
      res.json(analyses);
    } catch (error) {
      console.error('List analyses error:', error);
      res.status(500).json({ error: error.message });
    }
  },

  async runAnalysis(req, res) {
    try {
      const { fileName } = req.params;

      // Sanitize the fileName to prevent path traversal
      const sanitizedFileName = sanitizeAndValidateFilename(fileName);

      const result = await analysisService.runAnalysis(sanitizedFileName);

      sseManager.broadcast({
        type: 'analysisStatus',
        data: {
          fileName: sanitizedFileName,
          status: 'running',
          enabled: true,
        },
      });

      res.json(result);
    } catch (error) {
      console.error('Run analysis error:', error);

      if (
        error.message.includes('Path traversal') ||
        error.message.includes('Invalid filename')
      ) {
        return res.status(400).json({ error: 'Invalid file path' });
      }

      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },

  async stopAnalysis(req, res) {
    try {
      const { fileName } = req.params;

      // Sanitize the fileName to prevent path traversal
      const sanitizedFileName = sanitizeAndValidateFilename(fileName);

      const result = await analysisService.stopAnalysis(sanitizedFileName);

      sseManager.broadcast({
        type: 'analysisStatus',
        data: {
          fileName: sanitizedFileName,
          status: 'stopped',
          enabled: false,
        },
      });

      res.json(result);
    } catch (error) {
      console.error('Stop analysis error:', error);

      if (
        error.message.includes('Path traversal') ||
        error.message.includes('Invalid filename')
      ) {
        return res.status(400).json({ error: 'Invalid file path' });
      }

      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },

  async deleteAnalysis(req, res) {
    try {
      const { fileName } = req.params;

      // Sanitize the fileName to prevent path traversal
      const sanitizedFileName = sanitizeAndValidateFilename(fileName);

      // Get analysis data before deletion for broadcast
      const analyses = await analysisService.getAllAnalyses();
      const analysisToDelete = analyses[sanitizedFileName];

      await analysisService.deleteAnalysis(sanitizedFileName);

      // Broadcast deletion with analysis data
      sseManager.broadcast({
        type: 'analysisDeleted',
        data: {
          fileName: sanitizedFileName,
          teamId: analysisToDelete?.teamId,
        },
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Delete analysis error:', error);

      if (
        error.message.includes('Path traversal') ||
        error.message.includes('Invalid filename')
      ) {
        return res.status(400).json({ error: 'Invalid file path' });
      }

      res.status(500).json({ error: error.message });
    }
  },

  async getAnalysisContent(req, res) {
    try {
      const { fileName } = req.params;

      // Sanitize the fileName to prevent path traversal
      const sanitizedFileName = sanitizeAndValidateFilename(fileName);

      try {
        const content =
          await analysisService.getAnalysisContent(sanitizedFileName);
        res.set('Content-Type', 'text/plain');
        res.send(content);
      } catch (error) {
        console.error('Error getting analysis content:', error);
        if (error.code === 'ENOENT') {
          return res.status(404).json({
            error: `Analysis file ${sanitizedFileName} not found`,
          });
        }
        throw error;
      }
    } catch (error) {
      console.error('Controller error:', error);

      if (
        error.message.includes('Path traversal') ||
        error.message.includes('Invalid filename')
      ) {
        return res.status(400).json({ error: 'Invalid file path' });
      }

      res.status(500).json({
        error: error.message,
      });
    }
  },

  async updateAnalysis(req, res) {
    try {
      const { fileName } = req.params;
      const { content } = req.body;

      // Sanitize the fileName to prevent path traversal
      const sanitizedFileName = sanitizeAndValidateFilename(fileName);

      if (!content) {
        console.warn('No content provided in request body');
        return res.status(400).json({
          error: 'Content is required',
        });
      }

      if (typeof content !== 'string') {
        console.warn('Invalid content type:', typeof content);
        return res.status(400).json({
          error: 'Content must be a string',
        });
      }

      const result = await analysisService.updateAnalysis(sanitizedFileName, {
        content,
      });

      // Get updated analysis data
      const analyses = await analysisService.getAllAnalyses();
      const updatedAnalysis = analyses[sanitizedFileName];

      // Broadcast update with complete analysis data
      sseManager.broadcast({
        type: 'analysisUpdated',
        data: {
          fileName: sanitizedFileName,
          status: 'updated',
          restarted: result.restarted,
          ...updatedAnalysis,
        },
      });

      res.json({
        success: true,
        message: 'Analysis updated successfully',
        restarted: result.restarted,
      });
    } catch (error) {
      console.error('Controller error:', error);

      if (
        error.message.includes('Path traversal') ||
        error.message.includes('Invalid filename')
      ) {
        return res.status(400).json({ error: 'Invalid file path' });
      }

      res.status(500).json({
        error: error.message,
      });
    }
  },

  async renameAnalysis(req, res) {
    try {
      const { fileName } = req.params;
      const { newFileName } = req.body;

      // Sanitize both filenames to prevent path traversal
      const sanitizedFileName = sanitizeAndValidateFilename(fileName);
      const sanitizedNewFileName = sanitizeAndValidateFilename(newFileName);

      if (!newFileName) {
        console.warn('No new filename provided in request body');
        return res.status(400).json({
          error: 'newFileName is required',
        });
      }

      if (typeof newFileName !== 'string') {
        console.warn('Invalid content type:', typeof newFileName);
        return res.status(400).json({
          error: 'newFileName must be a string',
        });
      }

      const result = await analysisService.renameAnalysis(
        sanitizedFileName,
        sanitizedNewFileName,
      );

      // Get updated analysis data
      const analyses = await analysisService.getAllAnalyses();
      const renamedAnalysis = analyses[sanitizedNewFileName];

      // Broadcast update with complete analysis data
      sseManager.broadcast({
        type: 'analysisRenamed',
        data: {
          oldFileName: sanitizedFileName,
          newFileName: sanitizedNewFileName,
          status: 'updated',
          restarted: result.restarted,
          ...renamedAnalysis,
        },
      });

      res.json({
        success: true,
        message: 'Analysis renamed successfully',
        restarted: result.restarted,
      });
    } catch (error) {
      console.error('Rename analysis error:', error);

      if (
        error.message.includes('Path traversal') ||
        error.message.includes('Invalid filename')
      ) {
        return res.status(400).json({ error: 'Invalid file path' });
      }

      res.status(500).json({ error: error.message });
    }
  },

  async getLogs(req, res) {
    try {
      const { fileName } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 100;

      // Sanitize the fileName to prevent path traversal
      const sanitizedFileName = sanitizeAndValidateFilename(fileName);

      const logs = await analysisService.getLogs(
        sanitizedFileName,
        page,
        limit,
      );
      res.json(logs);
    } catch (error) {
      console.error('Get logs error:', error);

      if (
        error.message.includes('Path traversal') ||
        error.message.includes('Invalid filename')
      ) {
        return res.status(400).json({ error: 'Invalid file path' });
      }

      res.status(500).json({ error: error.message });
    }
  },

  async downloadLogs(req, res) {
    try {
      const { fileName } = req.params;
      const { timeRange } = req.query;

      if (!fileName) {
        return res.status(400).json({ error: 'fileName is required' });
      }

      if (!timeRange) {
        return res.status(400).json({ error: 'timeRange is required' });
      }

      // Sanitize the fileName to prevent path traversal
      const sanitizedFileName = sanitizeAndValidateFilename(fileName);

      // Validate time range
      if (!analysisService.validateTimeRange(timeRange)) {
        return res.status(400).json({
          error: 'Invalid time range. Must be one of: 1h, 24h, 7d, 30d, all',
        });
      }

      // Get logs from analysisService using sanitized filename
      const result = await analysisService.getLogsForDownload(
        sanitizedFileName,
        timeRange,
      );

      if (timeRange === 'all') {
        // For 'all' time range, construct the expected log file path securely
        // instead of trusting the service-provided path
        const expectedLogFile = path.join(
          config.paths.analysis,
          sanitizedFileName,
          'logs',
          'analysis.log',
        );

        // Validate that our expected path is within allowed directory
        validatePath(expectedLogFile, config.paths.analysis);

        // Verify the file exists before attempting to serve it
        try {
          await fs.access(expectedLogFile);
        } catch (error) {
          if (error.code === 'ENOENT') {
            return res.status(404).json({
              error: `Log file for ${sanitizedFileName} not found`,
            });
          }
          throw error;
        }

        // Set download headers
        const downloadFilename = `${sanitize(path.parse(sanitizedFileName).name)}.log`;
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${downloadFilename}"`,
        );
        res.setHeader('Content-Type', 'text/plain');

        // Stream the file directly - no memory loading
        return res.sendFile(expectedLogFile, (err) => {
          if (err && !res.headersSent) {
            console.error('Error streaming log file:', err);
            return res.status(500).json({ error: 'Failed to download file' });
          }
        });
      }

      // For filtered time ranges, use the content approach since files are smaller
      const { content } = result;

      // Define log path inside the analysis subfolder with sanitized filename
      const analysisLogsDir = path.join(
        config.paths.analysis,
        sanitizedFileName,
        'logs',
      );

      // Validate that the logs directory is within the expected analysis path
      validatePath(analysisLogsDir, config.paths.analysis);

      await fs.mkdir(analysisLogsDir, { recursive: true });

      // Create a temporary file in the correct logs directory with sanitized filename
      const tempLogFile = path.join(
        analysisLogsDir,
        `${sanitize(path.parse(sanitizedFileName).name)}_${sanitize(timeRange)}_temp.log`,
      );

      // Validate that the temp file path is within the expected directory
      validatePath(tempLogFile, analysisLogsDir);

      try {
        await fs.writeFile(tempLogFile, content);

        // Set the download filename using headers with sanitized name
        const downloadFilename = `${sanitize(path.parse(sanitizedFileName).name)}.log`;
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${downloadFilename}"`,
        );
        res.setHeader('Content-Type', 'text/plain');

        // Send the file using the full tempLogFile path
        res.sendFile(tempLogFile, (err) => {
          // Clean up temp file using the already validated tempLogFile path
          fs.unlink(tempLogFile).catch((unlinkError) => {
            console.error('Error cleaning up temporary file:', unlinkError);
          });

          if (err && !res.headersSent) {
            return res.status(500).json({ error: 'Failed to download file' });
          }
        });
      } catch (writeError) {
        console.error('Error writing temporary file:', writeError);
        return res
          .status(500)
          .json({ error: 'Failed to generate download file' });
      }
    } catch (error) {
      console.error('Download logs error:', error);

      if (error.message.includes('Log file not found')) {
        return res.status(404).json({ error: error.message });
      }

      if (
        error.message.includes('Path traversal') ||
        error.message.includes('Invalid filename')
      ) {
        return res.status(400).json({ error: 'Invalid file path' });
      }

      res.status(500).json({ error: error.message });
    }
  },

  async clearLogs(req, res) {
    try {
      const { fileName } = req.params;

      // Sanitize the fileName to prevent path traversal
      const sanitizedFileName = sanitizeAndValidateFilename(fileName);

      const result = await analysisService.clearLogs(sanitizedFileName);

      // Broadcast logs cleared with the "Log file cleared" message included
      // This avoids race conditions with separate log events
      sseManager.broadcast({
        type: 'logsCleared',
        data: {
          fileName: sanitizedFileName,
          clearMessage: {
            timestamp: new Date().toLocaleString(),
            message: 'Log file cleared',
            level: 'info',
          },
        },
      });

      res.json(result);
    } catch (error) {
      console.error('Clear logs error:', error);

      if (
        error.message.includes('Path traversal') ||
        error.message.includes('Invalid filename')
      ) {
        return res.status(400).json({ error: 'Invalid file path' });
      }

      res.status(500).json({ error: error.message });
    }
  },

  async downloadAnalysis(req, res) {
    try {
      const { fileName } = req.params;
      const { version } = req.query;

      // Sanitize the fileName to prevent path traversal
      const sanitizedFileName = sanitizeAndValidateFilename(fileName);

      let content;
      if (version && version !== '0') {
        // Download specific version
        const versionNumber = parseInt(version, 10);
        if (isNaN(versionNumber) || versionNumber < 1) {
          return res.status(400).json({ error: 'Invalid version number' });
        }
        content = await analysisService.getVersionContent(
          sanitizedFileName,
          versionNumber,
        );
      } else {
        // Download current version
        content = await analysisService.getAnalysisContent(sanitizedFileName);
      }

      // Set the download filename using headers with sanitized name
      const versionSuffix = version && version !== '0' ? `_v${version}` : '';
      const downloadFilename = `${sanitize(sanitizedFileName)}${versionSuffix}.cjs`;
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${downloadFilename}"`,
      );
      res.setHeader('Content-Type', 'application/javascript');

      res.send(content);
    } catch (error) {
      console.error('Download analysis error:', error);

      if (
        error.message.includes('Path traversal') ||
        error.message.includes('Invalid filename') ||
        error.message.includes('not found')
      ) {
        return res.status(400).json({ error: error.message });
      }

      res.status(500).json({ error: error.message });
    }
  },

  async getVersions(req, res) {
    try {
      const { fileName } = req.params;

      // Sanitize the fileName to prevent path traversal
      const sanitizedFileName = sanitizeAndValidateFilename(fileName);

      const versions = await analysisService.getVersions(sanitizedFileName);
      res.json(versions);
    } catch (error) {
      console.error('Get versions error:', error);

      if (
        error.message.includes('Path traversal') ||
        error.message.includes('Invalid filename')
      ) {
        return res.status(400).json({ error: 'Invalid file path' });
      }

      res.status(500).json({ error: error.message });
    }
  },

  async rollbackToVersion(req, res) {
    try {
      const { fileName } = req.params;
      const { version } = req.body;

      // Sanitize the fileName to prevent path traversal
      const sanitizedFileName = sanitizeAndValidateFilename(fileName);

      if (!version || isNaN(parseInt(version, 10))) {
        return res
          .status(400)
          .json({ error: 'Valid version number is required' });
      }

      const versionNumber = parseInt(version, 10);
      const result = await analysisService.rollbackToVersion(
        sanitizedFileName,
        versionNumber,
      );

      // Get updated analysis data
      const analyses = await analysisService.getAllAnalyses();
      const updatedAnalysis = analyses[sanitizedFileName];

      // Broadcast rollback with complete analysis data
      sseManager.broadcast({
        type: 'analysisRolledBack',
        data: {
          fileName: sanitizedFileName,
          version: versionNumber,
          status: 'rolled back',
          restarted: result.restarted,
          ...updatedAnalysis,
        },
      });

      res.json({
        success: true,
        message: `Analysis rolled back to version ${versionNumber}`,
        version: versionNumber,
        restarted: result.restarted,
      });
    } catch (error) {
      console.error('Rollback analysis error:', error);

      if (
        error.message.includes('Path traversal') ||
        error.message.includes('Invalid filename') ||
        error.message.includes('not found')
      ) {
        return res.status(400).json({ error: error.message });
      }

      res.status(500).json({ error: error.message });
    }
  },
};

const environmentController = {
  async updateEnvironment(req, res) {
    try {
      const { fileName } = req.params;
      const { env } = req.body;

      // Sanitize the fileName to prevent path traversal
      const sanitizedFileName = sanitizeAndValidateFilename(fileName);

      if (!env || typeof env !== 'object') {
        return res.status(400).json({
          error: 'Environment variables must be provided as an object',
        });
      }

      const result = await analysisService.updateEnvironment(
        sanitizedFileName,
        env,
      );

      // Get updated analysis data
      const analyses = await analysisService.getAllAnalyses();
      const updatedAnalysis = analyses[sanitizedFileName];

      // Broadcast update with complete analysis data
      sseManager.broadcast({
        type: 'analysisEnvironmentUpdated',
        data: {
          fileName: sanitizedFileName,
          status: 'updated',
          restarted: result.restarted,
          ...updatedAnalysis,
        },
      });

      res.json({
        success: true,
        message: 'Environment updated successfully',
        restarted: result.restarted,
      });
    } catch (error) {
      console.error('Update environment error:', error);

      if (
        error.message.includes('Path traversal') ||
        error.message.includes('Invalid filename')
      ) {
        return res.status(400).json({ error: 'Invalid file path' });
      }

      res.status(500).json({ error: error.message });
    }
  },

  async getEnvironment(req, res) {
    try {
      const { fileName } = req.params;

      // Sanitize the fileName to prevent path traversal
      const sanitizedFileName = sanitizeAndValidateFilename(fileName);

      const env = await analysisService.getEnvironment(sanitizedFileName);
      res.json(env);
    } catch (error) {
      console.error('Get environment error:', error);

      if (
        error.message.includes('Path traversal') ||
        error.message.includes('Invalid filename')
      ) {
        return res.status(400).json({ error: 'Invalid file path' });
      }

      res.status(500).json({ error: error.message });
    }
  },
};

export const {
  uploadAnalysis,
  getAnalyses,
  runAnalysis,
  stopAnalysis,
  deleteAnalysis,
  getAnalysisContent,
  updateAnalysis,
  renameAnalysis,
  getLogs,
  downloadLogs,
  clearLogs,
  downloadAnalysis,
  getVersions,
  rollbackToVersion,
  updateEnvironment,
  getEnvironment,
} = {
  ...analysisController,
  ...environmentController,
};
