// frontend/src/components/connectionStatus.jsx
import { useState, useEffect, useContext, useRef } from 'react';
import { WebSocketContext } from '../contexts/websocketContext';
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

const ConnectionStatus = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { connectionStatus, backendStatus, requestStatusUpdate } =
    useContext(WebSocketContext);
  const containerRef = useRef(null);

  const getOverallStatusColor = () => {
    if (!backendStatus) return 'bg-red-500';

    // Count disconnected services
    let disconnectedCount = 0;

    // Check backend
    if (backendStatus.container_health.status !== 'healthy')
      disconnectedCount++;
    // Check WebSocket
    if (connectionStatus !== 'connected') disconnectedCount++;
    // Tago is considered disconnected if no analyses are running
    if (backendStatus.tagoConnection.runningAnalyses === 0) {
      disconnectedCount++;
    }

    // If all services are down, show red
    if (disconnectedCount === 3) return 'bg-red-500';
    // All services are up
    return 'bg-green-500';
  };

  const getStatusText = () => {
    if (!backendStatus) return 'Loading...';
    if (connectionStatus !== 'connected') return 'Disconnected from Server';
    if (backendStatus.container_health.status !== 'healthy')
      return 'Partially Disconnected';
    if (backendStatus.tagoConnection.runningAnalyses === 0) {
      return 'No Running Analyses';
    }
    return 'Connected';
  };

  const handleRetryConnection = () => {
    // Request fresh status update through WebSocket
    requestStatusUpdate();
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsExpanded(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsExpanded(false);
      }
    };

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isExpanded]);

  // Don't render if we don't have any status data yet
  if (!backendStatus && connectionStatus === 'connecting') {
    return null;
  }

  const isDisconnected =
    connectionStatus !== 'connected' ||
    (backendStatus &&
      (backendStatus.container_health.status !== 'healthy' ||
        backendStatus.tagoConnection.runningAnalyses === 0));

  // Loading overlay that appears when connection status is "connecting"
  const ConnectionLoadingOverlay = () => {
    if (connectionStatus !== 'connecting') return null;

    return (
      <div className="fixed inset-0 backdrop-blur-xs z-50 flex items-center justify-center">
        <div className="bg-white p-6 rounded-lg shadow-lg flex flex-col items-center">
          <Loader2 className="animate-spin h-10 w-10 text-blue-500 mb-4" />
          <p className="text-lg font-medium">Connecting to server...</p>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Loading Overlay */}
      <ConnectionLoadingOverlay />

      <div className="absolute top-4 right-4" ref={containerRef}>
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="flex items-center space-x-2 p-2 rounded-md hover:bg-gray-100"
            aria-label="Toggle connection status details"
            aria-expanded={isExpanded}
          >
            <div
              className={`w-3 h-3 rounded-full ${getOverallStatusColor()}`}
            />
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {isExpanded && (
            <div
              className="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg p-4 z-50 border border-gray-200"
              role="dialog"
              aria-label="Connection status details"
            >
              <h3 className="font-medium mb-3">System Status</h3>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Backend:</span>
                  <div className="flex items-center">
                    <div
                      className={`w-2 h-2 rounded-full mr-2 ${
                        backendStatus &&
                        backendStatus.container_health.status === 'healthy'
                          ? 'bg-green-500'
                          : 'bg-red-500'
                      }`}
                    />
                    <span className="text-sm capitalize">
                      {backendStatus?.container_health.status || 'unknown'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm">WebSocket:</span>
                  <div className="flex items-center">
                    <div
                      className={`w-2 h-2 rounded-full mr-2 ${
                        connectionStatus === 'connected'
                          ? 'bg-green-500'
                          : 'bg-red-500'
                      }`}
                    />
                    <span className="text-sm capitalize">
                      {connectionStatus}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm">Tago Analyses:</span>
                  <div className="flex items-center">
                    <div
                      className={`w-2 h-2 rounded-full mr-2 ${
                        backendStatus &&
                        backendStatus.tagoConnection.runningAnalyses > 0
                          ? 'bg-green-500'
                          : 'bg-yellow-500'
                      }`}
                    />
                    <span className="text-sm">
                      {backendStatus?.tagoConnection.runningAnalyses || 0}{' '}
                      running
                    </span>
                  </div>
                </div>

                {backendStatus?.tagoConnection.sdkVersion && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm">SDK Version:</span>
                    <span className="text-sm text-gray-600">
                      {backendStatus.tagoConnection.sdkVersion}
                    </span>
                  </div>
                )}

                {backendStatus?.container_health.uptime && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Uptime:</span>
                    <span className="text-sm text-gray-600">
                      {backendStatus.container_health.uptime.formatted}
                    </span>
                  </div>
                )}
              </div>

              {isDisconnected && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-sm text-gray-600">{getStatusText()}</p>
                  <button
                    onClick={handleRetryConnection}
                    className="mt-2 text-sm text-blue-500 hover:text-blue-600"
                  >
                    Refresh Status
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ConnectionStatus;
