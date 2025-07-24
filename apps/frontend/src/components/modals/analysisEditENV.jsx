// frontend/src/components/analysis/analysisEditENV.jsx
import { useState } from 'react';
import PropTypes from 'prop-types';
import Editor from '@monaco-editor/react';
import { analysisService } from '../../services/analysisService';
import { useSSE } from '../../contexts/sseContext';
import { useNotifications } from '../../hooks/useNotifications.jsx';
import {
  Modal,
  Stack,
  Group,
  Text,
  Button,
  Alert,
  Box,
  LoadingOverlay,
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';

export default function EditAnalysisENVModal({
  onClose,
  analysis,
  readOnly = false,
}) {
  const [content, setContent] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // ADDED: Get current analysis from WebSocket context for consistency
  const { getAnalysis } = useSSE();
  const currentAnalysis = getAnalysis(analysis.name) || analysis;
  const notify = useNotifications();

  // Load content when analysis name changes (derived state)
  const [currentAnalysisName, setCurrentAnalysisName] = useState(
    currentAnalysis.name,
  );

  if (currentAnalysis.name !== currentAnalysisName) {
    setCurrentAnalysisName(currentAnalysis.name);

    async function loadContent() {
      try {
        setIsLoading(true);
        setError(null);
        console.log('Loading ENV content for:', currentAnalysis.name);

        const fileContent = await analysisService.getAnalysisENVContent(
          currentAnalysis.name,
        );

        setContent(fileContent);
      } catch (error) {
        console.error('Failed to load analysis ENV content:', error);
        setError(error.message);
      } finally {
        setIsLoading(false);
      }
    }

    if (currentAnalysis.name) {
      loadContent();
    }
  }

  const handleEditorChange = (value) => {
    // Ensure value is a string
    if (typeof value !== 'string') return;

    // Process the content to enforce "KEY=value" format
    const formattedContent = value
      .split('\n')
      .map((line) => {
        if (line.trim().startsWith('#') || line.trim() === '') {
          return line; // Keep comments and empty lines as they are
        }

        const [key, ...valueParts] = line.split('='); // Split only on first `=`
        if (!key || valueParts.length === 0) return ''; // Ignore invalid lines

        const formattedKey = key.trim().replace(/\s+/g, '_').toUpperCase(); // Normalize key
        const formattedValue = valueParts.join('=').trim(); // Preserve values

        return `${formattedKey}=${formattedValue}`;
      })
      .join('\n');

    setContent(formattedContent);
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      setIsLoading(true);
      setError(null);

      await notify.executeWithNotification(
        analysisService.updateAnalysisENV(currentAnalysis.name, content),
        {
          loading: `Updating environment for ${currentAnalysis.name}...`,
          success: 'Environment variables updated successfully.',
        },
      );

      setHasChanges(false);
      onClose();
    } catch (error) {
      console.error('Save failed:', error);
      setError(error.message || 'Failed to update analysis ENV content.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      opened
      onClose={onClose}
      size="90%"
      title={
        <Group gap="xs">
          <Text fw={600}>{readOnly ? 'Viewing' : 'Editing'} Environment:</Text>
          <Text>{currentAnalysis.name}</Text>
          {currentAnalysis.status && (
            <Text size="sm" c="dimmed">
              ({currentAnalysis.status})
            </Text>
          )}
        </Group>
      }
      styles={{
        body: {
          height: 'calc(100vh - 200px)',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <Stack h="100%">
        {error && (
          <Alert
            icon={<IconAlertCircle size={16} />}
            color="red"
            variant="light"
          >
            {error}
          </Alert>
        )}

        <Alert
          color="blue"
          variant="light"
          title="Environment Variables Format"
        >
          <Text size="sm">
            Use{' '}
            <Text span ff="monospace">
              KEY=value
            </Text>{' '}
            format. Keys will be automatically normalized to uppercase. Comments
            starting with{' '}
            <Text span ff="monospace">
              #
            </Text>{' '}
            are preserved.
          </Text>
        </Alert>

        <Box style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <LoadingOverlay visible={isLoading} />
          {!isLoading && (
            <Editor
              height="100%"
              defaultLanguage="plaintext"
              value={content}
              onChange={handleEditorChange}
              theme="vs-dark"
              options={{
                minimap: { enabled: true },
                scrollBeyondLastLine: false,
                fontSize: 14,
                automaticLayout: true,
                wordWrap: 'on',
                lineNumbers: 'on',
                folding: true,
                foldingStrategy: 'indentation',
                readOnly: isLoading || readOnly,
              }}
            />
          )}
        </Box>

        <Group
          justify="flex-end"
          pt="md"
          style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}
        >
          <Button variant="default" onClick={onClose} disabled={isLoading}>
            {readOnly ? 'Close' : 'Cancel'}
          </Button>
          {!readOnly && (
            <Button
              onClick={handleSave}
              disabled={!hasChanges}
              loading={isLoading}
              color="brand"
            >
              Save Changes
            </Button>
          )}
        </Group>
      </Stack>
    </Modal>
  );
}

EditAnalysisENVModal.propTypes = {
  analysis: PropTypes.shape({
    name: PropTypes.string.isRequired,
  }).isRequired,
  onClose: PropTypes.func.isRequired,
  readOnly: PropTypes.bool,
};
