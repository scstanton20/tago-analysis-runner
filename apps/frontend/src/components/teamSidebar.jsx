// frontend/src/components/teamSidebar.jsx
import { useState, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useSSE } from '../contexts/sseContext/index';
import {
  Box,
  Stack,
  Group,
  Text,
  ActionIcon,
  Button,
  Badge,
  ColorSwatch,
  ScrollArea,
  NavLink,
  Tooltip,
} from '@mantine/core';
import {
  IconSettings,
  IconFolder,
  IconGripVertical,
  IconLogout,
  IconUser,
  IconUsers,
  IconUserCog,
} from '@tabler/icons-react';
import TeamManagementModal from './modals/teamManagementModal';
import UserManagementModal from './modals/userManagementModal';
import ProfileModal from './modals/profileModal';
import { teamService } from '../services/teamService';
import { useAuth } from '../contexts/AuthProvider';
import { usePermissions } from '../hooks/usePermissions';

// Sortable Team Item
const SortableTeamItem = ({ team, isSelected, onClick, analysisCount }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: team.id,
    disabled: team.isSystem,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onMouseEnter={(e) => {
        const handle = e.currentTarget.querySelector('.team-drag-handle');
        if (handle) handle.style.opacity = '1';
      }}
      onMouseLeave={(e) => {
        const handle = e.currentTarget.querySelector('.team-drag-handle');
        if (handle) handle.style.opacity = '0';
      }}
    >
      <NavLink
        active={isSelected}
        onClick={onClick}
        label={
          <Text
            size="md"
            fw={500}
            style={{
              wordWrap: 'break-word',
              whiteSpace: 'normal',
              lineHeight: 1.3,
            }}
          >
            {team.name}
          </Text>
        }
        leftSection={
          <Group gap={6}>
            <ColorSwatch color={team.color} size={16} />
            <IconFolder size={18} />
          </Group>
        }
        rightSection={
          <Group gap={4} align="center">
            <Badge
              size="md"
              variant={isSelected ? 'filled' : 'light'}
              color={isSelected ? 'brand' : 'gray'}
            >
              {analysisCount}
            </Badge>
            {!team.isSystem && (
              <Box
                {...attributes}
                {...listeners}
                className="team-drag-handle"
                style={{
                  cursor: 'grab',
                  opacity: 0,
                  transition: 'opacity 200ms',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px',
                  borderRadius: '4px',
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <IconGripVertical size={16} />
              </Box>
            )}
          </Group>
        }
        styles={{
          root: {
            borderRadius: 'var(--mantine-radius-md)',
            marginBottom: 4,
            minHeight: 44,
            cursor: team.isSystem ? 'pointer' : 'default', // Different cursor for system teams
            '&[dataActive]': {
              background:
                'linear-gradient(135deg, var(--mantine-color-brand-1) 0%, var(--mantine-color-accent-1) 100%)',
              color: 'var(--mantine-color-brand-8)',
              borderLeft: '3px solid var(--mantine-color-brand-6)',
              fontWeight: 500,
            },
            '&:hover': {
              '& .team-drag-handle': {
                opacity: 1,
              },
            },
          },
          label: {
            flex: 1,
            overflow: 'visible',
          },
          section: {
            alignItems: 'flex-start',
            paddingTop: 2,
          },
        }}
      />
    </div>
  );
};

// Main Team Sidebar Component
export default function TeamSidebar({ selectedTeam, onTeamSelect }) {
  const { teams, getTeamAnalysisCount } = useSSE();
  const { user, logout, isAdmin } = useAuth();
  const { canAccessTeam, isAdmin: hasAdminPerms } = usePermissions();

  const [showManageModal, setShowManageModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [draggedAnalysis, setDraggedAnalysis] = useState(null);
  const [activeTeamId, setActiveTeamId] = useState(null);

  // Convert teams object to sorted array for display, filtered by user access (memoized)
  const teamsArray = useMemo(() => {
    const allTeams = Object.values(teams).sort((a, b) => {
      // Always put uncategorized (system) teams first
      if (a.isSystem && !b.isSystem) return -1;
      if (!a.isSystem && b.isSystem) return 1;

      // If both are system teams or both are not, sort by order_index then name
      if (a.order_index !== b.order_index) {
        return (a.order_index || 0) - (b.order_index || 0);
      }

      return a.name.localeCompare(b.name);
    });

    // If user is admin, return all teams
    if (hasAdminPerms) {
      return allTeams;
    }

    // For non-admin users, filter teams based on permissions
    return allTeams.filter((team) => {
      // Always show system teams if they have analyses (they are shown regardless of permissions)
      if (team.isSystem) {
        return true; // System team visibility is handled elsewhere
      }
      // For custom teams, check if user has access
      return canAccessTeam(team.id);
    });
  }, [teams, hasAdminPerms, canAccessTeam]);

  // Use the efficient count function from WebSocket hook
  const getAnalysisCount = (teamId) => {
    return getTeamAnalysisCount(teamId);
  };

  const handleTeamClick = (teamId) => {
    onTeamSelect?.(teamId);
  };

  const handleAnalysisDrop = async (e, teamId) => {
    e.preventDefault();
    if (!draggedAnalysis) return;

    try {
      await teamService.moveAnalysisToTeam(draggedAnalysis, teamId);
      console.log(`Moved analysis ${draggedAnalysis} to team ${teamId}`);
    } catch (error) {
      console.error('Error moving analysis:', error);
    }

    setDraggedAnalysis(null);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = teamsArray.findIndex((t) => t.id === active.id);
      const newIndex = teamsArray.findIndex((t) => t.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(teamsArray, oldIndex, newIndex);

        try {
          await teamService.reorderTeams(newOrder.map((t) => t.id));
        } catch (error) {
          console.error('Error reordering teams:', error);
        }
      }
    }
    setActiveTeamId(null);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  return (
    <Stack h="100%" gap={0}>
      {/* Header */}
      <Box
        p="md"
        style={{
          borderBottom: '1px solid var(--mantine-color-default-border)',
        }}
      >
        <Group justify="space-between">
          <Text fw={600} size="xl" c="brand.8">
            Teams
          </Text>
        </Group>

        <Group mt="md" gap="xs">
          <Button
            variant={!selectedTeam ? 'gradient' : 'default'}
            gradient={
              !selectedTeam ? { from: 'brand.6', to: 'accent.6' } : undefined
            }
            size="xs"
            style={{ flex: 1 }}
            onClick={() => handleTeamClick(null)}
          >
            All Analyses
          </Button>
          {hasAdminPerms && (
            <Tooltip label="Manage teams">
              <ActionIcon
                variant="light"
                color="brand"
                size="lg"
                onClick={() => setShowManageModal(true)}
              >
                <IconSettings size={18} />
              </ActionIcon>
            </Tooltip>
          )}
          {isAdmin && (
            <Tooltip label="Manage users">
              <ActionIcon
                variant="light"
                color="accent"
                size="lg"
                onClick={() => setShowUserModal(true)}
              >
                <IconUsers size={18} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      </Box>

      {/* Team List */}
      <ScrollArea style={{ flex: 1 }} p="md">
        <Stack gap="xs">
          {teamsArray.length === 0 ? (
            <Text c="dimmed" size="sm" ta="center" py="md">
              Loading teams...
            </Text>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
              onDragStart={(event) => setActiveTeamId(event.active.id)}
            >
              <SortableContext
                items={teamsArray.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                {teamsArray
                  .filter((team) => {
                    // Hide system teams if they have no analyses
                    if (team.isSystem) {
                      return getAnalysisCount(team.id) > 0;
                    }
                    return true; // Show all non-system teams regardless of count
                  })
                  .map((team) => (
                    <div
                      key={team.id}
                      onDrop={(e) => handleAnalysisDrop(e, team.id)}
                      onDragOver={(e) => e.preventDefault()}
                      style={{
                        borderRadius: 'var(--mantine-radius-md)',
                        outline: draggedAnalysis
                          ? '2px solid var(--mantine-color-brand-filled)'
                          : 'none',
                        outlineOffset: '2px',
                      }}
                    >
                      <SortableTeamItem
                        team={team}
                        isSelected={selectedTeam === team.id}
                        onClick={() => handleTeamClick(team.id)}
                        analysisCount={getAnalysisCount(team.id)}
                      />
                    </div>
                  ))}
              </SortableContext>
              <DragOverlay>
                {activeTeamId ? (
                  <Box style={{ opacity: 0.8 }}>
                    <SortableTeamItem
                      team={teamsArray.find((t) => t.id === activeTeamId)}
                      isSelected={false}
                      onClick={() => {}}
                      analysisCount={getAnalysisCount(activeTeamId)}
                    />
                  </Box>
                ) : null}
              </DragOverlay>
            </DndContext>
          )}
        </Stack>
      </ScrollArea>

      {/* User Footer */}
      <Box
        p="md"
        style={{
          borderTop: '1px solid var(--mantine-color-default-border)',
        }}
      >
        <Group justify="space-between" align="center">
          <Group gap="xs" style={{ flex: 1, minWidth: 0 }}>
            <IconUser size={16} color="var(--mantine-color-brand-6)" />
            <Box style={{ flex: 1, minWidth: 0 }}>
              <Text size="sm" fw={500} truncate>
                Hi, {user?.username || 'User'}
              </Text>
              {user?.role && (
                <Text size="xs" c="dimmed" truncate>
                  {user.role}
                </Text>
              )}
            </Box>
          </Group>
          <Group gap="xs">
            <Tooltip label="Profile Settings">
              <ActionIcon
                variant="light"
                color="brand"
                size="sm"
                onClick={() => setShowProfileModal(true)}
              >
                <IconUserCog size={14} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Logout">
              <ActionIcon
                variant="light"
                color="red"
                size="sm"
                onClick={logout}
              >
                <IconLogout size={14} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      </Box>

      {/* Team Management Modal */}
      <TeamManagementModal
        opened={showManageModal}
        onClose={() => setShowManageModal(false)}
        teams={teams}
      />

      {/* User Management Modal */}
      <UserManagementModal
        opened={showUserModal}
        onClose={() => setShowUserModal(false)}
      />

      {/* Profile Modal */}
      <ProfileModal
        opened={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />
    </Stack>
  );
}
