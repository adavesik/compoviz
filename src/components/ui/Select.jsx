import { HelpCircle } from 'lucide-react';

/**
 * Select dropdown with label and tooltip
 */
export const Select = ({ label, value, onChange, options, placeholder, tooltip }) => (
    <div className="field-group">
        <label className="field-label">
            {label}
            {tooltip && (
                <span className="tooltip" data-tooltip={tooltip}>
                    <HelpCircle size={11} className="text-text-tertiary" />
                </span>
            )}
        </label>
        <select value={value || ''} onChange={e => onChange(e.target.value)} className="w-full">
            {placeholder && <option value="">{placeholder}</option>}
            {options.map(opt => (
                <option key={typeof opt === 'string' ? opt : opt.value} value={typeof opt === 'string' ? opt : opt.value}>
                    {typeof opt === 'string' ? opt : opt.label}
                </option>
            ))}
        </select>
    </div>
);

export default Select;
