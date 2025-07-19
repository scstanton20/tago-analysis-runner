import path from 'path';
import { promises as fs } from 'fs';
import config from '../config/default.js';
import { encrypt, decrypt } from '../utils/cryptoUtils.js';
import AnalysisProcess from '../models/analysisProcess.js';
import teamService from './teamService.js';

/**
 * Format file size in bytes to human readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size (e.g., "1.5 MB")
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Service class for managing analysis files, processes, and configurations
 * Handles CRUD operations, file management, logging, and department integration
 */
class AnalysisService {
  constructor() {
    /** @type {Map<string, AnalysisProcess>} Map of analysis name to process instance */
    this.analyses = new Map();
    /** @type {Object|null} Cached configuration object */
    this.configCache = null;
    /** @type {string} Path to the configuration file */
    this.configPath = path.join(config.paths.config, 'analyses-config.json');
  }

  validateTimeRange(timeRange) {
    const validRanges = ['1h', '24h', '7d', '30d', 'all'];
    return validRanges.includes(timeRange);
  }
  /**
   * Ensure required directories exist
   * @returns {Promise<void>}
   * @throws {Error} If directory creation fails
   */
  async ensureDirectories() {
    await fs.mkdir(config.paths.analysis, { recursive: true });
    await fs.mkdir(config.paths.config, { recursive: true });
  }

  /**
   * Get complete configuration including departments and analyses
   * @returns {Promise<Object>} Configuration object with version, departments, and analyses
   */
  async getConfig() {
    if (!this.configCache) {
      await this.loadConfig();
    }
    return { ...this.configCache };
  }

  /**
   * Update complete configuration while preserving existing AnalysisProcess instances
   * This method updates the configuration without destroying in-memory AnalysisProcess instances,
   * ensuring that running analyses and their state are preserved during department moves and other config updates.
   *
   * @param {Object} config - Configuration object to update
   * @param {string} config.version - Configuration version
   * @param {Object} config.analyses - Analyses configuration with updated properties
   * @returns {Promise<void>}
   * @throws {Error} If config update fails
   */
  async updateConfig(config) {
    this.configCache = { ...config };
    if (config.analyses) {
      this.analyses.forEach((analysis, name) => {
        if (config.analyses[name] && analysis instanceof AnalysisProcess) {
          // Update properties of existing AnalysisProcess instance
          analysis.type = config.analyses[name].type;
          analysis.enabled = config.analyses[name].enabled;
          analysis.status = config.analyses[name].status;
          analysis.lastStartTime = config.analyses[name].lastStartTime;
          analysis.teamId = config.analyses[name].teamId;
        }
      });

      // Remove analyses that no longer exist in config
      for (const [name] of this.analyses) {
        if (!config.analyses[name]) {
          this.analyses.delete(name);
        }
      }

      Object.entries(config.analyses).forEach(([name, analysisConfig]) => {
        if (!this.analyses.has(name)) {
          this.analyses.set(name, analysisConfig);
        }
      });
    }

    await this.saveConfig();
  }

  /**
   * Save current configuration to file
   * @returns {Promise<void>}
   * @throws {Error} If file write fails
   */
  async saveConfig() {
    const configuration = {
      version: this.configCache?.version || '3.0',
      analyses: {},
    };

    this.analyses.forEach((analysis, analysisName) => {
      configuration.analyses[analysisName] = {
        type: analysis.type,
        enabled: analysis.enabled,
        status: analysis.status,
        lastStartTime: analysis.lastStartTime,
        teamId: analysis.teamId,
      };
    });

    await fs.writeFile(this.configPath, JSON.stringify(configuration, null, 2));

    this.configCache = configuration;
  }

