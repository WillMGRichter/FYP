/**
 * DOM scraper utilities for extracting GitHub entity data from the page DOM.
 */

export type GitHubEntityType = 'REPOSITORY' | 'ISSUE' | 'PULL_REQUEST' | 'COMMIT';

export interface ScrapedRepository {
  fullName: string;
  owner: string;
  name: string;
  description?: string;
  url: string;
  isPrivate?: boolean;
  isFork?: boolean;
  starsCount?: number;
  forksCount?: number;
  language?: string;
  license?: string;
  topics?: string[];
}

export interface ScrapedIssue {
  number: number;
  title: string;
  state: 'open' | 'closed';
  author?: string;
  body?: string;
  labels?: string[];
  createdAt?: string;
  updatedAt?: string;
  url: string;
}

export interface ScrapedPullRequest extends ScrapedIssue {
  isDraft?: boolean;
  reviewsCount?: number;
  commentsCount?: number;
  changedFiles?: number;
  additions?: number;
  deletions?: number;
}

export interface ScrapedCommit {
  sha: string;
  title: string;
  author?: string;
  message?: string;
  url: string;
  timestamp?: string;
}

/**
 * Extract repository information from the current GitHub repository page.
 * @returns Parsed repository data, or null if the URL does not match a repository path.
 */
export function scrapeRepository(): ScrapedRepository | null {
  const match = window.location.pathname.match(/^\/([^/]+)\/([^/]+)/);
  if (!match) return null;

  const [, owner, name] = match;
  const fullName = `${owner}/${name}`;

  const description = document.querySelector('[data-filterable-for="filter-projects-text"]')?.textContent?.trim() ||
    document.querySelector('p[class*="description"]')?.textContent?.trim() || '';

  const stats: Record<string, number> = {};
  document.querySelectorAll('[id^="repo-"] a[href*="/stargazers"], [id^="repo-"] a[href*="/network/members"]').forEach((link) => {
    const text = link.textContent?.trim() || '';
    const count = parseInt(text.replace(/[^\d]/g, ''), 10);
    if (!Number.isNaN(count)) {
      if (link.getAttribute('href')?.includes('stargazers')) stats.starsCount = count;
      if (link.getAttribute('href')?.includes('network')) stats.forksCount = count;
    }
  });

  const languageElement = document.querySelector('[itemprop="programmingLanguage"]');
  const language = languageElement?.textContent?.trim();

  const licenseElement = document.querySelector('a[href*="/license"]');
  const license = licenseElement?.textContent?.trim().replace(/\s+license$/i, '');

  const topics = Array.from(document.querySelectorAll('.topic-tag, [data-testid="topic-tag"]'))
    .map((tag) => tag.textContent?.trim())
    .filter((text): text is string => !!text && !text.startsWith('#'));

  const isPrivate = document.body.innerHTML.includes('private') && document.body.innerHTML.includes('visibility');
  const isFork = Array.from(document.querySelectorAll('a, span, p')).some(
    (el) => el.textContent?.trim().toLowerCase().startsWith('forked from')
  );

  return {
    fullName,
    owner,
    name,
    description,
    url: window.location.href,
    isPrivate,
    isFork,
    ...stats,
    language: language || undefined,
    license: license || undefined,
    topics: topics.length > 0 ? topics : undefined,
  };
}

/**
 * Extract issue information from a GitHub issue page.
 * @returns Parsed issue data, or null if the URL does not match an issue path.
 */
export function scrapeIssue(): ScrapedIssue | null {
  const match = window.location.pathname.match(/^\/([^/]+)\/([^/]+)\/issues\/(\d+)/);
  if (!match) return null;

  const [, , , numberStr] = match;
  const number = parseInt(numberStr, 10);

  const titleElement = document.querySelector('[data-testid="issue-title"]') ||
    document.querySelector('h1[data-filterable-for]');
  const title = titleElement?.textContent?.trim() || '';

  // Get issue state (open/closed)
  const stateElement = document.querySelector('[data-testid="issue-state-icon"]')?.parentElement;
  const stateText = stateElement?.textContent?.toLowerCase() || '';
  const state = stateText.includes('closed') ? 'closed' : 'open';

  // Get author
  const authorLink = document.querySelector('a[data-hovercard-type="user"]');
  const author = authorLink?.textContent?.trim();

  // Get body
  const bodyElement = document.querySelector('[data-testid="issue-body"]') ||
    document.querySelector('[data-testid="comment-box-comment-body-text"]');
  const body = bodyElement?.textContent?.trim();

  // Get labels
  const labels: string[] = [];
  document.querySelectorAll('[data-testid="label"]').forEach((label) => {
    const text = label.textContent?.trim();
    if (text) labels.push(text);
  });

  // Get timestamps
  const timeElements = document.querySelectorAll('time');
  const createdAt = timeElements[0]?.getAttribute('datetime');
  const updatedAt = timeElements[timeElements.length - 1]?.getAttribute('datetime');

  return {
    number,
    title,
    state: state as 'open' | 'closed',
    author,
    body,
    labels: labels.length > 0 ? labels : undefined,
    createdAt: createdAt ?? undefined,
    updatedAt: updatedAt ?? undefined,
    url: window.location.href,
  };
}

