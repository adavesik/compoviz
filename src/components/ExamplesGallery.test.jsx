import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ExamplesGallery from './ExamplesGallery';
import ExampleCard from './ExampleCard';
import { galleryExamples } from '../data/examplesGallery';

// Mock the GitHub fetcher to avoid real network calls
vi.mock('../utils/githubExamples', () => ({
    fetchRemoteExamplesList: vi.fn().mockResolvedValue([]),
    fetchRemoteExampleYaml: vi.fn().mockResolvedValue('services:\n  web:\n    image: nginx'),
    fetchRemoteExampleDescription: vi.fn().mockResolvedValue(null),
    clearCache: vi.fn(),
}));

const mockExample = {
    id: 'test-example',
    name: 'Test Example',
    description: 'A test compose example for unit testing.',
    category: 'fullstack',
    tags: ['nginx', 'node', 'postgres'],
    serviceCount: 3,
    source: 'https://github.com/docker/awesome-compose/tree/master/test',
    yaml: 'services:\n  web:\n    image: nginx\n  api:\n    image: node\n  db:\n    image: postgres'
};

describe('ExampleCard', () => {
    it('renders with correct data', () => {
        const onSelect = vi.fn();
        render(<ExampleCard example={mockExample} onSelect={onSelect} />);

        expect(screen.getByText('Test Example')).toBeInTheDocument();
        expect(screen.getByText('A test compose example for unit testing.')).toBeInTheDocument();
        expect(screen.getByText('fullstack')).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('displays technology tags', () => {
        const onSelect = vi.fn();
        render(<ExampleCard example={mockExample} onSelect={onSelect} />);

        expect(screen.getByText('nginx')).toBeInTheDocument();
        expect(screen.getByText('node')).toBeInTheDocument();
        expect(screen.getByText('postgres')).toBeInTheDocument();
    });

    it('triggers onSelect callback when clicked', () => {
        const onSelect = vi.fn();
        render(<ExampleCard example={mockExample} onSelect={onSelect} />);

        fireEvent.click(screen.getByRole('button'));
        expect(onSelect).toHaveBeenCalledWith(mockExample);
    });

    it('limits displayed tags to 3', () => {
        const manyTags = { ...mockExample, tags: ['a', 'b', 'c', 'd', 'e'] };
        const onSelect = vi.fn();
        render(<ExampleCard example={manyTags} onSelect={onSelect} />);

        expect(screen.getByText('a')).toBeInTheDocument();
        expect(screen.getByText('b')).toBeInTheDocument();
        expect(screen.getByText('c')).toBeInTheDocument();
        expect(screen.queryByText('d')).not.toBeInTheDocument();
    });
});

describe('ExamplesGallery', () => {
    it('renders nothing when closed', () => {
        const { container } = render(
            <ExamplesGallery open={false} onClose={vi.fn()} onSelect={vi.fn()} />
        );
        expect(container.innerHTML).toBe('');
    });

    it('renders modal when open', () => {
        render(
            <ExamplesGallery open={true} onClose={vi.fn()} onSelect={vi.fn()} />
        );
        expect(screen.getByText('Explore Examples')).toBeInTheDocument();
    });

    it('renders list of example cards', () => {
        render(
            <ExamplesGallery open={true} onClose={vi.fn()} onSelect={vi.fn()} />
        );

        // Should render all gallery examples by default (category 'all')
        for (const example of galleryExamples) {
            expect(screen.getByText(example.name)).toBeInTheDocument();
        }
    });

    it('category filtering works', () => {
        render(
            <ExamplesGallery open={true} onClose={vi.fn()} onSelect={vi.fn()} />
        );

        // Click on 'monitoring' filter
        fireEvent.click(screen.getByRole('tab', { name: /monitoring/i }));

        // Should show monitoring examples
        const monitoringExamples = galleryExamples.filter(e => e.category === 'monitoring');
        for (const example of monitoringExamples) {
            expect(screen.getByText(example.name)).toBeInTheDocument();
        }

        // Should NOT show non-monitoring examples
        const nonMonitoring = galleryExamples.filter(e => e.category !== 'monitoring');
        for (const example of nonMonitoring) {
            expect(screen.queryByText(example.name)).not.toBeInTheDocument();
        }
    });

    it('close button calls onClose', () => {
        const onClose = vi.fn();
        render(
            <ExamplesGallery open={true} onClose={onClose} onSelect={vi.fn()} />
        );

        fireEvent.click(screen.getByLabelText('Close gallery'));
        expect(onClose).toHaveBeenCalled();
    });

    it('backdrop click calls onClose', () => {
        const onClose = vi.fn();
        render(
            <ExamplesGallery open={true} onClose={onClose} onSelect={vi.fn()} />
        );

        fireEvent.click(screen.getByRole('dialog'));
        expect(onClose).toHaveBeenCalled();
    });

    it('Escape key calls onClose', () => {
        const onClose = vi.fn();
        render(
            <ExamplesGallery open={true} onClose={onClose} onSelect={vi.fn()} />
        );

        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onClose).toHaveBeenCalled();
    });

    it('onSelect callback fires with YAML when example is clicked', () => {
        const onSelect = vi.fn();
        render(
            <ExamplesGallery open={true} onClose={vi.fn()} onSelect={onSelect} />
        );

        // Click the first example card
        const firstExample = galleryExamples[0];
        fireEvent.click(screen.getByText(firstExample.name));

        expect(onSelect).toHaveBeenCalledWith(firstExample.yaml, firstExample);
    });

    it('shows visualization-only disclaimer', () => {
        render(
            <ExamplesGallery open={true} onClose={vi.fn()} onSelect={vi.fn()} />
        );

        expect(screen.getByText(/visualization only/i)).toBeInTheDocument();
    });

    it('shows empty state for category with no examples', () => {
        render(
            <ExamplesGallery open={true} onClose={vi.fn()} onSelect={vi.fn()} />
        );

        // Click on 'database' filter (no examples in this category currently)
        fireEvent.click(screen.getByRole('tab', { name: /database/i }));
        expect(screen.getByText(/no examples match/i)).toBeInTheDocument();
    });

    it('has proper ARIA attributes', () => {
        render(
            <ExamplesGallery open={true} onClose={vi.fn()} onSelect={vi.fn()} />
        );

        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveAttribute('aria-modal', 'true');
        expect(dialog).toHaveAttribute('aria-labelledby', 'examples-gallery-title');
    });
});