  /**
   * Load configuration from file or create default if not exists
   * @returns {Promise<Object>} Loaded configuration object
   * @throws {Error} If file read fails (except ENOENT)
   */
  async loadConfig() {
    try {
      const data = await fs.readFile(this.configPath, 'utf8');
      const config = JSON.parse(data);

      // Store the full config including departments
      this.configCache = config;

      // Load analyses into the Map
      this.analyses.clear();
      if (config.analyses) {
        Object.entries(config.analyses).forEach(([name, analysis]) => {
          this.analyses.set(name, analysis);
        });
      }

      console.log('Configuration loaded with departments');
      return config;
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('No existing config file, creating new one');
        this.configCache = {
          version: '3.0',
          analyses: {},
        };
        await this.saveConfig();
        return this.configCache;
      } else {
        throw error;
      }
    }
  }

  /**
   * Create directory structure for a new analysis
   * @param {string} analysisName - Name of the analysis
   * @returns {Promise<string>} Base path of created directories
   * @throws {Error} If directory creation fails
   */
  async createAnalysisDirectories(analysisName) {
    const basePath = path.join(config.paths.analysis, analysisName);
    await Promise.all([
      fs.mkdir(basePath, { recursive: true }),
      fs.mkdir(path.join(basePath, 'env'), { recursive: true }),
      fs.mkdir(path.join(basePath, 'logs'), { recursive: true }),
      fs.mkdir(path.join(basePath, 'versions'), { recursive: true }),
    ]);
    return basePath;
  }

  /**
   * Upload and register a new analysis file
   * @param {Object} file - File object with name and mv method
   * @param {string} file.name - Original filename
   * @param {Function} file.mv - Method to move file to destination
   * @param {string} type - Type of analysis (e.g., 'listener')
   * @param {string|null} [targetDepartment=null] - Department to assign analysis to (null means uncategorized)
   * @returns {Promise<Object>} Object with analysisName property
   * @throws {Error} If upload or registration fails
   */
  async uploadAnalysis(file, type, targetDepartment = null) {
    const analysisName = path.parse(file.name).name;
    const basePath = await this.createAnalysisDirectories(analysisName);
    const filePath = path.join(basePath, 'index.cjs');

    await file.mv(filePath);
    const analysis = new AnalysisProcess(analysisName, type, this);

    // Always set team ID - use 'uncategorized' as default if not specified
    analysis.teamId = targetDepartment || 'uncategorized';

    this.analyses.set(analysisName, analysis);

    const envFile = path.join(basePath, 'env', '.env');
    await fs.writeFile(envFile, '', 'utf8');

    await this.saveConfig();

    // Initialize version management
    await this.initializeVersionManagement(analysisName);

    // Ensure department tracking
    await teamService.ensureAnalysisHasTeam(analysisName);

    return { analysisName };
  }

  /**
   * Initialize version management for a new analysis
   * @param {string} analysisName - Name of the analysis
   * @returns {Promise<void>}
   */
  async initializeVersionManagement(analysisName) {
    const versionsDir = path.join(
      config.paths.analysis,
      analysisName,
      'versions',
    );
    const metadataPath = path.join(versionsDir, 'metadata.json');
    const currentFilePath = path.join(
      config.paths.analysis,
      analysisName,
      'index.cjs',
    );

    // Create versions directory
    await fs.mkdir(versionsDir, { recursive: true });

    // Read the uploaded content and save it as v1
    const uploadedContent = await fs.readFile(currentFilePath, 'utf8');
    const v1Path = path.join(versionsDir, 'v1.cjs');
    await fs.writeFile(v1Path, uploadedContent, 'utf8');

    // Create metadata - uploaded file is version 1
    const metadata = {
      versions: [
        {
          version: 1,
          timestamp: new Date().toISOString(),
          size: Buffer.byteLength(uploadedContent, 'utf8'),
        },
      ],
      nextVersionNumber: 2,
      currentVersion: 1,
    };

    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
  }

  /**
   * Get all analyses with their metadata and department information
   * @returns {Promise<Object>} Object mapping analysis names to their metadata
   * @throws {Error} If directory read or file stat fails
   */
  async getAllAnalyses() {
    const analysisDirectories = await fs.readdir(config.paths.analysis);

    const results = await Promise.all(
      analysisDirectories.map(async (dirName) => {
        const indexPath = path.join(
          config.paths.analysis,
          dirName,
          'index.cjs',
        );
        try {
          const stats = await fs.stat(indexPath);
          const analysis = this.analyses.get(dirName);

          if (!this.analyses.has(dirName)) {
            this.analyses.set(dirName, analysis);
          }

          return {
            name: dirName,
            size: formatFileSize(stats.size),
            created: stats.birthtime,
            type: 'listener',
            status: analysis?.status || 'stopped',
            enabled: analysis?.enabled || false,
            lastStartTime: analysis?.lastStartTime,
            teamId: analysis?.teamId,
          };
        } catch (error) {
          if (error.code === 'ENOENT') return null;
          throw error;
        }
      }),
    );

    // Return as object to match WebSocket expectations
    const analysesObj = {};
    results.filter(Boolean).forEach((analysis) => {
      analysesObj[analysis.name] = analysis;
    });

    return analysesObj;
  }

  /**
   * Rename an analysis file and update all references
   * @param {string} analysisName - Current name of the analysis
   * @param {string} newFileName - New name for the analysis
   * @returns {Promise<Object>} Object with success status and restart information
   * @throws {Error} If analysis not found, target exists, or rename fails
   */
  async renameAnalysis(analysisName, newFileName) {
    try {
      const analysis = this.analyses.get(analysisName);

      if (!analysis) {
        throw new Error(`Analysis '${analysisName}' not found`);
      }

      const wasRunning = analysis && analysis.status === 'running';

      // If running, stop the analysis first
      if (wasRunning) {
        await this.stopAnalysis(analysisName);
        await this.addLog(
          analysisName,
          'Stopping analysis for rename operation',
        );
      }

      // Rename the directory
      const oldFilePath = path.join(config.paths.analysis, analysisName);
      const newFilePath = path.join(config.paths.analysis, newFileName);

      // Make sure the target directory doesn't already exist
      try {
        await fs.access(newFilePath);
        throw new Error(
          `Cannot rename: target '${newFileName}' already exists`,
        );
      } catch (err) {
        if (err.code !== 'ENOENT') throw err;
      }

      // Perform the rename
      await fs.rename(oldFilePath, newFilePath);

      // Update the analysis object and maps
      this.analyses.delete(analysisName);

      // Use the setter to update the name (which updates the logFile path)
      analysis.analysisName = newFileName;

      // Add the analysis with the new name
      this.analyses.set(newFileName, analysis);

      // Log the rename operation
      await this.addLog(
        newFileName,
        `Analysis renamed from '${analysisName}' to '${newFileName}'`,
      );

      // Save updated config to analyses-config.json
      await this.saveConfig();

      // Update department tracking properly through the department service
      await teamService.ensureAnalysisHasTeam(newFileName);

      // If it was running before, restart it
      if (wasRunning) {
        await this.runAnalysis(newFileName, analysis.type);
        await this.addLog(
          newFileName,
          'Analysis restarted after rename operation',
        );
      }

      return {
        success: true,
        restarted: wasRunning,
      };
    } catch (error) {
      console.error('Error renaming analysis:', error);
      throw new Error(`Failed to rename analysis: ${error.message}`);
    }
  }

  /**
   * Add a log entry to an analysis
   * @param {string} analysisName - Name of the analysis
   * @param {string} message - Log message to add
   * @returns {Promise<void>}
   */
  async addLog(analysisName, message) {
    const analysis = this.analyses.get(analysisName);
    if (analysis) {
      await analysis.addLog(message);
    }
  }

  /**
   * Get initial logs for WebSocket connection with pagination
   * @param {string} analysisName - Name of the analysis
   * @param {number} [limit=50] - Maximum number of log entries to return
   * @returns {Promise<Object>} Object with logs array and total count
   */
  async getInitialLogs(analysisName, limit = 50) {
    const analysis = this.analyses.get(analysisName);
    if (!analysis) {
      return { logs: [], totalCount: 0 };
    }

    const result = analysis.getMemoryLogs(1, limit);
    return {
      logs: result.logs,
      totalCount: result.totalCount,
    };
  }

  /**
   * Clear all logs for an analysis
   * @param {string} analysisName - Name of the analysis
   * @returns {Promise<Object>} Success result object
   * @throws {Error} If analysis not found or log clear fails
   */
  async clearLogs(analysisName) {
    try {
      const analysis = this.analyses.get(analysisName);
      if (!analysis) {
        throw new Error('Analysis not found');
      }

      const logFilePath = path.join(
        config.paths.analysis,
        analysisName,
        'logs',
        'analysis.log',
      );

      // Clear file
      await fs.writeFile(logFilePath, '', 'utf8');

      // Reset in-memory state
      analysis.logs = [];
      analysis.logSequence = 0;
      analysis.totalLogCount = 0;

      // Log entry is now handled by the controller's SSE broadcast

      return { success: true, message: 'Logs cleared successfully' };
    } catch (error) {
      console.error('Error clearing logs:', error);
      throw new Error(`Failed to clear logs: ${error.message}`);
    }
  }

  /**
   * Get the current status of an analysis process
   * @param {string} analysisName - Name of the analysis
   * @returns {string} Current status ('running', 'stopped', etc.)
   */
  getProcessStatus(analysisName) {
    const analysis = this.analyses.get(analysisName);
    return analysis ? analysis.status : 'stopped';
  }

  /**
   * Start/run an analysis process
   * @param {string} analysisName - Name of the analysis to run
   * @param {string} [type='listener'] - Type of analysis (default: 'listener')
   * @returns {Promise<Object>} Result object with success status and analysis info
   * @throws {Error} If analysis start fails
   */
  async runAnalysis(analysisName, type = 'listener') {
    let analysis = this.analyses.get(analysisName);

    if (!analysis) {
      console.log(`Creating new analysis instance: ${analysisName}`);
      // Fix: Pass type and service parameters correctly
      analysis = new AnalysisProcess(analysisName, type, this);
      this.analyses.set(analysisName, analysis);
      await this.saveConfig();
    }

    await analysis.start();
    return { success: true, status: analysis.status, logs: analysis.logs };
  }

  /**
   * Stop a running analysis process
   * @param {string} analysisName - Name of the analysis to stop
   * @returns {Promise<Object>} Success result object
   * @throws {Error} If analysis not found or stop fails
   */
  async stopAnalysis(analysisName) {
    const analysis = this.analyses.get(analysisName);
    if (!analysis) {
      throw new Error('Analysis not found');
    }

    await analysis.stop();
    return { success: true };
  }

  /**
   * Get paginated logs for an analysis
   * @param {string} analysisName - Name of the analysis
   * @param {number} [page=1] - Page number for pagination
   * @param {number} [limit=100] - Number of log entries per page
   * @returns {Promise<Object>} Object with logs, pagination info, and source
   * @throws {Error} If analysis not found
   */
  async getLogs(analysisName, page = 1, limit = 100) {
    const analysis = this.analyses.get(analysisName);

    if (!analysis) {
      throw new Error('Analysis not found');
    }

    // For page 1, try memory first
    if (page === 1) {
      const memoryResult = analysis.getMemoryLogs(page, limit);
      if (memoryResult.logs.length > 0) {
        return {
          logs: memoryResult.logs,
          hasMore: memoryResult.totalCount > limit,
          totalCount: memoryResult.totalCount,
          source: 'memory',
        };
      }
    }

    // For page 2+ or if no memory logs, always use file reading
    return this.getLogsFromFile(analysisName, page, limit);
  }

  /**
   * Get paginated logs from file system
   * @param {string} analysisName - Name of the analysis
   * @param {number} [page=1] - Page number for pagination
   * @param {number} [limit=100] - Number of log entries per page
   * @returns {Promise<Object>} Object with logs, pagination info, and source
   * @throws {Error} If file read fails (except ENOENT)
   */
  async getLogsFromFile(analysisName, page = 1, limit = 100) {
    try {
      const logFile = path.join(
        config.paths.analysis,
        analysisName,
        'logs',
        'analysis.log',
      );

      const content = await fs.readFile(logFile, 'utf8');
      if (!content.trim()) {
        return { logs: [], hasMore: false, totalCount: 0, source: 'file' };
      }

      const allLogs = content
        .trim()
        .split('\n')
        .map((line, index) => {
          const match = line.match(/\[(.*?)\] (.*)/);
          return match
            ? {
                sequence: index + 1,
                timestamp: match[1],
                message: match[2],
                createdAt: new Date(match[1]).getTime(),
              }
            : null;
        })
        .filter(Boolean)
        .reverse(); // Most recent first

      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedLogs = allLogs.slice(startIndex, endIndex);

      return {
        logs: paginatedLogs,
        hasMore: endIndex < allLogs.length,
        totalCount: allLogs.length,
        source: 'file',
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { logs: [], hasMore: false, totalCount: 0, source: 'file' };
      }
      throw new Error(`Failed to retrieve logs: ${error.message}`);
    }
  }

  /**
   * Delete an analysis and all its associated files (including all versions)
   * @param {string} analysisName - Name of the analysis to delete
   * @returns {Promise<Object>} Success message object
   * @throws {Error} If deletion fails (except ENOENT)
   */
  async deleteAnalysis(analysisName) {
    const analysis = this.analyses.get(analysisName);
    if (analysis) {
      await analysis.stop();
    }

    const analysisPath = path.join(config.paths.analysis, analysisName);
    try {
      // This will delete the entire analysis directory including versions folder
      await fs.rm(analysisPath, { recursive: true, force: true });
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }

    this.analyses.delete(analysisName);
    await this.saveConfig();

    return { message: 'Analysis and all versions deleted successfully' };
  }

  /**
   * Initialize the analysis service and load existing analyses
   * @returns {Promise<void>}
   * @throws {Error} If initialization fails
   */
  async initialize() {
    await this.ensureDirectories();

    const configuration = await this.loadConfig();

    // Initialize department service after config is loaded
    await teamService.initialize(this);

    const analysisDirectories = await fs.readdir(config.paths.analysis);
    await Promise.all(
      analysisDirectories.map(async (dirName) => {
        try {
          const indexPath = path.join(
            config.paths.analysis,
            dirName,
            'index.cjs',
          );
          const stats = await fs.stat(indexPath);
          if (stats.isFile()) {
            await this.initializeAnalysis(
              dirName,
              configuration.analyses?.[dirName],
            );
          }
        } catch (error) {
          console.error(`Error loading analysis ${dirName}:`, error);
        }
      }),
    );
  }

  /**
   * Get the source code content of an analysis file
   * @param {string} analysisName - Name of the analysis
   * @returns {Promise<string>} Content of the analysis file
   * @throws {Error} If file read fails
   */
  async getAnalysisContent(analysisName) {
    try {
      const filePath = path.join(
        config.paths.analysis,
        analysisName,
        'index.cjs',
      );
      const content = await fs.readFile(filePath, 'utf8');
      return content;
    } catch (error) {
      console.error('Error reading analysis content:', error);
      throw new Error(`Failed to get analysis content: ${error.message}`);
    }
  }

  /**
   * Save a version of the analysis before updating (only if content is truly new)
   * @param {string} analysisName - Name of the analysis
   * @returns {Promise<number|null>} Version number of the saved version, or null if no save was needed
   */
  async saveVersion(analysisName) {
    const versionsDir = path.join(
      config.paths.analysis,
      analysisName,
      'versions',
    );
    const metadataPath = path.join(versionsDir, 'metadata.json');
    const currentFilePath = path.join(
      config.paths.analysis,
      analysisName,
      'index.cjs',
    );

    // Ensure versions directory exists
    await fs.mkdir(versionsDir, { recursive: true });

    // Load or create metadata
    let metadata = { versions: [], nextVersionNumber: 1, currentVersion: 0 };
    let isFirstVersionSave = false;
    try {
      const metadataContent = await fs.readFile(metadataPath, 'utf8');
      metadata = JSON.parse(metadataContent);
      // Ensure currentVersion exists for backward compatibility
      if (metadata.currentVersion === undefined) {
        metadata.currentVersion =
          metadata.versions.length > 0
            ? metadata.versions[metadata.versions.length - 1].version
            : 1;
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        // This is a pre-versioning analysis being saved for the first time
        isFirstVersionSave = true;
      } else {
        throw error;
      }
    }

    // Read current content
    const currentContent = await fs.readFile(currentFilePath, 'utf8');

    // Check if current content matches ANY existing saved version
    for (const version of metadata.versions) {
      try {
        const versionFilePath = path.join(
          versionsDir,
          `v${version.version}.cjs`,
        );
        const versionContent = await fs.readFile(versionFilePath, 'utf8');
        if (currentContent === versionContent) {
          // Content already exists as a saved version, no need to save again
          return null;
        }
      } catch {
        // If we can't read a version file, continue checking others
        continue;
      }
    }

    // Content is truly new, save it as the next version
    const newVersionNumber = isFirstVersionSave
      ? 1
      : metadata.nextVersionNumber;
    const versionFilePath = path.join(versionsDir, `v${newVersionNumber}.cjs`);
    await fs.writeFile(versionFilePath, currentContent, 'utf8');

    // Update metadata - add the new version and increment counter
    metadata.versions.push({
      version: newVersionNumber,
      timestamp: new Date().toISOString(),
      size: Buffer.byteLength(currentContent, 'utf8'),
    });

    // Set proper values for next version and current version
    if (isFirstVersionSave) {
      metadata.nextVersionNumber = 2;
      metadata.currentVersion = 1;
    } else {
      metadata.nextVersionNumber = metadata.nextVersionNumber + 1;
      metadata.currentVersion = newVersionNumber;
    }

    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');

    return newVersionNumber;
  }

  /**
   * Get all versions for an analysis
   * @param {string} analysisName - Name of the analysis
   * @returns {Promise<Object>} Metadata with versions list and current version
   */
  async getVersions(analysisName) {
    const metadataPath = path.join(
      config.paths.analysis,
      analysisName,
      'versions',
      'metadata.json',
    );
    const currentFilePath = path.join(
      config.paths.analysis,
      analysisName,
      'index.cjs',
    );

    try {
      const metadataContent = await fs.readFile(metadataPath, 'utf8');
      const metadata = JSON.parse(metadataContent);
      // Ensure currentVersion exists for backward compatibility
      if (metadata.currentVersion === undefined) {
        metadata.currentVersion = metadata.nextVersionNumber - 1;
      }

      // Check if the current index.cjs content matches any saved version
      try {
        const currentContent = await fs.readFile(currentFilePath, 'utf8');
        let currentContentMatchesVersion = false;

        // Check against all saved versions
        for (const version of metadata.versions) {
          try {
            const versionFilePath = path.join(
              config.paths.analysis,
              analysisName,
              'versions',
              `v${version.version}.cjs`,
            );
            const versionContent = await fs.readFile(versionFilePath, 'utf8');
            if (currentContent === versionContent) {
              // Current content matches this saved version
              metadata.currentVersion = version.version;
              currentContentMatchesVersion = true;
              break;
            }
          } catch {
            // If we can't read a version file, continue checking others
            continue;
          }
        }

        // If current content doesn't match any saved version, it's the next version
        if (!currentContentMatchesVersion) {
          metadata.currentVersion = metadata.nextVersionNumber;
        }
      } catch {
        // If we can't read the current file, fall back to metadata currentVersion
      }

      return metadata;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { versions: [], nextVersionNumber: 2, currentVersion: 1 };
      }
      throw error;
    }
  }

  /**
   * Rollback analysis to a specific version
   * @param {string} analysisName - Name of the analysis
   * @param {number} version - Version number to rollback to
   * @returns {Promise<Object>} Result with success status and restart info
   */
  async rollbackToVersion(analysisName, version) {
    const analysis = this.analyses.get(analysisName);
    if (!analysis) {
      throw new Error(`Analysis ${analysisName} not found`);
    }

    const versionsDir = path.join(
      config.paths.analysis,
      analysisName,
      'versions',
    );
    const versionFilePath = path.join(versionsDir, `v${version}.cjs`);
    const currentFilePath = path.join(
      config.paths.analysis,
      analysisName,
      'index.cjs',
    );
    const metadataPath = path.join(versionsDir, 'metadata.json');

    // Check if version exists
    try {
      await fs.access(versionFilePath);
    } catch {
      throw new Error(`Version ${version} not found`);
    }

    const wasRunning = analysis.status === 'running';

    // Stop analysis if running
    if (wasRunning) {
      await this.stopAnalysis(analysisName);
      await this.addLog(
        analysisName,
        `Analysis stopped to rollback to version ${version}`,
      );
    }

    // Save current content before rollback if it's different from all existing versions
    await this.saveVersion(analysisName);

    // Replace current file with the target version content
    const versionContent = await fs.readFile(versionFilePath, 'utf8');
    await fs.writeFile(currentFilePath, versionContent, 'utf8');

    // Update metadata to track current version after rollback
    const metadata = await this.getVersions(analysisName);
    metadata.currentVersion = version;
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');

    // Clear logs
    await this.clearLogs(analysisName);
    await this.addLog(analysisName, `Rolled back to version ${version}`);

    // Restart if it was running
    if (wasRunning) {
      await this.runAnalysis(analysisName, analysis.type);
      // Small delay to ensure the restart log is visible
      await new Promise((resolve) => setTimeout(resolve, 100));
      await this.addLog(analysisName, 'Analysis restarted after rollback');
    }

    return {
      success: true,
      restarted: wasRunning,
      version: version,
    };
  }

  /**
   * Get content of a specific version
   * @param {string} analysisName - Name of the analysis
   * @param {number} version - Version number (0 for current)
   * @returns {Promise<string>} Content of the version
   */
  async getVersionContent(analysisName, version) {
    if (version === 0) {
      // Return current version
      const currentFilePath = path.join(
        config.paths.analysis,
        analysisName,
        'index.cjs',
      );
      return fs.readFile(currentFilePath, 'utf8');
    }

    const versionFilePath = path.join(
      config.paths.analysis,
      analysisName,
      'versions',
      `v${version}.cjs`,
    );
    try {
      return await fs.readFile(versionFilePath, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Version ${version} not found`);
      }
      throw error;
    }
  }

  /**
   * Update analysis properties and/or content
   * @param {string} analysisName - Name of the analysis to update
   * @param {Object} updates - Updates to apply
   * @param {string} [updates.content] - New content for the analysis file
   * @param {string} [updates.teamId] - New team for the analysis
   * @param {boolean} [updates.enabled] - Enable/disable status
   * @returns {Promise<Object>} Update result with success status and restart info
   * @throws {Error} If analysis not found, department invalid, or update fails
   */
  async updateAnalysis(analysisName, updates) {
    try {
      const analysis = this.analyses.get(analysisName);

      if (!analysis) {
        throw new Error(`Analysis ${analysisName} not found`);
      }

      // If team is being updated, validate it exists
      if (updates.teamId) {
        const team = await teamService.getTeam(updates.teamId);
        if (!team) {
          throw new Error(`Team ${updates.teamId} not found`);
        }
      }

      const wasRunning = analysis && analysis.status === 'running';
      let savedVersion = null;

      // If running and content is being updated, stop the analysis first
      if (wasRunning && updates.content) {
        await this.stopAnalysis(analysisName);
        await this.addLog(analysisName, 'Analysis stopped to update content');
      }

      // Save current version before updating content (only if current content is truly new)
      if (updates.content) {
        savedVersion = await this.saveVersion(analysisName);
        const filePath = path.join(
          config.paths.analysis,
          analysisName,
          'index.cjs',
        );
        await fs.writeFile(filePath, updates.content, 'utf8');

        // Update currentVersion based on what happened
        if (savedVersion !== null) {
          // We saved a new version, currentVersion is already updated by saveVersion
        } else {
          // No new version was saved, check if the new content matches any existing version
          const metadata = await this.getVersions(analysisName);
          for (const version of metadata.versions) {
            try {
              const versionFilePath = path.join(
                config.paths.analysis,
                analysisName,
                'versions',
                `v${version.version}.cjs`,
              );
              const versionContent = await fs.readFile(versionFilePath, 'utf8');
              if (updates.content === versionContent) {
                // New content matches existing version, update currentVersion
                metadata.currentVersion = version.version;
                const metadataPath = path.join(
                  config.paths.analysis,
                  analysisName,
                  'versions',
                  'metadata.json',
                );
                await fs.writeFile(
                  metadataPath,
                  JSON.stringify(metadata, null, 2),
                  'utf8',
                );
                break;
              }
            } catch {
              continue;
            }
          }
        }
      }

      // Update analysis properties
      Object.assign(analysis, updates);
      this.analyses.set(analysisName, analysis);
      await this.saveConfig();

      // If it was running before and content was updated, restart it
      if (wasRunning && updates.content) {
        await this.runAnalysis(analysisName, analysis.type);
        const logMessage =
          savedVersion !== null
            ? `Analysis updated successfully (previous version saved as v${savedVersion})`
            : 'Analysis updated successfully (no version saved - content unchanged)';
        await this.addLog(analysisName, logMessage);
      }

      return {
        success: true,
        restarted: wasRunning && updates.content,
        savedVersion: savedVersion,
      };
    } catch (error) {
      console.error('Error updating analysis:', error);
      throw new Error(`Failed to update analysis: ${error.message}`);
    }
  }

  /**
   * Get filtered logs for download based on time range
   * @param {string} analysisName - Name of the analysis
   * @param {string} timeRange - Time range filter ('1h', '24h', '7d', '30d', 'all')
   * @returns {Promise<Object>} Object with logFile path and filtered content
   * @throws {Error} If analysis not found, file doesn't exist, or invalid time range
   */
  async getLogsForDownload(analysisName, timeRange) {
    try {
      const logFile = path.join(
        config.paths.analysis,
        analysisName,
        'logs',
        'analysis.log',
      );

      // Ensure the log file exists
      await fs.access(logFile);

      const content = await fs.readFile(logFile, 'utf8');
      const lines = content.trim().split('\n');

      if (timeRange === 'all') {
        return { logFile, content };
      }

      // Filter logs based on timestamp
      const cutoffDate = new Date();
      switch (timeRange) {
        case '1h':
          cutoffDate.setHours(cutoffDate.getHours() - 1);
          break;
        case '24h':
          cutoffDate.setHours(cutoffDate.getHours() - 24);
          break;
        case '7d':
          cutoffDate.setDate(cutoffDate.getDate() - 7);
          break;
        case '30d':
          cutoffDate.setDate(cutoffDate.getDate() - 30);
          break;
        default:
          throw new Error('Invalid time range specified');
      }

      const filteredLogs = lines.filter((line) => {
        const timestampMatch = line.match(/\[(.*?)\]/);
        if (timestampMatch) {
          const logDate = new Date(timestampMatch[1]);
          return logDate >= cutoffDate;
        }
        return false;
      });

      return { logFile, content: filteredLogs.join('\n') };
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Log file not found for analysis: ${analysisName}`);
      }
      throw error;
    }
  }

  /**
   * Get decrypted environment variables for an analysis
   * @param {string} analysisName - Name of the analysis
   * @returns {Promise<Object>} Object with decrypted environment variables
   * @throws {Error} If file read or decryption fails (except ENOENT)
   */
  async getEnvironment(analysisName) {
    const envFile = path.join(
      config.paths.analysis,
      analysisName,
      'env',
      '.env',
    );
    try {
      const envContent = await fs.readFile(envFile, 'utf8');
      const envVariables = {};
      envContent.split('\n').forEach((line) => {
        const [key, encryptedValue] = line.split('=');
        if (key && encryptedValue) {
          envVariables[key] = decrypt(encryptedValue);
        }
      });
      return envVariables;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return {}; // Return an empty object if the env file does not exist
      }
      throw error;
    }
  }

  /**
   * Update environment variables for an analysis
   * @param {string} analysisName - Name of the analysis
   * @param {Object} env - Environment variables object to encrypt and save
   * @returns {Promise<Object>} Update result with success status and restart info
   * @throws {Error} If analysis not found or environment update fails
   */
  async updateEnvironment(analysisName, env) {
    const envFile = path.join(
      config.paths.analysis,
      analysisName,
      'env',
      '.env',
    );
    const analysis = this.analyses.get(analysisName);
    const wasRunning = analysis && analysis.status === 'running';

    try {
      // If running, stop the analysis first
      if (wasRunning) {
        await this.stopAnalysis(analysisName);
        await this.addLog(
          analysisName,
          'Analysis stopped to update environment',
        );
      }

      const envContent = Object.entries(env)
        .map(([key, value]) => `${key}=${encrypt(value)}`)
        .join('\n');

      await fs.mkdir(path.dirname(envFile), { recursive: true });
      await fs.writeFile(envFile, envContent, 'utf8');

      // If it was running before, restart it
      if (wasRunning) {
        await this.runAnalysis(analysisName, analysis.type);
        await this.addLog(analysisName, 'Analysis updated successfully');
      }

      return {
        success: true,
        restarted: wasRunning,
      };
    } catch (error) {
      console.error('Error updating environment:', error);
      throw new Error(`Failed to update environment: ${error.message}`);
    }
  }

  /**
   * Initialize an analysis instance with configuration
   * @param {string} analysisName - Name of the analysis
   * @param {Object} [analysisConfig={}] - Configuration object for the analysis
   * @param {string} [analysisConfig.type='listener'] - Type of analysis
   * @param {boolean} [analysisConfig.enabled=false] - Whether analysis is enabled
   * @param {string} [analysisConfig.status='stopped'] - Current status
   * @param {string|null} [analysisConfig.lastStartTime=null] - Last start timestamp
   * @param {string} [analysisConfig.teamId] - Team assignment
   * @returns {Promise<void>}
   */
  async initializeAnalysis(analysisName, analysisConfig = {}) {
    const defaultConfig = {
      type: 'listener',
      enabled: false,
      status: 'stopped',
      lastStartTime: null,
      teamId: null, // Will be set to Uncategorized team if not specified
    };

    const fullConfig = { ...defaultConfig, ...analysisConfig };
    const analysis = new AnalysisProcess(analysisName, fullConfig.type, this);

    Object.assign(analysis, {
      enabled: fullConfig.enabled,
      status: fullConfig.status,
      lastStartTime: fullConfig.lastStartTime,
      teamId: fullConfig.teamId,
    });

    // Initialize log state (this replaces the old log loading logic)
    await analysis.initializeLogState();

    this.analyses.set(analysisName, analysis);
  }
}

// Create and export a singleton instance
const analysisService = new AnalysisService();
export { analysisService, initializeAnalyses };

/**
 * Initialize the analysis service singleton
 * @returns {Promise<void>} Promise that resolves when initialization is complete
 * @throws {Error} If initialization fails
 */
function initializeAnalyses() {
  return analysisService.initialize();
}
