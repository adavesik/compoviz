import { Settings, Tag } from 'lucide-react';
import { Input, Select, Checkbox, KeyValueEditor, Section } from './PanelUI';

/**
 * Volume configuration panel
 */
export const VolumeConfig = ({ data, update }) => (
    <div className="config-sections">
        <Section title="Configuration" icon={Settings} defaultOpen={true}>
            <Select
                label="Driver"
                value={data.driver}
                onChange={(v) => update('driver', v)}
                placeholder="Select volume driver..."
                options={[
                    { value: 'local', label: 'local - Local storage' },
                    { value: 'nfs', label: 'nfs - Network File System' },
                ]}
                tooltip="Volume driver to use"
            />
            <Input
                label="External Name"
                value={data.name}
                onChange={(v) => update('name', v)}
                placeholder="external-volume-name"
                tooltip="External volume name"
            />
            <Checkbox
                label="External Volume"
                checked={data.external}
                onChange={(v) => update('external', v)}
                tooltip="Use pre-existing volume"
            />
        </Section>

        <Section title="Driver Options" icon={Settings}>
            <KeyValueEditor
                label="Driver Options"
                value={data.driver_opts}
                onChange={(v) => update('driver_opts', v)}
                keyPlaceholder="type"
                valuePlaceholder="nfs"
                tooltip="Driver-specific options"
            />
        </Section>

        <Section title="Labels" icon={Tag}>
            <KeyValueEditor
                label="Volume Labels"
                value={data.labels}
                onChange={(v) => update('labels', v)}
                keyPlaceholder="label.key"
                valuePlaceholder="value"
                tooltip="Labels to add to the volume"
            />
        </Section>
    </div>
);

export default VolumeConfig;
