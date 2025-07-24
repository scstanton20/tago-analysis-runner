import { createContext, useState, useCallback, useMemo } from 'react';
import { useSession, signOut, authClient } from '../lib/auth.js';
import { notifications } from '@mantine/notifications';
import { useEventListener } from '../hooks/useEventListener';
import { usePolling } from '../hooks/useInterval';
import PasswordOnboarding from '../components/auth/passwordOnboarding.jsx';
import { fetchWithHeaders, handleResponse } from '../utils/apiUtils.js';

const AuthContext = createContext();

export { AuthContext };

export const AuthProvider = ({ children }) => {
  const {
    data: session,
    isPending: sessionLoading,
    refetch: refetchSession,
  } = useSession();

  const [showPasswordOnboarding, setShowPasswordOnboarding] = useState(false);
  const [passwordOnboardingUser, setPasswordOnboardingUser] = useState('');

  // Memoize user and session data extraction
  const authData = useMemo(() => {
    const user = session?.data?.user || session?.user || null;
    const sessionData = session?.data?.session || session?.session || null;
    const isAuthenticated = !!(session && user && sessionData);
    const isAdmin = user?.role === 'admin';
    const isImpersonating = !!sessionData?.impersonatedBy;

    return {
      user,
      session,
      sessionData,
      isAuthenticated,
      isLoading: sessionLoading,
      isAdmin,
      isImpersonating,
      impersonatedBy: sessionData?.impersonatedBy || null,
    };
  }, [session, sessionLoading]);

  // Check if user requires password change (derived state)
  const shouldShowPasswordOnboarding =
    authData.isAuthenticated && authData.user?.requiresPasswordChange;

  // Update password onboarding state when derived state changes
  if (shouldShowPasswordOnboarding && !showPasswordOnboarding) {
    console.log(
      'AuthContext: User requires password change:',
      authData.user?.email || authData.user?.username,
    );
    setShowPasswordOnboarding(true);
    setPasswordOnboardingUser(
      authData.user?.username || authData.user?.email || '',
    );
  } else if (!shouldShowPasswordOnboarding && showPasswordOnboarding) {
    setShowPasswordOnboarding(false);
    setPasswordOnboardingUser('');
  }

  // Listen for auth changes and refetch session
  const handleAuthChange = useCallback(async () => {
    console.log('Auth change event detected, refetching session');
    try {
      refetchSession();
    } catch (error) {
      console.error('Error refetching session:', error);
    }
  }, [refetchSession]);

  useEventListener('auth-change', handleAuthChange);

  // Periodic session validation to detect revoked sessions
  const validateSession = useCallback(async () => {
    try {
      const freshSession = await authClient.getSession();

      // If we had a session but now we don't, it was revoked
      if (session && !freshSession?.data?.session) {
        notifications.show({
          title: 'Session Expired',
          message:
            'Your session has been revoked by an administrator. Please log in again.',
          color: 'orange',
          autoClose: 5000,
        });

        // Force a page refresh to ensure clean state
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } catch (error) {
      console.error('Session validation error:', error);
    }
  }, [session]);

  // Use polling hook for session validation
  usePolling(validateSession, 30000, authData.isAuthenticated);

  // Memoize auth functions to prevent recreating on every render
  const authFunctions = useMemo(
    () => ({
      logout: async () => {
        await signOut();
      },

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
          if (profileData.email && profileData.email !== authData.user?.email) {
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

      passwordOnboarding: async (newPassword) => {
        try {
          console.log('🔐 Setting initial password via server-side API');

          // Use our server-side endpoint that handles both password setting and flag clearing
          const response = await fetchWithHeaders(
            '/users/set-initial-password',
            {
              method: 'POST',
              body: JSON.stringify({
                newPassword: newPassword,
              }),
            },
          );

          const result = await handleResponse(
            response,
            '/users/set-initial-password',
            { method: 'POST', body: JSON.stringify({ newPassword }) },
          );

          console.log('🔐 Password onboarding completed successfully:', result);
          return result;
        } catch (error) {
          console.error('Password onboarding error:', error);
          throw error;
        }
      },
    }),
    [authData.user?.email],
  );

  // Memoize the complete context value
  const contextValue = useMemo(
    () => ({
      ...authData,
      ...authFunctions,
    }),
    [authData, authFunctions],
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
      {showPasswordOnboarding && (
        <PasswordOnboarding
          username={passwordOnboardingUser}
          passwordOnboarding={contextValue.passwordOnboarding}
          onSuccess={async () => {
            console.log('🚨 AuthContext: PasswordOnboarding completed');
            setShowPasswordOnboarding(false);
            setPasswordOnboardingUser('');

            // Refresh session to remove requiresPasswordChange flag
            try {
              refetchSession();
              console.log('✓ Session refreshed after password change');
            } catch (error) {
              console.error(
                'Error refreshing session after password change:',
                error,
              );
            }
          }}
        />
      )}
    </AuthContext.Provider>
  );
};
