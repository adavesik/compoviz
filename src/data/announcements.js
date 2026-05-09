/**
 * Feature announcements for "What's New" modal
 * Add new announcements at the top of the array
 *
 * Two formats supported:
 * - slides: array of slide objects (carousel mode)
 * - highlights: array of highlight objects (single-screen mode)
 */

export const announcements = [
    {
        version: '0.5.0',
        date: '2026-05-09',
        highlights: [
            {
                emoji: '🧭',
                title: 'awesome-compose Gallery',
                description: 'Browse and visualize 40+ production-ready stacks from Docker\'s official awesome-compose repo — on-demand, no setup.',
            },
            {
                emoji: '🐳',
                title: 'Dockerfile Enrichment',
                description: 'Services with build: now show their actual base image (FROM) and exposed ports, resolved automatically from Dockerfiles.',
            },
            {
                emoji: '🔍',
                title: 'Search & Filter',
                description: 'Find examples fast with category filtering and full-text search across the entire awesome-compose library.',
            },
            {
                emoji: '⚡',
                title: 'Zero-Bundle Fetching',
                description: 'Examples load on-demand from GitHub — nothing bundled, always fresh, works offline with curated fallbacks.',
            },
        ],
        action: {
            label: 'Explore Examples',
            type: 'dismiss',
        },
    },
    {
        version: '0.4.0',
        date: '2026-04-03',
        // Single-screen mode: no slides, just highlights
        highlights: [
            {
                emoji: '🎨',
                title: 'New Design System',
                description: 'Warm charcoal palette with amber accents, Satoshi + Instrument Serif typography, and refined surfaces throughout.',
            },
            {
                emoji: '🚀',
                title: 'Hero Empty State',
                description: 'A proper landing experience with "Try a Demo" that loads a live example instantly.',
            },
            {
                emoji: '🔔',
                title: 'Toast Notifications',
                description: 'No more browser alerts. Errors and confirmations now appear as elegant, auto-dismissing toasts.',
            },
            {
                emoji: '✏️',
                title: 'Polished Editor',
                description: 'Cleaner form fields, collapsible sections with colored accents, and a code preview with line numbers.',
            },
            {
                emoji: '🧩',
                title: 'Builder Upgrades',
                description: 'Nodes animate in, handles appear on hover, and selected nodes glow with type-colored rings.',
            },
        ],
        action: {
            label: 'Explore',
            type: 'dismiss',
        },
    },
    {
        version: '0.3.0',
        date: '2026-01-17',
        slides: [
            {
                id: 'anchor-resolution',
                emoji: '🔗',
                title: 'Smart Anchor Resolution',
                description: 'Stop copying and pasting the same config blocks. Compoviz fully supports YAML anchors (&anchor) and aliases (*alias) to keep your Compose files DRY. Define once, reuse everywhere - and see the resolved configuration instantly.',
                screenshot: '/assets/whats-new/anchor-resolution.gif',
                action: {
                    label: 'Try It',
                    type: 'load-example',
                    data: 'anchor-demo'
                }
            },
            {
                id: 'includes-extends',
                emoji: '🧩',
                title: 'Smart Inheritance & Includes',
                description: "Currently, Compoviz parser supports the full Docker Spec. Compoviz now correctly handles include directives and extends hierarchies - merging ports, volumes, and networks exactly like Docker does.",
                screenshot: '/assets/whats-new/includes-extends.png',
                action: {
                    label: 'Try It',
                    type: 'load-example',
                    data: 'multi-file-project'
                }
            },
            {
                id: 'profiles',
                emoji: '🎯',
                title: 'Dev vs. Prod Views',
                description: 'Filter out the noise. Use the new Profile Selector to toggle between service profiles (e.g., dev, test, prod) and see exactly which containers spin up in each environment.',
                screenshot: '/assets/whats-new/profiles.gif',
                action: {
                    label: 'Try It',
                    type: 'load-example',
                    data: 'profiles-demo'
                }
            },
            {
                id: 'performance',
                emoji: '⚡',
                title: 'High-Performance Parsing',
                description: 'Compoviz runs on a new Web Worker architecture. Parse massive multi-file projects with 50+ services without freezing your browser.',
                screenshot: '/assets/whats-new/performance.png',
                action: {
                    label: 'Try It',
                    type: 'load-example',
                    data: '50-services'
                }
            }
        ]
    }
];

/**
 * Get the latest announcement
 */
export function getLatestAnnouncement() {
    return announcements[0];
}

/**
 * Check if user should see announcement for current version
 */
export function shouldShowAnnouncement(appVersion) {
    const lastSeenVersion = localStorage.getItem('lastSeenAnnouncementVersion');

    if (!lastSeenVersion) {
        return true;
    }

    return appVersion !== lastSeenVersion;
}

/**
 * Mark announcement as seen
 */
export function markAnnouncementAsSeen(version) {
    localStorage.setItem('lastSeenAnnouncementVersion', version);
}
