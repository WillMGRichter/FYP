import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageTitle, SectionHeading, Text, Caption, Link } from '../components/ui/Typography';
import { Card, Tabs, TabPanel, useTabs } from '../components/ui/Layout';
import { Button, ButtonGroup } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import type { StatusVariant } from '../components/ui/Badge';
import { Alert, EmptyState, Spinner, ToastContainer, useToast } from '../components/ui/Feedback';
import { api } from '../lib/api';
import type {
  ArtifactDetail,
  ChangeHistory,
  EntityChangeEvent,
  EntityChangeHistory,
  RepositoryDetail,
  SnapshotDetail,
} from '../lib/api';
import './RepositoryDetailPage.css';

/**
 * Map an artifact state string to a badge variant.
 * @param state - GitHub state (open/closed/merged)
 * @returns Badge variant
 */
const stateVariant = (state: string): StatusVariant => {
  if (state === 'open') return 'open';
  if (state === 'merged') return 'merged';
  if (state === 'closed') return 'closed';
  return 'draft';
};

/**
 * Render a collection of artifact rows with expandable snapshots.
 */
function ArtifactList({ artifacts, accent }: { artifacts: ArtifactDetail[]; accent: 'issue' | 'pr' | 'commit' }) {
  if (artifacts.length === 0) {
    return (
      <EmptyState title="Nothing collected here yet" body="Run a collection or use the browser extension to capture data for this repository." />
    );
  }

  return (
    <div className="artifact-list">
      {artifacts.map((artifact) => (
        <details className="artifact-item" key={artifact.id}>
          <summary className="artifact-summary">
            <div className="artifact-title-block">
              <span className={`artifact-number artifact-number-${accent}`}>
                {artifact.githubNumber
                  ? `#${artifact.githubNumber}`
                  : artifact.githubSha?.slice(0, 7) ?? '—'}
              </span>
              <span className="artifact-title">{artifact.title ?? 'Untitled artifact'}</span>
            </div>
            <div className="artifact-meta">
              {artifact.state && <Badge status={stateVariant(artifact.state)} label={artifact.state} />}
              {artifact.authorLogin && <Caption>{artifact.authorLogin}</Caption>}
              <Caption>
                {artifact.snapshots.length} snapshot{artifact.snapshots.length === 1 ? '' : 's'}
              </Caption>
              {artifact.htmlUrl && (
                <Link href={artifact.htmlUrl} external>
                  GitHub
                </Link>
              )}
            </div>
          </summary>

          <div className="snapshot-list">
            {artifact.snapshots.length === 0 ? (
              <Caption>No snapshots captured for this artifact.</Caption>
            ) : (
              artifact.snapshots.map((snapshot) => (
                <div className="snapshot-item" key={snapshot.id}>
                  <div className="snapshot-header">
                    <Caption>Source: {snapshot.source}</Caption>
                    <Caption>Captured: {new Date(snapshot.capturedAt).toLocaleString()}</Caption>
                  </div>
                  <pre className="snapshot-payload">{JSON.stringify(snapshot.payload, null, 2)}</pre>
                </div>
              ))
            )}
          </div>
        </details>
      ))}
    </div>
  );
}

/**
 * Render repository-level snapshots with expandable payloads.
 */
function RepositorySnapshots({ snapshots }: { snapshots: SnapshotDetail[] }) {
  if (snapshots.length === 0) {
    return (
      <EmptyState title="No repository snapshots yet" body="Snapshots appear here when the repository metadata is captured." />
    );
  }

  return (
    <div className="snapshot-list">
      {snapshots.map((snapshot) => (
        <div className="snapshot-item" key={snapshot.id}>
          <div className="snapshot-header">
            <Caption>Source: {snapshot.source}</Caption>
            <Caption>Captured: {new Date(snapshot.capturedAt).toLocaleString()}</Caption>
          </div>
          <pre className="snapshot-payload">{JSON.stringify(snapshot.payload, null, 2)}</pre>
        </div>
      ))}
    </div>
  );
}

/**
 * Format an arbitrary diff value for display, truncating long payloads.
 * @param value - Raw decoded JSON value
 * @returns Compact string representation
 */
const formatDiffValue = (value: unknown): string => {
  if (value === undefined) return '—';
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (text == null) return 'null';
  return text.length > 120 ? `${text.slice(0, 120)}…` : text;
};

/**
 * Render one detected change event: when it happened and which fields moved.
 */
