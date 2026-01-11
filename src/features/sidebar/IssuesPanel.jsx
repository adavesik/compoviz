import { useState } from 'react';
import { AlertCircle } from 'lucide-react';

/**
 * Issues panel for sidebar - shows expandable validation issues
 */
export const IssuesPanel = ({ errors, onSelect }) => {
    const [expanded, setExpanded] = useState(false);

    if (errors.length === 0) return null;

    return (
        <div className="p-3 border-t border-cyber-border/50">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between text-sm text-cyber-warning hover:text-cyber-warning/80 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <AlertCircle size={14} />
                    <span>{errors.length} issue{errors.length !== 1 && 's'} found</span>
                </div>
                <span className="text-xs text-cyber-accent">{expanded ? '▲' : '▼'}</span>
            </button>

            {expanded && (
                <div className="mt-3 space-y-2 max-h-48 overflow-auto animate-fade-in">
                    {errors.map((error, idx) => (
                        <div
                            key={idx}
                            onClick={() => onSelect({ type: error.entity + 's', name: error.name })}
                            className={`p-2 rounded-lg border cursor-pointer transition-all hover:brightness-110 ${error.type === 'error'
                                    ? 'bg-cyber-error/10 border-cyber-error/30'
                                    : 'bg-cyber-warning/10 border-cyber-warning/30'
                                }`}
                        >
                            <div className="flex items-start gap-2">
                                {error.type === 'error' ? (
                                    <AlertCircle size={12} className="text-cyber-error mt-0.5" />
                                ) : (
                                    <AlertCircle size={12} className="text-cyber-warning mt-0.5" />
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium truncate">{error.message}</p>
                                    <p className="text-xs text-cyber-text-muted mt-0.5">
                                        {error.entity}: <span className="text-cyber-accent">{error.name}</span>
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default IssuesPanel;
