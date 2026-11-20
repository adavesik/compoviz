/**
 * Feature announcements for "What's New" modal
 * Add new announcements at the top of the array
 *
 * Three formats supported:
 * - hero: hero image + feature grid (layout: 'hero')
 * - slides: array of slide objects (carousel mode)
 * - highlights: array of highlight objects (single-screen mode)
 *
 * Hero format:
 * - icon: lucide icon key, see ICONS in WhatsNewModal.jsx
 * - tone: 'error' | 'accent' | 'secret' | 'config' | 'success'
 * - descriptions may wrap inline code in backticks
 * - action types: 'dismiss' | 'open-compare-demo' | 'load-example' | 'link' (opens href)
 *
 * The modal shows the first entry once per `version`.
 */

export const announcements = [
    {
        version: '1.0.0',
        date: '2026-11-20',
        layout: 'hero',
        badge: 'First stable release',
        hero: {
            src: '/assets/whats-new/compare-v1.webp',
            alt: 'Compare mode showing a host port 8080 collision between the shop and blog stacks, with a suggested fix that moves blog/web to port 8081.',
        },
        eyebrow: 'Compare, rebuilt',
        title: 'Compoviz',
        titleAccent: '1.0',
        lede: 'Drop in up to three Compose stacks and find out whether they can share one Docker host. When they can\'t, Compoviz shows exactly why and fixes it for you.',
        features: [
            {
                icon: 'scan-search',
                tone: 'error',
                title: 'Sharper detection',
                description: 'Wildcard IPs, protocols and port ranges are checked properly, ephemeral ports are ignored. Catches project-name collisions and project-scoped networks and volumes.',
            },
            {
                icon: 'sparkles',
                tone: 'accent',
                title: 'One-click fixes',
                description: 'Remap ports, rename containers, split bind mounts or share a network. Every fix shows a diff first, `Ctrl+Z` undoes it, and fixed files download in one go.',
            },
            {
                icon: 'network',
                tone: 'secret',
                title: 'Conflicts on the map',
                description: 'Port chips on every service and dedicated conflict nodes show who claims what. Shared and isolated resources get their own lane.',
            },
            {
                icon: 'mouse-pointer-click',
                tone: 'config',
                title: 'Inspect anything',
                description: 'Click a service, issue or project for details. Right-click for quick fixes, `J`/`K` to step through issues, smooth zoom and fit-to-view.',
            },
        ],
        also: {
            icon: 'heart-pulse',
            tone: 'success',
            label: 'Also new',
            title: 'Healthcheck intelligence',
            description: 'flags missing, fake and weak healthchecks, and `service_healthy` dependencies that can never start.',
        },
        primaryAction: {
            label: 'Try the Compare demo',
            type: 'open-compare-demo',
        },
        secondaryAction: {
            label: 'Release notes',
            type: 'link',
            href: 'https://github.com/adavesik/compoviz/releases',
        },
    },
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
 * Check if user should see the announcement with the given version.
 * Keyed by announcement version (not app version) so patch releases
 * without a new announcement don't re-show the previous one.
 */
export function shouldShowAnnouncement(announcementVersion) {
    const lastSeenVersion = localStorage.getItem('lastSeenAnnouncementVersion');

    if (!lastSeenVersion) {
        return true;
    }

    return announcementVersion !== lastSeenVersion;
}

/**
 * Mark announcement as seen
 */
export function markAnnouncementAsSeen(version) {
    localStorage.setItem('lastSeenAnnouncementVersion', version);
}
