// src/types/config/index.ts

/**
 * Application path configuration
 */
export interface PathsConfig {
  analysis: string;
  config: string;
  logs: string;
}

/**
 * File configuration
 */
export interface FilesConfig {
  config: string;
}

/**
 * Process environment configuration
 */
export interface ProcessConfig {
  env: Record<string, string>;
}

/**
 * Storage configuration
 */
export interface StorageConfig {
  base: string;
  createDirs: boolean;
}

/**
 * Analysis configuration
 */
export interface AnalysisConfig {
  maxLogsInMemory: number;
  autoRestartDelay: number;
  forceKillTimeout: number;
}

/**
 * Full application configuration
 */
export interface AppConfig {
  env: string;
  paths: PathsConfig;
  files: FilesConfig;
  process: ProcessConfig;
  storage: StorageConfig;
  analysis: AnalysisConfig;
}

/**
 * Analysis persisted configuration
 */
export interface AnalysisPersistConfig {
  [key: string]: {
    type: string;
    enabled: boolean;
    status: string;
    lastRun: string | null;
    startTime: string | null;
    connectionState?: {
      shouldRestart: boolean;
      disconnectedAt: string | null;
      history: {
        lastDisconnected: string | null;
        lastRestored: string | null;
      };
    };
  };
}