/**
 * Extract pull request information from a GitHub pull request page.
 * @returns Parsed pull request data, or null if the URL is not a PR path.
 */
export function scrapePullRequest(): ScrapedPullRequest | null {
  const match = window.location.pathname.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!match) return null;

  // First get base issue info
  const issue = scrapeIssue();
  if (!issue) return null;

  // Get PR-specific information
  const draft = document.body.innerHTML.includes('Draft');

  // Get review count
  const reviewsLink = document.querySelector('a[href*="/reviews"]');
  const reviewsCount = reviewsLink ? parseInt(reviewsLink.textContent?.replace(/[^\d]/g, '') || '0', 10) : 0;

  // Get comment count
  const commentsElement = document.querySelector('button[aria-label*="comment"]') ||
    document.querySelector('[data-testid="mini-progressbar"]');
  const commentsCount = commentsElement ? parseInt(commentsElement.textContent?.replace(/[^\d]/g, '') || '0', 10) : 0;

  // Get file and line changes
  const filesLink = document.querySelector('a[href*="files"]');
  const changedFiles = filesLink ? parseInt(filesLink.textContent?.replace(/[^\d]/g, '') || '0', 10) : 0;

  // Get additions/deletions
  const statSpans = document.querySelectorAll('[class*="diffstat"]');
  let additions = 0;
  let deletions = 0;
  statSpans.forEach((span) => {
    const text = span.textContent || '';
    if (text.includes('+')) additions += parseInt(text.replace(/[^\d]/g, ''), 10) || 0;
    if (text.includes('-')) deletions += parseInt(text.replace(/[^\d]/g, ''), 10) || 0;
  });

  return {
    ...issue,
    isDraft: draft,
    reviewsCount: reviewsCount > 0 ? reviewsCount : undefined,
    commentsCount: commentsCount > 0 ? commentsCount : undefined,
    changedFiles: changedFiles > 0 ? changedFiles : undefined,
    additions: additions > 0 ? additions : undefined,
    deletions: deletions > 0 ? deletions : undefined,
  };
}

/**
 * Extract commit information from a GitHub commit page.
 * @returns Parsed commit data, or null if the URL is not a commit path.
 */
export function scrapeCommit(): ScrapedCommit | null {
  const match = window.location.pathname.match(/^\/([^/]+)\/([^/]+)\/commit\/([a-f0-9]+)/);
  if (!match) return null;

  const [, , , sha] = match;

  const titleElement = document.querySelector('[data-testid="commit-summary"]') ||
    document.querySelector('h2[class*="commit-title"]');
  const title = titleElement?.textContent?.trim() || '';

  // Get commit message
  const messageElement = document.querySelector('[data-testid="commit-message"]') ||
    document.querySelector('[class*="commit-message"]');
  const message = messageElement?.textContent?.trim();

  // Get author
  const authorLink = document.querySelector('a[data-hovercard-type="user"]');
  const author = authorLink?.textContent?.trim();

  // Get timestamp
  const timeElement = document.querySelector('time');
  const timestamp = timeElement?.getAttribute('datetime');

  return {
    sha,
    title,
    author,
    message,
    url: window.location.href,
    timestamp: timestamp ?? undefined,
  };
}

/**
 * Extract a list of issues from a GitHub issues listing page.
 * @returns Array of parsed issues (without body content).
 */
export function scrapeIssuesList(): Array<Omit<ScrapedIssue, 'body'>> {
  const issues: Array<Omit<ScrapedIssue, 'body'>> = [];

  document.querySelectorAll('[data-testid="issue-list-item"]').forEach((item) => {
    const linkElement = item.querySelector('a[data-testid="issue-title-link"]');
    if (!linkElement) return;

    const href = linkElement.getAttribute('href') || '';
    const match = href.match(/\/issues\/(\d+)$/);
    if (!match) return;

    const number = parseInt(match[1], 10);
    const title = linkElement.textContent?.trim() || '';

    const stateIcon = item.querySelector('[data-testid="issue-state-icon"]');
    const state = stateIcon?.className.includes('closed') ? 'closed' : 'open';

    // Get labels
    const labels: string[] = [];
    item.querySelectorAll('[data-testid="label"]').forEach((label) => {
      const text = label.textContent?.trim();
      if (text) labels.push(text);
    });

    issues.push({
      number,
      title,
      state: state as 'open' | 'closed',
      url: linkElement.getAttribute('href') || '',
      labels: labels.length > 0 ? labels : undefined,
    });
  });

  return issues;
}

