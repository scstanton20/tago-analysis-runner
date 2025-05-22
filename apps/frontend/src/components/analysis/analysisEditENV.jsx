import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import Editor from '@monaco-editor/react';
import { analysisService } from '../../services/analysisService';

export default function EditAnalysisENVModal({ onClose, analysis }) {
  const [content, setContent] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadContent() {
      try {
        setIsLoading(true);
        setError(null);
        console.log('Loading ENV content for:', analysis.name);
        const fileContent = await analysisService.getAnalysisENVContent(
          analysis.name,
        );
        setContent(fileContent);
      } catch (error) {
        console.error('Failed to load analysis content:', error);
        setError(error.message);
      } finally {
        setIsLoading(false);
      }
    }

    if (analysis.name) {
      loadContent();
    }
  }, [analysis.name]);

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

      await analysisService.updateAnalysisENV(analysis.name, content);

      alert('Analysis ENV updated successfully!');
      setHasChanges(false);
      onClose(); // Close modal after successful save
    } catch (error) {
      console.error('Save failed:', error);
      setError(error.message || 'Failed to update analysis ENV content.');
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
          <h2 className="text-xl font-semibold">
            Editing Environment: {analysis.name}
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
EditAnalysisENVModal.propTypes = {
  analysis: PropTypes.shape({
    name: PropTypes.string.isRequired,
  }).isRequired,
  onClose: PropTypes.func.isRequired,
};
