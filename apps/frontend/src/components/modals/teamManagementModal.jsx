// frontend/src/components/modals/teamManagementModal.jsx
import { useState, useMemo, useRef, useCallback } from 'react';
import { useKeyPress } from '../../hooks/useEventListener';
import {
  DndContext,
  closestCenter,
  useSensor,
  useSensors,
  PointerSensor,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  Box,
  Stack,
  Group,
  Text,
  ActionIcon,
  Button,
  Paper,
  ColorSwatch,
  Modal,
  TextInput,
  Divider,
  SimpleGrid,
  CheckIcon,
} from '@mantine/core';
import { IconEdit, IconTrash, IconX } from '@tabler/icons-react';
import { teamService } from '../../services/teamService';
import { useNotifications } from '../../hooks/useNotifications.jsx';

const PREDEFINED_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#f97316', // orange
  '#6366f1', // indigo
  '#14b8a6', // teal
  '#a855f7', // purple
];

const ColorSwatchWithSelection = ({
  color,
  isUsed,
  isSelected,
  onClick,
  size = 32,
}) => (
  <ColorSwatch
    component="button"
    color={color}
    size={size}
    onClick={
      !isUsed
        ? (e) => {
            e.preventDefault();
            e.stopPropagation();
            onClick();
          }
        : undefined
    }
    style={{
      cursor: isUsed ? 'not-allowed' : 'pointer',
      opacity: isUsed ? 0.4 : 1,
      color: '#fff',
      border: isSelected
        ? '3px solid var(--mantine-color-blue-6)'
        : '2px solid transparent',
      boxSizing: 'border-box',
    }}
    disabled={isUsed}
  >
    {isUsed ? (
      <IconX size={size * 0.5} />
    ) : isSelected ? (
      <CheckIcon size={size * 0.4} />
    ) : null}
  </ColorSwatch>
);

