import { Plus, Trash2, AlertCircle, CheckCircle } from 'lucide-react';
import { IconButton } from './IconButton';
import { getErrorHelp } from '../../constants/errorHelp';

/**
 * Array editor for lists (ports, volumes, etc.) with inline error help
 */
export const ArrayEditor = ({ label, value = [], onChange, placeholder = 'Value', error }) => {
    const addItem = () => onChange([...value, '']);
    const updateItem = (i, v) => { const n = [...value]; n[i] = v; onChange(n); };
    const removeItem = (i) => onChange(value.filter((_, idx) => idx !== i));

    return (
        <div className="field-group">
            <div className="flex items-center justify-between">
                <label className={`field-label ${error ? 'text-error' : ''}`}>
                    {error && <AlertCircle size={11} />}
                    {label}
                </label>
                <button onClick={addItem} className="field-add-btn">
                    <Plus size={12} />Add
                </button>
            </div>
            {value.length > 0 && (
                <div className="space-y-1.5">
                    {value.map((v, i) => (
                        <div key={i} className="kv-row">
                            <input
                                className={`flex-1 text-xs ${error ? 'field-error' : ''}`}
                                placeholder={placeholder}
                                value={v}
                                onChange={e => updateItem(i, e.target.value)}
                            />
                            <IconButton icon={Trash2} onClick={() => removeItem(i)} variant="danger" size="sm" />
                        </div>
                    ))}
                </div>
            )}
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
};

export default ArrayEditor;
