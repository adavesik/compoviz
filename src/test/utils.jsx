import { render } from '@testing-library/react';
import { ComposeProvider } from '../hooks/useCompose.jsx';
import { UIProvider } from '../context/UIContext.jsx';

/**
 * Custom render function that wraps components with all necessary providers
 */
export function renderWithProviders(ui, { initialComposeState, initialUIState, ...renderOptions } = {}) {
    function Wrapper({ children }) {
        return (
            <UIProvider>
                <ComposeProvider>
                    {children}
                </ComposeProvider>
            </UIProvider>
        );
    }

    return render(ui, { wrapper: Wrapper, ...renderOptions });
}

// Re-export everything from testing library
export * from '@testing-library/react';
export { renderWithProviders as render };
