import React from 'react';
import '../styles/badge.css';

// ─── Status Badge (with dot) ──────────────────────────────
export type StatusVariant = 'open' | 'closed' | 'merged' | 'draft' | 'progress';

const STATUS_LABELS: Record<StatusVariant, string> = {
  open:     'Open',
  closed:   'Closed',
  merged:   'Merged',
  draft:    'Draft',
  progress: 'In progress',
};

interface BadgeProps {
  status: StatusVariant;
  label?: string; // override default label
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ status, label, className }) => (
  <span className={`badge badge-${status} ${className ?? ''}`}>
    <span className="badge-dot" aria-hidden="true" />
    {label ?? STATUS_LABELS[status]}
  </span>
);

// ─── Tag (category label) ─────────────────────────────────
export type TagVariant = 'bug' | 'feature' | 'docs' | 'perf' | 'refactor' | 'default';

interface TagProps {
  variant?: TagVariant;
  children: React.ReactNode;
  className?: string;
}

export const Tag: React.FC<TagProps> = ({ variant = 'default', children, className }) => (
  <span className={`tag tag-${variant} ${className ?? ''}`}>{children}</span>
);
