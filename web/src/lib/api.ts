const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
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
};
