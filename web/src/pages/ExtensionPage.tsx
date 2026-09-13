import { Link } from 'react-router-dom';
import { PageTitle, SectionHeading, Text, Caption, Code, Label } from '../components/ui/Typography';
import { Card } from '../components/ui/Layout';
import { Tag } from '../components/ui/Badge';
import './ExtensionPage.css';

/**
 * Downloads for the GitHub Research Data Collector Chrome extension
 * with explanation of what it does and how to install it.
 */
export default function ExtensionPage() {
  return (
    <div className="extension-page">
      <PageTitle subtitle="Browser-side extraction of GitHub repository data, complementing the API-backed collection for a more reliable dataset.">
        Browser Extension
      </PageTitle>

      <Card className="extension-download-card">
        <div className="extension-download-info">
          <Label caps>GitHub Research Data Collector</Label>
          <Text>
            A Chrome extension (Manifest V3) that scrapes structured data directly from the GitHub
            pages you visit, lets you review it, and submits it to your research backend. It
            captures repositories, issues, pull requests, and commits.
          </Text>
          <div className="extension-meta">
            <Tag variant="feature">Version 1.0.0</Tag>
            <Tag variant="default">Manifest V3</Tag>
            <Tag variant="default">~72 KB</Tag>
            <Tag variant="default">Chrome</Tag>
          </div>
        </div>
        <div className="extension-download-action">
          <a
            className="btn btn-lg btn-primary"
            href="/extension/github-research-collector.zip"
            download="github-research-collector.zip"
          >
            Download Extension
          </a>
          <Caption>Unpack the zip and load it via chrome://extensions (see steps below).</Caption>
        </div>
      </Card>

      <section className="extension-section">
        <SectionHeading subtitle="Why browse the page itself instead of calling the API? The extension reads exactly what a human sees, so it can capture data that API endpoints summarise or omit.">
          What it does
        </SectionHeading>
        <Card>
          <ul className="extension-feature-list">
            <li>
              <strong>DOM scraping</strong> — extracts structured data straight from the rendered
              GitHub page you are viewing.
            </li>
            <li>
              <strong>Page-type detection</strong> — automatically recognises repositories, issues,
              pull requests, and commit pages.
            </li>
            <li>
              <strong>Review before submit</strong> — previews the extracted JSON before anything is
              sent.
            </li>
            <li>
              <strong>Collection history</strong> — tracks every submission with its status
              (pending / submitted / failed).
            </li>
            <li>
              <strong>Clear error handling</strong> — surfaces problems and allows retries without
              losing data.
            </li>
          </ul>
        </Card>
      </section>

      <section className="extension-section">
        <SectionHeading subtitle="Data flows from the page you are looking at into the research database.">
          How it works
        </SectionHeading>
        <Card>
          <ol className="extension-steps-flow">
            <li>
              The <strong>content script</strong> runs on github.com and scrapes the visible page
              (repository, issue, PR, or commit).
            </li>
            <li>
              The <strong>popup</strong> shows the extracted data for you to review.
            </li>
            <li>You click <strong>Submit</strong> and the popup sends it to the extension&apos;s background service worker.</li>
            <li>
              The <strong>service worker</strong> POSTs the snapshot to your backend at{' '}
              <Code>POST /api/extension/snapshots</Code> with your auth token.
            </li>
          </ol>
        </Card>
      </section>

      <section className="extension-section">
        <SectionHeading>Install in Chrome</SectionHeading>
        <Card>
          <ol className="extension-install-steps">
            <li>
              Download the extension zip above and unzip it somewhere on your computer (e.g.{' '}
              <Code>~/github-research-collector</Code>).
            </li>
            <li>
              Open <Code>chrome://extensions/</Code> in Chrome.
            </li>
            <li>
              Turn on <strong>Developer mode</strong> (top-right corner).
            </li>
            <li>
              Click <strong>Load unpacked</strong> and select the unzipped folder containing{' '}
              <Code>manifest.json</Code>.
            </li>
            <li>
              Pin the extension icon to the toolbar for easy access.
            </li>
          </ol>
        </Card>
      </section>

      <section className="extension-section">
        <SectionHeading subtitle="The extension needs to know where your backend is and who you are.">
          Configure
        </SectionHeading>
        <Card>
          <ol className="extension-config-steps">
            <li>
              Click the extension icon and open the <strong>Settings</strong> tab.
            </li>
            <li>
              Enter your backend URL, e.g. <Code>http://localhost:3000</Code>.
            </li>
            <li>
              Enter your auth token. Generate one on the{' '}
              <Link to="/settings">Settings page</Link> of this app (Account &rarr; API tokens).
            </li>
            <li>
              Click <strong>Save Settings</strong>.
            </li>
          </ol>
          <Text secondary>
            Tokens are stored in <Code>chrome.storage.sync</Code> (encrypted by Chrome) and are only
            sent to the backend you configure.
          </Text>
        </Card>
      </section>

      <section className="extension-section">
        <SectionHeading subtitle="Go to a GitHub repository, scrape, review, and submit.">
          Collect data
        </SectionHeading>
        <Card>
          <ol className="extension-flow-steps">
            <li>Navigate to a GitHub repository, issue, PR, or commit page.</li>
            <li>Click the extension icon, then <strong>Scrape</strong> to extract the data.</li>
            <li>Review the previewed JSON.</li>
            <li>Click <strong>Submit</strong> and check the <strong>History</strong> tab for confirmation.</li>
          </ol>
          <Text secondary>
            Note: the repository must already exist in the database (run a sync from the Home page
            first). Otherwise the backend rejects snapshots with &quot;Repository must be synced
            before extension snapshots can be attached&quot;.
          </Text>
        </Card>
      </section>

      <section className="extension-section">
        <SectionHeading>Privacy &amp; permissions</SectionHeading>
        <Card>
          <ul className="extension-feature-list">
            <li>Only operates on <Code>github.com</Code> pages — nothing else.</li>
            <li>
              Requests minimal permissions: <Code>storage</Code>, <Code>tabs</Code>,{' '}
              <Code>activeTab</Code>, and <Code>scripting</Code>.
            </li>
            <li>
              Sends data only to your configured backend with your token in the{' '}
              <Code>Authorization</Code> header.
            </li>
            <li>Does not track browsing behaviour and sends nothing to third parties.</li>
          </ul>
        </Card>
      </section>

      <section className="extension-section">
        <SectionHeading>Troubleshooting</SectionHeading>
        <Card>
          <ul className="extension-feature-list">
            <li>
              <strong>Content script not injecting</strong> — make sure you are on a github.com page
              and refresh after installing.
            </li>
            <li>
              <strong>Data not being sent</strong> — check the backend URL includes{' '}
              <Code>http(s)://</Code>, the token is valid, and inspect the browser console (F12).
            </li>
            <li>
              <strong>Storage issues</strong> — remove and reinstall the extension to clear its
              stored history.
            </li>
          </ul>
        </Card>
      </section>
    </div>
  );
}