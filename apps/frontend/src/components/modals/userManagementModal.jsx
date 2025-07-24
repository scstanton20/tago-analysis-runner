import { useState, useCallback, useMemo } from 'react';
import {
  Modal,
  Stack,
  Group,
  CopyButton,
  Button,
  Text,
  Table,
  ActionIcon,
  TextInput,
  PasswordInput,
  Select,
  Alert,
  Badge,
  Box,
  Paper,
  LoadingOverlay,
  Menu,
  Divider,
  Center,
  Checkbox,
  Tooltip,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconUser,
  IconAlertCircle,
  IconUserCheck,
  IconBan,
  IconCircleCheck,
  IconDotsVertical,
  IconDeviceLaptop,
  IconCopy,
  IconCheck,
} from '@tabler/icons-react';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { admin, organization, authClient } from '../../lib/auth';
import { useNotifications } from '../../hooks/useNotifications.jsx';
import { userService } from '../../services/userService';
import UserSessionsModal from './userSessionsModal';

// Generate a secure random password for new users
function generateSecurePassword() {
  const length = 12;
  const charset =
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';

  // Ensure at least one of each type
  password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // lowercase
  password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // uppercase
  password += '0123456789'[Math.floor(Math.random() * 10)]; // number
  password += '!@#$%^&*'[Math.floor(Math.random() * 8)]; // special char

  // Fill remaining length
  for (let i = 4; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }

  // Shuffle the password
  return password
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
}

