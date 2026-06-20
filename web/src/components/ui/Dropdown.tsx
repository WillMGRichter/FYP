import React, { useState, useRef, useEffect, useCallback } from 'react';
import '../styles/dropdown.css';

/** A selectable item in the dropdown menu. */
export interface DropdownItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  separator?: never;
  sectionLabel?: never;
}

/** A visual separator line in the dropdown. */
export interface DropdownSeparator {
  key: string;
  separator: true;
  label?: never;
  icon?: never;
  danger?: never;
  disabled?: never;
  sectionLabel?: never;
}

/** A non-interactive section header in the dropdown. */
export interface DropdownSectionLabel {
  key: string;
  sectionLabel: string;
  label?: never;
  icon?: never;
  danger?: never;
  disabled?: never;
  separator?: never;
}

export type DropdownEntry = DropdownItem | DropdownSeparator | DropdownSectionLabel;

interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownEntry[];
  onSelect?: (key: string) => void;
  align?: 'left' | 'right';
  className?: string;
}

export const Dropdown: React.FC<DropdownProps> = ({
  trigger,
  items,
  onSelect,
  align = 'left',
  className,
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, close]);

  const handleSelect = (key: string) => {
    onSelect?.(key);
    close();
  };

  return (
    <div className={`dropdown-root ${className ?? ''}`} ref={rootRef}>
      <div onClick={() => setOpen((v) => !v)} style={{ display: 'inline-flex' }}>
        {trigger}
      </div>


      {open && (
        <div
          className={`dropdown-menu ${align === 'right' ? 'dropdown-menu-right' : ''}`}
          role="menu"
        >
          {items.map((item) => {
            if ('separator' in item && item.separator) {
              return <div key={item.key} className="dropdown-separator" role="separator" />;
            }
            if ('sectionLabel' in item && item.sectionLabel) {
              return (
                <div key={item.key} className="dropdown-section-label">
                  {item.sectionLabel}
                </div>
              );
            }
            const i = item as DropdownItem;
            return (
              <button
                key={i.key}
                className={`dropdown-item ${i.danger ? 'dropdown-item-danger' : ''}`}
                role="menuitem"
                disabled={i.disabled}
                onClick={() => handleSelect(i.key)}
              >
                {i.icon && (
                  <span className="dropdown-item-icon" aria-hidden="true">
                    {i.icon}
                  </span>
                )}
                {i.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
