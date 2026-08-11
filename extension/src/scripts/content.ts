/**
 * Content script injected into GitHub pages.
 * Handles scrape and data submission requests from the extension popup.
 */

import { scrapeCurrentPage, getRepositoryFullName } from '../utils/scrapers';

interface MessageFromPopup {
  type: 'scrape' | 'getStatus' | 'submitData';
  data?: unknown;
}

interface MessageToPopup {
  type: 'scrapedData' | 'status' | 'error';
  data?: unknown;
  error?: string;
}

chrome.runtime.onMessage.addListener(
  (message: MessageFromPopup, _sender, sendResponse: (response: MessageToPopup) => void) => {
    console.log('[Content Script] Received message:', message);

    if (message.type === 'scrape') {
      handleScrape(sendResponse);
    } else if (message.type === 'submitData') {
      handleSubmitData(message.data, sendResponse);
    } else if (message.type === 'getStatus') {
      handleGetStatus(sendResponse);
    }

    return true;
  }
);

/**
 * Scrape the current GitHub page and return extracted data.
 */
async function handleScrape(sendResponse: (response: MessageToPopup) => void) {
  try {
    await waitForPageReady();

    const scrapedData = scrapeCurrentPage();
    if (!scrapedData) {
      sendResponse({
        type: 'error',
        error: 'Not a GitHub entity page (repository, issue, PR, or commit)',
      });
      return;
    }

    const repoFullName = getRepositoryFullName();

    sendResponse({
      type: 'scrapedData',
      data: {
        pageType: scrapedData.type,
        repositoryFullName: repoFullName,
        entityData: scrapedData.data,
        url: window.location.href,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[Content Script] Error during scrape:', error);
    sendResponse({
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error during scraping',
    });
  }
}

/**
 * Submit scraped data to the configured backend API.
 */
async function handleSubmitData(data: unknown, sendResponse: (response: MessageToPopup) => void) {
  try {
    const { backendUrl, authToken } = await chrome.storage.sync.get(['backendUrl', 'authToken']);

    if (!backendUrl || !authToken) {
      sendResponse({
        type: 'error',
        error: 'Backend URL and auth token not configured. Please configure extension settings.',
      });
      return;
    }

    const payload = data as Record<string, unknown>;
    const repositoryFullName = payload.repositoryFullName as string;
    const entityType = payload.pageType as string;

    if (!repositoryFullName || !entityType) {
      sendResponse({
        type: 'error',
        error: 'Invalid data format: repositoryFullName and pageType are required',
      });
      return;
    }

    const entityData = payload.entityData as Record<string, unknown>;
    const submitPayload: Record<string, unknown> = {
      repositoryFullName,
      entityType,
      payload: entityData,
    };

    if (entityType !== 'REPOSITORY' && entityData) {
      if ('number' in entityData) {
        submitPayload.githubNumber = entityData.number;
      }
      if ('sha' in entityData) {
        submitPayload.githubSha = entityData.sha;
      }
    }

    const response = await fetch(`${backendUrl}/api/extension/snapshots`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(submitPayload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Backend returned ${response.status}`);
    }

    sendResponse({
      type: 'status',
      data: { success: true, message: 'Data submitted successfully' },
    });
  } catch (error) {
    console.error('[Content Script] Error submitting data:', error);
    sendResponse({
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error during submission',
    });
  }
}

/**
 * Return current page status (URL, repository, configuration state).
 */
async function handleGetStatus(sendResponse: (response: MessageToPopup) => void) {
  try {
    const repoFullName = getRepositoryFullName();
    const { backendUrl } = await chrome.storage.sync.get(['backendUrl']);

    sendResponse({
      type: 'status',
      data: {
        currentPage: window.location.href,
        repositoryFullName: repoFullName,
        isConfigured: !!backendUrl,
      },
    });
  } catch (error) {
    console.error('[Content Script] Error getting status:', error);
    sendResponse({
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Wait for GitHub page to be fully loaded
 */
async function waitForPageReady(maxAttempts = 30): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    // Check if we can find key GitHub elements
    if (document.querySelector('h1') && document.body.querySelector('[data-testid]')) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

/*
window.addEventListener('load', async () => {
  const { autoScrapEnabled } = await chrome.storage.sync.get(['autoScrapEnabled']);
  if (autoScrapEnabled) {
    const scrapedData = scrapeCurrentPage();
    if (scrapedData) {
      console.log('[Content Script] Auto-scraped data:', scrapedData);
      // Could store in session storage or send to background
    }
  }
});
*/

console.log('[Content Script] Loaded on', window.location.href);
