import { useAuth } from '../contexts/AuthProvider.jsx';

export const usePermissions = () => {
  const {
    user,
    isAuthenticated,
    userTeams,
    organizationMembership,
    canAccessTeam,
    isTeamMember,
  } = useAuth();

  const hasPermission = (permission) => {
    if (!isAuthenticated || !user) return false;

    // Admin has all permissions
    if (user.role === 'admin') return true;

    // For now, basic user permissions
    const userPermissions = [
      'analysis.view',
      'analysis.run',
      'analysis.upload',
      'analysis.download',
    ];

    return userPermissions.includes(permission);
  };

  const isAdmin = user?.role === 'admin';

  const canAccessTeamOld = () => {
    // This is the old implementation - kept for compatibility
    // Admin can access all teams
    if (isAdmin) return true;

    // For authenticated users, use team-based access
    return isAuthenticated && organizationMembership;
  };

  // New team-specific access control
  const canAccessSpecificTeam = (teamId) => {
    // Admin can access all teams
    if (isAdmin) return true;

    // Check if user can access this specific team
    return canAccessTeam(teamId);
  };

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

  // Analysis permissions - can be team-specific
  const canRunAnalysis = (analysis = null) => {
    // Admin can run all analyses
    if (isAdmin) return true;

    // Check base permission
    if (!hasPermission('analysis.run')) return false;

    // If no analysis provided or no team, use base permission
    if (!analysis?.teamId) return true;

    // Check team access
    return canAccessSpecificTeam(analysis.teamId);
  };

  const canDownloadAnalysis = (analysis = null) => {
    // Admin can download all analyses
    if (isAdmin) return true;

    // Check base permission
    if (!hasPermission('analysis.download')) return false;

    // If no analysis provided or no team, use base permission
    if (!analysis?.teamId) return true;

    // Check team access
    return canAccessSpecificTeam(analysis.teamId);
  };

  const canViewAnalysis = (analysis = null) => {
    // Admin can view all analyses
    if (isAdmin) return true;

    // Check base permission
    if (!hasPermission('analysis.view')) return false;

    // If no analysis provided or no team, use base permission
    if (!analysis?.teamId) return true;

    // Check team access
    return canAccessSpecificTeam(analysis.teamId);
  };

  const canEditAnalysis = (analysis = null) => {
    // Admin can edit all analyses
    if (isAdmin) return true;

    // Check base permission (edit requires upload capability)
    if (!hasPermission('analysis.upload')) return false;

    // If no analysis provided or no team, use base permission
    if (!analysis?.teamId) return true;

    // Check team access
    return canAccessSpecificTeam(analysis.teamId);
  };

  const canDeleteAnalysis = () => {
    // For now, only allow admins to delete analyses
    // TODO: Implement more granular delete permissions based on team role
    return isAdmin;
  };

  // Legacy functions for backward compatibility
  const canRunAnalyses = () => canRunAnalysis();
  const canDownloadAnalyses = () => canDownloadAnalysis();
  const canViewAnalyses = () => canViewAnalysis();
  const canEditAnalyses = () => canEditAnalysis();
  const canDeleteAnalyses = () => canDeleteAnalysis();

  return {
    hasPermission,
    isAdmin,

    // Team access
    canAccessTeam: canAccessTeamOld, // Legacy compatibility
    canAccessSpecificTeam,
    getAccessibleTeams,

    // New analysis permissions (team-aware)
    canRunAnalysis,
    canDownloadAnalysis,
    canViewAnalysis,
    canEditAnalysis,
    canDeleteAnalysis,

    // Legacy analysis permissions (for backward compatibility)
    canRunAnalyses,
    canDownloadAnalyses,
    canViewAnalyses,
    canEditAnalyses,
    canDeleteAnalyses,

    // Team/organization data
    userTeams,
    organizationMembership,
    isTeamMember,
  };
};
