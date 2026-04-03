import { Key, Lock } from 'lucide-react';
import { Input, Section, Badge, TextArea } from '../../../components/ui';

/**
 * Secret configuration editor
 */
export const SecretEditor = ({ name, secret, onUpdate }) => {
    const update = (field, value) => {
        const newData = { ...secret, [field]: value };
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
                    <Key className="text-secret" />{name}
                </h2>
                <Badge type="success">Secret</Badge>
            </div>

            <Section title="Configuration" icon={Lock}>
                <Input label="File Path" value={secret.file} onChange={v => update('file', v)} placeholder="./secrets/my-secret.txt" />
                <TextArea label="Content" value={secret.content} onChange={v => update('content', v)} placeholder="Inlined secret content..." rows={6} />
                <Input label="External Name" value={secret.name} onChange={v => update('name', v)} placeholder="external-secret-name" />
                <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={secret.external || false} onChange={e => update('external', e.target.checked)} className="rounded" />
                    External Secret
                </label>
            </Section>
        </div>
    );
};

export default SecretEditor;
