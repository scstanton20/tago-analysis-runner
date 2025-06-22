// frontend/src/components/analysis/uploadAnalysis.jsx
import { useState, useRef } from 'react';
import { analysisService } from '../../services/analysisService';
import { useWebSocket } from '../../contexts/websocketContext/index';
import Editor from '@monaco-editor/react';
import {
  Paper,
  Stack,
  Group,
  Text,
  Button,
  TextInput,
  FileInput,
  Tabs,
  Alert,
  Collapse,
  ActionIcon,
  Box,
} from '@mantine/core';
import {
  IconChevronDown,
  IconChevronUp,
  IconUpload,
  IconFile,
  IconAlertCircle,
  IconX,
} from '@tabler/icons-react';
import sanitize from 'sanitize-filename';

const DEFAULT_EDITOR_CONTENT = '// Write your analysis code here';

export default function AnalysisCreator({
  targetDepartment = null,
  departmentName = null,
  onClose = null,
}) {
  // Form state
  const [mode, setMode] = useState('upload');
  const [selectedFile, setSelectedFile] = useState(null);
  const [analysisType] = useState('listener');
  const [analysisName, setAnalysisName] = useState('');
  const [editableFileName, setEditableFileName] = useState('');
  const [editorContent, setEditorContent] = useState(DEFAULT_EDITOR_CONTENT);
  const [formTouched, setFormTouched] = useState(false);

  // UI state
  const [isExpanded, setIsExpanded] = useState(false);
  const [error, setError] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // Refs
  const fileInputRef = useRef(null);

  // WebSocket context
  const { loadingAnalyses, analyses } = useWebSocket();

  // Use WebSocket analyses data directly
  const existingAnalyses = analyses ? Object.keys(analyses) : [];
  const currentAnalysisName =
    mode === 'upload' ? editableFileName : analysisName;
  const isCurrentAnalysisLoading =
    currentAnalysisName &&
    (loadingAnalyses.has(currentAnalysisName) || isUploading);

  // Form validation and state checks
  const isInputDisabled = isCurrentAnalysisLoading;
  const hasFormContent =
    selectedFile ||
    editorContent !== DEFAULT_EDITOR_CONTENT ||
    analysisName ||
    editableFileName;
  const showCancelButton = formTouched || hasFormContent || error;
  const isSaveDisabled =
    isCurrentAnalysisLoading ||
    (mode === 'create' && !analysisName) ||
    (mode === 'upload' && (!selectedFile || !editableFileName)) ||
    error;
  const isTabDisabled = hasFormContent && !isCurrentAnalysisLoading;

  // No longer needed - using WebSocket data directly
  // Removed redundant API call that duplicated WebSocket data

  // Validation
  const validateFilename = (filename) => {
    if (!filename) return 'Filename cannot be empty';

    if (filename.includes('.')) {
      return 'Filename cannot contain periods. Extension will be added automatically.';
    }

    const sanitized = sanitize(filename, { replacement: '_' });
    if (filename !== sanitized) {
      return 'Filename contains invalid characters. Please remove: < > : " / \\ | ? * and control characters';
    }

    if (filename.trim() !== filename) {
      return 'Filename cannot start or end with spaces';
    }

    if (filename.length > 200) {
      return 'Filename is too long (max 200 characters)';
    }

    // Check for duplicate names (case-insensitive)
    const existingNamesLower = existingAnalyses.map((name) =>
      name.toLowerCase(),
    );
    if (existingNamesLower.includes(filename.toLowerCase())) {
      const existingName = existingAnalyses.find(
        (name) => name.toLowerCase() === filename.toLowerCase(),
      );
      return `An analysis with this name already exists${
        existingName !== filename ? ` (as "${existingName}")` : ''
      }. Please choose a different name.`;
    }

    return null;
  };

  // Event handlers
  const handleFileChange = (file) => {
    if (!file) {
      resetFileSelection();
      return;
    }

    setFormTouched(true);

    if (!file.name.endsWith('.js') && !file.name.endsWith('.cjs')) {
      setError('Please select a JavaScript file (.js or .cjs)');
      resetFileSelection();
      return;
    }

    const nameWithoutExtension = file.name.replace(/\.(js|cjs)$/, '');
    const validationError = validateFilename(nameWithoutExtension);

    if (validationError) {
      setError(validationError);
      resetFileSelection();
      return;
    }

    setError(null);
    setSelectedFile(file);
    setEditableFileName(nameWithoutExtension);
    setAnalysisName(nameWithoutExtension);
  };

  const handleEditableFileNameChange = (e) => {
    const value = e.target.value;
    setFormTouched(true);
    setEditableFileName(value);
    setError(validateFilename(value));
  };

  const handleAnalysisNameChange = (e) => {
    const value = e.target.value;
    setFormTouched(true);
    setAnalysisName(value);
    setError(validateFilename(value));
  };

  const handleEditorChange = (value) => {
    setEditorContent(value);
    if (value !== DEFAULT_EDITOR_CONTENT) {
      setFormTouched(true);
    }
  };

  const handleModeChange = (newMode) => {
    if (isTabDisabled && mode !== newMode) return;
    setMode(newMode);
  };

  const handleToggleExpanded = () => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);

    if (!newExpanded) {
      resetForm();
    }
  };

  const handleUpload = async () => {
    if (mode === 'create' && !analysisName) {
      setError('Please provide a name for the analysis');
      return;
    }

    const finalFileName = mode === 'upload' ? editableFileName : analysisName;
    const validationError = validateFilename(finalFileName);

    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      let file;
      if (mode === 'upload') {
        file = new File([selectedFile], finalFileName, {
          type: selectedFile.type,
        });
      } else {
        const blob = new Blob([editorContent], { type: 'text/javascript' });
        file = new File([blob], finalFileName, { type: 'text/javascript' });
      }
      await analysisService.uploadAnalysis(
        file,
        analysisType,
        targetDepartment,
      );

      window.alert(
        `Successfully ${mode === 'upload' ? 'uploaded' : 'created'} analysis ${finalFileName}${
          departmentName && departmentName !== 'All Departments'
            ? ` in ${departmentName}`
            : ''
        }`,
      );

      resetForm();

      // If onClose was provided, close the component
      if (onClose) {
        onClose();
      }
    } catch (error) {
      setError(error.message || 'Failed to save analysis');
      console.error('Save failed:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancel = () => {
    resetForm();
  };

  // Utility functions
  const resetForm = () => {
    setSelectedFile(null);
    setEditableFileName('');
    setAnalysisName('');
    setEditorContent(DEFAULT_EDITOR_CONTENT);
    setError(null);
    setFormTouched(false);
    setIsExpanded(false);
  };

  const resetFileSelection = () => {
    setSelectedFile(null);
    setEditableFileName('');
  };

  return (
    <Paper withBorder radius="md" mb="lg" pos="relative">
      {/* Header */}
      <Box
        p="md"
        styles={{
          root: {
            cursor: 'pointer',
            transition: 'background-color 200ms',
            '&:hover': {
              backgroundColor: 'var(--mantine-color-gray-light)',
            },
          },
        }}
        onClick={handleToggleExpanded}
      >
        <Group justify="space-between">
          <Box>
            <Text size="lg" fw={600}>
              Analysis Creator
              {departmentName && departmentName !== 'All Departments' && (
                <Text span size="sm" fw={400} c="dimmed" ml="xs">
                  - '{departmentName}' group
                </Text>
              )}
            </Text>
          </Box>
          <Group gap="xs">
            {isExpanded && onClose && (
              <ActionIcon
                variant="subtle"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
              >
                <IconX size={20} />
              </ActionIcon>
            )}
            <ActionIcon variant="subtle" color="brand">
              {isExpanded ? (
                <IconChevronUp size={20} />
              ) : (
                <IconChevronDown size={20} />
              )}
            </ActionIcon>
          </Group>
        </Group>
      </Box>

      {/* Expanded Content */}
      <Collapse in={isExpanded}>
        <Box
          p="lg"
          pt={0}
          style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}
        >
          <Stack>
            {/* Mode Toggle */}
            <Tabs value={mode} onChange={handleModeChange}>
              <Tabs.List>
                <Tabs.Tab
                  value="upload"
                  disabled={isTabDisabled && mode !== 'upload'}
                >
                  Upload Existing File
                </Tabs.Tab>
                <Tabs.Tab
                  value="create"
                  disabled={isTabDisabled && mode !== 'create'}
                >
                  Create New Analysis
                </Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="upload" pt="md">
                <Stack>
                  <FileInput
                    ref={fileInputRef}
                    accept=".js,.cjs"
                    placeholder="Choose file"
                    label="Select JavaScript file"
                    value={selectedFile}
                    onChange={handleFileChange}
                    disabled={isInputDisabled}
                    leftSection={<IconUpload size={16} />}
                    rightSection={selectedFile && <IconFile size={16} />}
                  />

                  {selectedFile && (
                    <TextInput
                      label="Edit Filename"
                      value={editableFileName}
                      onChange={handleEditableFileNameChange}
                      placeholder="Enter filename (no extension)"
                      disabled={isInputDisabled}
                      error={error && error.includes('already exists')}
                    />
                  )}

                  <Text size="sm" c="dimmed">
                    The .cjs extension will be added automatically by the
                    backend as Tago.IO requires CommonJS modules.
                  </Text>
                </Stack>
              </Tabs.Panel>

              <Tabs.Panel value="create" pt="md">
                <Stack>
                  <TextInput
                    label="Analysis Name"
                    value={analysisName}
                    onChange={handleAnalysisNameChange}
                    placeholder="Enter analysis name (no extension)"
                    disabled={isInputDisabled}
                    error={error && error.includes('already exists')}
                  />

                  <Text size="sm" c="dimmed">
                    The .cjs extension will be added automatically by the
                    backend as Tago.IO requires CommonJS modules.
                  </Text>

                  <Text size="sm" c="dimmed">
                    You will be able to edit the environment variables after
                    creation.
                  </Text>

                  <Box
                    h={384}
                    style={{
                      border: '1px solid var(--mantine-color-gray-3)',
                      borderRadius: 'var(--mantine-radius-md)',
                      overflow: 'hidden',
                    }}
                  >
                    <Editor
                      height="100%"
                      defaultLanguage="javascript"
                      value={editorContent}
                      onChange={handleEditorChange}
                      theme="vs-dark"
                      options={{
                        minimap: { enabled: true },
                        scrollBeyondLastLine: false,
                        fontSize: 14,
                        automaticLayout: true,
                        wordWrap: 'on',
                        lineNumbers: 'on',
                        readOnly: isInputDisabled,
                      }}
                    />
                  </Box>
                </Stack>
              </Tabs.Panel>
            </Tabs>

            {/* Error Message */}
            {error && (
              <Alert
                icon={<IconAlertCircle size={16} />}
                color="red"
                variant="light"
              >
                {error}
              </Alert>
            )}

            {/* Action Buttons */}
            <Group>
              <Button
                onClick={handleUpload}
                disabled={isSaveDisabled}
                loading={isCurrentAnalysisLoading}
                color="green"
              >
                Save Analysis
              </Button>

              {showCancelButton && (
                <Button
                  variant="default"
                  onClick={handleCancel}
                  disabled={isInputDisabled}
                >
                  Cancel
                </Button>
              )}
            </Group>
          </Stack>
        </Box>
      </Collapse>
    </Paper>
  );
}
