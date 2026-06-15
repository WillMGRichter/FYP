# Systems Integration Guide

## Complete System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                         GitHub.com                                     │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
                    ┌────────┴────────┐
                    │                 │
                    ▼                 ▼
           ┌──────────────┐    ┌──────────────┐
           │  GitHub API  │    │ Browser DOM  │
           │ (REST v2022) │    │  (HTML/CSS)  │
           └──────┬───────┘    └───────┬──────┘
                  │                    │
        API-based │                    │ Extension-based
        Collection│                    │ Collection
                  │                    │
                  ▼                    ▼
     ┌──────────────────────────────────────────┐
     │      Backend API (Fastify)               │
     │  ┌──────────────────────────────────────┤
     │  │ POST /api/repositories/sync          │
     │  │ (API-based collection)               │
     │  ├──────────────────────────────────────┤
     │  │ POST /api/extension/snapshots        │
     │  │ (Browser-based collection)           │
     │  └──────────────────────────────────────┘
     └──────────────────┬───────────────────────┘
                        │
                        ▼
     ┌──────────────────────────────────────────┐
     │   Prisma ORM + PostgreSQL                │
     │  ┌──────────────────────────────────────┤
     │  │ EntitySnapshot                       │
     │  │ - source: 'github_api' | 'browser'   │
     │  │ - payload: JSON                      │
     │  │ - payloadHash: for deduplication     │
     │  ├──────────────────────────────────────┤
     │  │ RepositoryArtifact                   │
     │  │ - type: ISSUE | PR | COMMIT          │
     │  │ - snapshots: []                      │
     │  ├──────────────────────────────────────┤
     │  │ CollectionRun                        │
     │  │ - status: PENDING | RUNNING | etc.   │
     │  │ - snapshots: []                      │
     │  └──────────────────────────────────────┘
     └──────────────────┬───────────────────────┘
                        │
        ┌───────────────┴───────────────┐
        │                               │
        ▼                               ▼
   ┌──────────┐               ┌─────────────────┐
   │Web App   │               │Chrome Extension │
   │ (React)  │               │    (React)      │
   └──────────┘               └─────────────────┘
