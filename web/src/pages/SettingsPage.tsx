import { useState, useEffect } from 'react';
import { PageTitle, Text } from '../components/ui/Typography';
import { Card } from '../components/ui/Layout';
import { Toggle } from '../components/ui/Controls';

export default function SettingsPage() {
  const [darkMode, setDarkMode] = useState(false);

  // Load saved theme on mount
  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') {
      setDarkMode(true);
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }, []);

  // Toggle theme
  const handleToggle = (value: boolean) => {
    setDarkMode(value);

    const theme = value ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  };

  return (
    <div style={{ padding: 32 }}>
      <PageTitle subtitle="Manage application preferences">
        Settings
      </PageTitle>

      <Card style={{ marginTop: 24, maxWidth: 500 }}>
        <Text>Appearance</Text>

        <Toggle
          label="Dark mode"
          checked={darkMode}
          onChange={(e) => handleToggle(e)}
          helper="Switch between light and dark theme"
        />
      </Card>
    </div>
  );
}