// frontend/src/services/statusService.js
import { fetchWithHeaders, handleResponse } from '../utils/apiUtils';

export const statusService = {
  async getSystemStatus() {
    try {
      console.log('Fetching system status');
      const response = await fetchWithHeaders('/status');
      return await handleResponse(response);
    } catch (error) {
      console.error('Failed to fetch system status:', error);
      return {
        health: { status: 'unhealthy' },
        tagoConnection: {
          status: 'disconnected',
          runningAnalyses: 0,
          sdkVersion: 'unknown',
        },
        error: error.message,
      };
    }
  },
};

export default statusService;
