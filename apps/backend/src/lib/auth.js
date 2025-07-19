import { betterAuth } from 'better-auth';
import { admin } from 'better-auth/plugins/admin';
import { passkey } from 'better-auth/plugins/passkey';
import { username } from 'better-auth/plugins/username';
import { organization } from 'better-auth/plugins/organization';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import config from '../config/default.js';

// Ensure the storage directory exists
const dbPath = path.join(config.storage.base, 'auth.db');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

export const auth = betterAuth({
  database: db,
  user: {
    changeEmail: {
      enabled: true,
    },
    additionalFields: {
      role: {
        type: 'string',
        defaultValue: 'user',
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  // session: {
  //   cookieCache: {
  //     enabled: true,
  //     maxAge: 60, // 1 minute cache for balance between performance and security
  //   },
  // },
  advanced: {
    crossSubDomainCookies: {
      enabled: false, // Enable if using subdomains
    },
  },
  plugins: [
    username(),
    organization({
      allowUserToCreateOrganization: false, // Only admins can create organizations
      organizationLimit: 1, // Single organization for the app
      membershipLimit: 1000, // Max members per organization
      creatorRole: 'owner', // Default role for organization creator
      teams: {
        enabled: true,
        maximumTeams: 50, // Allow many departments/teams
        allowRemovingAllTeams: false, // Keep at least one team
      },
    }),
    admin({
      adminRoles: ['admin'],
      defaultRole: 'user',
    }),
    passkey({
      rpName: 'Tago Analysis Runner',
      rpID: process.env.PRODUCTION_DOMAIN || 'localhost',
    }),
  ],
  secret: process.env.SECRET_KEY || 'default-dev-secret-change-in-production',
  trustedOrigins: ['http://localhost:5173'],
});
