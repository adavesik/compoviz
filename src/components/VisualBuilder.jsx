import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { nodeTypes } from './nodes';
import { edgeTypes } from './edges';
import BuilderToolbar from './BuilderToolbar';
import NodeConfigPanel from './NodeConfigPanel';
import { stateToFlow, handleEdgeConnect, handleEdgeDelete, parseNodeId } from '../utils/flowConverter';
import { Download } from 'lucide-react';

/**
 * Visual Builder component using React Flow for interactive compose creation.
 * Allows drag-and-drop creation and connection of Docker resources.
 * Now includes NodeConfigPanel for full configuration of each node.
 */
export default function VisualBuilder({ state, dispatch, onSelectNode, errors = [] }) {
    const reactFlowWrapper = useRef(null);
    const [reactFlowInstance, setReactFlowInstance] = useState(null);
    const [selectedNode, setSelectedNode] = useState(null);

    // Convert compose state to React Flow format
    const { nodes: initialNodes, edges: initialEdges } = useMemo(
        () => stateToFlow(state),
        [state]
    );

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    // Sync nodes when state changes externally
    React.useEffect(() => {
        const { nodes: newNodes, edges: newEdges } = stateToFlow(state);
        setNodes(newNodes);
        setEdges(newEdges);
    }, [state, setNodes, setEdges]);

    // Handle new edge connections
    const onConnect = useCallback(
        (connection) => {
            handleEdgeConnect(connection, state, dispatch);
        },
        [state, dispatch]
    );

    // Handle node click - open config panel
    const onNodeClick = useCallback(
        (event, node) => {
            const { type, name } = parseNodeId(node.id);
            setSelectedNode({ type, name, id: node.id });
        },
        []
    );

    // Handle node double-click - also open config panel
    const onNodeDoubleClick = useCallback(
        (event, node) => {
            const { type, name } = parseNodeId(node.id);
            setSelectedNode({ type, name, id: node.id });
        },
        []
    );

    // Handle pane click - close config panel
    const onPaneClick = useCallback(() => {
        setSelectedNode(null);
    }, []);

    // Handle edge deletion
    const onEdgesDelete = useCallback(
        (deletedEdges) => {
            for (const edge of deletedEdges) {
                handleEdgeDelete(edge, state, dispatch);
            }
        },
        [state, dispatch]
    );

    // Handle node deletion
    const onNodesDelete = useCallback(
        (deletedNodes) => {
            for (const node of deletedNodes) {
                const { type, name } = parseNodeId(node.id);
                const actionTypeMap = {
                    service: 'DELETE_SERVICE',
                    network: 'DELETE_NETWORK',
                    volume: 'DELETE_VOLUME',
                    secret: 'DELETE_SECRET',
                    config: 'DELETE_CONFIG',
                };
                if (actionTypeMap[type]) {
                    dispatch({ type: actionTypeMap[type], name });
                }
            }
            setSelectedNode(null);
        },
        [dispatch]
    );

    // Handle node drag stop - persist position
    const onNodeDragStop = useCallback(
        (event, node) => {
            const { type, name } = parseNodeId(node.id);
            const actionTypeMap = {
                service: 'UPDATE_SERVICE',
                network: 'UPDATE_NETWORK',
                volume: 'UPDATE_VOLUME',
                secret: 'UPDATE_SECRET',
                config: 'UPDATE_CONFIG',
            };
            if (actionTypeMap[type]) {
                dispatch({
                    type: actionTypeMap[type],
                    name,
                    data: { _position: node.position },
                });
            }
        },
        [dispatch]
    );

    // Handle drop from toolbar
    const onDragOver = useCallback((event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback(
        (event) => {
            event.preventDefault();

            const type = event.dataTransfer.getData('application/reactflow');
            if (!type || !reactFlowInstance) return;

            const position = reactFlowInstance.screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });

            // Prompt for name and add
            const typeSingular = type.slice(0, -1);
            const name = prompt(`Enter ${typeSingular} name:`);
            if (name?.trim()) {
                const actionTypeMap = {
                    services: 'ADD_SERVICE',
                    networks: 'ADD_NETWORK',
                    volumes: 'ADD_VOLUME',
                    secrets: 'ADD_SECRET',
                    configs: 'ADD_CONFIG',
                };
                dispatch({ type: actionTypeMap[type], name: name.trim(), position });

                // Automatically open config panel for new node
                const nodeType = type.slice(0, -1); // services -> service
                setSelectedNode({ type: nodeType, name: name.trim(), id: `${nodeType}-${name.trim()}` });
            }
        },
        [reactFlowInstance, dispatch]
    );

    // Handle add from toolbar click
    const handleAdd = useCallback(
        (type) => {
            const typeSingular = type.slice(0, -1);
            const name = prompt(`Enter ${typeSingular} name:`);
            if (name?.trim()) {
                const actionTypeMap = {
                    services: 'ADD_SERVICE',
                    networks: 'ADD_NETWORK',
                    volumes: 'ADD_VOLUME',
                    secrets: 'ADD_SECRET',
                    configs: 'ADD_CONFIG',
                };
                dispatch({ type: actionTypeMap[type], name: name.trim() });

                // Automatically open config panel for new node
                const nodeType = type.slice(0, -1);
                setSelectedNode({ type: nodeType, name: name.trim(), id: `${nodeType}-${name.trim()}` });
            }
        },
        [dispatch]
    );

    // Handle config panel update
    const handleConfigUpdate = useCallback(
        (data) => {
            if (!selectedNode) return;
            const actionTypeMap = {
                service: 'UPDATE_SERVICE',
                network: 'UPDATE_NETWORK',
                volume: 'UPDATE_VOLUME',
                secret: 'UPDATE_SECRET',
                config: 'UPDATE_CONFIG',
            };
            dispatch({
                type: actionTypeMap[selectedNode.type],
                name: selectedNode.name,
                data,
            });
        },
        [selectedNode, dispatch]
    );

    // Handle delete from config panel
    const handleDelete = useCallback(
        (type, name) => {
            if (confirm(`Delete ${name}?`)) {
                const actionTypeMap = {
                    service: 'DELETE_SERVICE',
                    network: 'DELETE_NETWORK',
                    volume: 'DELETE_VOLUME',
                    secret: 'DELETE_SECRET',
                    config: 'DELETE_CONFIG',
                };
                dispatch({ type: actionTypeMap[type], name });
                setSelectedNode(null);
            }
        },
        [dispatch]
    );

    // Handle rename from config panel
    const handleRename = useCallback(
        (newName) => {
            if (!selectedNode) return;
            const { type, name } = selectedNode;
            // For now, we need to transfer data manually (since reducer doesn't have RENAME for all types)
            // Get current data
            const stateKey = type + 's'; // service -> services
            const currentData = state[stateKey]?.[name];
            if (currentData) {
                // Delete old
                const deleteActionMap = {
                    service: 'DELETE_SERVICE',
                    network: 'DELETE_NETWORK',
                    volume: 'DELETE_VOLUME',
                    secret: 'DELETE_SECRET',
                    config: 'DELETE_CONFIG',
                };
                const addActionMap = {
                    service: 'ADD_SERVICE',
                    network: 'ADD_NETWORK',
                    volume: 'ADD_VOLUME',
                    secret: 'ADD_SECRET',
                    config: 'ADD_CONFIG',
                };
                const updateActionMap = {
                    service: 'UPDATE_SERVICE',
                    network: 'UPDATE_NETWORK',
                    volume: 'UPDATE_VOLUME',
                    secret: 'UPDATE_SECRET',
                    config: 'UPDATE_CONFIG',
                };

                dispatch({ type: addActionMap[type], name: newName });
                dispatch({ type: updateActionMap[type], name: newName, data: currentData });
                dispatch({ type: deleteActionMap[type], name });

                setSelectedNode({ type, name: newName, id: `${type}-${newName}` });
            }
        },
        [selectedNode, state, dispatch]
    );

    // Export diagram as SVG
    const handleExportSvg = useCallback(() => {
        const svg = document.querySelector('.react-flow__viewport');
        if (!svg) return;

        const svgClone = svg.cloneNode(true);
        const blob = new Blob([svgClone.outerHTML], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'docker-compose-builder.svg';
        a.click();
        URL.revokeObjectURL(url);
    }, []);

    // Mini-map node color
    const nodeColor = useCallback((node) => {
        const colors = {
            serviceNode: '#3b82f6',
            networkNode: '#10b981',
            volumeNode: '#f59e0b',
            secretNode: '#8b5cf6',
            configNode: '#06b6d4',
        };
        return colors[node.type] || '#64748b';
    }, []);

    // Get selected node data
    const getSelectedNodeData = () => {
        if (!selectedNode) return null;
        const stateKey = selectedNode.type + 's'; // service -> services
        return state[stateKey]?.[selectedNode.name];
    };

    return (
        <div className="visual-builder-with-panel">
            <div className="visual-builder" ref={reactFlowWrapper}>
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onNodeClick={onNodeClick}
                    onNodeDoubleClick={onNodeDoubleClick}
                    onNodesDelete={onNodesDelete}
                    onEdgesDelete={onEdgesDelete}
                    onNodeDragStop={onNodeDragStop}
                    onDrop={onDrop}
                    onDragOver={onDragOver}
                    onPaneClick={onPaneClick}
                    onInit={setReactFlowInstance}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    fitView
                    snapToGrid
                    snapGrid={[15, 15]}
                    deleteKeyCode={['Backspace', 'Delete']}
                    multiSelectionKeyCode={['Control', 'Meta']}
                    connectionLineStyle={{ stroke: '#3b82f6', strokeWidth: 2 }}
                    defaultEdgeOptions={{
                        type: 'smoothstep',
                        animated: true,
                    }}
                    proOptions={{ hideAttribution: true }}
                >
                    <Background
                        color="#1e293b"
                        gap={20}
                        size={1}
                        variant="dots"
                    />

                    <Controls
                        className="builder-controls"
                        showZoom={true}
                        showFitView={true}
                        showInteractive={false}
                    />

                    <MiniMap
                        className="builder-minimap"
                        nodeColor={nodeColor}
                        maskColor="rgba(0, 0, 0, 0.7)"
                        pannable
                        zoomable
                    />

                    {/* Top-left toolbar */}
                    <Panel position="top-left">
                        <BuilderToolbar onAdd={handleAdd} />
                    </Panel>

                    {/* Top-right actions */}
                    <Panel position="top-right">
                        <div className="builder-actions">
                            <button
                                onClick={handleExportSvg}
                                className="builder-action-btn"
                                title="Export Diagram"
                            >
                                <Download size={16} />
                            </button>
                        </div>
                    </Panel>

                    {/* Bottom legend */}
                    <Panel position="bottom-left">
                        <div className="builder-legend">
                            <div className="legend-title">Connection Types</div>
                            <div className="legend-item">
                                <div className="legend-line depends-on"></div>
                                <span>Depends On</span>
                            </div>
                            <div className="legend-item">
                                <div className="legend-line network"></div>
                                <span>Network</span>
                            </div>
                            <div className="legend-item">
                                <div className="legend-line volume"></div>
                                <span>Volume</span>
                            </div>
                        </div>
                    </Panel>

                    {/* Help hint */}
                    <Panel position="bottom-right">
                        <div className="builder-legend" style={{ fontSize: '12px' }}>
                            <p className="text-cyber-text-muted">
                                💡 Click a node to configure
                            </p>
                            <p className="text-cyber-text-muted">
                                🔗 Drag between nodes to connect
                            </p>
                        </div>
                    </Panel>
                </ReactFlow>
            </div>

            {/* Config Panel - slides in from right when a node is selected */}
            {selectedNode && (
                <NodeConfigPanel
                    nodeType={selectedNode.type}
                    nodeName={selectedNode.name}
                    nodeData={getSelectedNodeData()}
                    allNetworks={state.networks || {}}
                    allServices={state.services || {}}
                    allVolumes={state.volumes || {}}
                    allSecrets={state.secrets || {}}
                    allConfigs={state.configs || {}}
                    onUpdate={handleConfigUpdate}
                    onClose={() => setSelectedNode(null)}
                    onDelete={handleDelete}
                    onRename={handleRename}
                />
            )}
        </div>
    );
}
