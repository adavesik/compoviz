/**
 * Feature announcements for "What's New" modal
 * Add new announcements at the top of the array
 */

export const announcements = [
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

    // Simple version comparison (works for semver)
    return appVersion !== lastSeenVersion;
}

/**
 * Mark announcement as seen
 */
export function markAnnouncementAsSeen(version) {
    localStorage.setItem('lastSeenAnnouncementVersion', version);
}
