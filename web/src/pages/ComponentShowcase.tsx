import React, { useState } from 'react';

// ─── Import all components ────────────────────────────────
import {
  PageTitle,
  SectionHeading,
  Label,
  Text,
  Caption,
  Code,
  Link,
} from '../components/ui/Typography';
import { Button, IconButton, ButtonGroup } from '../components/ui/Button';
import { Input, Textarea, Select, Field } from '../components/ui/Input';
import { Badge, Tag } from '../components/ui/Badge';
import { Dropdown } from '../components/ui/Dropdown';
import { Navbar, PageHeader, Tabs, TabPanel, Card, useTabs } from '../components/ui/Layout';
import { Checkbox, Radio, RadioGroup, Toggle } from '../components/ui/Controls';
import { Alert, ToastContainer, EmptyState, Spinner, useToast } from '../components/ui/Feedback';

// ─── Icons (inline SVG — no extra deps) ──────────────────
const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
    <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const FilterIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <path d="M2 4h12M5 8h6M7 12h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <path d="M8 3v7M5 8l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3 13h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <path d="M3 5h10M6 5V3h4v2M6 8v4M10 8v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <rect x="4" y="5" width="8" height="9" rx="1" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const DotsIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <circle cx="4" cy="8" r="1.2" fill="currentColor" />
    <circle cx="8" cy="8" r="1.2" fill="currentColor" />
    <circle cx="12" cy="8" r="1.2" fill="currentColor" />
  </svg>
);

const DatabaseIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
    <ellipse cx="16" cy="9" rx="10" ry="4" stroke="currentColor" strokeWidth="1.5" />
    <path d="M6 9v7c0 2.21 4.48 4 10 4s10-1.79 10-4V9" stroke="currentColor" strokeWidth="1.5" />
    <path d="M6 16v7c0 2.21 4.48 4 10 4s10-1.79 10-4v-7" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

// ─── Section divider ──────────────────────────────────────
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section style={{ marginBottom: 48 }}>
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24,
    }}>
      <span style={{
        fontSize: 11, fontWeight: 500, color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap',
      }}>
        {title}
      </span>
      <div style={{ flex: 1, height: '0.5px', background: 'var(--border-subtle)' }} />
    </div>
    {children}
  </section>
);

const Row = ({ children, wrap = true }: { children: React.ReactNode; wrap?: boolean }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: wrap ? 'wrap' : 'nowrap' }}>
    {children}
  </div>
);

