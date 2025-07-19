import { auth } from '../lib/auth.js';
import { fromNodeHeaders } from 'better-auth/node';

// Authentication middleware using Better Auth
export const authMiddleware = async (req, res, next) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session?.session || !session?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Attach user and session to request
    // eslint-disable-next-line require-atomic-updates
    req.user = session.user;
    // eslint-disable-next-line require-atomic-updates
    req.session = session.session;

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({ error: 'Unauthorized' });
  }
};

// Admin role requirement middleware
export const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  } catch (error) {
    console.error('Admin middleware error:', error);
    return res.status(403).json({ error: 'Access denied' });
  }
};

// Global permission mapping based on roles
const globalRolePermissions = {
  admin: [
    'upload_analyses',
    'view_analyses',
    'run_analyses',
    'edit_analyses',
    'delete_analyses',
    'download_analyses',
    'manage_users',
    'manage_departments',
  ],
  analyst: [
    'upload_analyses',
    'view_analyses',
    'run_analyses',
    'edit_analyses',
    'download_analyses',
  ],
  operator: ['view_analyses', 'run_analyses'],
  viewer: ['view_analyses'],
};

// Department-specific permission mapping
const departmentRolePermissions = {
  department_admin: [
    'upload_analyses',
    'view_analyses',
    'run_analyses',
    'edit_analyses',
    'delete_analyses',
    'download_analyses',
  ],
  department_analyst: [
    'upload_analyses',
    'view_analyses',
    'run_analyses',
    'edit_analyses',
    'download_analyses',
  ],
  department_operator: ['view_analyses', 'run_analyses'],
  department_viewer: ['view_analyses'],
};

// Generic permission check middleware with department support
export const requirePermission = (permission, departmentId = null) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Check global admin permissions first
      const globalRole = req.user.role || 'viewer';
      const globalPermissions = globalRolePermissions[globalRole] || [];

      if (globalPermissions.includes(permission)) {
        return next(); // Global permission granted
      }

      // If department-specific check is requested
      if (departmentId) {
        // Get user's organization memberships using Better Auth
        // For now, we'll implement a simplified version until we set up organizations
        // TODO: Implement proper organization/department membership check
        const userOrganizations = [];

        // Check if user has permission in the specific department
        const departmentMembership = userOrganizations.find(
          (org) => org.organization.id === departmentId,
        );

        if (departmentMembership) {
          const departmentRole = departmentMembership.role;
          const departmentPermissions =
            departmentRolePermissions[departmentRole] || [];

          if (departmentPermissions.includes(permission)) {
            return next(); // Department permission granted
          }
        }
      }

      return res.status(403).json({
        error: `Insufficient permissions. Required: ${permission}${departmentId ? ` in department ${departmentId}` : ''}`,
      });
    } catch (error) {
      console.error('Permission middleware error:', error);
      return res.status(403).json({ error: 'Access denied' });
    }
  };
};

// Department access check middleware
export const requireDepartmentAccess = (departmentId) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Global admins have access to all departments
      if (req.user.role === 'admin') {
        return next();
      }

      // Check if user is a member of the department
      // For now, we'll implement a simplified version until we set up organizations
      // TODO: Implement proper organization/department membership check
      const userOrganizations = [];

      const hasAccess = userOrganizations.some(
        (org) => org.organization.id === departmentId,
      );

      if (!hasAccess) {
        return res.status(403).json({
          error: 'Access denied to this department',
        });
      }

      next();
    } catch (error) {
      console.error('Department access middleware error:', error);
      return res.status(403).json({ error: 'Access denied' });
    }
  };
};
