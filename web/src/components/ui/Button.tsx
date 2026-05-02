import React from 'react';
import '../styles/button.css';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  iconOnly?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  loading = false,
  iconOnly = false,
  leftIcon,
  rightIcon,
  children,
  className,
  disabled,
  ...props
}) => {
  const classes = [
    'btn',
    `btn-${size}`,
    `btn-${variant}`,
    iconOnly ? `btn-icon-${size}` : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={classes} disabled={disabled || loading} {...props}>
      {loading ? (
        <span className="btn-spinner" aria-hidden="true" />
      ) : (
        leftIcon && <span aria-hidden="true">{leftIcon}</span>
      )}
      {!iconOnly && children}
      {!loading && rightIcon && <span aria-hidden="true">{rightIcon}</span>}
    </button>
  );
};

// ─── Icon Button convenience wrapper ──────────────────────
interface IconButtonProps extends Omit<ButtonProps, 'iconOnly' | 'children'> {
  icon: React.ReactNode;
  label: string; // required for accessibility
}

export const IconButton: React.FC<IconButtonProps> = ({ icon, label, ...props }) => (
  <Button iconOnly aria-label={label} {...props}>
    {icon}
  </Button>
);

// ─── Button Group ─────────────────────────────────────────
interface ButtonGroupProps {
  children: React.ReactNode;
  className?: string;
}

export const ButtonGroup: React.FC<ButtonGroupProps> = ({ children, className }) => (
  <div
    className={className}
    style={{ display: 'inline-flex', gap: 'var(--space-2)' }}
    role="group"
  >
    {children}
  </div>
);
