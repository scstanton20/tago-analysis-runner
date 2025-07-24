import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for debouncing values
 * Replaces manual debouncing patterns
 */
export function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook for debounced callbacks
 */
export function useDebouncedCallback(callback, delay, deps = []) {
  const [timeoutId, setTimeoutId] = useState(null);

  const debouncedCallback = useCallback(
    (...args) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      const id = setTimeout(() => {
        callback(...args);
      }, delay);

      setTimeoutId(id);
    },
    [callback, delay, ...deps],
  );

  useEffect(() => {
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [timeoutId]);

  return debouncedCallback;
}

/**
 * Hook for async validation with debouncing
 */
export function useDebouncedValidation(validator, value, delay = 300) {
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState(null);
  const debouncedValue = useDebounce(value, delay);

  useEffect(() => {
    if (!debouncedValue) {
      setError(null);
      setIsValidating(false);
      return;
    }

    setIsValidating(true);

    const validate = async () => {
      try {
        const result = await validator(debouncedValue);
        setError(result);
      } catch (err) {
        setError(err.message || 'Validation failed');
      } finally {
        setIsValidating(false);
      }
    };

    validate();
  }, [debouncedValue, validator]);

  return { isValidating, error };
}
