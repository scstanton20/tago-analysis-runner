import { useState } from 'react';
import { useWebSocket } from '../../contexts/websocketContext';
import AnalysisItem from './analysisItem';
import { Loader2 } from 'lucide-react';

export default function AnalysisList() {
  const { analyses = [], connectionStatus } = useWebSocket();
  const [openLogIds, setOpenLogIds] = useState(new Set());

  const toggleAllLogs = () => {
    if (openLogIds.size === analyses.length) {
      setOpenLogIds(new Set());
    } else {
      setOpenLogIds(new Set(analyses.map((analysis) => analysis.name)));
    }
  };

  const toggleLog = (analysisName) => {
    setOpenLogIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(analysisName)) {
        newSet.delete(analysisName);
      } else {
        newSet.add(analysisName);
      }
      return newSet;
    });
  };

  if (connectionStatus === 'connecting') {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">Available Analyses</h2>
        <div className="flex items-center justify-center gap-2 text-gray-500">
          <span>Connecting to server...</span>
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      </div>
    );
  }

  const hasAnalyses = Array.isArray(analyses) && analyses.length > 0;

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Available Analyses</h2>
        {hasAnalyses && (
          <button
            onClick={toggleAllLogs}
            className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
          >
            {openLogIds.size === analyses.length
              ? 'Close All Logs'
              : 'Open All Logs'}
          </button>
        )}
      </div>
      <div className="space-y-4">
        {hasAnalyses ? (
          analyses.map((analysis) => {
            const key = `${analysis.name}-${analysis.created || Date.now()}`;
            return (
              <AnalysisItem
                key={key}
                analysis={analysis}
                showLogs={openLogIds.has(analysis.name)}
                onToggleLogs={() => toggleLog(analysis.name)}
              />
            );
          })
        ) : (
          <div className="text-center text-gray-500">
            No analyses available. Upload one to get started.
          </div>
        )}
      </div>
    </div>
  );
}
