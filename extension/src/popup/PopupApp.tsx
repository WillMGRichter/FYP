import React, { useState, useEffect } from 'react';

/**
 * Configuration for the extension-backend connection.
 */
interface ExtensionConfig {
  backendUrl: string;
  authToken: string;
  autoSubmit: boolean;
}

/**
 * Data scraped from a GitHub page.
 */
interface ScrapedData {
  pageType: string;
  repositoryFullName: string;
  entityData: unknown;
  url: string;
  timestamp: string;
}

/**
 * A record of a collection run (scrape + optional submit).
 */
interface CollectionRun {
  id: string;
  timestamp: string;
  status: 'pending' | 'submitted' | 'failed';
  data: unknown;
  error?: string;
}

/**
 * Main popup component for the browser extension.
 * Provides tabs for data collection, settings, and history.
 */
export default function PopupApp() {
  const [config, setConfig] = useState<ExtensionConfig>({
    backendUrl: '',
    authToken: '',
    autoSubmit: false,
  });

  const [tab, setTab] = useState<'collect' | 'settings' | 'history'>('collect');
  const [scrapedData, setScrapedData] = useState<ScrapedData | null>(null);
  const [status, setStatus] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [collectionRuns, setCollectionRuns] = useState<CollectionRun[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  /**
   * Load extension configuration from chrome storage.
   */
  const loadConfig = async () => {
    try {
      chrome.runtime.sendMessage(
        { type: 'getConfig' },
        (response: ExtensionConfig) => {
          if (response) {
            setConfig(response);
          }
        }
      );
    } catch (error) {
      console.error('Error loading config:', error);
    }
  };

  /**
   * Load collection run history from chrome storage.
   */
  const loadCollectionRuns = async () => {
    try {
      chrome.runtime.sendMessage(
        { type: 'getCollectionRuns' },
        (response: { runs: CollectionRun[] }) => {
          if (response?.runs) {
            setCollectionRuns(response.runs);
          }
        }
      );
    } catch (error) {
      console.error('Error loading collection runs:', error);
    }
  };

  useEffect(() => {
    loadConfig();
    loadCollectionRuns();
  }, []);

  /**
   * Persist configuration to chrome storage.
   */
  const saveConfig = async () => {
    try {
      setIsLoading(true);
      chrome.runtime.sendMessage(
        { type: 'saveConfig', data: config },
        () => {
          setStatus({ type: 'success', message: 'Settings saved successfully' });
          setTimeout(() => setStatus(null), 3000);
        }
      );
    } catch (error) {
      setStatus({ type: 'error', message: error instanceof Error ? error.message : 'Error saving config' });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Trigger a scrape on the current GitHub page via the content script.
   */
  const handleScrape = async () => {
    try {
      setIsLoading(true);
      setStatus(null);

      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!activeTab.id) throw new Error('No active tab found');

      chrome.tabs.sendMessage(
        activeTab.id,
        { type: 'scrape' },
        (response: { type: string; data?: ScrapedData; error?: string }) => {
          if (response?.type === 'scrapedData' && response.data) {
            setScrapedData(response.data);
            setStatus({ type: 'success', message: 'Data scraped successfully' });
          } else {
            setStatus({ type: 'error', message: response?.error || 'Failed to scrape data' });
          }
        }
      );
    } catch (error) {
      setStatus({ type: 'error', message: error instanceof Error ? error.message : 'Error scraping data' });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Submit scraped data to the backend API.
   */
  const handleSubmit = async () => {
    try {
      setIsLoading(true);

      if (!config.backendUrl || !config.authToken) {
        setStatus({ type: 'error', message: 'Please configure backend URL and auth token in settings' });
        setTab('settings');
        return;
      }

      if (!scrapedData) {
        setStatus({ type: 'error', message: 'Please scrape data first' });
        return;
      }

      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!activeTab.id) throw new Error('No active tab found');

      chrome.tabs.sendMessage(
        activeTab.id,
        { type: 'submitData', data: scrapedData },
        (response: { type: string; data?: unknown; error?: string }) => {
          if (response?.type === 'status') {
            // Add to collection runs
            chrome.runtime.sendMessage(
              {
                type: 'addCollectionRun',
                data: { data: scrapedData, status: 'submitted' },
              },
              () => {
                loadCollectionRuns();
                setStatus({ type: 'success', message: 'Data submitted successfully' });
                setTimeout(() => {
                  setScrapedData(null);
                  setStatus(null);
                }, 2000);
              }
            );
          } else {
            const errorMsg = response?.error || 'Failed to submit data';
            chrome.runtime.sendMessage({
              type: 'addCollectionRun',
              data: { data: scrapedData, status: 'failed', error: errorMsg },
            });
            setStatus({ type: 'error', message: errorMsg });
          }
        }
      );
    } catch (error) {
      setStatus({ type: 'error', message: error instanceof Error ? error.message : 'Error submitting data' });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Clear all collection run history.
   */
  const handleClearHistory = async () => {
    if (confirm('Are you sure you want to clear all collection history?')) {
      chrome.runtime.sendMessage(
        { type: 'clearCollectionRuns' },
        () => {
          loadCollectionRuns();
          setStatus({ type: 'success', message: 'History cleared' });
          setTimeout(() => setStatus(null), 2000);
        }
      );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <header>
        <h1>GitHub Data Collector</h1>
        <p>Hybrid API & Browser Extraction</p>
      </header>

      <div style={{ display: 'flex', borderBottom: '1px solid #e1e4e8', background: '#f6f8fa' }}>
        {(['collect', 'settings', 'history'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: '12px',
              border: 'none',
              background: tab === t ? 'white' : 'transparent',
              borderBottom: tab === t ? '3px solid #667eea' : 'none',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '500',
              color: tab === t ? '#667eea' : '#666',
              textTransform: 'capitalize',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {status && (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              marginBottom: '16px',
              background:
                status.type === 'success'
                  ? '#28a745'
                  : status.type === 'error'
                    ? '#cb2431'
                    : '#0366d6',
              color: 'white',
            }}
          >
            {status.message}
          </div>
        )}

        {tab === 'collect' && (
          <div>
            <div className="section">
              <h2 className="section-title">Scrape & Submit</h2>

              {scrapedData && (
                <div className="card">
                  <strong>Current Page Type:</strong> {scrapedData.pageType}
                  <br />
                  <strong>Repository:</strong> {scrapedData.repositoryFullName}
                  <br />
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    style={{
                      width: '100%',
                      marginTop: '8px',
                      padding: '6px',
                      fontSize: '11px',
                    }}
                  >
                    {showPreview ? 'Hide' : 'Show'} Data Preview
                  </button>

                  {showPreview && (
                    <div className="data-preview" style={{ marginTop: '8px' }}>
                      <pre>{JSON.stringify(scrapedData.entityData, null, 2)}</pre>
                    </div>
                  )}
                </div>
              )}

              <div className="button-group">
                <button onClick={handleScrape} disabled={isLoading} className="primary">
                  {isLoading ? <span className="loading" /> : null} Scrape
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isLoading || !scrapedData}
                  className="primary"
                >
                  {isLoading ? <span className="loading" /> : null} Submit
                </button>
              </div>

              <p style={{ fontSize: '11px', color: '#666', marginTop: '8px' }}>
                1. Click "Scrape" to extract data from current GitHub page
                <br />
                2. Preview and verify the data
                <br />
                3. Click "Submit" to send to research database
              </p>
            </div>

            <div className="section">
              <h2 className="section-title">Recent Collections</h2>
              {collectionRuns.slice(0, 5).map((run) => (
                <div className="collection-run" key={run.id}>
                  <span className={`run-status ${run.status}`}>{run.status.toUpperCase()}</span>
                  <span className="run-timestamp">{new Date(run.timestamp).toLocaleTimeString()}</span>
                  {run.error && <div className="error-details" style={{ marginTop: '4px' }}>{run.error}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'settings' && (
          <div>
            <div className="section">
              <h2 className="section-title">Backend Configuration</h2>

              <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: '500' }}>
                Backend URL
              </label>
              <input
                type="text"
                placeholder="https://api.example.com"
                value={config.backendUrl}
                onChange={(e) => setConfig({ ...config, backendUrl: e.target.value })}
                style={{ marginBottom: '12px' }}
              />

              <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: '500' }}>
                Authentication Token
              </label>
              <textarea
                placeholder="Paste your Bearer token here"
                value={config.authToken}
                onChange={(e) => setConfig({ ...config, authToken: e.target.value })}
                style={{ marginBottom: '12px', fontFamily: 'monospace', fontSize: '11px' }}
              />

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={config.autoSubmit}
                  onChange={(e) => setConfig({ ...config, autoSubmit: e.target.checked })}
                />
                Auto-submit scraped data
              </label>

              <button onClick={saveConfig} disabled={isLoading} className="primary" style={{ width: '100%' }}>
                {isLoading ? <span className="loading" /> : null} Save Settings
              </button>

              <div style={{ fontSize: '11px', color: '#666', marginTop: '12px', padding: '8px', background: '#f6f8fa', borderRadius: '6px' }}>
                <strong>Getting started:</strong>
                <ol style={{ marginLeft: '16px', marginTop: '4px' }}>
                  <li>Sign up or login to the research database web app</li>
                  <li>Generate an API token from your account settings</li>
                  <li>Copy the backend URL and token above</li>
                  <li>Save and start collecting data!</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {tab === 'history' && (
          <div>
            <div className="section">
              <h2 className="section-title">Collection History</h2>

              {collectionRuns.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', color: '#666' }}>
                  <p style={{ fontSize: '12px' }}>No collections yet</p>
                </div>
              ) : (
                <>
                  {collectionRuns.map((run) => (
                    <div key={run.id} className="collection-run">
                      <span className={`run-status ${run.status}`}>{run.status.toUpperCase()}</span>
                      <span className="run-timestamp">{new Date(run.timestamp).toLocaleString()}</span>
                      {run.error && <div className="error-details" style={{ marginTop: '4px' }}>{run.error}</div>}
                    </div>
                  ))}

                  <button onClick={handleClearHistory} className="danger" style={{ width: '100%', marginTop: '12px' }}>
                    Clear History
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
