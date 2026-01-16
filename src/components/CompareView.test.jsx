import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { render } from '../test/utils.jsx';
import CompareView from '../components/CompareView.jsx';

// Mock the worker
vi.mock('../utils/graphvizWorker.js', () => ({
    renderGraphvizInWorker: vi.fn().mockResolvedValue('<svg></svg>'),
    cleanupGraphvizWorker: vi.fn(),
}));

describe('CompareView Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders without crashing', () => {
        const { container } = render(<CompareView />);
        expect(container).toBeTruthy();
    });

    it('shows some UI elements', () => {
        const { container } = render(<CompareView />);

        // Should have some content
        expect(container.textContent.length).toBeGreaterThan(0);
    });

    it('has expected structure', () => {
        const { container } = render(<CompareView />);

        // Should render div elements
        const divs = container.querySelectorAll('div');
        expect(divs.length).toBeGreaterThan(0);
    });
});
