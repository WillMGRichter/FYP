# Chrome Extension Setup & Deployment Guide

## Quick Start (Development)

### Prerequisites
- Node.js 18+ and pnpm
- Chrome browser
- Running backend server

### Steps

1. **Install dependencies**
```bash
cd extension
pnpm install
```

2. **Build the extension**
```bash
pnpm build
```

3. **Load in Chrome**
   - Open `chrome://extensions/`
   - Enable "Developer mode" (top right)
   - Click "Load unpacked"
   - Navigate to `extension/dist` folder
   - Click "Select Folder"

4. **Configure extension**
   - Click extension icon in Chrome toolbar
   - Go to "Settings" tab
   - Enter your backend URL (e.g., `http://localhost:3000`)
   - Enter your auth token (from web app account settings)
   - Click "Save Settings"

5. **Test collection**
   - Navigate to a GitHub repository
   - Click extension icon
   - Click "Scrape"
   - Verify data preview
   - Click "Submit"
   - Check "History" tab for confirmation

## Development Workflow

### Hot Reload (Limited Support)

For UI changes, you can use Vite's dev server:
```bash
pnpm dev
```

However, service workers require manual reload:
- Make changes to `src/scripts/background.ts` or `src/scripts/content.ts`
- Run `pnpm build`
- In `chrome://extensions/`, click the refresh icon for the extension

### Debugging

1. **Content Script Console**
   - On any GitHub page, press F12
   - Console tab shows content script logs

2. **Background Service Worker**
   - In `chrome://extensions/`
   - Find "GitHub Research Data Collector"
   - Under "Inspect views", click "service worker"

3. **Popup Console**
   - Right-click extension icon
   - Select "Inspect popup"
   - Console tab shows popup logs

### Type Checking

```bash
pnpm build  # Runs tsc -b first, fails on type errors
```

## Production Deployment

### Chrome Web Store

1. **Prepare for submission**
   - Update version in `manifest.json`
   - Update version in `extension/package.json`
   - Build: `pnpm build`

2. **Create extension bundle**
```bash
cd dist
zip -r ../github-research-collector.zip .
cd ..
```

3. **Submit to Chrome Web Store**
   - Go to https://chrome.google.com/webstore/devconsole
   - Create new item
   - Upload the zip file
   - Fill in store details:
     - Description
     - Screenshots
     - Category: "Productivity" or "Developer Tools"
     - Language: English
   - Submit for review

### Self-Hosted Distribution

1. **Build the extension**
```bash
pnpm build
```

2. **Create distribution package**
```bash
cd dist
tar -czf ../github-research-collector.tar.gz .
```

3. **Host the package**
   - Upload to your server
   - Provide installation instructions to users

## Configuration

### Backend URL

Should point to your running backend API:

**Development**:
```
http://localhost:3000
```

**Production**:
```
https://api.research-database.com
```

### Authentication Token

Get from your account settings in the web app:
1. Log in to the research web app
2. Go to Account → Settings
3. Click "Generate API Token"
4. Copy the token and paste into extension settings

## Troubleshooting

### Extension doesn't load
- Check console for errors: `chrome://extensions/?errors`
- Verify all files exist in `dist/` folder
- Ensure manifest.json is valid JSON

### Content script not injecting
- Verify you're on a GitHub.com page
- Check: `chrome://extensions/` → Find extension → "Allow access to file URLs"
- Try refreshing the page

### Data not being sent
- Check backend URL format (must include `https://` or `http://`)
- Verify auth token is valid
- Check browser console (F12) for network errors
- Check backend logs for request details

### Storage errors
- Clear extension data: `chrome://apps/` → Right-click extension → "Remove"
- Reinstall the extension

## File Structure

```
extension/
├── src/
│   ├── scripts/
│   │   ├── background.ts      # Service worker
│   │   └── content.ts         # Content script
│   ├── utils/
│   │   └── scrapers.ts        # DOM parsing
│   └── popup/
│       ├── main.tsx           # Entry point
│       ├── PopupApp.tsx       # UI component
│       ├── popup.html         # HTML template
│       └── popup.css          # Styles
├── public/
│   └── icon-*.svg            # Extension icons
├── manifest.json             # Extension metadata
├── vite.config.ts            # Build config
├── tsconfig.json             # TypeScript config
└── package.json              # Dependencies
```

## Build Output

```
dist/
├── background.js             # Service worker (built from background.ts)
├── content.js                # Content script (built from content.ts)
├── popup.html                # Popup page
├── popup-*.js                # Popup dependencies
├── manifest.json             # Manifest copy
└── ...                        # Other assets
```

## Performance Optimization

### Minimize Bundle Size

- Tree-shaking is enabled in Vite build
- React is optimized for production builds
- Content scripts are kept lean

### Reduce Memory Usage

- Service worker unloads after 30 seconds of inactivity
- Content script only loads when needed
- Popup UI is lightweight React component

## Security Considerations

1. **Token Storage**
   - Tokens stored in `chrome.storage.sync` (encrypted by Chrome)
   - Never hardcoded in code
   - Never sent to external services

2. **Data Transmission**
   - Always uses HTTPS in production
   - Auth token sent in Authorization header
   - Data validated before sending

3. **Permissions**
   - Only requests necessary permissions
   - Limited to GitHub.com domain
   - No access to browsing history or other tabs

## Updating Users

### Manual Update
Users need to manually refresh:
1. Go to `chrome://extensions/`
2. Click refresh icon on the extension
3. Or remove and reinstall

### Automatic Updates
Chrome Web Store version updates automatically (within 24 hours)

## Support & Feedback

For issues or feature requests:
1. Check the troubleshooting section
2. Review browser console for errors
3. Report issues to the project repository
4. Include:
   - Chrome version (chrome://version/)
   - Extension version
   - Steps to reproduce
   - Console errors
