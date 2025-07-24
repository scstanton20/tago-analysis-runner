import { v4 as uuidv4 } from 'uuid';
import Database from 'better-sqlite3';
import path from 'path';
import config from '../config/default.js';

/**
 * Service class for managing teams using Better Auth organization plugin and their relationships with analyses
 * Now uses better-auth teams directly instead of maintaining separate department records
 */
class TeamService {
  constructor() {
    /** @type {Object|null} Reference to the analysis service instance */
    this.analysisService = null;
    /** @type {boolean} Whether the service has been initialized */
    this.initialized = false;
    /** @type {string} The main organization ID from better-auth */
    this.organizationId = null;
  }

  /**
   * Initialize the team service with analysis service integration
   * @param {Object} analysisService - Analysis service instance for config management
   * @returns {Promise<void>}
   * @throws {Error} If initialization or migration fails
   */
  async initialize(analysisService) {
    if (this.initialized) return;

    this.analysisService = analysisService;

    try {
      // Get the main organization ID from better-auth database
      await this.loadOrganizationId();

      this.initialized = true;
      console.log('Team service initialized (using better-auth teams)');
    } catch (error) {
      console.error('Failed to initialize team service:', error);
      throw error;
    }
  }

  /**
   * Load the main organization ID from better-auth database
   * @returns {Promise<void>}
   */
  async loadOrganizationId() {
    try {
      const dbPath = path.join(config.storage.base, 'auth.db');
      const db = new Database(dbPath, { readonly: true });

      const org = db
        .prepare('SELECT id FROM organization WHERE slug = ?')
        .get('main');
      db.close();

      if (!org) {
        throw new Error('Main organization not found in better-auth database');
      }

      this.organizationId = org.id;
      console.log(`Loaded organization ID: ${this.organizationId}`);
    } catch (error) {
      console.error('Failed to load organization ID:', error);
      throw error;
    }
  }

  /**
   * Get all teams sorted by name
   * @returns {Promise<Array>} Array of team objects from better-auth
   * @throws {Error} If team retrieval fails
   */
  async getAllTeams() {
    try {
      const dbPath = path.join(config.storage.base, 'auth.db');
      const db = new Database(dbPath, { readonly: true });

      try {
        const teams = db
          .prepare(
            'SELECT id, name, organizationId, createdAt, color, order_index, is_system FROM team WHERE organizationId = ? ORDER BY is_system DESC, order_index, name',
          )
          .all(this.organizationId);

        // Convert is_system from integer to boolean for frontend
        return teams.map((team) => ({
          ...team,
          isSystem: team.is_system === 1,
        }));
      } finally {
        db.close();
      }
    } catch (error) {
      console.error('Failed to get teams:', error);
      throw error;
    }
  }

  /**
   * Get a specific team by ID
   * @param {string} id - Team ID to retrieve
   * @returns {Promise<Object|undefined>} Team object or undefined if not found
   * @throws {Error} If team retrieval fails
   */
  async getTeam(id) {
    try {
      const dbPath = path.join(config.storage.base, 'auth.db');
      const db = new Database(dbPath, { readonly: true });

      try {
        const team = db
          .prepare(
            'SELECT id, name, organizationId, createdAt, color, order_index, is_system FROM team WHERE id = ? AND organizationId = ?',
          )
          .get(id, this.organizationId);

        if (team) {
          // Convert is_system from integer to boolean for frontend
          team.isSystem = team.is_system === 1;
        }

        return team || undefined;
      } finally {
        db.close();
      }
    } catch (error) {
      console.error(`Failed to get team ${id}:`, error);
      throw error;
    }
  }

