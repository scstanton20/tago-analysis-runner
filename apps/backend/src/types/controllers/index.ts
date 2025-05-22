// src/types/controllers/index.ts
import { Request, Response } from "express";
import { ParamsDictionary } from "express-serve-static-core";
import { ParsedQs } from "qs";
import { LogTimeRange } from "../shared/analysis.js";

/**
 * Request parameters with fileName
 */
export interface FileNameParams extends ParamsDictionary {
  fileName: string;
}

/**
 * Query parameters for pagination
 */
export interface PaginationQuery extends ParsedQs {
  page?: string;
  limit?: string;
}

/**
 * Query parameters for log downloads
 */
export interface LogDownloadQuery extends ParsedQs {
  timeRange: LogTimeRange;
}

/**
 * Request body for analysis updates
 */
export interface AnalysisUpdateBody {
  content: string;
}

/**
 * Request body for analysis rename
 */
export interface AnalysisRenameBody {
  newFileName: string;
}

/**
 * Request body for environment updates
 */
export interface EnvironmentUpdateBody {
  env: Record<string, string>;
}

/**
 * Request body for analysis run
 */
export interface AnalysisRunBody {
  type: string;
}

// Define specific controller function types
type UploadAnalysisFunction = (req: Request, res: Response) => Promise<void>;
type GetAnalysesFunction = (req: Request, res: Response) => Promise<void>;
type RunAnalysisFunction = (
  req: Request<FileNameParams>,
  res: Response,
) => Promise<void>;
type StopAnalysisFunction = (
  req: Request<FileNameParams>,
  res: Response,
) => Promise<void>;
type DeleteAnalysisFunction = (
  req: Request<FileNameParams>,
  res: Response,
) => Promise<void>;
type GetAnalysisContentFunction = (
  req: Request<FileNameParams>,
  res: Response,
) => Promise<void>;
type UpdateAnalysisFunction = (
  req: Request<FileNameParams, any, AnalysisUpdateBody>,
  res: Response,
) => Promise<void>;
type RenameAnalysisFunction = (
  req: Request<FileNameParams, any, AnalysisRenameBody>,
  res: Response,
) => Promise<void>;
type GetLogsFunction = (
  req: Request<FileNameParams, any, any, PaginationQuery>,
  res: Response,
) => Promise<void>;
type DownloadLogsFunction = (
  req: Request<FileNameParams, any, any, LogDownloadQuery>,
  res: Response,
) => Promise<void>;
type ClearLogsFunction = (
  req: Request<FileNameParams>,
  res: Response,
) => Promise<void>;
type DownloadAnalysisFunction = (
  req: Request<FileNameParams>,
  res: Response,
) => Promise<void>;
type GetEnvironmentFunction = (
  req: Request<FileNameParams>,
  res: Response,
) => Promise<void>;
type UpdateEnvironmentFunction = (
  req: Request<FileNameParams, any, EnvironmentUpdateBody>,
  res: Response,
) => Promise<void>;

/**
 * Analysis controller interface
 */
export interface AnalysisController {
  uploadAnalysis: UploadAnalysisFunction;
  getAnalyses: GetAnalysesFunction;
  runAnalysis: RunAnalysisFunction;
  stopAnalysis: StopAnalysisFunction;
  deleteAnalysis: DeleteAnalysisFunction;
  getAnalysisContent: GetAnalysisContentFunction;
  updateAnalysis: UpdateAnalysisFunction;
  renameAnalysis: RenameAnalysisFunction;
  getLogs: GetLogsFunction;
  downloadLogs: DownloadLogsFunction;
  clearLogs: ClearLogsFunction;
  downloadAnalysis: DownloadAnalysisFunction;
}

/**
 * Environment controller interface
 */
export interface EnvironmentController {
  updateEnvironment: UpdateEnvironmentFunction;
  getEnvironment: GetEnvironmentFunction;
}

/**
 * Combined controller interface
 */
export type CombinedController = AnalysisController & EnvironmentController;

/**
 * Generic controller function for any type
 */
export type ControllerFunction = (req: Request, res: Response) => Promise<void>;

/**
 * Status controller interface
 */
export interface StatusController {
  getSystemStatus: ControllerFunction;
}
