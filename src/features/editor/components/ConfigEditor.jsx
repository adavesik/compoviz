import { FileText, Settings } from 'lucide-react';
import { Input, Section, Badge, TextArea } from '../../../components/ui';

/**
 * Config file configuration editor
 */
export const ConfigEditor = ({ name, config, onUpdate }) => {
    const update = (field, value) => {
        const newData = { ...config, [field]: value };
        if (field === 'content' && value) {
            delete newData.file;
            newData.external = false;
        } else if (field === 'file' && value) {
            delete newData.content;
            newData.external = false;
        } else if (field === 'external' && value) {
            delete newData.file;
            delete newData.content;
        }
        onUpdate(newData);
    };

    return (
        <div className="space-y-4 animate-slide-in">
            <div className="flex items-center justify-between pb-3 border-b border-border/50">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                    <FileText className="text-config" />{name}
                </h2>
                <Badge type="success">Config</Badge>
            </div>

            <Section title="Configuration" icon={Settings}>
                <Input label="File Path" value={config.file} onChange={v => update('file', v)} placeholder="./configs/my-config.conf" />
                <TextArea label="Content" value={config.content} onChange={v => update('content', v)} placeholder="Inlined configuration content..." rows={6} />
                <Input label="External Name" value={config.name} onChange={v => update('name', v)} placeholder="external-config-name" />
                <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={config.external || false} onChange={e => update('external', e.target.checked)} className="rounded" />
                    External Config
                </label>
            </Section>
        </div>
    );
};

export default ConfigEditor;