  /**
   * Create a new team
   * @param {Object} data - Team data
   * @param {string} data.name - Team name
   * @param {string} [data.id] - Custom team ID (generates UUID if not provided)
   * @returns {Promise<Object>} Created team object
   * @throws {Error} If team creation fails
   */
  async createTeam(data) {
    try {
      // If custom ID provided, we need to create it directly in the database
      // since better-auth doesn't support custom IDs via API
      if (data.id) {
        const dbPath = path.join(config.storage.base, 'auth.db');
        const db = new Database(dbPath);

        try {
          // Check if team already exists
          const existing = db
            .prepare(
              'SELECT id FROM team WHERE id = ? OR (name = ? AND organizationId = ?)',
            )
            .get(data.id, data.name, this.organizationId);

          if (existing) {
            throw new Error(`Team with id or name already exists`);
          }

          // Create team with custom ID
          db.prepare(
            'INSERT INTO team (id, name, organizationId, createdAt, color, order_index, is_system) VALUES (?, ?, ?, ?, ?, ?, ?)',
          ).run(
            data.id,
            data.name,
            this.organizationId,
            new Date().toISOString(),
            data.color || '#3B82F6',
            data.order || 0,
            data.isSystem ? 1 : 0,
          );

          const team = {
            id: data.id,
            name: data.name,
            organizationId: this.organizationId,
            createdAt: new Date().toISOString(),
            color: data.color || '#3B82F6',
            order_index: data.order || 0,
            isSystem: data.isSystem || false,
          };

          console.log(`Created team "${data.name}" with custom ID: ${data.id}`);
          return team;
        } finally {
          db.close();
        }
      } else {
        // Create team with auto-generated ID
        const dbPath = path.join(config.storage.base, 'auth.db');
        const db = new Database(dbPath);

        try {
          // Check if team with same name already exists
          const existing = db
            .prepare(
              'SELECT id FROM team WHERE name = ? AND organizationId = ?',
            )
            .get(data.name, this.organizationId);

          if (existing) {
            throw new Error(`Team with name "${data.name}" already exists`);
          }

          // Create team with auto-generated ID
          const teamId = uuidv4();
          db.prepare(
            'INSERT INTO team (id, name, organizationId, createdAt, color, order_index, is_system) VALUES (?, ?, ?, ?, ?, ?, ?)',
          ).run(
            teamId,
            data.name,
            this.organizationId,
            new Date().toISOString(),
            data.color || '#3B82F6',
            data.order || 0,
            data.isSystem ? 1 : 0,
          );

          const team = {
            id: teamId,
            name: data.name,
            organizationId: this.organizationId,
            createdAt: new Date().toISOString(),
            color: data.color || '#3B82F6',
            order_index: data.order || 0,
            isSystem: data.isSystem || false,
          };

          console.log(`Created team "${data.name}" with ID: ${teamId}`);
          return team;
        } finally {
          db.close();
        }
      }
    } catch (error) {
      console.error('Failed to create team:', error);
      throw error;
    }
  }

