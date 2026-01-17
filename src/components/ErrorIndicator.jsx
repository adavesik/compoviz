import { useState, useRef, useEffect } from 'react';
import { AlertCircle, X } from 'lucide-react';

/**
 * Header error indicator with dropdown
 * Shows total error/warning count and expandable list
 */
export const ErrorIndicator = ({ errors, onSelect }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    if (errors.length === 0) return null;

    const errorCount = errors.filter(e => e.type === 'error').length;
    const warningCount = errors.filter(e => e.type === 'warning').length;

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Error Indicator Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${isOpen
                        ? 'bg-cyber-error/20 text-cyber-error'
                        : 'hover:bg-cyber-error/10 text-cyber-error/80 hover:text-cyber-error'
                    }`}
                title={`${errorCount} errors, ${warningCount} warnings`}
            >
                <AlertCircle size={16} />
                <span className="text-sm font-medium">{errors.length}</span>
            </button>

            {/* Dropdown Panel */}
            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-80 max-h-96 overflow-auto rounded-xl glass border border-cyber-border/50 shadow-2xl animate-fade-in z-50">
                    {/* Header */}
                    <div className="sticky top-0 flex items-center justify-between px-4 py-3 border-b border-cyber-border/50 bg-cyber-surface/95 backdrop-blur-sm">
                        <div className="flex items-center gap-2">
                            <AlertCircle size={16} className="text-cyber-error" />
                            <span className="font-medium text-sm">Issues Found</span>
                            <span className="text-xs text-cyber-text-muted">
                                {errorCount > 0 && `${errorCount} error${errorCount !== 1 ? 's' : ''}`}
                                {errorCount > 0 && warningCount > 0 && ', '}
                                {warningCount > 0 && `${warningCount} warning${warningCount !== 1 ? 's' : ''}`}
                            </span>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-1 hover:bg-cyber-surface-light rounded transition-colors"
                        >
                            <X size={14} />
                        </button>
                    </div>

                    {/* Error List */}
                    <div className="p-2 space-y-1">
                        {errors.map((error, idx) => {
                            const canSelect = error.entity && error.name && error.entity !== 'parser';
                            return (
                            <div
                                key={idx}
                                onClick={() => {
                                    if (!canSelect) return;
                                    onSelect({ type: error.entity + 's', name: error.name });
                                    setIsOpen(false);
                                }}
                                className={`p-3 rounded-lg border transition-all hover:brightness-110 ${canSelect ? 'cursor-pointer' : 'cursor-default'} ${error.type === 'error'
                                        ? 'bg-cyber-error/10 border-cyber-error/30 hover:bg-cyber-error/15'
                                        : 'bg-cyber-warning/10 border-cyber-warning/30 hover:bg-cyber-warning/15'
                                    }`}
                            >
                                <div className="flex items-start gap-2">
                                    <AlertCircle
                                        size={14}
                                        className={`mt-0.5 ${error.type === 'error' ? 'text-cyber-error' : 'text-cyber-warning'}`}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium line-clamp-2">{error.message}</p>
                                        {error.entity && error.name && (
                                            <p className="text-xs text-cyber-text-muted mt-1">
                                                {error.entity}: <span className="text-cyber-accent">{error.name}</span>
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ErrorIndicator;
