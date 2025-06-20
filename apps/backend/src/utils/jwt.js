import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import config from '../config/default.js';

const JWT_SECRET = config.secretKey;
const JWT_EXPIRES_IN = '15m'; // Short access token life
const JWT_REFRESH_EXPIRES_IN = '90d'; // 90 days refresh token life
const JWT_REFRESH_INACTIVE_EXPIRES_IN = '14d'; // 14 days if inactive

// Development persistence file paths
const DEV_DATA_DIR = path.join(process.cwd(), '.dev-session-data');
const BLACKLIST_FILE = path.join(DEV_DATA_DIR, 'blacklist.json');
const SESSIONS_FILE = path.join(DEV_DATA_DIR, 'sessions.json');
const ACTIVITY_FILE = path.join(DEV_DATA_DIR, 'activity.json');

// In-memory blacklist for invalidated tokens (in production, use Redis)
const tokenBlacklist = new Set();

// Active sessions by user ID (in production, use Redis)
const activeSessions = new Map();

// Track last activity for refresh token management
const refreshTokenActivity = new Map();

// Development session persistence functions
function loadDevSessionData() {
  if (process.env.NODE_ENV !== 'development') return;
  
  try {
    // Create directory if it doesn't exist
    if (!fs.existsSync(DEV_DATA_DIR)) {
      fs.mkdirSync(DEV_DATA_DIR, { recursive: true });
      return;
    }

    // Load blacklist
    if (fs.existsSync(BLACKLIST_FILE)) {
      const blacklistData = JSON.parse(fs.readFileSync(BLACKLIST_FILE, 'utf8'));
      blacklistData.forEach(token => tokenBlacklist.add(token));
      console.log(`Restored ${blacklistData.length} blacklisted tokens from development storage`);
    }

    // Load active sessions
    if (fs.existsSync(SESSIONS_FILE)) {
      const sessionsData = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
      Object.entries(sessionsData).forEach(([userId, sessions]) => {
        activeSessions.set(userId, new Set(sessions));
      });
      console.log(`Restored ${activeSessions.size} user sessions from development storage`);
    }

    // Load refresh token activity
    if (fs.existsSync(ACTIVITY_FILE)) {
      const activityData = JSON.parse(fs.readFileSync(ACTIVITY_FILE, 'utf8'));
      Object.entries(activityData).forEach(([sessionId, activity]) => {
        refreshTokenActivity.set(sessionId, {
          ...activity,
          lastActivity: new Date(activity.lastActivity),
          created: new Date(activity.created),
        });
      });
      console.log(`Restored ${refreshTokenActivity.size} session activities from development storage`);
    }
  } catch (error) {
    console.warn('Failed to load development session data:', error.message);
  }
}

function saveDevSessionData() {
  if (process.env.NODE_ENV !== 'development') return;
  
  try {
    // Ensure directory exists
    if (!fs.existsSync(DEV_DATA_DIR)) {
      fs.mkdirSync(DEV_DATA_DIR, { recursive: true });
    }

    // Save blacklist
    fs.writeFileSync(BLACKLIST_FILE, JSON.stringify(Array.from(tokenBlacklist)));

    // Save active sessions
    const sessionsData = {};
    activeSessions.forEach((sessions, userId) => {
      sessionsData[userId] = Array.from(sessions);
    });
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessionsData));

    // Save refresh token activity
    const activityData = {};
    refreshTokenActivity.forEach((activity, sessionId) => {
      activityData[sessionId] = {
        ...activity,
        lastActivity: activity.lastActivity.toISOString(),
        created: activity.created.toISOString(),
      };
    });
    fs.writeFileSync(ACTIVITY_FILE, JSON.stringify(activityData));
  } catch (error) {
    console.warn('Failed to save development session data:', error.message);
  }
}

// Load existing session data on startup in development
loadDevSessionData();

if (!JWT_SECRET) {
  throw new Error('SECRET_KEY is required for JWT operations');
}

export function generateTokens(user, isRefresh = false) {
  const sessionId = uuidv4();
  const now = new Date();
  const payload = {
    id: user.id,
    username: user.username,
    role: user.role,
    sessionId,
  };

  const accessToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'tago-analysis-runner',
  });

  // For refresh tokens, include activity tracking
  const refreshPayload = {
    ...payload,
    type: 'refresh',
    lastActivity: now.toISOString(),
  };

  const refreshToken = jwt.sign(refreshPayload, JWT_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRES_IN,
    issuer: 'tago-analysis-runner',
  });

  // Track active session
  if (!activeSessions.has(user.id)) {
    activeSessions.set(user.id, new Set());
  }
  activeSessions.get(user.id).add(sessionId);

  // Track refresh token activity
  refreshTokenActivity.set(sessionId, {
    userId: user.id,
    lastActivity: now,
    created: isRefresh
      ? refreshTokenActivity.get(sessionId)?.created || now
      : now,
  });

  // Save to disk in development
  saveDevSessionData();

  return { accessToken, refreshToken, sessionId };
}

