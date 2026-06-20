# GitHub Research Data Collector - Chrome Extension

A Chrome extension that performs browser-side extraction of GitHub repository data, complementing API-based collection for improved dataset reliability.

## Features

- **DOM Scraping**: Extracts structured data directly from GitHub web pages
- **Automatic Detection**: Detects page type (repository, issue, PR, commit)
- **Easy Configuration**: Simple settings panel for backend URL and authentication
- **Collection History**: Tracks all submitted data with status
- **Data Preview**: View JSON data before submission
- **Error Handling**: Clear error messages and retry capability

## Installation

### Development Setup

1. Install dependencies:
```bash
cd extension
pnpm install
```

2. Build the extension:
```bash
pnpm build
```

3. Load into Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `extension/dist` folder

### Production Build

```bash
pnpm build
```

The extension will be built in the `dist/` folder with:
- `background.js` - Service worker
- `content.js` - Content script
- `popup.html` - Popup UI
- `manifest.json` - Extension metadata

## Usage

### 1. Configure Backend

1. Click the extension icon
2. Go to "Settings" tab
3. Enter:
   - **Backend URL**: Your research API endpoint (e.g., `https://api.research-server.com`)
   - **Auth Token**: Bearer token from your account (get from web app settings)
4. Click "Save Settings"

### 2. Collect Data

1. Navigate to any GitHub page:
   - Repository page
   - Issue or PR page
   - Commit page
2. Click the extension icon
3. Click "Scrape" to extract data
4. Review the data preview
5. Click "Submit" to send to research database

### 3. View History

- Go to "History" tab to see all submitted collections
- Each entry shows:
  - Status (Pending, Submitted, Failed)
  - Timestamp
  - Error details (if any)
- Click "Clear History" to remove all entries

## Data Collection

### Supported Page Types

#### Repository
- Full name, owner, description
- Star/fork counts
- Programming language
- Privacy and fork status
- Current branch

#### Issues
- Issue number and title
- State (open/closed)
- Author
- Labels
- Creation and update timestamps

#### Pull Requests
- PR number and title
- State (open/closed)
- Draft status
- Review count
- Changed files and diff statistics
- Additions/deletions

#### Commits
- Commit SHA
- Title and message
- Author
- Timestamp

## Architecture

### Scripts

- **`src/scripts/content.ts`**: Injected into GitHub pages, handles scraping and message passing
- **`src/scripts/background.ts`**: Service worker managing extension state and configuration

### Utilities

- **`src/utils/scrapers.ts`**: DOM parsing functions for extracting GitHub data

### UI

- **`src/popup/PopupApp.tsx`**: React component for the popup interface
- **`src/popup/popup.html`**: HTML template for the popup

## API Integration

The extension communicates with the backend via:

**Endpoint**: `POST /api/extension/snapshots`

**Request Headers**:
```
Content-Type: application/json
Authorization: Bearer {token}
```

**Request Body**:
```json
{
  "repositoryFullName": "owner/repo",
  "entityType": "ISSUE|PULL_REQUEST|COMMIT|REPOSITORY",
  "githubNumber": 123,
  "githubSha": "abc123...",
  "payload": {
    // Full entity data from DOM
  }
}
```

**Response**:
```json
{
  "ok": true
}
```

## Development

### Building

```bash
pnpm build
```

### Type Checking

```bash
pnpm build  # Runs tsc -b first
```

### Linting

```bash
pnpm lint
```

### Hot Reload (Development)

```bash
pnpm dev
```

## Troubleshooting

### "Repository must be synced before extension snapshots can be attached"

This error means the repository hasn't been collected via the API yet. The backend requires repositories to exist before storing extension data.

**Solution**: Go to the web app and sync the repository first using the API collection feature.

### "Backend URL and auth token not configured"

**Solution**: Go to Settings tab and enter your backend URL and authentication token.

### Data not showing up

1. Check browser console for errors (F12 → Console)
2. Verify backend URL is correct
3. Verify authentication token is valid
4. Check that you're on a GitHub page with recognizable content

## Data Privacy

This extension:
- Only operates on GitHub.com
- Sends data only to your configured backend
- Does not store data locally (except collection history)
- Does not send data to external services
- Does not track user behavior

## Architecture Diagram

```
┌─────────────────┐
│  GitHub Pages   │
└────────┬────────┘
         │
    ┌────▼────┐
    │ Content │
    │ Script  │◄─── Scrapes DOM
    └────┬────┘
         │ Message
    ┌────▼────┐
    │ Popup   │◄─── User Interface
    └────┬────┘
         │
    ┌────▼──────────┐
    │ Background    │
    │ Service       │
    │ Worker        │
    └────┬──────────┘
         │ HTTP POST
    ┌────▼──────────┐
    │   Backend     │
    │   API         │
    └───────────────┘
```

## Permissions

The extension requests:
- `storage` - Store configuration
- `tabs` - Access current tab
- `activeTab` - Run on active GitHub tab
- `scripting` - Inject content script
- `https://github.com/*` - Access GitHub pages
- `https://api.github.com/*` - For future direct API integration

## Future Enhancements

- [ ] Automatic repository sync before submission
- [ ] Batch submission for multiple pages
- [ ] Rate limiting aware submission
- [ ] Custom field extraction configuration
- [ ] Export collected data
- [ ] Offline queue for failed submissions

## Support

For issues or feature requests, please create an issue in the project repository.

## License

Part of the FYP project for improving GitHub dataset reliability.
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
