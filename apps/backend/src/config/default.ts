import path from "path";

interface StorageConfig {
  base: string;
  createDirs: boolean;
}

interface AnalysisConfig {
  maxLogsInMemory: number;
  forceKillTimeout: number;
  autoRestartDelay: number;
}

interface ProcessConfig {
  env: {
    NODE_PATH: string;
  };
}

interface PathsConfig {
  analysis: string;
  config: string;
}

interface FilesConfig {
  config: string;
}

interface Config {
  env: string | undefined;
  secretKey: string | undefined;
  storage: StorageConfig;
  analysis: AnalysisConfig;
  process: ProcessConfig;
  paths: PathsConfig;
  files: FilesConfig;
}

// Function to determine the storage base
function determineStorageBase(): string {
  if (process.env.STORAGE_BASE) {
    return process.env.STORAGE_BASE;
  }
  return path.join(process.cwd(), "analyses-storage");
}

// Define the configuration object
const config: Config = {
  env: process.env.NODE_ENV,
  secretKey: process.env.SECRET_KEY,
  storage: {
    base: determineStorageBase(),
    createDirs: true,
  },
  analysis: {
    maxLogsInMemory: 100,
    forceKillTimeout: 3000,
    autoRestartDelay: 1000,
  },
  process: {
    env: {
      NODE_PATH:
        process.env.NODE_PATH ||
        `${path.join(process.cwd(), "../node_modules")}:${path.join(process.cwd(), "src")}`,
    },
  },
  paths: {
    analysis: path.join(determineStorageBase(), "analyses"),
    config: path.join(determineStorageBase(), "config"),
  },
  files: {
    config: path.join(
      path.join(determineStorageBase(), "config"),
      "analyses-config.json",
    ),
  },
};

export default config;
