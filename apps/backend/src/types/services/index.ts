// src/types/services/index.ts

import {
  Analysis,
  AnalysisLog,
  AnalysisStatus,
  AnalysisUpdateResult,
  ConnectionState,
  EnvironmentVariables,
  LogDownloadResult,
  LogTimeRange,
} from "../shared/analysis.js";

/**
 * Interface for the Analysis Service
 */
export interface IAnalysisService {
  analyses: Map<string, IAnalysisProcess>;
  connectionMonitors: Map<string, IConnectionMonitor>;

  // Initialization
  initialize(): Promise<void>;
  ensureDirectories(): Promise<void>;
  saveConfig(): Promise<void>;

  // Analysis management
  createAnalysisDirectories(analysisName: string): Promise<string>;
  uploadAnalysis(file: any, type: string): Promise<{ analysisName: string }>;
  getRunningAnalyses(): Promise<Analysis[]>;
  runAnalysis(
    analysisName: string,
    type: string,
  ): Promise<{ success: boolean; status: AnalysisStatus; logs: AnalysisLog[] }>;
  stopAnalysis(analysisName: string): Promise<{ success: boolean }>;
  deleteAnalysis(analysisName: string): Promise<{ message: string }>;

  // Analysis content
  getAnalysisContent(analysisName: string): Promise<string>;
  updateAnalysis(
    analysisName: string,
    content: string,
  ): Promise<AnalysisUpdateResult>;
  renameAnalysis(
    analysisName: string,
    newFileName: string,
  ): Promise<AnalysisUpdateResult>;

  // Logs
  addLog(analysisName: string, message: string): Promise<void>;
  getLogs(
    analysisName: string,
    page?: number,
    limit?: number,
  ): Promise<AnalysisLog[]>;
  getLogsForDownload(
    analysisName: string,
    timeRange: LogTimeRange,
  ): Promise<LogDownloadResult>;
  clearLogs(
    analysisName: string,
  ): Promise<{ success: boolean; message: string }>;

  // Environment
  getEnvironment(analysisName: string): Promise<EnvironmentVariables>;
  updateEnvironment(
    analysisName: string,
    env: EnvironmentVariables,
  ): Promise<AnalysisUpdateResult>;
  loadEnvironmentVariables(analysisName: string): Promise<EnvironmentVariables>;

  // Connection management
  getConfig(): Record<string, any>;
  getProcessStatus(analysisName: string): AnalysisStatus;
  updateConnectionState(
    analysisName: string,
    state: ConnectionState,
  ): Promise<void>;
  initializeConnectionMonitor(
    analysisName: string,
    type: string,
  ): Promise<IConnectionMonitor>;
  initializeAnalysis(analysisName: string, analysisConfig?: any): Promise<void>;

  // Validation
  validateTimeRange(timeRange: string): boolean;
}

/**
 * Interface for AnalysisProcess
 */
export interface IAnalysisProcess {
  readonly analysisName: string;
  type: string;
  enabled: boolean;
  status: AnalysisStatus;
  logs: AnalysisLog[];
  process: any;
  lastRun: string | null;
  startTime: string | null;
  logFile: string;
  connectionState?: ConnectionState;

  // Methods
  start(): Promise<void>;
  stop(): Promise<void>;
  addLog(message: string): Promise<void>;
  updateStatus(status: AnalysisStatus, enabled?: boolean): void;
  saveConfig(): Promise<void>;
}

/**
 * Interface for ConnectionMonitor
 */
export interface IConnectionMonitor {
  fileName: string;
  type: string;
  checkInterval: number;
  connectionState: ConnectionState;

  // Methods
  startMonitoring(): void;
  stopMonitoring(): void;
  checkConnection(): Promise<boolean>;
  handleConnectionChange(isConnected: boolean): Promise<void>;
}

/**
 * Interface for MachineQ API Service
 */
export interface IMachineQService {
  getAPIVersion(): Promise<any>;
  getToken(clientId: string, clientSecret: string): Promise<string>;
  getAPICall(endpoint: string, token: string): Promise<any>;
  getDevices(token: string): Promise<any>;
  getGateways(token: string): Promise<any>;
  getAccount(token: string): Promise<any>;
  createDevice(token: string, deviceData: any): Promise<any>;
}
