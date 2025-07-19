import { createContext, useContext, useEffect, useState } from 'react';
import { useSession, signOut, authClient, organization } from '../lib/auth.js';
import { notifications } from '@mantine/notifications';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const { data: session, isPending: sessionLoading } = useSession();
  const [manualSession, setManualSession] = useState(null);
  const [organizationMembership, setOrganizationMembership] = useState(null);
  const [organizationId, setOrganizationId] = useState(null);
  const [userTeams, setUserTeams] = useState([]);
  const [membershipLoading, setMembershipLoading] = useState(false);

  // Use manual session if available, otherwise fall back to useSession hook
  const currentSession = manualSession || session;
  // Better Auth returns session data in nested structure
  const user = currentSession?.data?.user || currentSession?.user || null;
  const sessionData =
    currentSession?.data?.session || currentSession?.session || null;

  const isAuthenticated = !!(currentSession && user && sessionData);
  const isLoading = sessionLoading && !manualSession;

  // Listen for auth changes and manually fetch session
  useEffect(() => {
    const handleAuthChange = async () => {
      console.log('Auth change event detected, manually fetching session');

      try {
        // Manually fetch the current session
        const freshSession = await authClient.getSession();
        console.log('Fresh session data:', freshSession);
        setManualSession(freshSession);

        // Clear organization data when session changes
        setOrganizationMembership(null);
        setUserTeams([]);
      } catch (error) {
        console.error('Error fetching fresh session:', error);
        setManualSession(null);
        setOrganizationMembership(null);
        setUserTeams([]);
      }
    };

    window.addEventListener('auth-change', handleAuthChange);
    return () => window.removeEventListener('auth-change', handleAuthChange);
  }, []);

  // Load user organization membership and teams when authenticated
  useEffect(() => {
    const loadUserMembership = async () => {
      if (!isAuthenticated || !user) {
        setOrganizationMembership(null);
        setUserTeams([]);
        return;
      }

      try {
        setMembershipLoading(true);

        // Use better-auth organization client to get user organizations
        const result = await organization.list();

        if (!result.error && result.data) {
          // Find the main organization
          const mainOrg = result.data.find((org) => org.slug === 'main');

          if (mainOrg) {
            // Get user's role in the organization
            setOrganizationMembership(mainOrg.role);
            setOrganizationId(mainOrg.id);

            // Get teams for this organization
            const teamsResult = await organization.listTeams({
              query: {
                organizationId: mainOrg.id,
              },
            });

            if (!teamsResult.error && teamsResult.data) {
              // Filter teams where user is a member
              const userTeams = teamsResult.data.filter((team) =>
                team.members?.some((member) => member.userId === user.id),
              );
              setUserTeams(userTeams);
            } else {
              setUserTeams([]);
            }
          } else {
            setOrganizationMembership(null);
            setOrganizationId(null);
            setUserTeams([]);
          }
        } else {
          console.error('Failed to load user membership:', result.error);
          setOrganizationMembership(null);
          setOrganizationId(null);
          setUserTeams([]);
        }
      } catch (error) {
        console.error('Error loading user membership:', error);
        setOrganizationMembership(null);
        setOrganizationId(null);
        setUserTeams([]);
      } finally {
        setMembershipLoading(false);
      }
    };

    loadUserMembership();
  }, [isAuthenticated, user]);

  // Periodic session validation to detect revoked sessions
  useEffect(() => {
    if (!isAuthenticated) return;

    const validateSession = async () => {
      try {
        const freshSession = await authClient.getSession();

        // If we had a session but now we don't, it was revoked
        if (currentSession && !freshSession?.data?.session) {
          notifications.show({
            title: 'Session Expired',
            message:
              'Your session has been revoked by an administrator. Please log in again.',
            color: 'orange',
            autoClose: 5000,
          });

          // Clear manual session and redirect to login
          setManualSession(null);

          // Force a page refresh to ensure clean state
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        }
      } catch (error) {
        console.error('Session validation error:', error);
      }
    };

    // Check session every 30 seconds
    const interval = setInterval(validateSession, 30000);

    return () => clearInterval(interval);
  }, [isAuthenticated, currentSession]);

  // Team helper functions
  const isTeamMember = (teamId) => {
    // Global admins have access to all teams
    if (user?.role === 'admin') return true;

    // Check if user is a member of this team
    return userTeams.some((team) => team.id === teamId);
  };

  const canAccessTeam = (teamId) => {
    // Global admins can access any team
    if (user?.role === 'admin') return true;

    // Check if user is a member of the corresponding team
    return isTeamMember(teamId);
  };

  const hasOrganizationRole = (allowedRoles) => {
    // Global admins have access to everything
    if (user?.role === 'admin') return true;

    // Check organization role
    return (
      organizationMembership && allowedRoles.includes(organizationMembership)
    );
  };

  const getUserAccessibleTeams = () => {
    // Global admins can see all teams (would need separate API call)
    if (user?.role === 'admin') {
      return {
        userTeams,
        isGlobalAdmin: true,
        hasFullAccess: true,
      };
    }

    return {
      userTeams,
      isGlobalAdmin: false,
      hasFullAccess: false,
    };
  };

  const refreshMembership = async () => {
    if (!isAuthenticated || !user) return;

    try {
      setMembershipLoading(true);

      // Use better-auth organization client to refresh memberships
      const result = await organization.listUserMemberships();

      if (!result.error && result.data) {
        const mainOrgMembership = result.data.find(
          (membership) => membership.organizationSlug === 'main',
        );

        if (mainOrgMembership) {
          setOrganizationMembership(mainOrgMembership.role);

          const teamsResult = await organization.listTeams({
            query: {
              organizationId: mainOrgMembership.organizationId,
            },
          });

          if (!teamsResult.error && teamsResult.data) {
            const userTeams = teamsResult.data.filter((team) =>
              team.members?.some((member) => member.userId === user.id),
            );
            setUserTeams(userTeams);
          }
        }
      }
    } catch (error) {
      console.error('Error refreshing membership:', error);
    } finally {
      setMembershipLoading(false);
    }
  };

  // Profile and authentication functions
  const logout = async () => {
    await signOut();
    // Clear manual session state and organization data
    setManualSession(null);
    setOrganizationMembership(null);
    setOrganizationId(null);
    setUserTeams([]);
  };

  const value = {
    user,
    session: currentSession,
    isAuthenticated,
    isLoading,
    isAdmin: user?.role === 'admin',
    isImpersonating: !!sessionData?.impersonatedBy,
    impersonatedBy: sessionData?.impersonatedBy || null,

    // Organization/team data and state
    organizationMembership,
    organizationId,
    userTeams,
    membershipLoading,

    // Team helper functions
    isTeamMember,
    canAccessTeam,
    hasOrganizationRole,
    getUserAccessibleTeams,
    refreshMembership,

    // Auth functions
    logout,
    signOut: logout,
    exitImpersonation: async () => {
      try {
        const result = await authClient.admin.stopImpersonating();
        if (result.error) {
          throw new Error(
            result.error.message || 'Failed to exit impersonation',
          );
        }
        // Refresh the page to update the auth context
        window.location.reload();
      } catch (error) {
        console.error('Error exiting impersonation:', error);
        throw error;
      }
    },
    // Profile and password management using Better Auth
    updateProfile: async (profileData) => {
      try {
        // Update name first
        if (profileData.name) {
          console.log('Updating name:', profileData.name);
          const nameResult = await authClient.updateUser({
            name: profileData.name,
          });
          console.log('Name update result:', nameResult);
          if (nameResult.error) {
            throw new Error(
              nameResult.error.message || 'Failed to update name',
            );
          }
        }

        // Handle email change separately using Better Auth's changeEmail method
        if (profileData.email && profileData.email !== user?.email) {
          console.log('Changing email to:', profileData.email);
          const emailResult = await authClient.changeEmail({
            newEmail: profileData.email,
          });
          console.log('Email change result:', emailResult);
          if (emailResult.error) {
            throw new Error(
              emailResult.error.message || 'Failed to change email',
            );
          }
        }

        return { success: true };
      } catch (error) {
        console.error('Profile update error:', error);
        throw error;
      }
    },
    changeProfilePassword: async (currentPassword, newPassword) => {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });

      if (result.error) {
        throw new Error(result.error.message || 'Failed to change password');
      }

      // Show notification that user must log back in
      notifications.show({
        title: 'Password Changed Successfully',
        message: 'Your password has been changed. You must log back in.',
        color: 'blue',
        autoClose: 3000,
      });

      await signOut();

      // Automatically refresh the window after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 3000);

      return result.data;
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