function ChangeEventItem({ event }: { event: EntityChangeEvent }) {
  const [expanded, setExpanded] = useState(false);
  const visibleFields = expanded ? event.fields : event.fields.slice(0, 6);

  return (
    <div className="change-event">
      <div className="change-event-header">
        <Caption>{new Date(event.toCapturedAt).toLocaleString()}</Caption>
        <Caption>
          {event.fromSource} → {event.toSource}
        </Caption>
        <Badge status="progress" label={`${event.changedFieldCount} field${event.changedFieldCount === 1 ? '' : 's'}`} />
      </div>
      <div className="change-event-fields">
        {visibleFields.map((field) => (
          <div className={`field-diff field-diff-${field.status}`} key={field.path}>
            <code className="field-diff-path">{field.path}</code>
            <span className="field-diff-values">
              <span className="field-diff-before">{formatDiffValue(field.before)}</span>
              <span className="field-diff-arrow">→</span>
              <span className="field-diff-after">{formatDiffValue(field.after)}</span>
            </span>
          </div>
        ))}
      </div>
      {event.fields.length > 6 && (
        <Button variant="ghost" size="sm" onClick={() => setExpanded((open) => !open)}>
          {expanded ? 'Show fewer fields' : `Show all ${event.fields.length} changed fields`}
        </Button>
      )}
    </div>
  );
}

/**
 * Render the per-entity change history computed from consecutive snapshots.
 */
