# Extension Deployment Checklist

## For Researchers (End Users)

### Prerequisites
- [ ] Chrome browser installed
- [ ] Research backend deployed and running
- [ ] Account created on research web app
- [ ] API token generated from account settings

### Installation & Setup
- [ ] Download/install extension from Chrome Web Store (or load unpacked if self-hosting)
- [ ] Extension icon appears in Chrome toolbar
- [ ] Click extension icon to open popup
- [ ] Go to Settings tab
- [ ] Enter backend URL
- [ ] Enter API token
- [ ] Click "Save Settings"
- [ ] Settings saved confirmation appears

### First Collection
- [ ] Navigate to GitHub.com repository
- [ ] Click extension icon
- [ ] Click "Scrape" button
- [ ] Data preview appears showing extracted information
- [ ] Review preview for accuracy
- [ ] Click "Submit" button
- [ ] Check History tab shows submitted status
- [ ] Verify data appears in research web app

### Ongoing Use
- [ ] Collect data from multiple GitHub entities (repos, issues, PRs, commits)
- [ ] Monitor collection history for any failures
- [ ] Report any issues encountered
- [ ] Keep extension updated

---

## For Developers (Extension Development)

### Setup
- [ ] Node.js 18+ installed
- [ ] pnpm package manager installed
- [ ] Repository cloned
- [ ] Dependencies installed: `cd extension && pnpm install`

### Building
- [ ] Build extension: `pnpm build`
- [ ] No build errors or warnings
- [ ] `dist/` folder contains all required files:
  - [ ] `background.js`
  - [ ] `content.js`
  - [ ] `popup.html`
  - [ ] `manifest.json`
  - [ ] Other assets

### Loading in Chrome (Development)
- [ ] Open `chrome://extensions/`
- [ ] Enable "Developer mode"
- [ ] Click "Load unpacked"
- [ ] Select `extension/dist` folder
- [ ] Extension loads without errors
- [ ] Extension icon appears in toolbar

### Testing
- [ ] Open browser console (F12) on GitHub page
- [ ] No JavaScript errors
- [ ] Content script logs appear in console
- [ ] Scrape button works on repository page
- [ ] Scrape button works on issue page
- [ ] Scrape button works on PR page
- [ ] Scrape button works on commit page
- [ ] Data preview displays correct JSON
- [ ] Submit functionality works
- [ ] Collection history updates
- [ ] Settings save and persist
- [ ] Settings load on extension reload

### Code Quality
- [ ] No TypeScript errors: `pnpm build`
- [ ] Linting passes: `pnpm lint`
- [ ] All files documented with comments
- [ ] Error handling for edge cases
- [ ] User feedback for all actions

### Documentation
- [ ] README.md updated
- [ ] SETUP.md complete
- [ ] Code comments explain logic
- [ ] API integration documented
- [ ] Troubleshooting guide current

---

## For DevOps / Deployment

### Backend Preparation
- [ ] Backend API running and accessible
- [ ] `/api/extension/snapshots` endpoint implemented
- [ ] Authentication working
- [ ] Database schema supports extension data:
  - [ ] EntitySnapshot table exists
  - [ ] `source` field present
  - [ ] `payload` field (JSON) present
  - [ ] RepositoryArtifact table exists
- [ ] CORS configured to accept extension requests
- [ ] Rate limiting configured appropriately

### Extension Packaging
- [ ] Extension built: `pnpm build`
- [ ] `dist/` folder ready for distribution
- [ ] Version number updated in manifest
- [ ] Icons included and valid
- [ ] No API keys or secrets in code
- [ ] All permissions justified

### Chrome Web Store Submission (if applicable)
- [ ] Developer account created
- [ ] Extension bundled: `cd dist && zip -r ../extension.zip .`
- [ ] Store listing created:
  - [ ] Title: "GitHub Research Data Collector"
  - [ ] Description written
  - [ ] Screenshots provided (2-5)
  - [ ] Category selected
  - [ ] Language set to English
  - [ ] Privacy policy linked
  - [ ] Support email provided
- [ ] Extension submitted for review
- [ ] Review feedback addressed
- [ ] Extension published

### Self-Hosted Distribution
- [ ] Extension packaged and hosted
- [ ] Installation instructions provided
- [ ] Support contact information available
- [ ] Update mechanism documented

### Monitoring (Post-Deployment)
- [ ] Monitor backend API logs for extension requests
- [ ] Track error rates
- [ ] Monitor storage usage
- [ ] Check user feedback/issues
- [ ] Plan for Chrome API deprecations

---

## For QA / Testing

### Functionality Testing
- [ ] Test each page type scraping
  - [ ] Repository pages
  - [ ] Issue pages
  - [ ] PR pages
  - [ ] Commit pages
  - [ ] List pages (issues/PRs)
- [ ] Test data accuracy
  - [ ] All fields extracted correctly
  - [ ] Data types correct
  - [ ] No truncation or loss
- [ ] Test UI interactions
  - [ ] Tab switching works
  - [ ] Buttons responsive
  - [ ] Inputs accept text
  - [ ] Scrolling works
- [ ] Test edge cases
  - [ ] Non-GitHub pages (no-op)
  - [ ] Private repositories (if applicable)
  - [ ] Fork repositories
  - [ ] Deleted content
  - [ ] Very long content

### Error Handling Testing
- [ ] Misconfigured backend URL
- [ ] Invalid authentication token
- [ ] Network errors
- [ ] Backend unavailable
- [ ] Missing required fields
- [ ] Duplicate submissions
- [ ] Large payloads

### Performance Testing
- [ ] Extension doesn't slow down browsing
- [ ] Memory usage stays reasonable
- [ ] Storage usage acceptable
- [ ] Batch operations performant

### Security Testing
- [ ] Tokens not exposed in logs
- [ ] No cross-site script vulnerabilities
- [ ] Permissions not misused
- [ ] Data not sent to unexpected endpoints
- [ ] HTTPS enforced

### Browser Compatibility
- [ ] Works on Chrome 88+
- [ ] Works on Edge (Chromium)
- [ ] Graceful degradation on older versions

---

## Timeline

### Phase 1: Development (2-4 weeks)
- Set up development environment
- Implement all components
- Unit testing
- Integration testing

### Phase 2: Testing (1-2 weeks)
- QA testing
- User acceptance testing
- Bug fixes
- Performance optimization

### Phase 3: Deployment (1 week)
- Documentation finalization
- Chrome Web Store submission (if applicable)
- User training/onboarding
- Support setup

### Phase 4: Monitoring (Ongoing)
- User support
- Bug reporting/fixing
- Feature enhancements
- Maintenance

---

## Success Criteria

- [ ] Extension successfully extracts data from all GitHub page types
- [ ] Data successfully submits to backend API
- [ ] Collection history accurately tracks submissions
- [ ] No critical errors in user workflows
- [ ] Performance acceptable (< 100ms scraping time)
- [ ] User satisfaction > 80%
- [ ] Documentation complete and clear
- [ ] Security audit passed
- [ ] Deployment to Chrome Web Store successful (if applicable)
