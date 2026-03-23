import { create } from 'zustand';
import {
    Connection,
    Edge,
    EdgeChange,
    Node,
    NodeChange,
    addEdge,
    applyNodeChanges,
    applyEdgeChanges,
} from '@xyflow/react';
import { v4 as uuidv4 } from 'uuid';

export type ConstellationNodeType = 'attachment' | 'group' | 'chat';

export interface ConstellationState {
    nodes: Node[];
    edges: Edge[];
    onNodesChange: (changes: NodeChange[]) => void;
    onEdgesChange: (changes: EdgeChange[]) => void;
    onConnect: (connection: Connection) => void;
    setNodes: (nodes: Node[]) => void;
    setEdges: (edges: Edge[]) => void;
    addNode: (node: Node) => void;
    activeId: string | null;
    activeName: string | null;
    setActiveConstellation: (id: string | null, name: string | null) => void;
    groupNodes: (nodeIds: string[]) => void;
    spawnChat: (sourceId: string, position: { x: number, y: number }) => void;
    updateChatMessages: (nodeId: string, messages: any[]) => void;
    getAggregatedContext: (nodeId: string) => { textContext: string; attachments: any[] };
    updateNodeData: (id: string, data: any) => void;
    copiedNodes: Node[];
    copySelected: () => void;
    pasteCopied: () => void;
    deleteSelected: () => void;
    autoResizeGroup: (groupId: string) => void;
}

