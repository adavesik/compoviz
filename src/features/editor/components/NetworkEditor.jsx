import { Network as NetworkIcon, Settings, Globe, Tag } from 'lucide-react';
import { Input, Select, Section, KeyValueEditor, Badge } from '../../../components/ui';

/**
 * Network configuration editor
 */
export const NetworkEditor = ({ name, network, onUpdate }) => {
    const update = (field, value) => onUpdate({ ...network, [field]: value });

    return (
        <div className="space-y-4 animate-slide-in">
            <div className="flex items-center justify-between pb-3 border-b border-border/50">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                    <NetworkIcon className="text-success" />{name}
                </h2>
                <Badge type="success">Network</Badge>
            </div>

            <Section title="Configuration" icon={Settings}>
                <Select
                    label="Driver"
                    value={network.driver}
                    onChange={v => update('driver', v)}
                    placeholder="Select network driver..."
                    options={[
                        { value: 'bridge', label: 'bridge - Default bridge network' },
                        { value: 'host', label: 'host - Use host networking' },
                        { value: 'overlay', label: 'overlay - Multi-host overlay' },
                        { value: 'macvlan', label: 'macvlan - MAC address assignment' },
                        { value: 'none', label: 'none - No networking' },
                    ]}
                />
                <Input label="External Name" value={network.name} onChange={v => update('name', v)} placeholder="external-network-name" />
                <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={network.external || false} onChange={e => update('external', e.target.checked)} className="rounded" />
                    External Network
                </label>
            </Section>

            <Section title="IPAM" icon={Globe} defaultOpen={false}>
                <Input label="Subnet" value={network.ipam?.config?.[0]?.subnet} onChange={v => update('ipam', { driver: 'default', config: [{ subnet: v }] })} placeholder="172.28.0.0/16" />
            </Section>

            <Section title="Labels" icon={Tag} defaultOpen={false}>
                <KeyValueEditor label="Network Labels" value={network.labels} onChange={v => update('labels', v)} />
            </Section>
        </div>
    );
};

export default NetworkEditor;
