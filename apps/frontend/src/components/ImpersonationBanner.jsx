import { Alert, Button, Group, Text } from '@mantine/core';
import { IconUserCheck, IconX } from '@tabler/icons-react';
import { useAuth } from '../contexts/AuthProvider';

export default function ImpersonationBanner() {
  const { isImpersonating, user, exitImpersonation } = useAuth();

  if (!isImpersonating) {
    return null;
  }

  const handleExitImpersonation = async () => {
    try {
      await exitImpersonation();
    } catch (error) {
      console.error('Failed to exit impersonation:', error);
    }
  };

  return (
    <Alert
      color="orange"
      variant="filled"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        borderRadius: 0,
        border: 'none',
      }}
    >
      <Group justify="space-between" align="center">
        <Group gap="xs">
          <IconUserCheck size={20} />
          <Text size="sm" fw={600}>
            You are impersonating {user?.name || user?.email}
          </Text>
        </Group>
        <Button
          size="xs"
          variant="white"
          color="orange"
          leftSection={<IconX size={14} />}
          onClick={handleExitImpersonation}
        >
          Exit Impersonation
        </Button>
      </Group>
    </Alert>
  );
}
