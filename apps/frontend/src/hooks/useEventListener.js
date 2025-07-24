import { useEffect, useRef } from 'react';

/**
 * Custom hook to handle event listeners without useEffect
 * Replaces manual addEventListener/removeEventListener patterns
 */
export function useEventListener(
  eventName,
  handler,
  element = window,
  options = {},
) {
  const savedHandler = useRef();

  // Update ref whenever handler changes
  savedHandler.current = handler;

  useEffect(() => {
    const targetElement = element?.current || element;
    if (!(targetElement && targetElement.addEventListener)) {
      return;
    }

    // Create event listener that calls current handler
    const eventListener = (event) => savedHandler.current(event);

    targetElement.addEventListener(eventName, eventListener, options);

    // Cleanup
    return () => {
      targetElement.removeEventListener(eventName, eventListener, options);
    };
  }, [eventName, element, options.passive, options.once, options.capture]);
}

/**
 * Hook for keyboard event listeners
 */
export function useKeyPress(targetKey, handler, element = window) {
  const handleKeyPress = (event) => {
    if (event.key === targetKey) {
      handler(event);
    }
  };

  useEventListener('keydown', handleKeyPress, element);
}

/**
 * Hook for window visibility changes
 */
export function useVisibilityChange(handler) {
  useEventListener('visibilitychange', handler, document);
}

/**
 * Hook for window focus events
 */
export function useWindowFocus(handler) {
  useEventListener('focus', handler, window);
}
