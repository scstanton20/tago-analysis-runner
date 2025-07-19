// frontend/src/contexts/sseContext/provider.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import { SSEContext } from './context';
import { useAuth } from '../AuthProvider';

export function SSEProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [analyses, setAnalyses] = useState({});
  const [teams, setTeams] = useState({});
  const [loadingAnalyses, setLoadingAnalyses] = useState(new Set());
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [backendStatus, setBackendStatus] = useState(null);
  const [serverShutdown, setServerShutdown] = useState(false);
  const [hasInitialData, setHasInitialData] = useState(false);

  const eventSourceRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 10;
  const maxReconnectDelay = 30000;
  const mountedRef = useRef(true);
  const connectionStatusRef = useRef('connecting');
  const logSequences = useRef(new Map());

  const addLoadingAnalysis = useCallback((analysisName) => {
    setLoadingAnalyses((prev) => new Set([...prev, analysisName]));
  }, []);

  const removeLoadingAnalysis = useCallback((analysisName) => {
    setLoadingAnalyses((prev) => {
      const newSet = new Set(prev);
      newSet.delete(analysisName);
      return newSet;
    });
  }, []);

  const getSSEUrl = useCallback(() => {
    if (!isAuthenticated) return null;

    let baseUrl;
    if (import.meta.env.DEV && import.meta.env.VITE_API_URL) {
      baseUrl = `${import.meta.env.VITE_API_URL}/sse/events`;
    } else {
      const protocol =
        window.location.protocol === 'https:' ? 'https:' : 'http:';
      baseUrl = `${protocol}//${window.location.host}/api/sse/events`;
    }

    return baseUrl;
  }, [isAuthenticated]);

  // Function to request status update from server via HTTP
  const requestStatusUpdate = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      const response = await fetch('/api/status', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setBackendStatus(data);
      }
    } catch (error) {
      console.error('Error requesting status update:', error);
    }
  }, [isAuthenticated]);

  const getTeam = useCallback(
    (teamId) => {
      return teams[teamId] || null;
    },
    [teams],
  );

  const handleMessage = useCallback(
    (event) => {
      if (!mountedRef.current) return;

      try {
        const data = JSON.parse(event.data);

        // Skip heartbeat messages
        if (data.type === 'heartbeat' || data.type === 'connection') {
          return;
        }

        switch (data.type) {
          case 'init': {
            // Handle analyses - always store as object
            let analysesObj = {};
            if (data.analyses) {
              if (Array.isArray(data.analyses)) {
                data.analyses.forEach((analysis) => {
                  analysesObj[analysis.name] = analysis;
                });
              } else {
                analysesObj = data.analyses;
              }
            }

            let teamsObj = {};
            if (data.teams) {
              if (Array.isArray(data.teams)) {
                data.teams.forEach((team) => {
                  teamsObj[team.id] = team;
                });
              } else {
                teamsObj = data.teams;
              }
            }

            setAnalyses(analysesObj);
            setTeams(teamsObj);
            setHasInitialData(true);

            // Initialize log sequences tracking
            Object.keys(analysesObj).forEach((analysisName) => {
              if (!logSequences.current.has(analysisName)) {
                logSequences.current.set(analysisName, new Set());
              }
            });

            const analysisNames = new Set(Object.keys(analysesObj));
            setLoadingAnalyses((prev) => {
              const updatedLoadingSet = new Set();
              prev.forEach((loadingName) => {
                if (!analysisNames.has(loadingName)) {
                  updatedLoadingSet.add(loadingName);
                }
              });
              return updatedLoadingSet;
            });

            break;
          }

          case 'statusUpdate': {
            if (data.container_health) {
              setBackendStatus(data);
            } else if (data.data) {
              setBackendStatus(data.data);
            }
            break;
          }

          case 'analysisUpdate':
            if (data.analysisName && data.update) {
              setAnalyses((prev) => ({
                ...prev,
                [data.analysisName]: {
                  ...prev[data.analysisName],
                  ...data.update,
                },
              }));
            }
            break;

          case 'refresh':
            // Refresh data via SSE instead of page reload
            console.log(
              'Received refresh event - data will be updated via other SSE events',
            );
            break;

          case 'analysisCreated':
            if (data.data?.analysis) {
              logSequences.current.set(data.data.analysis, new Set());

              if (data.data.analysisData) {
                const newAnalysis = {
                  ...data.data.analysisData,
                  name: data.data.analysis,
                  teamId:
                    data.data.teamId || data.data.department || 'uncategorized',
                };

                setAnalyses((prev) => ({
                  ...prev,
                  [data.data.analysis]: newAnalysis,
                }));
              } else {
                window.location.reload();
              }
            }
            break;

          case 'analysisDeleted':
            if (data.data?.fileName) {
              removeLoadingAnalysis(data.data.fileName);
              logSequences.current.delete(data.data.fileName);
              setAnalyses((prev) => {
                const newAnalyses = { ...prev };
                delete newAnalyses[data.data.fileName];
                return newAnalyses;
              });
            }
            break;

          case 'analysisRenamed':
            if (data.data?.oldFileName && data.data?.newFileName) {
              const oldSequences = logSequences.current.get(
                data.data.oldFileName,
              );
              if (oldSequences) {
                logSequences.current.set(data.data.newFileName, oldSequences);
                logSequences.current.delete(data.data.oldFileName);
              }

              setAnalyses((prev) => {
                const newAnalyses = { ...prev };
                const analysis = newAnalyses[data.data.oldFileName];
                if (analysis) {
                  newAnalyses[data.data.newFileName] = {
                    ...analysis,
                    name: data.data.newFileName,
                    status: data.data.restarted ? 'running' : analysis.status,
                    enabled: data.data.restarted ? true : analysis.enabled,
                    teamId:
                      data.data.teamId ||
                      data.data.department ||
                      analysis.teamId ||
                      analysis.department,
                  };
                  delete newAnalyses[data.data.oldFileName];
                }
                return newAnalyses;
              });
            }
            break;

          case 'analysisStatus':
            if (data.data?.fileName) {
              removeLoadingAnalysis(data.data.fileName);
              setAnalyses((prev) => ({
                ...prev,
                [data.data.fileName]: {
                  ...prev[data.data.fileName],
                  status: data.data.status,
                  enabled: data.data.enabled,
                  teamId:
                    data.data.teamId ||
                    data.data.department ||
                    prev[data.data.fileName]?.teamId ||
                    prev[data.data.fileName]?.department,
                  lastRun:
                    data.data.lastRun || prev[data.data.fileName]?.lastRun,
                  startTime:
                    data.data.startTime || prev[data.data.fileName]?.startTime,
                },
              }));
            }
            break;

          case 'analysisUpdated':
            if (data.data?.fileName) {
              setAnalyses((prev) => ({
                ...prev,
                [data.data.fileName]: {
                  ...prev[data.data.fileName],
                  status: data.data.status || prev[data.data.fileName]?.status,
                  teamId:
                    data.data.teamId ||
                    data.data.department ||
                    prev[data.data.fileName]?.teamId ||
                    prev[data.data.fileName]?.department,
                  lastRun:
                    data.data.lastRun || prev[data.data.fileName]?.lastRun,
                  startTime:
                    data.data.startTime || prev[data.data.fileName]?.startTime,
                },
              }));
              if (data.data.status !== 'running') {
                removeLoadingAnalysis(data.data.fileName);
              }
            }
            break;

          case 'analysisEnvironmentUpdated':
            if (data.data?.fileName) {
              setAnalyses((prev) => ({
                ...prev,
                [data.data.fileName]: {
                  ...prev[data.data.fileName],
                  status: data.data.status || prev[data.data.fileName]?.status,
                  teamId:
                    data.data.teamId ||
                    data.data.department ||
                    prev[data.data.fileName]?.teamId ||
                    prev[data.data.fileName]?.department,
                  lastRun:
                    data.data.lastRun || prev[data.data.fileName]?.lastRun,
                  startTime:
                    data.data.startTime || prev[data.data.fileName]?.startTime,
                },
              }));
            }
            break;

          case 'teamCreated':
          case 'teamUpdated':
            if (data.team) {
              setTeams((prev) => ({
                ...prev,
                [data.team.id]: data.team,
              }));
            }
            break;

          case 'teamDeleted':
            if (data.deleted) {
              console.log('SSE: Team deleted:', data);
              setTeams((prev) => {
                const newTeams = { ...prev };
                delete newTeams[data.deleted];
                return newTeams;
              });

              // Always update analyses when a team is deleted
              setAnalyses((prev) => {
                const newAnalyses = {};
                Object.entries(prev).forEach(([name, analysis]) => {
                  if (analysis.teamId === data.deleted) {
                    // Move analyses from deleted team to target team
                    const targetTeamId =
                      data.analysesMovedTo || 'uncategorized';
                    console.log(
                      `SSE: Moving analysis ${name} from deleted team ${data.deleted} to ${targetTeamId}`,
                    );
                    newAnalyses[name] = { ...analysis, teamId: targetTeamId };
                  } else {
                    newAnalyses[name] = analysis;
                  }
                });
                return newAnalyses;
              });
            }
            break;

          case 'analysisMovedToTeam':
            if (data.analysis && data.to) {
              setAnalyses((prev) => ({
                ...prev,
                [data.analysis]: {
                  ...prev[data.analysis],
                  teamId: data.to,
                },
              }));
            }
            break;

          case 'teamsReordered':
            if (data.teams) {
              let teamsObj = {};
              if (Array.isArray(data.teams)) {
                data.teams.forEach((team) => {
                  teamsObj[team.id] = team;
                });
              } else {
                teamsObj = data.teams;
              }
              setTeams(teamsObj);
            }
            break;

          case 'log':
            if (data.data?.fileName && data.data?.log) {
              const { fileName, log, totalCount } = data.data;

              // Check for duplicate using sequence number
              const sequences = logSequences.current.get(fileName) || new Set();
              if (log.sequence && sequences.has(log.sequence)) {
                return;
              }

              // Add sequence to tracking
              if (log.sequence) {
                sequences.add(log.sequence);
                logSequences.current.set(fileName, sequences);
              }

              setAnalyses((prev) => ({
                ...prev,
                [fileName]: {
                  ...prev[fileName],
                  logs: [log, ...(prev[fileName]?.logs || [])].slice(0, 1000),
                  totalLogCount: totalCount,
                },
              }));
            }
            break;

          case 'logsCleared':
            if (data.data?.fileName) {
              const fileName = data.data.fileName;
              console.log(
                `Clearing logs for ${fileName}, previous log count:`,
                analyses[fileName]?.logs?.length || 0,
              );

              logSequences.current.set(fileName, new Set());

              // If clearMessage is provided, show it as the only log entry
              const clearedLogs = data.data.clearMessage
                ? [data.data.clearMessage]
                : [];

              setAnalyses((prev) => ({
                ...prev,
                [fileName]: {
                  ...prev[fileName],
                  logs: clearedLogs,
                  totalLogCount: clearedLogs.length,
                },
              }));
            }
            break;
          case 'analysisRolledBack':
            if (data.data?.fileName) {
              const { fileName, version, restarted, ...analysisData } =
                data.data;

              // Clear log sequences for fresh start
              logSequences.current.set(fileName, new Set());

              // Update analysis with rollback information
              setAnalyses((prev) => ({
                ...prev,
                [fileName]: {
                  ...prev[fileName],
                  ...analysisData,
                  logs: [], // Clear logs since they were cleared during rollback
                  totalLogCount: 0,
                  currentVersion: version,
                },
              }));

              console.log(
                `Analysis ${fileName} rolled back to version ${version}${restarted ? ' and restarted' : ''}`,
              );
            }
            break;

          case 'sessionInvalidated':
            console.log('Session invalidated:', data.reason);

            if (data.reason?.includes('Server is shutting down')) {
              setServerShutdown(true);
              setConnectionStatus('server_shutdown');
              return;
            }

            // Force logout on session invalidation - Better Auth will handle this
            window.location.reload();
            break;

          case 'userLogout': {
            console.log('User logout event received via SSE, data:', data);
            // Dispatch custom event for AuthProvider to handle
            const customEvent = new CustomEvent('sse-user-logout', {
              detail: { type: 'user-logout', userId: data.userId },
            });
            console.log(
              'Dispatching sse-user-logout event:',
              customEvent.detail,
            );
            window.dispatchEvent(customEvent);
            break;
          }

          default:
            console.log('Unhandled SSE message type:', data.type);
            break;
        }
      } catch (error) {
        console.error('Error handling SSE message:', error);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [removeLoadingAnalysis],
  );

  const reconnect = useCallback(async () => {
    if (!mountedRef.current) return;

    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      console.log(
        `SSE max reconnection attempts reached (${maxReconnectAttempts})`,
      );
      setConnectionStatus('failed');
      connectionStatusRef.current = 'failed';
      return;
    }

    const delay = Math.min(
      1000 * Math.pow(2, reconnectAttemptsRef.current),
      maxReconnectDelay,
    );
    reconnectAttemptsRef.current++;

    console.log(
      `SSE reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`,
    );

    setTimeout(async () => {
      if (!mountedRef.current) return;

      setConnectionStatus('connecting');
      connectionStatusRef.current = 'connecting';
      try {
        await createConnection();
      } catch (error) {
        console.error('SSE reconnection failed:', error);
        if (mountedRef.current) {
          setConnectionStatus('disconnected');
          connectionStatusRef.current = 'disconnected';
          reconnect();
        }
      }
    }, delay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const createConnection = useCallback(async () => {
    const sseUrl = getSSEUrl();

    if (!sseUrl) {
      throw new Error('Authentication required for SSE connection');
    }

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    return new Promise((resolve, reject) => {
      const eventSource = new EventSource(sseUrl, {
        withCredentials: true,
      });

      eventSourceRef.current = eventSource;

      const connectionTimeout = setTimeout(() => {
        console.log('SSE connection timeout');
        eventSource.close();
        reject(new Error('Connection timeout'));
      }, 5000);

      eventSource.onopen = () => {
        clearTimeout(connectionTimeout);
        console.log('SSE connection established');

        if (mountedRef.current) {
          setConnectionStatus('connected');
          connectionStatusRef.current = 'connected';
          reconnectAttemptsRef.current = 0;
        }

        resolve(eventSource);
      };

      eventSource.onerror = (error) => {
        clearTimeout(connectionTimeout);
        console.error('SSE connection error', error);

        if (mountedRef.current) {
          if (eventSource.readyState === EventSource.CLOSED) {
            setConnectionStatus('disconnected');
            connectionStatusRef.current = 'disconnected';
            setBackendStatus(null);
            reconnect();
          }
        }

        if (eventSource.readyState === EventSource.CLOSED) {
          reject(error);
        }
      };

      eventSource.onmessage = handleMessage;
    });
  }, [handleMessage, getSSEUrl, reconnect]);

  useEffect(() => {
    mountedRef.current = true;

    const connect = async () => {
      if (!isAuthenticated) {
        setConnectionStatus('disconnected');
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
        return;
      }

      try {
        setConnectionStatus('connecting');
        connectionStatusRef.current = 'connecting';
        console.log('Starting SSE connection...');

        await createConnection();
      } catch (error) {
        console.error('SSE initial connection failed:', error);
        if (mountedRef.current) {
          setConnectionStatus('disconnected');
          connectionStatusRef.current = 'disconnected';
          reconnect();
        }
      }
    };

    // Handle page visibility changes for automatic reconnection
    const handleVisibilityChange = async () => {
      if (!document.hidden && mountedRef.current) {
        if (
          connectionStatusRef.current === 'disconnected' ||
          !eventSourceRef.current ||
          eventSourceRef.current.readyState !== EventSource.OPEN
        ) {
          console.log('Page became visible, attempting SSE reconnection...');
          connect();
        }
      }
    };

    const handleFocus = async () => {
      if (mountedRef.current) {
        if (
          connectionStatusRef.current === 'disconnected' ||
          !eventSourceRef.current ||
          eventSourceRef.current.readyState !== EventSource.OPEN
        ) {
          console.log('Window gained focus, attempting SSE reconnection...');
          connect();
        }
      }
    };

    const timeoutId = setTimeout(connect, 50);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      console.log('SSE client cleanup starting');
      mountedRef.current = false;

      clearTimeout(timeoutId);

      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);

      if (eventSourceRef.current) {
        console.log('SSE closing connection');
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [createConnection, reconnect, isAuthenticated, serverShutdown]);

  // Request status updates periodically (fallback)
  useEffect(() => {
    if (connectionStatus === 'connected') {
      requestStatusUpdate();

      const interval = setInterval(requestStatusUpdate, 60000);

      return () => clearInterval(interval);
    }
  }, [connectionStatus, requestStatusUpdate]);

  const value = {
    analyses,
    teams,
    loadingAnalyses,
    addLoadingAnalysis,
    removeLoadingAnalysis,
    connectionStatus,
    backendStatus,
    requestStatusUpdate,
    getTeam,
    hasInitialData,
    serverShutdown,
  };

  return <SSEContext.Provider value={value}>{children}</SSEContext.Provider>;
}

SSEProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
