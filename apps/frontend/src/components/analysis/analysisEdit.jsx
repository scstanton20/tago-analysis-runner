import { useState, useEffect, useContext } from 'react';
import PropTypes from 'prop-types';
import Editor from '@monaco-editor/react';
import { analysisService } from '../../services/analysisService';
import { WebSocketContext } from '../../contexts/websocketContext/context';

export default function EditAnalysisModal({
  onClose,
  analysis: initialAnalysis,
}) {
  const [content, setContent] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newFileName, setNewFileName] = useState(initialAnalysis.name);

  // Get analyses from WebSocket context
  const { analyses } = useContext(WebSocketContext);

  // Find the current analysis from the WebSocket context
  const currentAnalysis =
    analyses.find((a) => a.name === initialAnalysis.name) || initialAnalysis;

  // Update analysis name when it changes via WebSocket
  useEffect(() => {
    if (currentAnalysis.name !== newFileName && !isEditingName) {
      setNewFileName(currentAnalysis.name);
    }
  }, [currentAnalysis.name, isEditingName, newFileName]);

  useEffect(() => {
    async function loadContent() {
      try {
        setIsLoading(true);
        setError(null);
        console.log('Loading content for:', currentAnalysis.name);
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
  }, [currentAnalysis.name]);

  const handleEditorChange = (value) => {
    setContent(value);
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      setIsLoading(true);
      setError(null);

      await analysisService.updateAnalysis(currentAnalysis.name, content);

      alert('Analysis content updated successfully!');
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

      await analysisService.renameAnalysis(currentAnalysis.name, newFileName);

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

  // Handle overlay click
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Handle modal content click
  const handleModalClick = (e) => {
    e.stopPropagation();
  };

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 backdrop-blur-xs z-50 flex items-center justify-center"
      onClick={handleOverlayClick}
    >
      <div
        className="bg-white w-11/12 h-5/6 rounded-lg flex flex-col relative"
        onClick={handleModalClick}
      >
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-semibold flex items-center">
            {isEditingName ? (
              <div className="flex items-center">
                <input
                  type="text"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  className="border border-gray-300 rounded px-2 py-1 mr-2"
                  autoFocus
                />
                <button
                  onClick={handleRename}
                  className="text-green-600 hover:text-green-800 mr-2"
                  type="button"
                  aria-label="Save filename"
                  disabled={isLoading}
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </button>
                <button
                  onClick={() => {
                    setIsEditingName(false);
                    setNewFileName(currentAnalysis.name);
                  }}
                  className="text-red-600 hover:text-red-800"
                  type="button"
                  aria-label="Cancel rename"
                  disabled={isLoading}
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            ) : (
              <>
                Editing Analysis Content: {currentAnalysis.name}
                <button
                  onClick={() => setIsEditingName(true)}
                  className="ml-2 text-gray-500 hover:text-gray-700"
                  type="button"
                  aria-label="Edit filename"
                  disabled={isLoading}
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                    />
                  </svg>
                </button>
              </>
            )}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
            type="button"
            aria-label="Close editor"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-100 border-b border-red-200 text-red-700">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
          ) : (
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
              }}
            />
          )}
        </div>

        <div className="p-4 border-t flex justify-end space-x-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
            type="button"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || isLoading}
            className={`px-4 py-2 rounded ${
              hasChanges && !isLoading
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
            type="button"
          >
            {isLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

EditAnalysisModal.propTypes = {
  analysis: PropTypes.shape({
    name: PropTypes.string.isRequired,
    type: PropTypes.oneOf(['oneshot', 'listener']),
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
};
