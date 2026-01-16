import { Analytics } from '@vercel/analytics/react';

// Providers
import { ComposeProvider } from './hooks/useCompose.jsx';
import { UIProvider } from './context/UIContext';

// Layout
import MainLayout from './components/MainLayout';

/**
 * Main Application Component
 * Pure provider wrapper - all state and logic moved to contexts and MainLayout
 */
export default function App() {
  return (
    <UIProvider>
      <ComposeProvider>
        <MainLayout />
        <Analytics />
      </ComposeProvider>
    </UIProvider>
  );
}

