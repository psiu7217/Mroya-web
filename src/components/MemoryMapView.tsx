import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Menu,
  PanelLeftOpen,
  Search,
  X,
  Maximize2,
  Plus,
  Minus,
  Scan,
  BookOpen,
  MessageSquare,
  Crosshair,
  Download,
  Sparkles,
  ChevronDown,
} from 'lucide-react';
import type { GraphNode, GraphEdge } from '../types/mroya';
import { createMemoryMapRenderer, defaults } from './memory-map/renderer.js';
import { renderGraph } from './memory-map/mapModel';
import { presentationGraph } from './memory-map/graph.js';
import { mapNodeLabel } from './memory-map/palette.js';
import './memory-map/memory-map.css';

interface MemoryMapViewProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  onOpenMemory: (id: string) => void;
  onAskAboutNode: (node: GraphNode) => void;
  isSidebarCollapsed: boolean;
  onExpandSidebar: () => void;
  onOpenMobileMenu: () => void;
  loading?: boolean;
  error?: string | null;
  theme?: 'light' | 'dark';
  displayName?: string;
}

type Renderer = Awaited<ReturnType<typeof createMemoryMapRenderer>>;

const relation = (n: { predicate?: string; relationship?: string; polarity?: string }) =>
  `${n.polarity === 'negative' ? 'Not ' : ''}${n.predicate || n.relationship || ''}`;

