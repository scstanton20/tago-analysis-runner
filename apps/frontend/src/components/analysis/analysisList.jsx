// frontend/src/components/analysis/analysisList.jsx
import { useState, useMemo } from 'react';
import { useSSE } from '../../contexts/sseContext';
import { usePermissions } from '../../hooks/usePermissions';
import AnalysisItem from './analysisItem';
import {
  Paper,
  Stack,
  Group,
  Text,
  Button,
  Center,
  Loader,
  Box,
  Alert,
} from '@mantine/core';
import { IconFileText, IconInfoCircle, IconUserX } from '@tabler/icons-react';

export default function AnalysisList({
  analyses = null,
  showTeamLabels = false,
  selectedTeam = null,
}) {
  const { analyses: allAnalyses = {}, connectionStatus, getTeam } = useSSE();

  const { accessibleDepartments, isAdmin } = usePermissions();

  const [openLogIds, setOpenLogIds] = useState(new Set());

  // Determine which analyses to show (memoized for performance)
  const analysesToShow = useMemo(() => {
    // If pre-filtered analyses are provided
    if (analyses !== null) {
      if (typeof analyses === 'object') {
        return analyses;
      }
    }

    // Use WebSocket data and apply team filtering
    if (selectedTeam) {
      const filtered = {};
      Object.entries(allAnalyses).forEach(([name, analysis]) => {
        if (
          analysis.teamId === selectedTeam ||
          analysis.department === selectedTeam
        ) {
          filtered[name] = analysis;
        }
      });
      return filtered;
    }

    return allAnalyses;
  }, [analyses, allAnalyses, selectedTeam]);

  // Convert to array for rendering (memoized)
  const analysesArray = useMemo(() => {
    const array = Object.values(analysesToShow).filter(
      (analysis) => analysis && analysis.name, // Ensure valid analysis objects
    );
    return array;
  }, [analysesToShow]);

  // Helper function to get team info
  const getTeamInfo = (teamId) => {
    if (!teamId || teamId === 'uncategorized') {
      return { name: 'Uncategorized', color: '#9ca3af' };
    }

    const team = getTeam(teamId);
    if (team) {
      return team;
    }

    // Fallback for missing teams
    console.warn(`Team ${teamId} not found`);
    return { name: 'Unknown Team', color: '#ef4444' };
  };

  // Log toggle functions
  const toggleAllLogs = () => {
    if (openLogIds.size === analysesArray.length) {
      setOpenLogIds(new Set());
    } else {
      setOpenLogIds(new Set(analysesArray.map((analysis) => analysis.name)));
    }
  };

  const toggleLog = (analysisName) => {
    setOpenLogIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(analysisName)) {
        newSet.delete(analysisName);
      } else {
        newSet.add(analysisName);
      }
      return newSet;
    });
  };

  // Handle loading state
  if (connectionStatus === 'connecting') {
    return (
      <Paper p="lg" withBorder radius="md">
        <Stack>
          <Text size="lg" fw={600}>
            Available Analyses
          </Text>
          <Center py="xl">
            <Group>
              <Loader size="sm" />
              <Text c="dimmed">Connecting to server...</Text>
            </Group>
          </Center>
        </Stack>
      </Paper>
    );
  }

  // Handle disconnected state
  if (connectionStatus === 'disconnected') {
    return (
      <Paper p="lg" withBorder radius="md">
        <Stack>
          <Text size="lg" fw={600}>
            Available Analyses
          </Text>
          <Alert
            icon={<IconInfoCircle size={16} />}
            color="red"
            variant="light"
          >
            Disconnected from server. Attempting to reconnect...
          </Alert>
        </Stack>
      </Paper>
    );
  }

  const hasAnalyses = analysesArray.length > 0;
  const totalAnalyses = Object.keys(allAnalyses).length;

  // Check if user has no department access (non-admin users only)
  const hasNoDepartmentAccess =
    !isAdmin && (!accessibleDepartments || accessibleDepartments.length === 0);

  // Get current team info for display
  const currentTeamInfo = selectedTeam ? getTeam?.(selectedTeam) : null;

  return (
    <Paper p="lg" withBorder radius="md">
      <Stack>
        {/* Header */}
        <Group justify="space-between" mb="md">
          <Box>
            <Text size="lg" fw={600}>
              {selectedTeam ? 'Team Analyses' : 'All Analyses'}
            </Text>

            {/* Team info */}
            {selectedTeam && currentTeamInfo && (
              <Group gap="xs" mt={4}>
                <Box
                  w={12}
                  h={12}
                  style={{
                    borderRadius: '50%',
                    backgroundColor: currentTeamInfo.color,
                  }}
                />
                <Text size="sm" c="dimmed" fw={500}>
                  {currentTeamInfo.name}
                </Text>
              </Group>
            )}

            {/* Count info */}
            <Text size="sm" c="dimmed" mt={4}>
              {hasAnalyses
                ? selectedTeam
                  ? `Showing ${analysesArray.length} of ${totalAnalyses} analyses`
                  : `${analysesArray.length} ${analysesArray.length === 1 ? 'analysis' : ''}${analysesArray.length !== 1 ? 'analyses' : ''} available`
                : selectedTeam
                  ? 'No analyses in this team'
                  : 'No analyses available'}
            </Text>
          </Box>

          {/* Log toggle button */}
          {hasAnalyses && (
            <Button
              onClick={toggleAllLogs}
              variant="light"
              size="sm"
              color="brand"
              leftSection={<IconFileText size={16} />}
            >
              {openLogIds.size === analysesArray.length
                ? 'Close All Logs'
                : 'Open All Logs'}
            </Button>
          )}
        </Group>

        {/* Content */}
        <Stack gap="md">
          {hasNoDepartmentAccess ? (
            /* No Department Access State */
            <Center py="xl">
              <Stack align="center" gap="md">
                <Alert
                  icon={<IconUserX size={20} />}
                  color="orange"
                  variant="light"
                  style={{ maxWidth: 500 }}
                >
                  <Stack gap="sm">
                    <Text fw={500}>No Team Access</Text>
                    <Text size="sm">
                      You haven't been assigned to any teams yet. Please contact
                      an administrator to request access to the teams you need.
                    </Text>
                  </Stack>
                </Alert>
              </Stack>
            </Center>
          ) : hasAnalyses ? (
            analysesArray.map((analysis) => {
              const teamInfo = getTeamInfo(
                analysis.teamId || analysis.department,
              );

              return (
                <Stack key={`analysis-${analysis.name}`} gap="xs">
                  {/* Team Label (when showing all analyses) */}
                  {showTeamLabels && !selectedTeam && (
                    <Group gap="xs">
                      <Box
                        w={12}
                        h={12}
                        style={{
                          borderRadius: '50%',
                          backgroundColor: teamInfo.color,
                        }}
                      />
                      <Text size="sm" c="dimmed" fw={500}>
                        {teamInfo.name}
                      </Text>
                    </Group>
                  )}

                  {/* Analysis Item */}
                  <AnalysisItem
                    analysis={analysis}
                    showLogs={openLogIds.has(analysis.name)}
                    onToggleLogs={() => toggleLog(analysis.name)}
                    teamInfo={showTeamLabels ? teamInfo : null}
                  />
                </Stack>
              );
            })
          ) : (
            /* Empty State */
            <Center py="xl">
              <Stack align="center" gap="md">
                <Box ta="center">
                  <Text c="dimmed" size="md" mb="xs">
                    {selectedTeam
                      ? 'No analyses found in this team'
                      : totalAnalyses === 0
                        ? 'No analyses available'
                        : 'Loading analyses...'}
                  </Text>

                  <Text c="dimmed" size="sm">
                    {selectedTeam
                      ? 'Try selecting a different team or create a new analysis here.'
                      : totalAnalyses === 0
                        ? 'Upload an analysis file to get started.'
                        : 'Please wait while analyses load from the server.'}
                  </Text>
                </Box>

                {/* Additional context for team view */}
                {selectedTeam && currentTeamInfo && (
                  <Alert
                    icon={<IconInfoCircle size={16} />}
                    color="blue"
                    variant="light"
                    style={{ maxWidth: 400 }}
                  >
                    You can create a new analysis for the{' '}
                    <strong>{currentTeamInfo.name}</strong> team using the
                    analysis creator above.
                  </Alert>
                )}
              </Stack>
            </Center>
          )}
        </Stack>
      </Stack>
    </Paper>
  );
}
