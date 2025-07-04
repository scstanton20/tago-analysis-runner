// frontend/src/components/departmentalSidebar.jsx
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
import DepartmentManagementModal from './modals/departmentManagementModal';
import UserManagementModal from './modals/userManagementModal';
import ProfileModal from './modals/profileModal';
import { departmentService } from '../services/departmentService';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';

// Sortable Department Item
const SortableDepartmentItem = ({
  department,
  isSelected,
  onClick,
  analysisCount,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: department.id,
    disabled: department.isSystem,
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
        const handle = e.currentTarget.querySelector('.department-drag-handle');
        if (handle) handle.style.opacity = '1';
      }}
      onMouseLeave={(e) => {
        const handle = e.currentTarget.querySelector('.department-drag-handle');
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
            {department.name}
          </Text>
        }
        leftSection={
          <Group gap={6}>
            <ColorSwatch color={department.color} size={16} />
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
            {!department.isSystem && (
              <Box
                {...attributes}
                {...listeners}
                className="department-drag-handle"
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
            cursor: department.isSystem ? 'pointer' : 'default', // Different cursor for system departments
            '&[dataActive]': {
              background:
                'linear-gradient(135deg, var(--mantine-color-brand-1) 0%, var(--mantine-color-accent-1) 100%)',
              color: 'var(--mantine-color-brand-8)',
              borderLeft: '3px solid var(--mantine-color-brand-6)',
              fontWeight: 500,
            },
            '&:hover': {
              '& .department-drag-handle': {
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

// Main Departmental Sidebar Component
export default function DepartmentalSidebar({
  selectedDepartment,
  onDepartmentSelect,
}) {
  const { departments, getDepartmentAnalysisCount } = useSSE();
  const { user, logout, isAdmin } = useAuth();
  const { canAccessDepartment, isAdmin: hasAdminPerms } = usePermissions();

  const [showManageModal, setShowManageModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [draggedAnalysis, setDraggedAnalysis] = useState(null);
  const [activeDeptId, setActiveDeptId] = useState(null);

  // Convert departments object to sorted array for display, filtered by user access (memoized)
  const departmentsArray = useMemo(() => {
    const allDepts = Object.values(departments).sort(
      (a, b) => a.order - b.order,
    );

    // If user is admin, return all departments
    if (hasAdminPerms) {
      return allDepts;
    }

    // For non-admin users, filter departments based on permissions
    return allDepts.filter((dept) => {
      // Always show system departments if they have analyses (they are shown regardless of permissions)
      if (dept.isSystem) {
        return true; // System department visibility is handled elsewhere
      }
      // For custom departments, check if user has access
      return canAccessDepartment(dept.id);
    });
  }, [departments, hasAdminPerms, canAccessDepartment]);

  // Use the efficient count function from WebSocket hook
  const getAnalysisCount = (deptId) => {
    return getDepartmentAnalysisCount(deptId);
  };

  const handleDepartmentClick = (deptId) => {
    onDepartmentSelect?.(deptId);
  };

  const handleAnalysisDrop = async (e, deptId) => {
    e.preventDefault();
    if (!draggedAnalysis) return;

    try {
      await departmentService.moveAnalysisToDepartment(draggedAnalysis, deptId);
      console.log(`Moved analysis ${draggedAnalysis} to department ${deptId}`);
    } catch (error) {
      console.error('Error moving analysis:', error);
    }

    setDraggedAnalysis(null);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = departmentsArray.findIndex((d) => d.id === active.id);
      const newIndex = departmentsArray.findIndex((d) => d.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(departmentsArray, oldIndex, newIndex);

        try {
          await departmentService.reorderDepartments(newOrder.map((d) => d.id));
        } catch (error) {
          console.error('Error reordering departments:', error);
        }
      }
    }
    setActiveDeptId(null);
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
            Departments
          </Text>
        </Group>

        <Group mt="md" gap="xs">
          <Button
            variant={!selectedDepartment ? 'gradient' : 'default'}
            gradient={
              !selectedDepartment
                ? { from: 'brand.6', to: 'accent.6' }
                : undefined
            }
            size="xs"
            style={{ flex: 1 }}
            onClick={() => handleDepartmentClick(null)}
          >
            All Analyses
          </Button>
          {hasAdminPerms && (
            <Tooltip label="Manage departments">
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
          {isAdmin() && (
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

      {/* Department List */}
      <ScrollArea style={{ flex: 1 }} p="md">
        <Stack gap="xs">
          {departmentsArray.length === 0 ? (
            <Text c="dimmed" size="sm" ta="center" py="md">
              Loading departments...
            </Text>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
              onDragStart={(event) => setActiveDeptId(event.active.id)}
            >
              <SortableContext
                items={departmentsArray.map((d) => d.id)}
                strategy={verticalListSortingStrategy}
              >
                {departmentsArray
                  .filter((dept) => {
                    // Hide system departments if they have no analyses
                    if (dept.isSystem) {
                      return getAnalysisCount(dept.id) > 0;
                    }
                    return true; // Show all non-system departments regardless of count
                  })
                  .map((dept) => (
                    <div
                      key={dept.id}
                      onDrop={(e) => handleAnalysisDrop(e, dept.id)}
                      onDragOver={(e) => e.preventDefault()}
                      style={{
                        borderRadius: 'var(--mantine-radius-md)',
                        outline: draggedAnalysis
                          ? '2px solid var(--mantine-color-brand-filled)'
                          : 'none',
                        outlineOffset: '2px',
                      }}
                    >
                      <SortableDepartmentItem
                        department={dept}
                        isSelected={selectedDepartment === dept.id}
                        onClick={() => handleDepartmentClick(dept.id)}
                        analysisCount={getAnalysisCount(dept.id)}
                      />
                    </div>
                  ))}
              </SortableContext>
              <DragOverlay>
                {activeDeptId ? (
                  <Box style={{ opacity: 0.8 }}>
                    <SortableDepartmentItem
                      department={departmentsArray.find(
                        (d) => d.id === activeDeptId,
                      )}
                      isSelected={false}
                      onClick={() => {}}
                      analysisCount={getAnalysisCount(activeDeptId)}
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

      {/* Department Management Modal */}
      <DepartmentManagementModal
        opened={showManageModal}
        onClose={() => setShowManageModal(false)}
        departments={departments}
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
