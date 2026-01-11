import React, { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';

/**
 * Panel-specific form input components
 * These have different styling than the main editor UI components
 */

export const Input = ({ label, value, onChange, placeholder, tooltip, multiline = false, code = false }) => (
    <div className="config-field">
        <label className="config-label">
            {label}
            {tooltip && <span className="config-tooltip" title={tooltip}>?</span>}
        </label>
        {multiline ? (
            <textarea
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className={`config-input config-textarea ${code ? 'font-mono text-sm' : ''}`}
                rows={3}
            />
        ) : (
            <input
                type="text"
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className={`config-input ${code ? 'font-mono text-sm' : ''}`}
            />
        )}
    </div>
);

export const Select = ({ label, value, onChange, options, placeholder, tooltip }) => (
    <div className="config-field">
        <label className="config-label">
            {label}
            {tooltip && <span className="config-tooltip" title={tooltip}>?</span>}
        </label>
        <select
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className="config-input"
        >
            {placeholder && <option value="">{placeholder}</option>}
            {options.map((opt) => (
                <option key={typeof opt === 'string' ? opt : opt.value} value={typeof opt === 'string' ? opt : opt.value}>
                    {typeof opt === 'string' ? opt : opt.label}
                </option>
            ))}
        </select>
    </div>
);

export const Checkbox = ({ label, checked, onChange, tooltip }) => (
    <label className="config-checkbox">
        <input
            type="checkbox"
            checked={checked || false}
            onChange={(e) => onChange(e.target.checked)}
            className="config-checkbox-input"
        />
        <span>{label}</span>
        {tooltip && <span className="config-tooltip" title={tooltip}>?</span>}
    </label>
);

export const ArrayEditor = ({ label, value = [], onChange, placeholder, tooltip }) => {
    const addItem = () => onChange([...value, '']);
    const updateItem = (i, v) => { const n = [...value]; n[i] = v; onChange(n); };
    const removeItem = (i) => onChange(value.filter((_, idx) => idx !== i));

    return (
        <div className="config-field">
            <div className="flex items-center justify-between mb-2">
                <label className="config-label mb-0">
                    {label}
                    {tooltip && <span className="config-tooltip" title={tooltip}>?</span>}
                </label>
                <button onClick={addItem} className="config-add-btn">
                    <Plus size={12} /> Add
                </button>
            </div>
            <div className="space-y-2">
                {value.map((v, i) => (
                    <div key={i} className="flex gap-2">
                        <input
                            className="config-input flex-1"
                            placeholder={placeholder}
                            value={v}
                            onChange={(e) => updateItem(i, e.target.value)}
                        />
                        <button onClick={() => removeItem(i)} className="config-remove-btn">
                            <Trash2 size={14} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export const KeyValueEditor = ({ label, value = {}, onChange, keyPlaceholder = 'Key', valuePlaceholder = 'Value', tooltip }) => {
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
    const removeEntry = (key) => { const { [key]: _, ...rest } = value; onChange(rest); };

    return (
        <div className="config-field">
            <div className="flex items-center justify-between mb-2">
                <label className="config-label mb-0">
                    {label}
                    {tooltip && <span className="config-tooltip" title={tooltip}>?</span>}
                </label>
                <button onClick={addEntry} className="config-add-btn">
                    <Plus size={12} /> Add
                </button>
            </div>
            <div className="space-y-2">
                {entries.map(([k, v], i) => (
                    <div key={i} className="flex gap-2">
                        <input
                            className="config-input flex-1"
                            placeholder={keyPlaceholder}
                            value={k}
                            onChange={(e) => updateKey(k, e.target.value)}
                        />
                        <input
                            className="config-input flex-1"
                            placeholder={valuePlaceholder}
                            value={v}
                            onChange={(e) => updateValue(k, e.target.value)}
                        />
                        <button onClick={() => removeEntry(k)} className="config-remove-btn">
                            <Trash2 size={14} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export const MultiSelect = ({ label, options, selected = [], onChange, tooltip }) => (
    <div className="config-field">
        <label className="config-label">
            {label}
            {tooltip && <span className="config-tooltip" title={tooltip}>?</span>}
        </label>
        <div className="config-multi-select">
            {options.map((opt) => (
                <label key={opt} className="config-multi-option">
                    <input
                        type="checkbox"
                        checked={selected.includes(opt)}
                        onChange={(e) => {
                            if (e.target.checked) {
                                onChange([...selected, opt]);
                            } else {
                                onChange(selected.filter((s) => s !== opt));
                            }
                        }}
                    />
                    <span>{opt}</span>
                </label>
            ))}
        </div>
    </div>
);

export const Section = ({ title, icon: Icon, children, defaultOpen = false, highlight = false }) => {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <div className={`config-section ${highlight ? 'config-section-highlight' : ''}`}>
            <button
                className="config-section-header"
                onClick={() => setOpen(!open)}
            >
                <div className="flex items-center gap-2">
                    <Icon size={16} className="text-cyber-accent" />
                    <span>{title}</span>
                </div>
                {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            {open && (
                <div className="config-section-content">
                    {children}
                </div>
            )}
        </div>
    );
};