export function verifyToken(token) {
  try {
    // Check if token is blacklisted
    if (tokenBlacklist.has(token)) {
      throw new Error('Token invalidated');
    }

    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'tago-analysis-runner',
    });

    // Check if session is still active
    if (decoded.sessionId && !isSessionActive(decoded.id, decoded.sessionId)) {
      throw new Error('Session invalidated');
    }

    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token expired');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    }
    throw error;
  }
}

export function verifyRefreshToken(token) {
  try {
    // Check if token is blacklisted
    if (tokenBlacklist.has(token)) {
      throw new Error('Refresh token invalidated');
    }

    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'tago-analysis-runner',
    });

    // Ensure this is a refresh token
    if (decoded.type !== 'refresh') {
      throw new Error('Invalid refresh token');
    }

    // Check if session is still active
    if (decoded.sessionId && !isSessionActive(decoded.id, decoded.sessionId)) {
      throw new Error('Session invalidated');
    }

    // Check activity-based expiration
    const activity = refreshTokenActivity.get(decoded.sessionId);
    if (activity) {
      const now = new Date();
      const daysSinceLastActivity =
        (now - activity.lastActivity) / (1000 * 60 * 60 * 24);

      // If inactive for more than 14 days, expire the token
      if (daysSinceLastActivity > 14) {
        throw new Error('Refresh token expired due to inactivity');
      }
    }

    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Refresh token expired');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid refresh token');
    }
    throw error;
  }
}

export function updateRefreshTokenActivity(sessionId) {
  const activity = refreshTokenActivity.get(sessionId);
  if (activity) {
    activity.lastActivity = new Date();
    // Save to disk in development (throttle saves to avoid excessive I/O)
    if (process.env.NODE_ENV === 'development') {
      // Debounce saves by using a simple timeout
      clearTimeout(updateRefreshTokenActivity._saveTimeout);
      updateRefreshTokenActivity._saveTimeout = setTimeout(() => {
        saveDevSessionData();
      }, 1000);
    }
  }
}

export function invalidateToken(token) {
  tokenBlacklist.add(token);

  // Remove session from active sessions
  try {
    const decoded = jwt.decode(token);
    if (decoded?.id && decoded?.sessionId) {
      const userSessions = activeSessions.get(decoded.id);
      if (userSessions) {
        userSessions.delete(decoded.sessionId);
        if (userSessions.size === 0) {
          activeSessions.delete(decoded.id);
        }
      }
    }
  } catch {
    // Ignore decode errors
  }

  // Save to disk in development
  saveDevSessionData();

  // Clean up expired tokens periodically (basic cleanup)
  if (tokenBlacklist.size > 10000) {
    cleanupBlacklist();
  }
}

export function invalidateAllUserSessions(userId) {
  const userSessions = activeSessions.get(userId);
  if (!userSessions) return [];

  const invalidatedSessions = Array.from(userSessions);

  // Clean up refresh token activity for all user sessions
  for (const sessionId of userSessions) {
    refreshTokenActivity.delete(sessionId);
  }

  // Add all user's tokens to blacklist (we can't get the actual tokens, so we track by sessionId)
  // This approach requires checking sessionId in verifyToken
  activeSessions.delete(userId);

  // Save to disk in development
  saveDevSessionData();

  return invalidatedSessions;
}

export function isSessionActive(userId, sessionId) {
  const userSessions = activeSessions.get(userId);
  return userSessions?.has(sessionId) || false;
}

function cleanupBlacklist() {
  const currentTime = Math.floor(Date.now() / 1000);
  const tokensToRemove = [];

  for (const token of tokenBlacklist) {
    try {
      const decoded = jwt.decode(token);
      if (decoded && decoded.exp && decoded.exp < currentTime) {
        tokensToRemove.push(token);
      }
    } catch {
      tokensToRemove.push(token);
    }
  }

  tokensToRemove.forEach((token) => tokenBlacklist.delete(token));
}

export function extractTokenFromHeader(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}
