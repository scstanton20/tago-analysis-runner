// src/types/shared/api.ts
import { AnalysisStatus, AnalysisLog } from "./analysis.js";
/**
 * API response for analysis creation
 */
export interface CreateAnalysisResponse {
  analysisName: string;
}

/**
 * API response for analysis operation
 */
export interface AnalysisOperationResponse {
  success: boolean;
  status?: AnalysisStatus;
  logs?: AnalysisLog[];
  message?: string;
  restarted?: boolean;
}

/**
 * API response for system status
 */
export interface SystemStatusResponse {
  health: {
    status: "healthy" | "initializing";
    containerState: "ready" | "initializing" | "healthy";
    message: string;
    uptime: number; // in seconds
  };
  tagoConnection: {
    sdkVersion: string;
    status: "connected" | "disconnected" | "unknown";
    runningAnalyses: number;
  };
  serverTime: string;
  message?: string;
}

/**
 * WebSocket message types
 */
export type WebSocketMessageType =
  | "init"
  | "analysisCreated"
  | "analysisDeleted"
  | "analysisUpdated"
  | "analysisRenamed"
  | "environmentUpdated"
  | "status"
  | "log"
  | "clearLogs";

/**
 * WebSocket message structure
 */
export interface WebSocketMessage<T = any> {
  type: WebSocketMessageType;
  data: T;
}