  /**
   * Update an existing team
   * @param {string} id - Team ID to update
   * @param {Object} updates - Updates to apply
   * @param {string} [updates.name] - New team name
   * @returns {Promise<Object>} Updated team object
   * @throws {Error} If team not found or update fails
   */
  async updateTeam(id, updates) {
    try {
      const dbPath = path.join(config.storage.base, 'auth.db');
      const db = new Database(dbPath);

      try {
        // Check if team exists first
        const existing = db
          .prepare(
            'SELECT id, name, organizationId, createdAt, color, order_index, is_system FROM team WHERE id = ? AND organizationId = ?',
          )
          .get(id, this.organizationId);

        if (!existing) {
          throw new Error(`Team ${id} not found`);
        }

        // Update team
        const updatedAt = new Date().toISOString();
        const updateFields = [];
        const updateValues = [];

        if (updates.name) {
          updateFields.push('name = ?');
          updateValues.push(updates.name);
        }

        if (updates.color) {
          updateFields.push('color = ?');
          updateValues.push(updates.color);
        }

        if (updates.order !== undefined) {
          updateFields.push('order_index = ?');
          updateValues.push(updates.order);
        }

        updateFields.push('updatedAt = ?');
        updateValues.push(updatedAt);
        updateValues.push(id, this.organizationId);

        if (updateFields.length > 1) {
          // More than just updatedAt
          db.prepare(
            `UPDATE team SET ${updateFields.join(', ')} WHERE id = ? AND organizationId = ?`,
          ).run(...updateValues);
        }

        // Return updated team
        const updatedTeam = db
          .prepare(
            'SELECT id, name, organizationId, createdAt, color, order_index, is_system FROM team WHERE id = ? AND organizationId = ?',
          )
          .get(id, this.organizationId);

        if (updatedTeam) {
          // Convert is_system from integer to boolean for frontend
          updatedTeam.isSystem = updatedTeam.is_system === 1;
        }

        console.log(`Updated team ${id}`);
        return updatedTeam;
      } finally {
        db.close();
      }
    } catch (error) {
      console.error(`Failed to update team ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete a team and optionally move its analyses to another team
   * @param {string} id - Team ID to delete
   * @param {string} [moveAnalysesTo] - Team ID to move analyses to (gets uncategorized team if not provided)
   * @returns {Promise<Object>} Deletion result with moved analysis count
   * @throws {Error} If team not found or deletion fails
   */
  async deleteTeam(id, moveAnalysesTo = null) {
    try {
      // Get uncategorized team ID if no target specified
      if (!moveAnalysesTo || moveAnalysesTo === 'uncategorized') {
        const teams = await this.getAllTeams();
        const uncategorizedTeam = teams.find((t) => t.name === 'Uncategorized');
        if (!uncategorizedTeam) {
          throw new Error('No uncategorized team found to move analyses to');
        }
        moveAnalysesTo = uncategorizedTeam.id;
      }

      // Move analyses to target team
      const configData = await this.analysisService.getConfig();
      let analysesMovedCount = 0;

      if (configData.analyses) {
        for (const [, analysis] of Object.entries(configData.analyses)) {
          if (analysis.teamId === id) {
            analysis.teamId = moveAnalysesTo;
            analysis.lastModified = new Date().toISOString();
            analysesMovedCount++;
          }
        }

        if (analysesMovedCount > 0) {
          await this.analysisService.updateConfig(configData);
        }
      }

      // Delete the team
      const dbPath = path.join(config.storage.base, 'auth.db');
      const db = new Database(dbPath);

      try {
        // Check if team exists first
        const existing = db
          .prepare('SELECT id FROM team WHERE id = ? AND organizationId = ?')
          .get(id, this.organizationId);

        if (!existing) {
          throw new Error(`Team ${id} not found`);
        }

        // Delete the team
        db.prepare('DELETE FROM team WHERE id = ? AND organizationId = ?').run(
          id,
          this.organizationId,
        );
      } finally {
        db.close();
      }

      console.log(
        `Deleted team ${id}, moved ${analysesMovedCount} analyses to ${moveAnalysesTo}`,
      );

      return {
        deleted: id,
        analysesMovedTo: moveAnalysesTo,
        analysesMovedCount,
      };
    } catch (error) {
      console.error(`Failed to delete team ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get all analyses belonging to a specific team
   * @param {string} teamId - Team ID to get analyses for
   * @returns {Promise<Array>} Array of analysis objects with name and metadata
   * @throws {Error} If team not found or config retrieval fails
   */
  async getAnalysesByTeam(teamId) {
    // Verify team exists
    const team = await this.getTeam(teamId);
    if (!team) {
      throw new Error(`Team ${teamId} not found`);
    }

    const configData = await this.analysisService.getConfig();
    const analyses = [];

    if (configData.analyses) {
      for (const [name, analysis] of Object.entries(configData.analyses)) {
        if (analysis.teamId === teamId) {
          analyses.push({ name, ...analysis });
        }
      }
    }

    return analyses;
  }

  /**
   * Move an analysis to a different team
   * @param {string} analysisName - Name of the analysis to move
   * @param {string} teamId - Target team ID
   * @returns {Promise<Object>} Move result with from/to team info
   * @throws {Error} If analysis or team not found, or move fails
   */
  async moveAnalysisToTeam(analysisName, teamId) {
    const configData = await this.analysisService.getConfig();

    const analysis = configData.analyses?.[analysisName];
    if (!analysis) {
      throw new Error(`Analysis ${analysisName} not found`);
    }

    // Verify target team exists
    const team = await this.getTeam(teamId);
    if (!team) {
      throw new Error(`Team ${teamId} not found`);
    }

    const previousTeam = analysis.teamId;
    analysis.teamId = teamId;
    analysis.lastModified = new Date().toISOString();

    await this.analysisService.updateConfig(configData);

    console.log(
      `Moved analysis "${analysisName}" from team ${previousTeam} to ${teamId}`,
    );

    return {
      analysis: analysisName,
      from: previousTeam,
      to: teamId,
    };
  }

  /**
   * Ensure an analysis has a team assignment (defaults to uncategorized team)
   * @param {string} analysisName - Name of the analysis to check
   * @returns {Promise<void>}
   * @throws {Error} If config update fails
   */
  async ensureAnalysisHasTeam(analysisName) {
    const configData = await this.analysisService.getConfig();

    if (
      configData.analyses?.[analysisName] &&
      !configData.analyses[analysisName].teamId
    ) {
      // Get uncategorized team
      const teams = await this.getAllTeams();
      const uncategorizedTeam = teams.find((t) => t.name === 'Uncategorized');

      if (uncategorizedTeam) {
        configData.analyses[analysisName].teamId = uncategorizedTeam.id;
        await this.analysisService.updateConfig(configData);
        console.log(
          `Assigned analysis "${analysisName}" to uncategorized team`,
        );
      }
    }
  }

  /**
   * Reorder teams by updating their order_index values
   * @param {string[]} orderedIds - Array of team IDs in desired order
   * @returns {Promise<Array>} Updated teams in new order
   * @throws {Error} If reordering fails
   */
  async reorderTeams(orderedIds) {
    try {
      const dbPath = path.join(config.storage.base, 'auth.db');
      const db = new Database(dbPath);

      try {
        // Update order_index for each team
        const updateStmt = db.prepare(
          'UPDATE team SET order_index = ? WHERE id = ? AND organizationId = ?',
        );

        for (let i = 0; i < orderedIds.length; i++) {
          updateStmt.run(i, orderedIds[i], this.organizationId);
        }

        // Return all teams in new order
        const teams = db
          .prepare(
            'SELECT id, name, organizationId, createdAt, color, order_index, is_system FROM team WHERE organizationId = ? ORDER BY is_system DESC, order_index, name',
          )
          .all(this.organizationId);

        // Convert is_system from integer to boolean for frontend
        const teamsWithBoolean = teams.map((team) => ({
          ...team,
          isSystem: team.is_system === 1,
        }));

        console.log(`Reordered ${orderedIds.length} teams`);
        return teamsWithBoolean;
      } finally {
        db.close();
      }
    } catch (error) {
      console.error('Failed to reorder teams:', error);
      throw error;
    }
  }

  /**
   * Get the count of analyses assigned to a specific team
   * @param {string} teamId - Team ID to count analyses for
   * @returns {Promise<number>} Number of analyses assigned to the team
   */
  async getAnalysisCountByTeamId(teamId) {
    try {
      const analyses = await this.getAnalysesByTeam(teamId);
      return analyses.length;
    } catch (error) {
      console.error(`Error getting analysis count for team ${teamId}:`, error);
      return 0;
    }
  }
}

// Singleton instance
const teamService = new TeamService();

export { teamService as default, TeamService };
