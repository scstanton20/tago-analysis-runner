// models/AnalysisProcess.ts
import path from "path";
import fs from "fs/promises";
import { fork, ChildProcess } from "child_process";
import { broadcastUpdate } from "utils/websocket.js";
import config from "config/default.js";
import {
  AnalysisLog,
  AnalysisStatus,
  ConnectionState,
  IAnalysisProcess,
  IAnalysisService,
} from "types/index.js";

export default class AnalysisProcess implements IAnalysisProcess {
  private _analysisName: string;
  type: string;
  service?: IAnalysisService;
  process: ChildProcess | null;
  logs: AnalysisLog[];
  enabled: boolean;
  status: AnalysisStatus;
  lastRun: string | null;
  startTime: string | null;
  stdoutBuffer: string;
  stderrBuffer: string;
  logFile: string;
  connectionState?: ConnectionState;

  constructor(analysisName: string, type: string, service?: IAnalysisService) {
    this._analysisName = analysisName;
    this.type = type;
    this.service = service;
    this.process = null;
    this.logs = [];
    this.enabled = false;
    this.status = "stopped";
    this.lastRun = null;
    this.startTime = null;
    this.stdoutBuffer = "";
    this.stderrBuffer = "";
    this.logFile = path.join(
      config.paths.analysis,
      analysisName,
      "logs",
      "analysis.log",
    );
  }

  // Add getter and setter for analysisName
  get analysisName(): string {
    return this._analysisName;
  }

  set analysisName(newName: string) {
    const oldName = this._analysisName;
    this._analysisName = newName;

    // Update log file path when name changes
    this.logFile = path.join(
      config.paths.analysis,
      newName,
      "logs",
      "analysis.log",
    );

    console.log(
      `Updated analysis name from ${oldName} to ${newName} (logFile: ${this.logFile})`,
    );
  }

  setupProcessHandlers(): void {
    this.stdoutBuffer = "";
    this.stderrBuffer = "";

    if (this.process?.stdout) {
      this.process.stdout.on("data", this.handleOutput.bind(this, false));
    }

    if (this.process?.stderr) {
      this.process.stderr.on("data", this.handleOutput.bind(this, true));
    }

    this.process?.once("exit", this.handleExit.bind(this));
  }

  handleOutput(isError: boolean, data: Buffer): void {
    const buffer = isError ? this.stderrBuffer : this.stdoutBuffer;
    const lines = data.toString().split("\n");

    lines.forEach((line, index) => {
      if (index === lines.length - 1) {
        if (isError) {
          this.stderrBuffer = line;
        } else {
          this.stdoutBuffer = line;
        }
      } else {
        const fullLine = (buffer + line).trim();
        if (fullLine) {
          this.addLog(isError ? `ERROR: ${fullLine}` : fullLine);
        }
        if (isError) {
          this.stderrBuffer = "";
        } else {
          this.stdoutBuffer = "";
        }
      }
    });
  }

  async start(): Promise<void> {
    if (this.process) return;

    try {
      const filePath = path.join(
        config.paths.analysis,
        this.analysisName,
        "index.cjs",
      );
      await this.addLog(`Node.js ${process.version}`);

      // Check if service exists before calling loadEnvironmentVariables
      const storedEnv = this.service
        ? await this.service.loadEnvironmentVariables(this.analysisName)
        : {};

      this.process = fork(filePath, [], {
        env: {
          ...process.env,
          ...config.process.env,
          ...storedEnv,
          STORAGE_BASE: config.storage.base,
        },
        stdio: ["inherit", "pipe", "pipe", "ipc"],
      });

      if (!this.process) {
        throw new Error("Failed to start analysis process");
      }

      this.setupProcessHandlers();
      this.updateStatus("running", true);
      await this.saveConfig();
    } catch (error: any) {
      await this.addLog(`ERROR: ${error.message}`);
      throw error;
    }
  }

  async addLog(message: string): Promise<void> {
    const timestamp = new Date().toLocaleString();
    const logEntry = `[${timestamp}] ${message}\n`;

    this.logs.unshift({ timestamp, message });
    if (this.logs.length > config.analysis.maxLogsInMemory) {
      this.logs.pop();
    }

    try {
      // Ensure the logs directory exists
      const logsDir = path.dirname(this.logFile);
      await fs.mkdir(logsDir, { recursive: true });

      // Append to the log file
      await fs.appendFile(this.logFile, logEntry);
    } catch (error) {
      console.error(`Error writing to log file ${this.logFile}:`, error);
    }

    broadcastUpdate("log", {
      fileName: this.analysisName,
      log: { timestamp, message },
    });
  }

  updateStatus(status: AnalysisStatus, enabled = false): void {
    this.status = status;
    this.enabled = enabled;

    if (this.type === "listener" && status === "running") {
      this.startTime = new Date().toISOString();
    } else if (status === "running") {
      this.lastRun = new Date().toISOString();
    }
    broadcastUpdate("status", {
      fileName: this.analysisName,
      status: this.status,
      enabled: this.enabled,
      lastRun: this.lastRun,
      startTime: this.startTime,
    });
  }

  async stop(): Promise<void> {
    if (!this.process || this.status !== "running") {
      return;
    }

    await this.addLog("Stopping analysis...");

    return new Promise<void>((resolve) => {
      this.process?.kill("SIGTERM");

      const forceKillTimeout = setTimeout(() => {
        if (this.process) {
          this.addLog("Force stopping process...").then(() => {
            this.process?.kill("SIGKILL");
          });
        }
      }, config.analysis.forceKillTimeout);

      this.process?.once("exit", () => {
        clearTimeout(forceKillTimeout);
        this.updateStatus("stopped", false);
        this.addLog("Analysis stopped").then(() => {
          this.process = null;
          this.saveConfig().then(resolve);
        });
      });
    });
  }

  async saveConfig(): Promise<void> {
    if (!this.service) {
      console.error(
        `Error: Service is undefined for analysis ${this.analysisName}`,
      );
      return;
    }
    return this.service.saveConfig();
  }

  async handleExit(code: number): Promise<void> {
    if (this.stdoutBuffer.trim()) {
      await this.addLog(this.stdoutBuffer.trim());
    }
    if (this.stderrBuffer.trim()) {
      await this.addLog(`ERROR: ${this.stderrBuffer.trim()}`);
    }

    await this.addLog(`Process exited with code ${code}`);
    this.process = null;

    this.updateStatus("stopped", false);
    await this.saveConfig();

    if (this.type === "listener" && this.enabled && this.status === "running") {
      console.log(`Auto-restarting listener: ${this.analysisName}`);
      setTimeout(() => this.start(), config.analysis.autoRestartDelay);
    }
  }
}
