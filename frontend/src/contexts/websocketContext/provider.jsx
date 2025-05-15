// frontend/src/contexts/websocketContext/provider.jsx
import { useState, useEffect, useCallback, useRef } from "react";
import PropTypes from "prop-types";
import { WebSocketContext } from "./context";

export function WebSocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [analyses, setAnalyses] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState("connecting");
  const lastMessageRef = useRef({ type: null, timestamp: 0 });
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectDelay = 5000; // Maximum reconnection delay of 5 seconds

  const getWebSocketUrl = () => {
    // Use the environment variable in development, fallback to window.location in production
    if (import.meta.env.DEV && import.meta.env.VITE_WS_URL) {
      return import.meta.env.VITE_WS_URL;
    }
    // Production fallback
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}/ws`;
  };

  const handleMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.data);
      const now = Date.now();

      // Deduplicate messages that arrive within 50ms of each other
      if (
        data.type === lastMessageRef.current.type &&
        now - lastMessageRef.current.timestamp < 50
      ) {
        return;
      }

      lastMessageRef.current = { type: data.type, timestamp: now };
      // console.log('Processing WebSocket message:', data.type);

      switch (data.type) {
        case "init":
          setAnalyses(data.analyses || []);
          break;

        case "analysisCreated":
          if (data.data?.analysis) {
            setAnalyses((prev) => {
              // Check if analysis already exists
              const exists = prev.some(
                (a) => a.name === data.data.analysis.name,
              );
              if (exists) {
                return prev.map((a) =>
                  a.name === data.data.analysis.name ? data.data.analysis : a,
                );
              }
              return [...prev, data.data.analysis];
            });
          }
          break;

        case "analysisDeleted":
          if (data.data?.fileName) {
            setAnalyses((prev) =>
              prev.filter((a) => a.name !== data.data.fileName),
            );
          }
          break;

        case "analysisRenamed":
          if (data.data?.oldFileName && data.data?.newFileName) {
            setAnalyses((prev) =>
              prev.map((analysis) =>
                analysis.name === data.data.oldFileName
                  ? { ...analysis, name: data.data.newFileName }
                  : analysis,
              ),
            );
          }
          break;

        case "status":
          if (data.data?.fileName) {
            setAnalyses((prev) =>
              prev.map((analysis) =>
                analysis.name === data.data.fileName
                  ? { ...analysis, ...data.data }
                  : analysis,
              ),
            );
          }
          break;

        case "log":
          if (data.data?.fileName && data.data?.log) {
            setAnalyses((prev) =>
              prev.map((analysis) =>
                analysis.name === data.data.fileName
                  ? {
                      ...analysis,
                      logs: [data.data.log, ...(analysis.logs || [])],
                    }
                  : analysis,
              ),
            );
          }
          break;
        case "clearLogs":
          if (data.data?.fileName) {
            setAnalyses((prev) =>
              prev.map((analysis) =>
                analysis.name === data.data.fileName
                  ? { ...analysis, logs: [] }
                  : analysis,
              ),
            );
          }
          break;
      }
    } catch (error) {
      console.error("Error handling WebSocket message:", error);
    }
  }, []);

  useEffect(() => {
    let ws = null;
    let reconnectTimeout = null;

    const connect = () => {
      if (ws?.readyState === WebSocket.OPEN) return;

      // Clear any existing reconnect timeout
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }

      ws = new WebSocket(getWebSocketUrl());

      ws.onopen = () => {
        console.log("WebSocket connected");
        setConnectionStatus("connected");
        setSocket(ws);
        reconnectAttemptsRef.current = 0; // Reset reconnect attempts on successful connection
      };

      ws.onmessage = handleMessage;

      ws.onclose = (event) => {
        console.log("WebSocket disconnected", event.code, event.reason);
        setConnectionStatus("disconnected");
        setSocket(null);

        // Calculate reconnection delay with exponential backoff
        const delay = Math.min(
          100 * Math.pow(2, reconnectAttemptsRef.current),
          maxReconnectDelay,
        );
        reconnectAttemptsRef.current++;

        console.log(
          `Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`,
        );
        reconnectTimeout = setTimeout(connect, delay);
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        // Let onclose handle reconnection
      };
    };

    connect();

    return () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (ws?.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [handleMessage]);

  // Expose a reconnect method to manually trigger reconnection
  const reconnect = useCallback(() => {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.close();
    }
  }, [socket]);

  return (
    <WebSocketContext.Provider
      value={{
        socket,
        analyses,
        connectionStatus,
        reconnect, // Expose reconnect method to consumers
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
}

WebSocketProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
