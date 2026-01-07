import { useState, useEffect, useCallback, useRef, memo } from 'react';
import mermaid from 'mermaid';
import { Server, Network, Database, Key, FileText, Plus, Trash2, ChevronDown, ChevronRight, Download, Upload, Search, ZoomIn, ZoomOut, RotateCcw, AlertCircle, CheckCircle, Copy, Settings, Cpu, HardDrive, Heart, Tag, Globe, Lock, FolderOpen, X, Menu, Eye, Code, Layers, Undo2, Redo2, Sparkles, Terminal, Play, GitCompare } from 'lucide-react';

// Import utilities and hooks
import { generateYaml, parseYaml } from './utils/yaml';
import { validateState, normalizeDependsOn, normalizeArray } from './utils/validation';
import { generateMermaidGraph } from './utils/mermaid';
import { ComposeContext, composeReducer, initialState } from './hooks/useCompose';
import { useHistoryReducer } from './hooks/useHistory';
import { serviceTemplates, getTemplateNames } from './data/templates';
import CompareView from './components/CompareView';
import { Analytics } from '@vercel/analytics/react';

// Initialize Mermaid with enhanced styling
mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  securityLevel: 'loose',
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 16,
  themeVariables: {
    primaryColor: '#1e3a8a',
    primaryTextColor: '#ffffff',
    primaryBorderColor: '#3b82f6',
    secondaryColor: '#064e3b',
    tertiaryColor: '#1e293b',
    lineColor: '#64748b',
    textColor: '#ffffff',
    mainBkg: '#0f172a',
    nodeBorder: '#3b82f6',
    clusterBkg: '#1e293b',
    clusterBorder: '#475569',
    titleColor: '#f1f5f9',
    edgeLabelBackground: '#0f172a',
    tertiaryTextColor: '#ffffff',
  },
  flowchart: {
    useMaxWidth: true,
    htmlLabels: true,
    curve: 'basis',
    rankSpacing: 100,
    nodeSpacing: 80,
    padding: 25,
    diagramPadding: 30,
  },
});

// Components
const Badge = ({ type, children }) => (
  <span className={`px-2 py-0.5 text-xs rounded-full ${type === 'error' ? 'bg-cyber-error/20 text-cyber-error' : type === 'warning' ? 'bg-cyber-warning/20 text-cyber-warning' : 'bg-cyber-success/20 text-cyber-success'}`}>{children}</span>
);

const IconButton = ({ icon: Icon, onClick, title, variant = 'default', size = 'md', disabled = false }) => (
  <button onClick={onClick} title={title} disabled={disabled} className={`p-${size === 'sm' ? '1' : '2'} rounded-lg transition-all duration-200 ${disabled ? 'opacity-40 cursor-not-allowed' : ''} ${variant === 'danger' ? 'hover:bg-cyber-error/20 text-cyber-text-muted hover:text-cyber-error' : 'hover:bg-cyber-surface-light text-cyber-text-muted hover:text-cyber-accent'}`}>
    <Icon size={size === 'sm' ? 14 : 18} />
  </button>
);

