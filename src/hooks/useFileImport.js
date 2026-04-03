import { useState } from 'react';

/**
 * Custom hook to handle file imports via drag-and-drop or file input
 * @param {Function} loadFiles - Function to load files into the application state
 * @param {Function} setActiveView - Function to set the active view mode
 * @param {boolean} isMobile - Whether the app is in mobile view
 * @param {Function} onError - Error callback (replaces alert)
 * @returns {Object} File import handlers and state
 */
export function useFileImport(loadFiles, setActiveView, isMobile, onError) {
    const [isDragging, setIsDragging] = useState(false);

    const showError = onError || ((msg) => { console.error(msg); });

    /**
     * Recursively collects all files from drag-and-drop operation
     * Handles both files and directories via FileSystem API
     */
    const collectDroppedFiles = async (dataTransfer) => {
        const files = [];
        const items = Array.from(dataTransfer?.items || []);

        const readFileEntry = (entry) => new Promise((resolve) => {
            entry.file((file) => resolve(file));
        });

        const readAllEntries = async (reader) => new Promise((resolve) => {
            const entries = [];
            const readChunk = () => {
                reader.readEntries((batch) => {
                    if (!batch.length) {
                        resolve(entries);
                        return;
                    }
                    entries.push(...batch);
                    readChunk();
                });
            };
            readChunk();
        });

        const walkEntry = async (entry) => {
            if (!entry) return;
            if (entry.isFile) {
                const file = await readFileEntry(entry);
                files.push({ file, fullPath: entry.fullPath });
                return;
            }
            if (entry.isDirectory) {
                const reader = entry.createReader();
                const entries = await readAllEntries(reader);
                for (const child of entries) {
                    await walkEntry(child);
                }
            }
        };

        const entries = items
            .map((item) => item.webkitGetAsEntry?.())
            .filter(Boolean);

        if (entries.length > 0) {
            for (const entry of entries) {
                await walkEntry(entry);
            }
            return files;
        }

        return Array.from(dataTransfer?.files || []).map((file) => ({ file, fullPath: '' }));
    };

    /**
     * Handles file import from drag-and-drop or file input
     * @param {string} content - Primary YAML content
     * @param {Array} files - Array of files to import
     */
    const handleImport = async (content, files = []) => {
        try {
            const result = await loadFiles(content, files);
            if (!result.success) {
                showError('Invalid YAML: ' + (result.error || 'Unknown error'));
                return;
            }
            // On mobile, switch to diagram mode to show the imported config visualized
            if (isMobile) {
                setActiveView('diagram');
            }
        } catch (error) {
            console.error('Import failed:', error);
            showError('Import failed: ' + error.message);
        }
    };

    return {
        isDragging,
        setIsDragging,
        collectDroppedFiles,
        handleImport,
    };
}
