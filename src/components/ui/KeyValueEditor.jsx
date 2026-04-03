import { Plus, Trash2 } from 'lucide-react';
import { IconButton } from './IconButton';

/**
 * Key-Value pair editor with cleaner grid layout
 */
export const KeyValueEditor = ({
    label,
    value = {},
    onChange,
    keyPlaceholder = 'Key',
    valuePlaceholder = 'Value'
}) => {
    const entries = Object.entries(value);

    const addEntry = () => onChange({ ...value, '': '' });

    const updateKey = (oldKey, newKey) => {
        const newVal = { ...value };
        const v = newVal[oldKey];
        delete newVal[oldKey];
        newVal[newKey] = v;
        onChange(newVal);
    };

    const updateValue = (key, newValue) => onChange({ ...value, [key]: newValue });

    const removeEntry = (key) => {
        const { [key]: _, ...rest } = value;
        onChange(rest);
    };

    return (
        <div className="field-group">
            <div className="flex items-center justify-between">
                <label className="field-label">{label}</label>
                <button onClick={addEntry} className="field-add-btn">
                    <Plus size={12} />Add
                </button>
            </div>
            {entries.length > 0 && (
                <div className="space-y-1.5">
                    {entries.map(([k, v], i) => (
                        <div key={i} className="kv-row">
                            <input className="flex-1 text-xs" placeholder={keyPlaceholder} value={k} onChange={e => updateKey(k, e.target.value)} />
                            <input className="flex-1 text-xs" placeholder={valuePlaceholder} value={v} onChange={e => updateValue(k, e.target.value)} />
                            <IconButton icon={Trash2} onClick={() => removeEntry(k)} variant="danger" size="sm" />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default KeyValueEditor;
