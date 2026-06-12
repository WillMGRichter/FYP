import React, { useState, useCallback } from 'react';
import '../styles/feedback.css';

// ─── Alert (inline) ───────────────────────────────────────
type AlertVariant = 'info' | 'success' | 'warning' | 'error';

const ALERT_ICONS: Record<AlertVariant, React.ReactNode> = {
  info:    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.2"/><path d="M8 7v5M8 5.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  success: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.2"/><path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  warning: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2L14.5 13H1.5L8 2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/><path d="M8 6v3.5M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  error:   <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.2"/><path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
};

interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({ variant = 'info', title, children, className }) => (
  <div className={`alert alert-${variant} ${className ?? ''}`} role="alert">
    <span className="alert-icon" aria-hidden="true">{ALERT_ICONS[variant]}</span>
    <div className="alert-body">
      {title && <div className="alert-title">{title}</div>}
      <div className="alert-message">{children}</div>
    </div>
  </div>
);

// ─── Toast ────────────────────────────────────────────────
type ToastVariant = 'info' | 'success' | 'warning' | 'error';

interface ToastData {
  id: string;
  variant: ToastVariant;
  title?: string;
  message: string;
}

interface ToastItemProps extends ToastData {
  onDismiss: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ id, variant, title, message, onDismiss }) => (
  <div className={`toast toast-${variant}`} role="status" aria-live="polite">
    <span className="toast-icon" aria-hidden="true">{ALERT_ICONS[variant]}</span>
    <div className="toast-body">
      {title && <div className="toast-title">{title}</div>}
      <div className="toast-message">{message}</div>
    </div>
    <button className="toast-close" onClick={() => onDismiss(id)} aria-label="Dismiss">✕</button>
  </div>
);

interface ToastContainerProps {
  toasts: ToastData[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => (
  <div className="toast-container" aria-live="polite" aria-label="Notifications">
    {toasts.map((t) => (
      <ToastItem key={t.id} {...t} onDismiss={onDismiss} />
    ))}
  </div>
);

// ─── useToast hook ────────────────────────────────────────
export function useToast() {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (variant: ToastVariant, message: string, title?: string, duration = 4000) => {
      const id = `toast-${Date.now()}-${Math.random()}`;
      setToasts((prev) => [...prev, { id, variant, message, title }]);
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss]
  );

  return {
    toasts,
    dismiss,
    toast: {
      info:    (msg: string, title?: string) => toast('info',    msg, title),
      success: (msg: string, title?: string) => toast('success', msg, title),
      warning: (msg: string, title?: string) => toast('warning', msg, title),
      error:   (msg: string, title?: string) => toast('error',   msg, title),
    },
  };
}

// ─── Empty State ──────────────────────────────────────────
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  body?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, body, action, className }) => (
  <div className={`empty-state ${className ?? ''}`}>
    {icon && <div className="empty-state-icon" aria-hidden="true">{icon}</div>}
    <p className="empty-state-title">{title}</p>
    {body && <p className="empty-state-body">{body}</p>}
    {action}
  </div>
);

// ─── Spinner ──────────────────────────────────────────────
type SpinnerSize = 'sm' | 'md' | 'lg';

interface SpinnerProps {
  size?: SpinnerSize;
  label?: string;
  className?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({ size = 'md', label = 'Loading…', className }) => (
  <span
    className={`spinner spinner-${size} ${className ?? ''}`}
    role="status"
    aria-label={label}
  />
);
