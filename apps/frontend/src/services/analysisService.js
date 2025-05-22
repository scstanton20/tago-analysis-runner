// frontend/src/services/analysisService.js
import { fetchWithHeaders, handleResponse } from '../utils/apiUtils';

export const analysisService = {
  async uploadAnalysis(file, type) {
    try {
      console.log('Uploading analysis:', file.name, 'type:', type);
      const formData = new FormData();
      formData.append('analysis', file);
      formData.append('type', type);

      const response = await fetchWithHeaders('/upload', {
        method: 'POST',
        body: formData,
      });

      return await handleResponse(response);
    } catch (error) {
      console.error('Upload failed:', error);
      throw new Error(`Upload failed: ${error.message}`);
    }
  },

  async runAnalysis(fileName, type) {
    try {
      console.log('Running analysis:', fileName, 'type:', type);
      const response = await fetchWithHeaders(`/run/${fileName}`, {
        method: 'POST',
        body: JSON.stringify({ type }),
      });

      return await handleResponse(response);
    } catch (error) {
      console.error('Failed to run analysis:', error);
      throw new Error(`Failed to run analysis: ${error.message}`);
    }
  },

  async stopAnalysis(fileName) {
    try {
      console.log('Stopping analysis:', fileName);
      const response = await fetchWithHeaders(`/stop/${fileName}`, {
        method: 'POST',
      });

      return await handleResponse(response);
    } catch (error) {
      console.error('Failed to stop analysis:', error);
      throw new Error(`Failed to stop analysis: ${error.message}`);
    }
  },

  async deleteAnalysis(fileName) {
    try {
      console.log('Deleting analysis:', fileName);
      const response = await fetchWithHeaders(`/analyses/${fileName}`, {
        method: 'DELETE',
      });

      return await handleResponse(response);
    } catch (error) {
      console.error('Failed to delete analysis:', error);
      throw new Error(`Failed to delete analysis: ${error.message}`);
    }
  },

  async getAnalysisContent(fileName) {
    try {
      console.log('Fetching analysis content for:', fileName);
      const response = await fetchWithHeaders(`/analyses/${fileName}/content`, {
        method: 'GET',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          error: 'Failed to fetch analysis content',
        }));
        throw new Error(errorData.error);
      }

      const content = await response.text();
      return content;
    } catch (error) {
      console.error('Failed to fetch analysis content:', error);
      throw error;
    }
  },

  async updateAnalysis(fileName, content) {
    try {
      console.log('Preparing to update analysis:', {
        fileName,
        contentLength: content.length,
        contentPreview: content.substring(0, 100),
      });

      if (typeof content !== 'string') {
        throw new Error('Content must be a string');
      }

      if (!content.trim()) {
        throw new Error('Content cannot be empty');
      }

      const response = await fetchWithHeaders(`/analyses/${fileName}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          error: 'Failed to update analysis',
        }));
        throw new Error(errorData.error);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to update analysis:', error);
      throw error;
    }
  },

  async renameAnalysis(fileName, newFileName) {
    try {
      console.log('Preparing to rename analysis:', {
        fileName,
        newFileName,
      });

      if (typeof newFileName !== 'string') {
        throw new Error('New Filename must be a string');
      }

      if (!newFileName.trim()) {
        throw new Error('New Filename cannot be empty');
      }

      const response = await fetchWithHeaders(`/analyses/${fileName}/rename`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newFileName }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          error: 'Failed to rename analysis',
        }));
        throw new Error(errorData.error);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to rename analysis:', error);
      throw error;
    }
  },

  async getLogs(fileName, params = {}) {
    try {
      const { page = 1, limit = 100 } = params;
      const queryParams = new URLSearchParams({ page, limit }).toString();
      const response = await fetchWithHeaders(
        `/analyses/${fileName}/logs?${queryParams}`,
      );

      if (!response.ok) {
        if (response.status === 404) {
          return [];
        }
        throw new Error('Failed to fetch logs');
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to fetch logs:', error);
      return [];
    }
  },

  async downloadLogs(fileName, timeRange) {
    try {
      console.log('Downloading logs for:', fileName, 'timeRange:', timeRange);
      const response = await fetchWithHeaders(
        `/analyses/${fileName}/logs/download?timeRange=${timeRange}`,
        { method: 'GET' },
      );

      if (!response.ok) {
        throw new Error('Failed to download logs');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}.log`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to download logs:', error);
      throw error;
    }
  },

  async deleteLogs(fileName) {
    try {
      console.log('Clearing logs for analysis:', fileName);
      const response = await fetchWithHeaders(`/analyses/${fileName}/logs`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to clear logs');
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to clear logs:', error);
      throw error;
    }
  },

  async getEnvFile(fileName) {
    try {
      const response = await fetchWithHeaders(
        `/analyses/${fileName}/environment`,
        { method: 'GET' },
      );
      return await response.json();
    } catch (error) {
      console.error('Error fetching env file:', error);
      return {};
    }
  },

  async getAnalysisENVContent(fileName) {
    try {
      const envData = await this.getEnvFile(fileName);
      if (!envData || typeof envData !== 'object') {
        throw new Error('Invalid env data');
      }

      // Convert env object to a formatted .env string
      return Object.entries(envData)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
    } catch (error) {
      console.error('Error fetching formatted env content:', error);
      return ''; // Ensure it returns a string
    }
  },

  async updateAnalysisENV(fileName, envContent) {
    try {
      if (typeof envContent !== 'string') {
        throw new Error('Invalid .env content format');
      }
      const envObject = envContent
        .split('\n')
        .filter((line) => line.includes('=') && !line.startsWith('#'))
        .reduce((acc, line) => {
          const [key, ...valueParts] = line.split('='); // Fix split issue
          const value = valueParts.join('=').trim(); // Preserve values
          acc[key.trim()] = value || '';
          return acc;
        }, {});

      console.log('Sending env update:', envObject);

      const response = await fetchWithHeaders(
        `/analyses/${fileName}/environment`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ env: envObject }), // ✅ Wrap in env property
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || 'Failed to update environment variables',
        );
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating env file:', error);
      throw error;
    }
  },

  async downloadAnalysis(fileName) {
    try {
      console.log('Downloading analyis:', fileName);
      const response = await fetchWithHeaders(
        `/analyses/${fileName}/download`,
        { method: 'GET' },
      );

      if (!response.ok) {
        throw new Error('Failed to download analysis');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}.js`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to download analysis:', error);
      throw error;
    }
  },
};

export default analysisService;
