import { useEffect, useMemo, useState, useCallback } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import './App.css';

import { Badge } from './components/ui/Badge';
import { Button } from './components/ui/Button';
import { Checkbox } from './components/ui/Controls';
import { Alert, EmptyState, Spinner, ToastContainer, useToast } from './components/ui/Feedback';
import { Input, Select } from './components/ui/Input';
import { Card } from './components/ui/Layout';
import { Caption, Link, PageTitle, SectionHeading, Text } from './components/ui/Typography';
import { api, sessionStore } from './lib/api';
import type { Account, CollectionRun, Contribution, GitHubToken, Repository } from './lib/api';

/**
 * Format an ISO date string for display.
 * @param value - ISO date string or null
 * @returns Human-readable date string
 */
const formatDate = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(value))
    : 'Not collected yet';

/**
 * Map a collection run status to a badge variant.
 */
const statusVariant = (status: CollectionRun['status']) => {
  if (status === 'COMPLETED') return 'open';
  if (status === 'FAILED') return 'closed';
  return 'progress';
};

export type RepoFilters = {
  language: string;
  minStars: string;
  maxStars: string;
  minForks: string;
  maxForks: string;
  search: string;
  sort: string;
  order: 'asc' | 'desc';
};

const defaultFilters: RepoFilters = {
  language: '',
  minStars: '',
  maxStars: '',
  minForks: '',
  maxForks: '',
  search: '',
  sort: 'updatedAt',
  order: 'desc',
};

/**
 * Main dashboard page showing account status, statistics, collection activity,
 * stored repositories, and contribution summaries.
 */
