import React, { useState } from 'react';
import {
  Search,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  BookOpen,
  MessageSquare,
  X,
  Menu,
  PanelLeftOpen,
} from 'lucide-react';
import { GraphNode, GraphEdge, GraphNodeCategory } from '../types/mroya';

interface MemoryMapViewProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
  onOpenMemory: (memoryId: string) => void;
  onAskAboutNode: (node: GraphNode) => void;
  isSidebarCollapsed: boolean;
  onExpandSidebar: () => void;
  onOpenMobileMenu: () => void;
}

export const MemoryMapView: React.FC<MemoryMapViewProps> = ({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
  onOpenMemory,
  onAskAboutNode,
  isSidebarCollapsed,
  onExpandSidebar,
  onOpenMobileMenu,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | GraphNodeCategory>('all');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  if (!nodes.length) return <div className="flex-1 flex flex-col min-w-0 h-full bg-[var(--mroya-bg)] text-[var(--mroya-text)]"><header className="h-[58px] px-4 sm:px-6 border-b border-[var(--mroya-divider)] flex items-center gap-3"><button aria-label="Open navigation" onClick={onOpenMobileMenu} className="lg:hidden"><Menu className="w-5 h-5"/></button><h1 className="font-semibold">Memory Map</h1></header><p className="m-auto text-sm text-[var(--mroya-text-muted)]">No memories to map yet.</p></div>;

  const activeNode =
    nodes.find((n) => n.id === selectedNodeId) ||
    nodes.find((n) => n.id === 'node-redesign') ||
    nodes[0];

  const connectedEdges = edges.filter(
    (e) => e.source === activeNode.id || e.target === activeNode.id
  );

  const connectedNodeIds = new Set<string>([
    activeNode.id,
    ...connectedEdges.map((e) => (e.source === activeNode.id ? e.target : e.source)),
  ]);

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if ((e.target as HTMLElement).tagName === 'svg' || (e.target as HTMLElement).dataset.bg === 'true') {
      setIsDraggingCanvas(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDraggingCanvas) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDraggingCanvas(false);
  };

  const getNodeStroke = (cat: GraphNodeCategory, isSelected: boolean) => {
    if (isSelected) return 'var(--mroya-primary)';
    switch (cat) {
      case 'agreement':
        return 'var(--mroya-brand-honey)';
      case 'person':
        return 'var(--mroya-primary)';
      case 'event':
        return 'var(--mroya-input-outline)';
      default:
        return 'var(--mroya-divider)';
    }
  };

  const categoryLabels: Record<GraphNodeCategory, string> = {
    person: 'Person',
    agreement: 'Agreement',
    event: 'Commitment / Date',
    organization: 'Organization',
    preference: 'Preference / Rule',
  };

  return (
    <div className="flex-1 flex flex-col h-full min-w-0 bg-[var(--mroya-bg)] text-[var(--mroya-text)]">
      {/* Header */}
      <header className="h-[58px] px-4 sm:px-6 border-b border-[var(--mroya-divider)] flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="Open navigation"
            className="lg:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)]"
          >
            <Menu className="w-5 h-5" />
          </button>
          {isSidebarCollapsed && (
            <button
              type="button"
              onClick={onExpandSidebar}
              aria-label="Expand sidebar"
              className="hidden lg:inline-flex items-center justify-center w-8 h-8 rounded-lg text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] cursor-pointer"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          )}
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-[16px] font-semibold text-[var(--mroya-text)] truncate">
              Memory Map
            </h1>
            <span className="hidden sm:inline text-[var(--mroya-text-muted)]">·</span>
            <span className="hidden sm:inline text-[13px] text-[var(--mroya-text-muted)] tabular-nums">
              {nodes.length} nodes · {edges.length} relationships
            </span>
          </div>
        </div>

        {/* Search & Zoom Controls */}
        <div className="flex items-center gap-2">
          <div className="relative hidden sm:block w-60">
            <Search className="w-3.5 h-3.5 text-[var(--mroya-text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter graph nodes..."
              aria-label="Filter graph nodes"
              className="w-full pl-8 pr-7 py-1.5 rounded-[8px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] text-[12px] text-[var(--mroya-text)]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--mroya-text-muted)]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center rounded-[8px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] p-0.5">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(z + 0.15, 1.6))}
              title="Zoom in"
              aria-label="Zoom in"
              className="w-7 h-7 inline-flex items-center justify-center rounded text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(z - 0.15, 0.65))}
              title="Zoom out"
              aria-label="Zoom out"
              className="w-7 h-7 inline-flex items-center justify-center rounded text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] cursor-pointer"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
              title="Reset view"
              aria-label="Reset view"
              className="w-7 h-7 inline-flex items-center justify-center rounded text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Graph Workspace + Right Node Inspector */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        {/* Interactive Relationship Graph Canvas */}
        <div className="flex-1 relative bg-[var(--mroya-bg)] overflow-hidden flex flex-col">
          {/* Category Filter Bar */}
          <div className="px-4 py-2.5 border-b border-[var(--mroya-divider)]/60 flex items-center gap-1.5 overflow-x-auto bg-[var(--mroya-bg)]/90 z-10">
            {(
              [
                ['all', 'All entities'],
                ['person', 'People'],
                ['agreement', 'Agreements'],
                ['event', 'Commitments'],
                ['organization', 'Organizations'],
                ['preference', 'Preferences'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setCategoryFilter(key)}
                className={`px-3 py-1 rounded-[8px] text-[12px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  categoryFilter === key
                    ? 'bg-[var(--mroya-surface-active)] text-[var(--mroya-text)] font-semibold'
                    : 'text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex-1 relative select-none">
            <svg
              viewBox="0 0 820 560"
              className={`w-full h-full ${isDraggingCanvas ? 'cursor-grabbing' : 'cursor-grab'}`}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <rect
                width="820"
                height="560"
                fill="transparent"
                data-bg="true"
              />
              <g
                transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}
                style={{ transformOrigin: '410px 280px' }}
              >
                {/* Relationship Edges */}
                {edges.map((edge) => {
                  const sourceNode = nodes.find((n) => n.id === edge.source);
                  const targetNode = nodes.find((n) => n.id === edge.target);
                  if (!sourceNode || !targetNode) return null;

                  const isHighlighted =
                    edge.source === activeNode.id || edge.target === activeNode.id;

                  const midX = (sourceNode.x + targetNode.x) / 2;
                  const midY = (sourceNode.y + targetNode.y) / 2;

                  return (
                    <g key={edge.id}>
                      <line
                        x1={sourceNode.x}
                        y1={sourceNode.y}
                        x2={targetNode.x}
                        y2={targetNode.y}
                        stroke={
                          isHighlighted
                            ? 'var(--mroya-brand-honey)'
                            : 'var(--mroya-divider)'
                        }
                        strokeWidth={isHighlighted ? 2.2 : 1.2}
                        strokeOpacity={isHighlighted ? 0.95 : 0.55}
                      />
                      {isHighlighted && (
                        <text
                          x={midX}
                          y={midY - 6}
                          textAnchor="middle"
                          fill="var(--mroya-text-muted)"
                          fontSize="10"
                          fontWeight="500"
                        >
                          {edge.relationship}
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* Graph Nodes (sized by connection count) */}
                {nodes.map((node) => {
                  const isSelected = node.id === activeNode.id;
                  const isNeighbor = connectedNodeIds.has(node.id);
                  const matchesSearch =
                    !searchQuery.trim() ||
                    node.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    node.subtitle.toLowerCase().includes(searchQuery.toLowerCase());
                  const matchesCat =
                    categoryFilter === 'all' || node.category === categoryFilter;

                  const dimmed = !matchesSearch || !matchesCat || (!isNeighbor && !searchQuery);
                  const radius = 16 + node.connectionsCount * 2.4;

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${node.x}, ${node.y})`}
                      onClick={() => onSelectNode(node.id)}
                      className="cursor-pointer transition-opacity"
                      style={{ opacity: dimmed && !isSelected ? 0.42 : 1 }}
                    >
                      {/* Outer halo when selected */}
                      {isSelected && (
                        <circle
                          r={radius + 7}
                          fill="var(--mroya-brand-honey)"
                          fillOpacity={0.18}
                        />
                      )}

                      <circle
                        r={radius}
                        fill={
                          isSelected
                            ? 'var(--mroya-surface-active)'
                            : 'var(--mroya-surface)'
                        }
                        stroke={getNodeStroke(node.category, isSelected)}
                        strokeWidth={isSelected ? 2.8 : 1.8}
                      />

                      {/* Connection count badge inside node */}
                      <text
                        textAnchor="middle"
                        dy="4"
                        fill="var(--mroya-text)"
                        fontSize="11"
                        fontWeight="600"
                      >
                        {node.connectionsCount}
                      </text>

                      {/* Node Label below circle */}
                      <text
                        y={radius + 16}
                        textAnchor="middle"
                        fill="var(--mroya-text)"
                        fontSize={isSelected ? '13' : '12'}
                        fontWeight={isSelected ? '700' : '600'}
                      >
                        {node.label}
                      </text>
                      <text
                        y={radius + 30}
                        textAnchor="middle"
                        fill="var(--mroya-text-muted)"
                        fontSize="10.5"
                      >
                        {node.subtitle}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>

            <div className="absolute bottom-3 left-4 text-[12px] text-[var(--mroya-text-muted)] pointer-events-none">
              Click any node to inspect relationships · Drag canvas to pan
            </div>
          </div>
        </div>

        {/* Right Side Panel: Selected Node Details */}
        <aside className="w-full lg:w-[340px] border-t lg:border-t-0 lg:border-l border-[var(--mroya-divider)] bg-[var(--mroya-surface-muted)] p-4 sm:p-5 overflow-y-auto shrink-0 space-y-4">
          <div className="p-4 rounded-[12px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] space-y-3">
            <div className="text-[12px] text-[var(--mroya-text-muted)] flex items-center gap-1.5 tabular-nums">
              <span>{categoryLabels[activeNode.category]}</span>
              <span aria-hidden="true">·</span>
              <span>{activeNode.connectionsCount} connections</span>
            </div>

            <div>
              <h2 className="text-[17px] font-semibold text-[var(--mroya-text)]">
                {activeNode.label}
              </h2>
              <div className="text-[13px] text-[var(--mroya-text-muted)]">
                {activeNode.subtitle}
              </div>
            </div>

            <p className="text-[13px] text-[var(--mroya-text)] leading-[20px]">
              {activeNode.summary}
            </p>

            <div className="pt-2.5 border-t border-[var(--mroya-divider)] text-[12px] text-[var(--mroya-text-muted)] tabular-nums">
              Source: {activeNode.source} · {activeNode.dateRecorded}
            </div>

            <div className="pt-2 flex flex-col gap-2">
              {activeNode.linkedMemoryId && (
                <button
                  type="button"
                  onClick={() => onOpenMemory(activeNode.linkedMemoryId!)}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-[8px] bg-[var(--mroya-surface-muted)] hover:bg-[var(--mroya-surface-active)] text-[13px] font-semibold text-[var(--mroya-text)] transition-colors cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5 text-[var(--mroya-primary)]" />
                  <span>Open linked entry in Memory</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => onAskAboutNode(activeNode)}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-full bg-[var(--mroya-primary)] hover:bg-[var(--mroya-primary-hover)] text-[var(--mroya-on-primary)] text-[13px] font-semibold transition-colors cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Ask Mroya in Chat</span>
              </button>
            </div>
          </div>

          {/* Connected Nodes List */}
          <div className="space-y-2">
            <h3 className="text-[12px] font-semibold text-[var(--mroya-text-muted)]">
              Direct relationships ({connectedEdges.length})
            </h3>
            <div className="space-y-1.5">
              {connectedEdges.map((edge) => {
                const otherId =
                  edge.source === activeNode.id ? edge.target : edge.source;
                const otherNode = nodes.find((n) => n.id === otherId);
                if (!otherNode) return null;
                return (
                  <button
                    key={edge.id}
                    type="button"
                    onClick={() => onSelectNode(otherNode.id)}
                    className="w-full text-left p-2.5 rounded-[10px] bg-[var(--mroya-surface)] hover:bg-[var(--mroya-surface-active)] border border-[var(--mroya-divider)] transition-colors cursor-pointer"
                  >
                    <div className="text-[13px] font-semibold text-[var(--mroya-text)]">
                      {otherNode.label}
                    </div>
                    <div className="text-[12px] text-[var(--mroya-text-muted)]">
                      {edge.relationship} · {otherNode.subtitle}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
