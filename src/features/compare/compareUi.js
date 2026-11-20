import { AlertTriangle, Info, XCircle } from 'lucide-react';
import { PROJECT_COLORS } from '../../utils/graphviz';

export const CATEGORY_LABELS = {
    port: 'Port',
    container_name: 'Container name',
    project_name: 'Project name',
    volume: 'Volume',
    network: 'Network',
    env_file: 'Env file',
    service_name: 'Service name',
};

export const SEVERITY_META = {
    error: {
        label: 'Errors',
        icon: XCircle,
        text: 'text-error',
        card: 'bg-error/10 border-error/30',
        cardActive: 'bg-error/20 border-error ring-1 ring-error/60',
        chip: 'bg-error/15 text-error border-error/40',
    },
    warning: {
        label: 'Warnings',
        icon: AlertTriangle,
        text: 'text-warning',
        card: 'bg-warning/10 border-warning/30',
        cardActive: 'bg-warning/20 border-warning ring-1 ring-warning/60',
        chip: 'bg-warning/15 text-warning border-warning/40',
    },
    info: {
        label: 'Info',
        icon: Info,
        text: 'text-sky-300',
        card: 'bg-sky-400/5 border-sky-400/20',
        cardActive: 'bg-sky-400/15 border-sky-400 ring-1 ring-sky-400/50',
        chip: 'bg-sky-400/10 text-sky-300 border-sky-400/30',
    },
};

/** Color of a project, matching its cluster in the diagram. */
export const projectColor = (projects, projectId) => {
    const idx = projects.findIndex(p => p.id === projectId);
    return PROJECT_COLORS[(idx < 0 ? 0 : idx) % PROJECT_COLORS.length].border;
};

export const isSameSelection = (a, b) => {
    if (!a || !b || a.type !== b.type) return false;
    if (a.type === 'service') return a.projectId === b.projectId && a.service === b.service;
    if (a.type === 'result') return a.resultId === b.resultId;
    if (a.type === 'project') return a.projectId === b.projectId;
    return false;
};

/** Trigger a file download in the browser. */
export const downloadText = (text, fileName, mime = 'text/yaml') => {
    const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
};