function ChangeHistoryPanel({
  entities,
  totalChangeEvents,
}: {
  entities: EntityChangeHistory[];
  totalChangeEvents: number;
}) {
  const changedEntities = entities
    .filter((entity) => entity.changeEvents.length > 0)
    .sort(
      (a, b) =>
        new Date(b.changeEvents.at(-1)?.toCapturedAt ?? 0).getTime() -
        new Date(a.changeEvents.at(-1)?.toCapturedAt ?? 0).getTime(),
    );

  if (changedEntities.length === 0) {
    return (
      <EmptyState
        title="No changes detected yet"
        body={
          totalChangeEvents === 0
            ? 'Change history appears once an entity has been captured two or more times with differing data. Re-run a collection or capture extension snapshots over time.'
            : 'No entity has changed between captures yet.'
        }
      />
    );
  }

  return (
    <div className="artifact-list">
      {changedEntities.map((entity) => (
        <details className="artifact-item" key={entity.key}>
          <summary className="artifact-summary">
            <div className="artifact-title-block">
              <span className={`artifact-number artifact-number-${entity.entityType === 'ISSUE' ? 'issue' : entity.entityType === 'PULL_REQUEST' ? 'pr' : entity.entityType === 'COMMIT' ? 'commit' : 'issue'}`}>
                {entity.label ?? entity.key}
              </span>
              <span className="artifact-title">{entity.title ?? 'Untitled entity'}</span>
            </div>
            <div className="artifact-meta">
              {entity.state && <Badge status={stateVariant(entity.state)} label={entity.state} />}
              <Badge status="draft" label={`${entity.changeEvents.length} change${entity.changeEvents.length === 1 ? '' : 's'}`} />
              <Caption>
                {entity.snapshotCount} snapshot{entity.snapshotCount === 1 ? '' : 's'}
              </Caption>
              {entity.htmlUrl && (
                <Link href={entity.htmlUrl} external>
                  GitHub
                </Link>
              )}
            </div>
          </summary>

          <div className="snapshot-list">
            {[...entity.changeEvents].reverse().map((event) => (
              <ChangeEventItem event={event} key={`${event.fromSnapshotId}-${event.toSnapshotId}`} />
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}

/**
 * Repository detail page: browse collected artifacts and snapshots,
 * and export the full dataset as JSON or CSV.
 */
export default function RepositoryDetailPage() {
  const { id = '' } = useParams();

  return <RepositoryDetailBody key={id} id={id} />;
}

/**
 * Loads and renders the dataset for a single repository.
 * Keyed by repository ID so navigating between repositories remounts cleanly.
 */
function RepositoryDetailBody({ id }: { id: string }) {
  const navigate = useNavigate();
  const { toasts, dismiss, toast } = useToast();
  const [repository, setRepository] = useState<RepositoryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'json' | 'csv' | null>(null);
  const tabs = useTabs('issues');
  const [history, setHistory] = useState<ChangeHistory | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getRepository(id)
      .then(({ repository: detail }) => setRepository(detail))
      .catch((loadError: Error) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, [id]);

  /**
   * Load the change history the first time the Change History tab is opened.
   * Triggered from the tab-change handler so no data loads until requested.
   */
  const loadChangeHistory = async () => {
    if (history || historyLoading) return;
    setHistoryLoading(true);
    try {
      const detail = await api.getChangeHistory(id);
      setHistory(detail);
    } catch (historyLoadError) {
      setHistoryError(historyLoadError instanceof Error ? historyLoadError.message : 'Failed to load history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleTabChange = (key: string) => {
    tabs.onChange(key);
    if (key === 'history') void loadChangeHistory();
  };

  const issues = repository?.artifacts.filter((artifact) => artifact.type === 'ISSUE') ?? [];
  const pulls = repository?.artifacts.filter((artifact) => artifact.type === 'PULL_REQUEST') ?? [];
  const commits = repository?.artifacts.filter((artifact) => artifact.type === 'COMMIT') ?? [];
  const repositorySnapshots = repository?.snapshots ?? [];

  const handleExport = async (format: 'json' | 'csv') => {
    if (!repository) return;
    setExporting(format);

    try {
      const blob = await api.exportRepository(repository.id, format);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${repository.fullName.replace(/\//g, '-')}-data.${format}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success(`${format.toUpperCase()} export downloaded`, 'Export');
    } catch (exportError) {
      toast.error(exportError instanceof Error ? exportError.message : 'Export failed', 'Export');
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="repo-detail">
      <ToastContainer toasts={toasts} onDismiss={dismiss} />

      {loading && (
        <Card className="repo-detail-loading">
          <Spinner />
          <Text secondary>Loading repository data</Text>
        </Card>
      )}

      {!loading && error && (
        <Alert variant="error" title="Could not load repository">
          {error}
        </Alert>
      )}

      {!loading && repository && (
        <>
          <div className="repo-detail-header">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
              ← Back to dashboard
            </Button>
            <PageTitle subtitle={repository.description ?? 'No repository description available.'}>
              {repository.fullName}
            </PageTitle>
            <ButtonGroup>
              <Button
                variant="primary"
                loading={exporting === 'json'}
                disabled={exporting !== null}
                onClick={() => handleExport('json')}
              >
                Export JSON
              </Button>
              <Button
                variant="secondary"
                loading={exporting === 'csv'}
                disabled={exporting !== null}
                onClick={() => handleExport('csv')}
              >
                Export CSV
              </Button>
            </ButtonGroup>
          </div>

          <div className="repo-detail-facts">
            <span>{repository.stars.toLocaleString()} stars</span>
            <span>{repository.forks.toLocaleString()} forks</span>
            <span>{repository.openIssues.toLocaleString()} open issues</span>
            <span>{repository.language ?? 'Unknown'} language</span>
            <span>{repository.artifacts.length} artifacts</span>
            <span>
              {repository.artifacts.reduce((sum, artifact) => sum + artifact.snapshots.length, 0) +
                repository.snapshots.length}{' '}
              snapshots
            </span>
            <span>Collected {new Date(repository.collectedAt).toLocaleDateString()}</span>
          </div>

          <div className="repo-detail-actions">
            <Link href={repository.htmlUrl} external>
              View on GitHub
            </Link>
          </div>

          <Tabs
            items={[
              { key: 'issues', label: 'Issues', count: issues.length },
              { key: 'pulls', label: 'Pull Requests', count: pulls.length },
              { key: 'commits', label: 'Commits', count: commits.length },
              { key: 'repository', label: 'Repository', count: repositorySnapshots.length },
              { key: 'history', label: 'Change History', count: history?.totalChangeEvents },
            ]}
            activeKey={tabs.activeKey}
            onChange={handleTabChange}
          />

          <TabPanel id="issues" activeKey={tabs.activeKey}>
            <Card>
              <SectionHeading subtitle="Issues collected for this repository.">Issues</SectionHeading>
              <ArtifactList artifacts={issues} accent="issue" />
            </Card>
          </TabPanel>

          <TabPanel id="pulls" activeKey={tabs.activeKey}>
            <Card>
              <SectionHeading subtitle="Pull requests collected for this repository.">
                Pull Requests
              </SectionHeading>
              <ArtifactList artifacts={pulls} accent="pr" />
            </Card>
          </TabPanel>

          <TabPanel id="commits" activeKey={tabs.activeKey}>
            <Card>
              <SectionHeading subtitle="Commits collected for this repository.">Commits</SectionHeading>
              <ArtifactList artifacts={commits} accent="commit" />
            </Card>
          </TabPanel>

          <TabPanel id="repository" activeKey={tabs.activeKey}>
            <Card>
              <SectionHeading subtitle="Repository-level snapshots captured over time.">
                Repository Data
              </SectionHeading>
              <RepositorySnapshots snapshots={repositorySnapshots} />
            </Card>
          </TabPanel>

          <TabPanel id="history" activeKey={tabs.activeKey}>
            <Card>
              <SectionHeading subtitle="Field-level changes detected between consecutive snapshots of each entity.">
                Change History
              </SectionHeading>
              {historyLoading && (
                <div className="repo-detail-loading">
                  <Spinner />
                  <Text secondary>Computing change history</Text>
                </div>
              )}
              {!historyLoading && historyError && (
                <Alert variant="error" title="Could not load change history">
                  {historyError}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setHistoryError(null);
                      void loadChangeHistory();
                    }}
                  >
                    Retry
                  </Button>
                </Alert>
              )}
              {!historyLoading && !historyError && history && (
                <ChangeHistoryPanel
                  entities={history.entities}
                  totalChangeEvents={history.totalChangeEvents}
                />
              )}
            </Card>
          </TabPanel>
        </>
      )}
    </div>
  );
}
