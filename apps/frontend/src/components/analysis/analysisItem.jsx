import { useState } from 'react';
import PropTypes from 'prop-types';
import {
  Play,
  Square,
  FileText,
  Download,
  Edit,
  Trash2,
  MoreVertical,
} from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { analysisService } from '../../services/analysisService';
import AnalysisLogs from './analysisLogs';
import StatusBadge from '../common/statusBadge';
import EditAnalysisModal from './analysisEdit';
import EditAnalysisENVModal from './analysisEditENV';
import LogDownloadDialog from './logDownload';

export default function AnalysisItem({ analysis, showLogs, onToggleLogs }) {
  const [isLoading, setIsLoading] = useState(false);
  const [showEditAnalysisModal, setShowEditAnalysisModal] = useState(false);
  const [showEditENVModal, setShowEditENVModal] = useState(false);
  const [showLogDownloadDialog, setShowLogDownloadDialog] = useState(false);

  if (!analysis || !analysis.name) {
    return null;
  }

  const handleRun = async () => {
    setIsLoading(true);
    try {
      await analysisService.runAnalysis(analysis.name, analysis.type);
    } catch (error) {
      console.error('Failed to run analysis:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStop = async () => {
    setIsLoading(true);
    try {
      await analysisService.stopAnalysis(analysis.name);
    } catch (error) {
      console.error('Failed to stop analysis:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAnalysis = async () => {
    if (!window.confirm('Are you sure you want to delete this analysis?')) {
      return;
    }

    try {
      await analysisService.deleteAnalysis(analysis.name);
    } catch (error) {
      console.error('Failed to delete analysis:', error);
    }
  };

  const handleSaveAnalysis = async (content) => {
    try {
      await analysisService.updateAnalysis(analysis.name, content);
      setShowEditAnalysisModal(false);
    } catch (error) {
      console.error('Failed to save analysis:', error);
      throw error;
    }
  };

  const handleSaveENV = async (content) => {
    try {
      await analysisService.updateAnalysisENV(analysis.name, content);
      setShowEditENVModal(false);
    } catch (error) {
      console.error('Failed to save analysis:', error);
      throw error;
    }
  };

  const handleDownloadLogs = async (timeRange) => {
    try {
      await analysisService.downloadLogs(analysis.name, timeRange);
    } catch (error) {
      console.error('Failed to download logs:', error);
    }
  };

  // Update the handleDeleteLogs function in AnalysisItem.jsx

  const handleDeleteLogs = async () => {
    if (
      !window.confirm(
        'Are you sure you want to delete all logs for this analysis?',
      )
    ) {
      return;
    }

    try {
      if (showLogs) {
        onToggleLogs();
      }

      await analysisService.deleteLogs(analysis.name);

      // Wait for the backend to fully process the deletion
      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (!showLogs) {
        onToggleLogs();
      }
    } catch (error) {
      console.error('Failed to delete logs:', error);
    }
  };

  const handleDownloadAnalysis = async () => {
    try {
      await analysisService.downloadAnalysis(analysis.name);
    } catch (error) {
      console.error('Failed to download analysis:', error);
    }
  };

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">{analysis.name}</h3>
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <span>{analysis.type || 'oneshot'}</span>
            <StatusBadge status={analysis.status || 'stopped'} />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Primary Actions */}
          <div className="flex items-center space-x-2">
            {analysis.status === 'running' ? (
              <button
                onClick={handleStop}
                disabled={isLoading}
                className="flex items-center gap-1 bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 disabled:bg-red-300"
              >
                <Square className="w-4 h-4" />
                Stop
              </button>
            ) : (
              <button
                onClick={handleRun}
                disabled={isLoading}
                className="flex items-center gap-1 bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 disabled:bg-green-300"
              >
                <Play className="w-4 h-4" />
                Run
              </button>
            )}
          </div>

          {/* Log Actions */}
          <div className="flex items-center space-x-2">
            <button
              onClick={onToggleLogs}
              className="flex items-center gap-1 bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
            >
              <FileText className="w-4 h-4" />
              {showLogs ? 'Hide Logs' : 'Show Logs'}
            </button>
          </div>

          {/* Secondary Actions Dropdown */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="p-1 rounded hover:bg-gray-100">
                <MoreVertical className="w-5 h-5" />
              </button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className="min-w-[180px] bg-white rounded-md shadow-lg border p-1"
                sideOffset={5}
              >
                <DropdownMenu.Item
                  onClick={() => handleDownloadAnalysis()}
                  className="flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-gray-100 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Download Analysis File
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onClick={() => setShowLogDownloadDialog(true)}
                  className="flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-gray-100 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Download Logs
                </DropdownMenu.Item>

                <DropdownMenu.Separator className="h-px bg-gray-200 my-1" />

                <DropdownMenu.Item
                  onClick={() => setShowEditAnalysisModal(true)}
                  className="flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-gray-100 cursor-pointer"
                >
                  <Edit className="w-4 h-4" />
                  Edit Analysis
                </DropdownMenu.Item>

                <DropdownMenu.Item
                  onClick={() => setShowEditENVModal(true)}
                  className="flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-gray-100 cursor-pointer"
                >
                  <Edit className="w-4 h-4" />
                  Edit Environment
                </DropdownMenu.Item>

                <DropdownMenu.Separator className="h-px bg-gray-200 my-1" />

                <DropdownMenu.Item
                  onClick={handleDeleteLogs}
                  className="flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-gray-100 cursor-pointer text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear/Delete All Logs
                </DropdownMenu.Item>

                <DropdownMenu.Item
                  onClick={handleDeleteAnalysis}
                  className="flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-gray-100 cursor-pointer text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Analysis
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>

      {showLogs && (
        <AnalysisLogs logs={analysis.logs || []} analysis={analysis} />
      )}
      {showEditAnalysisModal && (
        <EditAnalysisModal
          analysis={analysis}
          onClose={() => setShowEditAnalysisModal(false)}
          onSave={handleSaveAnalysis}
        />
      )}
      {showEditENVModal && (
        <EditAnalysisENVModal
          analysis={analysis}
          onClose={() => setShowEditENVModal(false)}
          onSave={handleSaveENV}
        />
      )}
      <LogDownloadDialog
        isOpen={showLogDownloadDialog}
        onClose={() => setShowLogDownloadDialog(false)}
        onDownload={handleDownloadLogs}
      />
    </div>
  );
}

AnalysisItem.propTypes = {
  analysis: PropTypes.shape({
    name: PropTypes.string.isRequired,
    type: PropTypes.oneOf(['oneshot', 'listener']),
    status: PropTypes.string,
    logs: PropTypes.arrayOf(
      PropTypes.shape({
        timestamp: PropTypes.string,
        message: PropTypes.string,
      }),
    ),
  }).isRequired,
  showLogs: PropTypes.bool.isRequired,
  onToggleLogs: PropTypes.func.isRequired,
};
