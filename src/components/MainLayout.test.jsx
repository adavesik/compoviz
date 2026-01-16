import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { render } from '../test/utils.jsx';
import MainLayout from './MainLayout.jsx';

// Mock lazy-loaded components
vi.mock('./VisualBuilder.jsx', () => ({
    default: () => <div data-testid="visual-builder">Visual Builder</div>,
}));

vi.mock('./CompareView.jsx', () => ({
    default: () => <div data-testid="compare-view">Compare View</div>,
}));

vi.mock('../features/diagram/GraphvizDiagram.jsx', () => ({
    GraphvizDiagram: () => <div data-testid="graphviz-diagram">Diagram View</div>,
}));

describe('MainLayout Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders header with app name and logo', () => {
        render(<MainLayout />);

        expect(screen.getByText('Compoviz')).toBeInTheDocument();
        expect(screen.getByAltText(/logo/i)).toBeInTheDocument();
    });

    it('shows view switcher buttons', () => {
        render(<MainLayout />);

        expect(screen.getByText('Editor')).toBeInTheDocument();
        expect(screen.getByText('Build')).toBeInTheDocument();
        expect(screen.getByText('View')).toBeInTheDocument();
        expect(screen.getByText('Compare')).toBeInTheDocument();
    });

    it('shows undo/redo buttons', () => {
        render(<MainLayout />);

        expect(screen.getByTitle(/undo/i)).toBeInTheDocument();
        expect(screen.getByTitle(/redo/i)).toBeInTheDocument();
    });

    it('shows search input', () => {
        render(<MainLayout />);

        const searchInput = screen.getByPlaceholderText(/search resources/i);
        expect(searchInput).toBeInTheDocument();
    });

    it('displays sidebar with resource tree', () => {
        render(<MainLayout />);

        expect(screen.getByText('Services')).toBeInTheDocument();
        expect(screen.getByText('Networks')).toBeInTheDocument();
        expect(screen.getByText('Volumes')).toBeInTheDocument();
    });

    it('shows Add Service button', () => {
        render(<MainLayout />);

        expect(screen.getByText('Add Service')).toBeInTheDocument();
    });

    it('shows From Template button', () => {
        render(<MainLayout />);

        expect(screen.getByText('From Template')).toBeInTheDocument();
    });

    it('switches to Build view when Build button clicked', async () => {
        render(<MainLayout />);

        const buildButton = screen.getByText('Build');
        fireEvent.click(buildButton);

        await waitFor(() => {
            expect(screen.getByTestId('visual-builder')).toBeInTheDocument();
        });
    });

    it('switches to Diagram view when View button clicked', async () => {
        render(<MainLayout />);

        const viewButton = screen.getByText('View');
        fireEvent.click(viewButton);

        await waitFor(() => {
            expect(screen.getByTestId('graphviz-diagram')).toBeInTheDocument();
        });
    });

    it('switches to Compare view when Compare button clicked', async () => {
        render(<MainLayout />);

        const compareButton = screen.getByText('Compare');
        fireEvent.click(compareButton);

        await waitFor(() => {
            expect(screen.getByTestId('compare-view')).toBeInTheDocument();
        });
    });

    it('shows Editor view by default', () => {
        render(<MainLayout />);

        // Editor view should show resource selection prompt
        expect(screen.getByText(/select a resource/i)).toBeInTheDocument();
    });

    it('shows file drag and drop area in Editor view', () => {
        render(<MainLayout />);

        expect(screen.getByText(/drag & drop/i)).toBeInTheDocument();
    });

    it('shows project name input in sidebar', () => {
        render(<MainLayout />);

        const projectInput = screen.getByPlaceholderText(/project name/i);
        expect(projectInput).toBeInTheDocument();
    });

    it('allows typing in project name input', () => {
        render(<MainLayout />);

        const projectInput = screen.getByPlaceholderText(/project name/i);
        fireEvent.change(projectInput, { target: { value: 'My Project' } });

        expect(projectInput.value).toBe('My Project');
    });

    it('shows Clear All button', () => {
        render(<MainLayout />);

        expect(screen.getByText('Clear All')).toBeInTheDocument();
    });

    it('shows Docker Compose spec compliance badge', () => {
        render(<MainLayout />);

        expect(screen.getByText(/compose spec/i)).toBeInTheDocument();
    });

    it('shows code preview panel in Editor view on desktop', () => {
        render(<MainLayout />);

        // Code preview should be rendered (may appear multiple times on mobile/desktop)
        const codeHeaders = screen.queryAllByText(/docker-compose.yml/i);
        expect(codeHeaders.length).toBeGreaterThan(0);
    });
});
