import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { render } from '../../test/utils.jsx';
import { CodePreview } from './CodePreview.jsx';

describe('CodePreview Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders without crashing', () => {
        const { container } = render(<CodePreview />);
        expect(container).toBeTruthy();
    });

    it('shows docker-compose.yml label', () => {
        render(<CodePreview />);
        expect(screen.getByText(/docker-compose.yml/i)).toBeInTheDocument();
    });

    it('shows action buttons', () => {
        const { container } = render(<CodePreview />);

        // Should have buttons
        const buttons = container.querySelectorAll('button');
        expect(buttons.length).toBeGreaterThan(0);
    });

    it('displays YAML code', () => {
        const { container } = render(<CodePreview />);

        // Should have code preview area
        const codeArea = container.querySelector('.code-preview') ||
            container.querySelector('[class*="code"]') ||
            container.querySelector('pre');
        expect(codeArea).toBeTruthy();
    });

    it('has file input for import', () => {
        const { container } = render(<CodePreview />);

        const fileInput = container.querySelector('input[type="file"]');
        expect(fileInput).toBeTruthy();
    });
});
