// frontend/src/contexts/sseContext/hook.js
import { useContext } from 'react';
import { SSEContext } from './context';

export function useSSE() {
  const context = useContext(SSEContext);

  if (!context) {
    throw new Error('useSSE must be used within an SSEProvider');
  }

  return {
    // Core state
    analyses: context.analyses || {},
    teams: context.teams || {},

    // Connection state
    connectionStatus: context.connectionStatus || 'connecting',
    backendStatus: context.backendStatus,
    hasInitialData: context.hasInitialData || false,

    // Loading state
    loadingAnalyses: context.loadingAnalyses || new Set(),

    // Functions
    addLoadingAnalysis: context.addLoadingAnalysis,
    removeLoadingAnalysis: context.removeLoadingAnalysis,
    requestStatusUpdate: context.requestStatusUpdate,

    // Utility functions for object-based operations
    getAnalysis: (name) => context.analyses?.[name] || null,
    getTeam: (id) => context.teams?.[id] || null,

    getAnalysesByTeam: (teamId) => {
      if (!context.analyses) return [];
      return Object.values(context.analyses).filter(
        (analysis) => analysis.teamId === teamId,
      );
    },

    getAnalysisCount: () =>
      context.analyses ? Object.keys(context.analyses).length : 0,

    getTeamAnalysisCount: (teamId) => {
      if (!context.analyses) return 0;
      return Object.values(context.analyses).filter(
        (analysis) => analysis.teamId === teamId,
      ).length;
    },

    // Helper for filtering analyses
    filterAnalyses: (predicate) => {
      if (!context.analyses) return [];
      return Object.values(context.analyses).filter(predicate);
    },

    // Helper for getting analysis names
    getAnalysisNames: () =>
      context.analyses ? Object.keys(context.analyses) : [],

    // Helper for getting team names
    getTeamNames: () => (context.teams ? Object.keys(context.teams) : []),
  };
}