export default function UserManagementModal({ opened, onClose }) {
  const { user: currentUser, isAdmin } = useAuth();

  const { organizationId, refreshUserData } = usePermissions();
  const notify = useNotifications();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [error, setError] = useState('');
  const [createdUserInfo, setCreatedUserInfo] = useState(null);
  const [showSessionsModal, setShowSessionsModal] = useState(false);
  const [selectedUserForSessions, setSelectedUserForSessions] = useState(null);
  const [availableTeams, setAvailableTeams] = useState([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [actions, setActions] = useState([]);

  // Extract usernames and emails from existing users data (no extra API call needed)
  const existingUserData = useMemo(() => {
    const usernames = [];
    const emails = [];

    users.forEach((user) => {
      if (user.name) usernames.push(user.name.toLowerCase());
      if (user.email) emails.push(user.email.toLowerCase());
    });

    return {
      usernames: [...new Set(usernames)], // Remove duplicates
      emails: [...new Set(emails)], // Remove duplicates
    };
  }, [users]);

  const form = useForm({
    initialValues: {
      name: '',
      email: '',
      username: '',
      password: '',
      role: 'user',
      departmentPermissions: {}, // { departmentId: { enabled: boolean, permissions: string[] } }
    },
    validate: {
      name: (value) => (!value ? 'Name is required' : null),
      email: (value) => {
        // Basic validation only - live validation handles duplicates
        if (!value) return 'Email is required';
        if (!/^\S+@\S+$/.test(value)) return 'Invalid email format';
        return null;
      },
      username: (value) => {
        // Basic validation only - live validation handles duplicates
        if (!value) return null; // Username is optional
        if (value.length < 3) return 'Username must be at least 3 characters';
        if (!/^[a-zA-Z0-9_-]+$/.test(value))
          return 'Username can only contain letters, numbers, hyphens, and underscores';
        return null;
      },
    },
  });

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const result = await admin.listUsers({
        query: {
          limit: 100, // Get up to 100 users
        },
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      setUsers(result.data.users || result.data || []);
    } catch (err) {
      console.error('Error loading users:', err);
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load available teams for assignment
  const loadTeams = useCallback(async () => {
    if (!organizationId) {
      console.warn('No organization ID available for loading teams');
      setAvailableTeams([]);
      return;
    }

    try {
      setTeamsLoading(true);

      // Use better-auth organization client to get teams
      const result = await organization.listTeams({
        query: {
          organizationId: organizationId,
        },
      });

      if (!result.error && result.data) {
        // Filter out system teams (like uncategorized) for non-admin users
        const filteredTeams = result.data.filter((team) => {
          // Always include non-system teams
          if (!team.isSystem && !team.is_system) {
            return true;
          }
          // Only include system teams for admin users
          return isAdmin;
        });

        setAvailableTeams(
          filteredTeams.map((team) => ({
            value: team.id,
            label: team.name,
          })),
        );
      } else {
        console.error('Failed to load teams:', result.error);
        setAvailableTeams([]);
      }
    } catch (error) {
      console.error('Error loading teams:', error);
      setAvailableTeams([]);
    } finally {
      setTeamsLoading(false);
    }
  }, [organizationId, isAdmin]);

  // Load available actions for permissions
  const loadActions = useCallback(async () => {
    try {
      const result = await userService.getAvailablePermissions();

      if (result.success && result.data) {
        setActions(result.data);
      } else {
        console.error('Failed to load permissions:', result.error);
        setActions([]);
      }
    } catch (error) {
      console.error('Error loading actions:', error);
      setActions([]);
    }
  }, []);

  // Async username validation using Better Auth
  const validateUsername = useCallback(
    async (username) => {
      if (!username) return null; // Username is optional
      if (username.length < 3) return 'Username must be at least 3 characters';
      if (!/^[a-zA-Z0-9_-]+$/.test(username))
        return 'Username can only contain letters, numbers, hyphens, and underscores';

      // Skip availability check when editing existing user
      if (editingUser) return null;

      try {
        const response = await authClient.isUsernameAvailable({
          username: username,
        });

        if (response.data?.available) {
          return null; // Username is available
        } else {
          return 'This username is already taken';
        }
      } catch (error) {
        console.error('Error checking username availability:', error);
        return 'Unable to verify username availability';
      }
    },
    [editingUser],
  );

  const validateEmail = useCallback(
    (email) => {
      if (!email) return 'Email is required';
      if (!/^\S+@\S+$/.test(email)) return 'Invalid email format';

      // Check against existing emails (case-insensitive, like analysis component)
      if (
        !editingUser &&
        existingUserData.emails.includes(email.toLowerCase())
      ) {
        return 'This email address is already registered';
      }

      return null;
    },
    [editingUser, existingUserData.emails],
  );

  // Username validation using Better Auth API
  const handleUsernameChange = useCallback(
    async (value) => {
      form.setFieldValue('username', value);
      const error = await validateUsername(value);
      if (error) {
        form.setFieldError('username', error);
      } else {
        form.clearFieldError('username');
      }
    },
    [form, validateUsername],
  );

  const handleEmailChange = useCallback(
    (value) => {
      form.setFieldValue('email', value);
      // Instant validation with local data
      const error = validateEmail(value);
      if (error) {
        form.setFieldError('email', error);
      } else {
        form.clearFieldError('email');
      }
    },
    [form, validateEmail],
  );

  // Helper functions for department permissions
  const toggleDepartment = (departmentId) => {
    const current = form.values.departmentPermissions[departmentId] || {
      enabled: false,
      permissions: [],
    };
    const newEnabled = !current.enabled;

    form.setFieldValue(`departmentPermissions.${departmentId}`, {
      enabled: newEnabled,
      permissions: newEnabled ? ['view_analyses'] : [], // Default to view_analyses when enabling
    });
  };

  const toggleDepartmentPermission = (departmentId, permission) => {
    const current = form.values.departmentPermissions[departmentId] || {
      enabled: false,
      permissions: [],
    };
    const currentPermissions = current.permissions || [];

    let newPermissions;
    if (currentPermissions.includes(permission)) {
      // Remove permission, but keep view_analyses if it's the last one
      newPermissions = currentPermissions.filter((p) => p !== permission);
      if (newPermissions.length === 0) {
        newPermissions = ['view_analyses'];
      }
    } else {
      // Add permission
      newPermissions = [...currentPermissions, permission];
    }

    form.setFieldValue(
      `departmentPermissions.${departmentId}.permissions`,
      newPermissions,
    );
  };

  // Helper function to check if current user is the only admin
  const isOnlyAdmin = () => {
    const adminUsers = users.filter((user) => user.role === 'admin');
    return (
      adminUsers.length === 1 &&
      currentUser?.role === 'admin' &&
      adminUsers[0]?.id === currentUser?.id
    );
  };

  // Load data when modal opens (derived state)
  const [hasLoadedModalData, setHasLoadedModalData] = useState(false);

  if (opened && isAdmin && !hasLoadedModalData) {
    setHasLoadedModalData(true);
    loadUsers();
    loadTeams();
    loadActions();
    setError('');
  }

  // Reset loaded flag when modal closes
  if (!opened && hasLoadedModalData) {
    setHasLoadedModalData(false);
  }

  const handleSubmit = async (values) => {
    try {
      setLoading(true);
      setError('');

      if (editingUser) {
        // Handle user editing
        const updates = {};
        let needsUpdate = false;

        // Check if role changed
        if (values.role !== editingUser.role) {
          const roleResult = await admin.setRole({
            userId: editingUser.id,
            role: values.role,
          });
          if (roleResult.error) {
            throw new Error(
              `Failed to update role: ${roleResult.error.message}`,
            );
          }

          // Handle role changes between admin and user manually
          console.log(`Role change from ${editingUser.role} to ${values.role}`);

          // Update the editingUser state to reflect the new role
          setEditingUser((prev) => ({
            ...prev,
            role: values.role,
          }));

          // Handle role-specific team management (organization role is handled by Better Auth automatically)
          if (values.role === 'admin' && editingUser.role !== 'admin') {
            // Promoting to admin - clear team assignments (admins have global access)
            try {
              console.log('Clearing team assignments for new admin...');
              await userService.updateUserTeamAssignments(editingUser.id, []);
              console.log('✓ Team assignments cleared for new admin');
            } catch (teamError) {
              console.warn('Error clearing team assignments:', teamError);
              // Don't throw error here as role update was successful
            }
          }
          // Note: When demoting from admin, team assignments will be handled
          // in the team assignment section below

          updates.role = values.role;
          needsUpdate = true;
        }

        // Note: Better Auth admin plugin doesn't provide updateUser for basic details
        // Only role and password changes are supported for admin user management

        // Update password if provided
        if (values.password && values.password.trim()) {
          const passwordResult = await admin.setUserPassword({
            userId: editingUser.id,
            password: values.password,
          });

          if (passwordResult.error) {
            throw new Error(
              `Failed to update password: ${passwordResult.error.message}`,
            );
          }
          needsUpdate = true;
        }

        // Update team assignments if department permissions changed for non-admin users
        if (
          values.role !== 'admin' &&
          editingUser.id &&
          values.departmentPermissions
        ) {
          try {
            const teamAssignments = Object.entries(values.departmentPermissions)
              .filter(([, config]) => config.enabled)
              .map(([teamId, config]) => ({
                teamId,
                permissions: config.permissions || ['view_analyses'],
              }));

            console.log(
              `Updating team assignments for user ${editingUser.id}...`,
            );

            try {
              await userService.updateUserTeamAssignments(
                editingUser.id,
                teamAssignments,
              );
              console.log('✓ Team assignments updated successfully');

              // Show notification for permission updates
              const assignedTeams = teamAssignments.length;
              if (assignedTeams > 0) {
                notify.showNotification({
                  title: 'Permissions Updated',
                  message: `User permissions updated successfully for ${assignedTeams} team${assignedTeams !== 1 ? 's' : ''}.`,
                  color: 'blue',
                });
              }
            } catch (teamError) {
              console.warn('Failed to update team assignments:', teamError);
              // Don't throw error here as other updates were successful
            }
          } catch (teamError) {
            console.warn('Error updating team assignments:', teamError);
            // Don't throw error here as other updates were successful
          }
        }

        if (needsUpdate) {
          notify.showNotification({
            title: 'Success',
            message: `User ${values.name} updated successfully.`,
            color: 'green',
          });

          // If the current user was updated, refresh their data
          if (editingUser.id === currentUser?.id) {
            console.log('Refreshing current user data after update');
            await refreshUserData();
          }
        }
      } else {
        // Generate auto password for new user
        const autoPassword = generateSecurePassword();

        // Create user using Better Auth admin createUser to avoid auto-login
        console.log('Creating user with values:', {
          name: values.name,
          email: values.email,
          username: values.username,
          role: values.role,
        });

        // Create user with basic data first
        const createUserData = {
          name: values.name,
          email: values.email,
          password: autoPassword,
          role: values.role,
        };

        // Add username to data field if provided
        if (values.username && values.username.trim()) {
          createUserData.data = {
            username: values.username.trim(),
            displayUsername: values.username.trim(), // Both fields are needed for username plugin
          };
        }

        console.log('Creating user with data:', createUserData);
        console.log('Username provided:', values.username);
        const result = await admin.createUser(createUserData);
        console.log('Create user result:', result);
        console.log('Created user data:', result.data?.user);

        if (result.error) {
          // Handle specific duplicate errors with user-friendly messages
          let errorMessage = result.error.message;

          if (
            errorMessage.includes('email') &&
            errorMessage.includes('exists')
          ) {
            errorMessage = `Email address "${values.email}" is already registered. Please use a different email.`;
          } else if (
            errorMessage.includes('username') &&
            errorMessage.includes('exists')
          ) {
            errorMessage = `Username "${values.username}" is already taken. Please choose a different username.`;
          } else if (errorMessage.includes('UNIQUE constraint failed')) {
            if (errorMessage.includes('email')) {
              errorMessage = `Email address "${values.email}" is already registered. Please use a different email.`;
            } else if (errorMessage.includes('username')) {
              errorMessage = `Username "${values.username}" is already taken. Please choose a different username.`;
            }
          }

          throw new Error(errorMessage);
        }

        // New users automatically require password change via Better Auth hook

        // Handle organization membership and team assignments based on role and team selection
        if (organizationId && result.data?.user?.id) {
          if (values.role === 'admin') {
            // Admin users need organization membership for admin privileges
            try {
              console.log('Adding admin user to main organization...');
              const memberResult = await userService.addUserToOrganization(
                result.data.user.id,
                organizationId,
                'admin',
              );

              if (memberResult.error) {
                console.warn(
                  'Failed to add admin to organization:',
                  memberResult.error,
                );
              } else {
                console.log('✓ Admin user added to organization successfully');
              }
            } catch (orgError) {
              console.warn('Error adding admin to organization:', orgError);
            }
          } else {
            // Non-admin users: only add to organization if they have teams
            const teamAssignments = Object.entries(
              values.departmentPermissions || {},
            )
              .filter(([, config]) => config.enabled)
              .map(([teamId, config]) => ({
                teamId,
                permissions: config.permissions || ['view_analyses'],
              }));

            if (teamAssignments.length > 0) {
              try {
                console.log('Adding user to organization with teams...');
                const memberResult = await userService.addUserToOrganization(
                  result.data.user.id,
                  organizationId,
                  'member',
                );

                if (memberResult.error) {
                  console.warn(
                    'Failed to add user to organization:',
                    memberResult.error,
                  );
                } else {
                  console.log('✓ User added to organization successfully');
                }

                // Now assign teams
                console.log(
                  `Assigning user to ${teamAssignments.length} teams...`,
                );
                await userService.assignUserToTeams(
                  result.data.user.id,
                  teamAssignments,
                );
                console.log('✓ User assigned to teams successfully');
              } catch (error) {
                console.warn('Error in team assignment process:', error);
              }
            } else {
              console.log(
                'No teams selected for non-admin user - no organization membership needed',
              );
            }
          }
        }

        notify.showNotification({
          title: 'Success',
          message: `User ${values.name} created successfully.`,
          color: 'green',
        });

        setCreatedUserInfo({
          name: values.name,
          email: values.email,
          tempPassword: autoPassword,
        });

        await loadUsers();
        setShowCreateForm(false);
      }
    } catch (err) {
      setError(err.message || 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (user) => {
    setEditingUser(user);
    setLoading(true);

    try {
      // Load user's current team memberships
      const departmentPermissions = {};

      if (user.role !== 'admin') {
        try {
          const teamMembershipsData = await userService.getUserTeamMemberships(
            user.id,
          );

          if (teamMembershipsData.success && teamMembershipsData.data?.teams) {
            // Convert team memberships to departmentPermissions format
            teamMembershipsData.data.teams.forEach((team) => {
              departmentPermissions[team.id] = {
                enabled: true,
                permissions: team.permissions || ['view_analyses'], // Use actual permissions from database
              };
            });
            console.log(
              `✓ Loaded ${teamMembershipsData.data.teams.length} team assignments for user ${user.id}`,
            );
          } else {
            console.warn('Failed to fetch user team memberships for editing');
          }
        } catch (error) {
          console.warn('Error fetching user team memberships:', error);
        }
      }

      form.setValues({
        name: user.name || '',
        email: user.email || '',
        username: user.username || '',
        password: '',
        role: user.role || 'user',
        departmentPermissions,
      });
      setShowCreateForm(true);
    } catch (error) {
      console.error('Error loading user data for editing:', error);
      setError('Failed to load user data for editing');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (user) => {
    if (
      !confirm(
        `Are you sure you want to delete user "${user.name || user.email}"?`,
      )
    ) {
      return;
    }

    try {
      setLoading(true);
      setError('');

      const result = await userService.deleteUser(user.id);

      if (result.error) {
        throw new Error(result.error.message);
      }

      notify.showNotification({
        title: 'Success',
        message: `User ${user.name || user.email} deleted successfully.`,
        color: 'green',
      });

      await loadUsers();
    } catch (err) {
      setError(err.message || 'Failed to delete user');
    } finally {
      setLoading(false);
    }
  };

  const handleImpersonate = async (user) => {
    if (
      !confirm(
        `Are you sure you want to impersonate "${user.name || user.email}"? You will be logged in as this user.`,
      )
    ) {
      return;
    }

    try {
      setLoading(true);
      setError('');

      const result = await admin.impersonateUser({
        userId: user.id,
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      notify.showNotification({
        title: 'Success',
        message: `Now impersonating ${user.name || user.email}`,
        color: 'blue',
      });

      // Refresh the page to update the auth context
      window.location.reload();
    } catch (err) {
      setError(err.message || 'Failed to impersonate user');
    } finally {
      setLoading(false);
    }
  };

  const handleManageSessions = (user) => {
    setSelectedUserForSessions(user);
    setShowSessionsModal(true);
  };

  const handleBanUser = async (user) => {
    if (
      !confirm(
        `Are you sure you want to ban "${user.name || user.email}"? This will prevent them from signing in.`,
      )
    ) {
      return;
    }

    try {
      setLoading(true);
      setError('');

      const result = await admin.banUser({
        userId: user.id,
        banReason: 'Banned by administrator',
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      notify.showNotification({
        title: 'Success',
        message: `User ${user.name || user.email} has been banned`,
        color: 'orange',
      });

      await loadUsers();
    } catch (err) {
      setError(err.message || 'Failed to ban user');
    } finally {
      setLoading(false);
    }
  };

  const handleUnbanUser = async (user) => {
    try {
      setLoading(true);
      setError('');

      const result = await admin.unbanUser({
        userId: user.id,
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      notify.showNotification({
        title: 'Success',
        message: `User ${user.name || user.email} has been unbanned`,
        color: 'green',
      });

      await loadUsers();
    } catch (err) {
      setError(err.message || 'Failed to unban user');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setEditingUser(null);
    setShowCreateForm(false);
    setCreatedUserInfo(null);
    form.reset();
    setError('');
    // Clear any field errors
    form.clearFieldError('username');
    form.clearFieldError('email');
  };

  const handleCreate = () => {
    setEditingUser(null);
    form.setValues({
      name: '',
      email: '',
      username: '',
      password: '',
      role: 'user',
    });
    setShowCreateForm(true);
    // Clear any field errors
    form.clearFieldError('username');
    form.clearFieldError('email');
  };

  const handleModalClose = () => {
    // If we're in a form, just cancel the form instead of closing the modal
    if (showCreateForm) {
      handleCancel();
    } else {
      // If we're in the main view, close the entire modal
      handleCancel();
      onClose();
    }
  };

  const handleSessionsModalClose = () => {
    setShowSessionsModal(false);
    setSelectedUserForSessions(null);
  };

  // Only show if user is admin
  if (!isAdmin) {
    return null;
  }

  return (
    <Modal
      opened={opened}
      onClose={handleModalClose}
      title={
        <Group gap="xs" justify="space-between" style={{ width: '100%' }}>
          <Group gap="xs">
            <IconUser size={20} />
            <Text fw={600}>User Management</Text>
          </Group>
          {showCreateForm && (
            <Text size="sm" c="dimmed">
              Press ESC or click × to close form
            </Text>
          )}
        </Group>
      }
      size="xl"
      centered
    >
      <Box pos="relative">
        <LoadingOverlay visible={loading} />

        <Stack gap="md">
          {error && (
            <Alert
              icon={<IconAlertCircle size="1rem" />}
              color="red"
              variant="light"
            >
              {error}
            </Alert>
          )}

          {createdUserInfo ? (
            <Paper withBorder p="md">
              <Stack gap="md">
                <Text fw={600} size="lg" ta="center" c="green">
                  User Created Successfully!
                </Text>

                <Alert color="green" variant="light">
                  <Stack gap="xs">
                    <Text fw={500}>Name: {createdUserInfo.name}</Text>
                    <Text fw={500}>Email: {createdUserInfo.email}</Text>
                    <Text fw={500}>
                      Temporary Password: {createdUserInfo.tempPassword}
                      <CopyButton
                        value={createdUserInfo.tempPassword}
                        timeout={2000}
                      >
                        {({ copied, copy }) => (
                          <Tooltip
                            label={copied ? 'Copied' : 'Copy'}
                            withArrow
                            position="right"
                          >
                            <ActionIcon
                              color={copied ? 'teal' : 'gray'}
                              variant="subtle"
                              onClick={copy}
                            >
                              {copied ? (
                                <IconCheck size={16} />
                              ) : (
                                <IconCopy size={16} />
                              )}
                            </ActionIcon>
                          </Tooltip>
                        )}
                      </CopyButton>
                    </Text>
                    <Text size="sm" c="dimmed">
                      The user must sign in with this temporary password and
                      will be required to change it on first login.
                    </Text>
                  </Stack>
                </Alert>

                <Button
                  onClick={() => setCreatedUserInfo(null)}
                  variant="gradient"
                  gradient={{ from: 'brand.6', to: 'accent.6' }}
                >
                  Continue
                </Button>
              </Stack>
            </Paper>
          ) : !showCreateForm ? (
            <>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Manage user accounts and permissions
                </Text>
                <Button
                  leftSection={<IconPlus size="1rem" />}
                  onClick={handleCreate}
                  variant="gradient"
                  gradient={{ from: 'brand.6', to: 'accent.6' }}
                  size="sm"
                >
                  Add User
                </Button>
              </Group>

              <Paper withBorder p="xs">
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th style={{ width: '20%' }}>Name</Table.Th>
                      <Table.Th style={{ width: '25%' }}>Email</Table.Th>
                      <Table.Th style={{ width: '15%' }}>Username</Table.Th>
                      <Table.Th style={{ width: '15%' }}>Role</Table.Th>
                      <Table.Th style={{ width: '15%' }}>Status</Table.Th>
                      <Table.Th style={{ width: '10%' }}>Actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {users.map((user) => (
                      <Table.Tr key={user.id}>
                        <Table.Td>
                          <Stack gap={2}>
                            <Text
                              fw={user.id === currentUser?.id ? 600 : 400}
                              size="sm"
                              style={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                              title={user.name || 'Unknown'}
                            >
                              {user.name || 'Unknown'}
                            </Text>
                            {user.id === currentUser?.id && (
                              <Badge size="xs" variant="light" color="brand">
                                You
                              </Badge>
                            )}
                          </Stack>
                        </Table.Td>
                        <Table.Td>
                          <Text
                            size="sm"
                            style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={user.email}
                          >
                            {user.email}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text
                            size="sm"
                            c={user.username ? undefined : 'dimmed'}
                            style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={user.username || 'Not set'}
                          >
                            {user.username || 'Not set'}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Stack gap="xs">
                            <Badge
                              variant="light"
                              color={
                                user.role === 'admin'
                                  ? 'red'
                                  : user.role === 'analyst'
                                    ? 'orange'
                                    : user.role === 'operator'
                                      ? 'yellow'
                                      : 'blue'
                              }
                              style={{ textTransform: 'capitalize' }}
                            >
                              {user.role || 'user'}
                            </Badge>
                            {user.banned && (
                              <Badge variant="light" color="red" size="xs">
                                Banned
                              </Badge>
                            )}
                          </Stack>
                        </Table.Td>
                        <Table.Td>
                          <Badge
                            variant="light"
                            color={
                              user.requiresPasswordChange === false ||
                              user.requiresPasswordChange === 0
                                ? 'green'
                                : 'orange'
                            }
                            size="sm"
                          >
                            {user.requiresPasswordChange === false ||
                            user.requiresPasswordChange === 0
                              ? 'Active'
                              : 'Pending'}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Menu shadow="md" width={200} closeOnItemClick={true}>
                            <Menu.Target>
                              <ActionIcon
                                variant="subtle"
                                size="lg"
                                color="brand"
                              >
                                <IconDotsVertical size={20} />
                              </ActionIcon>
                            </Menu.Target>

                            <Menu.Dropdown>
                              {/* Edit User */}
                              <Menu.Item
                                onClick={() => handleEdit(user)}
                                leftSection={<IconEdit size={16} />}
                              >
                                Edit User
                              </Menu.Item>

                              {user.id !== currentUser?.id && (
                                <>
                                  <Menu.Divider />

                                  {/* Impersonate User */}
                                  <Menu.Item
                                    onClick={() => handleImpersonate(user)}
                                    leftSection={<IconUserCheck size={16} />}
                                    color="violet"
                                  >
                                    Impersonate User
                                  </Menu.Item>

                                  {/* Manage Sessions */}
                                  <Menu.Item
                                    onClick={() => handleManageSessions(user)}
                                    leftSection={<IconDeviceLaptop size={16} />}
                                    color="blue"
                                  >
                                    Manage Sessions
                                  </Menu.Item>

                                  <Menu.Divider />

                                  {/* Ban/Unban User */}
                                  {user.banned ? (
                                    <Menu.Item
                                      onClick={() => handleUnbanUser(user)}
                                      leftSection={
                                        <IconCircleCheck size={16} />
                                      }
                                      color="green"
                                    >
                                      Unban User
                                    </Menu.Item>
                                  ) : (
                                    <Menu.Item
                                      onClick={() => handleBanUser(user)}
                                      leftSection={<IconBan size={16} />}
                                      color="red"
                                    >
                                      Ban User
                                    </Menu.Item>
                                  )}

                                  {/* Delete User */}
                                  <Menu.Item
                                    onClick={() => handleDelete(user)}
                                    leftSection={<IconTrash size={16} />}
                                    color="red"
                                  >
                                    Delete User
                                  </Menu.Item>
                                </>
                              )}
                            </Menu.Dropdown>
                          </Menu>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Paper>
            </>
          ) : (
            <Paper withBorder p="md">
              <form onSubmit={form.onSubmit(handleSubmit)}>
                <Stack gap="md">
                  <Group justify="space-between" align="center">
                    <Text fw={600} size="lg">
                      {editingUser ? 'Edit User' : 'Create New User'}
                    </Text>
                  </Group>

                  {editingUser && editingUser.id !== currentUser?.id && (
                    <Alert color="blue" variant="light">
                      <Text size="sm">
                        As an admin, you can change this user's role and reset
                        their password. The user must update their own name,
                        email, and username through their profile settings.
                      </Text>
                    </Alert>
                  )}

                  <TextInput
                    label="Name"
                    placeholder="Enter full name"
                    required
                    disabled={!!editingUser}
                    description={
                      editingUser
                        ? 'User must update their own name through profile settings'
                        : undefined
                    }
                    {...form.getInputProps('name')}
                  />

                  <TextInput
                    label="Email"
                    placeholder="Enter email address"
                    required
                    disabled={!!editingUser}
                    description={
                      editingUser
                        ? 'User must update their own email through profile settings'
                        : undefined
                    }
                    onChange={(event) =>
                      handleEmailChange(event.currentTarget.value)
                    }
                    value={form.values.email}
                    error={form.errors.email}
                  />

                  <TextInput
                    label="Username (Optional)"
                    placeholder="Enter username for login"
                    description={
                      editingUser
                        ? 'User must update their own username through profile settings'
                        : 'Users can login with either email or username'
                    }
                    disabled={!!editingUser}
                    onChange={(event) =>
                      handleUsernameChange(event.currentTarget.value)
                    }
                    value={form.values.username}
                    error={form.errors.username}
                  />

                  {editingUser && (
                    <PasswordInput
                      label="New Password (leave blank to keep current)"
                      placeholder="Enter password"
                      {...form.getInputProps('password')}
                    />
                  )}

                  <Select
                    label="Role"
                    placeholder="Select role"
                    required
                    disabled={
                      editingUser?.id === currentUser?.id &&
                      editingUser?.role === 'admin' &&
                      isOnlyAdmin()
                    }
                    data={[
                      {
                        value: 'user',
                        label: 'User - Specific department assignments',
                      },
                      {
                        value: 'admin',
                        label: 'Administrator - Full system access',
                      },
                    ]}
                    {...form.getInputProps('role')}
                  />

                  {form.values.role === 'admin' && (
                    <Alert color="blue" variant="light">
                      Administrators have full access to all features and can
                      manage other users.
                    </Alert>
                  )}

                  {form.values.role !== 'admin' && (
                    <Stack gap="md">
                      <Divider />

                      <Text size="sm" fw={600} c="dimmed">
                        Department Access & Permissions
                      </Text>
                      <Text size="xs" c="dimmed">
                        Select departments and assign specific permissions for
                        each. View analyses is automatically assigned when a
                        department is enabled.
                      </Text>

                      <Stack gap="xs" mah="40vh" style={{ overflow: 'auto' }}>
                        {teamsLoading ? (
                          <Center py="md">
                            <Group>
                              <Loader size="sm" />
                              <Text size="sm" c="dimmed">
                                Loading teams...
                              </Text>
                            </Group>
                          </Center>
                        ) : (
                          availableTeams.map((team) => {
                            const teamPerms = form.values.departmentPermissions[
                              team.value
                            ] || {
                              enabled: false,
                              permissions: [],
                            };
                            const isEnabled = teamPerms.enabled;
                            const permissions = teamPerms.permissions || [];

                            return (
                              <Paper
                                key={team.value}
                                withBorder
                                p="md"
                                style={{
                                  backgroundColor: isEnabled
                                    ? 'var(--mantine-color-blue-light)'
                                    : 'transparent',
                                  borderColor: isEnabled
                                    ? 'var(--mantine-color-blue-6)'
                                    : 'var(--mantine-color-gray-3)',
                                }}
                              >
                                <Stack gap="sm">
                                  {/* Department Header */}
                                  <Group
                                    justify="space-between"
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => toggleDepartment(team.value)}
                                  >
                                    <Group gap="sm">
                                      <Checkbox
                                        checked={isEnabled}
                                        onChange={() =>
                                          toggleDepartment(team.value)
                                        }
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                      <Text fw={500} size="sm">
                                        {team.label}
                                      </Text>
                                    </Group>
                                    {isEnabled && (
                                      <Badge
                                        size="xs"
                                        variant="light"
                                        color="blue"
                                      >
                                        {permissions.length} permission
                                        {permissions.length !== 1 ? 's' : ''}
                                      </Badge>
                                    )}
                                  </Group>

                                  {/* Permissions for this department */}
                                  {isEnabled && (
                                    <Box ml="xl">
                                      <Stack gap="xs">
                                        {actions.map((action) => (
                                          <Group key={action.value} gap="sm">
                                            <Checkbox
                                              size="sm"
                                              checked={permissions.includes(
                                                action.value,
                                              )}
                                              onChange={() =>
                                                toggleDepartmentPermission(
                                                  team.value,
                                                  action.value,
                                                )
                                              }
                                              disabled={
                                                action.value === 'view_analyses'
                                              } // Always enabled as default
                                              label={
                                                <Text size="sm">
                                                  {action.label}
                                                  {action.value ===
                                                    'view_analyses' && (
                                                    <Text
                                                      component="span"
                                                      size="xs"
                                                      c="dimmed"
                                                      ml="xs"
                                                    >
                                                      (default)
                                                    </Text>
                                                  )}
                                                </Text>
                                              }
                                            />
                                          </Group>
                                        ))}
                                      </Stack>
                                    </Box>
                                  )}
                                </Stack>
                              </Paper>
                            );
                          })
                        )}
                      </Stack>
                    </Stack>
                  )}

                  {editingUser &&
                    editingUser.id === currentUser?.id &&
                    editingUser.role === 'admin' &&
                    form.values.role !== 'admin' && (
                      <Alert color="orange" variant="light">
                        Warning: There must be at least one administrator. Since
                        you are the only admin, you cannot change your own role.
                      </Alert>
                    )}

                  <Group justify="flex-end" gap="sm">
                    <Button variant="default" onClick={handleCancel}>
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="gradient"
                      gradient={{ from: 'brand.6', to: 'accent.6' }}
                    >
                      {editingUser ? 'Update User' : 'Create User'}
                    </Button>
                  </Group>
                </Stack>
              </form>
            </Paper>
          )}
        </Stack>
      </Box>

      {/* Sessions Management Modal */}
      <UserSessionsModal
        opened={showSessionsModal}
        onClose={handleSessionsModalClose}
        user={selectedUserForSessions}
      />
    </Modal>
  );
}
