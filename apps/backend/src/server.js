// backend/src/server.js
import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import fileUpload from 'express-fileupload';
import config from './config/default.js';
import { sseManager } from './utils/sse.js';
import errorHandler from './middleware/errorHandler.js';
import {
  analysisService,
  initializeAnalyses,
} from './services/analysisService.js';

// Route modules
import analysisRoutes from './routes/analysisRoutes.js';
import statusRoutes from './routes/statusRoutes.js';
import teamRoutes from './routes/teamRoutes.js';
import sseRoutes from './routes/sseRoutes.js';
import { specs, swaggerUi } from './docs/swagger.js';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './lib/auth.js';
import { execSync } from 'child_process';
import Database from 'better-sqlite3';
import path from 'path';

// Api prefix
const API_PREFIX = '/api';

const app = express();
const server = http.createServer(app);

// Initialize container state
sseManager.updateContainerState({
  status: 'starting',
  startTime: new Date(),
  message: 'Container is starting',
});

// Middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'", 'http://localhost:3000'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
  }),
);

// CORS configuration
if (process.env.NODE_ENV === 'development') {
  app.use(
    cors({
      origin: 'http://localhost:5173',
      credentials: true,
    }),
  );
}

app.use(cookieParser());
app.use(fileUpload());
app.set('trust proxy', 1);

const PORT = process.env.PORT || 3000;

// Function to run database migrations
async function runMigrations() {
  try {
    console.log('Running database migrations...');
    sseManager.updateContainerState({
      status: 'running_migrations',
      message: 'Running database migrations',
    });

    execSync(
      'npx @better-auth/cli@latest migrate --config src/lib/auth.js -y',
      {
        stdio: 'inherit',
        cwd: process.cwd(),
      },
    );

    console.log('✓ Database migrations completed');

    // Check if team table has color column, add if missing
    console.log('Checking team table schema...');
    const dbPath = path.join(config.storage.base, 'auth.db');
    const db = new Database(dbPath);

    try {
      // Check if color column exists
      const tableInfo = db.prepare('PRAGMA table_info(team)').all();
      const hasColorColumn = tableInfo.some(
        (column) => column.name === 'color',
      );
      const hasOrderColumn = tableInfo.some(
        (column) => column.name === 'order_index',
      );
      const hasIsSystemColumn = tableInfo.some(
        (column) => column.name === 'is_system',
      );

      if (!hasColorColumn) {
        console.log('Adding color column to team table...');
        db.prepare(
          "ALTER TABLE team ADD COLUMN color TEXT DEFAULT '#3B82F6'",
        ).run();
        console.log('✓ Color column added to team table');
      } else {
        console.log('✓ Color column already exists in team table');
      }

      if (!hasOrderColumn) {
        console.log('Adding order_index column to team table...');
        db.prepare(
          'ALTER TABLE team ADD COLUMN order_index INTEGER DEFAULT 0',
        ).run();
        console.log('✓ Order_index column added to team table');
      } else {
        console.log('✓ Order_index column already exists in team table');
      }

      if (!hasIsSystemColumn) {
        console.log('Adding is_system column to team table...');
        db.prepare(
          'ALTER TABLE team ADD COLUMN is_system INTEGER DEFAULT 0',
        ).run();
        console.log('✓ Is_system column added to team table');
      } else {
        console.log('✓ Is_system column already exists in team table');
      }

      // Rename any existing "Default Team" to "Uncategorized"
      const defaultTeamExists = db
        .prepare('SELECT id FROM team WHERE name = ?')
        .get('Default Team');

      if (defaultTeamExists) {
        console.log('Renaming "Default Team" to "Uncategorized"...');
        db.prepare(
          'UPDATE team SET name = ?, color = ?, is_system = 1 WHERE name = ?',
        ).run('Uncategorized', '#9ca3af', 'Default Team');
        console.log('✓ "Default Team" renamed to "Uncategorized"');
      }

      // Mark uncategorized teams as system teams
      const uncategorizedTeams = db
        .prepare('SELECT id FROM team WHERE name = ?')
        .all('Uncategorized');

      if (uncategorizedTeams.length > 0) {
        console.log('Marking uncategorized teams as system teams...');
        db.prepare('UPDATE team SET is_system = 1 WHERE name = ?').run(
          'Uncategorized',
        );
        console.log('✓ Uncategorized teams marked as system teams');
      }
    } finally {
      db.close();
    }
  } catch (error) {
    console.error('Migration failed:', error.message);
    throw error;
  }
}

