import { useContext, useMemo } from 'react';
import { PermissionsContext } from '../contexts/PermissionsContext/index.js';
import { useAuth } from './useAuth';
import { authClient } from '../lib/auth.js';

export const usePermissions = () => {
  const { user, isAuthenticated, isAdmin } = useAuth();
  const permissionsContext = useContext(PermissionsContext);

  if (!permissionsContext) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }

  const {
    userTeams,
    organizationMembership,
    canAccessTeam,
    isTeamMember,
    checkUserPermission,
    getTeamsWithPermission,
    getTeamPermissions,
  } = permissionsContext;

  // Memoize async permission checking function
  const hasPermission = async (permission, teamId = null) => {
    if (!isAuthenticated || !user) return false;

    // Admin has all permissions
    if (user.role === 'admin') return true;

    // If a specific team is requested, check if user has access to that team
    if (teamId && !isTeamMember(teamId)) {
      return false;
    }

    try {
      // Use Better Auth's hasPermission API to check analysis permissions
      const result = await authClient.organization.hasPermission({
        permissions: {
          analysis: [permission.replace('analysis.', '')], // Remove prefix for API call
        },
      });
      return result.success && result.data;
    } catch (error) {
      console.warn('Error checking permission:', error);
      return false;
    }
  };

  // Memoize permission checking functions to avoid recalculation
  const permissionCheckers = useMemo(() => {
    // Analysis permissions - can be team-specific (plural names to match component usage)
    const canRunAnalyses = (analysis = null) => {
      // Admin can run all analyses
      if (isAdmin) return true;

      // If analysis is provided, check team-specific permission
      if (analysis?.teamId) {
        return checkUserPermission('run_analyses', analysis.teamId);
      }

      // If no analysis provided, check if user has permission in ANY team
      return checkUserPermission('run_analyses');
    };

    const canDownloadAnalyses = (analysis = null) => {
      // Admin can download all analyses
      if (isAdmin) return true;

      // If analysis is provided, check team-specific permission
      if (analysis?.teamId) {
        return checkUserPermission('download_analyses', analysis.teamId);
      }

      // If no analysis provided, check if user has permission in ANY team
      return checkUserPermission('download_analyses');
    };

    const canViewAnalyses = (analysis = null) => {
      // Admin can view all analyses
      if (isAdmin) return true;

      // If analysis is provided, check team-specific permission
      if (analysis?.teamId) {
        return checkUserPermission('view_analyses', analysis.teamId);
      }

      // If no analysis provided, check if user has permission in ANY team
      return checkUserPermission('view_analyses');
    };

    const canEditAnalyses = (analysis = null) => {
      // Admin can edit all analyses
      if (isAdmin) return true;

      // If analysis is provided, check team-specific permission
      if (analysis?.teamId) {
        return checkUserPermission('edit_analyses', analysis.teamId);
      }

      // If no analysis provided, check if user has permission in ANY team
      return checkUserPermission('edit_analyses');
    };

    const canUploadAnalyses = (analysis = null) => {
      // Admin can upload analyses
      if (isAdmin) return true;

      // If analysis is provided, check team-specific permission
      if (analysis?.teamId) {
        return checkUserPermission('upload_analyses', analysis.teamId);
      }

      // If no analysis provided, check if user has permission in ANY team
      return checkUserPermission('upload_analyses');
    };

    const canDeleteAnalyses = (analysis = null) => {
      // Admin can delete all analyses
      if (isAdmin) return true;

      // If analysis is provided, check team-specific permission
      if (analysis?.teamId) {
        return checkUserPermission('delete_analyses', analysis.teamId);
      }

      // If no analysis provided, check if user has permission in ANY team
      return checkUserPermission('delete_analyses');
    };

    return {
      canRunAnalyses,
      canDownloadAnalyses,
      canViewAnalyses,
      canEditAnalyses,
      canUploadAnalyses,
      canDeleteAnalyses,
    };
  }, [isAdmin, checkUserPermission]);

  // Memoize bulk permission checking functions
  const bulkPermissionCheckers = useMemo(() => {
    // Check if user can upload analyses to any team they have access to
    const canUploadToAnyTeam = () => {
      // Admin can always upload
      if (isAdmin) return true;

      // Check if user has upload permission in any of their teams
      return userTeams.some((team) =>
        team.permissions?.includes('upload_analyses'),
      );
    };

    // General permission checking functions for component visibility (no analysis object needed)
    const hasAnyRunPermission = () => {
      if (isAdmin) return true;
      return userTeams.some((team) =>
        team.permissions?.includes('run_analyses'),
      );
    };

    const hasAnyViewPermission = () => {
      if (isAdmin) return true;
      return userTeams.some((team) =>
        team.permissions?.includes('view_analyses'),
      );
    };

    const hasAnyEditPermission = () => {
      if (isAdmin) return true;
      return userTeams.some((team) =>
        team.permissions?.includes('edit_analyses'),
      );
    };

    const hasAnyDeletePermission = () => {
      if (isAdmin) return true;
      return userTeams.some((team) =>
        team.permissions?.includes('delete_analyses'),
      );
    };

    const hasAnyDownloadPermission = () => {
      if (isAdmin) return true;
      return userTeams.some((team) =>
        team.permissions?.includes('download_analyses'),
      );
    };

    return {
      canUploadToAnyTeam,
      hasAnyRunPermission,
      hasAnyViewPermission,
      hasAnyEditPermission,
      hasAnyDeletePermission,
      hasAnyDownloadPermission,
    };
  }, [isAdmin, userTeams]);

  // Memoize team-specific permission getters
  const teamPermissionGetters = useMemo(() => {
    const getUploadableTeams = () => getTeamsWithPermission('upload_analyses');
    const getEditableTeams = () => getTeamsWithPermission('edit_analyses');
    const getViewableTeams = () => getTeamsWithPermission('view_analyses');
    const getRunableTeams = () => getTeamsWithPermission('run_analyses');
    const getDeletableTeams = () => getTeamsWithPermission('delete_analyses');
    const getDownloadableTeams = () =>
      getTeamsWithPermission('download_analyses');

    return {
      getUploadableTeams,
      getEditableTeams,
      getViewableTeams,
      getRunableTeams,
      getDeletableTeams,
      getDownloadableTeams,
    };
  }, [getTeamsWithPermission]);

  // Memoize team access functions
  const teamAccessHelpers = useMemo(() => {
    // Get list of teams user can access
    const getAccessibleTeams = (allTeams = []) => {
      // Admin can access all teams
      if (isAdmin) return allTeams;

      // Filter teams based on team membership
      const accessibleTeams = allTeams.filter((dept) => {
        // Always allow access to uncategorized team
        if (dept.id === 'uncategorized') return true;

        // Check if user is member of corresponding team
        return isTeamMember(dept.id);
      });

      return accessibleTeams;
    };

    return {
      getAccessibleTeams,
      accessibleTeams: userTeams || [], // Current team-based approach
    };
  }, [isAdmin, userTeams, isTeamMember]);

  // Return the complete permissions API
  return {
    // Core permission data
    userTeams,
    organizationMembership,
    isAdmin,

    // Async permission checking
    hasPermission,

    // Permission checking using stored permissions
    checkUserPermission,

    // Team access
    canAccessTeam,
    isTeamMember,
    ...teamAccessHelpers,

    // Analysis permissions (memoized for performance)
    ...permissionCheckers,

    // Bulk permission checking (memoized for performance)
    ...bulkPermissionCheckers,

    // Team-specific permission getters (memoized for performance)
    getTeamsWithPermission,
    ...teamPermissionGetters,
    getTeamPermissions,

    // Pass through all other context values
    ...permissionsContext,
  };
};