export const useConstellationStore = create<ConstellationState>((set, get) => ({
    activeId: null,
    activeName: null,
    setActiveConstellation: (id, name) => set({ activeId: id, activeName: name }),
    nodes: [],
    edges: [],
    
    onNodesChange: (changes: NodeChange[]) => {
        const state = get();
        const removeChanges = changes.filter(c => c.type === 'remove');
        if (removeChanges.length > 0) {
            let nextNodes = [...state.nodes];
            // Process unparenting for Group deletions
            removeChanges.forEach(change => {
                const nodeToDelete = state.nodes.find(n => n.id === change.id);
                if (nodeToDelete && nodeToDelete.type === 'group') {
                    nextNodes = nextNodes.map(child => {
                        if (child.parentId === change.id) {
                            return { 
                                ...child, 
                                parentId: undefined, 
                                extent: undefined,
                                draggable: true,
                                position: {
                                    x: child.position.x + nodeToDelete.position.x,
                                    y: child.position.y + nodeToDelete.position.y
                                }
                            } as Node;
                        }
                        return child;
                    });
                }
            });
            const finalNodes = applyNodeChanges(changes, nextNodes);
            set({ nodes: finalNodes });
            
            // Auto resize parents if child was removed
            removeChanges.forEach(change => {
                const nodeToDelete = state.nodes.find(n => n.id === change.id);
                if (nodeToDelete && nodeToDelete.parentId) {
                    get().autoResizeGroup(nodeToDelete.parentId);
                }
            });
        } else {
            set({ nodes: applyNodeChanges(changes, state.nodes) });
        }
    },
    
    onEdgesChange: (changes: EdgeChange[]) => {
        set({
            edges: applyEdgeChanges(changes, get().edges),
        });
    },
    
    onConnect: (connection: Connection) => {
        set({
            edges: addEdge(connection, get().edges),
        });
    },
    
    setNodes: (nodes: Node[]) => set({ nodes }),
    setEdges: (edges: Edge[]) => set({ edges }),
    
    updateNodeData: (id: string, data: any) => {
        set({
            nodes: get().nodes.map(n => n.id === id ? { ...n, data: { ...n.data, ...data } } : n)
        });
    },

    copiedNodes: [],
    copySelected: () => {
        const selected = get().nodes.filter(n => n.selected);
        set({ copiedNodes: selected });
    },
    pasteCopied: () => {
        const state = get();
        if (state.copiedNodes.length === 0) return;
        
        const newNodes = state.copiedNodes.map(node => ({
            ...node,
            id: `${node.type}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            position: { x: node.position.x + 40, y: node.position.y + 40 },
            selected: true,
            parentId: undefined 
        }));

        const unselectedNodes = state.nodes.map(n => ({ ...n, selected: false }));
        set({ nodes: [...unselectedNodes, ...newNodes] });
    },
    
    deleteSelected: () => {
        const state = get();
        const selectedNodes = state.nodes.filter(n => n.selected);
        if (selectedNodes.length === 0) return;
        const changes: NodeChange[] = selectedNodes.map(n => ({ type: 'remove', id: n.id }));
        state.onNodesChange(changes);
    },

    autoResizeGroup: (groupId: string) => {
        const state = get();
        // Wait for next tick so DOM measures are registered if needed
        setTimeout(() => {
            const currentChildren = get().nodes.filter(n => n.parentId === groupId);
            if (currentChildren.length === 0) return;

            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            currentChildren.forEach(n => {
                const w = n.measured?.width || 200;
                const h = n.measured?.height || 80;
                if (n.position.x < minX) minX = n.position.x;
                if (n.position.y < minY) minY = n.position.y;
                if (n.position.x + w > maxX) maxX = n.position.x + w;
                if (n.position.y + h > maxY) maxY = n.position.y + h;
            });

            const padding = 40;
            const minAllowedWidth = 250;
            const minAllowedHeight = 150;

            const rawWidth = maxX - minX;
            const rawHeight = maxY - minY;

            const newWidth = Math.max(minAllowedWidth, rawWidth + padding * 2);
            const newHeight = Math.max(minAllowedHeight, rawHeight + padding * 2);

            const targetPaddingX = (newWidth - rawWidth) / 2;
            const targetPaddingY = (newHeight - rawHeight) / 2;

            const dx = minX - targetPaddingX;
            const dy = minY - targetPaddingY;

            set({
                nodes: get().nodes.map(n => {
                    if (n.id === groupId) {
                        return { 
                            ...n, 
                            position: {
                                x: n.position.x + dx,
                                y: n.position.y + dy
                            },
                            style: { ...n.style, width: newWidth, height: newHeight } 
                        };
                    }
                    if (n.parentId === groupId) {
                        return {
                            ...n,
                            position: {
                                x: n.position.x - dx,
                                y: n.position.y - dy
                            }
                        };
                    }
                    return n;
                })
            });
        }, 50);
    },
    
    addNode: (node: Node) => {
        set({ nodes: [...get().nodes, node] });
    },

    groupNodes: (nodeIds: string[]) => {
        const state = get();
        const nodesToGroup = state.nodes.filter(n => nodeIds.includes(n.id) && n.type === 'attachment');
        if (nodesToGroup.length === 0) return;

        // Calculate bounding box
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        nodesToGroup.forEach(n => {
            const x = n.position.x;
            const y = n.position.y;
            const w = n.measured?.width || 200;
            const h = n.measured?.height || 80;
            
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x + w > maxX) maxX = x + w;
            if (y + h > maxY) maxY = y + h;
        });

        // Add some padding
        const padding = 40;
        minX -= padding;
        minY -= padding;
        maxX += padding;
        maxY += padding;
        
        const width = maxX - minX;
        const height = maxY - minY;

        const groupId = `group-${uuidv4()}`;
        
        const newGroupNode: Node = {
            id: groupId,
            type: 'group',
            position: { x: minX, y: minY },
            style: { width, height },
            data: { title: 'Knowledge Group' },
            zIndex: -1,
        };

        const updatedNodes = state.nodes.map(n => {
            if (nodeIds.includes(n.id)) {
                return {
                    ...n,
                    parentId: groupId,
                    extent: 'parent',
                    draggable: false, // Lock dragging for inner nodes so they move as a group
                    position: {
                        x: n.position.x - minX,
                        y: n.position.y - minY
                    }
                } as Node;
            }
            return n;
        });

        // React Flow requires parent nodes to appear before their children in the node array
        set({ nodes: [newGroupNode, ...updatedNodes] });
    },

    spawnChat: (sourceId: string, position: { x: number, y: number }) => {
        const state = get();
        const uniqueId = uuidv4();
        const chatId = `chat-${uniqueId}`;
        
        const newChatNode: Node = {
            id: chatId,
            type: 'chat',
            position,
            data: { messages: [] },
        };

        const newEdge: Edge = {
            id: `edge-${sourceId}-${chatId}`,
            source: sourceId,
            target: chatId,
            animated: true,
            style: { stroke: 'var(--accent-base)', strokeWidth: 2 },
        };

        set({
            nodes: [...state.nodes, newChatNode],
            edges: [...state.edges, newEdge]
        });
    },

    updateChatMessages: (nodeId: string, messages: any[]) => {
        set({
            nodes: get().nodes.map(n => {
                if (n.id === nodeId) {
                    return { ...n, data: { ...n.data, messages } };
                }
                return n;
            })
        });
    },

    getAggregatedContext: (nodeId: string): { textContext: string, attachments: any[] } => {
        const state = get();
        
        const visited = new Set<string>();
        let textContext = "";
        const attachments: any[] = [];

        const traverse = (currentId: string) => {
            if (visited.has(currentId)) return;
            visited.add(currentId);

            const node = state.nodes.find(n => n.id === currentId);
            if (!node) return;

            // If it's an attachment, add its content
            if (node.type === 'attachment') {
                const isImage = (node.data.fileType as string)?.startsWith('image/') || node.data.type === 'image';
                
                if (isImage && typeof node.data.imageUrl === 'string') {
                    const mimeMatch = node.data.imageUrl.match(/^data:([^;]+);/);
                    let actualMimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

                    // Deep clamp to only OpenClaw-supported image formats
                    const supportedFormats = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
                    if (!supportedFormats.includes(actualMimeType)) {
                        actualMimeType = 'image/jpeg'; // Fallback to safe format
                    }

                    attachments.push({
                        name: node.data.title || 'image',
                        type: actualMimeType,
                        size: typeof node.data.summary === 'string' ? parseFloat(node.data.summary.replace(/[^\d.-]/g, '')) * 1024 : 0, 
                        url: node.data.imageUrl
                    });
                } else if (node.data.content) {
                    // It's a document/text/markdown
                    // Send it as JSON string injected natively into the text context.
                    // DO NOT push it to multi-modal `attachments` array because 
                    // OpenClaw Vision API stricty crashes on `application/json` MIME formats.
                    
                    const jsonContent = JSON.stringify({
                        title: node.data.title || 'Untitled',
                        content: node.data.content
                    }, null, 2);

                    textContext += `\n--- Document: ${node.data.title || 'Untitled'} (JSON Encoded) ---\n${jsonContent}\n`;
                }
            }

            // If it's a group, traverse its children
            if (node.type === 'group') {
                const children = state.nodes.filter(n => n.parentId === currentId);
                children.forEach(child => traverse(child.id));
            }

            // For any node, find incoming edges and traverse to their sources (Knowledge Spider Net)
            const incomingEdges = state.edges.filter(e => e.target === currentId);
            incomingEdges.forEach(edge => traverse(edge.source));
        };

        // Start traversal from this chat node
        traverse(nodeId);

        return { textContext: textContext.trim(), attachments };
    }
}));
