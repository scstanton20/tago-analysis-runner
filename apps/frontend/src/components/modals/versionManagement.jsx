import { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import {
  Modal,
  Stack,
  Text,
  Button,
  Group,
  Table,
  Badge,
  Alert,
  ActionIcon,
  Box,
  Divider,
  LoadingOverlay,
} from '@mantine/core';
import {
  IconHistory,
  IconDownload,
  IconPlayerPlay,
  IconInfoCircle,
  IconClock,
  IconFileText,
} from '@tabler/icons-react';
import { analysisService } from '../../services/analysisService';
import { useNotifications } from '../../hooks/useNotifications';

export default function VersionManagementModal({
  isOpen,
  onClose,
  analysis,
  onVersionRollback,
}) {
  const [versionData, setVersionData] = useState({
    versions: [],
    nextVersionNumber: 2,
    currentVersion: 1,
  });
  const [loading, setLoading] = useState(false);
  const [rollbackLoading, setRollbackLoading] = useState(null);
  const notify = useNotifications();

  const loadVersions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await analysisService.getVersions(analysis.name);
      setVersionData(data);
    } catch (error) {
      console.error('Failed to load versions:', error);
      const errorMessage = error.message || 'Failed to load version history';
      notify.error(errorMessage);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis.name]);

  // Load versions when modal opens (derived state)
  const [hasLoadedVersionData, setHasLoadedVersionData] = useState(false);
  const [currentAnalysisName, setCurrentAnalysisName] = useState(
    analysis?.name,
  );

  if (
    isOpen &&
    analysis?.name &&
    (!hasLoadedVersionData || analysis.name !== currentAnalysisName)
  ) {
    setHasLoadedVersionData(true);
    setCurrentAnalysisName(analysis.name);
    loadVersions();
  }

  // Reset loaded flag when modal closes
  if (!isOpen && hasLoadedVersionData) {
    setHasLoadedVersionData(false);
  }

  const handleRollback = async (version) => {
    if (
      !window.confirm(
        `Are you sure you want to rollback to version ${version}? This will clear the current logs and restart the analysis if it's running.`,
      )
    ) {
      return;
    }

    setRollbackLoading(version);
    try {
      await notify.executeWithNotification(
        analysisService.rollbackToVersion(analysis.name, version),
        {
          loading: `Rolling back ${analysis.name} to version ${version}...`,
          success: `Successfully rolled back to version ${version}`,
        },
      );

      if (onVersionRollback) {
        onVersionRollback(version);
      }

      // Reload versions to update current version indicator
      await loadVersions();
    } catch (error) {
      console.error('Failed to rollback:', error);
    } finally {
      setRollbackLoading(null);
    }
  };

  const handleDownloadVersion = async (version) => {
    try {
      await notify.executeWithNotification(
        analysisService.downloadAnalysis(analysis.name, version),
        {
          loading: `Downloading version ${version} of ${analysis.name}...`,
          success: 'Version downloaded successfully',
        },
      );
    } catch (error) {
      console.error('Failed to download version:', error);
    }
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const currentVersionNumber = versionData.currentVersion;
  const sortedVersions = [...versionData.versions]
    .filter((version) => version.version !== currentVersionNumber)
    .sort((a, b) => b.version - a.version);

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title={
        <Group gap="sm">
          <IconHistory size={20} />
          <Text fw={600}>Version History - {analysis?.name}</Text>
        </Group>
      }
      size="lg"
      centered
    >
      <Stack gap="md">
        <Alert
          icon={<IconInfoCircle size={16} />}
          title="Version Management"
          color="blue"
          variant="light"
        >
          <Text size="sm">
            Each time you save changes to this analysis, a new version is
            automatically created. You can rollback to any previous version,
            which will clear the logs and restart the analysis if running.
            Environment variables remain unchanged during rollback.
          </Text>
        </Alert>

        {loading ? (
          <Box pos="relative" h={200}>
            <LoadingOverlay visible />
          </Box>
        ) : versionData.versions.length === 0 ? (
          <Alert
            icon={<IconInfoCircle size={16} />}
            title="No Version History"
            color="yellow"
            variant="light"
          >
            <Text size="sm">
              No previous versions found. Versions will be created automatically
              when you make changes to the analysis.
            </Text>
          </Alert>
        ) : (
          <>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                {versionData.versions.length} saved version
                {versionData.versions.length !== 1 ? 's' : ''} found
              </Text>
              <Badge
                variant="light"
                color="blue"
                leftSection={<IconFileText size={12} />}
              >
                Current: v{currentVersionNumber}
              </Badge>
            </Group>

            <Divider />

            <Table highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Version</Table.Th>
                  <Table.Th>Created</Table.Th>
                  <Table.Th>Size</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                <Table.Tr>
                  <Table.Td>
                    <Group gap="xs">
                      <Badge color="green" variant="filled" size="sm">
                        CURRENT
                      </Badge>
                      <Text fw={600}>v{currentVersionNumber}</Text>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <IconClock size={14} />
                      <Text size="sm">Active Version</Text>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      -
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <ActionIcon
                        variant="light"
                        color="blue"
                        size="sm"
                        onClick={() => handleDownloadVersion(0)}
                        title="Download current version"
                      >
                        <IconDownload size={14} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
                {sortedVersions.map((version) => (
                  <Table.Tr key={version.version}>
                    <Table.Td>
                      <Text fw={500}>v{version.version}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <IconClock size={14} />
                        <Text size="sm">{formatDate(version.timestamp)}</Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{formatSize(version.size)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <ActionIcon
                          variant="light"
                          color="blue"
                          size="sm"
                          onClick={() => handleDownloadVersion(version.version)}
                          title={`Download version ${version.version}`}
                        >
                          <IconDownload size={14} />
                        </ActionIcon>
                        <ActionIcon
                          variant="light"
                          color="orange"
                          size="sm"
                          onClick={() => handleRollback(version.version)}
                          loading={rollbackLoading === version.version}
                          title={`Rollback to version ${version.version}`}
                        >
                          <IconPlayerPlay size={14} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </>
        )}

        <Group justify="flex-end" mt="md">
          <Button onClick={onClose} variant="light">
            Close
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

VersionManagementModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  analysis: PropTypes.shape({
    name: PropTypes.string.isRequired,
  }),
  onVersionRollback: PropTypes.func,
};
