import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import './App.css';

import { Badge } from './components/ui/Badge';
import { Button } from './components/ui/Button';
import { Alert, EmptyState, Spinner } from './components/ui/Feedback';
import { Input, Select } from './components/ui/Input';
import { Card } from './components/ui/Layout';
import { Caption, Link, PageTitle, SectionHeading, Text } from './components/ui/Typography';
import { api } from './lib/api';
import type { CollectionRun, GitHubToken, Repository } from './lib/api';

const formatDate = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(value))
    : 'Not collected yet';

const statusVariant = (status: CollectionRun['status']) => {
  if (status === 'COMPLETED') return 'open';
  if (status === 'FAILED') return 'closed';
  return 'progress';
};

export default function App() {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [runs, setRuns] = useState<CollectionRun[]>([]);
  const [tokens, setTokens] = useState<GitHubToken[]>([]);
  const [owner, setOwner] = useState('');
  const [name, setName] = useState('');
  const [tokenId, setTokenId] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stats = useMemo(
    () => ({
      repositories: repositories.length,
      artifacts: repositories.reduce((sum, repo) => sum + (repo._count?.artifacts ?? 0), 0),
      snapshots: repositories.reduce((sum, repo) => sum + (repo._count?.snapshots ?? 0), 0),
      completedRuns: runs.filter((run) => run.status === 'COMPLETED').length,
    }),
    [repositories, runs],
  );

  const loadDashboard = async () => {
    setError(null);
    const [repoResponse, runResponse, tokenResponse] = await Promise.all([
      api.listRepositories(),
      api.listCollections(),
      api.listTokens(),
    ]);
    setRepositories(repoResponse.repositories);
    setRuns(runResponse.runs);
    setTokens(tokenResponse.tokens);
  };

  useEffect(() => {
    loadDashboard()
      .catch((loadError: Error) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSync = async (event: FormEvent) => {
    event.preventDefault();
    setSyncing(true);
    setError(null);

    try {
      await api.syncRepository({
        owner,
        name,
        tokenId: tokenId || undefined,
      });
      setOwner('');
      setName('');
      await loadDashboard();
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : 'Repository sync failed');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="dashboard">
      <section className="dashboard-header">
        <PageTitle subtitle="Hybrid GitHub API and browser-extension collection for empirical software engineering research.">
          GitHub research workspace
        </PageTitle>
        <div className="dashboard-header-actions">
          <Button variant="secondary" onClick={loadDashboard} disabled={loading || syncing}>
            Refresh
          </Button>
        </div>
      </section>

      <section className="metric-grid" aria-label="Dataset summary">
        <Card className="metric-card">
          <Caption>Repositories</Caption>
          <strong>{stats.repositories}</strong>
        </Card>
        <Card className="metric-card">
          <Caption>Artifacts</Caption>
          <strong>{stats.artifacts}</strong>
        </Card>
        <Card className="metric-card">
          <Caption>Snapshots</Caption>
          <strong>{stats.snapshots}</strong>
        </Card>
        <Card className="metric-card">
          <Caption>Completed runs</Caption>
          <strong>{stats.completedRuns}</strong>
        </Card>
      </section>

      {error && (
        <Alert variant="error" title="Backend command failed" className="dashboard-alert">
          {error}
        </Alert>
      )}

      <section className="workspace-grid">
        <Card className="sync-panel">
          <SectionHeading subtitle="Fetch repository metadata, issues, pull requests, commits, and immutable snapshots.">
            New collection
          </SectionHeading>

          <form className="sync-form" onSubmit={handleSync}>
            <div className="repo-fields">
              <Input
                label="Owner"
                placeholder="facebook"
                value={owner}
                onChange={(event) => setOwner(event.target.value)}
                required
              />
              <Input
                label="Repository"
                placeholder="react"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>

            <Select
              label="GitHub token"
              value={tokenId}
              onChange={(event) => setTokenId(event.target.value)}
              options={[
                { value: '', label: tokens.length ? 'Unauthenticated request' : 'No saved token' },
                ...tokens.map((token) => ({
                  value: token.id,
                  label: `${token.label} (${token.githubLogin ?? token.tokenPreview})`,
                })),
              ]}
            />

            <Button type="submit" variant="primary" loading={syncing}>
              Sync repository
            </Button>
          </form>
        </Card>

        <Card className="activity-panel">
          <SectionHeading subtitle="Recent backend collection commands and their GitHub API result counts.">
            Collection activity
          </SectionHeading>

          {loading ? (
            <div className="loading-row">
              <Spinner size="sm" />
              <Caption>Loading recent activity</Caption>
            </div>
          ) : runs.length === 0 ? (
            <EmptyState title="No collection runs yet" body="Start by syncing a repository with or without a token." />
          ) : (
            <div className="activity-list">
              {runs.slice(0, 6).map((run) => (
                <div className="activity-row" key={run.id}>
                  <div>
                    <div className="activity-title">{run.repository?.fullName ?? 'Repository lookup'}</div>
                    <Caption>{formatDate(run.startedAt)}</Caption>
                  </div>
                  <Badge status={statusVariant(run.status)} label={run.status.toLowerCase()} />
                  <Caption>
                    {run.issuesCount} issues, {run.pullsCount} PRs, {run.commitsCount} commits
                  </Caption>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>

      <section className="repository-section">
        <SectionHeading subtitle="Research-ready repositories currently persisted in the relational snapshot store.">
          Stored repositories
        </SectionHeading>

        {loading ? (
          <Card className="loading-card">
            <Spinner />
            <Text secondary>Loading repositories</Text>
          </Card>
        ) : repositories.length === 0 ? (
          <Card>
            <EmptyState
              title="No repositories collected"
              body="Run a collection to populate repositories, artifacts, and snapshots."
            />
          </Card>
        ) : (
          <div className="repository-grid">
            {repositories.map((repository) => (
              <Card className="repository-card" key={repository.id}>
                <div className="repository-card-header">
                  <div>
                    <Link href={repository.htmlUrl} external>
                      {repository.fullName}
                    </Link>
                    <Text secondary>{repository.description ?? 'No repository description available.'}</Text>
                  </div>
                  <Badge status="draft" label={repository.language ?? 'Unknown'} />
                </div>

                <div className="repository-facts">
                  <span>{repository.stars.toLocaleString()} stars</span>
                  <span>{repository.forks.toLocaleString()} forks</span>
                  <span>{repository.openIssues.toLocaleString()} open issues</span>
                  <span>{repository.defaultBranch ?? 'default'} branch</span>
                </div>

                <div className="repository-counts">
                  <div>
                    <Caption>Artifacts</Caption>
                    <strong>{repository._count?.artifacts ?? 0}</strong>
                  </div>
                  <div>
                    <Caption>Snapshots</Caption>
                    <strong>{repository._count?.snapshots ?? 0}</strong>
                  </div>
                  <div>
                    <Caption>Runs</Caption>
                    <strong>{repository._count?.collectionRuns ?? 0}</strong>
                  </div>
                </div>

                <Caption>Last collected {formatDate(repository.collectedAt)}</Caption>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
