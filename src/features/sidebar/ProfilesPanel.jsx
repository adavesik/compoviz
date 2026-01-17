import { useMemo, useState } from 'react';
import { Layers, Check, Search } from 'lucide-react';
import { useCompose } from '../../hooks/useCompose.jsx';

export const ProfilesPanel = () => {
    const { profiles, activeProfiles, setActiveProfiles, profileCounts } = useCompose();
    const [expanded, setExpanded] = useState(false);
    const [query, setQuery] = useState('');

    const filteredProfiles = useMemo(() => {
        const normalized = query.trim().toLowerCase();
        if (!normalized) return profiles;
        return profiles.filter((profile) => profile.toLowerCase().includes(normalized));
    }, [profiles, query]);

    const toggleProfile = (profile) => {
        if (activeProfiles.includes(profile)) {
            setActiveProfiles(activeProfiles.filter((p) => p !== profile));
        } else {
            setActiveProfiles([...activeProfiles, profile]);
        }
    };

    const selectAll = () => hasProfiles && setActiveProfiles([...profiles]);
    const clearAll = () => hasProfiles && setActiveProfiles([]);
    const hasProfiles = profiles.length > 0;

    return (
        <div className="rounded-xl border border-cyber-border/50 glass p-3 space-y-3">
            <button
                onClick={() => hasProfiles && setExpanded(!expanded)}
                className={`w-full flex items-center justify-between text-sm font-medium ${hasProfiles ? 'text-cyber-text' : 'text-cyber-text-muted cursor-not-allowed'}`}
            >
                <span className="flex items-center gap-2">
                    <Layers size={14} className="text-cyber-accent" />
                    Profiles
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyber-accent/20 text-cyber-accent">
                    {activeProfiles.length}/{profiles.length}
                </span>
            </button>

            {expanded && (
                <div className="space-y-3">
                    {hasProfiles ? (
                        <>
                            <div className="flex items-center gap-2">
                                <button onClick={selectAll} className="btn btn-secondary text-xs py-1 px-2">Select All</button>
                                <button onClick={clearAll} className="btn btn-secondary text-xs py-1 px-2">Clear</button>
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

                            <div className="space-y-2 max-h-48 overflow-auto pr-1">
                                {filteredProfiles.length === 0 ? (
                                    <div className="px-2 py-3 text-xs text-cyber-text-muted text-center">
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
                                                className={`w-full flex items-center justify-between gap-3 px-2 py-2 rounded-lg transition-all ${isActive ? 'bg-cyber-accent/15 border border-cyber-accent/40' : 'hover:bg-cyber-surface-light border border-transparent'}`}
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

                            <p className="text-[11px] text-cyber-text-muted">
                                Unprofiled services always remain visible.
                            </p>
                        </>
                    ) : (
                        <div className="text-xs text-cyber-text-muted">No profiles detected in the loaded compose files.</div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ProfilesPanel;