// Function to create admin user if it doesn't exist
async function createAdminUserIfNeeded() {
  try {
    sseManager.updateContainerState({
      status: 'checking_admin',
      message: 'Checking for admin user',
    });

    const dbPath = path.join(config.storage.base, 'auth.db');
    const db = new Database(dbPath);

    const existingAdmin = db
      .prepare('SELECT id FROM user WHERE email = ? OR role = ?')
      .get('admin@example.com', 'admin');

    if (existingAdmin) {
      console.log('✓ Admin user already exists');
      db.close();
      return;
    }

    db.close();

    console.log('Creating admin user...');
    sseManager.updateContainerState({
      status: 'creating_admin',
      message: 'Creating admin user',
    });

    const result = await auth.api.signUpEmail({
      body: {
        name: 'Administrator',
        email: 'admin@example.com',
        password: 'admin123',
        username: 'admin',
      },
      headers: {},
    });

    if (result.user) {
      const db2 = new Database(dbPath);
      const updateResult = db2
        .prepare('UPDATE user SET role = ? WHERE id = ?')
        .run('admin', result.user.id);
      db2.close();

      if (updateResult.changes > 0) {
        console.log('✓ Admin user created successfully');

        // Create main organization and add admin to it
        console.log('Creating main organization...');
        sseManager.updateContainerState({
          status: 'creating_organization',
          message: 'Creating main organization',
        });

        try {
          // Create organization and team directly in database during setup
          const dbPath = path.join(config.storage.base, 'auth.db');
          const db3 = new Database(dbPath);

          // Check if organization already exists
          const existingOrg = db3
            .prepare('SELECT id FROM organization WHERE slug = ?')
            .get('main');

          let orgId = existingOrg?.id;

          if (!existingOrg) {
            // Insert organization directly
            const orgUuid = crypto.randomUUID();
            db3
              .prepare(
                'INSERT INTO organization (id, name, slug, createdAt) VALUES (?, ?, ?, ?)',
              )
              .run(
                orgUuid,
                'Tago Analysis Runner',
                'main',
                new Date().toISOString(),
              );
            orgId = orgUuid;
            console.log('✓ Main organization created');
          } else {
            console.log('✓ Main organization already exists');
          }

          if (orgId) {
            // Create uncategorized team first
            const existingTeam = db3
              .prepare(
                'SELECT id FROM team WHERE organizationId = ? AND name = ?',
              )
              .get(orgId, 'Uncategorized');

            let teamId = existingTeam?.id;

            if (!existingTeam) {
              const teamUuid = crypto.randomUUID();
              db3
                .prepare(
                  'INSERT INTO team (id, name, organizationId, createdAt, color, order_index, is_system) VALUES (?, ?, ?, ?, ?, ?, ?)',
                )
                .run(
                  teamUuid,
                  'Uncategorized',
                  orgId,
                  new Date().toISOString(),
                  '#9ca3af',
                  0,
                  1,
                );
              teamId = teamUuid;
              console.log('✓ Uncategorized team created');
            }

            // Add admin as organization member with team assignment
            const existingMember = db3
              .prepare(
                'SELECT id FROM member WHERE userId = ? AND organizationId = ?',
              )
              .get(result.user.id, orgId);

            if (!existingMember) {
              db3
                .prepare(
                  'INSERT INTO member (id, organizationId, userId, role, teamId, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
                )
                .run(
                  crypto.randomUUID(),
                  orgId,
                  result.user.id,
                  'owner',
                  teamId,
                  new Date().toISOString(),
                );
              console.log(
                '✓ Admin added to organization and uncategorized team as owner',
              );
            }
          }

          db3.close();
        } catch (orgError) {
          console.warn(
            '⚠ Organization setup encountered issues:',
            orgError.message,
          );
        }

        console.log('');
        console.log(' Admin user credentials:');
        console.log('   Email: admin@example.com');
        console.log('   Username: admin');
        console.log('   Password: admin123');
        console.log('');
        console.log('You can now sign in with these credentials.');
      } else {
        console.warn(' Admin user created but role assignment may have failed');
      }
    } else {
      console.error(' Failed to create admin user');
    }
  } catch (error) {
    console.error('Error with admin user setup:', error.message);
  }
}

