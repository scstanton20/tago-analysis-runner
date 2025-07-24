import { auth } from '../lib/auth.js';
import config from '../config/default.js';
import path from 'path';
import Database from 'better-sqlite3';

class UserController {
  /**
   * Add user to organization
   */
  static async addToOrganization(req, res) {
    try {
      const { userId, organizationId, role = 'member' } = req.body;

      if (!userId || !organizationId) {
        return res
          .status(400)
          .json({ error: 'userId and organizationId are required' });
      }

      // Use server-side better-auth API to add member
      const result = await auth.api.addMember({
        body: {
          userId,
          organizationId,
          role,
        },
      });

      if (result.error) {
        console.error('Better Auth addMember error:', result.error);
        return res.status(400).json({ error: result.error.message });
      }

      console.log(
        `✓ Added user ${userId} to organization ${organizationId} with role ${role}`,
      );
      res.json({ success: true, data: result.data });
    } catch (error) {
      console.error('Error adding user to organization:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Assign user to teams with permissions
   */
  static async assignUserToTeams(req, res) {
    try {
      const { userId, teamAssignments } = req.body;

      if (!userId || !Array.isArray(teamAssignments)) {
        return res.status(400).json({
          error: 'userId and teamAssignments array are required',
        });
      }

      // Don't create member entries if no teams are being assigned
      if (teamAssignments.length === 0) {
        console.log(`No teams to assign for user ${userId} - skipping`);
        return res.json({
          success: true,
          data: {
            assignments: [],
            message: 'No teams to assign',
          },
        });
      }

      console.log(
        `Assigning user ${userId} to ${teamAssignments.length} teams`,
      );

      const results = [];
      const errors = [];

      // Use database operations for team assignments
      const dbPath = path.join(config.storage.base, 'auth.db');
      const db = new Database(dbPath);

      try {
        // Get organization ID
        const org = db
          .prepare('SELECT id FROM organization WHERE slug = ?')
          .get('main');
        if (!org) {
          throw new Error('Main organization not found');
        }

        // Ensure user is a member of the organization before adding to teams
        const existingOrgMember = db
          .prepare(
            'SELECT id FROM member WHERE userId = ? AND organizationId = ?',
          )
          .get(userId, org.id);

        if (!existingOrgMember) {
          console.log(`Adding user ${userId} to organization ${org.id}`);
          const addMemberResult = await auth.api.addMember({
            body: {
              userId,
              organizationId: org.id,
              role: 'member',
            },
          });

          if (addMemberResult.error) {
            throw new Error(
              `Failed to add user to organization: ${addMemberResult.error.message}`,
            );
          }
          console.log(`✓ Added user ${userId} to organization`);
        }

        // Process each team assignment using database operations
        for (const assignment of teamAssignments) {
          const { teamId, permissions = [] } = assignment;

          if (!teamId) {
            errors.push('teamId is required for each team assignment');
            continue;
          }

          try {
            // Check if user is already a member of this team
            const existingMember = db
              .prepare(
                'SELECT * FROM teamMember WHERE userId = ? AND teamId = ?',
              )
              .get(userId, teamId);

            if (existingMember) {
              // Update permissions for existing member
              const permissionsJson = JSON.stringify(
                permissions.length > 0
                  ? permissions
                  : ['analysis.view', 'analysis.run'],
              );

              db.prepare(
                'UPDATE teamMember SET permissions = ? WHERE userId = ? AND teamId = ?',
              ).run(permissionsJson, userId, teamId);

              results.push({
                teamId,
                permissions,
                status: 'updated_permissions',
              });
              console.log(
                `✓ Updated permissions for user ${userId} in team ${teamId}`,
              );
            } else {
              // Add user to team
              const { v4: uuidv4 } = await import('uuid');
              const permissionsJson = JSON.stringify(
                permissions.length > 0
                  ? permissions
                  : ['analysis.view', 'analysis.run'],
              );

              db.prepare(
                'INSERT INTO teamMember (id, userId, teamId, permissions, createdAt) VALUES (?, ?, ?, ?, ?)',
              ).run(
                uuidv4(),
                userId,
                teamId,
                permissionsJson,
                new Date().toISOString(),
              );

              results.push({
                teamId,
                permissions,
                status: 'success',
              });
              console.log(`✓ Added user ${userId} to team ${teamId}`);
            }
          } catch (teamError) {
            errors.push(
              `Error adding user to team ${teamId}: ${teamError.message}`,
            );
          }
        }
      } catch (outerError) {
        console.error('Error in team assignment process:', outerError);
        errors.push(`Process error: ${outerError.message}`);
      } finally {
        db.close();
      }

      if (errors.length > 0 && results.length === 0) {
        return res.status(400).json({
          error: 'Failed to assign user to any teams',
          details: errors,
        });
      }

      res.json({
        success: true,
        data: {
          assignments: results,
          errors: errors.length > 0 ? errors : null,
        },
      });
    } catch (error) {
      console.error('Error assigning user to teams:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get user team memberships
   */
  static async getUserTeamMemberships(req, res) {
    try {
      const { userId } = req.params;

      if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
      }

      // Check authorization: users can only get their own memberships, admins can get any
      const currentUser = req.user;
      const isAdmin = currentUser?.role === 'admin';
      const isOwnRequest = currentUser?.id === userId;

      if (!isAdmin && !isOwnRequest) {
        return res.status(403).json({
          error: 'Forbidden: You can only access your own team memberships',
        });
      }

      console.log(`Getting team memberships for user ${userId}`);

      // Use database query to get user's team memberships since Better Auth doesn't have getUserTeams
      const dbPath = path.join(config.storage.base, 'auth.db');
      const db = new Database(dbPath, { readonly: true });

      try {
        // Get teams the user is a member of with their permissions
        const memberships = db
          .prepare(
            `
            SELECT t.id, t.name, m.permissions
            FROM teamMember m
            JOIN team t ON m.teamId = t.id
            WHERE m.userId = ?
          `,
          )
          .all(userId);

        console.log(
          `✓ Found ${memberships.length} team memberships for user ${userId}`,
        );

        res.json({
          success: true,
          data: {
            teams: memberships.map((membership) => ({
              id: membership.id,
              name: membership.name,
              permissions: membership.permissions
                ? JSON.parse(membership.permissions)
                : [],
            })),
          },
        });
      } finally {
        db.close();
      }
    } catch (error) {
      console.error('Error getting user team memberships:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Update user team assignments
   */
  static async updateUserTeamAssignments(req, res) {
    try {
      const { userId } = req.params;
      const { teamAssignments } = req.body;

      if (!userId || !Array.isArray(teamAssignments)) {
        return res.status(400).json({
          error: 'userId and teamAssignments array are required',
        });
      }

      console.log(
        `Updating team assignments for user ${userId} with ${teamAssignments.length} teams`,
      );

      // Use database query to get current team memberships
      const dbPath = path.join(config.storage.base, 'auth.db');
      const db = new Database(dbPath);

      try {
        const currentMemberships = db
          .prepare('SELECT teamId FROM teamMember WHERE userId = ?')
          .all(userId);
        const currentTeamIds = currentMemberships.map((m) => m.teamId);

        const newTeamIds = teamAssignments.map(
          (assignment) => assignment.teamId,
        );
        const teamsToRemove = currentTeamIds.filter(
          (teamId) => !newTeamIds.includes(teamId),
        );

        // Get organization ID
        const org = db
          .prepare('SELECT id FROM organization WHERE slug = ?')
          .get('main');
        if (!org) {
          throw new Error('Main organization not found');
        }

        // Ensure user is a member of the organization before updating teams
        const existingOrgMember = db
          .prepare(
            'SELECT id FROM member WHERE userId = ? AND organizationId = ?',
          )
          .get(userId, org.id);

        if (!existingOrgMember) {
          console.log(`Adding user ${userId} to organization ${org.id}`);
          const addMemberResult = await auth.api.addMember({
            body: {
              userId,
              organizationId: org.id,
              role: 'member',
            },
          });

          if (addMemberResult.error) {
            throw new Error(
              `Failed to add user to organization: ${addMemberResult.error.message}`,
            );
          }
          console.log(`✓ Added user ${userId} to organization`);
        }

        // Remove user from teams they're no longer assigned to
        for (const teamId of teamsToRemove) {
          db.prepare(
            'DELETE FROM teamMember WHERE userId = ? AND teamId = ?',
          ).run(userId, teamId);
          console.log(`✓ Removed user ${userId} from team ${teamId}`);
        }

        // Add user to new teams (or update existing memberships)
        const results = [];
        const errors = [];

        for (const assignment of teamAssignments) {
          const { teamId, permissions = [] } = assignment;

          if (!teamId) {
            errors.push('teamId is required for each team assignment');
            continue;
          }

          try {
            // Check if user is already a member of this team
            const alreadyMember = currentTeamIds.includes(teamId);

            if (!alreadyMember) {
              // Add user to team with permissions using database
              const { v4: uuidv4 } = await import('uuid');
              const permissionsJson = JSON.stringify(
                permissions.length > 0
                  ? permissions
                  : ['analysis.view', 'analysis.run'],
              );

              db.prepare(
                'INSERT INTO teamMember (id, userId, teamId, permissions, createdAt) VALUES (?, ?, ?, ?, ?)',
              ).run(
                uuidv4(),
                userId,
                teamId,
                permissionsJson,
                new Date().toISOString(),
              );

              console.log(`✓ Added user ${userId} to team ${teamId}`);
            } else {
              // Update permissions for existing member
              const permissionsJson = JSON.stringify(
                permissions.length > 0
                  ? permissions
                  : ['analysis.view', 'analysis.run'],
              );

              db.prepare(
                'UPDATE teamMember SET permissions = ? WHERE userId = ? AND teamId = ?',
              ).run(permissionsJson, userId, teamId);

              console.log(
                `✓ Updated permissions for user ${userId} in team ${teamId}`,
              );
            }

            results.push({
              teamId,
              permissions,
              status: alreadyMember ? 'updated_permissions' : 'success',
            });
          } catch (teamError) {
            errors.push(
              `Error updating team assignment ${teamId}: ${teamError.message}`,
            );
          }
        }

        res.json({
          success: true,
          data: {
            assignments: results,
            errors: errors.length > 0 ? errors : null,
          },
        });
      } finally {
        db.close();
      }
    } catch (error) {
      console.error('Error updating user team assignments:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Clean up foreign key references before user deletion
   */
  static async cleanupUserReferences(userId) {
    console.log(`🧹 Cleaning up references for user ${userId}`);

    const dbPath = path.join(config.storage.base, 'auth.db');
    const Database = (await import('better-sqlite3')).default;
    const cleanupDb = new Database(dbPath);

    try {
      // Find all foreign key references
      const teamMemberships = cleanupDb
        .prepare('SELECT * FROM teamMember WHERE userId = ?')
        .all(userId);
      const sessions = cleanupDb
        .prepare('SELECT * FROM session WHERE userId = ?')
        .all(userId);

      console.log(
        `Found ${teamMemberships.length} team memberships, ${sessions.length} sessions to clean up`,
      );

      // Remove team memberships first (foreign key constraint)
      if (teamMemberships.length > 0) {
        cleanupDb
          .prepare('DELETE FROM teamMember WHERE userId = ?')
          .run(userId);
        console.log(`✓ Removed ${teamMemberships.length} team memberships`);
      }

      // Remove organization memberships
      const orgMemberships = cleanupDb
        .prepare('SELECT * FROM member WHERE userId = ?')
        .all(userId);
      if (orgMemberships.length > 0) {
        cleanupDb.prepare('DELETE FROM member WHERE userId = ?').run(userId);
        console.log(
          `✓ Removed ${orgMemberships.length} organization memberships`,
        );
      }

      // Remove sessions
      if (sessions.length > 0) {
        cleanupDb.prepare('DELETE FROM session WHERE userId = ?').run(userId);
        console.log(`✓ Removed ${sessions.length} sessions`);
      }

      // Remove passkeys (if table exists)
      try {
        const passkeys = cleanupDb
          .prepare('DELETE FROM passkey WHERE userId = ?')
          .run(userId);
        if (passkeys.changes > 0) {
          console.log(`✓ Removed ${passkeys.changes} passkeys`);
        }
      } catch {
        console.log('No passkeys table or no passkeys to remove');
      }

      // Remove verification tokens (if table exists)
      try {
        const verifications = cleanupDb
          .prepare('DELETE FROM verification WHERE userId = ?')
          .run(userId);
        if (verifications.changes > 0) {
          console.log(`✓ Removed ${verifications.changes} verification tokens`);
        }
      } catch {
        console.log('No verification table or no tokens to remove');
      }

      return {
        success: true,
        cleanedUp: {
          teamMemberships: teamMemberships.length,
          orgMemberships: orgMemberships.length,
          sessions: sessions.length,
        },
      };
    } finally {
      cleanupDb.close();
    }
  }

  /**
   * Update user's organization role
   */
  static async updateUserOrganizationRole(req, res) {
    try {
      const { userId } = req.params;
      const { organizationId, role } = req.body;

      if (!userId || !organizationId || !role) {
        return res.status(400).json({
          error: 'userId, organizationId, and role are required',
        });
      }

      console.log(
        `Updating organization role for user ${userId} to ${role} in organization ${organizationId}`,
      );

      // Use better-auth API to update member role
      const result = await auth.api.updateMemberRole({
        headers: req.headers, // Pass request headers for authentication
        body: {
          memberId: userId, // Better Auth expects 'memberId' not 'userId'
          organizationId,
          role,
        },
      });

      if (result.error) {
        console.error('Better Auth updateMemberRole error:', result.error);
        const statusCode = result.error.status === 'UNAUTHORIZED' ? 401 : 400;
        return res.status(statusCode).json({ error: result.error.message });
      }

      console.log(`✓ Updated user ${userId} organization role to ${role}`);
      res.json({ success: true, data: result.data });
    } catch (error) {
      console.error('Error updating user organization role:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Remove user from organization
   */
  static async removeUserFromOrganization(req, res) {
    try {
      const { userId } = req.params;
      const { organizationId } = req.body;

      if (!userId || !organizationId) {
        return res.status(400).json({
          error: 'userId and organizationId are required',
        });
      }

      console.log(
        `Removing user ${userId} from organization ${organizationId}`,
      );

      // Use better-auth API to remove member
      const result = await auth.api.removeMember({
        headers: req.headers, // Pass request headers for authentication
        body: {
          memberIdOrEmail: userId, // Better Auth expects 'memberIdOrEmail' not 'userId'
          organizationId,
        },
      });

      if (result.error) {
        console.error('Better Auth removeMember error:', result.error);
        const statusCode = result.error.status === 'UNAUTHORIZED' ? 401 : 400;
        return res.status(statusCode).json({ error: result.error.message });
      }

      console.log(`✓ Removed user ${userId} from organization`);
      res.json({ success: true, message: 'User removed from organization' });
    } catch (error) {
      console.error('Error removing user from organization:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Delete user with proper cleanup
   */
  static async deleteUser(req, res) {
    try {
      const { userId } = req.params;

      if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
      }

      console.log(`🗑️ Deleting user ${userId}`);

      // Clean up foreign key references first
      try {
        await UserController.cleanupUserReferences(userId);
      } catch (cleanupError) {
        console.warn('Warning: Manual cleanup failed:', cleanupError);
        // Continue with deletion anyway
      }

      // Now delete the user through better-auth
      const result = await auth.api.removeUser({
        headers: req.headers,
        body: { userId },
      });

      if (result.error) {
        return res.status(400).json({ error: result.error.message });
      }

      console.log(`✅ User ${userId} deleted successfully`);
      res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Set new password for first-time users (password onboarding)
   */
  static async setInitialPassword(req, res) {
    try {
      const { newPassword } = req.body;

      if (!newPassword) {
        return res.status(400).json({ error: 'newPassword is required' });
      }

      if (newPassword.length < 6) {
        return res
          .status(400)
          .json({ error: 'Password must be at least 6 characters long' });
      }

      // Get current user from session
      if (!req.user?.id) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      console.log(`🔐 Setting initial password for user ${req.user.id}`);

      // Use better-auth's internal adapter to update password
      try {
        const ctx = await auth.$context;
        const hashedPassword = await ctx.password.hash(newPassword);
        await ctx.internalAdapter.updatePassword(req.user.id, hashedPassword);
        console.log(`✓ Password updated successfully for user ${req.user.id}`);
      } catch (passwordError) {
        console.error('Error updating password:', passwordError);
        return res.status(500).json({
          error: 'Failed to update password',
        });
      }

      // Clear the requiresPasswordChange flag in database
      const dbPath = path.join(config.storage.base, 'auth.db');
      const db = new Database(dbPath);

      try {
        const updateResult = db
          .prepare('UPDATE user SET requiresPasswordChange = 0 WHERE id = ?')
          .run(req.user.id);

        if (updateResult.changes === 0) {
          console.warn(
            `No user found with ID ${req.user.id} to clear password flag`,
          );
        } else {
          console.log(
            `✓ Cleared requiresPasswordChange flag for user ${req.user.id}`,
          );
        }
      } finally {
        db.close();
      }

      console.log(`✓ Password onboarding completed for user ${req.user.id}`);
      res.json({
        success: true,
        message: 'Password set successfully',
      });
    } catch (error) {
      console.error('Error setting initial password:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

export default UserController;
