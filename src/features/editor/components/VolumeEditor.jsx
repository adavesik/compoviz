import { Database, Settings } from 'lucide-react';
import { Input, Select, Section, KeyValueEditor, Badge } from '../../../components/ui';

/**
 * Volume configuration editor
 */
export const VolumeEditor = ({ name, volume, onUpdate }) => {
    const update = (field, value) => onUpdate({ ...volume, [field]: value });

    return (
        <div className="space-y-4 animate-slide-in">
            <div className="flex items-center justify-between pb-3 border-b border-border/50">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Database className="text-warning" />{name}
                </h2>
                <Badge type="warning">Volume</Badge>
            </div>

            <Section title="Configuration" icon={Settings}>
                <Select
                    label="Driver"
                    value={volume.driver}
                    onChange={v => update('driver', v)}
                    placeholder="Select volume driver..."
                    options={[
                        { value: 'local', label: 'local - Local storage' },
                        { value: 'nfs', label: 'nfs - Network File System' },
                        { value: 'tmpfs', label: 'tmpfs - Temporary filesystem' },
                    ]}
                />
                <Input label="External Name" value={volume.name} onChange={v => update('name', v)} placeholder="external-volume-name" />
                <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={volume.external || false} onChange={e => update('external', e.target.checked)} className="rounded" />
                    External Volume
                </label>
            </Section>

            <Section title="Driver Options" icon={Settings} defaultOpen={false}>
                <KeyValueEditor label="Options" value={volume.driver_opts} onChange={v => update('driver_opts', v)} keyPlaceholder="type" valuePlaceholder="nfs" />
            </Section>
        </div>
    );
};

export default VolumeEditor;
