/**
 * Background Service Worker
 * Handles extension lifecycle and communication
 */

interface ExtensionConfig {
  backendUrl: string;
  authToken: string;
  autoSubmit: boolean;
  collectionRuns: Array<{
    id: string;
    timestamp: string;
    status: 'pending' | 'submitted' | 'failed';
    data: unknown;
    error?: string;
  }>;
}

// Initialize extension configuration on install
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    console.log('[Background] Extension installed');

    // Set default config
    const defaultConfig: Partial<ExtensionConfig> = {
      backendUrl: '',
      authToken: '',
      autoSubmit: false,
      collectionRuns: [],
    };

    await chrome.storage.sync.set(defaultConfig);
    console.log('[Background] Default config set');
  }
});

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Background] Received message:', message, 'from:', sender.tab?.url);

  if (message.type === 'saveConfig') {
    handleSaveConfig(message.data, sendResponse);
  } else if (message.type === 'getConfig') {
    handleGetConfig(sendResponse);
  } else if (message.type === 'addCollectionRun') {
    handleAddCollectionRun(message.data, sendResponse);
  } else if (message.type === 'getCollectionRuns') {
    handleGetCollectionRuns(sendResponse);
  } else if (message.type === 'clearCollectionRuns') {
    handleClearCollectionRuns(sendResponse);
  }

  // Return true to indicate we'll send response asynchronously
  return true;
});

async function handleSaveConfig(config: Partial<ExtensionConfig>, sendResponse: (response: unknown) => void) {
  try {
    await chrome.storage.sync.set(config);
    console.log('[Background] Config saved:', config);
    sendResponse({ success: true });
  } catch (error) {
    console.error('[Background] Error saving config:', error);
    sendResponse({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

async function handleGetConfig(sendResponse: (response: ExtensionConfig) => void) {
  try {
    const config = await chrome.storage.sync.get([
      'backendUrl',
      'authToken',
      'autoSubmit',
      'collectionRuns',
    ]);
    sendResponse(config as ExtensionConfig);
  } catch (error) {
    console.error('[Background] Error getting config:', error);
    sendResponse({
      backendUrl: '',
      authToken: '',
      autoSubmit: false,
      collectionRuns: [],
    });
  }
}

async function handleAddCollectionRun(
  data: { data: unknown; status: string },
  sendResponse: (response: unknown) => void
) {
  try {
    const { collectionRuns = [] } = await chrome.storage.sync.get(['collectionRuns']);
    const newRun = {
      id: `run_${Date.now()}`,
      timestamp: new Date().toISOString(),
      status: data.status || 'pending',
      data: data.data,
    };

    collectionRuns.push(newRun);

    // Keep only last 100 runs
    if (collectionRuns.length > 100) {
      collectionRuns.splice(0, collectionRuns.length - 100);
    }

    await chrome.storage.sync.set({ collectionRuns });
    console.log('[Background] Collection run added:', newRun);
    sendResponse({ success: true, run: newRun });
  } catch (error) {
    console.error('[Background] Error adding collection run:', error);
    sendResponse({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

async function handleGetCollectionRuns(sendResponse: (response: unknown) => void) {
  try {
    const { collectionRuns = [] } = await chrome.storage.sync.get(['collectionRuns']);
    sendResponse({ runs: collectionRuns });
  } catch (error) {
    console.error('[Background] Error getting collection runs:', error);
    sendResponse({ runs: [] });
  }
}

async function handleClearCollectionRuns(sendResponse: (response: unknown) => void) {
  try {
    await chrome.storage.sync.set({ collectionRuns: [] });
    console.log('[Background] Collection runs cleared');
    sendResponse({ success: true });
  } catch (error) {
    console.error('[Background] Error clearing collection runs:', error);
    sendResponse({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

console.log('[Background] Service worker loaded');
