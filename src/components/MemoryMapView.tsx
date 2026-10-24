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
import {tr} from '../i18n';
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

type Renderer = Awaited<ReturnType<(typeof import("./memory-map/renderer.js"))["createMemoryMapRenderer"]>>;

const relation = (n: { predicate?: string; relationship?: string; polarity?: string }) =>
  `${n.polarity === 'negative' ? tr('not',{ns:'memory'})+' ' : ''}${n.predicate || n.relationship || ''}`;
const localizeMapHint=(value:string)=>{
  if(value==='Drag to explore · Scroll to zoom · Select to inspect')return tr('mapHint',{ns:'memory'});
  if(value==='Image export is unavailable in this browser.')return tr('exportUnavailable',{ns:'memory'});
  if(value==='Image export failed dimension verification.')return tr('exportFailed',{ns:'memory'});
  const rendering=/^Rendering (.+) PNG locally…$/.exec(value);if(rendering)return tr('renderingExport',{ns:'memory',size:rendering[1]});
  const done=/^(.+) PNG verified · download locally$/.exec(value);if(done)return tr('exportVerified',{ns:'memory',size:done[1]});
  return value;
};

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
    const initialization = new AbortController();
    let loadingModule = true;
    let instance: Renderer | null = null;
    // Pixi and the force layout load only when the map mounts instead of in the initial bundle.
    void (async () => {
      try {
        const { createMemoryMapRenderer } = await import('./memory-map/renderer.js');
        if (cancelled) return;
        loadingModule = false;
        const value = await createMemoryMapRenderer(host.current!, {
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
        }, initialization.signal);
        instance = value;
        if (cancelled) {
          value.destroy();
          return;
        }
        renderer.current = value;
        setReady(true);
      } catch {
        if (!cancelled) {
          setRenderError(
            tr(loadingModule?'renderFailedLoad':'renderFailed',{ns:'memory'})
          );
        }
      }
    })();
    return () => {
      cancelled = true;
      initialization.abort();
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
    ? tr('connecting',{ns:'memory'})
    : (error && !nodes.length ? error : null) ||
      renderError ||
      (!nodes.length
        ? tr('mapEmpty',{ns:'memory'})
        : !ready
        ? tr('preparing',{ns:'memory'})
        : !display.nodes.length
        ? tr('noNodesHideSelf',{ns:'memory'})
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
      aria-label={tr('map',{ns:'memory'})}
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
            aria-label={tr('openNavigation',{ns:'common'})}
            onClick={onOpenMobileMenu}
          >
            <Menu size={18} />
          </button>
          {isSidebarCollapsed && (
            <button
              type="button"
              className="map-nav-button"
              aria-label={tr('expandSidebar',{ns:'common'})}
              onClick={onExpandSidebar}
            >
              <PanelLeftOpen size={18} />
            </button>
          )}
          <div>
            <p className="map-eyebrow">MROYA <span>/</span> {tr('mapEyebrow',{ns:'memory'})}</p>
            <h1>
              <span>{tr('map',{ns:'memory'})}</span>
              <span className="map-heading-dot">.</span>
            </h1>
            <p>{tr('mapDescription',{ns:'memory'})}</p>
          </div>
        </div>

        <button
          type="button"
          className="map-primary-button"
          onClick={() => setShowcase(true)}
        >
          <Maximize2 size={13} />
          <span>{tr('showcase',{ns:'memory'})}</span>
        </button>
      </header>

      <div className="map-workspace-wrap">
        <div className="map-workspace">
          <div
            ref={host}
            className="map-canvas"
            role="img"
            aria-label={tr('graph',{ns:'memory'})}
          >
            <ul className="sr-only" aria-label={tr('nodes',{ns:'memory'})}>
              {display.nodes.map((n) => (
                <li key={n.id}>{n.label}</li>
              ))}
            </ul>
          </div>
          <div className="map-halo map-halo-one" aria-hidden="true" />
          <div className="map-halo map-halo-two" aria-hidden="true" />

          {/* Map Toolbar (Top-Left) */}
          <div className="map-toolbar" aria-label={tr('mapControls',{ns:'memory'})}>
            <div className="map-toolbar-line">
              <span className="map-live-dot" />
              <span>{tr('universe',{ns:'memory'})}</span>
              <span className="map-toolbar-divider" />
              <span className="map-visible-count">{tr('nodeCount',{ns:'memory',count})}</span>
            </div>

            <div className="map-mode" role="group" aria-label={tr('graphMode',{ns:'memory'})}>
              <button
                type="button"
                className={mode === 'global' ? 'active' : ''}
                aria-pressed={mode === 'global'}
                onClick={() => setMode('global')}
              >
                {tr('global',{ns:'memory'})}
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
                {tr('local',{ns:'memory'})}
              </button>
              <select
                aria-label={tr('localGraphDepth',{ns:'memory'})}
                value={depth}
                onChange={(e) => setDepth(Number(e.target.value))}
              >
                <option value={1}>{tr('hops',{ns:'memory',count:1})}</option>
                <option value={2}>{tr('hops',{ns:'memory',count:2})}</option>
              </select>
            </div>

            <label className="map-search-wrap">
              <span className="map-search-icon">
                <Search size={13} />
              </span>
              <input
                ref={search}
                type="search"
                placeholder={tr('searchMap',{ns:'memory'})}
                autoComplete="off"
                maxLength={100}
                aria-label={tr('searchNodes',{ns:'memory'})}
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
                  <p>{tr('noMatchingNodes',{ns:'memory'})}</p>
                )}
              </div>
            )}

            <details className="map-force">
              <summary>
                <span>{tr('graphSettings',{ns:'memory'})}</span>
                <ChevronDown size={12} />
              </summary>
              {graph.nodes.some((n) => n.is_self) && (
                <label className="map-hide-self">
                  <span>
                    {tr('hideSelf',{ns:'memory'})} <small>{tr('experimental',{ns:'memory'})}</small>
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
                  ['repulsion', tr('repulsion',{ns:'memory'}), 80, 500],
                  ['linkDistance', tr('linkDistance',{ns:'memory'}), 60, 220],
                  ['center', tr('centerPull',{ns:'memory'}), 0, 100],
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
                {tr('resetDefaults',{ns:'memory'})}
              </button>
            </details>
          </div>

          {/* Export Controls (Top-Right) */}
          <div className="map-right-controls">
            <label className="map-export-label">
              <Download size={13} />
              <span>{tr('exportImage',{ns:'memory'})}</span>
              <select
                aria-label={tr('exportResolution',{ns:'memory'})}
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    const [w, h] = e.target.value.split('x').map(Number);
                    renderer.current?.exportImage(w, h);
                  }
                }}
              >
                <option value="">{tr('chooseSize',{ns:'memory'})}</option>
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
              <span>{tr('downloadPng',{ns:'memory'})}</span>
            </a>
          )}

          {/* Detail Sidebar (Selected Node Inspector) */}
          {active && (
            <aside className="map-sidebar" aria-label={tr('selectedMemory',{ns:'memory'})}>
              <button
                className="map-sidebar-close"
                type="button"
                aria-label={tr('closeDetail',{ns:'memory'})}
                onClick={close}
              >
                <X size={16} />
              </button>
              <p className="map-detail-eyebrow">
                {active.type === 'entity' ? tr('entityCurrent',{ns:'memory'}) : tr('memoryClaim',{ns:'memory'})}
              </p>
              <h2>{active.type === 'entity' ? active.label : relation(active) || active.label}</h2>
              <p className="map-detail-kind">{active.type === 'entity' ? active.kind : active.literal_type}</p>

              {active.type === 'memory' && (
                <>
                  <p className="map-detail-main-value">{active.label}</p>
                  {active.subject && display.nodes.some((n) => n.id === active.subject) && (
                    <section className="map-detail-section">
                      <h3>{tr('about',{ns:'memory'})}</h3>
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
                  <h3>{tr('context',{ns:'memory'})}</h3>
                  {(active.valid_from || active.valid_to) && (
                    <p className="map-detail-note">
                      {tr('effective',{ns:'memory'})}: {active.valid_from || '…'} — {active.valid_to || '…'}
                    </p>
                  )}
                  {active.learned_at && (
                    <p className="map-detail-note">{tr('learned',{ns:'memory'})}: {active.learned_at}</p>
                  )}
                  {active.evidence_count !== undefined && (
                    <p className="map-detail-note">{tr('sourceCount',{ns:'memory',count:active.evidence_count})}</p>
                  )}
                </section>
              )}

              <div className="map-detail-actions">
                {active.linkedMemoryId && (
                  <button type="button" onClick={() => onOpenMemory(active.linkedMemoryId!)}>
                    <BookOpen size={13} />
                    <span>{tr('openMemory',{ns:'memory'})}</span>
                  </button>
                )}
                <button type="button" onClick={() => onAskAboutNode(active)}>
                  <MessageSquare size={13} />
                  <span>{tr('askInChat',{ns:'memory'})}</span>
                </button>
                <button type="button" onClick={() => renderer.current?.select(active.id, true)}>
                  <Crosshair size={13} />
                  <span>{tr('centerNode',{ns:'memory'})}</span>
                </button>
              </div>

              {section(tr('currentFacts',{ns:'memory'}), facts)}
              {section(tr('connectionsFrom',{ns:'memory'}), outgoing)}
              {section(tr('connectedBy',{ns:'memory'}), incoming, true)}

              {active.type === 'entity' && (
                <p className="map-detail-note">
                  {tr('memoryConnectionsCount',{ns:'memory',memories:active.memory_count,connections:active.degree})}
                </p>
              )}
            </aside>
          )}

          {/* Bottom Left Stats */}
          <div className="map-bottom-left">
            <div>
              <strong>
                {tr('graphStats',{ns:'memory',entities:display.stats.entities,memories:display.stats.memories,connections:display.stats.connections})}
              </strong>
              <span>{localizeMapHint(hint)}</span>
            </div>
          </div>

          {/* Bottom Right Zoom & Fit Controls */}
          <div className="map-bottom-right">
            <button
              type="button"
              aria-label={tr('zoomIn',{ns:'memory'})}
              onClick={() => renderer.current?.zoom(1.2)}
            >
              <Plus size={14} />
            </button>
            <button
              type="button"
              aria-label={tr('zoomOut',{ns:'memory'})}
              onClick={() => renderer.current?.zoom(0.82)}
            >
              <Minus size={14} />
            </button>
            <button
              type="button"
              aria-label={tr('fitGraph',{ns:'memory'})}
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
                <strong>{tr('myMap',{ns:'memory'})}</strong>
              <small>
                MROYA · {tr('showcaseStats',{ns:'memory',entities:display.stats.entities,memories:display.stats.memories})}
              </small>
            </div>
          </div>

          <button
            className="map-showcase-export"
            type="button"
            onClick={() => renderer.current?.exportImage(3840, 2160)}
          >
            <Download size={13} />
            <span>{tr('export4k',{ns:'memory'})}</span>
          </button>

          <button
            className="map-showcase-exit"
            type="button"
            onClick={() => setShowcase(false)}
          >
            <X size={13} />
            <span>{tr('exitShowcase',{ns:'memory'})}</span>
          </button>
        </div>
      </div>
    </section>
  );
}
