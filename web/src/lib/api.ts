const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';
const SESSION_KEY = 'gitresearch_session_token';

export type Account = {
  id: string;
  email: string;
  displayName: string;
};

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

export const api = {
  async register(input: { email: string; displayName: string; password: string }) {
    return request<{ account: Account; session: { token: string; expiresAt: string } }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async login(input: { email: string; password: string }) {
    return request<{ account: Account; session: { token: string; expiresAt: string } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async me() {
    return request<{ account: Account | null }>('/auth/me');
  },

  async logout() {
    return request<{ ok: boolean }>('/auth/logout', { method: 'POST' });
  },

  async listTokens() {
    return request<{ tokens: GitHubToken[] }>('/github/tokens');
  },

  async createToken(input: { label: string; token: string }) {
    return request<{ token: GitHubToken }>('/github/tokens', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async listRepositories() {
    return request<{ repositories: Repository[] }>('/repositories');
  },

  async listCollections() {
    return request<{ runs: CollectionRun[] }>('/collections');
  },

  async syncRepository(input: { owner: string; name: string; tokenId?: string }) {
    return request<{ run: CollectionRun }>('/repositories/sync', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async starRepository(id: string, note?: string) {
    return request<{ star: Repository['star'] }>(`/repositories/${id}/star`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    });
  },

  async unstarRepository(id: string) {
    return request<{ ok: boolean }>(`/repositories/${id}/star`, {
      method: 'DELETE',
    });
  },

  async listContributions() {
    return request<{ contributions: Contribution[] }>('/account/contributions');
  },
};
