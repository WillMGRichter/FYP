import React, { useState } from 'react';
import '../styles/layout.css';

/** Top navigation bar with brand, links, and an optional end slot. */
interface NavItem {
  key: string;
  label: string;
  href: string;
  icon?: React.ReactNode;
}

interface NavbarProps {
  brand?: {
    label: string;
    icon?: React.ReactNode;
    href?: string;
  };
  items?: NavItem[];
  activeKey?: string;
  end?: React.ReactNode; // right-side slot (buttons, avatar, etc.)
  onNavigate?: (href: string) => void;
  className?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  brand,
  items = [],
  activeKey,
  end,
  onNavigate,
  className,
}) => (
  <nav className={`navbar ${className ?? ''}`} aria-label="Main navigation">
    {brand && (
      <a
        className="navbar-brand"
        href={brand.href ?? '/'}
        onClick={(e) => {
          if (onNavigate) { e.preventDefault(); onNavigate(brand.href ?? '/'); }
        }}
      >
        {brand.icon && <span className="navbar-brand-icon" aria-hidden="true">{brand.icon}</span>}
        {brand.label}
      </a>
    )}

    {items.length > 0 && (
      <div className="navbar-nav" role="list">
        {items.map((item) => (
          <a
            key={item.key}
            href={item.href}
            role="listitem"
            className={`navbar-link ${activeKey === item.key ? 'navbar-link-active' : ''}`}
            aria-current={activeKey === item.key ? 'page' : undefined}
            onClick={(e) => {
              if (onNavigate) { e.preventDefault(); onNavigate(item.href); }
            }}
          >
            {item.icon && <span aria-hidden="true">{item.icon}</span>}
            {item.label}
          </a>
        ))}
      </div>
    )}

    {end && <div className="navbar-end">{end}</div>}
  </nav>
);

/** Page-level header with title, optional subtitle, and action slot. */
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, actions, className }) => (
  <header className={`page-header ${className ?? ''}`}>
    <div className="page-header-content">
      <h1 className="page-title">{title}</h1>
      {subtitle && <p className="page-subtitle">{subtitle}</p>}
    </div>
    {actions && <div className="page-header-actions">{actions}</div>}
  </header>
);

/** Tab bar for switching between sections. */
interface TabItem {
  key: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

interface TabsProps {
  items: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({ items, activeKey, onChange, className }) => (
  <div className={`tabs ${className ?? ''}`} role="tablist">
    {items.map((tab) => (
      <button
        key={tab.key}
        role="tab"
        aria-selected={activeKey === tab.key}
        className={`tab ${activeKey === tab.key ? 'tab-active' : ''}`}
        onClick={() => onChange(tab.key)}
      >
        {tab.icon && <span aria-hidden="true">{tab.icon}</span>}
        {tab.label}
        {tab.count !== undefined && (
          <span className="tab-count" aria-label={`${tab.count} items`}>
            {tab.count > 999 ? '999+' : tab.count}
          </span>
        )}
      </button>
    ))}
  </div>
);

/** Card container with optional small variant. */
interface CardProps {
  children: React.ReactNode;
  small?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const Card: React.FC<CardProps> = ({ children, small = false, className, style }) => (
  <div className={`card ${small ? 'card-sm' : ''} ${className ?? ''}`} style={style}>
    {children}
  </div>
);

/** Content panel controlled by a Tabs component. Only renders when active. */
interface TabPanelProps {
  id: string;
  activeKey: string;
  children: React.ReactNode;
}

export const TabPanel: React.FC<TabPanelProps> = ({ id, activeKey, children }) => (
  <div
    role="tabpanel"
    id={`panel-${id}`}
    hidden={id !== activeKey}
    aria-labelledby={`tab-${id}`}
  >
    {id === activeKey ? children : null}
  </div>
);

/** Hook for managing tab selection state. */
export function useTabs(defaultKey: string) {
  const [activeKey, setActiveKey] = useState(defaultKey);
  return { activeKey, onChange: setActiveKey };
}
