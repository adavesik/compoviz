import { Analytics } from '@vercel/analytics/react';

// Providers
import { ComposeProvider } from './hooks/useCompose.jsx';
import { UIProvider } from './context/UIContext';
import { ToastProvider } from './components/ui';

// Layout
import MainLayout from './components/MainLayout';

// Vercel Analytics - disabled for self-hosted/Docker builds (See Dockerfile)
const vercelAnalyticsEnabled = import.meta.env.VITE_DISABLE_VERCEL_ANALYTICS !== 'true';

/**
 * Main Application Component
 * Pure provider wrapper - all state and logic moved to contexts and MainLayout
 */
export default function App() {
  return (
    <UIProvider>
      <ComposeProvider>
        <ToastProvider>
          <MainLayout />
        </ToastProvider>
        {vercelAnalyticsEnabled && <Analytics />}
      </ComposeProvider>
    </UIProvider>
  );
}
