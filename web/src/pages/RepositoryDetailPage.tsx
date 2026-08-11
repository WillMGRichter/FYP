import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageTitle, SectionHeading, Text, Caption, Link } from '../components/ui/Typography';
import { Card, Tabs, TabPanel, useTabs } from '../components/ui/Layout';
import { Button, ButtonGroup } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import type { StatusVariant } from '../components/ui/Badge';
import { Alert, EmptyState, Spinner, ToastContainer, useToast } from '../components/ui/Feedback';
import { api } from '../lib/api';
import type { ArtifactDetail, RepositoryDetail, SnapshotDetail } from '../lib/api';
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
            ]}
            activeKey={tabs.activeKey}
            onChange={tabs.onChange}
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
        </>
      )}
    </div>
  );
}
