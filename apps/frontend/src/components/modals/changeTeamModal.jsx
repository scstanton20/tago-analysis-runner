// frontend/src/components/analysis/teamSelectModal.jsx
import { useState } from 'react';
import PropTypes from 'prop-types';
import {
  Modal,
  Stack,
  Group,
  Text,
  Button,
  UnstyledButton,
  Badge,
  ColorSwatch,
  Alert,
  ScrollArea,
} from '@mantine/core';
import { IconFolder, IconCheck, IconInfoCircle } from '@tabler/icons-react';

const ChangeTeamModal = ({
  isOpen,
  onClose,
  onSelect,
  teams,
  currentTeam,
  analysisName,
}) => {
  const [selectedTeam, setSelectedTeam] = useState(currentTeam);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (selectedTeam === currentTeam) {
      onClose();
      return;
    }

    setIsSubmitting(true);
    try {
      await onSelect(selectedTeam);
    } catch (error) {
      console.error('Error changing team:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal opened={isOpen} onClose={onClose} title="Change Team" size="md">
      <Stack>
        <Text size="sm" c="dimmed">
          Select a new team for{' '}
          <Text span fw={600}>
            {analysisName}
          </Text>
          :
        </Text>

        <ScrollArea h={300} offsetScrollbars>
          <Stack gap="xs">
            {[...teams]
              .sort((a, b) => a.order - b.order)
              .map((team) => (
                <UnstyledButton
                  key={team.id}
                  onClick={() => setSelectedTeam(team.id)}
                  p="sm"
                  mod={{ selected: selectedTeam === team.id }}
                  styles={{
                    root: {
                      border: `2px solid ${
                        selectedTeam === team.id
                          ? 'var(--mantine-color-blue-filled)'
                          : 'var(--mantine-color-default-border)'
                      }`,
                      borderRadius: 'var(--mantine-radius-md)',
                      backgroundColor:
                        selectedTeam === team.id
                          ? 'var(--mantine-color-blue-light)'
                          : 'transparent',
                      transition: 'all 200ms ease',
                      '&:hover': {
                        borderColor:
                          selectedTeam === team.id
                            ? 'var(--mantine-color-blue-filled-hover)'
                            : 'var(--mantine-color-gray-filled)',
                        backgroundColor:
                          selectedTeam === team.id
                            ? 'var(--mantine-color-blue-light-hover)'
                            : 'var(--mantine-color-gray-light)',
                      },
                    },
                  }}
                >
                  <Group justify="space-between" wrap="nowrap">
                    <Group gap="sm">
                      <ColorSwatch color={team.color} size={20} />
                      <IconFolder size={20} />
                      <Text size="sm" fw={500}>
                        {team.name}
                      </Text>
                    </Group>
                    <Group gap="xs">
                      {selectedTeam === team.id && (
                        <IconCheck
                          size={16}
                          color="var(--mantine-color-blue-6)"
                        />
                      )}
                      {currentTeam === team.id && (
                        <Badge size="xs" variant="light">
                          Current
                        </Badge>
                      )}
                    </Group>
                  </Group>
                </UnstyledButton>
              ))}
          </Stack>
        </ScrollArea>

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            loading={isSubmitting}
            disabled={selectedTeam === currentTeam}
          >
            Move Analysis
          </Button>
        </Group>

        {selectedTeam !== currentTeam && (
          <Alert
            icon={<IconInfoCircle size={16} />}
            color="blue"
            variant="light"
          >
            This will move the analysis to{' '}
            <Text span fw={600}>
              {[...teams].find((d) => d.id === selectedTeam)?.name}
            </Text>
            . The change will be visible to all users.
          </Alert>
        )}
      </Stack>
    </Modal>
  );
};

ChangeTeamModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSelect: PropTypes.func.isRequired,
  teams: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      color: PropTypes.string.isRequired,
      order: PropTypes.number.isRequired,
    }),
  ).isRequired,
  currentTeam: PropTypes.string,
  analysisName: PropTypes.string.isRequired,
};

export default ChangeTeamModal;