// Function to restart processes that were running before
async function restartRunningProcesses() {
  try {
    sseManager.updateContainerState({
      status: 'restarting_processes',
      message: 'Restarting previously running analyses',
    });

    console.log('Checking for analyses that need to be restarted...');

    const configuration = await analysisService.getConfig();

    // Check if configuration has analyses property
    if (configuration.analyses) {
      for (const [analysisName, config] of Object.entries(
        configuration.analyses,
      )) {
        if (config.status === 'running' || config.enabled === true) {
          console.log(`Restarting analysis: ${analysisName}`);
          // Pass the type from config, but default to 'listener' if not found
          await analysisService.runAnalysis(
            analysisName,
            config.type || 'listener',
          );
        }
      }
    }

    sseManager.updateContainerState({
      status: 'ready',
      message: 'Container is fully initialized and ready',
    });

    console.log('Process restart check completed');
  } catch (error) {
    sseManager.updateContainerState({
      status: 'error',
      message: `Error during process restart: ${error.message}`,
    });

    console.error('Error restarting processes:', error);
  }
}

async function startServer() {
  try {
    console.log(`Starting server in ${config.env} mode`);

    sseManager.updateContainerState({
      status: 'initializing',
      message: 'Initializing server components',
    });

    // Run database migrations first
    await runMigrations();

    // Create admin user if needed
    await createAdminUserIfNeeded();

    // IMPORTANT: Initialize services BEFORE setting up routes
    console.log('Initializing services...');
    await initializeAnalyses();
    console.log('Services initialized successfully');

    sseManager.updateContainerState({
      status: 'setting_up_routes',
      message: 'Setting up API routes',
    });
    console.log('Setting up routes...');

    // Better Auth routes using toNodeHandler approach
    app.all('/api/auth/*splat', toNodeHandler(auth));
    console.log(`✓ Better Auth routes mounted at ${API_PREFIX}/auth/*`);

    // Apply express.json() middleware before auth routes
    app.use(express.json());

    app.use(`${API_PREFIX}/status`, statusRoutes(analysisService));
    console.log(`✓ Status routes mounted at ${API_PREFIX}/status`);

    // Protected routes
    app.use(`${API_PREFIX}/analyses`, analysisRoutes);
    console.log(`✓ Analysis routes mounted at ${API_PREFIX}/analyses`);

    app.use(`${API_PREFIX}/teams`, teamRoutes);
    console.log(`✓ Team routes mounted at ${API_PREFIX}/teams`);

    // SSE routes
    app.use(`${API_PREFIX}/sse`, sseRoutes);
    console.log(`✓ SSE routes mounted at ${API_PREFIX}/sse`);

    // Swagger API Documentation
    app.use(`${API_PREFIX}/docs`, swaggerUi.serve, swaggerUi.setup(specs));
    console.log(`✓ Swagger API docs mounted at ${API_PREFIX}/docs`);

    // Error handling (must be after routes)
    app.use(errorHandler);

    sseManager.updateContainerState({
      status: 'starting_processes',
      message: 'Starting analysis processes',
    });

    // Start the server
    server.listen(PORT, async () => {
      console.log(`Server is running on port ${PORT}`);

      sseManager.updateContainerState({
        status: 'checking_processes',
        message: 'Checking for processes to restart',
      });

      // Check for processes to restart
      await restartRunningProcesses();

      // Broadcast status update to all connected clients
      sseManager.broadcastStatusUpdate();
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    sseManager.updateContainerState({
      status: 'error',
      message: `Failed to start server: ${error.message}`,
    });
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully');
  sseManager.updateContainerState({
    status: 'shutting_down',
    message: 'Server is shutting down',
  });

  // Broadcast shutdown notification to all users
  sseManager.broadcast({
    type: 'serverShutdown',
    reason: 'Server is shutting down',
  });

  setTimeout(() => {
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  }, 1000); // Give time for broadcast to reach clients
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  sseManager.updateContainerState({
    status: 'shutting_down',
    message: 'Server is shutting down',
  });

  // Broadcast shutdown notification to all users
  sseManager.broadcast({
    type: 'serverShutdown',
    reason: 'Server is shutting down',
  });

  setTimeout(() => {
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  }, 1000); // Give time for broadcast to reach clients
});

startServer();
