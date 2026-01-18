import { useMemo, useRef, useState, useEffect } from 'react';
import { Layers, Check, X, Search } from 'lucide-react';
import { useCompose } from '../hooks/useCompose.jsx';

export const ProfileSelector = () => {
    const { profiles, activeProfiles, setActiveProfiles, profileCounts } = useCompose();
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const dropdownRef = useRef(null);

    const filteredProfiles = useMemo(() => {
        const normalized = query.trim().toLowerCase();
        if (!normalized) return profiles;
        return profiles.filter((profile) => profile.toLowerCase().includes(normalized));
    }, [profiles, query]);

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

    const toggleProfile = (profile) => {
        if (activeProfiles.includes(profile)) {
            setActiveProfiles(activeProfiles.filter((p) => p !== profile));
        } else {
            setActiveProfiles([...activeProfiles, profile]);
        }
    };

    const selectAll = () => setActiveProfiles([...profiles]);
    const clearAll = () => setActiveProfiles([]);

    const hasProfiles = profiles.length > 0;
    const activeLabel = activeProfiles.length > 0 ? activeProfiles.join(', ') : 'None';

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => hasProfiles && setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${hasProfiles ? 'hover:bg-cyber-surface-light text-cyber-text' : 'text-cyber-text-muted cursor-not-allowed'} ${isOpen ? 'bg-cyber-surface-light' : ''}`}
                title={hasProfiles ? 'Filter services by profile' : 'No profiles detected in this compose file'}
            >
                <Layers size={16} className="text-cyber-accent" />
                <span className="text-sm font-medium">Profiles</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyber-accent/20 text-cyber-accent">
                    {activeProfiles.length}
                </span>
            </button>

            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-80 rounded-xl glass border border-cyber-border/50 shadow-2xl animate-fade-in z-50">
                    <div className="p-3 border-b border-cyber-border/50 space-y-2">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium">Active profiles</p>
                                <p className="text-xs text-cyber-text-muted truncate max-w-[220px]">{activeLabel}</p>
                            </div>
                            <div className="flex items-center gap-1">
                                <button onClick={selectAll} className="btn btn-secondary text-xs py-1 px-2">Select All</button>
                                <button onClick={clearAll} className="btn btn-secondary text-xs py-1 px-2">Clear</button>
                            </div>
                        </div>
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-cyber-text-muted" />
                            <input
                                type="text"
                                placeholder="Filter profiles..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                className="pl-8 pr-3 py-2 w-full text-sm"
                            />
                        </div>
                        <p className="text-[11px] text-cyber-text-muted">
                            Services without profiles remain visible regardless of selection.
                        </p>
                    </div>

                    <div className="max-h-64 overflow-auto p-2">
                        {filteredProfiles.length === 0 ? (
                            <div className="px-3 py-4 text-xs text-cyber-text-muted text-center">
                                No profiles match your filter.
                            </div>
                        ) : (
                            filteredProfiles.map((profile) => {
                                const isActive = activeProfiles.includes(profile);
                                const count = profileCounts?.[profile] || 0;
                                return (
                                    <button
                                        key={profile}
                                        onClick={() => toggleProfile(profile)}
                                        className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg transition-all ${isActive ? 'bg-cyber-accent/15 border border-cyber-accent/40' : 'hover:bg-cyber-surface-light border border-transparent'}`}
                                    >
                                        <span className="flex items-center gap-2 text-sm">
                                            <span className={`w-4 h-4 rounded border flex items-center justify-center ${isActive ? 'bg-cyber-accent border-cyber-accent' : 'border-cyber-border/60'}`}>
                                                {isActive && <Check size={12} className="text-white" />}
                                            </span>
                                            {profile}
                                        </span>
                                        <span className="text-xs text-cyber-text-muted">{count} svc</span>
                                    </button>
                                );
                            })
                        )}
                    </div>

                    <div className="p-2 border-t border-cyber-border/50">
                        <button onClick={() => setIsOpen(false)} className="w-full btn btn-secondary text-xs py-1 flex items-center justify-center gap-2">
                            <X size={12} />
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProfileSelector;
