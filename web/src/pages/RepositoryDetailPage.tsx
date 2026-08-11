import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageTitle, SectionHeading, Text, Caption, Link } from '../components/ui/Typography';
import { Card, Tabs, TabPanel, useTabs } from '../components/ui/Layout';
import { Button, ButtonGroup } from '../components/ui/Button';
import { Badge, Tag } from '../components/ui/Badge';
import type { StatusVariant } from '../components/ui/Badge';
import { Alert, EmptyState, Spinner, ToastContainer, useToast } from '../components/ui/Feedback';
import { api } from '../lib/api';
import type {
  ArtifactDetail,
  CommentDetail,
  ContributorDetail,
  HealthMetrics,
  ReleaseDetail,
  RepositoryDetail,
  ReviewDetail,
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
 * Render a compact commit stat block (additions / deletions / files changed).
 */
function CommitStats({ artifact }: { artifact: ArtifactDetail }) {
  if (artifact.additions == null && artifact.deletions == null && artifact.changedFiles == null) {
    return null;
  }
  const parts: string[] = [];
  if (artifact.additions != null) parts.push(`+${artifact.additions}`);
  if (artifact.deletions != null) parts.push(`−${artifact.deletions}`);
  if (artifact.changedFiles != null) parts.push(`${artifact.changedFiles} files`);
  return <Caption className="artifact-stats">{parts.join(' · ')}</Caption>;
}

/**
 * Render the labels attached to an artifact as tags.
 */
function ArtifactLabels({ labels }: { labels: string[] }) {
  if (labels.length === 0) return null;
  return (
    <span className="artifact-labels">
      {labels.map((label) => (
        <Tag key={label}>{label}</Tag>
      ))}
    </span>
  );
}

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
              <ArtifactLabels labels={artifact.labels} />
            </div>
            <div className="artifact-meta">
              {artifact.state && <Badge status={stateVariant(artifact.state)} label={artifact.state} />}
              <CommitStats artifact={artifact} />
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
            {artifact.comments.length > 0 && (
              <div className="snapshot-item">
                <div className="snapshot-header">
                  <Caption>{artifact.comments.length} comment{artifact.comments.length === 1 ? '' : 's'}</Caption>
                </div>
                {artifact.comments.map((comment) => (
                  <CommentRow key={comment.id} comment={comment} />
                ))}
              </div>
            )}
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
 * Render a single comment row.
 */
function CommentRow({ comment }: { comment: CommentDetail }) {
  return (
    <div className="detail-row">
      <div className="detail-row-header">
        <Caption>
          {comment.kind === 'review_comment' ? 'Inline review comment' : 'Comment'} by {comment.authorLogin ?? 'unknown'}
        </Caption>
        {comment.githubCreatedAt && (
          <Caption>{new Date(comment.githubCreatedAt).toLocaleString()}</Caption>
        )}
      </div>
      {comment.body && <p className="detail-body">{comment.body}</p>}
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
 * Render a single PR review row.
 */
function ReviewList({ reviews }: { reviews: ReviewDetail[] }) {
  if (reviews.length === 0) {
    return <EmptyState title="No reviews yet" body="Pull request reviews appear here once collected." />;
  }

  return (
    <div className="detail-list">
      {reviews.map((review) => (
        <div className="detail-row" key={review.id}>
          <div className="detail-row-header">
            <Caption>
              {review.state ?? 'Review'} by {review.authorLogin ?? 'unknown'}
            </Caption>
            {review.submittedAt && <Caption>{new Date(review.submittedAt).toLocaleString()}</Caption>}
          </div>
          {review.body && <p className="detail-body">{review.body}</p>}
        </div>
      ))}
    </div>
  );
}

/**
 * Render the collected releases.
 */
function ReleaseList({ releases }: { releases: ReleaseDetail[] }) {
  if (releases.length === 0) {
    return <EmptyState title="No releases yet" body="Releases appear here once collected." />;
  }

  return (
    <div className="detail-list">
      {releases.map((release) => (
        <div className="detail-row" key={release.id}>
          <div className="detail-row-header">
            <Caption className="detail-tag">{release.tagName}</Caption>
            <Caption>{release.name ?? 'Untagged release'}</Caption>
            {release.prerelease && <Badge status="draft" label="prerelease" />}
            {release.draft && <Badge status="draft" label="draft" />}
          </div>
          <div className="detail-row-header">
            <Caption>Published {release.publishedAt ? new Date(release.publishedAt).toLocaleString() : 'unknown date'}</Caption>
            {release.htmlUrl && (
              <Link href={release.htmlUrl} external>
                GitHub
              </Link>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Render the collected contributors.
 */
function ContributorList({ contributors }: { contributors: ContributorDetail[] }) {
  if (contributors.length === 0) {
    return <EmptyState title="No contributors yet" body="Contributors appear here once collected." />;
  }

  return (
    <div className="contributor-list">
      {contributors.map((contributor, index) => (
        <div className="contributor-row" key={contributor.id}>
          <Caption className="contributor-rank">#{index + 1}</Caption>
          <span className="contributor-login">{contributor.login}</span>
          <Caption>{contributor.contributions} contributions</Caption>
          {contributor.htmlUrl && (
            <Link href={contributor.htmlUrl} external>
              GitHub
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Render a metric card in the health dashboard.
 */
function MetricCard({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="metric-card">
      <span className="metric-value">{value}</span>
      <span className="metric-label">{label}</span>
    </div>
  );
}

const formatHours = (hours: number | null) =>
  hours == null ? '—' : `${hours.toFixed(1)} h`;

/**
 * Repository detail page: browse collected artifacts, comments, reviews,
 * releases, and contributors, plus health metrics and data export.
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
  const [metrics, setMetrics] = useState<HealthMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'json' | 'csv' | null>(null);
  const tabs = useTabs('issues');

  useEffect(() => {
    api
      .getRepository(id)
      .then(({ repository: detail, metrics: detailMetrics }) => {
        setRepository(detail);
        setMetrics(detailMetrics);
      })
      .catch((loadError: Error) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, [id]);

  const issues = repository?.artifacts.filter((artifact) => artifact.type === 'ISSUE') ?? [];
  const pulls = repository?.artifacts.filter((artifact) => artifact.type === 'PULL_REQUEST') ?? [];
  const commits = repository?.artifacts.filter((artifact) => artifact.type === 'COMMIT') ?? [];
  const repositorySnapshots = repository?.snapshots ?? [];
  const allComments =
    repository?.artifacts.flatMap((artifact) =>
      artifact.comments.map((comment) => ({ ...comment, artifactNumber: artifact.githubNumber })),
    ) ?? [];

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
            {repository.license && <span>{repository.license} license</span>}
            <span>{repository.artifacts.length} artifacts</span>
            <span>
              {repository.artifacts.reduce((sum, artifact) => sum + artifact.snapshots.length, 0) +
                repository.snapshots.length}{' '}
              snapshots
            </span>
            <span>Collected {new Date(repository.collectedAt).toLocaleDateString()}</span>
          </div>

          {repository.topics.length > 0 && (
            <div className="repo-detail-topics">
              {repository.topics.map((topic) => (
                <Tag key={topic}>#{topic}</Tag>
              ))}
            </div>
          )}

          <div className="repo-detail-actions">
            <Link href={repository.htmlUrl} external>
              View on GitHub
            </Link>
          </div>

          {metrics && (
            <Card>
              <SectionHeading subtitle="Engagement and health metrics computed from the collected dataset.">
                Health Metrics
              </SectionHeading>
              <div className="repo-detail-metrics">
                <MetricCard value={metrics.issuesOpen} label="Open issues" />
                <MetricCard value={metrics.pullsOpen} label="Open PRs" />
                <MetricCard value={metrics.pullsMerged} label="Merged PRs" />
                <MetricCard value={metrics.commentsCount} label="Comments" />
                <MetricCard value={metrics.reviewCommentsCount} label="Inline review comments" />
                <MetricCard value={metrics.issuesWithComments} label="Issues with a response" />
                <MetricCard
                  value={formatHours(metrics.medianIssueFirstResponseHours)}
                  label="Median first response (issues)"
                />
                <MetricCard
                  value={formatHours(metrics.medianPrFirstReviewHours)}
                  label="Median first review (PRs)"
                />
                <MetricCard value={metrics.commitStats.withStats} label="Commits with diff stats" />
                <MetricCard value={metrics.commitStats.totalAdditions} label="Lines added" />
                <MetricCard value={metrics.commitStats.totalDeletions} label="Lines removed" />
                <MetricCard value={metrics.commitStats.totalChangedFiles} label="Files changed" />
                <MetricCard value={metrics.releasesCount} label="Releases" />
                <MetricCard value={metrics.contributorsCount} label="Contributors" />
                <MetricCard value={metrics.collectionRunsCount} label="Collection runs" />
              </div>
            </Card>
          )}

          <Tabs
            items={[
              { key: 'issues', label: 'Issues', count: issues.length },
              { key: 'pulls', label: 'Pull Requests', count: pulls.length },
              { key: 'commits', label: 'Commits', count: commits.length },
              { key: 'comments', label: 'Comments', count: allComments.length },
              { key: 'reviews', label: 'Reviews', count: repository.reviews.length },
              { key: 'releases', label: 'Releases', count: repository.releases.length },
              { key: 'contributors', label: 'Contributors', count: repository.contributors.length },
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

          <TabPanel id="comments" activeKey={tabs.activeKey}>
            <Card>
              <SectionHeading subtitle="Discussion and inline review comments collected for this repository.">
                Comments
              </SectionHeading>
              {allComments.length === 0 ? (
                <EmptyState title="No comments yet" body="Comments appear here once collected." />
              ) : (
                <div className="detail-list">
                  {allComments.map((comment) => (
                    <div key={comment.id}>
                      <div className="detail-row-header">
                        <Caption>
                          {comment.kind === 'review_comment' ? 'Inline review' : 'Comment'}
                          {comment.artifactNumber != null ? ` on #${comment.artifactNumber}` : ''} by{' '}
                          {comment.authorLogin ?? 'unknown'}
                        </Caption>
                        {comment.githubCreatedAt && (
                          <Caption>{new Date(comment.githubCreatedAt).toLocaleString()}</Caption>
                        )}
                      </div>
                      {comment.body && <p className="detail-body">{comment.body}</p>}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabPanel>

          <TabPanel id="reviews" activeKey={tabs.activeKey}>
            <Card>
              <SectionHeading subtitle="Pull request reviews collected for this repository.">
                Reviews
              </SectionHeading>
              <ReviewList reviews={repository.reviews} />
            </Card>
          </TabPanel>

          <TabPanel id="releases" activeKey={tabs.activeKey}>
            <Card>
              <SectionHeading subtitle="Releases published for this repository.">Releases</SectionHeading>
              <ReleaseList releases={repository.releases} />
            </Card>
          </TabPanel>

          <TabPanel id="contributors" activeKey={tabs.activeKey}>
            <Card>
              <SectionHeading subtitle="Contributors ranked by commit contribution count.">
                Contributors
              </SectionHeading>
              <ContributorList contributors={repository.contributors} />
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
