export { default as DependsOnEdge } from './DependsOnEdge';
export { default as NetworkEdge } from './NetworkEdge';
export { default as VolumeEdge } from './VolumeEdge';

import DependsOnEdge from './DependsOnEdge';
import NetworkEdge from './NetworkEdge';
import VolumeEdge from './VolumeEdge';

// Edge types registry for React Flow
export const edgeTypes = {
    dependsOnEdge: DependsOnEdge,
    networkEdge: NetworkEdge,
    volumeEdge: VolumeEdge,
};
