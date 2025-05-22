import { useState, useRef, useEffect } from 'react';
import { analysisService } from '../../services/analysisService';
import { useWebSocket } from '../../contexts/websocketContext/index';
import Editor from '@monaco-editor/react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { statusService } from '../../services/statusServices';

export default function AnalysisCreator() {
  const [mode, setMode] = useState('upload');
  const [selectedFile, setSelectedFile] = useState(null);
  const [analysisType, setAnalysisType] = useState('listener');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [analysisName, setAnalysisName] = useState('');
  const [editableFileName, setEditableFileName] = useState('');
  const [editorContent, setEditorContent] = useState(
    '// Write your analysis code here',
  );
  const [isExpanded, setIsExpanded] = useState(false);
  const fileInputRef = useRef(null);
  const { connectionStatus } = useWebSocket();
  const [sdkVersion, setSdkVersion] = useState('');

  useEffect(() => {
    const fetchVersion = async () => {
      const status = await statusService.getSystemStatus();
      setSdkVersion(status.tagoConnection.sdkVersion);
    };
    fetchVersion();
  }, []);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (!file.name.endsWith('.js')) {
        setError('Please select a JavaScript file (.js)');
        setSelectedFile(null);
        setEditableFileName('');
        event.target.value = null;
        return;
      }
      setError(null);
      setSelectedFile(file);
      setEditableFileName(file.name);
      setAnalysisName(file.name.replace('.js', ''));
    }
  };

  const handleUpload = async () => {
    if (mode === 'create' && !analysisName) {
      setError('Please provide a name for the analysis');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      if (mode === 'upload') {
        if (!selectedFile) return;
        // Create a new file with the edited filename
        const newFile = new File([selectedFile], editableFileName, {
          type: selectedFile.type,
        });
        await analysisService.uploadAnalysis(newFile, analysisType);
      } else {
        // Create new analysis - automatically append .js extension
        const fileName = `${analysisName}.js`;
        const blob = new Blob([editorContent], { type: 'text/javascript' });
        const file = new File([blob], fileName, { type: 'text/javascript' });
        await analysisService.uploadAnalysis(file, analysisType);
      }

      window.alert(
        `Successfully ${mode === 'upload' ? 'uploaded' : 'created'} analysis ${mode === 'upload' ? editableFileName : analysisName}`,
      );

      // Reset form
      setSelectedFile(null);
      setEditableFileName('');
      setEditorContent('// Write your analysis code here');
      setAnalysisName('');
      setIsExpanded(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      setError(error.message || 'Failed to save analysis');
      console.error('Save failed:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    setSelectedFile(null);
    setEditableFileName('');
    setError(null);
    setAnalysisName('');
    setEditorContent('// Write your analysis code here');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const isDisabled =
    uploading ||
    connectionStatus !== 'connected' ||
    (mode === 'create' && !analysisName);
  const isTabDisabled =
    (selectedFile || editorContent !== '// Write your analysis code here') &&
    !uploading;

  return (
    <>
      <div className="bg-white rounded-lg shadow-md mb-8">
        <div
          className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <h2 className="text-xl font-semibold">Analysis Creator</h2>
          <button className="text-gray-500 hover:text-gray-700">
            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
        </div>

        {isExpanded && (
          <div className="p-6 pt-2 border-t">
            <div className="space-y-4">
              {/* Mode Toggle */}
              <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex space-x-8">
                  <button
                    onClick={() => !isTabDisabled && setMode('upload')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      mode === 'upload'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500'
                    } ${
                      isTabDisabled && mode !== 'upload'
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:text-gray-700 hover:border-gray-300'
                    }`}
                    disabled={isTabDisabled && mode !== 'upload'}
                  >
                    Upload Existing File
                  </button>
                  <button
                    onClick={() => !isTabDisabled && setMode('create')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      mode === 'create'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500'
                    } ${
                      isTabDisabled && mode !== 'create'
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:text-gray-700 hover:border-gray-300'
                    }`}
                    disabled={isTabDisabled && mode !== 'create'}
                  >
                    Create New Analysis
                  </button>
                </nav>
              </div>

              {/* Analysis Name - Only shown in create mode */}
              {mode === 'create' && (
                <div className="space-y-2">
                  <label
                    htmlFor="analysis-name"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Analysis Name
                  </label>
                  <input
                    type="text"
                    id="analysis-name"
                    value={analysisName}
                    onChange={(e) => setAnalysisName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter analysis name"
                    disabled={uploading}
                  />
                  <p className="text-sm text-gray-500">
                    .js extension will be added automatically.
                  </p>
                  <p className="text-sm text-gray-500">
                    You will be able to edit the environment variables after
                    creation.
                  </p>
                </div>
              )}

              {mode === 'upload' ? (
                /* File Upload UI */
                <div className="space-y-4">
                  <div className="flex items-center space-x-4">
                    <input
                      type="file"
                      onChange={handleFileChange}
                      ref={fileInputRef}
                      accept=".js"
                      className="hidden"
                      id="analysis-file"
                      disabled={isDisabled}
                    />
                    <label
                      htmlFor="analysis-file"
                      className={`px-4 py-2 rounded cursor-pointer text-white ${
                        connectionStatus === 'connected'
                          ? 'bg-blue-500 hover:bg-blue-600'
                          : 'bg-gray-400 cursor-not-allowed'
                      }`}
                    >
                      Choose File
                    </label>
                    <span className="text-gray-600">
                      {selectedFile ? selectedFile.name : 'No file chosen'}
                    </span>
                  </div>

                  {/* Editable filename field */}
                  {selectedFile && (
                    <div className="space-y-2">
                      <label
                        htmlFor="filename"
                        className="block text-sm font-medium text-gray-700"
                      >
                        Edit Filename
                      </label>
                      <input
                        type="text"
                        id="filename"
                        value={editableFileName}
                        onChange={(e) => setEditableFileName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter filename (with .js extension)"
                        disabled={uploading}
                      />
                    </div>
                  )}
                </div>
              ) : (
                /* Editor UI */
                <div className="h-96 border border-gray-300 rounded-md overflow-hidden">
                  <Editor
                    height="100%"
                    defaultLanguage="javascript"
                    value={editorContent}
                    onChange={setEditorContent}
                    theme="vs-dark"
                    options={{
                      minimap: { enabled: true },
                      scrollBeyondLastLine: false,
                      fontSize: 14,
                      automaticLayout: true,
                      wordWrap: 'on',
                      lineNumbers: 'on',
                    }}
                  />
                </div>
              )}

              {/* Analysis Type Selection */}
              <div className="flex items-center space-x-6">
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="analysisType"
                    value="listener"
                    checked={analysisType === 'listener'}
                    onChange={(e) => setAnalysisType(e.target.value)}
                    className="form-radio text-blue-500"
                    disabled={uploading}
                  />
                  <span>Connect via Tago SDK {sdkVersion}</span>
                </label>
              </div>

              {/* Error Message */}
              {error && <div className="text-red-500 text-sm">{error}</div>}

              {/* Action Buttons */}
              <div className="flex space-x-4">
                <button
                  onClick={handleUpload}
                  disabled={isDisabled}
                  className={`px-4 py-2 rounded text-white ${
                    isDisabled
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-green-500 hover:bg-green-600'
                  }`}
                >
                  {uploading ? (
                    <span className="flex items-center">
                      <svg
                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Saving...
                    </span>
                  ) : (
                    'Save Analysis'
                  )}
                </button>
                {(selectedFile ||
                  editorContent !== '// Write your analysis code here') && (
                  <button
                    onClick={handleCancel}
                    className="px-4 py-2 rounded text-gray-600 hover:text-gray-800"
                    disabled={uploading}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>

            {/* Connection Status */}
            {connectionStatus !== 'connected' && (
              <div className="mt-4 p-2 bg-yellow-100 text-yellow-700 rounded">
                Not connected to server. Please wait for connection to be
                established.
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
