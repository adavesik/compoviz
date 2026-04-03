import { AlertCircle, CheckCircle, HelpCircle } from 'lucide-react';
import { getErrorHelp } from '../../constants/errorHelp';

/**
 * TextArea with label, tooltip, and error state
 */
export const TextArea = ({ label, value, onChange, placeholder, tooltip, error, rows = 4 }) => (
    <div className="field-group">
        <label className={`field-label ${error ? 'text-error' : ''}`}>
            {error && <AlertCircle size={11} />}
            {label}
            {tooltip && (
                <span className="tooltip" data-tooltip={tooltip}>
                    <HelpCircle size={11} className="text-text-tertiary" />
                </span>
            )}
        </label>
        <textarea
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            rows={rows}
            className={`w-full resize-none ${error ? 'field-error' : ''}`}
        />
        {error && (
            <div className="field-error-help animate-fade-in">
                <div className="flex items-start gap-2">
                    <AlertCircle size={14} className="text-error mt-0.5 flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                        <p className="text-xs font-medium text-error">{error.message}</p>
                        <p className="text-xs text-text-secondary">{getErrorHelp(error.message).explanation}</p>
                        <div className="field-error-solution">
                            <CheckCircle size={12} className="text-success mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-success">{getErrorHelp(error.message).solution}</p>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
);

export default TextArea;
