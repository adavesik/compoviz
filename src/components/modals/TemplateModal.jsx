import { X, Sparkles } from 'lucide-react';
import { IconButton } from '../ui';
import { serviceTemplates, getTemplateNames } from '../../data/templates';
import { getServiceIcon, renderServiceIcon } from '../../utils/iconUtils.jsx';

/**
 * Template selection modal for quickly adding pre-configured services
 */
export const TemplateModal = ({ onSelect, onClose }) => {
    const templates = getTemplateNames();

    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 modal-backdrop"
            onClick={onClose}
        >
            <div
                className="glass rounded-2xl p-6 max-w-lg w-full max-h-[80vh] overflow-auto modal-content"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Sparkles className="text-accent" />Service Templates
                    </h2>
                    <IconButton icon={X} onClick={onClose} />
                </div>
                <p className="text-sm text-text-secondary mb-4">Quickly add pre-configured services to your stack.</p>
                <div className="grid grid-cols-2 gap-3">
                    {templates.map(name => {
                        const template = serviceTemplates[name];
                        const iconData = getServiceIcon(name, template?.config?.image);

                        return (
                            <button
                                key={name}
                                onClick={() => onSelect(name)}
                                className="p-4 glass-light rounded-xl text-left hover:bg-surface-raised transition-all group"
                            >
                                <div className="text-2xl mb-2">{renderServiceIcon(iconData, 'w-8 h-8')}</div>
                                <div className="font-semibold capitalize group-hover:text-accent transition-colors">{name}</div>
                                <div className="text-xs text-text-secondary mt-1">
                                    {template?.config?.image || 'Custom build'}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default TemplateModal;
