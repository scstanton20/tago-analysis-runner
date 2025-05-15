// connectionMonitor.ts
import { ConnectionState, IConnectionMonitor } from "types/index.js";

interface MonitorService {
  addLog: (fileName: string, message: string) => Promise<void>;
  stopAnalysis: (fileName: string) => Promise<any>;
  runAnalysis: (fileName: string, type: string) => Promise<any>;
  updateConnectionState: (fileName: string, state: ConnectionState) => Promise<void>;
  getProcessStatus: (fileName: string) => string;
  getConfig: () => Record<string, any>;
}

export default class ConnectionMonitor implements IConnectionMonitor {
  fileName: string;
  type: string;
  analysisService: MonitorService;
  checkInterval: number;
  monitorInterval: NodeJS.Timeout | null;
  reconnectTimeout: NodeJS.Timeout | null;
  connectionState: ConnectionState;

  constructor(fileName: string, type: string, analysisService: MonitorService) {
    this.fileName = fileName;
    this.type = type;
    this.analysisService = analysisService;
    this.checkInterval = 30000;
    this.monitorInterval = null;
    this.reconnectTimeout = null;
    this.connectionState = {
      shouldRestart: false,
      disconnectedAt: null,
      wasRunning: false,
      history: {
        lastDisconnected: null,
        lastRestored: null,
      },
    };
  }

  async handleConnectionChange(isConnected: boolean): Promise<void> {
    const currentTime = new Date().toISOString();
    const wasConnected = !this.connectionState.disconnectedAt;

    if (isConnected !== wasConnected) {
      if (isConnected) {
        // Connection restored
        await this.analysisService.addLog(
          this.fileName,
          "Connection restored, checking process state...",
        );
        this.connectionState.history.lastRestored = currentTime;
        this.connectionState.disconnectedAt = null;

        if (this.reconnectTimeout) {
          clearTimeout(this.reconnectTimeout);
        }
        
        this.reconnectTimeout = setTimeout(async () => {
          try {
            // Check if process should restart - for debugging
            const config = await this.analysisService.getConfig();
            const processStatus = await this.analysisService.getProcessStatus(
              this.fileName,
            );

            // Log state for debugging
            await this.analysisService.addLog(
              this.fileName,
              `Debug - Process state: shouldRestart=${this.connectionState.shouldRestart}, ` +
                `wasRunning=${this.connectionState.wasRunning}, ` +
                `status=${processStatus}, ` +
                `enabled=${config[this.fileName]?.enabled}`,
            );

            if (
              this.connectionState.shouldRestart &&
              this.connectionState.wasRunning
            ) {
              await this.analysisService.addLog(
                this.fileName,
                "Restarting process based on saved state...",
              );
              await this.analysisService.runAnalysis(this.fileName, this.type);
              this.connectionState.shouldRestart = false;
              this.connectionState.wasRunning = false;
              await this.analysisService.updateConnectionState(
                this.fileName,
                this.connectionState,
              );
            }
          } catch (error: any) {
            console.error(`Error managing process state: ${error.message}`);
            await this.analysisService.addLog(
              this.fileName,
              `Error managing process state: ${error.message}`,
            );
          }
        }, 5000);
      } else {
        // Connection lost
        await this.analysisService.addLog(
          this.fileName,
          "Connection lost, saving process state...",
        );

        try {
          // Check and save current process state
          const processStatus = await this.analysisService.getProcessStatus(
            this.fileName,
          );
          this.connectionState.wasRunning = processStatus === "running";
          this.connectionState.shouldRestart = true;
          this.connectionState.disconnectedAt = currentTime;
          this.connectionState.history.lastDisconnected = currentTime;

          await this.analysisService.addLog(
            this.fileName,
            `Debug - Saving state: status=${processStatus}, ` +
              `wasRunning=${this.connectionState.wasRunning}`,
          );

          if (this.connectionState.wasRunning) {
            await this.analysisService.stopAnalysis(this.fileName);
          }

          await this.analysisService.updateConnectionState(
            this.fileName,
            this.connectionState,
          );
        } catch (error: any) {
          console.error(`Error handling disconnection: ${error.message}`);
          await this.analysisService.addLog(
            this.fileName,
            `Error handling disconnection: ${error.message}`,
          );
        }
      }
    }
  }

  async checkConnection(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch("https://api.tago.io/status", {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        return data?.status === true;
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  startMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }

    // Initial check
    this.checkConnection().then((status) =>
      this.handleConnectionChange(status),
    );

    this.monitorInterval = setInterval(async () => {
      try {
        const connectionStatus = await this.checkConnection();
        await this.handleConnectionChange(connectionStatus);
      } catch (error) {
        console.error("Error checking connection:", error);
        await this.handleConnectionChange(false);
      }
    }, this.checkInterval);
  }

  stopMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }
}