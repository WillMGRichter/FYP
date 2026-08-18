import { useEffect, useState } from 'react';
import { PageTitle, SectionHeading, Text, Caption, Link } from '../components/ui/Typography';
import { Card } from '../components/ui/Layout';
import { Badge } from '../components/ui/Badge';
import { Alert, EmptyState, Spinner } from '../components/ui/Feedback';
import { api } from '../lib/api';
import type { Analytics } from '../lib/api';
import './AnalyticsPage.css';

/**
 * Render a stat card with min/max/median/average.
 */
function StatCard({ label, stats }: { label: string; stats: Analytics['repositoryOverview']['stars'] }) {
  return (
    <Card className="analytics-stat-card">
      <Caption>{label}</Caption>
      <strong>{stats.average.toLocaleString()}</strong>
      <div className="stat-details">
        <Caption>Min {stats.min.toLocaleString()}</Caption>
        <Caption>Max {stats.max.toLocaleString()}</Caption>
        <Caption>Median {stats.median.toLocaleString()}</Caption>
      </div>
    </Card>
  );
}

/**
 * Render a simple horizontal bar row.
 */
function BarRow({ label, value, max, accent }: { label: string; value: number; max: number; accent?: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="bar-row">
      <div className="bar-label">{label}</div>
      <div className="bar-track">
        <div className={`bar-fill ${accent ?? ''}`} style={{ width: `${Math.max(pct, 2)}%` }} />
      </div>
      <div className="bar-value">{value.toLocaleString()}</div>
    </div>
  );
}

/**
 * Render a year-based timeline as simple bars.
 */
function TimelineChart({ data, label }: { data: { year: string; count: number }[]; label: string }) {
  if (data.length === 0) return <Caption>No data available.</Caption>;
  const max = Math.max(...data.map((d) => d.count));
  return (
    <div className="timeline-chart">
      {data.map((d) => (
        <BarRow key={d.year} label={d.year} value={d.count} max={max} />
      ))}
    </div>
  );
}

/**
 * Analytics page for mining software repositories research.
 * Displays aggregated stats across all collected repositories.
 */
