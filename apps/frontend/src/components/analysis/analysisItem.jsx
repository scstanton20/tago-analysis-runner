// frontend/src/components/analysis/analysisItem.jsx
import { useState } from 'react';
import PropTypes from 'prop-types';
import {
  Paper,
  Group,
  Text,
  Button,
  Menu,
  ActionIcon,
  Badge,
  Stack,
  Box,
} from '@mantine/core';
import {
  IconPlayerPlay,
  IconPlayerStop,
  IconFileText,
  IconDownload,
  IconEdit,
  IconTrash,
  IconDotsVertical,
  IconFolderPlus,
  IconFolderCog,
} from '@tabler/icons-react';
import { analysisService } from '../../services/analysisService';
import { departmentService } from '../../services/departmentService';
import AnalysisLogs from './analysisLogs';
import StatusBadge from './statusBadge';
import { lazy, Suspense } from 'react';

// Lazy load heavy components that include Monaco editor
const AnalysisEditModal = lazy(() => import('../modals/analysisEdit'));
const AnalysisEditENVModal = lazy(() => import('../modals/analysisEditENV'));
import LogDownloadDialog from '../modals/logDownload';
import DepartmentSelectModal from '../modals/changeDepartmentModal';
import { useWebSocket } from '../../contexts/websocketContext';
import { usePermissions } from '../../hooks/usePermissions';