/**
 * Extract a list of pull requests from a GitHub pull requests listing page.
 * @returns Array of parsed pull requests (without body content).
 */
export function scrapePullRequestsList(): Array<Omit<ScrapedPullRequest, 'body'>> {
  const prs: Array<Omit<ScrapedPullRequest, 'body'>> = [];

  document.querySelectorAll('[data-testid="pr-list-item"]').forEach((item) => {
    const linkElement = item.querySelector('a[data-testid="pr-title-link"]') ||
      item.querySelector('a[class*="pr-title"]');
    if (!linkElement) return;

    const href = linkElement.getAttribute('href') || '';
    const match = href.match(/\/pull\/(\d+)$/);
    if (!match) return;

    const number = parseInt(match[1], 10);
    const title = linkElement.textContent?.trim() || '';

    const stateIcon = item.querySelector('[data-testid="pr-state-icon"]') ||
      item.querySelector('[class*="status"]');
    const state = stateIcon?.className.includes('closed') ? 'closed' : 'open';

    const isDraft = item.textContent?.includes('Draft') || false;

    prs.push({
      number,
      title,
      state: state as 'open' | 'closed',
      isDraft,
      url: linkElement.getAttribute('href') || '',
    });
  });

  return prs;
}

/**
 * Extract a list of commits from a GitHub commits listing page.
 * @returns Array of parsed commits.
 */
export function scrapeCommitsList(): ScrapedCommit[] {
  const commits: ScrapedCommit[] = [];

  document.querySelectorAll('[data-testid="commit-row"]').forEach((row) => {
    const linkElement = row.querySelector('a[data-testid="commit-link"]') ||
      row.querySelector('a[href*="/commit/"]');
    if (!linkElement) return;

    const href = linkElement.getAttribute('href') || '';
    const match = href.match(/\/commit\/([a-f0-9]+)/);
    if (!match) return;

    const sha = match[1];
    const title = linkElement.textContent?.trim() || '';

    const timeElement = row.querySelector('time');
    const timestamp = timeElement?.getAttribute('datetime');

    commits.push({
      sha,
      title,
      url: linkElement.getAttribute('href') || '',
      timestamp: timestamp ?? undefined,
    });
  });

  return commits;
}

/**
 * Determine the GitHub entity type of the current page based on the URL path.
 * @returns The entity type, or null if the page is not a recognised entity page.
 */
export function getCurrentPageType(): GitHubEntityType | null {
  const pathname = window.location.pathname;

  if (pathname.match(/^\/[^/]+\/[^/]+\/pull\/\d+/)) return 'PULL_REQUEST';
  if (pathname.match(/^\/[^/]+\/[^/]+\/issues\/\d+/)) return 'ISSUE';
  if (pathname.match(/^\/[^/]+\/[^/]+\/commit\/[a-f0-9]+/)) return 'COMMIT';
  if (pathname.match(/^\/[^/]+\/[^/]+\/?$/)) return 'REPOSITORY';

  return null;
}

/**
 * Extract the repository full name (owner/name) from the current URL.
 * @returns The full name, or null if the URL does not match a repository path.
 */
export function getRepositoryFullName(): string | null {
  const match = window.location.pathname.match(/^\/([^/]+)\/([^/]+)/);
  if (!match) return null;
  return `${match[1]}/${match[2]}`;
}

/**
 * Scrape the current GitHub page using the appropriate scraper for the detected page type.
 * @returns An object with type and data properties, or null if the page type is not recognised.
 */
export function scrapeCurrentPage() {
  const pageType = getCurrentPageType();

  switch (pageType) {
    case 'REPOSITORY':
      return { type: 'REPOSITORY' as const, data: scrapeRepository() };
    case 'ISSUE':
      return { type: 'ISSUE' as const, data: scrapeIssue() };
    case 'PULL_REQUEST':
      return { type: 'PULL_REQUEST' as const, data: scrapePullRequest() };
    case 'COMMIT':
      return { type: 'COMMIT' as const, data: scrapeCommit() };
    default:
      return null;
  }
}
