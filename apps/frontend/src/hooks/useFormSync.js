import { useEffect, useRef } from 'react';

/**
 * Custom hook to sync form values with external props
 * Replaces manual form synchronization useEffects
 */
export function useFormSync(form, values, dependencies = []) {
  const initialized = useRef(false);

  useEffect(() => {
    if (values && (Object.keys(values).length > 0 || !initialized.current)) {
      form.setValues(values);
      initialized.current = true;
    }
  }, dependencies);
}

/**
 * Hook to reset form when component mounts/unmounts or conditions change
 */
export function useFormReset(form, condition, resetValues = {}) {
  useEffect(() => {
    if (condition) {
      form.setValues(resetValues);
      form.clearErrors();
    }
  }, [condition]);
}

/**
 * Hook for conditional form field validation
 */
export function useFormValidation(
  form,
  fieldName,
  validator,
  value,
  dependencies = [],
) {
  useEffect(() => {
    const validate = async () => {
      try {
        const error = await validator(value);
        if (error) {
          form.setFieldError(fieldName, error);
        } else {
          form.clearFieldError(fieldName);
        }
      } catch (err) {
        form.setFieldError(fieldName, err.message || 'Validation failed');
      }
    };

    if (value !== undefined && value !== '') {
      validate();
    } else {
      form.clearFieldError(fieldName);
    }
  }, [value, ...dependencies]);
}
