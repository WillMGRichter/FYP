# Chrome Extension - Developer Quick Start

## 5-Minute Setup

### 1. Build the Extension
```bash
cd extension
pnpm install
pnpm build
```

### 2. Load in Chrome
1. Open `chrome://extensions/`
2. Enable "Developer mode" (toggle top-right)
3. Click "Load unpacked"
4. Select `extension/dist` folder
5. Extension appears in toolbar!

### 3. Configure Backend
1. Click extension icon
2. Go to "Settings"
3. Enter backend URL: `http://localhost:3000`
4. Generate token from web app account settings
5. Paste token in "Auth Token" field
6. Click "Save Settings"

### 4. Test Collection
1. Go to any GitHub repository
2. Click extension icon
3. Click "Scrape" button
4. See data in preview
5. Click "Submit"
6. Check "History" tab

## File Map

| File | Purpose |
|------|---------|
| `src/scripts/content.ts` | Runs on GitHub pages, handles scraping |
| `src/scripts/background.ts` | Extension state & config management |
| `src/utils/scrapers.ts` | DOM parsing functions |
| `src/popup/PopupApp.tsx` | Main UI component |
| `manifest.json` | Extension metadata |

## Key Commands

```bash
# Build extension
pnpm build

# Rebuild when you change TypeScript files
pnpm build

# Check for TypeScript errors
pnpm build  # (runs tsc first)

# Lint code
pnpm lint
```

## Debugging

**Content Script** (runs on GitHub page):
- Press F12 on any GitHub page
- Go to Console tab
- Look for logs starting with `[Content Script]`

**Background Service Worker**:
- Go to `chrome://extensions/`
- Find "GitHub Research Data Collector"
- Click "Inspect views" → "service worker"
- Console tab shows background logs

**Popup**:
- Right-click extension icon
- Select "Inspect popup"
- Console shows popup logs

## Common Issues

| Issue | Solution |
|-------|----------|
| Extension not loading | Check `chrome://extensions/?errors` |
| Content script not working | Refresh GitHub page after loading extension |
| Data not submitting | Verify backend URL and token in Settings |
| "Repository not found" | Sync repo via web app first |

## Code Structure

```
src/
├── scripts/
│   ├── background.ts       # Extension lifecycle
│   └── content.ts          # GitHub page injection
├── utils/
│   └── scrapers.ts         # DOM extraction (15+ functions)
└── popup/
    ├── main.tsx            # React entry point
    ├── PopupApp.tsx        # Main UI (3 tabs)
    ├── popup.html          # HTML template
    └── popup.css           # Styles
```

## Data Flow

```
GitHub Page
    ↓ (Content Script injects)
DOM Elements
    ↓ (scrapers.ts extracts)
Structured Data (JSON)
    ↓ (Popup displays)
User Reviews
    ↓ (Clicks Submit)
Backend API
    ↓ (Stores in DB)
EntitySnapshot with source='browser_extension'
```

## Adding a New Scraper

### 1. Add function to `scrapers.ts`
```typescript
export function scrapeNewType(): NewTypeData | null {
  // DOM parsing logic
  // Return null if page type doesn't match
  // Return object with extracted data
}
```

### 2. Update page type detection
```typescript
export function getCurrentPageType(): GitHubEntityType | null {
  // Add new pattern to regex
}
```

### 3. Update `scrapeCurrentPage()`
```typescript
export function scrapeCurrentPage() {
  switch (pageType) {
    case 'NEW_TYPE':
      return { type: 'NEW_TYPE', data: scrapeNewType() };
  }
}
```

## Backend API Reference

**Endpoint**: `POST /api/extension/snapshots`

**Headers**:
```
Content-Type: application/json
Authorization: Bearer {token}
```

**Request**:
```json
{
  "repositoryFullName": "owner/repo",
  "entityType": "REPOSITORY|ISSUE|PULL_REQUEST|COMMIT",
  "githubNumber": 123,              // For issues/PRs
  "githubSha": "abc...",            // For commits
  "payload": {                        // Full extracted data
    // ... entity fields ...
  }
}
```

**Response**:
```json
{
  "ok": true
}
```

## Performance Tips

- Keep content script small (~30KB max)
- Avoid heavy DOM operations
- Use CSS selectors efficiently
- Cache DOM queries when scraping lists
- Test in Chrome DevTools Performance tab

## Next Steps

1. **Manual Testing**
   - Test on real GitHub pages
   - Try different entity types
   - Check console for errors

2. **Advanced Features**
   - Add batch submission
   - Implement offline queue
   - Add keyboard shortcuts

3. **Chrome Web Store**
   - Create store listing
   - Screenshot UI
   - Write description
   - Submit for review

## Resources

- [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 Guide](https://developer.chrome.com/docs/extensions/mv3/)
- [Service Workers](https://developer.chrome.com/docs/extensions/mv3/service_workers/)
- [Content Scripts](https://developer.chrome.com/docs/extensions/mv3/content_scripts/)

## Troubleshooting

**Q: Extension not appearing in toolbar?**
A: Check `chrome://extensions/` - it might have loaded but icon isn't visible. Try pinning the extension.

**Q: Popup won't open?**
A: Right-click extension → "Inspect popup" to see any JavaScript errors.

**Q: Data not being scraped?**
A: Verify you're on a GitHub entity page (repo, issue, PR, or commit). Check console for `getCurrentPageType()` result.

**Q: Submit fails with "Repository not found"?**
A: The backend requires the repository to exist first. Sync it via the web app's repository sync feature.

## Contact

For issues or questions, refer to:
- Browser console errors (F12)
- Background worker logs
- Popup inspection console
- Backend API response errors
