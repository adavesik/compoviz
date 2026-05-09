/**
 * Canonical Compose AST Layer
 * 
 * This module is the single entry point for the internal model layer.
 * 
 * Usage:
 *   import { normalizeToAST, getServicesByTier, exportToCompose } from '../models';
 */

// Type definitions and constants
export { ASTNodeTypes, ServiceTiers, ServiceRoles, MountTypes, DependencyConditions, AST_VERSION } from './ComposeAST.js';

// Normalization (raw compose → AST)
export { normalizeToAST } from './normalizeToAST.js';

// Query utilities (read from AST)
export {
    getServicesByTier,
    getServicesByRole,
    getEffectiveImage,
    getEffectivePorts,
    getDependents,
    getDependencies,
    hasHealthcheck,
    hasResourceLimits,
    getServicesOnNetwork,
    getPrimaryNetwork,
    getOrphanedNetworks,
    getServicesUsingVolume,
    getOrphanedVolumes,
    getBindMounts,
    getAllHostBindings,
    getPortConflicts,
    getDependencyGraph,
    detectCycles,
    getTopologicalOrder,
    getServicesUsingSecret,
    getServicesUsingConfig,
} from './astQueries.js';

// Export (AST → raw compose for serialization)
export { exportToCompose } from './astExport.js';
