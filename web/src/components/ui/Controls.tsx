import React, { useId } from 'react';
import '../styles/controls.css';

// ─── Checkbox ─────────────────────────────────────────────
interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  helper?: string;
  indeterminate?: boolean;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  label,
  helper,
  indeterminate = false,
  disabled,
  className,
  id,
  ref: _ref, // strip ref from props
  ...props
}) => {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  if (!label) {
    return (
      <input
        ref={inputRef}
        type="checkbox"
        id={fieldId}
        className={`checkbox-input ${className ?? ''}`}
        disabled={disabled}
        {...props}
      />
    );
  }

  return (
    <label
      htmlFor={fieldId}
      className={`control-root ${disabled ? 'control-root-disabled' : ''} ${className ?? ''}`}
    >
      <input
        ref={inputRef}
        type="checkbox"
        id={fieldId}
        className="checkbox-input"
        disabled={disabled}
        {...props}
      />
      <div>
        <div className="control-label">{label}</div>
        {helper && <div className="control-helper">{helper}</div>}
      </div>
    </label>
  );
};

// ─── Radio ────────────────────────────────────────────────
interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  helper?: string;
}

export const Radio: React.FC<RadioProps> = ({
  label,
  helper,
  disabled,
  className,
  id,
  ...props
}) => {
  const autoId = useId();
  const fieldId = id ?? autoId;

  if (!label) {
    return (
      <input
        type="radio"
        id={fieldId}
        className={`radio-input ${className ?? ''}`}
        disabled={disabled}
        {...props}
      />
    );
  }

  return (
    <label
      htmlFor={fieldId}
      className={`control-root ${disabled ? 'control-root-disabled' : ''} ${className ?? ''}`}
    >
      <input
        type="radio"
        id={fieldId}
        className="radio-input"
        disabled={disabled}
        {...props}
      />
      <div>
        <div className="control-label">{label}</div>
        {helper && <div className="control-helper">{helper}</div>}
      </div>
    </label>
  );
};

// ─── Radio Group ──────────────────────────────────────────
interface RadioOption {
  value: string;
  label: string;
  helper?: string;
  disabled?: boolean;
}

interface RadioGroupProps {
  name: string;
  options: RadioOption[];
  value?: string;
  onChange?: (value: string) => void;
  label?: string;
  className?: string;
}

export const RadioGroup: React.FC<RadioGroupProps> = ({
  name,
  options,
  value,
  onChange,
  label,
  className,
}) => (
  <fieldset
    className={className}
    style={{ border: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}
  >
    {label && (
      <legend style={{ float: 'left', width: '100%', fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)', padding: 0 }}>
        {label}
      </legend>
    )}
    {options.map((opt) => (
      <Radio
        key={opt.value}
        name={name}
        value={opt.value}
        label={opt.label}
        helper={opt.helper}
        disabled={opt.disabled}
        checked={value === opt.value}
        onChange={() => onChange?.(opt.value)}
      />
    ))}
  </fieldset>
);

// ─── Toggle ───────────────────────────────────────────────
interface ToggleProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  label?: string;
  helper?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export const Toggle: React.FC<ToggleProps> = ({
  checked = false,
  onChange,
  label,
  helper,
  disabled,
  id,
  className,
}) => {
  const autoId = useId();
  const fieldId = id ?? autoId;

  const track = (
    <div style={{ position: 'relative', flexShrink: 0, marginTop: 1 }}>
      <input
        type="checkbox"
        id={fieldId}
        className="toggle-input"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        aria-checked={checked}
        role="switch"
      />
      <div className={`toggle-track ${checked ? 'toggle-track-checked' : ''}`}>
        <div className="toggle-thumb" />
      </div>
    </div>
  );

  if (!label) return track;

  return (
    <label
      htmlFor={fieldId}
      className={`control-root ${disabled ? 'control-root-disabled' : ''} ${className ?? ''}`}
    >
      {track}
      <div>
        <div className="control-label">{label}</div>
        {helper && <div className="control-helper">{helper}</div>}
      </div>
    </label>
  );
};
