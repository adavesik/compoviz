/* eslint-disable react-refresh/only-export-components */
import { useState, useCallback, createContext, useContext } from 'react';
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';

const ToastContext = createContext(null);

const ICONS = {
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
};

const COLORS = {
    success: 'toast-success',
    error: 'toast-error',
    warning: 'toast-warning',
    info: 'toast-info',
};

let toastId = 0;

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const dismissToast = useCallback((id) => {
        setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 200);
    }, []);

    const addToast = useCallback((message, type = 'info', duration = 4000) => {
        const id = ++toastId;
        setToasts(prev => [...prev, { id, message, type, exiting: false }]);

        if (duration > 0) {
            setTimeout(() => dismissToast(id), duration);
        }
        return id;
    }, [dismissToast]);

    const toast = useCallback((message, type, duration) => addToast(message, type, duration), [addToast]);
    toast.success = (msg, dur) => addToast(msg, 'success', dur);
    toast.error = (msg, dur) => addToast(msg, 'error', dur ?? 6000);
    toast.warning = (msg, dur) => addToast(msg, 'warning', dur);
    toast.info = (msg, dur) => addToast(msg, 'info', dur);

    return (
        <ToastContext.Provider value={toast}>
            {children}
            <div className="toast-container" aria-live="polite">
                {toasts.map(({ id, message, type, exiting }) => {
                    const Icon = ICONS[type] || Info;
                    return (
                        <div key={id} className={`toast-item ${COLORS[type]} ${exiting ? 'toast-exit' : 'toast-enter'}`}>
                            <Icon size={16} className="toast-icon flex-shrink-0" />
                            <p className="toast-message">{message}</p>
                            <button onClick={() => dismissToast(id)} className="toast-dismiss" aria-label="Dismiss">
                                <X size={14} />
                            </button>
                        </div>
                    );
                })}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within ToastProvider');
    return ctx;
}
