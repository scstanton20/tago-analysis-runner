// utils/storage.js
<<<<<<<< HEAD:apps/backend/src/utils/storage.ts
import fs from "fs/promises";
import config from "config/default.js";
========
const fs = require('fs').promises;
const config = require('../config/default');
>>>>>>>> main:apps/backend/src/utils/storage.js

export default async function initializeStorage() {
  if (!config.storage.createDirs) return;

  try {
    // Create all directory paths
    await Promise.all(
      Object.values(config.paths).map((dir) =>
        fs.mkdir(dir, { recursive: true }),
      ),
    );

    // Initialize config file if it doesn't exist
    try {
      await fs.access(config.files.config);
    } catch {
      await fs.writeFile(
        config.files.config,
        JSON.stringify(
          { version: '1.0', created: new Date().toISOString() },
          null,
          2,
        ),
      );
    }
  } catch (error) {
    console.error('Failed to initialize storage:', error);
    throw error;
  }
}