// ─── Main showcase page ───────────────────────────────────
export default function ComponentShowcase() {
  const { activeKey, onChange } = useTabs('buttons');
  const { toasts, dismiss, toast } = useToast();

  // Form state
  const [inputVal, setInputVal] = useState('');
  const [searchVal, setSearchVal] = useState('');
  const [selectVal, setSelectVal] = useState('');
  const [textareaVal, setTextareaVal] = useState('');
  const [checked, setChecked] = useState(false);
  const [toggled, setToggled] = useState(false);
  const [radioVal, setRadioVal] = useState('json');
  const [loading, setLoading] = useState(false);

  const handleLoadingBtn = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast.success('142 issues synced from facebook/react', 'Sync complete');
    }, 1800);
  };

  const dropdownItems = [
    { key: 'export-csv',  label: 'Export as CSV',  icon: <DownloadIcon /> },
    { key: 'export-json', label: 'Export as JSON', icon: <DownloadIcon /> },
    { key: 'sep1', separator: true as const },
    { key: 'section', sectionLabel: 'Danger zone' },
    { key: 'delete', label: 'Delete repository', icon: <TrashIcon />, danger: true },
  ];

  const navItems = [
    { key: 'dashboard',   label: 'Dashboard',    href: '#' },
    { key: 'repos',       label: 'Repositories', href: '#' },
    { key: 'analysis',    label: 'Analysis',      href: '#' },
    { key: 'settings',    label: 'Settings',      href: '#' },
  ];

  const tabItems = [
    { key: 'buttons',    label: 'Buttons' },
    { key: 'inputs',     label: 'Inputs' },
    { key: 'badges',     label: 'Badges & Tags' },
    { key: 'layout',     label: 'Layout' },
    { key: 'controls',   label: 'Controls' },
    { key: 'feedback',   label: 'Feedback' },
    { key: 'typography', label: 'Typography' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)', fontFamily: 'var(--font-sans)' }}>
      {/* ── Navbar ── */}
      <Navbar
        brand={{ label: 'GitResearch', icon: 'G' }}
        items={navItems}
        activeKey="dashboard"
        end={
          <Row wrap={false}>
            <Button variant="ghost" size="sm">Docs</Button>
            <Button variant="primary" size="sm" leftIcon={<PlusIcon />}>Collect</Button>
          </Row>
        }
      />

      {/* ── Page header ── */}
      <PageHeader
        title="Component library"
        subtitle="All UI components used across the GitHub Research Tool — consistent tokens, dark-mode ready."
        actions={
          <Row wrap={false}>
            <Dropdown
              trigger={<Button variant="secondary" size="sm" rightIcon={<DotsIcon />}>Actions</Button>}
              items={dropdownItems}
              align="right"
              onSelect={(key) => toast.info(`Selected: ${key}`)}
            />
            <Button variant="primary" size="sm" leftIcon={<DownloadIcon />}>Export</Button>
          </Row>
        }
      />

      {/* ── Tabs ── */}
      <div style={{ padding: '0 32px', background: 'var(--bg-surface)', borderBottom: '0.5px solid var(--border-subtle)' }}>
        <Tabs items={tabItems} activeKey={activeKey} onChange={onChange} />
      </div>

      {/* ── Content ── */}
      <div style={{ padding: '40px 32px', maxWidth: 900, margin: '0 auto' }}>

        {/* BUTTONS */}
        <TabPanel id="buttons" activeKey={activeKey}>
          <Section title="Variants">
            <Row>
              <Button variant="primary">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Danger</Button>
              <Button variant="danger-ghost">Danger ghost</Button>
            </Row>
          </Section>

          <Section title="Sizes">
            <Row>
              <Button variant="primary" size="lg">Large</Button>
              <Button variant="primary" size="md">Medium</Button>
              <Button variant="primary" size="sm">Small</Button>
            </Row>
          </Section>

          <Section title="With icons">
            <Row>
              <Button variant="primary" leftIcon={<PlusIcon />}>Collect data</Button>
              <Button variant="secondary" leftIcon={<FilterIcon />}>Filter</Button>
              <Button variant="secondary" rightIcon={<DownloadIcon />}>Export</Button>
              <IconButton variant="secondary" icon={<SearchIcon />} label="Search" />
              <IconButton variant="ghost" icon={<DotsIcon />} label="More options" />
            </Row>
          </Section>

          <Section title="States">
            <Row>
              <Button variant="primary" loading={loading} onClick={handleLoadingBtn}>
                {loading ? 'Syncing…' : 'Sync repository'}
              </Button>
              <Button variant="secondary" disabled>Disabled</Button>
              <Button variant="ghost" disabled>Ghost disabled</Button>
            </Row>
          </Section>

          <Section title="Button group">
            <ButtonGroup>
              <Button variant="secondary" size="sm">Issues</Button>
              <Button variant="secondary" size="sm">Pull requests</Button>
              <Button variant="secondary" size="sm">Commits</Button>
            </ButtonGroup>
          </Section>

          <Section title="Dropdown">
            <Row>
              <Dropdown
                trigger={<Button variant="secondary" rightIcon={<DotsIcon />}>Actions</Button>}
                items={dropdownItems}
                onSelect={(key) => toast.info(`Action: ${key}`)}
              />
              <Dropdown
                trigger={<IconButton variant="secondary" icon={<DotsIcon />} label="More" />}
                items={dropdownItems}
                align="right"
                onSelect={(key) => toast.info(`Action: ${key}`)}
              />
            </Row>
          </Section>
        </TabPanel>

        {/* INPUTS */}
        <TabPanel id="inputs" activeKey={activeKey}>
          <Section title="Text inputs">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 480 }}>
              <Input
                label="Repository URL"
                placeholder="github.com/org/repo"
                helper="Enter the full GitHub repository URL"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
              />
              <Input
                label="Search"
                placeholder="Search issues, PRs, commits…"
                leftIcon={<SearchIcon />}
                search
                value={searchVal}
                onChange={(e) => setSearchVal(e.target.value)}
              />
              <Input
                label="Personal access token"
                type="password"
                placeholder="ghp_xxxxxxxxxxxx"
                error="Token is invalid or expired"
                required
              />
              <Input
                label="Max results"
                type="number"
                placeholder="1000"
                helper="Leave blank for no limit"
                size="sm"
              />
            </div>
          </Section>

          <Section title="Select">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 480 }}>
              <Select
                label="Issue status"
                placeholder="Any status"
                value={selectVal}
                onChange={(e) => setSelectVal(e.target.value)}
                options={[
                  { value: 'open',   label: 'Open' },
                  { value: 'closed', label: 'Closed' },
                  { value: 'merged', label: 'Merged' },
                ]}
              />
              <Select
                label="Data type"
                options={[
                  { value: 'issues',  label: 'Issues' },
                  { value: 'prs',     label: 'Pull requests' },
                  { value: 'commits', label: 'Commits' },
                ]}
                defaultValue="issues"
              />
            </div>
          </Section>

          <Section title="Textarea">
            <div style={{ maxWidth: 480 }}>
              <Textarea
                label="Notes"
                placeholder="Add context about this collection run…"
                helper="Visible only to you"
                rows={4}
                value={textareaVal}
                onChange={(e) => setTextareaVal(e.target.value)}
              />
            </div>
          </Section>
        </TabPanel>

        {/* BADGES & TAGS */}
        <TabPanel id="badges" activeKey={activeKey}>
          <Section title="Status badges">
            <Row>
              <Badge status="open" />
              <Badge status="closed" />
              <Badge status="merged" />
              <Badge status="draft" />
              <Badge status="progress" />
            </Row>
          </Section>

          <Section title="Custom labels">
            <Row>
              <Badge status="open" label="14 open" />
              <Badge status="closed" label="892 closed" />
              <Badge status="merged" label="Merged to main" />
            </Row>
          </Section>

          <Section title="Category tags">
            <Row>
              <Tag variant="bug">bug</Tag>
              <Tag variant="feature">feature request</Tag>
              <Tag variant="docs">documentation</Tag>
              <Tag variant="perf">performance</Tag>
              <Tag variant="refactor">refactor</Tag>
              <Tag>unlabelled</Tag>
            </Row>
          </Section>

          <Section title="In context (issue card)">
            <Card style={{ maxWidth: 560 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.4, marginBottom: 8 }}>
                    Memory leak in event listener teardown on unmount
                  </div>
                  <Row>
                    <Tag variant="bug">bug</Tag>
                    <Tag variant="perf">performance</Tag>
                  </Row>
                </div>
                <Badge status="open" />
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 10 }}>
                <Caption>facebook/react</Caption>
                <Caption>#28741</Caption>
                <Caption>opened 3 days ago</Caption>
                <Caption>💬 12</Caption>
              </div>
            </Card>
          </Section>
        </TabPanel>

        {/* LAYOUT */}
        <TabPanel id="layout" activeKey={activeKey}>
          <Section title="Card">
            <Row>
              <Card style={{ flex: 1, minWidth: 200 }}>
                <Label caps>Issues collected</Label>
                <div style={{ fontSize: 28, fontWeight: 600, margin: '6px 0 4px', letterSpacing: '-0.02em' }}>2,841</div>
                <Caption >↑ 142 today</Caption>
              </Card>
              <Card style={{ flex: 1, minWidth: 200 }}>
                <Label caps>Pull requests</Label>
                <div style={{ fontSize: 28, fontWeight: 600, margin: '6px 0 4px', letterSpacing: '-0.02em' }}>1,204</div>
                <Caption >↑ 38 today</Caption>
              </Card>
              <Card style={{ flex: 1, minWidth: 200 }}>
                <Label caps>Repos tracked</Label>
                <div style={{ fontSize: 28, fontWeight: 600, margin: '6px 0 4px', letterSpacing: '-0.02em' }}>17</div>
                <Caption>across 4 orgs</Caption>
              </Card>
            </Row>
          </Section>

          <Section title="Tabs (nested example)">
            <NestedTabsExample />
          </Section>

          <Section title="Navbar preview">
            <Card small>
              <Navbar
                brand={{ label: 'GitResearch', icon: 'G' }}
                items={navItems}
                activeKey="repos"
                end={<Button variant="primary" size="sm" leftIcon={<PlusIcon />}>Collect</Button>}
              />
            </Card>
          </Section>
        </TabPanel>

        {/* CONTROLS */}
        <TabPanel id="controls" activeKey={activeKey}>
          <Section title="Checkbox">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Checkbox label="Include closed issues" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
              <Checkbox label="Sync pull requests" defaultChecked />
              <Checkbox label="Enable AI summaries" helper="Uses Claude to summarise issue discussions" />
              <Checkbox label="API access (disabled)" disabled />
              <Checkbox label="Indeterminate state" indeterminate />
            </div>
          </Section>

          <Section title="Toggle">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Toggle label="Auto-sync" helper="Refresh data every 30 minutes" checked={toggled} onChange={setToggled} />
              <Toggle label="GitHub API" helper="Use authenticated requests (5,000 req/hr)"  />
              <Toggle label="Extension capture" disabled />
            </div>
          </Section>

          <Section title="Radio group">
            <RadioGroup
              name="export-format"
              label="Export format"
              value={radioVal}
              onChange={setRadioVal}
              options={[
                { value: 'csv',     label: 'CSV',     helper: 'Best for spreadsheets' },
                { value: 'json',    label: 'JSON',    helper: 'Best for programmatic use' },
                { value: 'parquet', label: 'Parquet', helper: 'Best for large datasets' },
              ]}
            />
          </Section>
        </TabPanel>

        {/* FEEDBACK */}
        <TabPanel id="feedback" activeKey={activeKey}>
          <Section title="Alert (inline)">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Alert variant="info" title="GitHub API">
                Using authenticated requests — 5,000 req/hr limit. 3,241 remaining.
              </Alert>
              <Alert variant="success" title="Sync complete">
                142 issues and 38 pull requests collected from facebook/react.
              </Alert>
              <Alert variant="warning">
                Rate limit at 80% — consider reducing sync frequency.
              </Alert>
              <Alert variant="error" title="Connection failed">
                Could not reach GitHub API. Check your personal access token.
              </Alert>
            </div>
          </Section>

          <Section title="Toasts">
            <Row>
              <Button variant="secondary" size="sm" onClick={() => toast.success('142 issues synced', 'Sync complete')}>
                Success toast
              </Button>
              <Button variant="secondary" size="sm" onClick={() => toast.error('Rate limit exceeded', 'GitHub API')}>
                Error toast
              </Button>
              <Button variant="secondary" size="sm" onClick={() => toast.info('AI summary generated for #28741')}>
                Info toast
              </Button>
              <Button variant="secondary" size="sm" onClick={() => toast.warning('Approaching rate limit')}>
                Warning toast
              </Button>
            </Row>
          </Section>

          <Section title="Empty state">
            <EmptyState
              icon={<DatabaseIcon />}
              title="No data collected yet"
              body="Add a GitHub repository to start collecting issues, pull requests, and commits for your research."
              action={<Button variant="primary" leftIcon={<PlusIcon />}>Add repository</Button>}
            />
          </Section>

          <Section title="Spinner">
            <Row>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Spinner size="sm" />
                <Caption>Small</Caption>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Spinner size="md" />
                <Caption>Medium</Caption>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Spinner size="lg" />
                <Caption>Large</Caption>
              </div>
            </Row>
          </Section>
        </TabPanel>

        {/* TYPOGRAPHY */}
        <TabPanel id="typography" activeKey={activeKey}>
          <Section title="Headings">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <PageTitle subtitle="Subtitle">
                    Page Title
                </PageTitle>
              <SectionHeading subtitle="Section subheading to add more context">Section heading</SectionHeading>
            </div>
          </Section>

          <Section title="Body & utility text">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 560 }}>
              <Text>Body text — used for descriptions, content, and prose across the app. Line height is loose for readability.</Text>
              <Text secondary>Secondary body text — muted tone for supporting information and metadata.</Text>
              <Label>Field label</Label>
              <Label caps>Caps label — used for section markers and table headers</Label>
              <Caption>Caption text — timestamps, counts, and fine print</Caption>
            </div>
          </Section>

          <Section title="Inline elements">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Text>
                Fetch issues using the <Code>GET /repos/:owner/:repo/issues</Code> endpoint.
              </Text>
              <Text>
                Read more in the <Link href="#">GitHub REST API docs</Link>.
              </Text>
            </div>
          </Section>
        </TabPanel>

      </div>

      {/* Toast container */}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

// ─── Nested tabs example ──────────────────────────────────
function NestedTabsExample() {
  const { activeKey, onChange } = useTabs('issues');
  return (
    <Card>
      <Tabs
        items={[
          { key: 'issues',  label: 'Issues',        count: 2841 },
          { key: 'prs',     label: 'Pull requests',  count: 1204 },
          { key: 'commits', label: 'Commits' },
        ]}
        activeKey={activeKey}
        onChange={onChange}
      />
      <div style={{ paddingTop: 16 }}>
        <TabPanel id="issues" activeKey={activeKey}>
          <Text secondary>Showing 2,841 issues across 17 repositories.</Text>
        </TabPanel>
        <TabPanel id="prs" activeKey={activeKey}>
          <Text secondary>Showing 1,204 pull requests — 387 open, 817 merged.</Text>
        </TabPanel>
        <TabPanel id="commits" activeKey={activeKey}>
          <Text secondary>No commits collected yet. Add a repository to begin.</Text>
        </TabPanel>
      </div>
    </Card>
  );
}