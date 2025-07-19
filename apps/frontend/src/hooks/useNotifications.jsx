import React from 'react';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconX,
  IconLoader,
  IconUpload,
  IconDownload,
  IconUserCheck,
  IconLock,
  IconBuilding,
  IconSettings,
  IconFile,
  IconTrash,
} from '@tabler/icons-react';

/**
 * Simple notification hook for promise-based operations
 * Usage: const notify = useNotifications();
 */
export const useNotifications = () => {
  const executeWithNotification = async (
    promise,
    {
      loading = 'Processing...',
      success = 'Operation completed successfully',
      error,
      loadingIcon = <IconLoader size={16} />,
      successIcon = <IconCheck size={16} />,
      errorIcon = <IconX size={16} />,
    } = {},
  ) => {
    const id = `notification-${Date.now()}`;

    // Show loading notification
    notifications.show({
      id,
      title: 'Loading',
      message: loading,
      icon: loadingIcon,
      color: 'blue',
      loading: true,
      autoClose: false,
    });

    try {
      const result = await promise;

      // Update to success notification
      notifications.update({
        id,
        title: 'Success',
        message: success,
        icon: successIcon,
        color: 'green',
        loading: false,
        autoClose: 4000,
      });

      return result;
    } catch (err) {
      // Update to error notification
      const errorMessage =
        error || err.message || 'An unexpected error occurred';

      notifications.update({
        id,
        title: 'Error',
        message: errorMessage,
        icon: errorIcon,
        color: 'red',
        loading: false,
        autoClose: 6000,
      });

      throw err;
    }
  };

  // Predefined notification presets for common operations
  const presets = {
    // Auth operations
    login: (promise) =>
      executeWithNotification(promise, {
        loading: 'Signing in...',
        success: 'Welcome back! You have been signed in successfully.',
        loadingIcon: <IconLoader size={16} />,
        successIcon: <IconUserCheck size={16} />,
      }),

    logout: (promise) =>
      executeWithNotification(promise, {
        loading: 'Signing out...',
        success: 'You have been signed out successfully.',
        loadingIcon: <IconLoader size={16} />,
        successIcon: <IconUserCheck size={16} />,
      }),

    passwordChange: (promise) =>
      executeWithNotification(promise, {
        loading: 'Updating password...',
        success: 'Password updated successfully.',
        loadingIcon: <IconLock size={16} />,
        successIcon: <IconCheck size={16} />,
      }),

    profileUpdate: (promise) =>
      executeWithNotification(promise, {
        loading: 'Updating profile...',
        success: 'Profile updated successfully.',
        loadingIcon: <IconUserCheck size={16} />,
        successIcon: <IconCheck size={16} />,
      }),

    // Analysis operations
    uploadAnalysis: (promise, filename) =>
      executeWithNotification(promise, {
        loading: `Uploading ${filename}...`,
        success: `${filename} uploaded successfully.`,
        loadingIcon: <IconUpload size={16} />,
        successIcon: <IconCheck size={16} />,
      }),

    runAnalysis: (promise, analysisName) =>
      executeWithNotification(promise, {
        loading: `Starting ${analysisName}...`,
        success: `${analysisName} started successfully.`,
        loadingIcon: <IconLoader size={16} />,
        successIcon: <IconCheck size={16} />,
      }),

    stopAnalysis: (promise, analysisName) =>
      executeWithNotification(promise, {
        loading: `Stopping ${analysisName}...`,
        success: `${analysisName} stopped successfully.`,
        loadingIcon: <IconLoader size={16} />,
        successIcon: <IconCheck size={16} />,
      }),

    updateAnalysis: (promise, analysisName) =>
      executeWithNotification(promise, {
        loading: `Updating ${analysisName}...`,
        success: `${analysisName} updated successfully.`,
        loadingIcon: <IconFile size={16} />,
        successIcon: <IconCheck size={16} />,
      }),

    deleteAnalysis: (promise, analysisName) =>
      executeWithNotification(promise, {
        loading: `Deleting ${analysisName}...`,
        success: `${analysisName} deleted successfully.`,
        loadingIcon: <IconTrash size={16} />,
        successIcon: <IconCheck size={16} />,
      }),

    downloadAnalysis: (promise, analysisName) =>
      executeWithNotification(promise, {
        loading: `Downloading ${analysisName}...`,
        success: `${analysisName} downloaded successfully.`,
        loadingIcon: <IconDownload size={16} />,
        successIcon: <IconCheck size={16} />,
      }),

    // Team operations
    createTeam: (promise, teamName) =>
      executeWithNotification(promise, {
        loading: `Creating team ${teamName}...`,
        success: `Team ${teamName} created successfully.`,
        loadingIcon: <IconBuilding size={16} />,
        successIcon: <IconCheck size={16} />,
      }),

    updateTeam: (promise, teamName) =>
      executeWithNotification(promise, {
        loading: `Updating team ${teamName}...`,
        success: `Team ${teamName} updated successfully.`,
        loadingIcon: <IconSettings size={16} />,
        successIcon: <IconCheck size={16} />,
      }),

    deleteTeam: (promise, teamName) =>
      executeWithNotification(promise, {
        loading: `Deleting team ${teamName}...`,
        success: `Team ${teamName} deleted successfully.`,
        loadingIcon: <IconTrash size={16} />,
        successIcon: <IconCheck size={16} />,
      }),

    // Legacy department operations (for backward compatibility)
    createDepartment: (promise, departmentName) =>
      executeWithNotification(promise, {
        loading: `Creating team ${departmentName}...`,
        success: `Team ${departmentName} created successfully.`,
        loadingIcon: <IconBuilding size={16} />,
        successIcon: <IconCheck size={16} />,
      }),

    updateDepartment: (promise, departmentName) =>
      executeWithNotification(promise, {
        loading: `Updating team ${departmentName}...`,
        success: `Team ${departmentName} updated successfully.`,
        loadingIcon: <IconSettings size={16} />,
        successIcon: <IconCheck size={16} />,
      }),

    deleteDepartment: (promise, departmentName) =>
      executeWithNotification(promise, {
        loading: `Deleting team ${departmentName}...`,
        success: `Team ${departmentName} deleted successfully.`,
        loadingIcon: <IconTrash size={16} />,
        successIcon: <IconCheck size={16} />,
      }),
  };

  // Helper functions for simple notifications without promises
  const success = (message, title = 'Success') => {
    notifications.show({
      title,
      message,
      icon: <IconCheck size={16} />,
      color: 'green',
      autoClose: 4000,
    });
  };

  const error = (message, title = 'Error') => {
    notifications.show({
      title,
      message,
      icon: <IconX size={16} />,
      color: 'red',
      autoClose: 6000,
    });
  };

  const info = (message, title = 'Info') => {
    notifications.show({
      title,
      message,
      icon: <IconLoader size={16} />,
      color: 'blue',
      autoClose: 4000,
    });
  };

  // Main showNotification function for direct access
  const showNotification = (options) => {
    notifications.show(options);
  };

  return {
    executeWithNotification,
    showNotification,
    ...presets,
    success,
    error,
    info,
  };
};

export default useNotifications;