export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getAnalytics()
      .then(setAnalytics)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="analytics-page">
        <Card className="loading-card">
          <Spinner />
          <Text secondary>Loading analytics</Text>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="analytics-page">
        <Alert variant="error" title="Could not load analytics">{error}</Alert>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="analytics-page">
        <EmptyState title="No analytics available" body="Sync at least one repository to see analytics." />
      </div>
    );
  }

  const { repositoryOverview: ov, languageDistribution, artifactBreakdown, contributorMetrics, collectionSources, entityTypeSourceBreakdown, temporal } = analytics;

  const issueTotal = artifactBreakdown.issues.open + artifactBreakdown.issues.closed;
  const prTotal = artifactBreakdown.pullRequests.open + artifactBreakdown.pullRequests.closed + artifactBreakdown.pullRequests.merged;

  const entityTypeSourceEntries = Object.entries(entityTypeSourceBreakdown).sort((a, b) => b[1] - a[1]);

  return (
    <div className="analytics-page">
      <PageTitle subtitle="Aggregated dataset statistics for empirical software engineering research.">
        Research Analytics
      </PageTitle>

      {/* Repository Overview */}
      <section className="analytics-section">
        <SectionHeading subtitle="Repository-level summary statistics across the collected dataset.">
          Repository Overview
        </SectionHeading>
        <div className="analytics-count-row">
          <Card className="analytics-stat-card">
            <Caption>Total repositories</Caption>
            <strong>{ov.total}</strong>
          </Card>
          <Card className="analytics-stat-card">
            <Caption>Total artifacts</Caption>
            <strong>{artifactBreakdown.totalArtifacts.toLocaleString()}</strong>
          </Card>
          <Card className="analytics-stat-card">
            <Caption>Total snapshots</Caption>
            <strong>{artifactBreakdown.totalSnapshots.toLocaleString()}</strong>
          </Card>
          <Card className="analytics-stat-card">
            <Caption>Unique contributors</Caption>
            <strong>{contributorMetrics.uniqueAuthors}</strong>
          </Card>
        </div>

        <div className="analytics-stat-grid">
          <StatCard label="Stars (avg)" stats={ov.stars} />
          <StatCard label="Forks (avg)" stats={ov.forks} />
          <StatCard label="Open Issues (avg)" stats={ov.openIssues} />
        </div>
      </section>

      {/* Language Distribution */}
      <section className="analytics-section">
        <SectionHeading subtitle="Distribution of programming languages across collected repositories.">
          Language Distribution
        </SectionHeading>
        <Card>
          {languageDistribution.length === 0 ? (
            <Caption>No language data available.</Caption>
          ) : (
            <div className="analytics-bars">
              {languageDistribution.map((item) => (
                <BarRow
                  key={item.language}
                  label={item.language}
                  value={item.count}
                  max={languageDistribution[0].count}
                  accent="bar-fill-language"
                />
              ))}
            </div>
          )}
        </Card>
      </section>

      {/* Artifact Breakdown */}
      <section className="analytics-section">
        <SectionHeading subtitle="Breakdown of collected artifacts by type and state.">
          Artifact Breakdown
        </SectionHeading>
        <div className="analytics-stat-grid three-col">
          <Card className="analytics-stat-card">
            <Caption>Issues</Caption>
            <strong>{issueTotal}</strong>
            <div className="stat-details">
              <Badge status="open" label={`${artifactBreakdown.issues.open} open`} />
              <Badge status="closed" label={`${artifactBreakdown.issues.closed} closed`} />
            </div>
          </Card>
          <Card className="analytics-stat-card">
            <Caption>Pull Requests</Caption>
            <strong>{prTotal}</strong>
            <div className="stat-details">
              <Badge status="open" label={`${artifactBreakdown.pullRequests.open} open`} />
              <Badge status="closed" label={`${artifactBreakdown.pullRequests.closed} closed`} />
              <Badge status="merged" label={`${artifactBreakdown.pullRequests.merged} merged`} />
            </div>
          </Card>
          <Card className="analytics-stat-card">
            <Caption>Commits</Caption>
            <strong>{artifactBreakdown.byType.COMMIT}</strong>
          </Card>
        </div>
      </section>

      {/* Collection Source Comparison */}
      <section className="analytics-section">
        <SectionHeading subtitle="Comparison of data collected via GitHub API versus browser extension snapshots.">
          Data Collection Sources
        </SectionHeading>
        <Card>
          {collectionSources.length === 0 ? (
            <Caption>No collection data available.</Caption>
          ) : (
            <div className="analytics-bars">
              {collectionSources.map((item) => (
                <BarRow
                  key={item.source}
                  label={item.source}
                  value={item.count}
                  max={collectionSources[0].count}
                  accent="bar-fill-source"
                />
              ))}
            </div>
          )}
        </Card>

        {entityTypeSourceEntries.length > 0 && (
          <Card style={{ marginTop: 'var(--space-4)' }}>
            <SectionHeading subtitle="Snapshots per entity type and source.">Entity & Source Matrix</SectionHeading>
            <div className="analytics-table">
              <div className="analytics-table-header">
                <span>Entity Type</span>
                <span>Source</span>
                <span>Count</span>
              </div>
              {entityTypeSourceEntries.map(([key, count]) => {
                const [entityType, source] = key.split(':');
                return (
                  <div className="analytics-table-row" key={key}>
                    <Badge status={entityType === 'COMMIT' ? 'draft' : entityType === 'ISSUE' ? 'open' : 'merged'} label={entityType} />
                    <Caption>{source}</Caption>
                    <strong>{count}</strong>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </section>

      {/* Temporal Analysis */}
      <section className="analytics-section">
        <SectionHeading subtitle="Creation trends for repositories, issues, pull requests, and commits by year.">
          Temporal Analysis
        </SectionHeading>
        <div className="analytics-timeline-grid">
          <Card>
            <SectionHeading subtitle="Repositories created per year.">Repositories</SectionHeading>
            <TimelineChart data={temporal.repositoriesByYear} label="Repositories by year" />
          </Card>
          <Card>
            <SectionHeading subtitle="Issues created per year.">Issues</SectionHeading>
            <TimelineChart data={temporal.issuesByYear} label="Issues by year" />
          </Card>
          <Card>
            <SectionHeading subtitle="Pull requests created per year.">Pull Requests</SectionHeading>
            <TimelineChart data={temporal.pullRequestsByYear} label="PRs by year" />
          </Card>
          <Card>
            <SectionHeading subtitle="Commits created per year.">Commits</SectionHeading>
            <TimelineChart data={temporal.commitsByYear} label="Commits by year" />
          </Card>
        </div>
      </section>

      {/* Top Contributors */}
      <section className="analytics-section">
        <SectionHeading subtitle="Top contributors ranked by total activity across all collected repositories.">
          Top Contributors
        </SectionHeading>
        {contributorMetrics.topContributors.length === 0 ? (
          <Card>
            <EmptyState title="No contributor data" body="Sync repositories to see contributor metrics." />
          </Card>
        ) : (
          <Card>
            <div className="analytics-contributors-table">
              <div className="analytics-table-header contributor-header">
                <span>#</span>
                <span>Author</span>
                <span>Repos</span>
                <span>Commits</span>
                <span>Issues</span>
                <span>PRs</span>
                <span>Total</span>
              </div>
              {contributorMetrics.topContributors.map((c, i) => (
                <div className="analytics-table-row contributor-row" key={c.login}>
                  <Caption>{i + 1}</Caption>
                  <strong>{c.login}</strong>
                  <Caption>{c.repositories}</Caption>
                  <Caption>{c.commits}</Caption>
                  <Caption>{c.issues}</Caption>
                  <Caption>{c.pulls}</Caption>
                  <Badge status="draft" label={String(c.total)} />
                </div>
              ))}
            </div>
          </Card>
        )}
      </section>
    </div>
  );
}
