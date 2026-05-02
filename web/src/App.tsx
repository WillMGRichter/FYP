import './App.css';

import { Card } from './components/ui/Layout';
import { Button } from './components/ui/Button';
import { PageTitle, Text, Caption } from './components/ui/Typography';

export default function App() {

  return (
    <div className="app">

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <PageTitle subtitle="Empirical Software Engineering Tool">
            GitHub Data Collection & Analysis
          </PageTitle>

          <Text className="hero-text">
            Collect issues, pull requests, and commits from GitHub repositories,
            analyse trends, and export structured datasets for research.
          </Text>

          <div className="hero-actions">
            <Button variant="primary">Start Collecting</Button>
            <Button variant="secondary">View Components</Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="features">
        <Card>
          <h3>📊 Data Collection</h3>
          <Caption>Fetch issues, PRs, and commits from any repository</Caption>
        </Card>

        <Card>
          <h3>🧠 AI Summaries</h3>
          <Caption>Automatically summarise discussions and trends</Caption>
        </Card>

        <Card>
          <h3>📁 Export Data</h3>
          <Caption>Export datasets as CSV or JSON for analysis</Caption>
        </Card>
      </section>

      {/* Footer */}
      <footer className="footer">
        <Caption>Built for final year project — GitHub Research Tool</Caption>
      </footer>
    </div>
  );
}