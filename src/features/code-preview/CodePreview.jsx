import { useState, useRef } from 'react';
import { Code, Download, Upload, CheckCircle, X, Eye, Copy, Folder } from 'lucide-react';
import { IconButton } from '../../components/ui';
import { useCompose } from '../../hooks/useCompose.jsx';

/**
 * YAML code preview with syntax highlighting and edit mode
 */
export const CodePreview = () => {
    // Get compose state from context
    const { yamlCode, handleExport, loadFiles } = useCompose();

    const [editMode, setEditMode] = useState(false);
    const [editValue, setEditValue] = useState('');
    const [copied, setCopied] = useState(false);
    const fileInputRef = useRef(null);
    const folderInputRef = useRef(null);

    const splitComment = (line) => {
        const hashIndex = line.indexOf('#');
        if (hashIndex === -1) return { code: line, comment: '' };
        return {
            code: line.slice(0, hashIndex),
            comment: line.slice(hashIndex),
        };
    };

    const highlightValue = (text) => {
        const patterns = [
            { regex: /^(\s*)(['"].*['"])/, className: 'yaml-string' },
            { regex: /^(\s*)(\d+)/, className: 'yaml-number' },
            { regex: /^(\s*)(true|false)/i, className: 'yaml-boolean' },
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern.regex);
            if (match) {
                const leading = match[1] || '';
                const value = match[2] || '';
                const rest = text.slice(match[0].length);
                return [
                    leading,
                    <span key="value" className={pattern.className}>{value}</span>,
                    rest,
                ];
            }
        }

        return [text];
    };

    const highlightLine = (line, index, totalLines) => {
        const { code, comment } = splitComment(line);
        const keyMatch = code.match(/^(\s*)([a-zA-Z_][a-zA-Z0-9_-]*)(:)(.*)$/);

        const lineParts = [
            <span key="line-number" className="text-cyber-text-muted select-none mr-4">
                {String(index + 1).padStart(3)}
            </span>,
        ];

        if (keyMatch) {
            const indent = keyMatch[1] || '';
            const key = keyMatch[2] || '';
            const rest = keyMatch[4] || '';
            lineParts.push(indent);
            lineParts.push(<span key="key" className="yaml-key">{key}</span>);
            lineParts.push(':');
            lineParts.push(...highlightValue(rest));
        } else {
            lineParts.push(...highlightValue(code));
        }

        if (comment) {
            lineParts.push(<span key="comment" className="yaml-comment">{comment}</span>);
        }

        if (index < totalLines - 1) {
            lineParts.push('\n');
        }

        return <span key={index}>{lineParts}</span>;
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(yamlCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleEdit = () => {
        setEditValue(yamlCode);
        setEditMode(true);
    };

    const handleSave = async () => {
        try {
            const result = await loadFiles(editValue);
            if (result.success) {
                setEditMode(false);
            } else {
                alert('Invalid YAML: ' + (result.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Save failed:', error);
            alert('Save failed: ' + error.message);
        }
    };

    const handleFileSelect = async (e) => {
        const files = Array.from(e.target.files || []).filter((file) => (
            file.name.endsWith('.yml') || file.name.endsWith('.yaml') || file.name === '.env'
        ));
        if (files.length === 0) return;

        const primaryFile = files.find((file) => (
            file.name === 'docker-compose.yml' || file.name === 'docker-compose.yaml'
        )) || files[0];

        const orderedFiles = [primaryFile, ...files.filter((file) => file !== primaryFile)];

        try {
            const content = await primaryFile.text();
            const result = await loadFiles(content, orderedFiles);
            if (!result.success) {
                alert('Invalid YAML: ' + (result.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Import failed:', error);
            alert('Import failed: ' + error.message);
        }
    };

    return (
        <div className="h-full flex flex-col">
            <div className="flex items-center justify-between p-3 border-b border-cyber-border/50">
                <span className="text-sm font-medium flex items-center gap-2">
                    <Code size={16} className="text-cyber-accent" />docker-compose.yml
                </span>
                <div className="flex gap-1">
                    {editMode ? (
                        <>
                            <button onClick={handleSave} className="btn btn-primary text-xs py-1">
                                <CheckCircle size={14} className="mr-1" />Save
                            </button>
                            <button onClick={() => setEditMode(false)} className="btn btn-secondary text-xs py-1">
                                <X size={14} className="mr-1" />Cancel
                            </button>
                        </>
                    ) : (
                        <>
                            <IconButton icon={copied ? CheckCircle : Copy} onClick={handleCopy} title="Copy" />
                            <IconButton icon={Eye} onClick={handleEdit} title="Edit" />
                            <IconButton icon={Download} onClick={handleExport} title="Export" />
                            <IconButton icon={Upload} onClick={() => fileInputRef.current?.click()} title="Import Files" />
                            <IconButton icon={Folder} onClick={() => folderInputRef.current?.click()} title="Import Folder" />
                            <input ref={fileInputRef} type="file" accept=".yml,.yaml,.env" multiple className="hidden" onChange={handleFileSelect} />
                            <input ref={folderInputRef} type="file" accept=".yml,.yaml,.env" webkitdirectory="true" className="hidden" onChange={handleFileSelect} />
                        </>
                    )}
                </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
                {editMode ? (
                    <textarea
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        className="w-full h-full code-preview bg-transparent resize-none focus:outline-none"
                        spellCheck={false}
                    />
                ) : (
                    <pre className="code-preview">
                        {yamlCode.split('\n').map((line, i, arr) => highlightLine(line, i, arr.length))}
                    </pre>
                )}
            </div>
        </div>
    );
};

export default CodePreview;