```

---

## Component Integration

### 1. Frontend Web Application

**Location**: `web/`

**Features**:
- Repository discovery and sync
- Collection run management
- Dataset querying and filtering
- Data export functionality
- User authentication

**Integration with Backend**:
- Calls `GET /api/repositories`
- Calls `GET /api/collections`
- Calls `POST /api/repositories/sync` for API-based collection
- Displays data from EntitySnapshot table

**Integration with Extension**:
- Shows stats on collected vs. API data
- Displays browser extraction metadata
- Provides feedback on collection quality

### 2. Backend API

**Location**: `backend/`

**Core Endpoints**:
- `POST /api/repositories/sync` - API-based collection
- `POST /api/extension/snapshots` - Extension-based collection
- `GET /api/repositories` - List repositories
- `GET /api/collections` - List collection runs
- `GET /api/auth/*` - Authentication endpoints

**Database Integration**:
- Stores API responses via `createSnapshot(source='github_api')`
- Stores browser extractions via `createSnapshot(source='browser_extension')`
- Uses payload hash for deduplication
- Maintains artifact relationships

**Key Logic**:
```typescript
// When extension submits data:
1. Find repository by fullName
2. Create/update RepositoryArtifact if needed
3. Store in EntitySnapshot with source='browser_extension'
4. Payload hash ensures no duplicates
```

### 3. Chrome Extension

**Location**: `extension/`

**Collection Flow**:
1. User navigates to GitHub page
2. Content script detects page type
3. User clicks "Scrape" → DOM extraction via scrapers.ts
4. Popup displays JSON preview
5. User clicks "Submit" → POST to /api/extension/snapshots
6. Backend validates and stores

**Integration Points**:
- Reads backend URL from chrome.storage.sync
- Uses stored auth token for requests
- Calls backend API endpoint
- Tracks submission status

---

## Data Flow Scenarios

### Scenario 1: API-Based Collection (Web App)

```
User clicks "Sync" on web app
  ↓
Web app calls: POST /api/repositories/sync
  ↓
Backend: Fetch from GitHub API
  ↓
Backend: Store in EntitySnapshot (source='github_api')
  ↓
Update CollectionRun status
  ↓
Web app displays results
```

### Scenario 2: Browser-Based Collection (Extension)

```
User navigates GitHub page
  ↓
Extension loads content script
  ↓
User clicks "Scrape"
  ↓
DOM extraction via scrapers.ts
  ↓
Popup shows JSON preview
  ↓
User clicks "Submit"
  ↓
Extension POST to /api/extension/snapshots
  ↓
Backend: Validate repository exists
  ↓
Backend: Store in EntitySnapshot (source='browser_extension')
  ↓
History tab shows "Submitted"
  ↓
Web app eventually shows this data
```

### Scenario 3: Hybrid Collection (Both API + Browser)

```
Data exists from API:
  EntitySnapshot.source = 'github_api'
  
User collects same entity with extension:
  EntitySnapshot.source = 'browser_extension'
  payloadHash compared
  
If different:
  Stored separately → Shows additional context
  
If same:
  Deduplicated → No duplicate stored
```

---

## Database Schema Relationships

### Key Tables & Relationships

```
Repository (1)
  ├─ N RepositoryArtifact
  │   └─ N EntitySnapshot
  ├─ N EntitySnapshot (for repo-level snapshots)
  └─ N CollectionRun

Account (1)
  ├─ N CollectionRun (who initiated)
  ├─ N GitHubToken
  ├─ N StarredRepository
  └─ N AccountContribution

EntitySnapshot (1)
  ├─ (optional) RepositoryArtifact
  ├─ (optional) CollectionRun
  └─ 1 Repository
```

### Source Tracking

```
EntitySnapshot {
  source: 'github_api' | 'browser_extension'
  payload: {
    // Full entity data from either source
  }
  payloadHash: 'sha256hash'
  capturedAt: timestamp
}
```

---

## Authentication & Authorization

### Flow

```
1. User creates account via web app
   ├─ Account record created
   └─ Password hashed (pbkdf2_sha256)

2. User logs in
   ├─ Password verified
   └─ Session token generated

3. User generates API token
   ├─ Token stored encrypted in DB
   ├─ Token preview shown (first 4 + last 4 chars)
   └─ Token returned to user

4. Extension configured with token
   ├─ Stored in chrome.storage.sync
   └─ Sent as: Authorization: Bearer {token}

5. Backend validates token
   ├─ Token hash found in GitHubToken table
   ├─ Checks if still valid
   └─ Associates collection with Account
```

### Permissions

- **Web App**: Full CRUD operations on own data
- **Extension**: Read-only GitHub + Write EntitySnapshot
- **API**: Requires valid token for authenticated operations

---

## Deployment Architecture

### Development Setup

```
Local Machine:
├─ Backend (localhost:3000)
│  └─ Database (localhost PostgreSQL)
├─ Web App (localhost:5173)
└─ Extension (loaded unpacked)
   └─ Configured to use localhost:3000
```

### Production Setup

```
Cloud Infrastructure:
├─ Backend (api.research.com)
│  ├─ Load balancer
│  ├─ Multiple instances
│  └─ Database cluster
├─ Web App (research.com)
│  ├─ CDN for assets
│  └─ HTTPS only
└─ Extension (Chrome Web Store)
   └─ Configured to use api.research.com
```

---

## Data Collection Comparison

### API-Based (Existing)

**Advantages**:
- Complete data available
- Historical tracking
- Rate-aware collection
- No browser required
- Scalable polling

**Limitations**:
- API rate limits
- Incomplete context
- Can miss UI-only data
- Delayed updates

**Best For**:
- Bulk collection
- Historical analysis
- Automated pipelines

### Browser-Based (New)

**Advantages**:
- UI context captured
- Real-time extraction
- Avoids rate limits
- User-controlled
- Captures transient data

**Limitations**:
- Manual operation
- Limited to viewed pages
- Requires user action
- Not automatable

**Best For**:
- Enriching API data
- Capturing UI metadata
- User-initiated collection
- Context-sensitive analysis

### Hybrid (Recommended)

**Strategy**:
1. Use API for bulk historical data
2. Use extension to capture additional UI context
3. Merge datasets based on payloadHash
4. Maintain separate snapshots for comparison
5. Flag where API and UI data diverge

**Benefits**:
- Maximum data completeness
- Better error detection
- Research validity
- Dataset reliability

---

## Monitoring & Debugging

### Web App Health

```
Monitor:
- User registrations
- Collection runs success rate
- Average collection time
- Repository coverage
- Data quality metrics

Dashboards:
- Collection statistics
- Error rates
- Performance graphs
- User activity
```

### Backend Health

```
Monitor:
- API request latency
- Database query performance
- Error logs
- Extension vs. API submission ratios
- Token usage patterns

Logs:
- Request/response times
- Collection run status
- Error details
- Warning messages
```

### Extension Health

```
Monitor:
- Installation count
- Active users
- Error reporting
- Data submission success rate
- User configuration issues

Debug:
- Browser console logs
- Service worker inspection
- Network tab for API calls
- Storage inspection
```

---

## Troubleshooting Integration Issues

### Extension → Backend Communication

**Problem**: Extension unable to submit
**Check**:
1. Backend URL is reachable
2. Auth token is valid
3. CORS headers correct
4. Repository exists in backend
5. Network/firewall allowing request

**Debug**:
```
// In extension popup:
Check browser console (F12) for error messages
Look for network errors in Network tab
Verify auth token hasn't expired
```

### API → Database

**Problem**: Collection not showing in web app
**Check**:
1. Collection run completed
2. Status shows "COMPLETED"
3. EntitySnapshot records created
4. Database connection active
5. Repository record exists

**Debug**:
```sql
-- Check if snapshots exist
SELECT * FROM "EntitySnapshot" 
WHERE "source" = 'browser_extension' 
ORDER BY "capturedAt" DESC LIMIT 10;

-- Check collection run status
SELECT * FROM "CollectionRun" 
ORDER BY "startedAt" DESC LIMIT 5;
```

### Web App → Backend

**Problem**: Web app not loading repositories
**Check**:
1. Backend running
2. Database connected
3. Authentication working
4. API endpoint responding
5. CORS configured

**Debug**:
```
// Browser console (F12)
Check Network tab for API requests
Look for CORS errors
Verify token in Authorization header
Check response codes (200 vs. 401/403)
```

---

## Performance Optimization

### Frontend (Web App)

- Use data pagination for large lists
- Implement lazy loading for images
- Cache collection statistics
- Debounce filter inputs

### Backend

- Index EntitySnapshot by source
- Cache frequent queries
- Use connection pooling
- Implement query optimization

### Extension

- Minimize content script size
- Batch DOM queries
- Cache DOM references
- Use efficient selectors

---

## Security Considerations

### Data in Transit

- ✅ HTTPS for all external communication
- ✅ Bearer token authentication
- ✅ No sensitive data in URLs
- ✅ Request validation on backend

### Data at Rest

- ✅ Database encryption
- ✅ Token encryption in storage
- ✅ Access control on API endpoints
- ✅ Audit logging

### Extension Specific

- ✅ Tokens stored in chrome.storage.sync (encrypted by Chrome)
- ✅ No cookies or session storage
- ✅ Content Security Policy enforced
- ✅ Limited permissions

---

## Scaling Considerations

### For 1,000 Repositories

- Database indexes on source and timestamps
- Connection pooling
- Response caching

### For 10,000 Repositories

- Sharded database
- Read replicas
- CDN for static assets
- Batch API requests

### For 100,000+ Repositories

- Data warehouse for analytics
- Distributed collection runs
- Message queue for submissions
- Advanced caching layer

---

## Summary

The system provides a **hybrid approach** to GitHub data collection:

1. **API-based** collection for bulk, historical data
2. **Browser-based** collection for UI context and user-controlled acquisition
3. **Intelligent deduplication** to avoid redundant storage
4. **Comprehensive tracking** via source field
5. **Research-ready** dataset combining both sources

This architecture fulfills the FYP research objectives by improving dataset **completeness, consistency, and reliability** while maintaining **ethical data collection practices** through user control and transparency.