export default function TeamManagementModal({ opened, onClose, teams }) {
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamColor, setNewTeamColor] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [editingColor, setEditingColor] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const notify = useNotifications();

  // Refs for click outside functionality
  const editingRef = useRef();
  const deletingRef = useRef();

  // Escape key handler for deleting mode
  const handleEscape = useCallback(() => {
    if (deletingId) {
      setDeletingId(null);
    }
  }, [deletingId]);

  // Only listen for escape when in deleting mode
  useKeyPress('Escape', handleEscape);

  // Convert teams object to sorted array for display
  const teamsArray = useMemo(
    () => Object.values(teams).sort((a, b) => a.order - b.order),
    [teams],
  );

  // Get used colors and names
  const usedColors = useMemo(
    () => new Set(teamsArray.map((team) => team.color)),
    [teamsArray],
  );

  const usedNames = useMemo(
    () => new Set(teamsArray.map((team) => team.name.toLowerCase().trim())),
    [teamsArray],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    if (!newTeamName.trim() || !newTeamColor || isLoading) return;

    // Check for duplicate name
    if (usedNames.has(newTeamName.toLowerCase().trim())) {
      notify.error(
        'A team with this name already exists. Please choose a different name.',
      );
      return;
    }

    setIsLoading(true);
    try {
      await notify.createTeam(
        teamService.createTeam(newTeamName.trim(), newTeamColor),
        newTeamName.trim(),
      );
      setNewTeamName('');
      setNewTeamColor('');
    } catch (error) {
      console.error('Error creating team:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateName = async (id) => {
    const currentTeam = teamsArray.find((d) => d.id === id);
    if (!editingName.trim() || editingName === currentTeam?.name || isLoading) {
      setEditingId(null);
      return;
    }

    // Check for duplicate name (excluding current team)
    const otherNames = new Set(
      teamsArray
        .filter((team) => team.id !== id)
        .map((team) => team.name.toLowerCase().trim()),
    );

    if (otherNames.has(editingName.toLowerCase().trim())) {
      notify.error(
        'A team with this name already exists. Please choose a different name.',
      );
      return;
    }

    setIsLoading(true);
    try {
      await notify.updateTeam(
        teamService.updateTeam(id, {
          name: editingName.trim(),
        }),
        editingName.trim(),
      );
      setEditingId(null);
    } catch (error) {
      console.error('Error updating team name:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleColorClick = (color) => {
    // Just update the local editing color state, don't make API call yet
    setEditingColor(color);
  };

  const handleSaveColorChange = async (id) => {
    if (!editingColor || isLoading) {
      setEditingId(null);
      setEditingColor('');
      return;
    }

    setIsLoading(true);
    try {
      const currentTeam = teamsArray.find((d) => d.id === id);
      await notify.executeWithNotification(
        teamService.updateTeam(id, { color: editingColor }),
        {
          loading: `Updating ${currentTeam?.name || 'team'} color...`,
          success: 'Team color updated successfully.',
        },
      );
      setEditingId(null);
      setEditingColor('');
    } catch (error) {
      console.error('Error updating team color:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      const currentTeam = teamsArray.find((d) => d.id === id);
      await notify.deleteTeam(
        teamService.deleteTeam(id, 'uncategorized'),
        currentTeam?.name || 'team',
      );
      setDeletingId(null);
    } catch (error) {
      console.error('Error deleting team:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;

    if (active.id !== over.id && !isLoading) {
      const oldIndex = teamsArray.findIndex((d) => d.id === active.id);
      const newIndex = teamsArray.findIndex((d) => d.id === over.id);
      const newOrder = arrayMove(teamsArray, oldIndex, newIndex);

      setIsLoading(true);
      try {
        await notify.executeWithNotification(
          teamService.reorderTeams(newOrder.map((d) => d.id)),
          {
            loading: 'Reordering teams...',
            success: 'Teams reordered successfully.',
          },
        );
      } catch (error) {
        console.error('Error reordering teams:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const startEditingColor = (team) => {
    setEditingId(team.id);
    setEditingName(team.name);
    setEditingColor(team.color);
  };

  const getAvailableColors = (excludeColor = null) => {
    const exclude = new Set(usedColors);
    if (excludeColor) exclude.delete(excludeColor);
    return PREDEFINED_COLORS.filter((color) => !exclude.has(color));
  };

  const handleModalClose = () => {
    // Reset all pending changes when modal closes
    setNewTeamName('');
    setNewTeamColor('');
    setEditingId(null);
    setEditingName('');
    setEditingColor('');
    setDeletingId(null);
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleModalClose}
      title="Manage Teams"
      size="lg"
    >
      <Stack>
        {/* Create New Team */}
        <Box>
          <Text size="sm" fw={600} mb="sm">
            Create New Team
          </Text>
          <form onSubmit={handleCreateTeam}>
            <Stack gap="sm">
              <TextInput
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder="Team name"
                size="sm"
                disabled={isLoading}
                error={
                  usedNames.has(newTeamName.toLowerCase().trim()) &&
                  newTeamName.trim()
                    ? 'This name is already in use'
                    : null
                }
              />

              <Box>
                <Text size="xs" c="dimmed" mb="xs">
                  Choose a color (required):
                </Text>
                <SimpleGrid cols={6} spacing="xs">
                  {PREDEFINED_COLORS.map((color) => (
                    <ColorSwatchWithSelection
                      key={color}
                      color={color}
                      isUsed={usedColors.has(color)}
                      isSelected={newTeamColor === color}
                      onClick={() => setNewTeamColor(color)}
                      size={32}
                    />
                  ))}
                </SimpleGrid>
                {getAvailableColors().length === 0 && (
                  <Text size="xs" c="orange" mt="xs">
                    All predefined colors are in use.
                  </Text>
                )}
              </Box>

              <Group justify="space-between">
                {newTeamColor ? (
                  <Group gap="xs">
                    <Text size="xs" c="dimmed">
                      Selected:
                    </Text>
                    <ColorSwatch color={newTeamColor} size={20} />
                    <Text size="xs" fw={500}>
                      {newTeamColor}
                    </Text>
                  </Group>
                ) : (
                  <Text size="xs" c="dimmed">
                    No color selected
                  </Text>
                )}
                <Button
                  type="submit"
                  disabled={
                    !newTeamName.trim() ||
                    !newTeamColor ||
                    usedNames.has(newTeamName.toLowerCase().trim()) ||
                    isLoading
                  }
                  loading={isLoading}
                  size="sm"
                  color="green"
                >
                  Create
                </Button>
              </Group>
            </Stack>
          </form>
        </Box>

        <Divider />

        {/* Existing Teams */}
        <Box>
          <Text size="sm" fw={600} mb="sm">
            Existing Teams
          </Text>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={teamsArray.map((d) => d.id)}
              strategy={verticalListSortingStrategy}
            >
              <Stack gap="xs">
                {teamsArray.map((team) => (
                  <Paper key={team.id} p="sm" withBorder>
                    {editingId === team.id ? (
                      // Editing mode
                      <Stack gap="sm" ref={editingRef}>
                        <TextInput
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleUpdateName(team.id);
                            } else if (e.key === 'Escape') {
                              setEditingId(null);
                            }
                          }}
                          size="sm"
                          autoFocus
                          disabled={isLoading}
                          error={(() => {
                            const trimmed = editingName.toLowerCase().trim();
                            const otherNames = new Set(
                              teamsArray
                                .filter((d) => d.id !== team.id)
                                .map((d) => d.name.toLowerCase().trim()),
                            );
                            return otherNames.has(trimmed) && editingName.trim()
                              ? 'This name is already in use'
                              : null;
                          })()}
                        />

                        <Box>
                          <Text size="xs" c="dimmed" mb="xs">
                            Choose a color:
                          </Text>
                          <SimpleGrid cols={6} spacing="xs">
                            {PREDEFINED_COLORS.map((color) => (
                              <ColorSwatchWithSelection
                                key={color}
                                color={color}
                                isUsed={
                                  usedColors.has(color) && color !== team.color
                                }
                                isSelected={editingColor === color}
                                onClick={() => handleColorClick(color)}
                                size={28}
                              />
                            ))}
                          </SimpleGrid>
                        </Box>

                        <Group justify="space-between">
                          <Group gap="xs">
                            <Text size="xs" c="dimmed">
                              {editingColor ? 'Preview:' : 'Current:'}
                            </Text>
                            <ColorSwatch
                              color={editingColor || team.color}
                              size={16}
                            />
                            <Text size="xs" fw={500}>
                              {editingColor || team.color}
                            </Text>
                          </Group>
                          <Group gap="xs">
                            {editingColor && editingColor !== team.color && (
                              <Button
                                size="xs"
                                onClick={() => handleSaveColorChange(team.id)}
                                loading={isLoading}
                                disabled={isLoading}
                              >
                                Save
                              </Button>
                            )}
                            {editingName !== team.name && (
                              <Button
                                size="xs"
                                variant="light"
                                onClick={() => handleUpdateName(team.id)}
                                loading={isLoading}
                                disabled={isLoading}
                              >
                                Save Name
                              </Button>
                            )}
                            <Button
                              size="xs"
                              variant="default"
                              onClick={() => {
                                setEditingId(null);
                                setEditingColor('');
                              }}
                              disabled={isLoading}
                            >
                              {(editingColor && editingColor !== team.color) ||
                              editingName !== team.name
                                ? 'Cancel'
                                : 'Done'}
                            </Button>
                          </Group>
                        </Group>
                      </Stack>
                    ) : deletingId === team.id ? (
                      // Delete confirmation mode
                      <Stack gap="sm" ref={deletingRef}>
                        <Group gap="sm" align="center">
                          <ColorSwatch color={team.color} size={20} />
                          <Text size="sm" style={{ flex: 1 }}>
                            {team.name}
                          </Text>
                        </Group>
                        <Paper p="sm" withBorder>
                          <Text size="sm" c="red.8" mb="sm">
                            Are you sure you want to delete this team? All
                            analyses will be moved to Uncategorized.
                          </Text>
                          <Group gap="xs">
                            <Button
                              size="xs"
                              color="red"
                              onClick={() => handleDelete(team.id)}
                              loading={isLoading}
                              disabled={isLoading}
                            >
                              Delete
                            </Button>
                            <Button
                              size="xs"
                              variant="default"
                              onClick={() => setDeletingId(null)}
                              disabled={isLoading}
                            >
                              Cancel
                            </Button>
                          </Group>
                        </Paper>
                      </Stack>
                    ) : (
                      // Display mode
                      <Group gap="sm">
                        <ColorSwatch color={team.color} size={20} />
                        <Text size="sm" style={{ flex: 1 }}>
                          {team.name}
                        </Text>
                        {!team.isSystem && (
                          <Group gap={4}>
                            <ActionIcon
                              variant="subtle"
                              size="sm"
                              onClick={() => startEditingColor(team)}
                              disabled={isLoading}
                            >
                              <IconEdit size={16} />
                            </ActionIcon>
                            <ActionIcon
                              variant="subtle"
                              size="sm"
                              color="red"
                              onClick={() => setDeletingId(team.id)}
                              disabled={isLoading}
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Group>
                        )}
                      </Group>
                    )}
                  </Paper>
                ))}
              </Stack>
            </SortableContext>
          </DndContext>
        </Box>
      </Stack>
    </Modal>
  );
}
