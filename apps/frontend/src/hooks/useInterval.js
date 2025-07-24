import { useEffect, useRef } from 'react';

/**
 * Custom hook for intervals that handles cleanup automatically
 * Replaces manual setInterval/clearInterval patterns
 */
export function useInterval(callback, delay, immediate = false) {
  const savedCallback = useRef();

  // Remember the latest callback
  savedCallback.current = callback;

  useEffect(() => {
    if (delay === null) return;

    function tick() {
      savedCallback.current();
    }

    // Run immediately if requested
    if (immediate) {
      tick();
    }

    const id = setInterval(tick, delay);
    return () => clearInterval(id);
  }, [delay, immediate]);
}

/**
 * Hook for polling data with automatic cleanup
 */
export function usePolling(callback, interval = 30000, condition = true) {
  useInterval(
    callback,
    condition ? interval : null,
    false, // Don't run immediately for polling
  );
}

/**
 * Hook for timeout with cleanup
 */
export function useTimeout(callback, delay) {
  const savedCallback = useRef();

  savedCallback.current = callback;

  useEffect(() => {
    if (delay === null) return;

    const id = setTimeout(() => savedCallback.current(), delay);
    return () => clearTimeout(id);
  }, [delay]);
}
