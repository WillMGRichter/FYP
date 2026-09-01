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
  MissingArtifact,
  MissingReport,
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
 * Render a collection of artifact rows with expandable snapshots and AI summaries.
 */
function ArtifactList({
  artifacts,
  accent,
  toast,
}: {
  artifacts: ArtifactDetail[];
  accent: 'issue' | 'pr' | 'commit';
  toast: ReturnType<typeof useToast>['toast'];
}) {
  const [summaries, setSummaries] = useState<
    Record<string, { aiSummary: string | null; aiSummaryGeneratedAt: string | null }>
  >({});
  const [summarisingId, setSummarisingId] = useState<string | null>(null);

  if (artifacts.length === 0) {
    return (
      <EmptyState title="Nothing collected here yet" body="Run a collection or use the browser extension to capture data for this repository." />
    );
  }

  const handleSummarise = async (artifactId: string) => {
    setSummarisingId(artifactId);
    try {
      const { artifact } = await api.summariseArtifact(artifactId);
      setSummaries((prev) => ({ ...prev, [artifactId]: artifact }));
    } catch (summariseError) {
      toast.error(
        summariseError instanceof Error ? summariseError.message : 'Summarisation failed',
        'AI Summary',
      );
    } finally {
      setSummarisingId(null);
    }
  };

  return (
    <div className="artifact-list">
      {artifacts.map((artifact) => {
        const summary = summaries[artifact.id] ?? artifact;

        return (
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

            <div className="artifact-ai-summary">
              <Button
                variant="ghost"
                size="sm"
                loading={summarisingId === artifact.id}
                disabled={summarisingId !== null}
                onClick={(event) => {
                  event.preventDefault();
                  handleSummarise(artifact.id);
                }}
              >
                {summary.aiSummary ? 'Re-summarise' : 'Summarise'}
              </Button>
              {summary.aiSummary && (
                <>
                  <Text>{summary.aiSummary}</Text>
                  {summary.aiSummaryGeneratedAt && (
                    <Caption>
                      Generated {new Date(summary.aiSummaryGeneratedAt).toLocaleString()}
                    </Caption>
                  )}
                </>
              )}
            </div>

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
        );
      })}
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
        new Date(b.changeEvents[b.changeEvents.length - 1]?.toCapturedAt ?? 0).getTime() -
        new Date(a.changeEvents[a.changeEvents.length - 1]?.toCapturedAt ?? 0).getTime(),
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
              <span
                className={`artifact-number artifact-number-${
                  entity.entityType === 'ISSUE'
                    ? 'issue'
                    : entity.entityType === 'PULL_REQUEST'
                      ? 'pr'
                      : entity.entityType === 'COMMIT'
                        ? 'commit'
                        : 'issue'
                }`}
              >
                {entity.label ?? entity.key}
              </span>
              <span className="artifact-title">{entity.title ?? 'Untitled entity'}</span>
            </div>
            <div className="artifact-meta">
              {entity.state && <Badge status={stateVariant(entity.state)} label={entity.state} />}
              <Badge
                status="draft"
                label={`${entity.changeEvents.length} change${entity.changeEvents.length === 1 ? '' : 's'}`}
              />
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
 * Human-readable label for an artifact type.
 */
const entityTypeLabel: Record<MissingArtifact['type'], string> = {
  ISSUE: 'Issues',
  PULL_REQUEST: 'Pull Requests',
  COMMIT: 'Commits',
};

/**
 * Render the disappearance report: artifacts no longer seen in the latest sweep.
 */
function VanishedPanel({ report }: { report: MissingReport }) {
  if (report.totalMissing === 0) {
    return (
      <EmptyState
        title="No vanished entities"
        body="Every artifact captured in earlier sweeps was still present in the most recent collection run."
      />
    );
  }

  return (
    <div>
      {report.lastSweep?.truncated && (
        <Alert variant="warning" title="Latest sweep was partial">
          The most recent collection run hit its pagination cap, so absence from that run is not
          conclusive evidence of deletion for older entities.
        </Alert>
      )}
      <div className="repo-detail-facts vanished-summary">
        <span>{report.summary.ISSUE} issues</span>
        <span>{report.summary.PULL_REQUEST} pull requests</span>
        <span>{report.summary.COMMIT} commits</span>
        {report.lastSweep && (
          <span>Last sweep {new Date(report.lastSweep.startedAt).toLocaleDateString()}</span>
        )}
      </div>

      <div className="artifact-list">
        {report.missingArtifacts.map((artifact) => (
          <details className="artifact-item" key={artifact.id}>
            <summary className="artifact-summary">
              <div className="artifact-title-block">
                <span
                  className={`artifact-number artifact-number-${
                    artifact.type === 'ISSUE'
                      ? 'issue'
                      : artifact.type === 'PULL_REQUEST'
                        ? 'pr'
                        : 'commit'
                  }`}
                >
                  {artifact.githubNumber != null
                    ? `#${artifact.githubNumber}`
                    : artifact.githubSha?.slice(0, 7) ?? '—'}
                </span>
                <span className="artifact-title">{artifact.title ?? 'Untitled artifact'}</span>
              </div>
              <div className="artifact-meta">
                <Badge status="draft" label={entityTypeLabel[artifact.type]} />
                {artifact.state && <Badge status={stateVariant(artifact.state)} label={artifact.state} />}
                <Caption>Last seen {new Date(artifact.collectedAt).toLocaleDateString()}</Caption>
                {artifact.htmlUrl && (
                  <Link href={artifact.htmlUrl} external>
                    GitHub
                  </Link>
                )}
              </div>
            </summary>
            <div className="snapshot-list">
              <Caption>
                Not observed in the latest sweep. The preserved snapshots for this entity remain part of
                the dataset and are available in the other tabs.
              </Caption>
            </div>
          </details>
        ))}
      </div>
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

type OverviewEntityType = 'ISSUE' | 'PULL_REQUEST' | 'COMMIT';

/**
 * Render a repository-wide AI overview digest for one artifact type, with a
 * button to (re-)generate it.
 */
function OverviewPanel({
  label,
  overview,
  generatedAt,
  loading,
  disabled,
  onGenerate,
}: {
  label: string;
  overview: string | null | undefined;
  generatedAt: string | null | undefined;
  loading: boolean;
  disabled: boolean;
  onGenerate: () => void;
}) {
  return (
    <div className="repo-overview">
      <Button variant="secondary" size="sm" loading={loading} disabled={disabled} onClick={onGenerate}>
        {overview ? `Re-summarise ${label}` : `Summarise ${label}`}
      </Button>
      {overview && (
        <Alert variant="info" title={`${label} overview`}>
          <Text>{overview}</Text>
          {generatedAt && <Caption>Generated {new Date(generatedAt).toLocaleString()}</Caption>}
        </Alert>
      )}
    </div>
  );
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
  const [overviewGeneratingType, setOverviewGeneratingType] = useState<OverviewEntityType | null>(null);
  const [changeHistory, setChangeHistory] = useState<ChangeHistory | null>(null);
  const [changeHistoryLoading, setChangeHistoryLoading] = useState(false);
  const [missingReport, setMissingReport] = useState<MissingReport | null>(null);
  const [missingLoading, setMissingLoading] = useState(false);
  const tabs = useTabs('issues');

  useEffect(() => {
    api
      .getRepository(id)
      .then(({ repository: detail }) => setRepository(detail))
      .catch((loadError: Error) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, [id]);

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

  const handleOverview = async (entityType: OverviewEntityType) => {
    if (!repository) return;
    setOverviewGeneratingType(entityType);

    try {
      const { repository: updated } = await api.summariseOverview(repository.id, entityType);
      setRepository((prev) => (prev ? { ...prev, ...updated } : prev));
    } catch (overviewError) {
      toast.error(
        overviewError instanceof Error ? overviewError.message : 'Summarisation failed',
        'AI Overview',
      );
    } finally {
      setOverviewGeneratingType(null);
    }
  };

  const handleChangeHistoryTab = () => {
    if (!repository || changeHistoryLoading || changeHistory) return;
    setChangeHistoryLoading(true);
    api
      .getChangeHistory(repository.id)
      .then((data) => setChangeHistory(data))
      .catch((loadError: Error) => toast.error(loadError.message, 'Change History'))
      .finally(() => setChangeHistoryLoading(false));
  };

  const handleVanishedTab = () => {
    if (!repository || missingLoading || missingReport) return;
    setMissingLoading(true);
    api
      .getMissingReport(repository.id)
      .then((data) => setMissingReport(data))
      .catch((loadError: Error) => toast.error(loadError.message, 'Vanished'))
      .finally(() => setMissingLoading(false));
  };

  const handleTabChange = (key: string) => {
    tabs.onChange(key);
    if (key === 'changes') handleChangeHistoryTab();
    if (key === 'missing') handleVanishedTab();
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
              { key: 'changes', label: 'Change History' },
              { key: 'missing', label: 'Vanished' },
            ]}
            activeKey={tabs.activeKey}
            onChange={handleTabChange}
          />

          <TabPanel id="issues" activeKey={tabs.activeKey}>
            <Card>
              <SectionHeading subtitle="Issues collected for this repository.">Issues</SectionHeading>
              <OverviewPanel
                label="Issues"
                overview={repository.aiIssuesOverview}
                generatedAt={repository.aiIssuesOverviewGeneratedAt}
                loading={overviewGeneratingType === 'ISSUE'}
                disabled={overviewGeneratingType !== null || issues.length === 0}
                onGenerate={() => handleOverview('ISSUE')}
              />
              <ArtifactList artifacts={issues} accent="issue" toast={toast} />
            </Card>
          </TabPanel>

          <TabPanel id="pulls" activeKey={tabs.activeKey}>
            <Card>
              <SectionHeading subtitle="Pull requests collected for this repository.">
                Pull Requests
              </SectionHeading>
              <OverviewPanel
                label="Pull Requests"
                overview={repository.aiPullsOverview}
                generatedAt={repository.aiPullsOverviewGeneratedAt}
                loading={overviewGeneratingType === 'PULL_REQUEST'}
                disabled={overviewGeneratingType !== null || pulls.length === 0}
                onGenerate={() => handleOverview('PULL_REQUEST')}
              />
              <ArtifactList artifacts={pulls} accent="pr" toast={toast} />
            </Card>
          </TabPanel>

          <TabPanel id="commits" activeKey={tabs.activeKey}>
            <Card>
              <SectionHeading subtitle="Commits collected for this repository.">Commits</SectionHeading>
              <OverviewPanel
                label="Commits"
                overview={repository.aiCommitsOverview}
                generatedAt={repository.aiCommitsOverviewGeneratedAt}
                loading={overviewGeneratingType === 'COMMIT'}
                disabled={overviewGeneratingType !== null || commits.length === 0}
                onGenerate={() => handleOverview('COMMIT')}
              />
              <ArtifactList artifacts={commits} accent="commit" toast={toast} />
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

          <TabPanel id="changes" activeKey={tabs.activeKey}>
            <Card>
              <SectionHeading subtitle="Field-level differences between consecutive snapshots of each entity.">
                Change History
              </SectionHeading>
              {changeHistoryLoading && (
                <div className="repo-detail-loading">
                  <Spinner />
                  <Text secondary>Computing change history</Text>
                </div>
              )}
              {!changeHistoryLoading && changeHistory && (
                <ChangeHistoryPanel
                  entities={changeHistory.entities}
                  totalChangeEvents={changeHistory.totalChangeEvents}
                />
              )}
              {!changeHistoryLoading && !changeHistory && (
                <EmptyState
                  title="Change history not loaded"
                  body="Re-open the Change History tab to compute field-level diffs between snapshots."
                />
              )}
            </Card>
          </TabPanel>

          <TabPanel id="missing" activeKey={tabs.activeKey}>
            <Card>
              <SectionHeading subtitle="Artifacts present in earlier sweeps but absent from the latest run.">
                Vanished
              </SectionHeading>
              {missingLoading && (
                <div className="repo-detail-loading">
                  <Spinner />
                  <Text secondary>Loading disappearance report</Text>
                </div>
              )}
              {!missingLoading && missingReport && <VanishedPanel report={missingReport} />}
              {!missingLoading && !missingReport && (
                <EmptyState
                  title="Disappearance report not loaded"
                  body="Re-open the Vanished tab to compare the latest sweep against earlier collections."
                />
              )}
            </Card>
          </TabPanel>
        </>
      )}
    </div>
  );
}
