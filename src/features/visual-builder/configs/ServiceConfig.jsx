import {
    Settings, FolderOpen, Terminal, Globe, FileText, Database,
    Layers, Cpu, Heart, Tag, Shield, Key, Zap, HardDrive
} from 'lucide-react';
import {
    Input, Select, Checkbox, ArrayEditor, KeyValueEditor, MultiSelect, Section
} from './PanelUI';

/**
 * Service configuration panel - complete Docker Compose service options
 */
export const ServiceConfig = ({
    data,
    update,
    updateNested,
    allNetworks,
    allServices,
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

export default ServiceConfig;
