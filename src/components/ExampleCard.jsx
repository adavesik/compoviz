import { Layers } from 'lucide-react';

/**
 * ExampleCard — Individual card in the gallery representing one compose example.
 * Displays metadata and triggers selection on click.
 * 
 * @param {Object} props
 * @param {import('../data/examplesGallery').ExampleEntry} props.example - The example metadata
 * @param {function} props.onSelect - Callback when this card is clicked
 */
export default function ExampleCard({ example, onSelect }) {
    const { name, description, category, tags, serviceCount } = example;

    return (
        <button
            onClick={() => onSelect(example)}
            className="example-card group p-4 rounded-xl surface-raised text-left transition-all duration-200 hover:bg-surface-overlay border border-transparent hover:border-accent/30 w-full"
        >
            {/* Header: Name + Service Count */}
            <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="text-sm font-semibold text-text group-hover:text-accent transition-colors leading-tight">
                    {name}
                </h3>
                <span className="flex items-center gap-1 text-xs text-text-tertiary shrink-0" title={`${serviceCount} services`}>
                    <Layers size={12} />
                    {serviceCount}
                </span>
            </div>

            {/* Description */}
            <p className="text-xs text-text-secondary leading-relaxed mb-3 line-clamp-2">
                {description}
            </p>

            {/* Footer: Category Badge + Tags */}
            <div className="flex items-center gap-2 flex-wrap">
                <span className={`example-category-badge px-2 py-0.5 text-[10px] font-medium rounded-full ${getCategoryStyle(category)}`}>
                    {category}
                </span>
                {tags.slice(0, 3).map(tag => (
                    <span
                        key={tag}
                        className="px-1.5 py-0.5 text-[10px] text-text-tertiary bg-surface-overlay rounded"
                    >
                        {tag}
                    </span>
                ))}
            </div>
        </button>
    );
}

/**
 * Get category-specific styling classes
 * @param {string} category
 * @returns {string} Tailwind classes
 */
function getCategoryStyle(category) {
    switch (category) {
        case 'fullstack':
            return 'bg-accent-muted text-accent';
        case 'web':
            return 'bg-success-muted text-success';
        case 'backend':
            return 'bg-[rgba(110,159,255,0.15)] text-service';
        case 'monitoring':
            return 'bg-[rgba(179,146,240,0.15)] text-secret';
        case 'database':
            return 'bg-warning-muted text-warning';
        default:
            return 'bg-surface-overlay text-text-secondary';
    }
}