// Issues Panel for sidebar - shows expandable validation issues
const IssuesPanel = ({ errors, onSelect }) => {
  const [expanded, setExpanded] = useState(false);

  if (errors.length === 0) return null;

  const errorCount = errors.filter(e => e.type === 'error').length;
  const warningCount = errors.filter(e => e.type === 'warning').length;

  return (
    <div className="p-3 border-t border-cyber-border/50">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-sm text-cyber-warning hover:text-cyber-warning/80 transition-colors"
      >
        <div className="flex items-center gap-2">
          <AlertCircle size={14} />
          <span>{errors.length} issue{errors.length !== 1 && 's'} found</span>
        </div>
        <span className="text-xs text-cyber-accent">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-2 max-h-48 overflow-auto animate-fade-in">
          {errors.map((error, idx) => (
            <div
              key={idx}
              onClick={() => onSelect({ type: error.entity + 's', name: error.name })}
              className={`p-2 rounded-lg border cursor-pointer transition-all hover:brightness-110 ${error.type === 'error'
                ? 'bg-cyber-error/10 border-cyber-error/30'
                : 'bg-cyber-warning/10 border-cyber-warning/30'
                }`}
            >
              <div className="flex items-start gap-2">
                {error.type === 'error' ? (
                  <AlertCircle size={12} className="text-cyber-error mt-0.5" />
                ) : (
                  <AlertCircle size={12} className="text-cyber-warning mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{error.message}</p>
                  <p className="text-xs text-cyber-text-muted mt-0.5">
                    {error.entity}: <span className="text-cyber-accent">{error.name}</span>
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Error help content - provides context and solutions for each error type
const ERROR_HELP = {
  'Missing image or build context': {
    explanation: 'Every Docker service needs either a pre-built image from a registry or a build context to create one.',
    solution: 'Add an image name (e.g., "nginx:latest") OR specify a build context path (e.g., "./app").',
  },
  'Network .* not defined': {
    explanation: 'This service references a network that doesn\'t exist in your compose file.',
    solution: 'Create the missing network in the Networks section, or remove this network reference.',
  },
  'Dependency .* not found': {
    explanation: 'This service depends on another service that doesn\'t exist.',
    solution: 'Create the missing service, or remove this dependency.',
  },
  'Volume .* not defined': {
    explanation: 'This service uses a named volume that isn\'t declared in the volumes section.',
    solution: 'Add the volume to the Volumes section, or use a bind mount path instead.',
  },
  'Port .* already used': {
    explanation: 'Multiple services are trying to bind to the same host port, which will cause a conflict.',
    solution: 'Change one of the services to use a different host port (the number before the colon).',
  },
  'Duplicate container_name': {
    explanation: 'Container names must be unique. Two services have the same container_name.',
    solution: 'Change the container_name to be unique, or remove it to use auto-generated names.',
  },
};

// Get help content for an error message
const getErrorHelp = (message) => {
  for (const [pattern, help] of Object.entries(ERROR_HELP)) {
    if (new RegExp(pattern, 'i').test(message)) {
      return help;
    }
  }
  return { explanation: 'This configuration may cause issues.', solution: 'Review and correct the value.' };
};

// Enhanced Input with error state
const Input = ({ label, value, onChange, placeholder, tooltip, error }) => (
  <div className="space-y-1">
    <label className={`text-xs flex items-center gap-1 ${error ? 'text-cyber-error' : 'text-cyber-text-muted'}`}>
      {error && <AlertCircle size={12} className="text-cyber-error" />}
      {label}
      {tooltip && <span className="tooltip" data-tooltip={tooltip}><AlertCircle size={12} /></span>}
    </label>
    <input
      type="text"
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full ${error ? 'border-cyber-error ring-2 ring-cyber-error/30 bg-cyber-error/5' : ''}`}
    />
    {error && (
      <div className="mt-2 p-3 rounded-lg border border-cyber-error/40 bg-cyber-error/10 animate-fade-in">
        <div className="flex items-start gap-2">
          <AlertCircle size={16} className="text-cyber-error mt-0.5 flex-shrink-0" />
          <div className="flex-1 space-y-2 text-sm">
            <p className="font-medium text-cyber-error">{error.message}</p>
            <p className="text-cyber-text-muted text-xs">{getErrorHelp(error.message).explanation}</p>
            <div className="flex items-start gap-2 p-2 bg-cyber-success/10 rounded border border-cyber-success/30">
              <CheckCircle size={14} className="text-cyber-success mt-0.5 flex-shrink-0" />
              <p className="text-xs text-cyber-success">{getErrorHelp(error.message).solution}</p>
            </div>
          </div>
        </div>
      </div>
    )}
  </div>
);

const Select = ({ label, value, onChange, options, placeholder, tooltip }) => (
  <div className="space-y-1">
    <label className="text-xs text-cyber-text-muted flex items-center gap-1">{label}
      {tooltip && <span className="tooltip" data-tooltip={tooltip}><AlertCircle size={12} /></span>}
    </label>
    <select value={value || ''} onChange={e => onChange(e.target.value)} className="w-full">
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(opt => (
        <option key={typeof opt === 'string' ? opt : opt.value} value={typeof opt === 'string' ? opt : opt.value}>
          {typeof opt === 'string' ? opt : opt.label}
        </option>
      ))}
    </select>
  </div>
);

const Section = ({ title, icon: Icon, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-cyber-border/50 rounded-lg overflow-hidden">
      <div className="collapsible-header" onClick={() => setOpen(!open)}>
        <div className="flex items-center gap-2 text-sm font-medium"><Icon size={16} className="text-cyber-accent" />{title}</div>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </div>
      {open && <div className="p-4 space-y-3 animate-fade-in">{children}</div>}
    </div>
  );
};

const KeyValueEditor = ({ label, value = {}, onChange, keyPlaceholder = 'Key', valuePlaceholder = 'Value' }) => {
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
    <div className="space-y-2">
      <div className="flex items-center justify-between"><label className="text-xs text-cyber-text-muted">{label}</label>
        <button onClick={addEntry} className="text-xs text-cyber-accent hover:text-cyber-accent-hover flex items-center gap-1"><Plus size={12} />Add</button>
      </div>
      {entries.map(([k, v], i) => (
        <div key={i} className="flex gap-2 items-center">
          <input className="flex-1" placeholder={keyPlaceholder} value={k} onChange={e => updateKey(k, e.target.value)} />
          <input className="flex-1" placeholder={valuePlaceholder} value={v} onChange={e => updateValue(k, e.target.value)} />
          <IconButton icon={Trash2} onClick={() => removeEntry(k)} variant="danger" size="sm" />
        </div>
      ))}
    </div>
  );
};

const ArrayEditor = ({ label, value = [], onChange, placeholder = 'Value', error }) => {
  const addItem = () => onChange([...value, '']);
  const updateItem = (i, v) => { const n = [...value]; n[i] = v; onChange(n); };
  const removeItem = (i) => onChange(value.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className={`text-xs ${error ? 'text-cyber-error flex items-center gap-1' : 'text-cyber-text-muted'}`}>
          {error && <AlertCircle size={12} />}
          {label}
        </label>
        <button onClick={addItem} className="text-xs text-cyber-accent hover:text-cyber-accent-hover flex items-center gap-1"><Plus size={12} />Add</button>
      </div>
      {value.map((v, i) => (
        <div key={i} className="flex gap-2 items-center">
          <input
            className={`flex-1 ${error ? 'border-cyber-error ring-2 ring-cyber-error/30 bg-cyber-error/5' : ''}`}
            placeholder={placeholder}
            value={v}
            onChange={e => updateItem(i, e.target.value)}
          />
          <IconButton icon={Trash2} onClick={() => removeItem(i)} variant="danger" size="sm" />
        </div>
      ))}
      {error && (
        <div className="mt-2 p-3 rounded-lg border border-cyber-error/40 bg-cyber-error/10 animate-fade-in">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="text-cyber-error mt-0.5 flex-shrink-0" />
            <div className="flex-1 space-y-2 text-sm">
              <p className="font-medium text-cyber-error">{error.message}</p>
              <p className="text-cyber-text-muted text-xs">{getErrorHelp(error.message).explanation}</p>
              <div className="flex items-start gap-2 p-2 bg-cyber-success/10 rounded border border-cyber-success/30">
                <CheckCircle size={14} className="text-cyber-success mt-0.5 flex-shrink-0" />
                <p className="text-xs text-cyber-success">{getErrorHelp(error.message).solution}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Template Modal
const TemplateModal = ({ onSelect, onClose }) => {
  const templates = getTemplateNames();
  const templateIcons = {
    redis: '🔴', postgres: '🐘', mysql: '🐬', mongodb: '🍃',
    nginx: '⚡', node: '💚', python: '🐍', rabbitmq: '🐰'
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass rounded-2xl p-6 max-w-lg w-full max-h-[80vh] overflow-auto animate-slide-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2"><Sparkles className="text-cyber-accent" />Service Templates</h2>
          <IconButton icon={X} onClick={onClose} />
        </div>
        <p className="text-sm text-cyber-text-muted mb-4">Quickly add pre-configured services to your stack.</p>
        <div className="grid grid-cols-2 gap-3">
          {templates.map(name => (
            <button
              key={name}
              onClick={() => onSelect(name)}
              className="p-4 glass-light rounded-xl text-left hover:bg-cyber-surface-light transition-all group"
            >
              <div className="text-2xl mb-2">{templateIcons[name] || '📦'}</div>
              <div className="font-semibold capitalize group-hover:text-cyber-accent transition-colors">{name}</div>
              <div className="text-xs text-cyber-text-muted mt-1">{serviceTemplates[name]?.config?.image || 'Custom build'}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// Service Editor
const ServiceEditor = ({ name, service, onUpdate, allNetworks, allServices, allVolumes, errors = [] }) => {
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

// Network Editor
const NetworkEditor = ({ name, network, onUpdate }) => {
  const update = (field, value) => onUpdate({ ...network, [field]: value });
  return (
    <div className="space-y-4 animate-slide-in">
      <div className="flex items-center justify-between pb-3 border-b border-cyber-border/50">
        <h2 className="text-lg font-semibold flex items-center gap-2"><Network className="text-cyber-success" />{name}</h2>
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
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={network.external || false} onChange={e => update('external', e.target.checked)} className="rounded" />External Network</label>
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

// Volume Editor
const VolumeEditor = ({ name, volume, onUpdate }) => {
  const update = (field, value) => onUpdate({ ...volume, [field]: value });
  return (
    <div className="space-y-4 animate-slide-in">
      <div className="flex items-center justify-between pb-3 border-b border-cyber-border/50">
        <h2 className="text-lg font-semibold flex items-center gap-2"><Database className="text-cyber-warning" />{name}</h2>
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
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={volume.external || false} onChange={e => update('external', e.target.checked)} className="rounded" />External Volume</label>
      </Section>
      <Section title="Driver Options" icon={Settings} defaultOpen={false}>
        <KeyValueEditor label="Options" value={volume.driver_opts} onChange={v => update('driver_opts', v)} keyPlaceholder="type" valuePlaceholder="nfs" />
      </Section>
    </div>
  );
};

// Secret Editor
const SecretEditor = ({ name, secret, onUpdate }) => {
  const update = (field, value) => onUpdate({ ...secret, [field]: value });
  return (
    <div className="space-y-4 animate-slide-in">
      <div className="flex items-center justify-between pb-3 border-b border-cyber-border/50">
        <h2 className="text-lg font-semibold flex items-center gap-2"><Key className="text-cyber-purple" />{name}</h2>
        <Badge type="success">Secret</Badge>
      </div>
      <Section title="Configuration" icon={Lock}>
        <Input label="File Path" value={secret.file} onChange={v => update('file', v)} placeholder="./secrets/my-secret.txt" />
        <Input label="External Name" value={secret.name} onChange={v => update('name', v)} placeholder="external-secret-name" />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={secret.external || false} onChange={e => update('external', e.target.checked)} className="rounded" />External Secret</label>
      </Section>
    </div>
  );
};

// Config Editor
const ConfigEditor = ({ name, config, onUpdate }) => {
  const update = (field, value) => onUpdate({ ...config, [field]: value });
  return (
    <div className="space-y-4 animate-slide-in">
      <div className="flex items-center justify-between pb-3 border-b border-cyber-border/50">
        <h2 className="text-lg font-semibold flex items-center gap-2"><FileText className="text-cyber-cyan" />{name}</h2>
        <Badge type="success">Config</Badge>
      </div>
      <Section title="Configuration" icon={Settings}>
        <Input label="File Path" value={config.file} onChange={v => update('file', v)} placeholder="./configs/my-config.conf" />
        <Input label="External Name" value={config.name} onChange={v => update('name', v)} placeholder="external-config-name" />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.external || false} onChange={e => update('external', e.target.checked)} className="rounded" />External Config</label>
      </Section>
    </div>
  );
};

// Resource Tree
const ResourceTree = ({ state, selected, onSelect, onAdd, onDelete, errors, searchTerm }) => {
  const categories = [
    { key: 'services', label: 'Services', icon: Server, color: 'text-cyber-accent' },
    { key: 'networks', label: 'Networks', icon: Network, color: 'text-cyber-success' },
    { key: 'volumes', label: 'Volumes', icon: Database, color: 'text-cyber-warning' },
    { key: 'secrets', label: 'Secrets', icon: Key, color: 'text-cyber-purple' },
    { key: 'configs', label: 'Configs', icon: FileText, color: 'text-cyber-cyan' },
  ];

  const getErrors = (type, name) => errors.filter(e => e.entity === type.slice(0, -1) && e.name === name);
  const filter = (items) => searchTerm ? Object.keys(items).filter(k => k.toLowerCase().includes(searchTerm.toLowerCase())) : Object.keys(items);

  return (
    <div className="space-y-2">
      {categories.map(({ key, label, icon: Icon, color }) => (
        <div key={key}>
          <div className="flex items-center justify-between px-3 py-2 text-sm font-medium text-cyber-text-muted">
            <span className="flex items-center gap-2"><Icon size={14} className={color} />{label}</span>
            <button onClick={() => onAdd(key)} className="p-1 hover:bg-cyber-surface-light rounded transition-colors"><Plus size={14} /></button>
          </div>
          {filter(state[key]).map(name => {
            const itemErrors = getErrors(key, name);
            return (
              <div key={name} className={`tree-item ml-2 ${selected?.type === key && selected?.name === name ? 'active' : ''}`} onClick={() => onSelect({ type: key, name })}>
                <Icon size={14} className={color} />
                <span className="flex-1 truncate text-sm">{name}</span>
                {itemErrors.length > 0 && <Badge type={itemErrors[0].type}>{itemErrors.length}</Badge>}
                <IconButton icon={Trash2} onClick={e => { e.stopPropagation(); onDelete(key, name); }} variant="danger" size="sm" />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

// Mermaid Diagram with Error Boundary
const MermaidDiagram = memo(({ graph, onNodeClick }) => {
  const containerRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [error, setError] = useState(null);

  useEffect(() => {
    const render = async () => {
      if (!containerRef.current) return;
      try {
        setError(null);
        const id = `mermaid-${Date.now()}`;
        const { svg } = await mermaid.render(id, graph);
        containerRef.current.innerHTML = svg;
        containerRef.current.querySelectorAll('.node').forEach(node => {
          node.style.cursor = 'pointer';
          node.addEventListener('click', () => {
            const id = node.id.replace('flowchart-', '').split('-')[0];
            if (!id.startsWith('net_') && !id.startsWith('vol_')) onNodeClick?.({ type: 'services', name: id });
          });
        });
      } catch (e) { setError(e.message); }
    };
    render();
  }, [graph, onNodeClick]);

  const handleMouseDown = (e) => { setDragging(true); setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y }); };
  const handleMouseMove = (e) => { if (dragging) setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y }); };
  const handleMouseUp = () => setDragging(false);
  const resetView = () => { setScale(1); setPosition({ x: 0, y: 0 }); };

  if (error) return <div className="flex items-center justify-center h-full text-cyber-error"><AlertCircle className="mr-2" />Diagram Error: {error}</div>;

  return (
    <div className="relative h-full">
      {/* Controls */}
      <div className="absolute top-2 right-2 z-10 flex gap-1 glass rounded-lg p-1">
        <IconButton icon={ZoomIn} onClick={() => setScale(s => Math.min(s + 0.2, 3))} title="Zoom In" />
        <IconButton icon={ZoomOut} onClick={() => setScale(s => Math.max(s - 0.2, 0.3))} title="Zoom Out" />
        <IconButton icon={RotateCcw} onClick={resetView} title="Reset View" />
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-10 glass rounded-xl p-4 space-y-2">
        <div className="text-xs font-semibold text-cyber-text-muted uppercase tracking-wide mb-2">Legend</div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-0.5 bg-pink-400" style={{ boxShadow: '0 0 6px #f472b6' }}></div>
          <span className="text-sm text-cyber-text">Depends On</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-0.5 bg-cyan-400 border-dashed" style={{ borderTop: '2px dashed #22d3ee', height: 0 }}></div>
          <span className="text-sm text-cyber-text">Network</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-0.5" style={{ borderTop: '2px dotted #fbbf24' }}></div>
          <span className="text-sm text-cyber-text">Volume Mount</span>
        </div>
      </div>

      {/* Diagram */}
      <div className="mermaid-container" onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
        <div ref={containerRef} style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`, transformOrigin: 'center center', transition: dragging ? 'none' : 'transform 0.2s' }} className="w-full h-full flex items-center justify-center" />
      </div>
    </div>
  );
});

// YAML Code Preview with Syntax Highlighting
const CodePreview = ({ yaml: yamlCode, onYamlChange, onExport, onImport }) => {
  const [editMode, setEditMode] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef(null);

  const highlight = (code) => {
    return code.split('\n').map((line, i) => {
      let html = line.replace(/^(\s*)([a-zA-Z_][a-zA-Z0-9_-]*):/g, '$1<span class="yaml-key">$2</span>:')
        .replace(/:\s*(['"].*['"])/g, ': <span class="yaml-string">$1</span>')
        .replace(/:\s*(\d+)/g, ': <span class="yaml-number">$1</span>')
        .replace(/:\s*(true|false)/gi, ': <span class="yaml-boolean">$1</span>')
        .replace(/#.*/g, '<span class="yaml-comment">$&</span>');
      return `<span class="text-cyber-text-muted select-none mr-4">${String(i + 1).padStart(3)}</span>${html}`;
    }).join('\n');
  };

  const handleCopy = () => { navigator.clipboard.writeText(yamlCode); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const handleEdit = () => { setEditValue(yamlCode); setEditMode(true); };
  const handleSave = () => { try { onYamlChange(editValue); setEditMode(false); } catch (e) { alert('Invalid YAML: ' + e.message); } };
  const handleFileSelect = (e) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onload = (e) => onImport(e.target?.result); reader.readAsText(file); } };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-cyber-border/50">
        <span className="text-sm font-medium flex items-center gap-2"><Code size={16} className="text-cyber-accent" />docker-compose.yml</span>
        <div className="flex gap-1">
          {editMode ? (
            <>
              <button onClick={handleSave} className="btn btn-primary text-xs py-1"><CheckCircle size={14} className="mr-1" />Save</button>
              <button onClick={() => setEditMode(false)} className="btn btn-secondary text-xs py-1"><X size={14} className="mr-1" />Cancel</button>
            </>
          ) : (
            <>
              <IconButton icon={copied ? CheckCircle : Copy} onClick={handleCopy} title="Copy" />
              <IconButton icon={Eye} onClick={handleEdit} title="Edit" />
              <IconButton icon={Download} onClick={onExport} title="Export" />
              <IconButton icon={Upload} onClick={() => fileInputRef.current?.click()} title="Import" />
              <input ref={fileInputRef} type="file" accept=".yml,.yaml" className="hidden" onChange={handleFileSelect} />
            </>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4">
        {editMode ? (
          <textarea value={editValue} onChange={e => setEditValue(e.target.value)} className="w-full h-full code-preview bg-transparent resize-none focus:outline-none" spellCheck={false} />
        ) : (
          <pre className="code-preview" dangerouslySetInnerHTML={{ __html: highlight(yamlCode) }} />
        )}
      </div>
    </div>
  );
};

// Main App Component
export default function App() {
  // Use history-enabled reducer for undo/redo
  const { state, dispatch, undo, redo, canUndo, canRedo } = useHistoryReducer(composeReducer, initialState);
  const [selected, setSelected] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [view, setView] = useState('editor'); // 'editor' | 'diagram'
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [yamlCode, setYamlCode] = useState('');
  const [errors, setErrors] = useState([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('docker-compose-state');
    if (saved) {
      try { dispatch({ type: 'SET_STATE', payload: JSON.parse(saved) }); } catch { }
    }
  }, []);

  // Save to localStorage and generate YAML
  useEffect(() => {
    localStorage.setItem('docker-compose-state', JSON.stringify(state));
    setYamlCode(generateYaml(state));
    setErrors(validateState(state));
  }, [state]);

  const handleAdd = (type) => {
    const name = prompt(`Enter ${type.slice(0, -1)} name:`);
    if (name?.trim()) {
      dispatch({ type: `ADD_${type.slice(0, -1).toUpperCase()}`, name: name.trim() });
      setSelected({ type, name: name.trim() });
    }
  };

  const handleAddFromTemplate = (templateName) => {
    const template = serviceTemplates[templateName];
    if (!template) return;

    const serviceName = template.name || templateName;
    dispatch({ type: 'ADD_SERVICE', name: serviceName });
    dispatch({ type: 'UPDATE_SERVICE', name: serviceName, data: template.config });

    // Add suggested volume if exists
    if (template.suggestedVolume) {
      dispatch({ type: 'ADD_VOLUME', name: template.suggestedVolume.name });
      if (template.suggestedVolume.config) {
        dispatch({ type: 'UPDATE_VOLUME', name: template.suggestedVolume.name, data: template.suggestedVolume.config });
      }
    }

    setSelected({ type: 'services', name: serviceName });
    setShowTemplates(false);
  };

  const handleDelete = (type, name) => {
    if (confirm(`Delete ${name}?`)) {
      dispatch({ type: `DELETE_${type.slice(0, -1).toUpperCase()}`, name });
      if (selected?.name === name) setSelected(null);
    }
  };

  const handleUpdate = useCallback((data) => {
    if (!selected) return;
    dispatch({ type: `UPDATE_${selected.type.slice(0, -1).toUpperCase()}`, name: selected.name, data });
  }, [selected]);

  const handleYamlChange = (newYaml) => {
    try {
      const parsed = parseYaml(newYaml);
      dispatch({ type: 'SET_STATE', payload: parsed });
    } catch (e) { throw e; }
  };

  const handleExport = () => {
    const blob = new Blob([yamlCode], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'docker-compose.yml'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (content) => {
    try {
      const parsed = parseYaml(content);
      dispatch({ type: 'SET_STATE', payload: parsed });
    } catch (e) { alert('Invalid YAML: ' + e.message); }
  };

  const handleExportDiagram = async () => {
    const svg = document.querySelector('.mermaid-container svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'docker-compose-diagram.svg'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearAll = () => {
    if (confirm('Are you sure you want to clear all configuration? This cannot be undone.')) {
      dispatch({ type: 'SET_STATE', payload: initialState });
      setSelected(null);
    }
  };

  const renderEditor = () => {
    if (!selected) return (
      <div
        className={`h-full flex flex-col items-center justify-center text-cyber-text-muted border-2 border-dashed rounded-xl transition-all duration-300 m-4 ${isDragging ? 'border-cyber-accent bg-cyber-accent/5' : 'border-transparent'}`}
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={e => { e.preventDefault(); setIsDragging(false); }}
        onDrop={e => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files[0];
          if (file && (file.name.endsWith('.yml') || file.name.endsWith('.yaml'))) {
            const reader = new FileReader();
            reader.onload = (e) => handleImport(e.target?.result);
            reader.readAsText(file);
          }
        }}
      >
        <Layers size={48} className={`mb-4 transition-all duration-300 ${isDragging ? 'text-cyber-accent scale-110' : 'opacity-50'}`} />
        <p className="text-lg mb-2 font-medium">Select a resource to edit</p>
        <p className="text-sm mb-8">Or add a new service, network, or volume</p>

        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className={`p-6 rounded-xl glass transition-all duration-300 ${isDragging ? 'border-cyber-accent shadow-glow' : 'border border-cyber-border/30'}`}>
            <div className="flex flex-col items-center gap-2 pointer-events-none">
              <Upload size={32} className={`transition-colors duration-300 ${isDragging ? 'text-cyber-accent animate-bounce' : 'text-cyber-text-muted'}`} />
              <p className="text-sm font-medium">Drag & drop docker-compose.yml</p>
              <span className="text-xs text-cyber-text-muted">Supports .yml and .yaml</span>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full">
            <div className="h-px bg-cyber-border/50 flex-1"></div>
            <span className="text-xs text-cyber-text-muted uppercase tracking-wider">or</span>
            <div className="h-px bg-cyber-border/50 flex-1"></div>
          </div>

          <label className="btn btn-secondary cursor-pointer gap-2 flex items-center px-6 hover:bg-cyber-surface-light transition-all">
            <Upload size={16} />
            <span>Import File</span>
            <input
              type="file"
              accept=".yml,.yaml"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (e) => handleImport(e.target?.result);
                  reader.readAsText(file);
                }
              }}
            />
          </label>
        </div>
      </div>
    );

    const { type, name } = selected;
    const item = state[type]?.[name];
    if (!item) return null;

    switch (type) {
      case 'services': return <ServiceEditor name={name} service={item} onUpdate={handleUpdate} allNetworks={state.networks} allServices={state.services} allVolumes={state.volumes} errors={errors} />;
      case 'networks': return <NetworkEditor name={name} network={item} onUpdate={handleUpdate} />;
      case 'volumes': return <VolumeEditor name={name} volume={item} onUpdate={handleUpdate} />;
      case 'secrets': return <SecretEditor name={name} secret={item} onUpdate={handleUpdate} />;
      case 'configs': return <ConfigEditor name={name} config={item} onUpdate={handleUpdate} />;
      default: return null;
    }
  };

  const mermaidGraph = generateMermaidGraph(state);

  return (
    <ComposeContext.Provider value={{ state, dispatch }}>
      <div className="h-screen flex flex-col overflow-hidden">
        <Analytics />
        {/* Header */}
        <header className="glass flex items-center justify-between px-4 py-3 border-b border-cyber-border/50">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-cyber-surface-light rounded-lg lg:hidden"><Menu size={20} /></button>
            <h1 className="text-xl font-bold bg-gradient-to-r from-cyber-accent to-cyber-purple bg-clip-text text-transparent">Docker Compose Architect</h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Undo/Redo buttons */}
            <div className="flex gap-1 glass rounded-lg p-1 mr-2">
              <IconButton icon={Undo2} onClick={undo} title="Undo (Ctrl+Z)" disabled={!canUndo} />
              <IconButton icon={Redo2} onClick={redo} title="Redo (Ctrl+Shift+Z)" disabled={!canRedo} />
            </div>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-cyber-text-muted" />
              <input type="text" placeholder="Search resources..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 pr-4 py-2 w-48 lg:w-64 text-sm" />
            </div>
            <div className="flex gap-1 glass rounded-lg p-1">
              <button onClick={() => setView('editor')} className={`px-3 py-1.5 rounded text-sm transition-colors ${view === 'editor' ? 'bg-cyber-accent text-white' : 'text-cyber-text-muted hover:text-cyber-text'}`}><Code size={14} className="inline mr-1" />Editor</button>
              <button onClick={() => setView('diagram')} className={`px-3 py-1.5 rounded text-sm transition-colors ${view === 'diagram' ? 'bg-cyber-accent text-white' : 'text-cyber-text-muted hover:text-cyber-text'}`}><Eye size={14} className="inline mr-1" />Diagram</button>
              <button onClick={() => setView('compare')} className={`px-3 py-1.5 rounded text-sm transition-colors ${view === 'compare' ? 'bg-cyber-purple text-white' : 'text-cyber-text-muted hover:text-cyber-text'}`}><GitCompare size={14} className="inline mr-1" />Compare</button>
            </div>
            {view === 'diagram' && <IconButton icon={Download} onClick={handleExportDiagram} title="Export Diagram" />}
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar */}
          <aside className={`${sidebarOpen ? 'w-64' : 'w-0'} transition-all duration-300 overflow-hidden border-r border-cyber-border/50 glass-light flex flex-col`}>
            <div className="p-3 border-b border-cyber-border/50 space-y-2">
              <input
                type="text"
                placeholder="Project name..."
                value={state.name || ''}
                onChange={e => dispatch({ type: 'SET_STATE', payload: { ...state, name: e.target.value } })}
                className="w-full text-sm"
              />
              <button onClick={() => handleAdd('services')} className="btn btn-primary w-full flex items-center justify-center gap-2"><Plus size={16} />Add Service</button>
              <button onClick={() => setShowTemplates(true)} className="btn btn-secondary w-full flex items-center justify-center gap-2"><Sparkles size={16} />From Template</button>
            </div>
            <div className="flex-1 overflow-auto p-2">
              <ResourceTree state={state} selected={selected} onSelect={setSelected} onAdd={handleAdd} onDelete={handleDelete} errors={errors} searchTerm={searchTerm} />
            </div>
            <IssuesPanel errors={errors} onSelect={setSelected} />
            {/* Spec Compliance Badge */}
            <div className="px-3 py-2 border-t border-cyber-border/50">
              <a
                href="https://docs.docker.com/reference/compose-file/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-cyber-surface-light/50 hover:bg-cyber-accent/20 transition-colors group"
              >
                <CheckCircle size={12} className="text-cyber-success" />
                <span className="text-xs text-cyber-text-muted group-hover:text-cyber-accent transition-colors">
                  Compose Spec v2.x
                </span>
                <Globe size={10} className="text-cyber-text-muted group-hover:text-cyber-accent" />
              </a>
            </div>
            <div className="p-3 border-t border-cyber-border/50">
              <button onClick={handleClearAll} className="w-full text-xs text-cyber-text-muted hover:text-cyber-error transition-colors">Clear All</button>
            </div>
          </aside>

          {/* Main Panel */}
          <main className="flex-1 flex overflow-hidden">
            {view === 'compare' ? (
              /* Compare View - Takes full width */
              <CompareView />
            ) : view === 'editor' ? (
              <>
                {/* Editor Panel */}
                <div className="flex-1 overflow-auto p-6">{renderEditor()}</div>
                {/* Code Preview Panel */}
                <div className="w-96 border-l border-cyber-border/50 glass-light hidden xl:flex flex-col">
                  <CodePreview yaml={yamlCode} onYamlChange={handleYamlChange} onExport={handleExport} onImport={handleImport} />
                </div>
              </>
            ) : (
              /* Diagram View */
              <div className="flex-1 p-4">
                <div className="h-full glass rounded-xl overflow-hidden">
                  <MermaidDiagram graph={mermaidGraph} onNodeClick={setSelected} />
                </div>
              </div>
            )}
          </main>
        </div>

        {/* Mobile YAML Toggle */}
        <div className="xl:hidden fixed bottom-4 right-4">
          <button onClick={handleExport} className="btn btn-primary shadow-lg glow"><Download size={18} className="mr-2" />Export YAML</button>
        </div>
      </div>

      {/* Template Modal */}
      {showTemplates && <TemplateModal onSelect={handleAddFromTemplate} onClose={() => setShowTemplates(false)} />}
    </ComposeContext.Provider>
  );
}
