export { default as ServiceNode } from './ServiceNode';
export { default as NetworkNode } from './NetworkNode';
export { default as VolumeNode } from './VolumeNode';
export { default as SecretNode } from './SecretNode';
export { default as ConfigNode } from './ConfigNode';

// Node types registry for React Flow
export const nodeTypes = {
    serviceNode: ServiceNode,
    networkNode: NetworkNode,
    volumeNode: VolumeNode,
    secretNode: SecretNode,
    configNode: ConfigNode,
};

import ServiceNode from './ServiceNode';
import NetworkNode from './NetworkNode';
import VolumeNode from './VolumeNode';
import SecretNode from './SecretNode';
import ConfigNode from './ConfigNode';
