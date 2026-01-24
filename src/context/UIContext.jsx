/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';

// Context
const UIContext = createContext(null);

/**
 * UIProvider - Manages UI state (view, sidebar, modals, selection, etc.)
 * Separated from data state to keep concerns clean
 */
export function UIProvider({ children }) {
    // View state
    const [activeView, setActiveView] = useState('editor'); // 'editor' | 'diagram' | 'build' | 'compare'

    // Sidebar state
    const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    // Selection state
    const [selected, setSelected] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal state
    const [activeModal, setActiveModal] = useState(null);
    const [showTemplates, setShowTemplates] = useState(false);

    // Code preview state
    const [codePreviewWidth, setCodePreviewWidth] = useState(384); // Default w-96 = 384px
    const [isResizing, setIsResizing] = useState(false);
    const [showMobileCode, setShowMobileCode] = useState(false);

    // Drag state
    const [isDragging, setIsDragging] = useState(false);

    // Suggestions state (persisted to localStorage)
    const [suggestionsEnabled, setSuggestionsEnabled] = useState(() => {
        const saved = localStorage.getItem('suggestions-enabled');
        if (saved === null || saved === 'undefined') return true;
        try {
            return JSON.parse(saved);
        } catch {
            return true;
        }
    });

    // Handle window resize for responsive behavior
    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            // Auto-close sidebar on mobile when resizing down
            if (mobile && sidebarOpen) {
                setSidebarOpen(false);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [sidebarOpen]);

    // Handle resize panel drag
    useEffect(() => {
        if (!isResizing) return;

        const handleMouseMove = (e) => {
            const newWidth = window.innerWidth - e.clientX;
            // Clamp between 280px and 600px
            setCodePreviewWidth(Math.max(280, Math.min(600, newWidth)));
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing]);

    // Persist suggestions toggle
    useEffect(() => {
        localStorage.setItem('suggestions-enabled', JSON.stringify(suggestionsEnabled));
    }, [suggestionsEnabled]);

    // Actions
    const setView = useCallback((viewId) => {
        setActiveView(viewId);
    }, []);

    const toggleSidebar = useCallback(() => {
        setSidebarOpen(prev => !prev);
    }, []);

    const openModal = useCallback((id) => {
        setActiveModal(id);
    }, []);

    const closeModal = useCallback(() => {
        setActiveModal(null);
    }, []);

    const value = {
        // State
        activeView,
        sidebarOpen,
        isMobile,
        selected,
        searchTerm,
        activeModal,
        showTemplates,
        codePreviewWidth,
        isResizing,
        showMobileCode,
        isDragging,
        suggestionsEnabled,

        // Setters
        setActiveView: setView,
        setSidebarOpen,
        setSelected,
        setSearchTerm,
        setShowTemplates,
        setCodePreviewWidth,
        setIsResizing,
        setShowMobileCode,
        setIsDragging,
        setSuggestionsEnabled,

        // Actions
        toggleSidebar,
        openModal,
        closeModal,
    };

    return (
        <UIContext.Provider value={value}>
            {children}
        </UIContext.Provider>
    );
}

/**
 * Hook to access the UI context.
 * Must be used within UIProvider.
 */
export const useUI = () => {
    const context = useContext(UIContext);
    if (!context) {
        throw new Error('useUI must be used within UIProvider');
    }
    return context;
};
