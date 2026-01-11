import { Server, Settings, FolderOpen, Terminal, Globe, FileText, Database, Layers, Cpu, Heart, Tag, AlertCircle, CheckCircle } from 'lucide-react';
import { Input, Select, Section, KeyValueEditor, ArrayEditor, Badge } from '../../../components/ui';
import { getErrorHelp } from '../../../constants/errorHelp';
import { normalizeDependsOn, normalizeArray } from '../../../utils/validation';

/**
 * Service configuration editor
 * Handles all Docker Compose service configuration options
 */
export const ServiceEditor = ({ name, service, onUpdate, allNetworks, allServices, errors = [] }) => {
    const update = (field, value) => onUpdate({ ...service, [field]: value });

    const updateNested = (path, value) => {
        const keys = path.split('.');
        const newService = JSON.parse(JSON.stringify(service));
        let obj = newService;
        keys.slice(0, -1).forEach(k => { if (!obj[k]) obj[k] = {}; obj = obj[k]; });
        obj[keys[keys.length - 1]] = value;
        onUpdate(newService);
    };

    // Helper to find errors matching specific patterns for this service
    const getFieldError = (patterns) => {
        return errors.find(e =>
            e.name === name &&
            patterns.some(p => e.message.toLowerCase().includes(p.toLowerCase()))
        );
    };

    // Map error types to fields
    const imageError = getFieldError(['image', 'build']);
    const containerNameError = getFieldError(['container_name', 'container name']);
    const portsError = getFieldError(['port']);
    const volumesError = getFieldError(['volume']);
    const networksError = getFieldError(['network']);
    const dependsOnError = getFieldError(['dependency', 'depends']);

    // Count errors for this service
    const serviceErrors = errors.filter(e => e.name === name);

    return (
        <div className="space-y-4 animate-slide-in">
            {/* Header with error badge */}
            <div className="flex items-center justify-between pb-3 border-b border-cyber-border/50">
                <h2 className="text-lg font-semibold flex items-center gap-2"><Server className="text-cyber-accent" />{name}</h2>
                <div className="flex items-center gap-2">
                    {serviceErrors.length > 0 && (
                        <Badge type="error">{serviceErrors.length} issue{serviceErrors.length !== 1 && 's'}</Badge>
                    )}
                    <Badge type="success">Service</Badge>
                </div>
            </div>

            <Section title="General" icon={Settings}>
                <Input label="Image" value={service.image} onChange={v => update('image', v)} placeholder="nginx:latest" tooltip="Docker image to use" error={imageError} />
                <Input label="Container Name" value={service.container_name} onChange={v => update('container_name', v)} placeholder="my-container" error={containerNameError} />
                <Select
                    label="Restart Policy"
                    value={service.restart}
                    onChange={v => update('restart', v)}
                    placeholder="Select restart policy..."
                    tooltip="When to restart the container"
                    options={[
                        { value: 'no', label: 'no - Never restart' },
                        { value: 'always', label: 'always - Always restart' },
                        { value: 'on-failure', label: 'on-failure - Restart on failure' },
                        { value: 'unless-stopped', label: 'unless-stopped - Restart unless stopped' },
                    ]}
                />
            </Section>

            <Section title="Build" icon={FolderOpen} defaultOpen={false}>
                <Input label="Context" value={service.build?.context} onChange={v => updateNested('build.context', v)} placeholder="./app" />
                <Input label="Dockerfile" value={service.build?.dockerfile} onChange={v => updateNested('build.dockerfile', v)} placeholder="Dockerfile" />
                <KeyValueEditor label="Build Args" value={service.build?.args} onChange={v => updateNested('build.args', v)} keyPlaceholder="ARG_NAME" valuePlaceholder="value" />
            </Section>

            <Section title="Execution" icon={Terminal} defaultOpen={false}>
                <Input label="Command" value={Array.isArray(service.command) ? service.command.join(' ') : service.command} onChange={v => update('command', v)} placeholder="npm start" tooltip="Override the default command" />
                <Input label="Entrypoint" value={Array.isArray(service.entrypoint) ? service.entrypoint.join(' ') : service.entrypoint} onChange={v => update('entrypoint', v)} placeholder="/docker-entrypoint.sh" tooltip="Override the default entrypoint" />
                <Input label="Working Directory" value={service.working_dir} onChange={v => update('working_dir', v)} placeholder="/app" tooltip="Working directory inside container" />
                <Input label="User" value={service.user} onChange={v => update('user', v)} placeholder="node:node" tooltip="User to run as (user:group)" />
            </Section>

            <Section title="Networking" icon={Globe} defaultOpen={!!portsError || !!networksError}>
                <ArrayEditor label="Ports" value={service.ports} onChange={v => update('ports', v)} placeholder="8080:80" error={portsError} />
                <ArrayEditor label="Expose" value={service.expose} onChange={v => update('expose', v)} placeholder="3000" />
                <div className="space-y-2">
                    <label className={`text-xs ${networksError ? 'text-cyber-error flex items-center gap-1' : 'text-cyber-text-muted'}`}>
                        {networksError && <AlertCircle size={12} />}
                        Networks
                    </label>
                    <div className="flex flex-wrap gap-2">
                        {Object.keys(allNetworks).map(net => (
                            <label key={net} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyber-surface-light/50 cursor-pointer hover:bg-cyber-surface-light">
                                <input type="checkbox" checked={normalizeArray(service.networks).includes(net)} onChange={e => update('networks', e.target.checked ? [...normalizeArray(service.networks), net] : normalizeArray(service.networks).filter(n => n !== net))} className="rounded" />
                                <span className="text-sm">{net}</span>
                            </label>
                        ))}
                    </div>
                    {networksError && (
                        <div className="mt-2 p-3 rounded-lg border border-cyber-warning/40 bg-cyber-warning/10 animate-fade-in">
                            <div className="flex items-start gap-2">
                                <AlertCircle size={16} className="text-cyber-warning mt-0.5 flex-shrink-0" />
                                <div className="flex-1 space-y-2 text-sm">
                                    <p className="font-medium text-cyber-warning">{networksError.message}</p>
                                    <p className="text-cyber-text-muted text-xs">{getErrorHelp(networksError.message).explanation}</p>
                                    <div className="flex items-start gap-2 p-2 bg-cyber-success/10 rounded border border-cyber-success/30">
                                        <CheckCircle size={14} className="text-cyber-success mt-0.5 flex-shrink-0" />
                                        <p className="text-xs text-cyber-success">{getErrorHelp(networksError.message).solution}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </Section>

            <Section title="Environment" icon={FileText} defaultOpen={false}>
                <ArrayEditor label="Env Files" value={normalizeArray(service.env_file)} onChange={v => update('env_file', v)} placeholder="./.env" />
                <KeyValueEditor label="Variables" value={service.environment} onChange={v => update('environment', v)} keyPlaceholder="ENV_VAR" valuePlaceholder="value" />
            </Section>

            <Section title="Volumes" icon={Database} defaultOpen={!!volumesError}>
                <ArrayEditor label="Volume Mounts" value={service.volumes} onChange={v => update('volumes', v)} placeholder="data:/app/data" error={volumesError} />
            </Section>

            <Section title="Dependencies" icon={Layers} defaultOpen={!!dependsOnError}>
                <div className="space-y-2">
                    <label className={`text-xs ${dependsOnError ? 'text-cyber-error flex items-center gap-1' : 'text-cyber-text-muted'}`}>
                        {dependsOnError && <AlertCircle size={12} />}
                        Depends On
                    </label>
                    <div className="flex flex-wrap gap-2">
                        {Object.keys(allServices).filter(s => s !== name).map(svc => (
                            <label key={svc} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyber-surface-light/50 cursor-pointer hover:bg-cyber-surface-light">
                                <input type="checkbox" checked={normalizeDependsOn(service.depends_on).includes(svc)} onChange={e => update('depends_on', e.target.checked ? [...normalizeDependsOn(service.depends_on), svc] : normalizeDependsOn(service.depends_on).filter(d => d !== svc))} className="rounded" />
                                <span className="text-sm">{svc}</span>
                            </label>
                        ))}
                    </div>
                    {dependsOnError && (
                        <div className="mt-2 p-3 rounded-lg border border-cyber-error/40 bg-cyber-error/10 animate-fade-in">
                            <div className="flex items-start gap-2">
                                <AlertCircle size={16} className="text-cyber-error mt-0.5 flex-shrink-0" />
                                <div className="flex-1 space-y-2 text-sm">
                                    <p className="font-medium text-cyber-error">{dependsOnError.message}</p>
                                    <p className="text-cyber-text-muted text-xs">{getErrorHelp(dependsOnError.message).explanation}</p>
                                    <div className="flex items-start gap-2 p-2 bg-cyber-success/10 rounded border border-cyber-success/30">
                                        <CheckCircle size={14} className="text-cyber-success mt-0.5 flex-shrink-0" />
                                        <p className="text-xs text-cyber-success">{getErrorHelp(dependsOnError.message).solution}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </Section>

            <Section title="Resources" icon={Cpu} defaultOpen={false}>
                <div className="grid grid-cols-2 gap-3">
                    <Input label="CPU Limit" value={service.deploy?.resources?.limits?.cpus} onChange={v => updateNested('deploy.resources.limits.cpus', v)} placeholder="0.5" />
                    <Input label="Memory Limit" value={service.deploy?.resources?.limits?.memory} onChange={v => updateNested('deploy.resources.limits.memory', v)} placeholder="512M" />
                    <Input label="CPU Reservation" value={service.deploy?.resources?.reservations?.cpus} onChange={v => updateNested('deploy.resources.reservations.cpus', v)} placeholder="0.25" />
                    <Input label="Memory Reservation" value={service.deploy?.resources?.reservations?.memory} onChange={v => updateNested('deploy.resources.reservations.memory', v)} placeholder="256M" />
                </div>
            </Section>

            <Section title="Healthcheck" icon={Heart} defaultOpen={false}>
                <Input label="Test Command" value={service.healthcheck?.test?.join?.(' ') || service.healthcheck?.test} onChange={v => updateNested('healthcheck.test', v.split(' '))} placeholder="CMD curl -f http://localhost/" />
                <div className="grid grid-cols-3 gap-3">
                    <Input label="Interval" value={service.healthcheck?.interval} onChange={v => updateNested('healthcheck.interval', v)} placeholder="30s" />
                    <Input label="Timeout" value={service.healthcheck?.timeout} onChange={v => updateNested('healthcheck.timeout', v)} placeholder="10s" />
                    <Input label="Retries" value={service.healthcheck?.retries} onChange={v => updateNested('healthcheck.retries', parseInt(v) || '')} placeholder="3" />
                </div>
            </Section>

            <Section title="Labels" icon={Tag} defaultOpen={false}>
                <KeyValueEditor label="Container Labels" value={service.labels} onChange={v => update('labels', v)} keyPlaceholder="traefik.enable" valuePlaceholder="true" />
            </Section>
        </div>
    );
};

export default ServiceEditor;
