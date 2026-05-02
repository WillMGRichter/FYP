# UI Component Library

Clean, minimal component library for the GitHub Research Tool.

## Setup

1. Import the design tokens CSS once at your app root (e.g. `main.tsx` or `_app.tsx`):
   ```tsx
   import '@/styles/tokens.css';
   ```

2. Then import any component from the barrel:
   ```tsx
   import { Button, Input, Badge, Tabs, useToast } from '@/components/ui';
   ```

---

## Files

```
src/
├── styles/
│   ├── tokens.css        ← design tokens (colours, spacing, type, radius)
│   ├── typography.css
│   ├── button.css
│   ├── input.css
│   ├── badge.css
│   ├── dropdown.css
│   ├── layout.css
│   ├── controls.css
│   └── feedback.css
└── components/ui/
    ├── Typography.tsx    ← PageTitle, SectionHeading, Label, Text, Caption, Code, Link
    ├── Button.tsx        ← Button, IconButton, ButtonGroup
    ├── Input.tsx         ← Input, Textarea, Select, Field
    ├── Badge.tsx         ← Badge (status), Tag (category)
    ├── Dropdown.tsx      ← Dropdown
    ├── Layout.tsx        ← Navbar, PageHeader, Tabs, TabPanel, Card, useTabs
    ├── Controls.tsx      ← Checkbox, Radio, RadioGroup, Toggle
    ├── Feedback.tsx      ← Alert, ToastContainer, EmptyState, Spinner, useToast
    └── index.ts          ← barrel export
```

---

## Quick Examples

### Button
```tsx
<Button variant="primary" size="md">Collect data</Button>
<Button variant="secondary" leftIcon={<FilterIcon />}>Filter</Button>
<Button variant="ghost" size="sm">Cancel</Button>
<Button variant="danger">Delete repo</Button>
<Button loading>Syncing…</Button>
```
Variants: `primary` | `secondary` | `ghost` | `danger` | `danger-ghost`  
Sizes: `sm` | `md` | `lg`

### Input
```tsx
<Input label="Search" placeholder="Search issues…" search />
<Input label="Repo URL" helper="e.g. github.com/org/repo" required />
<Input label="Token" error="Invalid token" type="password" />
<Textarea label="Notes" rows={4} />
<Select label="Status" options={[{ value: 'open', label: 'Open' }]} placeholder="Any status" />
```

### Badge & Tag
```tsx
<Badge status="open" />
<Badge status="merged" />
<Badge status="closed" />
<Badge status="draft" />
<Badge status="progress" />

<Tag variant="bug">bug</Tag>
<Tag variant="feature">feature</Tag>
<Tag variant="docs">documentation</Tag>
```

### Dropdown
```tsx
const items: DropdownEntry[] = [
  { key: 'export-csv',  label: 'Export CSV' },
  { key: 'export-json', label: 'Export JSON' },
  { key: 'sep', separator: true },
  { key: 'delete', label: 'Delete', danger: true },
];

<Dropdown trigger={<Button variant="secondary">Actions</Button>} items={items} onSelect={console.log} />
```

### Tabs
```tsx
const { activeKey, onChange } = useTabs('issues');

<Tabs
  items={[
    { key: 'issues', label: 'Issues', count: 2841 },
    { key: 'prs',    label: 'Pull requests', count: 1204 },
    { key: 'commits',label: 'Commits' },
  ]}
  activeKey={activeKey}
  onChange={onChange}
/>

<TabPanel id="issues" activeKey={activeKey}>…</TabPanel>
<TabPanel id="prs"    activeKey={activeKey}>…</TabPanel>
```

### Navbar
```tsx
<Navbar
  brand={{ label: 'GitResearch', icon: 'G' }}
  items={[
    { key: 'dashboard', label: 'Dashboard', href: '/' },
    { key: 'repos',     label: 'Repositories', href: '/repos' },
    { key: 'analysis',  label: 'Analysis', href: '/analysis' },
  ]}
  activeKey="dashboard"
  end={<Button variant="primary" size="sm">+ Collect</Button>}
/>
```

### Controls
```tsx
<Checkbox label="Include closed issues" />
<Toggle label="Auto-sync" helper="Refresh every 30 minutes" checked={sync} onChange={setSync} />
<RadioGroup
  name="export-format"
  label="Export format"
  options={[
    { value: 'csv',  label: 'CSV' },
    { value: 'json', label: 'JSON' },
  ]}
  value={format}
  onChange={setFormat}
/>
```

### Toast
```tsx
const { toasts, dismiss, toast } = useToast();

toast.success('142 issues synced');
toast.error('Rate limit exceeded', 'GitHub API');

// Render once near app root:
<ToastContainer toasts={toasts} onDismiss={dismiss} />
```

### Alert (inline)
```tsx
<Alert variant="info" title="GitHub API">Using authenticated requests — 5,000 req/hr limit.</Alert>
<Alert variant="warning">Rate limit at 80% — consider slowing sync frequency.</Alert>
<Alert variant="error">Failed to connect. Check your personal access token.</Alert>
```

### Empty State
```tsx
<EmptyState
  icon={<DatabaseIcon />}
  title="No data collected yet"
  body="Add a GitHub repository to start collecting issues, pull requests, and commits."
  action={<Button variant="primary">+ Add repository</Button>}
/>
```
