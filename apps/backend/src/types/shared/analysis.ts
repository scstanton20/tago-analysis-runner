// src/types/shared/analysis.ts

/**
 * Status options for an analysis
 */
export type AnalysisStatus = "running" | "stopped" | "updated";

/**
 * Represents an Analysis in the system
 */
export interface Analysis {
  name: string;
  type: string;
  status: AnalysisStatus;
  enabled: boolean;
  lastRun?: string | null;
  startTime?: string | null;
  size?: number;
  created?: Date;
}

/**
 * Extended Analysis interface with logs
 */
export interface AnalysisWithLogs extends Analysis {
  logs: AnalysisLog[];
}

/**
 * Analysis log entry
 */
export interface AnalysisLog {
  timestamp: string;
  message: string;
}

/**
 * Result of updating an analysis
 */
export interface AnalysisUpdateResult {
  success: boolean;
  restarted: boolean;
  message?: string;
}

/**
 * Environment variables for an analysis
 */
export interface EnvironmentVariables {
  [key: string]: string;
}

/**
 * Connection state for an analysis
 */
export interface ConnectionState {
  shouldRestart: boolean;
  disconnectedAt: string | null;
  wasRunning: boolean;
  history: {
    lastDisconnected: string | null;
    lastRestored: string | null;
  };
}

/**
 * Valid time ranges for log retrieval
 */
export type LogTimeRange = "1h" | "24h" | "7d" | "30d" | "all";

/**
 * Log download result
 */
export interface LogDownloadResult {
  logFile: string;
  content: string;
}
