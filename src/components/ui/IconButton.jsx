import React from 'react';
/**
 * Icon button component with variants
 * @param {React.ComponentType} icon - Lucide icon component
 * @param {() => void} onClick - Click handler
 * @param {string} title - Button title/tooltip
 * @param {'default' | 'danger'} variant - Button variant
 * @param {'sm' | 'md'} size - Button size
 * @param {boolean} disabled - Disabled state
 */
export const IconButton = ({
    icon: Icon,
    onClick,
    title,
    variant = 'default',
    size = 'md',
    disabled = false
}) => (
    <button
        onClick={onClick}
        title={title}
        disabled={disabled}
        className={`p-${size === 'sm' ? '1' : '2'} rounded-lg transition-all duration-200 ${disabled ? 'opacity-40 cursor-not-allowed' : ''
            } ${variant === 'danger'
                ? 'hover:bg-error/20 text-text-secondary hover:text-error'
                : 'hover:bg-surface-raised text-text-secondary hover:text-accent'
            }`}
    >
        <Icon size={size === 'sm' ? 14 : 18} />
    </button>
);

export default IconButton;
