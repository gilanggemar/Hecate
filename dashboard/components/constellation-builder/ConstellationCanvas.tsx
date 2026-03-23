"use client";

import React, { useCallback, useRef, useState, useEffect } from "react";
import {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    ConnectionMode,
    BackgroundVariant,
    SelectionMode,
    NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { HelpCircle, Plus, X, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";

import { useConstellationStore } from "@/store/useConstellationStore";
import { AttachmentNode } from "./nodes/AttachmentNode";
import { GroupNode } from "./nodes/GroupNode";
import { ChatNode } from "./nodes/ChatNode";

const nodeTypes: NodeTypes = {
    attachment: AttachmentNode,
    group: GroupNode,
    chat: ChatNode,
};

export function ConstellationCanvas() {
    const nodes = useConstellationStore((s) => s.nodes);
    const edges = useConstellationStore((s) => s.edges);
    const onNodesChange = useConstellationStore((s) => s.onNodesChange);
    const onEdgesChange = useConstellationStore((s) => s.onEdgesChange);
    const onConnect = useConstellationStore((s) => s.onConnect);
    const addNode = useConstellationStore((s) => s.addNode);

    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showGuide, setShowGuide] = useState(false);

    const handleFiles = useCallback((files: File[], position: {x: number, y: number}) => {
        files.forEach((file, index) => {
            const offsetPos = { x: position.x + (index * 20), y: position.y + (index * 20) };
            
            let type = "document";
            if (file.name.endsWith(".md") || file.name.endsWith(".txt")) type = "markdown";
            if (file.type.match(/excel|csv|spreadsheet/i)) type = "spreadsheet";
            if (file.type.startsWith("image/")) type = "image";

            const reader = new FileReader();
            reader.onload = (e) => {
                const result = e.target?.result as string;
                addNode({
                    id: `attachment-${Date.now()}-${index}`,
                    type: "attachment",
                    position: offsetPos,
                    data: {
                        type,
                        title: file.name,
                        summary: `Size: ${(file.size / 1024).toFixed(1)} KB`,
                        content: type !== 'image' ? result : undefined,
                        imageUrl: type === 'image' ? result : undefined
                    },
                });
            };

            if (type === 'image') reader.readAsDataURL(file);
            else reader.readAsText(file);
        });
    }, [addNode]);

    const [showMiniMap, setShowMiniMap] = useState(true);
    const miniMapTimerRef = useRef<NodeJS.Timeout | null>(null);

    const handleMouseMove = useCallback(() => {
        setShowMiniMap(true);
        if (miniMapTimerRef.current) clearTimeout(miniMapTimerRef.current);
        miniMapTimerRef.current = setTimeout(() => setShowMiniMap(false), 1000);
    }, []);

    // Cleanup timer
    React.useEffect(() => {
        handleMouseMove(); 
        return () => {
            if (miniMapTimerRef.current) clearTimeout(miniMapTimerRef.current);
        };
    }, [handleMouseMove]);

    const minimapStyle: React.CSSProperties = {
        background: "oklch(0.1 0.005 0 / 0.6)",
        backdropFilter: "blur(12px)",
        borderRadius: 10,
        border: "1px solid oklch(1 0 0 / 0.08)",
        overflow: "hidden",
        right: 12, 
        bottom: 12,
        opacity: showMiniMap ? 1 : 0,
        transition: 'opacity 0.3s ease-in-out',
        pointerEvents: showMiniMap ? 'auto' : 'none'
    };

    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setIsDraggingOver(true);
    }, []);
    
    const onDragLeave = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        setIsDraggingOver(false);
    }, []);

    const onDrop = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault();
            setIsDraggingOver(false);

            if (!reactFlowWrapper.current || !reactFlowInstance) return;

            const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
            
            // Look for dropped files
            const files = Array.from(event.dataTransfer.files);
            
            // Look for dropped text/urls
            const textData = event.dataTransfer.getData("text/plain");
            const uriData = event.dataTransfer.getData("text/uri-list");
            
            const position = reactFlowInstance.screenToFlowPosition({
                x: event.clientX - reactFlowBounds.left,
                y: event.clientY - reactFlowBounds.top,
            });

            if (files.length > 0) {
                handleFiles(files, position);
            } else if (uriData || textData) {
                // It's a URL or pure text dragging
                const url = uriData || textData;
                const isUrl = url.startsWith("http");
                
                addNode({
                    id: `attachment-${Date.now()}`,
                    type: "attachment",
                    position,
                    data: {
                        type: isUrl ? "url" : "text",
                        title: isUrl ? "Web Link" : "Dropped Text",
                        url: isUrl ? url : undefined,
                        summary: isUrl ? url : textData.substring(0, 30) + "...",
                        content: textData
                    },
                });
            }
        },
        [reactFlowInstance, addNode]
    );

    const groupNodes = useConstellationStore((s) => s.groupNodes);
    const copySelected = useConstellationStore((s) => s.copySelected);
    const pasteCopied = useConstellationStore((s) => s.pasteCopied);

    const [isShiftDown, setIsShiftDown] = useState(false);
    const [isDraggingOver, setIsDraggingOver] = useState(false);

    const [isCutting, setIsCutting] = useState(false);
    const [cutLine, setCutLine] = useState<{ x: number; y: number }[]>([]);
    const [edgesToCut, setEdgesToCut] = useState<string[]>([]);
    const [isQuickConnecting, setIsQuickConnecting] = useState<string | null>(null);
    const [quickConnectStart, setQuickConnectStart] = useState<{ x: number; y: number } | null>(null);
    const [quickConnectTo, setQuickConnectTo] = useState<{ x: number; y: number } | null>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Shift') setIsShiftDown(true);
            if (e.key === 'Escape') {
                setIsCutting(false); setCutLine([]); setEdgesToCut([]);
                setIsQuickConnecting(null); setQuickConnectStart(null); setQuickConnectTo(null);
            }

            if (['input', 'textarea'].includes(document.activeElement?.tagName.toLowerCase() || '')) return;

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
                copySelected();
            }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
                pasteCopied();
            }
            if (e.key === 'Delete' || e.key === 'Backspace') {
                setTimeout(() => useConstellationStore.getState().deleteSelected(), 0);
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Shift') setIsShiftDown(false);
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [copySelected, pasteCopied]);

    const handleContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
    }, []);

    const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (e.button === 2) { 
            e.preventDefault();
            const elements = document.elementsFromPoint(e.clientX, e.clientY);
            const nodeEl = elements.find(el => el.closest('.react-flow__node'))?.closest('.react-flow__node');
            const rect = e.currentTarget.getBoundingClientRect();
            
            if (nodeEl) {
                const nodeId = nodeEl.getAttribute('data-id');
                const nodeType = nodes.find(n => n.id === nodeId)?.type;
                if (nodeId && (nodeType === 'group' || nodeType === 'chat')) {
                    setIsQuickConnecting(nodeId);
                    const pos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
                    setQuickConnectStart(pos);
                    setQuickConnectTo(pos);
                    e.currentTarget.setPointerCapture(e.pointerId);
                    return;
                }
            }

            setIsCutting(true);
            setCutLine([{ x: e.clientX - rect.left, y: e.clientY - rect.top }]);
            e.currentTarget.setPointerCapture(e.pointerId);
        }
    }, [nodes]);

    const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        if (isQuickConnecting) {
            setQuickConnectTo({ x: e.clientX - rect.left, y: e.clientY - rect.top });
            return;
        }

        if (!isCutting) return;
        
        setCutLine(prev => [...prev, { x: e.clientX - rect.left, y: e.clientY - rect.top }]);

        const elements = document.elementsFromPoint(e.clientX, e.clientY);
        for (const el of elements) {
            const edgeEl = el.closest('.react-flow__edge');
            if (edgeEl) {
                const edgeId = edgeEl.getAttribute('data-id');
                if (edgeId) {
                    setEdgesToCut(prev => prev.includes(edgeId) ? prev : [...prev, edgeId]);
                }
            }
        }
    }, [isCutting, isQuickConnecting]);

    const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (isQuickConnecting) {
            const elements = document.elementsFromPoint(e.clientX, e.clientY);
            const targetNodeEl = elements.find(el => el.closest('.react-flow__node'))?.closest('.react-flow__node');
            
            if (targetNodeEl) {
                const targetId = targetNodeEl.getAttribute('data-id');
                const targetType = nodes.find(n => n.id === targetId)?.type;
                if (targetId && targetId !== isQuickConnecting && (targetType === 'group' || targetType === 'chat')) {
                    useConstellationStore.getState().onConnect({
                        source: isQuickConnecting,
                        sourceHandle: null,
                        target: targetId,
                        targetHandle: null,
                    });
                }
            }
            setIsQuickConnecting(null);
            setQuickConnectStart(null);
            setQuickConnectTo(null);
            e.currentTarget.releasePointerCapture(e.pointerId);
            return;
        }

        if (isCutting) {
            if (edgesToCut.length > 0) {
                useConstellationStore.getState().onEdgesChange(edgesToCut.map(id => ({ type: 'remove', id })));
            }
            setIsCutting(false);
            setCutLine([]);
            setEdgesToCut([]);
            e.currentTarget.releasePointerCapture(e.pointerId);
        }
    }, [isCutting, edgesToCut, isQuickConnecting, nodes]);

    // Filter nodes for grouping
    const selectedAttachmentNodes = nodes.filter(n => n.selected && n.type === 'attachment' && !n.parentId);
    const canGroup = selectedAttachmentNodes.length > 1;

    const handleGroup = () => {
        if (canGroup) {
            groupNodes(selectedAttachmentNodes.map(n => n.id));
        }
    };

    const renderEdges = React.useMemo(() => {
        if (edgesToCut.length === 0) return edges;
        return edges.map(e => {
            if (edgesToCut.includes(e.id)) {
                return {
                    ...e,
                    style: {
                        ...e.style,
                        stroke: "var(--status-error)",
                        strokeWidth: 4,
                        filter: "drop-shadow(0 0 6px var(--status-error))",
                        zIndex: 1000
                    },
                    animated: true
                };
            }
            return e;
        });
    }, [edges, edgesToCut]);

    return (
        <div 
            className="flex-1 w-full h-full relative" 
            ref={reactFlowWrapper}
            onMouseMove={handleMouseMove}
            onDragEnter={() => setIsDraggingOver(true)}
            onDragLeave={onDragLeave}
            onContextMenu={handleContextMenu}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
        >
            <ReactFlow
                nodes={nodes}
                edges={renderEdges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onInit={setReactFlowInstance}
                onDrop={onDrop}
                onDragOver={onDragOver}
                nodeTypes={nodeTypes}
                deleteKeyCode={['Delete']}
                connectionMode={ConnectionMode.Loose}
                selectionMode={SelectionMode.Partial}
                proOptions={{ hideAttribution: true }}
                selectionOnDrag={true}
                panOnDrag={[1, 2]}
                onSelectionEnd={() => {
                    setTimeout(() => {
                        const currentNodes = useConstellationStore.getState().nodes;
                        const targets = currentNodes.filter(n => n.selected && n.type === 'attachment' && !n.parentId);
                        if (isShiftDown && targets.length > 1) {
                            groupNodes(targets.map(n => n.id));
                        }
                    }, 50);
                }}
                fitView
            >
                <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color="oklch(1 0 0 / 0.06)" />
                <Controls position="bottom-left" style={{
                    background: "#000000",
                    borderRadius: 8, 
                    border: "1px solid oklch(1 0.4 60 / 0.2)", 
                    overflow: "hidden",
                    marginLeft: 12,
                    marginBottom: 12
                }} className="shadow-xl" />
                <MiniMap style={minimapStyle} maskColor="oklch(0 0 0 / 0.5)" position="bottom-right" />
            </ReactFlow>

            {/* Edge Cutting Line SVG */}
            {isCutting && cutLine.length > 1 && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-[1000]">
                    <polyline
                        points={cutLine.map((p) => `${p.x},${p.y}`).join(" ")}
                        fill="none"
                        stroke="var(--status-error)"
                        strokeWidth="3"
                        strokeDasharray="6 4"
                    />
                </svg>
            )}

            {/* Quick Connect Line SVG */}
            {isQuickConnecting && quickConnectTo && quickConnectStart && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-[1000]">
                    <line
                        x1={quickConnectStart.x}
                        y1={quickConnectStart.y}
                        x2={quickConnectTo.x}
                        y2={quickConnectTo.y}
                        stroke="var(--accent-base)"
                        strokeWidth="3"
                        strokeDasharray="6 4"
                        className="opacity-70"
                    />
                </svg>
            )}

            <style jsx global>{`
                .react-flow__controls-button {
                    background: #000000 !important;
                    border-bottom: 1px solid rgba(255, 109, 41, 0.2) !important;
                    color: var(--accent-base) !important;
                    fill: var(--accent-base) !important;
                }
                .react-flow__controls-button svg {
                    fill: var(--accent-base) !important;
                }
                .react-flow__controls-button:hover {
                    background: rgba(255, 109, 41, 0.1) !important;
                }
            `}</style>

            {/* Guide Button */}
            <Button
                variant="outline"
                size="icon"
                className="absolute top-4 right-4 z-50 rounded-full w-10 h-10 bg-black/80 backdrop-blur-md shadow-lg border-border hover:bg-accent-base hover:text-black hover:border-accent-base transition-colors"
                onClick={() => setShowGuide(true)}
                title="How to use Constellation"
            >
                <HelpCircle className="w-5 h-5" />
            </Button>

            {/* Drop Overlay Indicator */}
            {isDraggingOver && (
                <div className="absolute inset-4 z-40 bg-accent-base/5 backdrop-blur-sm border-2 border-dashed border-accent-base rounded-2xl flex flex-col items-center justify-center animate-in fade-in transition-all pointer-events-none">
                    <div className="bg-background/90 p-6 rounded-2xl shadow-2xl flex flex-col items-center">
                        <UploadCloud className="w-12 h-12 text-accent-base mb-3 animate-bounce" />
                        <h2 className="text-xl font-bold text-accent-base">Drop to add Knowledge</h2>
                        <p className="text-xs text-muted-foreground mt-1 text-center max-w-[200px]">
                            Images, documents, excel, markdown, or plain URLs.
                        </p>
                    </div>
                </div>
            )}

            {/* Manual Upload FAB */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center">
                <input 
                    type="file" 
                    multiple 
                    ref={fileInputRef} 
                    className="hidden" 
                    onChange={(e) => {
                        if (e.target.files && reactFlowInstance) {
                            const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
                            const position = reactFlowInstance.screenToFlowPosition({
                                x: reactFlowBounds ? reactFlowBounds.left + reactFlowBounds.width / 2 : window.innerWidth / 2,
                                y: reactFlowBounds ? reactFlowBounds.top + reactFlowBounds.height / 2 : window.innerHeight / 2,
                            });
                            handleFiles(Array.from(e.target.files), position);
                            if (fileInputRef.current) fileInputRef.current.value = "";
                        }
                    }} 
                />
                <Button 
                    variant="default" 
                    className="rounded-full shadow-xl shadow-accent-base/10 bg-accent-base text-black hover:bg-accent-hover hover:scale-105 transition-transform w-[52px] h-[52px] p-0 flex items-center justify-center border-4 border-background"
                    onClick={() => fileInputRef.current?.click()}
                    title="Upload Files"
                >
                    <Plus className="w-6 h-6" />
                </Button>
            </div>

            {/* Guide Modal Overlay */}
            {showGuide && (
                <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-background border border-border rounded-xl shadow-2xl max-w-md w-full p-6 relative animate-in zoom-in-95">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="absolute top-2 right-2 text-muted-foreground hover:text-foreground hover:bg-white/5"
                            onClick={() => setShowGuide(false)}
                        >
                            <X className="w-4 h-4" />
                        </Button>
                        <h2 className="text-xl font-semibold mb-2 flex items-center gap-2 text-accent-base">
                            <HelpCircle className="w-5 h-5" />
                            How to use Constellation
                        </h2>
                        <ul className="space-y-4 text-sm text-foreground/90 mt-5 leading-relaxed">
                            <li className="flex gap-3">
                                <strong className="text-accent-base shrink-0 pt-0.5">1.</strong> 
                                <span><strong>Add Knowledge:</strong> Drag & drop files or web links anywhere on the canvas, or use the <strong>+</strong> button below to manually upload files from your PC.</span>
                            </li>
                            <li className="flex gap-3">
                                <strong className="text-accent-base shrink-0 pt-0.5">2.</strong> 
                                <span><strong>Group Nodes:</strong> Hold <kbd className="bg-white/10 px-1 py-0.5 mx-0.5 rounded border border-white/20 text-xs">Shift</kbd> and drag to box-select multiple nodes, or hold <kbd className="bg-white/10 px-1 py-0.5 mx-0.5 rounded border border-white/20 text-xs">Ctrl</kbd> (or Cmd) and click nodes to multi-select. A "Group Items" button will appear at the top.</span>
                            </li>
                            <li className="flex gap-3">
                                <strong className="text-accent-base shrink-0 pt-0.5">3.</strong> 
                                <span><strong>Spawn Agents:</strong> Click on a grouped cluster to reveal its toolbar, then click <strong>Spawn Chat</strong>. This creates an AI Node that draws knowledge directly from that group!</span>
                            </li>
                        </ul>
                        <div className="mt-6 pt-4 border-t border-border/50 text-right">
                            <Button className="bg-accent-base text-black hover:bg-accent-hover" onClick={() => setShowGuide(false)}>Got it!</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Selection Toolbar */}
            {canGroup && (
                <div className="absolute top-4 inset-x-0 mx-auto w-max z-10 animate-in slide-in-from-top-4 fade-in">
                    <div className="bg-background/90 backdrop-blur-xl border border-border shadow-2xl rounded-full px-4 py-2 flex items-center gap-4 ring-1 ring-white/5">
                        <span className="text-sm font-medium text-foreground">
                            {selectedAttachmentNodes.length} items selected
                        </span>
                        <div className="w-px h-4 bg-border" />
                        <button 
                            onClick={handleGroup}
                            className="text-sm font-semibold text-accent-base hover:text-accent-hover transition-colors"
                        >
                            Group Items
                        </button>
                    </div>
                </div>
            )}

            {/* Empty state hint */}
            {nodes.length === 0 && (
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-muted-foreground/50">
                    <p className="text-xl font-semibold mb-2">Knowledge Canvas is empty</p>
                    <p className="max-w-md text-center">
                        Drag and drop files, documents, or URLs here to start building your Constellation.
                    </p>
                </div>
            )}
        </div>
    );
}
