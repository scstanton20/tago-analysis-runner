// backend/src/controllers/teamController.js
import teamService from '../services/teamService.js';
import { sseManager } from '../utils/sse.js';

const TeamController = {
  // Custom team operations that handle Better Auth team table with custom properties

  // Get all teams
  async getAllTeams(_req, res) {
    try {
      const teams = await teamService.getAllTeams();
      res.json(teams);
    } catch (error) {
      console.error('Error getting teams:', error);
      res.status(500).json({ error: 'Failed to retrieve teams' });
    }
  },

  // Create new team
  async createTeam(req, res) {
    try {
      const { name, color, order } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Team name is required' });
      }

      const team = await teamService.createTeam({
        name,
        color,
        order,
      });

      // Broadcast to all WebSocket clients
      sseManager.broadcast({
        type: 'teamCreated',
        team: team,
      });

      res.status(201).json(team);
    } catch (error) {
      console.error('Error creating team:', error);
      if (error.message.includes('already exists')) {
        res.status(409).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to create team' });
      }
    }
  },

  // Update team
  async updateTeam(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const team = await teamService.updateTeam(id, updates);

      // Broadcast update
      sseManager.broadcast({
        type: 'teamUpdated',
        team: team,
      });

      res.json(team);
    } catch (error) {
      console.error('Error updating team:', error);
      if (error.message.includes('not found')) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to update team' });
      }
    }
  },

  // Delete team with analysis migration
  async deleteTeam(req, res) {
    try {
      const { id } = req.params;
      const { moveAnalysesTo } = req.body;

      // Handle analysis migration and team deletion
      const result = await teamService.deleteTeam(id, moveAnalysesTo);

      // Broadcast deletion
      sseManager.broadcast({
        type: 'teamDeleted',
        deleted: id,
        analysesMovedTo: result.analysesMovedTo,
      });

      res.json(result);
    } catch (error) {
      console.error('Error deleting team:', error);
      if (error.message.includes('not found')) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to delete team' });
      }
    }
  },

  // Reorder teams
  async reorderTeams(req, res) {
    try {
      const { orderedIds } = req.body;

      if (!Array.isArray(orderedIds)) {
        return res.status(400).json({ error: 'orderedIds must be an array' });
      }

      const teams = await teamService.reorderTeams(orderedIds);

      // Broadcast reorder - use correct format
      sseManager.broadcast({
        type: 'teamsReordered',
        teams: teams,
      });

      res.json(teams);
    } catch (error) {
      console.error('Error reordering teams:', error);
      res.status(500).json({ error: 'Failed to reorder teams' });
    }
  },

  // Move analysis to team
  async moveAnalysisToTeam(req, res) {
    try {
      const { name } = req.params;
      const { teamId } = req.body;

      // Use teamId from request body
      const targetTeamId = teamId;

      if (!targetTeamId) {
        return res.status(400).json({ error: 'teamId is required' });
      }

      const result = await teamService.moveAnalysisToTeam(name, targetTeamId);

      // Broadcast move - use correct format
      sseManager.broadcast({
        type: 'analysisMovedToTeam',
        analysis: result.analysis,
        from: result.from,
        to: result.to,
      });

      res.json(result);
    } catch (error) {
      console.error('Error moving analysis:', error);
      if (error.message.includes('not found')) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to move analysis' });
      }
    }
  },

  // Get analysis count for a specific team/team
  async getTeamAnalysisCount(req, res) {
    try {
      const { id } = req.params;
      const count = await teamService.getAnalysisCountByTeamId(id);
      res.json({ count });
    } catch (error) {
      console.error('Error getting analysis count:', error);
      res.status(500).json({ error: 'Failed to get analysis count' });
    }
  },
};

export const {
  getAllTeams,
  createTeam,
  updateTeam,
  deleteTeam,
  reorderTeams,
  moveAnalysisToTeam,
  getTeamAnalysisCount,
} = TeamController;
