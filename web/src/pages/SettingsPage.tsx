import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { PageTitle, SectionHeading, Text, Caption } from '../components/ui/Typography';
import { Card } from '../components/ui/Layout';
import { Toggle } from '../components/ui/Controls';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Alert, EmptyState, Spinner } from '../components/ui/Feedback';
import { api } from '../lib/api';
import type { Account, GitHubToken } from '../lib/api';
import './SettingsPage.css';

/**
 * Format an ISO date string for display.
 * @param value - ISO date string or null
 * @returns Human-readable date string
 */
const formatDate = (value?: string | null) =>
  value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Never';

/**
 * Settings page for managing GitHub API tokens and local preferences.
 */
export default function SettingsPage() {
  const [darkMode, setDarkMode] = useState(false);
  const [tokens, setTokens] = useState<GitHubToken[]>([]);
  const [account, setAccount] = useState<Account | null>(null);
  const [label, setLabel] = useState('');
  const [token, setToken] = useState('');
  const [loadingTokens, setLoadingTokens] = useState(true);
  const [savingToken, setSavingToken] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') {
      setDarkMode(true);
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }, []);

  useEffect(() => {
    Promise.all([api.me(), api.listTokens()])
      .then(([accountResponse, tokenResponse]) => {
        setAccount(accountResponse.account);
        setTokens(tokenResponse.tokens);
      })
      .catch((loadError: Error) => setError(loadError.message))
      .finally(() => setLoadingTokens(false));
  }, []);

  const handleToggle = (value: boolean) => {
    setDarkMode(value);

    const theme = value ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  };

  const handleCreateToken = async (event: FormEvent) => {
    event.preventDefault();
    setSavingToken(true);
    setError(null);
    setMessage(null);

    if (!account) {
      setSavingToken(false);
      setError('Sign in on the Home page before saving GitHub tokens.');
      return;
    }

    try {
      const response = await api.createToken({ label, token });
      setTokens((current) => [response.token, ...current]);
      setLabel('');
      setToken('');
      setMessage(`Saved token for ${response.token.githubLogin ?? response.token.label}.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save GitHub token');
    } finally {
      setSavingToken(false);
    }
  };

  return (
    <div className="settings-page">
      <PageTitle subtitle="Manage API credentials and local interface preferences.">Settings</PageTitle>

      {error && (
        <Alert variant="error" title="Settings error">
          {error}
        </Alert>
      )}

      {message && (
        <Alert variant="success" title="Token saved">
          {message}
        </Alert>
      )}

      <div className="settings-grid">
        <Card className="settings-card">
          <SectionHeading subtitle="Saved tokens are encrypted by the backend and used for GitHub API collection.">
            GitHub API tokens
          </SectionHeading>

          {account ? (
            <Alert variant="info" title="Account workspace">
              Tokens saved here belong to {account.displayName}.
            </Alert>
          ) : (
            <Alert variant="warning" title="Sign in required">
              Create or sign in to an account on the Home page before saving GitHub tokens.
            </Alert>
          )}

          <form className="token-form" onSubmit={handleCreateToken}>
            <Input
              label="Token label"
              placeholder="Research collection token"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
            />
            <Input
              label="Personal access token"
              type="password"
              placeholder="github_pat_..."
              value={token}
              onChange={(event) => setToken(event.target.value)}
              required
              helper="Use a fine-grained token with read access to the repositories you plan to collect."
            />
            <Button type="submit" variant="primary" loading={savingToken} disabled={!account}>
              Validate and save token
            </Button>
          </form>

          <div className="token-list">
            {loadingTokens ? (
              <div className="settings-loading">
                <Spinner size="sm" />
                <Caption>Loading saved tokens</Caption>
              </div>
            ) : tokens.length === 0 ? (
              <EmptyState title="No tokens saved" body="Repository sync can run unauthenticated, but GitHub rate limits will be lower." />
            ) : (
              tokens.map((savedToken) => (
                <div className="token-row" key={savedToken.id}>
                  <div>
                    <Text>{savedToken.label}</Text>
                    <Caption>
                      {savedToken.githubLogin ?? 'Unknown user'} - {savedToken.tokenPreview}
                    </Caption>
                  </div>
                  <div className="token-rate">
                    <strong>
                      {savedToken.rateRemaining ?? '-'} / {savedToken.rateLimit ?? '-'}
                    </strong>
                    <Caption>Resets {formatDate(savedToken.rateResetAt)}</Caption>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="settings-card">
          <SectionHeading subtitle="Stored only in this browser.">Appearance</SectionHeading>

          <Toggle
            label="Dark mode"
            checked={darkMode}
            onChange={(e) => handleToggle(e)}
            helper="Switch between light and dark theme"
          />
        </Card>
      </div>
    </div>
  );
}
