import { useState, useEffect, useCallback, memo } from 'react';
import {
    X, Server, Network, Database, Key, FileText, Settings, Globe,
    Terminal, Heart, Tag, Cpu, FolderOpen, Lock, Layers, Plus, Trash2,
    ChevronDown, ChevronRight, AlertCircle, CheckCircle, HardDrive,
    Play, Shield, Clock, Zap, Box
} from 'lucide-react';

/**
 * Comprehensive Node Configuration Panel for the Visual Builder.
 * Provides ALL available Docker Compose options for each resource type.
 */
const NodeConfigPanel = memo(({
    nodeType, // 'service' | 'network' | 'volume' | 'secret' | 'config'
    nodeName,
    nodeData,
    allNetworks = {},
    allServices = {},
    allVolumes = {},
    allSecrets = {},
    allConfigs = {},
    onUpdate,
    onClose,
    onDelete,
    onRename,
}) => {
    const [localData, setLocalData] = useState(nodeData || {});
    const [activeSection, setActiveSection] = useState('general');
    const [isRenaming, setIsRenaming] = useState(false);
    const [newName, setNewName] = useState(nodeName);

    useEffect(() => {
        setLocalData(nodeData || {});
    }, [nodeData]);

    // Update local state and propagate to parent
    const update = useCallback((field, value) => {
        const newData = { ...localData, [field]: value };
        setLocalData(newData);
        onUpdate?.(newData);
    }, [localData, onUpdate]);

    // Update nested fields
    const updateNested = useCallback((path, value) => {
        const keys = path.split('.');
        const newData = JSON.parse(JSON.stringify(localData));
        let obj = newData;
        keys.slice(0, -1).forEach(k => { if (!obj[k]) obj[k] = {}; obj = obj[k]; });
        obj[keys[keys.length - 1]] = value;
        setLocalData(newData);
        onUpdate?.(newData);
    }, [localData, onUpdate]);

    const handleRename = () => {
        if (newName && newName !== nodeName) {
            onRename?.(newName);
        }
        setIsRenaming(false);
    };

    // Get icon and color for node type
    const getNodeTypeInfo = () => {
        switch (nodeType) {
            case 'service': return { icon: Server, color: 'text-cyber-accent', bgColor: 'bg-cyber-accent/20' };
            case 'network': return { icon: Network, color: 'text-cyber-success', bgColor: 'bg-cyber-success/20' };
            case 'volume': return { icon: Database, color: 'text-cyber-warning', bgColor: 'bg-cyber-warning/20' };
            case 'secret': return { icon: Key, color: 'text-cyber-purple', bgColor: 'bg-cyber-purple/20' };
            case 'config': return { icon: FileText, color: 'text-cyan-400', bgColor: 'bg-cyan-400/20' };
            default: return { icon: Box, color: 'text-cyber-text-muted', bgColor: 'bg-cyber-surface-light' };
        }
    };

    const { icon: TypeIcon, color, bgColor } = getNodeTypeInfo();

    return (
        <div className="node-config-panel">
            {/* Header */}
            <div className="config-panel-header">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${bgColor}`}>
                        <TypeIcon size={20} className={color} />
                    </div>
                    <div className="flex-1">
                        {isRenaming ? (
                            <input
                                type="text"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                onBlur={handleRename}
                                onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                                className="text-lg font-semibold bg-transparent border-b border-cyber-accent focus:outline-none"
                                autoFocus
                            />
                        ) : (
                            <h2
                                className="text-lg font-semibold cursor-pointer hover:text-cyber-accent transition-colors"
                                onClick={() => setIsRenaming(true)}
                                title="Click to rename"
                            >
                                {nodeName}
                            </h2>
                        )}
                        <p className="text-xs text-cyber-text-muted capitalize">{nodeType}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => onDelete?.(nodeType, nodeName)}
                        className="p-2 rounded-lg text-cyber-text-muted hover:text-cyber-error hover:bg-cyber-error/20 transition-all"
                        title="Delete"
                    >
                        <Trash2 size={16} />
                    </button>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg text-cyber-text-muted hover:text-cyber-text hover:bg-cyber-surface-light transition-all"
                    >
                        <X size={18} />
                    </button>
                </div>
            </div>

            {/* Content based on node type */}
            <div className="config-panel-content">
                {nodeType === 'service' && (
                    <ServiceConfig
                        data={localData}
                        update={update}
                        updateNested={updateNested}
                        allNetworks={allNetworks}
                        allServices={allServices}
                        allVolumes={allVolumes}
                        allSecrets={allSecrets}
                        allConfigs={allConfigs}
                        nodeName={nodeName}
                        activeSection={activeSection}
                        setActiveSection={setActiveSection}
                    />
                )}
                {nodeType === 'network' && (
                    <NetworkConfig data={localData} update={update} updateNested={updateNested} />
                )}
                {nodeType === 'volume' && (
                    <VolumeConfig data={localData} update={update} updateNested={updateNested} />
                )}
                {nodeType === 'secret' && (
                    <SecretConfig data={localData} update={update} />
                )}
                {nodeType === 'config' && (
                    <ConfigConfig data={localData} update={update} />
                )}
            </div>
        </div>
    );
});

// ============================================
// REUSABLE INPUT COMPONENTS
// ============================================

const Input = ({ label, value, onChange, placeholder, tooltip, multiline = false, code = false }) => (
    <div className="config-field">
        <label className="config-label">
            {label}
            {tooltip && <span className="config-tooltip" title={tooltip}>?</span>}
        </label>
        {multiline ? (
            <textarea
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className={`config-input config-textarea ${code ? 'font-mono text-sm' : ''}`}
                rows={3}
            />
        ) : (
            <input
                type="text"
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className={`config-input ${code ? 'font-mono text-sm' : ''}`}
            />
        )}
    </div>
);

const Select = ({ label, value, onChange, options, placeholder, tooltip }) => (
    <div className="config-field">
        <label className="config-label">
            {label}
            {tooltip && <span className="config-tooltip" title={tooltip}>?</span>}
        </label>
        <select
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className="config-input"
        >
            {placeholder && <option value="">{placeholder}</option>}
            {options.map((opt) => (
                <option key={typeof opt === 'string' ? opt : opt.value} value={typeof opt === 'string' ? opt : opt.value}>
                    {typeof opt === 'string' ? opt : opt.label}
                </option>
            ))}
        </select>
    </div>
);

const Checkbox = ({ label, checked, onChange, tooltip }) => (
    <label className="config-checkbox">
        <input
            type="checkbox"
            checked={checked || false}
            onChange={(e) => onChange(e.target.checked)}
            className="config-checkbox-input"
        />
        <span>{label}</span>
        {tooltip && <span className="config-tooltip" title={tooltip}>?</span>}
    </label>
);

const ArrayEditor = ({ label, value = [], onChange, placeholder, tooltip }) => {
    const addItem = () => onChange([...value, '']);
    const updateItem = (i, v) => { const n = [...value]; n[i] = v; onChange(n); };
    const removeItem = (i) => onChange(value.filter((_, idx) => idx !== i));

    return (
        <div className="config-field">
            <div className="flex items-center justify-between mb-2">
                <label className="config-label mb-0">
                    {label}
                    {tooltip && <span className="config-tooltip" title={tooltip}>?</span>}
                </label>
                <button onClick={addItem} className="config-add-btn">
                    <Plus size={12} /> Add
                </button>
            </div>
            <div className="space-y-2">
                {value.map((v, i) => (
                    <div key={i} className="flex gap-2">
                        <input
                            className="config-input flex-1"
                            placeholder={placeholder}
                            value={v}
                            onChange={(e) => updateItem(i, e.target.value)}
                        />
                        <button onClick={() => removeItem(i)} className="config-remove-btn">
                            <Trash2 size={14} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

const KeyValueEditor = ({ label, value = {}, onChange, keyPlaceholder = 'Key', valuePlaceholder = 'Value', tooltip }) => {
    const entries = Object.entries(value);
    const addEntry = () => onChange({ ...value, '': '' });
    const updateKey = (oldKey, newKey) => {
        const newVal = { ...value };
        const v = newVal[oldKey];
        delete newVal[oldKey];
        newVal[newKey] = v;
        onChange(newVal);
    };
    const updateValue = (key, newValue) => onChange({ ...value, [key]: newValue });
    const removeEntry = (key) => { const { [key]: _, ...rest } = value; onChange(rest); };

    return (
        <div className="config-field">
            <div className="flex items-center justify-between mb-2">
                <label className="config-label mb-0">
                    {label}
                    {tooltip && <span className="config-tooltip" title={tooltip}>?</span>}
                </label>
                <button onClick={addEntry} className="config-add-btn">
                    <Plus size={12} /> Add
                </button>
            </div>
            <div className="space-y-2">
                {entries.map(([k, v], i) => (
                    <div key={i} className="flex gap-2">
                        <input
                            className="config-input flex-1"
                            placeholder={keyPlaceholder}
                            value={k}
                            onChange={(e) => updateKey(k, e.target.value)}
                        />
                        <input
                            className="config-input flex-1"
                            placeholder={valuePlaceholder}
                            value={v}
                            onChange={(e) => updateValue(k, e.target.value)}
                        />
                        <button onClick={() => removeEntry(k)} className="config-remove-btn">
                            <Trash2 size={14} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

const MultiSelect = ({ label, options, selected = [], onChange, tooltip }) => (
    <div className="config-field">
        <label className="config-label">
            {label}
            {tooltip && <span className="config-tooltip" title={tooltip}>?</span>}
        </label>
        <div className="config-multi-select">
            {options.map((opt) => (
                <label key={opt} className="config-multi-option">
                    <input
                        type="checkbox"
                        checked={selected.includes(opt)}
                        onChange={(e) => {
                            if (e.target.checked) {
                                onChange([...selected, opt]);
                            } else {
                                onChange(selected.filter((s) => s !== opt));
                            }
                        }}
                    />
                    <span>{opt}</span>
                </label>
            ))}
        </div>
    </div>
);

// ============================================
// COLLAPSIBLE SECTION
// ============================================

const Section = ({ title, icon: Icon, children, defaultOpen = false, highlight = false }) => {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <div className={`config-section ${highlight ? 'config-section-highlight' : ''}`}>
            <button
                className="config-section-header"
                onClick={() => setOpen(!open)}
            >
                <div className="flex items-center gap-2">
                    <Icon size={16} className="text-cyber-accent" />
                    <span>{title}</span>
                </div>
                {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            {open && (
                <div className="config-section-content">
                    {children}
                </div>
            )}
        </div>
    );
};

// ============================================
// SERVICE CONFIGURATION (FULL SPEC)
// ============================================

const ServiceConfig = ({
    data,
    update,
    updateNested,
    allNetworks,
    allServices,
    allVolumes,
    allSecrets,
    allConfigs,
    nodeName
}) => {
    // Normalize depends_on to array
    const normalizeDependsOn = (dep) => {
        if (!dep) return [];
        if (Array.isArray(dep)) return dep;
        if (typeof dep === 'object') return Object.keys(dep);
        return [];
    };

    // Normalize networks to array
    const normalizeArray = (arr) => {
        if (!arr) return [];
        if (Array.isArray(arr)) return arr;
        if (typeof arr === 'object') return Object.keys(arr);
        return [];
    };

    return (
        <div className="config-sections">
            {/* GENERAL */}
            <Section title="General" icon={Settings} defaultOpen={true}>
                <Input
                    label="Image"
                    value={data.image}
                    onChange={(v) => update('image', v)}
                    placeholder="nginx:latest"
                    tooltip="Docker image to use for this service"
                />
                <Input
                    label="Container Name"
                    value={data.container_name}
                    onChange={(v) => update('container_name', v)}
                    placeholder="my-container"
                    tooltip="Custom container name (must be unique)"
                />
                <Select
                    label="Restart Policy"
                    value={data.restart}
                    onChange={(v) => update('restart', v)}
                    placeholder="Select restart policy..."
                    tooltip="When to restart the container"
                    options={[
                        { value: 'no', label: 'no - Never restart' },
                        { value: 'always', label: 'always - Always restart' },
                        { value: 'on-failure', label: 'on-failure - Restart on failure' },
                        { value: 'unless-stopped', label: 'unless-stopped - Restart unless stopped' },
                    ]}
                />
                <Input
                    label="Hostname"
                    value={data.hostname}
                    onChange={(v) => update('hostname', v)}
                    placeholder="my-host"
                    tooltip="Custom hostname for the container"
                />
                <Input
                    label="Domain Name"
                    value={data.domainname}
                    onChange={(v) => update('domainname', v)}
                    placeholder="example.com"
                    tooltip="Domain name for the container"
                />
                <Checkbox
                    label="Privileged Mode"
                    checked={data.privileged}
                    onChange={(v) => update('privileged', v)}
                    tooltip="Run container in privileged mode"
                />
                <Checkbox
                    label="Read Only Root Filesystem"
                    checked={data.read_only}
                    onChange={(v) => update('read_only', v)}
                    tooltip="Mount the container's root filesystem as read only"
                />
                <Checkbox
                    label="Init Process"
                    checked={data.init}
                    onChange={(v) => update('init', v)}
                    tooltip="Run an init inside the container"
                />
                <Checkbox
                    label="TTY (Allocate pseudo-TTY)"
                    checked={data.tty}
                    onChange={(v) => update('tty', v)}
                    tooltip="Allocate a pseudo-TTY"
                />
                <Checkbox
                    label="Stdin Open"
                    checked={data.stdin_open}
                    onChange={(v) => update('stdin_open', v)}
                    tooltip="Keep STDIN open even if not attached"
                />
            </Section>

            {/* BUILD */}
            <Section title="Build Configuration" icon={FolderOpen}>
                <Input
                    label="Context"
                    value={data.build?.context}
                    onChange={(v) => updateNested('build.context', v)}
                    placeholder="./app"
                    tooltip="Path to build context directory"
                />
                <Input
                    label="Dockerfile"
                    value={data.build?.dockerfile}
                    onChange={(v) => updateNested('build.dockerfile', v)}
                    placeholder="Dockerfile"
                    tooltip="Dockerfile filename"
                />
                <Input
                    label="Target"
                    value={data.build?.target}
                    onChange={(v) => updateNested('build.target', v)}
                    placeholder="production"
                    tooltip="Build target stage"
                />
                <KeyValueEditor
                    label="Build Arguments"
                    value={data.build?.args}
                    onChange={(v) => updateNested('build.args', v)}
                    keyPlaceholder="ARG_NAME"
                    valuePlaceholder="value"
                    tooltip="Build-time variables"
                />
                <ArrayEditor
                    label="Cache From"
                    value={data.build?.cache_from}
                    onChange={(v) => updateNested('build.cache_from', v)}
                    placeholder="image:tag"
                    tooltip="Images to use as cache sources"
                />
                <KeyValueEditor
                    label="Labels"
                    value={data.build?.labels}
                    onChange={(v) => updateNested('build.labels', v)}
                    keyPlaceholder="label.key"
                    valuePlaceholder="value"
                    tooltip="Build-time labels"
                />
                <Select
                    label="Network Mode (build)"
                    value={data.build?.network}
                    onChange={(v) => updateNested('build.network', v)}
                    placeholder="Select network mode..."
                    options={['host', 'none', 'default']}
                    tooltip="Network mode during build"
                />
                <Input
                    label="SHM Size"
                    value={data.build?.shm_size}
                    onChange={(v) => updateNested('build.shm_size', v)}
                    placeholder="256m"
                    tooltip="Shared memory size for build"
                />
            </Section>

            {/* EXECUTION */}
            <Section title="Execution" icon={Terminal}>
                <Input
                    label="Command"
                    value={Array.isArray(data.command) ? data.command.join(' ') : data.command}
                    onChange={(v) => update('command', v)}
                    placeholder="npm start"
                    tooltip="Override the default command"
                    code
                />
                <Input
                    label="Entrypoint"
                    value={Array.isArray(data.entrypoint) ? data.entrypoint.join(' ') : data.entrypoint}
                    onChange={(v) => update('entrypoint', v)}
                    placeholder="/docker-entrypoint.sh"
                    tooltip="Override the default entrypoint"
                    code
                />
                <Input
                    label="Working Directory"
                    value={data.working_dir}
                    onChange={(v) => update('working_dir', v)}
                    placeholder="/app"
                    tooltip="Working directory inside container"
                />
                <Input
                    label="User"
                    value={data.user}
                    onChange={(v) => update('user', v)}
                    placeholder="node:node"
                    tooltip="User to run as (user:group)"
                />
                <Input
                    label="Stop Signal"
                    value={data.stop_signal}
                    onChange={(v) => update('stop_signal', v)}
                    placeholder="SIGTERM"
                    tooltip="Signal to stop the container"
                />
                <Input
                    label="Stop Grace Period"
                    value={data.stop_grace_period}
                    onChange={(v) => update('stop_grace_period', v)}
                    placeholder="10s"
                    tooltip="Time to wait before sending SIGKILL"
                />
            </Section>

            {/* NETWORKING */}
            <Section title="Networking" icon={Globe}>
                <ArrayEditor
                    label="Ports"
                    value={data.ports}
                    onChange={(v) => update('ports', v)}
                    placeholder="8080:80"
                    tooltip="Port mappings (host:container)"
                />
                <ArrayEditor
                    label="Expose"
                    value={data.expose}
                    onChange={(v) => update('expose', v)}
                    placeholder="3000"
                    tooltip="Ports to expose to linked services"
                />
                <MultiSelect
                    label="Networks"
                    options={Object.keys(allNetworks)}
                    selected={normalizeArray(data.networks)}
                    onChange={(v) => update('networks', v)}
                    tooltip="Networks to attach to"
                />
                <Select
                    label="Network Mode"
                    value={data.network_mode}
                    onChange={(v) => update('network_mode', v)}
                    placeholder="Select network mode..."
                    options={['bridge', 'host', 'none', 'service:[service name]', 'container:[container name/id]']}
                    tooltip="Network mode to use"
                />
                <ArrayEditor
                    label="DNS Servers"
                    value={data.dns}
                    onChange={(v) => update('dns', v)}
                    placeholder="8.8.8.8"
                    tooltip="Custom DNS servers"
                />
                <ArrayEditor
                    label="DNS Search"
                    value={data.dns_search}
                    onChange={(v) => update('dns_search', v)}
                    placeholder="example.com"
                    tooltip="Custom DNS search domains"
                />
                <ArrayEditor
                    label="Extra Hosts"
                    value={data.extra_hosts}
                    onChange={(v) => update('extra_hosts', v)}
                    placeholder="host:192.168.1.1"
                    tooltip="Additional /etc/hosts entries"
                />
                <Input
                    label="MAC Address"
                    value={data.mac_address}
                    onChange={(v) => update('mac_address', v)}
                    placeholder="02:42:ac:11:65:43"
                    tooltip="Custom MAC address"
                />
            </Section>

            {/* ENVIRONMENT */}
            <Section title="Environment" icon={FileText}>
                <ArrayEditor
                    label="Env Files"
                    value={Array.isArray(data.env_file) ? data.env_file : data.env_file ? [data.env_file] : []}
                    onChange={(v) => update('env_file', v)}
                    placeholder="./.env"
                    tooltip="Files to load environment variables from"
                />
                <KeyValueEditor
                    label="Environment Variables"
                    value={data.environment}
                    onChange={(v) => update('environment', v)}
                    keyPlaceholder="ENV_VAR"
                    valuePlaceholder="value"
                    tooltip="Environment variables to set"
                />
            </Section>

            {/* VOLUMES & STORAGE */}
            <Section title="Volumes & Storage" icon={Database}>
                <ArrayEditor
                    label="Volume Mounts"
                    value={data.volumes}
                    onChange={(v) => update('volumes', v)}
                    placeholder="./data:/app/data:rw"
                    tooltip="Volume mounts (source:target:mode)"
                />
                <ArrayEditor
                    label="Tmpfs Mounts"
                    value={data.tmpfs}
                    onChange={(v) => update('tmpfs', v)}
                    placeholder="/run"
                    tooltip="Mount tmpfs filesystems"
                />
                <Input
                    label="SHM Size"
                    value={data.shm_size}
                    onChange={(v) => update('shm_size', v)}
                    placeholder="64m"
                    tooltip="Shared memory size"
                />
            </Section>

            {/* DEPENDENCIES */}
            <Section title="Dependencies" icon={Layers}>
                <MultiSelect
                    label="Depends On"
                    options={Object.keys(allServices).filter((s) => s !== nodeName)}
                    selected={normalizeDependsOn(data.depends_on)}
                    onChange={(v) => update('depends_on', v)}
                    tooltip="Services this service depends on"
                />
                <ArrayEditor
                    label="Links"
                    value={data.links}
                    onChange={(v) => update('links', v)}
                    placeholder="db:database"
                    tooltip="Link to containers in another service"
                />
                <ArrayEditor
                    label="External Links"
                    value={data.external_links}
                    onChange={(v) => update('external_links', v)}
                    placeholder="redis:cache"
                    tooltip="Link to containers outside this compose file"
                />
            </Section>

            {/* RESOURCES */}
            <Section title="Resources & Limits" icon={Cpu}>
                <div className="config-grid">
                    <Input
                        label="CPU Limit"
                        value={data.deploy?.resources?.limits?.cpus}
                        onChange={(v) => updateNested('deploy.resources.limits.cpus', v)}
                        placeholder="0.5"
                        tooltip="CPU limit (number of CPUs)"
                    />
                    <Input
                        label="Memory Limit"
                        value={data.deploy?.resources?.limits?.memory}
                        onChange={(v) => updateNested('deploy.resources.limits.memory', v)}
                        placeholder="512M"
                        tooltip="Memory limit"
                    />
                    <Input
                        label="CPU Reservation"
                        value={data.deploy?.resources?.reservations?.cpus}
                        onChange={(v) => updateNested('deploy.resources.reservations.cpus', v)}
                        placeholder="0.25"
                        tooltip="Reserved CPUs"
                    />
                    <Input
                        label="Memory Reservation"
                        value={data.deploy?.resources?.reservations?.memory}
                        onChange={(v) => updateNested('deploy.resources.reservations.memory', v)}
                        placeholder="256M"
                        tooltip="Reserved memory"
                    />
                </div>
                <Input
                    label="PIDs Limit"
                    value={data.pids_limit}
                    onChange={(v) => update('pids_limit', parseInt(v) || '')}
                    placeholder="100"
                    tooltip="Maximum number of PIDs"
                />
                <Input
                    label="Memory Swap"
                    value={data.memswap_limit}
                    onChange={(v) => update('memswap_limit', v)}
                    placeholder="-1"
                    tooltip="Memory + swap limit"
                />
                <Input
                    label="OOM Kill Disable"
                    value={data.oom_kill_disable}
                    onChange={(v) => update('oom_kill_disable', v === 'true')}
                    placeholder="false"
                    tooltip="Disable OOM killer"
                />
            </Section>

            {/* HEALTHCHECK */}
            <Section title="Healthcheck" icon={Heart}>
                <Input
                    label="Test Command"
                    value={data.healthcheck?.test?.join?.(' ') || data.healthcheck?.test}
                    onChange={(v) => updateNested('healthcheck.test', v.startsWith('CMD') ? v.split(' ') : ['CMD', 'sh', '-c', v])}
                    placeholder="CMD curl -f http://localhost/"
                    tooltip="Command to run to check health"
                    code
                />
                <div className="config-grid">
                    <Input
                        label="Interval"
                        value={data.healthcheck?.interval}
                        onChange={(v) => updateNested('healthcheck.interval', v)}
                        placeholder="30s"
                        tooltip="Time between health checks"
                    />
                    <Input
                        label="Timeout"
                        value={data.healthcheck?.timeout}
                        onChange={(v) => updateNested('healthcheck.timeout', v)}
                        placeholder="10s"
                        tooltip="Maximum time to wait for response"
                    />
                    <Input
                        label="Retries"
                        value={data.healthcheck?.retries}
                        onChange={(v) => updateNested('healthcheck.retries', parseInt(v) || '')}
                        placeholder="3"
                        tooltip="Consecutive failures before unhealthy"
                    />
                    <Input
                        label="Start Period"
                        value={data.healthcheck?.start_period}
                        onChange={(v) => updateNested('healthcheck.start_period', v)}
                        placeholder="0s"
                        tooltip="Time to wait before starting health checks"
                    />
                </div>
                <Checkbox
                    label="Disable Healthcheck"
                    checked={data.healthcheck?.disable}
                    onChange={(v) => updateNested('healthcheck.disable', v)}
                    tooltip="Disable container healthcheck"
                />
            </Section>

            {/* LOGGING */}
            <Section title="Logging" icon={FileText}>
                <Select
                    label="Logging Driver"
                    value={data.logging?.driver}
                    onChange={(v) => updateNested('logging.driver', v)}
                    placeholder="Select logging driver..."
                    options={['json-file', 'syslog', 'journald', 'gelf', 'fluentd', 'awslogs', 'splunk', 'none']}
                    tooltip="Logging driver to use"
                />
                <KeyValueEditor
                    label="Logging Options"
                    value={data.logging?.options}
                    onChange={(v) => updateNested('logging.options', v)}
                    keyPlaceholder="max-size"
                    valuePlaceholder="10m"
                    tooltip="Driver-specific options"
                />
            </Section>

            {/* SECURITY */}
            <Section title="Security" icon={Shield}>
                <ArrayEditor
                    label="Cap Add"
                    value={data.cap_add}
                    onChange={(v) => update('cap_add', v)}
                    placeholder="NET_ADMIN"
                    tooltip="Add Linux capabilities"
                />
                <ArrayEditor
                    label="Cap Drop"
                    value={data.cap_drop}
                    onChange={(v) => update('cap_drop', v)}
                    placeholder="ALL"
                    tooltip="Drop Linux capabilities"
                />
                <ArrayEditor
                    label="Security Opt"
                    value={data.security_opt}
                    onChange={(v) => update('security_opt', v)}
                    placeholder="no-new-privileges:true"
                    tooltip="Security options"
                />
                <Input
                    label="Userns Mode"
                    value={data.userns_mode}
                    onChange={(v) => update('userns_mode', v)}
                    placeholder="host"
                    tooltip="User namespace mode"
                />
                <Input
                    label="IPC Mode"
                    value={data.ipc}
                    onChange={(v) => update('ipc', v)}
                    placeholder="host"
                    tooltip="IPC mode"
                />
                <Input
                    label="PID Mode"
                    value={data.pid}
                    onChange={(v) => update('pid', v)}
                    placeholder="host"
                    tooltip="PID mode"
                />
                <ArrayEditor
                    label="Sysctls"
                    value={Object.entries(data.sysctls || {}).map(([k, v]) => `${k}=${v}`)}
                    onChange={(v) => {
                        const obj = {};
                        v.forEach(item => {
                            const [key, val] = item.split('=');
                            if (key) obj[key] = val || '';
                        });
                        update('sysctls', obj);
                    }}
                    placeholder="net.core.somaxconn=1024"
                    tooltip="Kernel parameters"
                />
            </Section>

            {/* SECRETS */}
            <Section title="Secrets" icon={Key}>
                <MultiSelect
                    label="Secrets"
                    options={Object.keys(allSecrets)}
                    selected={data.secrets?.map(s => typeof s === 'string' ? s : s.source) || []}
                    onChange={(v) => update('secrets', v)}
                    tooltip="Secrets to expose to this service"
                />
            </Section>

            {/* CONFIGS */}
            <Section title="Configs" icon={FileText}>
                <MultiSelect
                    label="Configs"
                    options={Object.keys(allConfigs)}
                    selected={data.configs?.map(c => typeof c === 'string' ? c : c.source) || []}
                    onChange={(v) => update('configs', v)}
                    tooltip="Configs to expose to this service"
                />
            </Section>

            {/* LABELS */}
            <Section title="Labels" icon={Tag}>
                <KeyValueEditor
                    label="Container Labels"
                    value={data.labels}
                    onChange={(v) => update('labels', v)}
                    keyPlaceholder="traefik.enable"
                    valuePlaceholder="true"
                    tooltip="Labels to add to the container"
                />
            </Section>

            {/* DEPLOY */}
            <Section title="Deploy" icon={Zap}>
                <Input
                    label="Replicas"
                    value={data.deploy?.replicas}
                    onChange={(v) => updateNested('deploy.replicas', parseInt(v) || '')}
                    placeholder="1"
                    tooltip="Number of container replicas"
                />
                <Select
                    label="Restart Policy Condition"
                    value={data.deploy?.restart_policy?.condition}
                    onChange={(v) => updateNested('deploy.restart_policy.condition', v)}
                    placeholder="Select condition..."
                    options={['none', 'on-failure', 'any']}
                    tooltip="Restart policy condition"
                />
                <Input
                    label="Restart Delay"
                    value={data.deploy?.restart_policy?.delay}
                    onChange={(v) => updateNested('deploy.restart_policy.delay', v)}
                    placeholder="5s"
                    tooltip="Delay between restart attempts"
                />
                <Input
                    label="Max Attempts"
                    value={data.deploy?.restart_policy?.max_attempts}
                    onChange={(v) => updateNested('deploy.restart_policy.max_attempts', parseInt(v) || '')}
                    placeholder="3"
                    tooltip="Maximum restart attempts"
                />
                <Input
                    label="Window"
                    value={data.deploy?.restart_policy?.window}
                    onChange={(v) => updateNested('deploy.restart_policy.window', v)}
                    placeholder="120s"
                    tooltip="Window for max attempts evaluation"
                />
            </Section>

            {/* ULIMITS */}
            <Section title="Ulimits" icon={HardDrive}>
                <KeyValueEditor
                    label="Ulimits"
                    value={Object.fromEntries(
                        Object.entries(data.ulimits || {}).map(([k, v]) => [k, typeof v === 'object' ? `${v.soft}:${v.hard}` : v])
                    )}
                    onChange={(v) => {
                        const obj = {};
                        Object.entries(v).forEach(([key, val]) => {
                            if (val.includes(':')) {
                                const [soft, hard] = val.split(':');
                                obj[key] = { soft: parseInt(soft), hard: parseInt(hard) };
                            } else {
                                obj[key] = parseInt(val);
                            }
                        });
                        update('ulimits', obj);
                    }}
                    keyPlaceholder="nofile"
                    valuePlaceholder="65535 or soft:hard"
                    tooltip="Process limits"
                />
            </Section>
        </div>
    );
};

// ============================================
// NETWORK CONFIGURATION
// ============================================

const NetworkConfig = ({ data, update, updateNested }) => (
    <div className="config-sections">
        <Section title="Configuration" icon={Settings} defaultOpen={true}>
            <Select
                label="Driver"
                value={data.driver}
                onChange={(v) => update('driver', v)}
                placeholder="Select network driver..."
                options={[
                    { value: 'bridge', label: 'bridge - Default bridge network' },
                    { value: 'host', label: 'host - Use host networking' },
                    { value: 'overlay', label: 'overlay - Multi-host overlay' },
                    { value: 'macvlan', label: 'macvlan - MAC address assignment' },
                    { value: 'none', label: 'none - No networking' },
                    { value: 'ipvlan', label: 'ipvlan - IP address assignment' },
                ]}
                tooltip="Network driver to use"
            />
            <Input
                label="External Name"
                value={data.name}
                onChange={(v) => update('name', v)}
                placeholder="external-network-name"
                tooltip="External network name"
            />
            <Checkbox
                label="External Network"
                checked={data.external}
                onChange={(v) => update('external', v)}
                tooltip="Use pre-existing network"
            />
            <Checkbox
                label="Internal"
                checked={data.internal}
                onChange={(v) => update('internal', v)}
                tooltip="Restrict external access"
            />
            <Checkbox
                label="Attachable"
                checked={data.attachable}
                onChange={(v) => update('attachable', v)}
                tooltip="Allow manual container attachment"
            />
            <Checkbox
                label="Enable IPv6"
                checked={data.enable_ipv6}
                onChange={(v) => update('enable_ipv6', v)}
                tooltip="Enable IPv6 networking"
            />
        </Section>

        <Section title="IPAM Configuration" icon={Globe}>
            <Select
                label="IPAM Driver"
                value={data.ipam?.driver}
                onChange={(v) => updateNested('ipam.driver', v)}
                placeholder="Select IPAM driver..."
                options={['default', 'null']}
                tooltip="IP Address Management driver"
            />
            <Input
                label="Subnet"
                value={data.ipam?.config?.[0]?.subnet}
                onChange={(v) => updateNested('ipam.config', [{ ...data.ipam?.config?.[0], subnet: v }])}
                placeholder="172.28.0.0/16"
                tooltip="Subnet in CIDR format"
            />
            <Input
                label="IP Range"
                value={data.ipam?.config?.[0]?.ip_range}
                onChange={(v) => updateNested('ipam.config', [{ ...data.ipam?.config?.[0], ip_range: v }])}
                placeholder="172.28.5.0/24"
                tooltip="IP range for allocation"
            />
            <Input
                label="Gateway"
                value={data.ipam?.config?.[0]?.gateway}
                onChange={(v) => updateNested('ipam.config', [{ ...data.ipam?.config?.[0], gateway: v }])}
                placeholder="172.28.0.1"
                tooltip="Gateway address"
            />
        </Section>

        <Section title="Driver Options" icon={Settings}>
            <KeyValueEditor
                label="Driver Options"
                value={data.driver_opts}
                onChange={(v) => update('driver_opts', v)}
                keyPlaceholder="com.docker.network.bridge.name"
                valuePlaceholder="br0"
                tooltip="Driver-specific options"
            />
        </Section>

        <Section title="Labels" icon={Tag}>
            <KeyValueEditor
                label="Network Labels"
                value={data.labels}
                onChange={(v) => update('labels', v)}
                keyPlaceholder="label.key"
                valuePlaceholder="value"
                tooltip="Labels to add to the network"
            />
        </Section>
    </div>
);

// ============================================
// VOLUME CONFIGURATION
// ============================================

const VolumeConfig = ({ data, update, updateNested }) => (
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

// ============================================
// SECRET CONFIGURATION
// ============================================

const SecretConfig = ({ data, update }) => (
    <div className="config-sections">
        <Section title="Configuration" icon={Lock} defaultOpen={true}>
            <Input
                label="File Path"
                value={data.file}
                onChange={(v) => update('file', v)}
                placeholder="./secrets/my-secret.txt"
                tooltip="Path to the secret file"
            />
            <Input
                label="External Name"
                value={data.name}
                onChange={(v) => update('name', v)}
                placeholder="external-secret-name"
                tooltip="External secret name"
            />
            <Checkbox
                label="External Secret"
                checked={data.external}
                onChange={(v) => update('external', v)}
                tooltip="Use pre-existing secret"
            />
        </Section>

        <Section title="Labels" icon={Tag}>
            <KeyValueEditor
                label="Secret Labels"
                value={data.labels}
                onChange={(v) => update('labels', v)}
                keyPlaceholder="label.key"
                valuePlaceholder="value"
                tooltip="Labels to add to the secret"
            />
        </Section>
    </div>
);

// ============================================
// CONFIG CONFIGURATION
// ============================================

const ConfigConfig = ({ data, update }) => (
    <div className="config-sections">
        <Section title="Configuration" icon={Settings} defaultOpen={true}>
            <Input
                label="File Path"
                value={data.file}
                onChange={(v) => update('file', v)}
                placeholder="./configs/my-config.conf"
                tooltip="Path to the config file"
            />
            <Input
                label="External Name"
                value={data.name}
                onChange={(v) => update('name', v)}
                placeholder="external-config-name"
                tooltip="External config name"
            />
            <Checkbox
                label="External Config"
                checked={data.external}
                onChange={(v) => update('external', v)}
                tooltip="Use pre-existing config"
            />
        </Section>

        <Section title="Labels" icon={Tag}>
            <KeyValueEditor
                label="Config Labels"
                value={data.labels}
                onChange={(v) => update('labels', v)}
                keyPlaceholder="label.key"
                valuePlaceholder="value"
                tooltip="Labels to add to the config"
            />
        </Section>
    </div>
);

NodeConfigPanel.displayName = 'NodeConfigPanel';

export default NodeConfigPanel;