/** One Pixi scene for offline Studio and live Mroya; only typed props/actions cross this boundary. */
export function MemoryMapView({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
  onOpenMemory,
  onAskAboutNode,
  isSidebarCollapsed,
  onExpandSidebar,
  onOpenMobileMenu,
  loading,
  error,
  theme = 'dark',
  displayName = '',
}: MemoryMapViewProps) {
  const host = useRef<HTMLDivElement>(null);
  const renderer = useRef<Renderer | null>(null);
  const [ready, setReady] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const selection = selectedNodeId;
  const [mode, setMode] = useState<'global' | 'local'>('global');
  const [depth, setDepth] = useState(2);
  const [hideSelf, setHideSelf] = useState(false);
  const [showcase, setShowcase] = useState(false);
  const [query, setQuery] = useState('');
  const [force, setForce] = useState({ ...defaults });
  const [count, setCount] = useState(0);
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  const [download, setDownload] = useState<{ url: string; name: string } | null>(null);
  const [hint, setHint] = useState('Drag to explore · Scroll to zoom · Select to inspect');
  const search = useRef<HTMLInputElement>(null);

  const graph = useMemo(() => renderGraph(nodes, edges), [nodes, edges]);
  const display = useMemo(() => {
    const filtered = presentationGraph(graph, hideSelf);
    return {...filtered, nodes: filtered.nodes.map(node => ({...node, label: mapNodeLabel(node, displayName)}))};
  }, [graph, hideSelf, displayName]);
  const active = display.nodes.find((n) => n.id === selection);

  const callbacks = useRef({ onSelectNode });
  callbacks.current = { onSelectNode };

  // Dataset/filter reconciliation can emit null inside Pixi. Only user actions clear
  // the controlled ID; an absent node may still be arriving (or be truncated/hidden).
  const synchronizing = useRef(false);
  const updateRenderer = (update: (instance: Renderer) => void) => {
    if (!renderer.current) return;
    synchronizing.current = true;
    try {
      update(renderer.current);
    } finally {
      synchronizing.current = false;
    }
  };

  useEffect(() => {
    let cancelled = false;
    let instance: Renderer | null = null;
    createMemoryMapRenderer(host.current!, {
      onSelect: (id) => {
        if (cancelled || synchronizing.current) return;
        callbacks.current.onSelectNode(id);
        if (id === null) setMode('global');
      },
      onTooltip: (v) => {
        if (!cancelled) setTooltip(v);
      },
      onCount: (n) => {
        if (!cancelled) setCount(n);
      },
      onExport: (v) => {
        if (!cancelled) setDownload(v);
      },
      onHint: (v) => {
        if (!cancelled) setHint(v);
      },
    })
      .then((value) => {
        instance = value;
        if (cancelled) {
          value.destroy();
          return;
        }
        renderer.current = value;
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          setRenderError(
            'The map could not be rendered. WebGL may be unavailable. Your memories are still available in Memory.'
          );
        }
      });
    return () => {
      cancelled = true;
      instance?.destroy();
      renderer.current = null;
    };
  }, []);

  useEffect(() => {
    if (ready) renderer.current?.setPresentation({theme, displayName});
  }, [ready, theme, displayName]);

  useEffect(() => {
    if (ready && !loading) updateRenderer((r) => r.setGraph(graph));
  }, [ready, graph, loading]);

  useEffect(() => {
    if (ready) updateRenderer((r) => r.setOptions({ mode, depth, hideSelf, showcase }));
  }, [ready, graph, mode, depth, hideSelf, showcase]);

  useEffect(() => {
    if (ready && !loading) updateRenderer((r) => r.select(active?.id ?? null));
  }, [ready, display, selection, loading, mode, depth]);

  useEffect(() => {
    if (ready) renderer.current?.setForce(force);
  }, [ready, force]);

  const choose = (id: string, focus = true) => {
    onSelectNode(id);
    updateRenderer((r) => r.select(id, focus));
    setQuery('');
  };

  const close = () => {
    onSelectNode(null);
    setMode('global');
  };

  const stateMessage = loading
    ? 'Connecting your memories…'
    : (error && !nodes.length ? error : null) ||
      renderError ||
      (!nodes.length
        ? 'Your map will grow as Mroya remembers more about your world.'
        : !ready
        ? 'Preparing your memory map…'
        : !display.nodes.length
        ? 'No nodes remain with Hide Self enabled.'
        : null);

  const matches = query.trim()
    ? display.nodes
        .filter((n) => n.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
        .slice(0, 8)
    : [];

  const facts = active ? display.edges.filter((e) => e.source === active.id && e.type === 'memory') : [];
  const outgoing = active ? display.edges.filter((e) => e.source === active.id && e.type === 'relation') : [];
  const incoming = active ? display.edges.filter((e) => e.target === active.id && e.type === 'relation') : [];

  const section = (title: string, relations: typeof display.edges, inbound = false) =>
    relations.length > 0 && (
      <section className="map-detail-section">
        <h3>{title}</h3>
        {relations.map((e) => {
          const target = display.nodes.find((n) => n.id === (inbound ? e.source : e.target));
          return (
            <div className="map-detail-row" key={e.id}>
              {target && (
                <button type="button" className="map-detail-link" onClick={() => choose(target.id)}>
                  {target.label}
                </button>
              )}
              <small>{relation(e)}</small>
            </div>
          );
        })}
      </section>
    );

  return (
    <section
      className={`mroya-memory-map${showcase ? ' map-showcase' : ''}`}
      data-map-theme={theme}
      aria-label="Memory Map"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          if (showcase) setShowcase(false);
          else {
            setQuery('');
            close();
          }
        }
        if (e.key === '/' && !(e.target instanceof HTMLInputElement)) {
          e.preventDefault();
          search.current?.focus();
        }
      }}
    >
      <header className="map-heading">
        <div className="map-heading-title">
          <button
            type="button"
            className="map-nav-button map-mobile-menu"
            aria-label="Open navigation"
            onClick={onOpenMobileMenu}
          >
            <Menu size={18} />
          </button>
          {isSidebarCollapsed && (
            <button
              type="button"
              className="map-nav-button"
              aria-label="Expand sidebar"
              onClick={onExpandSidebar}
            >
              <PanelLeftOpen size={18} />
            </button>
          )}
          <div>
            <p className="map-eyebrow">MROYA <span>/</span> MEMORY</p>
            <h1>
              <span>Memory Map</span>
              <span className="map-heading-dot">.</span>
            </h1>
            <p>The people, places and details that make up your world.</p>
          </div>
        </div>

        <button
          type="button"
          className="map-primary-button"
          onClick={() => setShowcase(true)}
        >
          <Maximize2 size={13} />
          <span>Showcase</span>
        </button>
      </header>

      <div className="map-workspace-wrap">
        <div className="map-workspace">
          <div
            ref={host}
            className="map-canvas"
            role="img"
            aria-label="Interactive graph of your personal memories. Use search and Memory for non-visual navigation."
          >
            <ul className="sr-only" aria-label="Memory nodes">
              {display.nodes.map((n) => (
                <li key={n.id}>{n.label}</li>
              ))}
            </ul>
          </div>
          <div className="map-halo map-halo-one" aria-hidden="true" />
          <div className="map-halo map-halo-two" aria-hidden="true" />

          {/* Map Toolbar (Top-Left) */}
          <div className="map-toolbar" aria-label="Map controls">
            <div className="map-toolbar-line">
              <span className="map-live-dot" />
              <span>YOUR UNIVERSE</span>
              <span className="map-toolbar-divider" />
              <span className="map-visible-count">{count} nodes</span>
            </div>

            <div className="map-mode" role="group" aria-label="Graph mode">
              <button
                type="button"
                className={mode === 'global' ? 'active' : ''}
                aria-pressed={mode === 'global'}
                onClick={() => setMode('global')}
              >
                Global
              </button>
              <button
                type="button"
                className={mode === 'local' ? 'active' : ''}
                aria-pressed={mode === 'local'}
                disabled={!display.nodes.length}
                onClick={() => {
                  if (!active) {
                    const first =
                      display.nodes.find((n) => n.type === 'entity' && n.degree > 0) ||
                      display.nodes[0];
                    if (first) choose(first.id, false);
                  }
                  setMode('local');
                }}
              >
                Local
              </button>
              <select
                aria-label="Local graph depth"
                value={depth}
                onChange={(e) => setDepth(Number(e.target.value))}
              >
                <option value={1}>1 hop</option>
                <option value={2}>2 hops</option>
              </select>
            </div>

            <label className="map-search-wrap">
              <span className="map-search-icon">
                <Search size={13} />
              </span>
              <input
                ref={search}
                type="search"
                placeholder="Find a person, place, memory…"
                autoComplete="off"
                maxLength={100}
                aria-label="Search map nodes"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <kbd>/</kbd>
            </label>

            {query.trim() && (
              <div className="map-search-results">
                {matches.length ? (
                  matches.map((n) => (
                    <button type="button" key={n.id} onClick={() => choose(n.id)}>
                      <span>{n.label}</span>
                      <small>{n.kind || n.predicate}</small>
                    </button>
                  ))
                ) : (
                  <p>No matching nodes</p>
                )}
              </div>
            )}

            <details className="map-force">
              <summary>
                <span>Graph settings</span>
                <ChevronDown size={12} />
              </summary>
              {graph.nodes.some((n) => n.is_self) && (
                <label className="map-hide-self">
                  <span>
                    Hide Self <small>Experimental</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={hideSelf}
                    onChange={(e) => setHideSelf(e.target.checked)}
                  />
                </label>
              )}
              {(
                [
                  ['repulsion', 'Repulsion', 80, 500],
                  ['linkDistance', 'Link distance', 60, 220],
                  ['center', 'Center pull', 0, 100],
                ] as const
              ).map(([key, label, min, max]) => (
                <label key={key}>
                  {label}
                  <input
                    aria-label={label}
                    type="range"
                    min={min}
                    max={max}
                    value={force[key]}
                    onChange={(e) => setForce({ ...force, [key]: Number(e.target.value) })}
                  />
                </label>
              ))}
              <button type="button" onClick={() => setForce({ ...defaults })}>
                Reset defaults
              </button>
            </details>
          </div>

          {/* Export Controls (Top-Right) */}
          <div className="map-right-controls">
            <label className="map-export-label">
              <Download size={13} />
              <span>Export image</span>
              <select
                aria-label="Export map image resolution"
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    const [w, h] = e.target.value.split('x').map(Number);
                    renderer.current?.exportImage(w, h);
                  }
                }}
              >
                <option value="">Choose size…</option>
                <option value="1920x1080">Full HD · 1920 × 1080</option>
                <option value="2560x1440">QHD · 2560 × 1440</option>
                <option value="3840x2160">4K · 3840 × 2160</option>
                <option value="2160x2160">Square · 2160 × 2160</option>
              </select>
            </label>
          </div>

          {download && (
            <a className="map-download-link" href={download.url} download={download.name}>
              <Download size={13} />
              <span>Download PNG ↓</span>
            </a>
          )}

          {/* Detail Sidebar (Selected Node Inspector) */}
          {active && (
            <aside className="map-sidebar" aria-label="Selected memory detail">
              <button
                className="map-sidebar-close"
                type="button"
                aria-label="Close detail"
                onClick={close}
              >
                <X size={16} />
              </button>
              <p className="map-detail-eyebrow">
                {active.type === 'entity' ? 'Entity · current memory' : 'Memory · current claim'}
              </p>
              <h2>{active.type === 'entity' ? active.label : relation(active) || active.label}</h2>
              <p className="map-detail-kind">{active.type === 'entity' ? active.kind : active.literal_type}</p>

              {active.type === 'memory' && (
                <>
                  <p className="map-detail-main-value">{active.label}</p>
                  {active.subject && display.nodes.some((n) => n.id === active.subject) && (
                    <section className="map-detail-section">
                      <h3>About</h3>
                      <button
                        type="button"
                        className="map-detail-link"
                        onClick={() => choose(active.subject!)}
                      >
                        {display.nodes.find((n) => n.id === active.subject)?.label}
                      </button>
                    </section>
                  )}
                </>
              )}

              {(active.valid_from ||
                active.valid_to ||
                active.learned_at ||
                active.evidence_count !== undefined) && (
                <section className="map-detail-section">
                  <h3>Context</h3>
                  {(active.valid_from || active.valid_to) && (
                    <p className="map-detail-note">
                      Effective: {active.valid_from || '…'} — {active.valid_to || '…'}
                    </p>
                  )}
                  {active.learned_at && (
                    <p className="map-detail-note">Learned: {active.learned_at}</p>
                  )}
                  {active.evidence_count !== undefined && (
                    <p className="map-detail-note">{active.evidence_count} sources</p>
                  )}
                </section>
              )}

              <div className="map-detail-actions">
                {active.linkedMemoryId && (
                  <button type="button" onClick={() => onOpenMemory(active.linkedMemoryId!)}>
                    <BookOpen size={13} />
                    <span>Open Memory</span>
                  </button>
                )}
                <button type="button" onClick={() => onAskAboutNode(active)}>
                  <MessageSquare size={13} />
                  <span>Ask in Chat</span>
                </button>
                <button type="button" onClick={() => renderer.current?.select(active.id, true)}>
                  <Crosshair size={13} />
                  <span>Center node</span>
                </button>
              </div>

              {section('Current facts', facts)}
              {section('Connections from', outgoing)}
              {section('Connected by', incoming, true)}

              {active.type === 'entity' && (
                <p className="map-detail-note">
                  {active.memory_count} memories · {active.degree} connections
                </p>
              )}
            </aside>
          )}

          {/* Bottom Left Stats */}
          <div className="map-bottom-left">
            <div>
              <strong>
                {display.stats.entities} entities · {display.stats.memories} memories ·{' '}
                {display.stats.connections} connections
              </strong>
              <span>{hint}</span>
            </div>
          </div>

          {/* Bottom Right Zoom & Fit Controls */}
          <div className="map-bottom-right">
            <button
              type="button"
              aria-label="Zoom in"
              onClick={() => renderer.current?.zoom(1.2)}
            >
              <Plus size={14} />
            </button>
            <button
              type="button"
              aria-label="Zoom out"
              onClick={() => renderer.current?.zoom(0.82)}
            >
              <Minus size={14} />
            </button>
            <button
              type="button"
              aria-label="Fit graph to view"
              onClick={() => renderer.current?.fit()}
            >
              <Scan size={14} />
            </button>
          </div>

          {tooltip && (
            <div className="map-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
              {tooltip.text}
            </div>
          )}

          {stateMessage && (
            <div className="map-state" role="status">
              {(loading || (!ready && !renderError)) && <span className="map-loader" />}
              <p>{stateMessage}</p>
            </div>
          )}

          {/* Showcase Controls and Branding */}
          <div className="map-showcase-brand" aria-hidden="true">
            <Sparkles size={16} className="text-[var(--mroya-brand-honey)]" />
            <div>
              <strong>My Memory Map</strong>
              <small>
                MROYA · {display.stats.entities} ENTITIES · {display.stats.memories} MEMORIES
              </small>
            </div>
          </div>

          <button
            className="map-showcase-export"
            type="button"
            onClick={() => renderer.current?.exportImage(3840, 2160)}
          >
            <Download size={13} />
            <span>Export 4K</span>
          </button>

          <button
            className="map-showcase-exit"
            type="button"
            onClick={() => setShowcase(false)}
          >
            <X size={13} />
            <span>Exit showcase</span>
          </button>
        </div>
      </div>
    </section>
  );
}
