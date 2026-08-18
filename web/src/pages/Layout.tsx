import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Navbar } from '../components/ui/Layout';
import { Button } from '../components/ui/Button';

/**
 * Root layout component providing the navbar shell and
 * routing via React Router Outlet.
 */
export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const navItems = [
    { key: 'home', label: 'Home', href: '/' },
    { key: 'analytics', label: 'Analytics', href: '/analytics' },
    { key: 'components', label: 'Components', href: '/components' },
    { key: 'settings', label: 'Settings', href: '/settings' },
  ];
  const activeKey = navItems.find((item) => item.href === location.pathname)?.key ?? 'home';

  return (
    <div>
      <Navbar
        brand={{ label: 'GitResearch', icon: 'G' }}
        items={navItems}
        activeKey={activeKey}
        onNavigate={navigate}
        end={
          <Button variant="primary" size="sm" onClick={() => navigate('/')}>
            New Collection
          </Button>
        }
      />

      <main>
        <Outlet />
      </main>
    </div>
  );
}
