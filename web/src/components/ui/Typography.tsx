import React from 'react';
import '../styles/typography.css';

/** Page-level title with optional subtitle. */
interface PageTitleProps {
  children: React.ReactNode;
  subtitle?: string;
  className?: string;
}

export const PageTitle: React.FC<PageTitleProps> = ({ children, subtitle, className }) => (
  <div className={className}>
    <h1 className="page-title">{children}</h1>
    {subtitle && <p className="page-subtitle">{subtitle}</p>}
  </div>
);

/** Section-level heading with optional subtitle. */
interface SectionHeadingProps {
  children: React.ReactNode;
  subtitle?: string;
  className?: string;
}

export const SectionHeading: React.FC<SectionHeadingProps> = ({ children, subtitle, className }) => (
  <div className={className}>
    <h2 className="section-heading">{children}</h2>
    {subtitle && <p className="section-subheading">{subtitle}</p>}
  </div>
);

/** Label text with optional uppercase variant. */
interface LabelProps {
  children: React.ReactNode;
  caps?: boolean;
  className?: string;
}

export const Label: React.FC<LabelProps> = ({ children, caps = false, className }) => (
  <span className={`${caps ? 'label-caps' : 'label'} ${className ?? ''}`}>{children}</span>
);

/** Body text with optional secondary (muted) styling. */
interface TextProps {
  children: React.ReactNode;
  secondary?: boolean;
  className?: string;
  as?: 'p' | 'span' | 'div';
}

export const Text: React.FC<TextProps> = ({ children, secondary = false, className, as: Tag = 'p' }) => (
  <Tag className={`${secondary ? 'body-text-secondary' : 'body-text'} ${className ?? ''}`}>
    {children}
  </Tag>
);

/** Small caption text for metadata and timestamps. */
interface CaptionProps {
  children: React.ReactNode;
  className?: string;
}

export const Caption: React.FC<CaptionProps> = ({ children, className }) => (
  <span className={`caption ${className ?? ''}`}>{children}</span>
);

/** Inline code text for technical content. */
interface CodeProps {
  children: React.ReactNode;
  className?: string;
}

export const Code: React.FC<CodeProps> = ({ children, className }) => (
  <code className={`code-text ${className ?? ''}`}>{children}</code>
);

/** Link with optional external target and rel attributes. */
interface LinkProps {
  href: string;
  children: React.ReactNode;
  external?: boolean;
  className?: string;
}

export const Link: React.FC<LinkProps> = ({ href, children, external = false, className }) => (
  <a
    href={href}
    className={`link ${className ?? ''}`}
    {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
  >
    {children}
  </a>
);
