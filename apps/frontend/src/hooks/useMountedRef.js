import { useRef, useEffect, useState, useCallback } from 'react';

/**
 * Custom hook to track if component is mounted
 * Replaces manual mounted tracking patterns
 */
export function useMountedRef() {
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  return mountedRef;
}

/**
 * Hook to safely set state only when component is mounted
 */
export function useSafeState(initialState) {
  const [state, setState] = useState(initialState);
  const mountedRef = useMountedRef();

  const safeSetState = useCallback(
    (newState) => {
      if (mountedRef.current) {
        setState(newState);
      }
    },
    [mountedRef],
  );

  return [state, safeSetState];
}
