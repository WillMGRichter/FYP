const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';
const SESSION_KEY = 'gitresearch_session_token';

/**
 * Authenticated account information returned by the backend.
 */
export type Account = {
  id: string;
  email: string;
  displayName: string;
};

/**
 * A saved GitHub personal access token with its metadata.
 */
export type GitHubToken = {
  id: string;
  label: string;
  githubLogin: string | null;
  tokenPreview: string;
  scopes: string[];
  rateLimit: number | null;
  rateRemaining: number | null;
  rateResetAt: string | null;
  lastValidatedAt: string | null;
  createdAt?: string;
};

/**
 * A repository synced from GitHub into the local snapshot store.
 */
export type Repository = {
  id: string;
  fullName: string;
  htmlUrl: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  defaultBranch: string | null;
  collectedAt: string;
  updatedAt: string;
  _count?: {
    artifacts: number;
    snapshots: number;
    collectionRuns: number;
  };
  collectionRuns?: CollectionRun[];
  isStarred?: boolean;
  star?: {
    id: string;
    note: string | null;
    createdAt: string;
  } | null;
};

/**
 * A collection run that fetches issues, pull requests, and commits for a repository.
 */
export type CollectionRun = {
  id: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  source: string;
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  issuesCount: number;
  pullsCount: number;
  commitsCount: number;
  repository?: {
    fullName: string;
    htmlUrl: string;
  } | null;
  token?: {
    label: string;
    githubLogin: string | null;
  } | null;
};

/**
 * A contributor summary computed from collected artifacts for a signed-in account.
 */
export type Contribution = {
  id: string;
  githubLogin: string;
  commitsCount: number;
  issuesCount: number;
  pullsCount: number;
  lastObservedAt: string | null;
  repository: {
    fullName: string;
    htmlUrl: string;
    language: string | null;
  };
};

/**
 * Session token persistence layer using localStorage.
 */
export const sessionStore = {
  get() {
    return localStorage.getItem(SESSION_KEY);
  },

  set(token: string) {
    localStorage.setItem(SESSION_KEY, token);
  },

  clear() {
    localStorage.removeItem(SESSION_KEY);
  },
};

/**
 * Core request helper that attaches session auth and parses JSON responses.
 * @param path - API endpoint path (e.g. /auth/login)
 * @param init - Optional fetch init overrides
 * @returns Parsed response body cast to T
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const sessionToken = sessionStore.get();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      ...init?.headers,
    },
    ...init,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error ?? `Request failed with status ${response.status}`);
  }

  return payload as T;
}

/**
 * Typed API client exposing all backend endpoints.
 */
export const api = {
  /**
   * Register a new account.
   * @param input - Email, display name, and password
   */
  async register(input: { email: string; displayName: string; password: string }) {
    return request<{ account: Account; session: { token: string; expiresAt: string } }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  /**
   * Sign in with email and password.
   * @param input - Email and password
   */
  async login(input: { email: string; password: string }) {
    return request<{ account: Account; session: { token: string; expiresAt: string } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  /** Fetch the currently authenticated account, or null. */
  async me() {
    return request<{ account: Account | null }>('/auth/me');
  },

  /** Invalidate the current session on the backend. */
  async logout() {
    return request<{ ok: boolean }>('/auth/logout', { method: 'POST' });
  },

  /** List all saved GitHub API tokens for the current account. */
  async listTokens() {
    return request<{ tokens: GitHubToken[] }>('/github/tokens');
  },

  /**
   * Save and validate a new GitHub API token.
   * @param input - Label and raw token value
   */
  async createToken(input: { label: string; token: string }) {
    return request<{ token: GitHubToken }>('/github/tokens', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  /** List all repositories in the snapshot store. */
  async listRepositories() {
    return request<{ repositories: Repository[] }>('/repositories');
  },

  /** List collection runs. */
  async listCollections() {
    return request<{ runs: CollectionRun[] }>('/collections');
  },

  /**
   * Trigger a collection run for a repository.
   * @param input - Owner, name, and optional token ID
   */
  async syncRepository(input: { owner: string; name: string; tokenId?: string }) {
    return request<{ run: CollectionRun }>('/repositories/sync', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  /**
   * Star a repository for the current account.
   * @param id - Repository ID
   * @param note - Optional annotation
   */
  async starRepository(id: string, note?: string) {
    return request<{ star: Repository['star'] }>(`/repositories/${id}/star`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    });
  },

  /**
   * Remove a star from a repository.
   * @param id - Repository ID
   */
  async unstarRepository(id: string) {
    return request<{ ok: boolean }>(`/repositories/${id}/star`, {
      method: 'DELETE',
    });
  },

  /** List contribution summaries for the current account. */
  async listContributions() {
    return request<{ contributions: Contribution[] }>('/account/contributions');
  },
};