export default function App() {
  const navigate = useNavigate();
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [availableLanguages, setAvailableLanguages] = useState<string[]>([]);
  const [runs, setRuns] = useState<CollectionRun[]>([]);
  const [tokens, setTokens] = useState<GitHubToken[]>([]);
  const [account, setAccount] = useState<Account | null>(null);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [owner, setOwner] = useState('');
  const [name, setName] = useState('');
  const [tokenId, setTokenId] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<RepoFilters>(defaultFilters);
  const [exportingFiltered, setExportingFiltered] = useState<'json' | 'csv' | null>(null);
  const [exportEntityTypes, setExportEntityTypes] = useState<string[]>(['ISSUE', 'PULL_REQUEST', 'COMMIT']);
  const [exportSources, setExportSources] = useState<string[]>([]);

  const buildFilterParams = useCallback((): NonNullable<Parameters<typeof api.listRepositories>[0]> => {
    const params: NonNullable<Parameters<typeof api.listRepositories>[0]> = {};
    if (filters.language) params.language = filters.language;
    if (filters.minStars) params.minStars = Number(filters.minStars);
    if (filters.maxStars) params.maxStars = Number(filters.maxStars);
    if (filters.minForks) params.minForks = Number(filters.minForks);
    if (filters.maxForks) params.maxForks = Number(filters.maxForks);
    if (filters.search) params.search = filters.search;
    if (filters.sort) params.sort = filters.sort;
    if (filters.order) params.order = filters.order;
    return params;
  }, [filters]);

  const loadDashboard = async (currentAccount = account) => {
    setError(null);
    const requests = [
      api.listRepositories(buildFilterParams()),
      api.listCollections(),
      api.listTokens(),
      currentAccount ? api.listContributions() : Promise.resolve({ contributions: [] }),
    ] as const;
    const [repoResponse, runResponse, tokenResponse, contributionResponse] = await Promise.all(requests);
    setRepositories(repoResponse.repositories);
    setAvailableLanguages(repoResponse.availableLanguages);
    setRuns(runResponse.runs);
    setTokens(tokenResponse.tokens);
    setContributions(contributionResponse.contributions);
  };

  const stats = useMemo(
    () => ({
      repositories: repositories.length,
      artifacts: repositories.reduce((sum, repo) => sum + (repo._count?.artifacts ?? 0), 0),
      snapshots: repositories.reduce((sum, repo) => sum + (repo._count?.snapshots ?? 0), 0),
      completedRuns: runs.filter((run) => run.status === 'COMPLETED').length,
      starred: repositories.filter((repo) => repo.isStarred).length,
      contributions: contributions.reduce(
        (sum, contribution) =>
          sum + contribution.commitsCount + contribution.issuesCount + contribution.pullsCount,
        0,
      ),
    }),
    [repositories, runs, contributions],
  );

  useEffect(() => {
    api
      .me()
      .then(async ({ account: currentAccount }) => {
        setAccount(currentAccount);
        await loadDashboard(currentAccount);
      })
      .catch((loadError: Error) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, []);

  const clearAuthForm = () => {
    setEmail('');
    setDisplayName('');
    setPassword('');
  };

  const handleAuth = async (event: FormEvent) => {
    event.preventDefault();
    setAuthLoading(true);
    setError(null);

    try {
      const response =
        authMode === 'login'
          ? await api.login({ email, password })
          : await api.register({ email, displayName, password });
      sessionStore.set(response.session.token);
      setAccount(response.account);
      clearAuthForm();
      await loadDashboard(response.account);
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Account request failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await api.logout().catch(() => undefined);
    sessionStore.clear();
    setAccount(null);
    setTokens([]);
    setRuns([]);
    setContributions([]);
    await loadDashboard(null);
  };

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

  const handleToggleStar = async (repository: Repository) => {
    if (!account) {
      setError('Sign in before starring repositories.');
      return;
    }

    try {
      if (repository.isStarred) {
        await api.unstarRepository(repository.id);
      } else {
        await api.starRepository(repository.id);
      }
      await loadDashboard();
    } catch (starError) {
      setError(starError instanceof Error ? starError.message : 'Could not update starred repository');
    }
  };

  const { toasts, dismiss, toast } = useToast();

  const handleFilteredExport = async (format: 'json' | 'csv') => {
    setExportingFiltered(format);
    try {
      const blob = await api.filteredExport(
        {
          language: filters.language || undefined,
          minStars: filters.minStars ? Number(filters.minStars) : undefined,
          maxStars: filters.maxStars ? Number(filters.maxStars) : undefined,
          minForks: filters.minForks ? Number(filters.minForks) : undefined,
          maxForks: filters.maxForks ? Number(filters.maxForks) : undefined,
          search: filters.search || undefined,
          entityTypes: exportEntityTypes as ('REPOSITORY' | 'ISSUE' | 'PULL_REQUEST' | 'COMMIT')[],
          sources: exportSources.length > 0 ? exportSources : undefined,
        },
        format,
      );
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `filtered-export.${format}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success(`${format.toUpperCase()} export downloaded`, 'Export');
    } catch (exportError) {
      toast.error(exportError instanceof Error ? exportError.message : 'Export failed', 'Export');
    } finally {
      setExportingFiltered(null);
    }
  };

  const toggleEntityType = (type: string) => {
    setExportEntityTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  };

  const toggleExportSource = (source: string) => {
    setExportSources((prev) =>
      prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source],
    );
  };

  const updateFilters = (patch: Partial<RepoFilters>) => {
    setFilters((prev) => {
      const next = { ...prev, ...patch };
      api
        .listRepositories({
          ...(next.language ? { language: next.language } : {}),
          ...(next.minStars ? { minStars: Number(next.minStars) } : {}),
          ...(next.maxStars ? { maxStars: Number(next.maxStars) } : {}),
          ...(next.minForks ? { minForks: Number(next.minForks) } : {}),
          ...(next.maxForks ? { maxForks: Number(next.maxForks) } : {}),
          ...(next.search ? { search: next.search } : {}),
          ...(next.sort ? { sort: next.sort } : {}),
          ...(next.order ? { order: next.order } : {}),
        })
        .then((response) => {
          setRepositories(response.repositories);
          setAvailableLanguages(response.availableLanguages);
        })
        .catch(() => undefined);
      return next;
    });
  };

  return (
    <div className="dashboard">
      <ToastContainer toasts={toasts} onDismiss={dismiss} />

      <section className="dashboard-header">
        <PageTitle subtitle="Hybrid GitHub API and browser-extension collection for empirical software engineering research.">
          GitHub research workspace
        </PageTitle>
        <div className="dashboard-header-actions">
          <Button variant="secondary" onClick={() => loadDashboard()} disabled={loading || syncing}>
            Refresh
          </Button>
        </div>
      </section>

      <section className="account-strip">
        {account ? (
          <>
            <div>
              <Caption>Signed in</Caption>
              <Text>{account.displayName}</Text>
              <Caption>{account.email}</Caption>
            </div>
            <div className="account-actions">
              <div>
                <Caption>Starred repos</Caption>
                <strong>{stats.starred}</strong>
              </div>
              <div>
                <Caption>Observed contributions</Caption>
                <strong>{stats.contributions}</strong>
              </div>
              <Button variant="secondary" onClick={handleLogout}>
                Sign out
              </Button>
            </div>
          </>
        ) : (
          <form className="auth-form" onSubmit={handleAuth}>
            <div className="auth-heading">
              <Text>{authMode === 'login' ? 'Sign in to your workspace' : 'Create a workspace account'}</Text>
              <Caption>Tokens, starred repositories, and contribution summaries are stored per account.</Caption>
            </div>
            <Input
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            {authMode === 'register' && (
              <Input
                placeholder="Display name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                required
              />
            )}
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <Button type="submit" variant="primary" loading={authLoading}>
              {authMode === 'login' ? 'Sign in' : 'Create account'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
            >
              {authMode === 'login' ? 'Create account' : 'Use existing account'}
            </Button>
          </form>
        )}
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
        <Card className="metric-card">
          <Caption>Starred</Caption>
          <strong>{stats.starred}</strong>
        </Card>
        <Card className="metric-card">
          <Caption>Contributions</Caption>
          <strong>{stats.contributions}</strong>
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
          {!account && (
            <Alert variant="info" title="Optional account">
              Sign in to attach runs, starred repositories, and contribution summaries to your workspace.
            </Alert>
          )}

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

      <section className="export-section">
        <SectionHeading subtitle="Download filtered data across repositories for offline analysis or import into research tools.">
          Filtered Data Export
        </SectionHeading>
        <Card className="export-panel">
          <Caption>Use the repository filters above to scope which repos are included. Then select which entity types and data sources to export.</Caption>

          <div className="export-options">
            <div className="export-option-group">
              <Caption>Entity types to export</Caption>
              <div className="export-checkboxes">
                {['REPOSITORY', 'ISSUE', 'PULL_REQUEST', 'COMMIT'].map((type) => (
                  <Checkbox
                    key={type}
                    label={type.replace('_', ' ')}
                    checked={exportEntityTypes.includes(type)}
                    onChange={() => toggleEntityType(type)}
                  />
                ))}
              </div>
            </div>

            <div className="export-option-group">
              <Caption>Data sources to export</Caption>
              <div className="export-checkboxes">
                <Checkbox
                  label="GitHub API"
                  checked={exportSources.includes('github_api')}
                  onChange={() => toggleExportSource('github_api')}
                />
                <Checkbox
                  label="Browser Extension"
                  checked={exportSources.includes('browser_extension')}
                  onChange={() => toggleExportSource('browser_extension')}
                />
              </div>
              <Caption>If no sources selected, all sources are included.</Caption>
            </div>
          </div>

          <div className="export-actions">
            <Button
              variant="primary"
              loading={exportingFiltered === 'json'}
              disabled={exportingFiltered !== null || exportEntityTypes.length === 0}
              onClick={() => handleFilteredExport('json')}
            >
              Export JSON
            </Button>
            <Button
              variant="secondary"
              loading={exportingFiltered === 'csv'}
              disabled={exportingFiltered !== null || exportEntityTypes.length === 0}
              onClick={() => handleFilteredExport('csv')}
            >
              Export CSV
            </Button>
          </div>
        </Card>
      </section>

      <section className="repository-section">
        <SectionHeading subtitle="Research-ready repositories currently persisted in the relational snapshot store.">
          Stored repositories
        </SectionHeading>

        <Card className="filter-bar">
          <div className="filter-bar-row">
            <Input
              search
              placeholder="Search name or description"
              value={filters.search}
              onChange={(e) => updateFilters({ search: e.target.value })}
            />
            <Select
              value={filters.language}
              onChange={(e) => updateFilters({ language: e.target.value })}
              placeholder="All languages"
              options={availableLanguages.map((l) => ({ value: l, label: l }))}
            />
            <Select
              value={filters.sort}
              onChange={(e) => updateFilters({ sort: e.target.value })}
              options={[
                { value: 'updatedAt', label: 'Recently updated' },
                { value: 'createdAt', label: 'Newest' },
                { value: 'stars', label: 'Most stars' },
                { value: 'forks', label: 'Most forks' },
                { value: 'fullName', label: 'Name A-Z' },
              ]}
            />
            <Select
              value={filters.order}
              onChange={(e) => updateFilters({ order: e.target.value as 'asc' | 'desc' })}
              options={[
                { value: 'desc', label: 'Descending' },
                { value: 'asc', label: 'Ascending' },
              ]}
            />
          </div>
          <div className="filter-bar-row">
            <Input
              label="Min stars"
              type="number"
              min={0}
              placeholder="0"
              value={filters.minStars}
              onChange={(e) => updateFilters({ minStars: e.target.value })}
            />
            <Input
              label="Max stars"
              type="number"
              min={0}
              placeholder="Any"
              value={filters.maxStars}
              onChange={(e) => updateFilters({ maxStars: e.target.value })}
            />
            <Input
              label="Min forks"
              type="number"
              min={0}
              placeholder="0"
              value={filters.minForks}
              onChange={(e) => updateFilters({ minForks: e.target.value })}
            />
            <Input
              label="Max forks"
              type="number"
              min={0}
              placeholder="Any"
              value={filters.maxForks}
              onChange={(e) => updateFilters({ maxForks: e.target.value })}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => updateFilters(defaultFilters)}
              disabled={JSON.stringify(filters) === JSON.stringify(defaultFilters)}
            >
              Clear filters
            </Button>
          </div>
        </Card>

        {!loading && repositories.length === 0 && (
          <Card>
            <EmptyState
              title="No repositories collected"
              body="Run a collection to populate repositories, artifacts, and snapshots."
            />
          </Card>
        )}

        {!loading && repositories.length > 0 && (
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

                <div className="repository-actions">
                  <Caption>Last collected {formatDate(repository.collectedAt)}</Caption>
                  <div className="repository-action-buttons">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => navigate(`/repositories/${repository.id}`)}
                    >
                      View data
                    </Button>
                    <Button
                      size="sm"
                      variant={repository.isStarred ? 'primary' : 'secondary'}
                      onClick={() => handleToggleStar(repository)}
                    >
                      {repository.isStarred ? 'Starred' : 'Star'}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {account && (
        <section className="repository-section">
          <SectionHeading subtitle="Summaries are calculated from synced artifacts that match your saved GitHub token login.">
            Contribution profile
          </SectionHeading>

          {contributions.length === 0 ? (
            <Card>
              <EmptyState
                title="No matching contributions yet"
                body="Save a GitHub token, sync a repository you contribute to, and this section will populate."
              />
            </Card>
          ) : (
            <div className="contribution-list">
              {contributions.map((contribution) => (
                <Card className="contribution-card" key={contribution.id}>
                  <div>
                    <Link href={contribution.repository.htmlUrl} external>
                      {contribution.repository.fullName}
                    </Link>
                    <Caption>{contribution.githubLogin}</Caption>
                  </div>
                  <div className="contribution-counts">
                    <span>{contribution.commitsCount} commits</span>
                    <span>{contribution.issuesCount} issues</span>
                    <span>{contribution.pullsCount} PRs</span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
