// frontend/src/contexts/websocketContext/hook.jsx
import { useContext } from 'react';
import { WebSocketContext } from './context';

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
}