export default function AnalysisItem({ analysis, showLogs, onToggleLogs }) {
  const [showEditAnalysisModal, setShowEditAnalysisModal] = useState(false);
  const [showEditENVModal, setShowEditENVModal] = useState(false);
  const [showLogDownloadDialog, setShowLogDownloadDialog] = useState(false);
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);

  const {
    loadingAnalyses,
    addLoadingAnalysis,
    removeLoadingAnalysis,
    departments,
  } = useWebSocket();
  const {
    canRunAnalyses,
    canViewAnalyses,
    canEditAnalyses,
    canDeleteAnalyses,
    canDownloadAnalyses,
    canAccessDepartment,
    isAdmin,
  } = usePermissions();
  const isLoading = loadingAnalyses.has(analysis.name);

  if (!analysis || !analysis.name) {
    return null;
  }

  // Get current department info
  const allDepartments = Array.isArray(departments)
    ? departments
    : Object.values(departments || {});

  // Filter departments based on user permissions (admins see all, users see only accessible ones)
  const departmentsArray = isAdmin
    ? allDepartments
    : allDepartments.filter((dept) => canAccessDepartment(dept.id));
  const currentDepartment = departmentsArray.find(
    (d) => d.id === analysis.department,
  );
  const isUncategorized =
    !analysis.department || analysis.department === 'uncategorized';

  const handleRun = async () => {
    addLoadingAnalysis(analysis.name);
    try {
      await analysisService.runAnalysis(analysis.name);
    } catch (error) {
      console.error('Failed to run analysis:', error);
      removeLoadingAnalysis(analysis.name);
    }
  };

  const handleStop = async () => {
    addLoadingAnalysis(analysis.name);
    try {
      await analysisService.stopAnalysis(analysis.name);
    } catch (error) {
      console.error('Failed to stop analysis:', error);
      removeLoadingAnalysis(analysis.name);
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

  const handleEditAnalysis = async () => {
    if (!canViewAnalyses()) {
      return; // No permission to view analysis files
    }
    setShowEditAnalysisModal(true);
  };

  const handleEditENV = async () => {
    if (!canViewAnalyses()) {
      return; // No permission to view analysis files
    }
    setShowEditENVModal(true);
  };

  const handleDownloadLogs = async (timeRange) => {
    try {
      await analysisService.downloadLogs(analysis.name, timeRange);
    } catch (error) {
      console.error('Failed to download logs:', error);
    }
  };

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

  const handleDepartmentChange = async (departmentId) => {
    try {
      await departmentService.moveAnalysisToDepartment(
        analysis.name,
        departmentId,
      );
      console.log(
        `Moved analysis ${analysis.name} to department ${departmentId}`,
      );
      setShowDepartmentModal(false);
    } catch (error) {
      console.error('Error moving analysis:', error);
    }
  };

  return (
    <Paper
      p="md"
      withBorder
      radius="md"
      className="analysis-card"
      style={{
        borderLeft: '3px solid var(--mantine-color-brand-4)',
        transition: 'all 0.3s ease',
      }}
    >
      <Stack>
        <Group justify="space-between">
          <Group>
            <Box
              px="sm"
              py="xs"
              style={{
                backgroundColor: 'var(--mantine-color-brand-9)',
                borderRadius: 'var(--mantine-radius-sm)',
                border: '1px solid var(--mantine-color-brand-7)',
              }}
            >
              <Text fw={600} size="md" c="white">
                {analysis.name}
              </Text>
            </Box>
            <StatusBadge status={analysis.status || 'stopped'} />
            {currentDepartment && (
              <Badge
                variant="light"
                color="brand"
                size="sm"
                leftSection={
                  <Box
                    w={8}
                    h={8}
                    style={{
                      borderRadius: '50%',
                      backgroundColor: currentDepartment.color,
                    }}
                  />
                }
              >
                {currentDepartment.name}
              </Badge>
            )}
          </Group>

          <Group gap="xs">
            {/* Primary Actions */}
            {canRunAnalyses() &&
              (analysis.status === 'running' ? (
                <Button
                  onClick={handleStop}
                  loading={isLoading}
                  color="red"
                  size="xs"
                  leftSection={<IconPlayerStop size={16} />}
                >
                  Stop
                </Button>
              ) : (
                <Button
                  onClick={handleRun}
                  loading={isLoading}
                  variant="gradient"
                  gradient={{ from: 'teal.6', to: 'green.6' }}
                  size="xs"
                  leftSection={<IconPlayerPlay size={16} />}
                >
                  Run
                </Button>
              ))}

            {/* Log Actions */}
            <Button
              onClick={onToggleLogs}
              variant="light"
              color="brand"
              size="xs"
              leftSection={<IconFileText size={16} />}
            >
              {showLogs ? 'Hide Logs' : 'Show Logs'}
            </Button>

            {/* Show menu if user has any permissions */}
            {(isAdmin ||
              canViewAnalyses() ||
              canDownloadAnalyses() ||
              canEditAnalyses() ||
              canDeleteAnalyses()) && (
              <Menu
                shadow="md"
                width={200}
                withinPortal={true}
                position="bottom-end"
                closeOnItemClick={true}
              >
                <Menu.Target>
                  <ActionIcon variant="subtle" size="lg" color="brand">
                    <IconDotsVertical size={20} />
                  </ActionIcon>
                </Menu.Target>

                <Menu.Dropdown>
                  {/* Department Management - Admins can move any analysis, users can move uncategorized */}
                  {(isAdmin || isUncategorized) && (
                    <>
                      <Menu.Item
                        onClick={() => setShowDepartmentModal(true)}
                        leftSection={
                          isUncategorized ? (
                            <IconFolderPlus size={16} />
                          ) : (
                            <IconFolderCog size={16} />
                          )
                        }
                      >
                        {isUncategorized
                          ? 'Add to Department'
                          : 'Change Department'}
                      </Menu.Item>
                      <Menu.Divider />
                    </>
                  )}

                  {/* File Operations */}
                  {canDownloadAnalyses() && (
                    <>
                      <Menu.Item
                        onClick={handleDownloadAnalysis}
                        leftSection={<IconDownload size={16} />}
                      >
                        Download Analysis File
                      </Menu.Item>
                      <Menu.Item
                        onClick={() => setShowLogDownloadDialog(true)}
                        leftSection={<IconDownload size={16} />}
                      >
                        Download Logs
                      </Menu.Item>
                      <Menu.Divider />
                    </>
                  )}

                  {/* Analysis File Operations - Show view or edit based on permissions */}
                  {canViewAnalyses() && (
                    <>
                      <Menu.Item
                        onClick={handleEditAnalysis}
                        leftSection={
                          canEditAnalyses() ? (
                            <IconEdit size={16} />
                          ) : (
                            <IconFileText size={16} />
                          )
                        }
                      >
                        {canEditAnalyses()
                          ? 'Edit Analysis'
                          : 'View Analysis File'}
                      </Menu.Item>
                      <Menu.Item
                        onClick={handleEditENV}
                        leftSection={
                          canEditAnalyses() ? (
                            <IconEdit size={16} />
                          ) : (
                            <IconFileText size={16} />
                          )
                        }
                      >
                        {canEditAnalyses()
                          ? 'Edit Environment'
                          : 'View Environment'}
                      </Menu.Item>
                      <Menu.Divider />
                    </>
                  )}

                  {/* Destructive Operations */}
                  {canDeleteAnalyses() && (
                    <>
                      <Menu.Item
                        onClick={handleDeleteLogs}
                        color="red"
                        leftSection={<IconTrash size={16} />}
                      >
                        Clear/Delete All Logs
                      </Menu.Item>
                      <Menu.Item
                        onClick={handleDeleteAnalysis}
                        color="red"
                        leftSection={<IconTrash size={16} />}
                      >
                        Delete Analysis
                      </Menu.Item>
                    </>
                  )}
                </Menu.Dropdown>
              </Menu>
            )}
          </Group>
        </Group>

        {/* Logs Section */}
        {showLogs && <AnalysisLogs analysis={analysis} />}
      </Stack>

      {/* Modals - Render if user can view analyses */}
      {showEditAnalysisModal && canViewAnalyses() && (
        <Suspense fallback={<div>Loading editor...</div>}>
          <AnalysisEditModal
            analysis={analysis}
            onClose={() => setShowEditAnalysisModal(false)}
            onSave={handleSaveAnalysis}
            readOnly={!canEditAnalyses()}
          />
        </Suspense>
      )}
      {showEditENVModal && canViewAnalyses() && (
        <Suspense fallback={<div>Loading editor...</div>}>
          <AnalysisEditENVModal
            analysis={analysis}
            onClose={() => setShowEditENVModal(false)}
            onSave={handleSaveENV}
            readOnly={!canEditAnalyses()}
          />
        </Suspense>
      )}
      <LogDownloadDialog
        isOpen={showLogDownloadDialog}
        onClose={() => setShowLogDownloadDialog(false)}
        onDownload={handleDownloadLogs}
      />
      {showDepartmentModal && (
        <DepartmentSelectModal
          isOpen={showDepartmentModal}
          onClose={() => setShowDepartmentModal(false)}
          onSelect={handleDepartmentChange}
          departments={departmentsArray}
          currentDepartment={analysis.department}
          analysisName={analysis.name}
        />
      )}
    </Paper>
  );
}

AnalysisItem.propTypes = {
  analysis: PropTypes.shape({
    name: PropTypes.string.isRequired,
    type: PropTypes.oneOf(['listener']),
    status: PropTypes.string,
    department: PropTypes.string,
    logs: PropTypes.arrayOf(
      PropTypes.shape({
        timestamp: PropTypes.string,
        message: PropTypes.string,
      }),
    ),
  }).isRequired,
  showLogs: PropTypes.bool.isRequired,
  onToggleLogs: PropTypes.func.isRequired,
  departmentInfo: PropTypes.shape({
    name: PropTypes.string,
    color: PropTypes.string,
  }),
};
