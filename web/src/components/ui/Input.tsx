import React, { useId } from 'react';
import '../styles/input.css';

type FieldSize = 'sm' | 'md' | 'lg';

/** Field wrapper providing label, helper text, and error display. */
interface FieldProps {
  label?: string;
  required?: boolean;
  helper?: string;
  error?: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}

export const Field: React.FC<FieldProps> = ({
  label,
  required,
  helper,
  error,
  htmlFor,
  children,
  className,
}) => (
  <div className={className} style={{ display: 'flex', flexDirection: 'column' }}>
    {label && (
      <label
        htmlFor={htmlFor}
        className={`field-label${required ? ' field-label-required' : ''}`}
      >
        {label}
      </label>
    )}
    {children}
    {error ? (
      <span className="field-error-msg" role="alert">{error}</span>
    ) : helper ? (
      <span className="field-helper">{helper}</span>
    ) : null}
  </div>
);

/** Text input with optional icon, label, and validation error display. */
interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: FieldSize;
  label?: string;
  helper?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  search?: boolean;
}

export const Input: React.FC<InputProps> = ({
  size = 'md',
  label,
  helper,
  error,
  leftIcon,
  rightIcon,
  search = false,
  className,
  id,
  ...props
}) => {
  const autoId = useId();
  const fieldId = id ?? autoId;

  const inputClasses = [
    'field-base',
    `input-${size}`,
    search ? 'input-search' : '',
    error ? 'field-error' : '',
    leftIcon ? 'input-has-left' : '',
    rightIcon ? 'input-has-right' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const inputEl = (
    <div className="input-wrapper">
      {leftIcon && (
        <span className="input-icon-left" aria-hidden="true">
          {leftIcon}
        </span>
      )}
      <input
        id={fieldId}
        className={`${inputClasses} ${className ?? ''}`}
        aria-invalid={!!error}
        aria-describedby={error ? `${fieldId}-error` : helper ? `${fieldId}-helper` : undefined}
        {...props}
      />
      {rightIcon && (
        <span className="input-icon-right" aria-hidden="true">
          {rightIcon}
        </span>
      )}
    </div>
  );

  if (!label && !helper && !error) return inputEl;

  return (
    <Field
      label={label}
      helper={helper}
      error={error}
      htmlFor={fieldId}
      required={props.required}
    >
      {inputEl}
    </Field>
  );
};

/** Textarea with optional label, helper, and error display. */
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helper?: string;
  error?: string;
}

export const Textarea: React.FC<TextareaProps> = ({
  label,
  helper,
  error,
  className,
  id,
  ...props
}) => {
  const autoId = useId();
  const fieldId = id ?? autoId;

  const el = (
    <textarea
      id={fieldId}
      className={`field-base textarea ${error ? 'field-error' : ''} ${className ?? ''}`}
      aria-invalid={!!error}
      {...props}
    />
  );

  if (!label && !helper && !error) return el;

  return (
    <Field label={label} helper={helper} error={error} htmlFor={fieldId} required={props.required}>
      {el}
    </Field>
  );
};

/** Select dropdown with optional label, helper, and error display. */
interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  size?: FieldSize;
  label?: string;
  helper?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
}

export const Select: React.FC<SelectProps> = ({
  size = 'md',
  label,
  helper,
  error,
  options,
  placeholder,
  className,
  id,
  ...props
}) => {
  const autoId = useId();
  const fieldId = id ?? autoId;

  const el = (
    <select
      id={fieldId}
      className={`field-base select input-${size} ${error ? 'field-error' : ''} ${className ?? ''}`}
      aria-invalid={!!error}
      {...props}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value} disabled={opt.disabled}>
          {opt.label}
        </option>
      ))}
    </select>
  );

  if (!label && !helper && !error) return el;

  return (
    <Field label={label} helper={helper} error={error} htmlFor={fieldId} required={props.required}>
      {el}
    </Field>
  );
};
