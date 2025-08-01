// frontend/src/components/analysis/analysisLogs.jsx
import PropTypes from 'prop-types';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useMountedRef } from '../../hooks/useMountedRef';
import { analysisService } from '../../services/analysisService';
import {
  Paper,
  ScrollArea,
  Group,
  Text,
  Badge,
  Stack,
  Button,
  Center,
  Loader,
  Box,
} from '@mantine/core';

const LOGS_PER_PAGE = 100;

const AnalysisLogs = ({ analysis }) => {
  const [height, setHeight] = useState(384);
  const [isResizing, setIsResizing] = useState(false);
  const [initialLogs, setInitialLogs] = useState([]);
  const [additionalLogs, setAdditionalLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const scrollRef = useRef(null);
  const isLoadingMore = useRef(false);
  const hasLoadedInitial = useRef(false);
  const lastScrollTop = useRef(0);
  const shouldAutoScroll = useRef(false);
  const isMountedRef = useMountedRef();

  // Memoize sseLogs to prevent unnecessary re-renders
  const sseLogs = useMemo(() => analysis.logs || [], [analysis.logs]);
  const totalLogCount = useMemo(
    () => analysis.totalLogCount || sseLogs.length,
    [analysis.totalLogCount, sseLogs.length],
  );

  // Auto-scroll when new logs arrive (only for live logs, not initial load)
  useEffect(() => {
    if (
      shouldAutoScroll.current &&
      scrollRef.current &&
      sseLogs.length > 0 &&
      hasLoadedInitial.current &&
      isMountedRef.current
    ) {
      const element = scrollRef.current;
      // Use requestAnimationFrame for better performance
      requestAnimationFrame(() => {
        if (element && isMountedRef.current) {
          element.scrollTop = element.scrollHeight;
        }
      });
    }
  }, [sseLogs, isMountedRef]);

  const loadInitialLogs = useCallback(async () => {
    if (hasLoadedInitial.current || !isMountedRef.current) return;

    setIsLoading(true);
    try {
      const response = await analysisService.getLogs(analysis.name, {
        page: 1,
        limit: LOGS_PER_PAGE,
      });

      if (response.logs && isMountedRef.current) {
        setInitialLogs(response.logs);
        setHasMore(response.hasMore || false);
      }
      hasLoadedInitial.current = true;
    } catch (error) {
      console.error('Failed to fetch initial logs:', error);
      if (isMountedRef.current) {
        setHasMore(false);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [analysis.name, isMountedRef]);

  // Load initial logs on mount or analysis change
  useEffect(() => {
    hasLoadedInitial.current = false;
    setInitialLogs([]);
    setAdditionalLogs([]);
    setPage(1);
    setHasMore(false);
    shouldAutoScroll.current = false; // Start with auto-scroll disabled
    loadInitialLogs();
  }, [analysis.name, loadInitialLogs]);

  const loadMoreLogs = useCallback(async () => {
    if (isLoadingMore.current || !hasMore || !isMountedRef.current) return;

    isLoadingMore.current = true;

    try {
      const nextPage = page + 1;
      const response = await analysisService.getLogs(analysis.name, {
        page: nextPage,
        limit: LOGS_PER_PAGE,
      });

      if (!isMountedRef.current) return;

      // Filter out logs we already have
      const existingSequences = new Set(
        [
          ...sseLogs.map((log) => log.sequence),
          ...initialLogs.map((log) => log.sequence),
          ...additionalLogs.map((log) => log.sequence),
        ].filter(Boolean),
      );

      const newLogs =
        response.logs?.filter((log) => !existingSequences.has(log.sequence)) ||
        [];

      if (newLogs.length > 0 && isMountedRef.current) {
        setAdditionalLogs((prev) => [...prev, ...newLogs]);
      }

      if (isMountedRef.current) {
        setHasMore(response.hasMore);
        setPage(nextPage);
      }
    } catch (error) {
      console.error('Failed to fetch more logs:', error);
    } finally {
      isLoadingMore.current = false;
    }
  }, [
    analysis.name,
    page,
    hasMore,
    sseLogs,
    initialLogs,
    additionalLogs,
    isMountedRef,
  ]);

  const handleScrollPositionChange = useCallback(() => {
    if (!scrollRef.current || !isMountedRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;

    // Check if user scrolled up manually
    if (scrollTop < lastScrollTop.current) {
      shouldAutoScroll.current = false;
    }

    // Only re-enable auto-scroll if user scrolls to the very bottom
    if (scrollHeight - (scrollTop + clientHeight) < 10) {
      shouldAutoScroll.current = true;
    }

    lastScrollTop.current = scrollTop;
  }, [isMountedRef]);

  const handleBottomReached = useCallback(() => {
    // Only load more if we're not already loading and there are more logs
    if (!isLoadingMore.current && hasMore && isMountedRef.current) {
      console.log('Bottom reached - triggering loadMoreLogs');
      loadMoreLogs();
    }
  }, [hasMore, loadMoreLogs, isMountedRef]);

  // Reset and load logs when analysis changes
  const [currentAnalysisName, setCurrentAnalysisName] = useState(analysis.name);

  if (analysis.name !== currentAnalysisName) {
    setCurrentAnalysisName(analysis.name);
    hasLoadedInitial.current = false;
    setInitialLogs([]);
    setAdditionalLogs([]);
    setPage(1);
    setHasMore(false);
    shouldAutoScroll.current = false; // Don't auto-scroll on reset
    loadInitialLogs();
  }

  // Reset state when logs are cleared
  const [previousLogCount, setPreviousLogCount] = useState(sseLogs.length);

  // Detect when logs are cleared (sse logs go to 0 or contain only a clear message)
  const logsWereCleared =
    isMountedRef.current &&
    hasLoadedInitial.current &&
    previousLogCount > 0 &&
    (sseLogs.length === 0 ||
      (sseLogs.length === 1 && sseLogs[0]?.message?.includes('cleared')));

  if (logsWereCleared) {
    console.log('Logs cleared, resetting all state and reloading');
    setInitialLogs([]);
    setAdditionalLogs([]);
    setPage(1);
    setHasMore(false);
    shouldAutoScroll.current = false;
    hasLoadedInitial.current = false; // Force reload of initial logs
    loadInitialLogs();
  }

  // Update previous count for next render
  if (sseLogs.length !== previousLogCount) {
    setPreviousLogCount(sseLogs.length);
  }

  // Memoize combined logs to prevent unnecessary recalculations
  const allLogs = useCallback(() => {
    return [...sseLogs, ...initialLogs, ...additionalLogs]
      .filter(
        (log, index, self) =>
          index ===
          self.findIndex((l) =>
            l.sequence
              ? l.sequence === log.sequence
              : l.timestamp === log.timestamp && l.message === log.message,
          ),
      )
      .sort((a, b) => {
        if (a.sequence && b.sequence) return b.sequence - a.sequence;
        return new Date(b.timestamp) - new Date(a.timestamp);
      });
  }, [sseLogs, initialLogs, additionalLogs]);

  const logs = allLogs();

  // Memoized resize handler to prevent memory leaks
  const handleMouseDown = useCallback(
    (e) => {
      e.preventDefault();
      const startY = e.clientY;
      const startHeight = height;
      setIsResizing(true);

      function onMouseMove(moveEvent) {
        const delta = moveEvent.clientY - startY;
        const newHeight = Math.max(96, Math.min(800, startHeight + delta));
        setHeight(newHeight);
      }

      function onMouseUp() {
        setIsResizing(false);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      }

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [height],
  );

  if (!analysis || !analysis.name) {
    return null;
  }

  return (
    <Paper
      mt="md"
      withBorder
      radius="md"
      style={{
        minHeight: '96px',
        maxHeight: '800px',
        overflow: 'hidden',
        userSelect: isResizing ? 'none' : 'auto',
      }}
    >
      {/* Header */}
      <Box p="sm">
        <Group justify="space-between">
          <Text size="sm" fw={600}>
            Logs {sseLogs.length > 0 && '(Live)'}
          </Text>
          <Group gap="xs">
            {(isLoading || isLoadingMore.current) && <Loader size="xs" />}
            <Group gap="xs" align="center">
              <Text size="xs" c="dimmed" component="span">
                {sseLogs.length > 0
                  ? `${logs.length} of ${totalLogCount} entries`
                  : `${logs.length} entries`}
              </Text>
              {sseLogs.length > 0 &&
                (analysis.status === 'running' ? (
                  <Badge color="green" size="xs" variant="dot">
                    Live
                  </Badge>
                ) : (
                  <Badge color="red" size="xs" variant="dot">
                    Stopped
                  </Badge>
                ))}
            </Group>
          </Group>
        </Group>
      </Box>

      {/* Logs Content */}
      <ScrollArea
        h={height}
        p="sm"
        viewportRef={scrollRef}
        onScrollPositionChange={handleScrollPositionChange}
        onBottomReached={handleBottomReached}
        type="scroll"
        scrollbarSize={8}
      >
        {isLoading && logs.length === 0 ? (
          <Center h="100%">
            <Group>
              <Loader size="sm" />
              <Text c="dimmed" size="sm">
                Loading logs...
              </Text>
            </Group>
          </Center>
        ) : logs.length === 0 ? (
          <Center h="100%">
            <Text c="dimmed" size="sm">
              No logs available.{' '}
              {analysis.status === 'running' && 'Waiting for new logs...'}
            </Text>
          </Center>
        ) : (
          <Stack gap={2}>
            {logs.map((log, index) => {
              const isError = log.message?.toLowerCase().includes('error');
              const isWarning = log.message?.toLowerCase().includes('warn');

              return (
                <Group
                  key={
                    log.sequence
                      ? `seq-${log.sequence}`
                      : `${log.timestamp}-${index}`
                  }
                  gap="xs"
                  wrap="nowrap"
                  p={4}
                  styles={{
                    root: {
                      borderRadius: 'var(--mantine-radius-sm)',
                      '&:hover': {
                        backgroundColor: 'var(--mantine-color-gray-light)',
                      },
                    },
                  }}
                >
                  <Text
                    size="xs"
                    c="dimmed"
                    ff="monospace"
                    style={{ flexShrink: 0 }}
                    component="span"
                  >
                    {log.timestamp}
                  </Text>
                  <Text
                    size="xs"
                    c={isError ? 'red' : isWarning ? 'yellow' : undefined}
                    ff="monospace"
                    style={{ wordBreak: 'break-word' }}
                    component="span"
                  >
                    {log.message}
                  </Text>
                </Group>
              );
            })}

            {hasMore && !isLoading && (
              <Center py="sm">
                {isLoadingMore.current ? (
                  <Group>
                    <Loader size="xs" />
                    <Text size="xs" c="dimmed">
                      Loading more...
                    </Text>
                  </Group>
                ) : (
                  <Button variant="subtle" size="xs" onClick={loadMoreLogs}>
                    Load more logs...
                  </Button>
                )}
              </Center>
            )}
          </Stack>
        )}
      </ScrollArea>

      {/* Resize Handle */}
      <Box
        h={8}
        style={{
          cursor: 'row-resize',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background-color 200ms',
          '&:hover': {
            backgroundColor: 'var(--mantine-color-gray-2)',
          },
          backgroundColor: isResizing
            ? 'var(--mantine-color-gray-3)'
            : undefined,
        }}
        onMouseDown={handleMouseDown}
      >
        <Box w={64} h={2} bg="gray.3" style={{ borderRadius: '2px' }} />
      </Box>
    </Paper>
  );
};

AnalysisLogs.propTypes = {
  analysis: PropTypes.shape({
    name: PropTypes.string.isRequired,
    status: PropTypes.string,
    logs: PropTypes.arrayOf(
      PropTypes.shape({
        sequence: PropTypes.number,
        timestamp: PropTypes.string,
        message: PropTypes.string,
      }),
    ),
    totalLogCount: PropTypes.number,
  }).isRequired,
};

export default AnalysisLogs;
