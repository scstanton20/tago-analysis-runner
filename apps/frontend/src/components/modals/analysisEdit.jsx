// frontend/src/components/analysis/analysisEdit.jsx
import { useState } from 'react';
import PropTypes from 'prop-types';
import Editor from '@monaco-editor/react';
import { analysisService } from '../../services/analysisService';
import {
  Modal,
  Stack,
  Group,
  Text,
  Button,
  TextInput,
  Alert,
  Box,
  ActionIcon,
  LoadingOverlay,
} from '@mantine/core';
import {
  IconEdit,
  IconCheck,
  IconX,
  IconAlertCircle,
} from '@tabler/icons-react';
import { useSSE } from '../../contexts/sseContext';
import { useNotifications } from '../../hooks/useNotifications.jsx';

export default function EditAnalysisModal({
  onClose,
  analysis: initialAnalysis,
  readOnly = false,
}) {
  const [content, setContent] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newFileName, setNewFileName] = useState(initialAnalysis.name);

  // FIXED: Get analyses object from WebSocket context
  const { analyses } = useSSE();
  const notify = useNotifications();

  // FIXED: Use direct object lookup instead of array.find()
  const currentAnalysis = analyses?.[initialAnalysis.name] || initialAnalysis;

  // Update analysis name when it changes via WebSocket (derived state)
  if (currentAnalysis.name !== newFileName && !isEditingName) {
    setNewFileName(currentAnalysis.name);
  }

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
        const fileContent = await analysisService.getAnalysisContent(
          currentAnalysis.name,
        );
        setContent(fileContent);
      } catch (error) {
        console.error('Failed to load analysis content:', error);
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
    setContent(value);
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      setIsLoading(true);
      setError(null);

      await notify.updateAnalysis(
        analysisService.updateAnalysis(currentAnalysis.name, content),
        currentAnalysis.name,
      );

      setHasChanges(false);
      onClose();
    } catch (error) {
      console.error('Save failed:', error);
      setError(error.message || 'Failed to update analysis content.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRename = async () => {
    try {
      if (!newFileName.trim()) {
        setError('Filename cannot be empty');
        return;
      }

      if (newFileName === currentAnalysis.name) {
        setIsEditingName(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      await notify.executeWithNotification(
        analysisService.renameAnalysis(currentAnalysis.name, newFileName),
        {
          loading: `Renaming ${currentAnalysis.name} to ${newFileName}...`,
          success: `Analysis renamed to ${newFileName} successfully.`,
        },
      );

      // Don't close the modal - WebSockets will update the name
      setIsEditingName(false);
    } catch (error) {
      console.error('Rename failed:', error);
      setError(error.message || 'Failed to rename analysis.');
      // Reset the filename input to the current name if rename fails
      setNewFileName(currentAnalysis.name);
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
          <Text fw={600}>
            {readOnly ? 'Viewing' : 'Editing'} Analysis Content:
          </Text>
          {!readOnly && isEditingName ? (
            <Group gap="xs">
              <TextInput
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                size="xs"
                autoFocus
                style={{ width: 200 }}
              />
              <ActionIcon
                color="green"
                size="sm"
                onClick={handleRename}
                disabled={isLoading}
              >
                <IconCheck size={16} />
              </ActionIcon>
              <ActionIcon
                color="red"
                size="sm"
                onClick={() => {
                  setIsEditingName(false);
                  setNewFileName(currentAnalysis.name);
                }}
                disabled={isLoading}
              >
                <IconX size={16} />
              </ActionIcon>
            </Group>
          ) : (
            <Group gap={4}>
              <Text>{currentAnalysis.name}</Text>
              {!readOnly && (
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  onClick={() => setIsEditingName(true)}
                  disabled={isLoading}
                >
                  <IconEdit size={14} />
                </ActionIcon>
              )}
            </Group>
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

        <Box style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <LoadingOverlay visible={isLoading} />
          {!isLoading && (
            <Editor
              height="100%"
              defaultLanguage="javascript"
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
                readOnly: readOnly,
              }}
            />
          )}
        </Box>

        <Group
          justify="flex-end"
          pt="md"
          style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}
        >
          <Button variant="default" onClick={onClose}>
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

EditAnalysisModal.propTypes = {
  analysis: PropTypes.shape({
    name: PropTypes.string.isRequired,
    type: PropTypes.oneOf(['listener']),
    status: PropTypes.string,
    enabled: PropTypes.bool,
    logs: PropTypes.arrayOf(
      PropTypes.shape({
        timestamp: PropTypes.string,
        message: PropTypes.string,
      }),
    ),
  }).isRequired,
  onClose: PropTypes.func.isRequired,
  readOnly: PropTypes.bool,
};
