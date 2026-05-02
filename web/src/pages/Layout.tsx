import { Outlet } from 'react-router-dom';
import { Navbar } from '../components/ui/Layout';
import { Button } from '../components/ui/Button';

export default function Layout() {
  const navItems = [
    { key: 'home', label: 'Home', href: '/' },
    { key: 'components', label: 'Components', href: '/components' },
    { key: 'settings', label: 'Settings', href: '/settings' },
  ];

  return (
    <div>
      {/* Global Top Bar */}
      <Navbar
        brand={{ label: 'GitResearch', icon: 'G' }}
        items={navItems}
        activeKey="home"
        end={
          <Button variant="primary" size="sm">
            New Collection
          </Button>
        }
      />

      {/* Page content renders here */}
      <main>
        <Outlet />
      </main>
    </div>
  );
}