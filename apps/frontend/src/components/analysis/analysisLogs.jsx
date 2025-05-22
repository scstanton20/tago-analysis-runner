import PropTypes from 'prop-types';
import { useState, useEffect, useRef } from 'react';
import { analysisService } from '../../services/analysisService';
import { RotateCw } from 'lucide-react';

const LOGS_PER_PAGE = 100;

const AnalysisLogs = ({ logs: websocketLogs = [], analysis }) => {
  const [height, setHeight] = useState(384);
  const [isResizing, setIsResizing] = useState(false);
  const [fileLogs, setFileLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const scrollRef = useRef(null);
  const isLoadingMore = useRef(false);

  const loadInitialLogs = async () => {
    setIsLoading(true);
    try {
      const logs = await analysisService.getLogs(analysis.name, {
        page: 1,
        limit: LOGS_PER_PAGE,
      });
      setFileLogs(logs);
      setHasMore(logs.length === LOGS_PER_PAGE);
      setPage(1);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMoreLogs = async () => {
    if (isLoadingMore.current || !hasMore) return;

    isLoadingMore.current = true;
    try {
      const nextPage = page + 1;
      const moreLogs = await analysisService.getLogs(analysis.name, {
        page: nextPage,
        limit: LOGS_PER_PAGE,
      });

      setFileLogs((prev) => [...prev, ...moreLogs]);
      setHasMore(moreLogs.length === LOGS_PER_PAGE);
      setPage(nextPage);
    } catch (error) {
      console.error('Failed to fetch more logs:', error);
    } finally {
      isLoadingMore.current = false;
    }
  };

  const handleScroll = () => {
    if (!scrollRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    if (scrollHeight - scrollTop <= clientHeight * 1.5) {
      loadMoreLogs();
    }
  };

  useEffect(() => {
    loadInitialLogs();
  }, [analysis.name]);

  // Combine logs efficiently
  const combinedLogs = [...websocketLogs, ...fileLogs]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .filter(
      (log, index, self) =>
        index ===
        self.findIndex(
          (l) => l.timestamp === log.timestamp && l.message === log.message,
        ),
    );

  return (
    <div
      className={`mt-4 bg-gray-50 rounded-md overflow-hidden ${isResizing ? 'select-none' : ''}`}
      style={{ minHeight: '96px', maxHeight: '800px' }}
    >
      <div className="p-4 sticky top-0 bg-gray-100 border-b flex justify-between items-center">
        <h4 className="text-sm font-semibold">Logs</h4>
        <div className="flex items-center gap-4">
          {isLoading && <RotateCw className="w-3 h-3 animate-spin" />}
          <div className="text-xs text-gray-500">
            {combinedLogs.length} entries
          </div>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="p-4 overflow-y-auto"
        style={{ height: `${height}px` }}
        onScroll={handleScroll}
      >
        {isLoading && combinedLogs.length === 0 ? (
          <div className="flex items-center justify-center text-gray-500">
            <RotateCw className="w-4 h-4 animate-spin mr-2" />
            Loading logs...
          </div>
        ) : combinedLogs.length === 0 ? (
          <p className="text-gray-500 text-sm">No logs available.</p>
        ) : (
          <>
            <div className="space-y-1 font-mono text-sm">
              {combinedLogs.map((log, index) => (
                <div
                  key={`${log.timestamp}-${index}`}
                  className="flex hover:bg-gray-100 p-1 rounded"
                >
                  <span className="text-gray-500 mr-2 shrink-0">
                    {log.timestamp}
                  </span>
                  <span
                    className={`${
                      log.message?.toLowerCase().includes('error')
                        ? 'text-red-600'
                        : log.message?.toLowerCase().includes('warn')
                          ? 'text-yellow-600'
                          : ''
                    }`}
                  >
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
            {hasMore && (
              <div className="text-center py-2 text-sm text-gray-500">
                <RotateCw className="w-4 h-4 animate-spin inline mr-2" />
                Loading more...
              </div>
            )}
          </>
        )}
      </div>

      <div
        className={`
          h-2 bg-gray-100 border-t cursor-row-resize hover:bg-gray-200 
          flex items-center justify-center
          ${isResizing ? 'bg-gray-300' : ''}
        `}
        onMouseDown={(e) => {
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
        }}
      >
        <div className="w-16 h-1 bg-gray-300 rounded-full" />
      </div>
    </div>
  );
};

AnalysisLogs.propTypes = {
  logs: PropTypes.arrayOf(
    PropTypes.shape({
      timestamp: PropTypes.string,
      message: PropTypes.string,
    }),
  ),
  analysis: PropTypes.shape({
    name: PropTypes.string.isRequired,
    type: PropTypes.string,
    status: PropTypes.string,
    logs: PropTypes.array,
  }).isRequired,
};

export default AnalysisLogs;
