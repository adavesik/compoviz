/**
 * Badge component for status indicators
 * @param {'error' | 'warning' | 'success'} type - Badge type
 * @param {React.ReactNode} children - Badge content
 */
export const Badge = ({ type, children }) => (
    <span
        className={`px-2 py-0.5 text-xs rounded-full ${type === 'error'
                ? 'bg-error/20 text-error'
                : type === 'warning'
                    ? 'bg-warning/20 text-warning'
                    : 'bg-success/20 text-success'
            }`}
    >
        {children}
    </span>
);

export default Badge;
