import React, { useState } from 'react';
import { DialogFocus } from './DialogFocus';
import {
  Search,
  Plus,
  Edit3,
  Trash2,
  Share2,
  FileText,
  Check,
  X,
  Menu,
  MessageSquare,
  Sparkles,
  Brain,
  Calendar as CalendarIcon,
  Mail,
  Send,
  AlertCircle,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Inbox,
  RefreshCw,
  RotateCcw,
  Users,
  User,
  ArrowRight,
} from 'lucide-react';
import { MemoryItem, MemoryCategory } from '../types/mroya';
import type {MemoryInboxPresentation} from '../types/memoryInbox';

export interface MemoryViewProps {
  inbox?: MemoryInboxPresentation;
  readOnly?: boolean;
  memories: MemoryItem[];
  selectedMemoryId: string | null;
  onSelectMemory: (id: string) => void;
  onUpdateMemory: (updated: MemoryItem) => void;
  onForgetMemory: (id: string) => void;
  onAddMemory: (item: Omit<MemoryItem, 'id'>) => void;
  onExploreInMap: (nodeId: string) => void;
  onAskMroyaAbout: (memory: MemoryItem) => void;
  isSidebarCollapsed: boolean;
  onExpandSidebar: () => void;
  onOpenMobileMenu: () => void;
}

const CATEGORIES: ('All' | MemoryCategory)[] = [
  'All',
  'Agreements & Decisions',
  'People & Clients',
  'Dates & Commitments',
  'Preferences',
];

export const MemoryView: React.FC<MemoryViewProps> = ({
  readOnly=false,
  inbox,
  memories,
  selectedMemoryId,
  onSelectMemory,
  onUpdateMemory,
  onForgetMemory,
  onAddMemory,
  onExploreInMap,
  onAskMroyaAbout,
  isSidebarCollapsed,
  onExpandSidebar,
  onOpenMobileMenu,
}) => {
  // Main Navigation: 'memories' | 'inbox'
  const [activeMainTab, setActiveMainTab] = useState<'memories' | 'inbox'>('memories');

  // Memories tab state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'All' | MemoryCategory>('All');
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [editDetails, setEditDetails] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // New memory modal inputs
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<MemoryCategory>('Agreements & Decisions');
  const [newSummary, setNewSummary] = useState('');
  const [newEntities, setNewEntities] = useState('');

  const inboxAvailable=inbox?.available===true;
  const showInbox=inboxAvailable&&activeMainTab==='inbox';
  const proposals=inboxAvailable?inbox.proposals:[];
  const inboxFilter=inbox?.preview?.filter??'all';
  const inboxLoading=inboxFilter==='loading'||!!inbox?.loading&&proposals.length===0;
  const [comments,setComments]=useState<{scope:string|undefined;drafts:Record<string,{open:boolean;text:string}>}>({scope:inbox?.scopeKey,drafts:{}});
  const drafts=comments.scope===inbox?.scopeKey?comments.drafts:{};
  const pendingProposalsCount=proposals.filter(p=>p.status==='new'||p.status==='pending').length;

  const filteredMemories = memories.filter((m) => {
    const matchesCat = activeCategory === 'All' || m.category === activeCategory;
    if (!matchesCat) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.title.toLowerCase().includes(q) ||
      m.summary.toLowerCase().includes(q) ||
      m.details.toLowerCase().includes(q) ||
      m.entities.some((ent) => ent.toLowerCase().includes(q))
    );
  });

  const activeMemory =
    memories.find((m) => m.id === selectedMemoryId) || filteredMemories[0] || null;

  const startEditing = (mem: MemoryItem) => {
    if(readOnly)return;
    setEditTitle(mem.title);
    setEditSummary(mem.summary);
    setEditDetails(mem.details);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (!activeMemory) return;
    onUpdateMemory({
      ...activeMemory,
      title: editTitle.trim() || activeMemory.title,
      summary: editSummary.trim() || activeMemory.summary,
      details: editDetails.trim() || activeMemory.details,
    });
    setIsEditing(false);
  };

  const handleCreateMemory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newSummary.trim()) return;
    onAddMemory({
      title: newTitle.trim(),
      summary: newSummary.trim(),
      details: newSummary.trim(),
      category: newCategory,
      dateSaved: 'Oct 12, 2026',
      source: 'Manual entry · Oct 12',
      entities: newEntities
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      relatedNodeId: 'node-redesign',
    });
    setNewTitle('');
    setNewSummary('');
    setIsAddModalOpen(false);
  };

  // Only comment editing is local UI state. Proposal results come from the source.
  const handleToggleComment=(id:string)=>setComments(previous=>{
    const drafts=previous.scope===inbox?.scopeKey?previous.drafts:{};
    const draft=drafts[id]??{open:false,text:proposals.find(p=>p.id===id)?.suggestedComment??''};
    return {scope:inbox?.scopeKey,drafts:{...drafts,[id]:{...draft,open:!draft.open}}};
  });
  const handleDraftCommentChange=(id:string,text:string)=>setComments(previous=>({scope:inbox?.scopeKey,drafts:{...(previous.scope===inbox?.scopeKey?previous.drafts:{}),[id]:{open:true,text}}}));
  const handleSendComment=async(id:string)=>{
    const text=drafts[id]?.text.trim(),scope=inbox?.scopeKey;
    if(!text||!inbox?.onCommentProposal)return;
    const accepted=await inbox.onCommentProposal(id,text);
    if(accepted===false)return;
    setComments(previous=>previous.scope===scope&&previous.drafts[id]?.text.trim()===text
      ?{...previous,drafts:{...previous.drafts,[id]:{...previous.drafts[id],open:false}}}:previous);
  };
  const visibleProposals=proposals.filter(p=>inboxFilter==='all'||inboxFilter==='empty'||inboxFilter==='loading'||p.status===inboxFilter);

  return (
    <div className="flex-1 flex flex-col h-full min-w-0 bg-[var(--mroya-bg)] text-[var(--mroya-text)]">
      {/* Header with Navigation between Saved Memories and Proposals */}
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

          {/* Tab Selector: Memories vs Proposals (Inbox) */}
          <div className="flex items-center gap-1 bg-[var(--mroya-surface)] p-1 rounded-[10px] border border-[var(--mroya-divider)]">
            <button
              type="button"
              onClick={() => setActiveMainTab('memories')}
              className={`px-3 py-1.5 rounded-[8px] text-[13px] font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                !showInbox
                  ? 'bg-[var(--mroya-surface-active)] text-[var(--mroya-text)] shadow-xs'
                  : 'text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)]'
              }`}
            >
              <span>Сохранённая память</span>
              <span className="text-[11px] font-medium opacity-75">({memories.length})</span>
            </button>

            {inboxAvailable&&(
            <button
              type="button"
              onClick={() => setActiveMainTab('inbox')}
              className={`px-3 py-1.5 rounded-[8px] text-[13px] font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                showInbox
                  ? 'bg-[var(--mroya-surface-active)] text-[var(--mroya-text)] shadow-xs'
                  : 'text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)]'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-[var(--mroya-brand-honey)]" />
              <span>Предложения</span>
              {pendingProposalsCount > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--mroya-primary)] text-[var(--mroya-on-primary)] text-[11px] font-bold flex items-center justify-center">
                  {pendingProposalsCount}
                </span>
              )}
            </button>
            )}
          </div>
        </div>

        {!showInbox ? (
          <button
            type="button"
            disabled={readOnly}
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[var(--mroya-primary)] hover:bg-[var(--mroya-primary-hover)] text-[var(--mroya-on-primary)] text-[13px] font-semibold transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Add memory</span>
          </button>
        ) : (
          <div className="text-[12px] text-[var(--mroya-text-muted)] hidden sm:flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[var(--mroya-brand-honey)]" />
            <span>AI Memory Intelligence</span>
          </div>
        )}
      </header>

      {/* VIEW 1: SAVED MEMORIES */}
      {!showInbox && (
        <>
          {/* Search & Category Filter Bar */}
          <div className="px-4 sm:px-6 py-3.5 border-b border-[var(--mroya-divider)] bg-[var(--mroya-bg)] flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-[var(--mroya-text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search people, agreements, PO numbers..."
                aria-label="Search memories"
                className="w-full pl-9 pr-8 py-1.5 rounded-[8px] bg-[var(--mroya-surface)] border border-[var(--mroya-input-outline)] text-[13px] text-[var(--mroya-text)] placeholder:text-[var(--mroya-text-muted)]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Interactive Category Filter Buttons */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
              {CATEGORIES.map((cat) => {
                const active = activeCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    className={`px-3 py-1.5 rounded-[8px] text-[12px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-[var(--mroya-surface-active)] text-[var(--mroya-text)] font-semibold'
                        : 'text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)]'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main Master-Detail Memory Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="max-w-[1120px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left 5 cols: Memory List */}
              <div className="lg:col-span-5 space-y-2.5">
                {filteredMemories.map((mem) => {
                  const isSelected = activeMemory?.id === mem.id;
                  return (
                    <button
                      key={mem.id}
                      type="button"
                      onClick={() => {
                        onSelectMemory(mem.id);
                        setIsEditing(false);
                      }}
                      className={`w-full text-left p-4 rounded-[12px] border transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[var(--mroya-surface-active)] border-[var(--mroya-primary)]'
                          : 'bg-[var(--mroya-surface)] border-[var(--mroya-divider)] hover:bg-[var(--mroya-surface-muted)]'
                      }`}
                    >
                      <div className="text-[12px] text-[var(--mroya-text-muted)] flex items-center gap-1.5 mb-1 tabular-nums">
                        <span>{mem.category}</span>
                        <span aria-hidden="true">·</span>
                        <span>{mem.dateSaved}</span>
                      </div>
                      <div className="text-[15px] font-semibold text-[var(--mroya-text)] mb-1">
                        {mem.title}
                      </div>
                      <p className="text-[13px] text-[var(--mroya-text-muted)] line-clamp-2 leading-[19px]">
                        {mem.summary}
                      </p>
                    </button>
                  );
                })}

                {filteredMemories.length === 0 && (
                  <div className="p-8 rounded-[12px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] text-center space-y-2">
                    <p className="text-[14px] font-semibold text-[var(--mroya-text)]">
                      No matching memories found
                    </p>
                    <p className="text-[13px] text-[var(--mroya-text-muted)]">
                      Try clearing your search filter or add a new remembered fact.
                    </p>
                  </div>
                )}
              </div>

              {/* Right 7 cols: Memory Detail Inspector */}
              <div className="lg:col-span-7">
                {activeMemory ? (
                  <div className="p-5 sm:p-6 rounded-[12px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] shadow-[var(--mroya-shadow-subtle)] space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-[var(--mroya-divider)]">
                      <div className="text-[12px] text-[var(--mroya-text-muted)] flex items-center gap-1.5 tabular-nums">
                        <span>{activeMemory.category}</span>
                        <span aria-hidden="true">·</span>
                        <span>Saved {activeMemory.dateSaved}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {!isEditing ? (
                          <>
                            <button
                              type="button"
                              disabled={readOnly}
                              onClick={() => startEditing(activeMemory)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[var(--mroya-surface-muted)] hover:bg-[var(--mroya-surface-active)] text-[12px] font-semibold text-[var(--mroya-text)] transition-colors cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-[var(--mroya-primary)]" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              disabled={readOnly}
                              onClick={() => onForgetMemory(activeMemory.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[var(--mroya-surface-muted)] hover:bg-[var(--mroya-error)]/15 text-[12px] font-semibold text-[var(--mroya-error)] transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Forget</span>
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => setIsEditing(false)}
                              className="px-3 py-1.5 rounded-[8px] bg-[var(--mroya-surface-muted)] text-[12px] font-medium text-[var(--mroya-text)] cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handleSaveEdit}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[var(--mroya-primary)] text-[var(--mroya-on-primary)] text-[12px] font-semibold cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Save changes</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {!isEditing ? (
                      <>
                        <div className="space-y-3">
                          <h2 className="text-[20px] font-semibold text-[var(--mroya-text)] leading-[28px]">
                            {activeMemory.title}
                          </h2>
                          <div className="p-3.5 rounded-[10px] bg-[var(--mroya-surface-muted)] text-[14px] font-medium text-[var(--mroya-text)] leading-[21px]">
                            {activeMemory.summary}
                          </div>
                          <p className="text-[14px] text-[var(--mroya-text)] leading-[23px]">
                            {activeMemory.details}
                          </p>
                        </div>

                        <div className="pt-4 border-t border-[var(--mroya-divider)] grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <div className="text-[12px] font-medium text-[var(--mroya-text-muted)] mb-1">
                              Source & provenance
                            </div>
                            <div className="flex items-center gap-2 text-[13px] font-medium text-[var(--mroya-text)]">
                              <FileText className="w-4 h-4 text-[var(--mroya-primary)] shrink-0" />
                              <span>{activeMemory.source}</span>
                            </div>
                          </div>

                          <div>
                            <div className="text-[12px] font-medium text-[var(--mroya-text-muted)] mb-1">
                              Connected entities
                            </div>
                            <div className="text-[13px] font-medium text-[var(--mroya-text)]">
                              {activeMemory.entities.join(' · ')}
                            </div>
                          </div>
                        </div>

                        <div className="pt-4 border-t border-[var(--mroya-divider)] flex flex-wrap items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => onExploreInMap(activeMemory.relatedNodeId)}
                            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-[8px] bg-[var(--mroya-surface-muted)] hover:bg-[var(--mroya-surface-active)] text-[13px] font-semibold text-[var(--mroya-text)] transition-colors cursor-pointer"
                          >
                            <Share2 className="w-4 h-4 text-[var(--mroya-primary)]" />
                            <span>Explore in Memory Map</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onAskMroyaAbout(activeMemory)}
                            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-[8px] bg-[var(--mroya-surface-muted)] hover:bg-[var(--mroya-surface-active)] text-[13px] font-semibold text-[var(--mroya-primary)] transition-colors cursor-pointer"
                          >
                            <MessageSquare className="w-4 h-4" />
                            <span>Ask Mroya about this memory</span>
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-[12px] font-semibold text-[var(--mroya-text)] mb-1">
                            Memory title
                          </label>
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="w-full px-3 py-2 rounded-[8px] bg-[var(--mroya-surface)] border border-[var(--mroya-input-outline)] text-[14px] text-[var(--mroya-text)]"
                          />
                        </div>
                        <div>
                          <label className="block text-[12px] font-semibold text-[var(--mroya-text)] mb-1">
                            Key summary
                          </label>
                          <textarea
                            rows={2}
                            value={editSummary}
                            onChange={(e) => setEditSummary(e.target.value)}
                            className="w-full px-3 py-2 rounded-[8px] bg-[var(--mroya-surface)] border border-[var(--mroya-input-outline)] text-[14px] text-[var(--mroya-text)]"
                          />
                        </div>
                        <div>
                          <label className="block text-[12px] font-semibold text-[var(--mroya-text)] mb-1">
                            Full context & notes
                          </label>
                          <textarea
                            rows={4}
                            value={editDetails}
                            onChange={(e) => setEditDetails(e.target.value)}
                            className="w-full px-3 py-2 rounded-[8px] bg-[var(--mroya-surface)] border border-[var(--mroya-input-outline)] text-[14px] text-[var(--mroya-text)]"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </>
      )}

      {/* VIEW 2: MEMORY INBOX (ПРЕДЛОЖЕНИЯ) */}
      {showInbox && (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          <div className="max-w-[1020px] mx-auto space-y-6">
            {/* Header intro card */}
            <div className="p-5 sm:p-6 rounded-[12px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[var(--mroya-surface-active)] border border-[var(--mroya-divider)] flex items-center justify-center text-[var(--mroya-primary)] shrink-0">
                    <Inbox className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-[18px] font-semibold text-[var(--mroya-text)]">
                      Memory Inbox — Предложения AI
                    </h2>
                    <p className="text-[13px] text-[var(--mroya-text-muted)] mt-0.5">
                      Кандидаты в персональную память, обнаруженные моделью в календаре и внешних сервисах
                    </p>
                  </div>
                </div>

                {inbox?.preview&&<div className="flex items-center gap-2 self-start sm:self-center">
                  <button
                    type="button"
                    onClick={inbox?.preview?.onReset}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12px] font-medium bg-[var(--mroya-surface-muted)] hover:bg-[var(--mroya-surface-active)] text-[var(--mroya-text)] border border-[var(--mroya-divider)] transition-colors cursor-pointer"
                    title="Сбросить все карточки к исходному состоянию"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Сброс демо</span>
                  </button>
                </div>}
              </div>

              {/* State Preview Switcher Toolbar */}
              {inbox?.preview&&<div className="pt-3 border-t border-[var(--mroya-divider)]/60">
                <div className="text-[11px] uppercase tracking-wider text-[var(--mroya-text-muted)] font-semibold mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-[var(--mroya-brand-honey)]" />
                  <span>Визуальные состояния Inbox:</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {inbox.preview.filters.map((filterOption) => (
                    <button
                      key={filterOption.id}
                      type="button"
                      onClick={() => inbox.preview?.onSelectFilter(filterOption.id)}
                      className={`px-2.5 py-1 rounded-[6px] text-[11.5px] font-medium transition-colors cursor-pointer ${
                        inboxFilter === filterOption.id
                          ? 'bg-[var(--mroya-primary)] text-[var(--mroya-on-primary)] font-semibold shadow-xs'
                          : 'bg-[var(--mroya-surface-muted)]/60 hover:bg-[var(--mroya-surface-active)] text-[var(--mroya-text)] border border-[var(--mroya-divider)]'
                      }`}
                    >
                      {filterOption.label}
                    </button>
                  ))}
                </div>
              </div>}
            </div>

            {inbox?.error&&<div role="alert" className="p-3 rounded-[10px] bg-red-500/10 border border-red-500/25">{inbox.error}{inbox.onRetryProposal&&<button type="button" className="ml-3 underline" onClick={()=>void inbox.onRetryProposal?.()}>Retry</button>}</div>}

            {inbox?.notice&&<p role="status" className="text-[13px] text-[var(--mroya-text-muted)]">{inbox.notice}</p>}
            {inbox?.onRefresh&&<button type="button" disabled={inbox.loading} onClick={inbox.onRefresh} className="text-[12px] font-semibold text-[var(--mroya-primary)] hover:underline">Обновить Inbox</button>}

            {/* STATE: LOADING */}
            {inboxLoading && (
              <div className="space-y-4 animate-in fade-in">
                {[1, 2, 3].map((skeleton) => (
                  <div
                    key={skeleton}
                    className="p-5 sm:p-6 rounded-[12px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] space-y-4 animate-pulse"
                  >
                    <div className="flex items-center justify-between">
                      <div className="h-5 w-48 bg-[var(--mroya-surface-muted)] rounded" />
                      <div className="h-5 w-24 bg-[var(--mroya-surface-muted)] rounded-full" />
                    </div>
                    <div className="h-4 w-64 bg-[var(--mroya-surface-muted)] rounded" />
                    <div className="h-16 w-full bg-[var(--mroya-surface-muted)]/60 rounded-[8px]" />
                    <div className="flex items-center gap-2 pt-2">
                      <div className="h-8 w-20 bg-[var(--mroya-surface-muted)] rounded-full" />
                      <div className="h-8 w-20 bg-[var(--mroya-surface-muted)] rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* STATE: EMPTY INBOX */}
            {!inbox?.error&&(inboxFilter === 'empty' || (!inboxLoading && visibleProposals.length === 0)) ? (
              <div className="p-10 rounded-[12px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] text-center space-y-3 animate-in fade-in">
                <div className="w-12 h-12 mx-auto rounded-full bg-[var(--mroya-surface-muted)] border border-[var(--mroya-divider)] flex items-center justify-center text-[var(--mroya-text-muted)]">
                  <Inbox className="w-6 h-6" />
                </div>
                <h3 className="text-[16px] font-semibold text-[var(--mroya-text)]">
                  Все предложения обработаны
                </h3>
                <p className="text-[13px] text-[var(--mroya-text-muted)] max-w-md mx-auto leading-[20px]">
                  {inbox?.emptyMessage??'В Memory Inbox сейчас нет ожидающих предложений. Искусственный интеллект продолжит мониторинг разрешенных источников и сформирует предложения при появлении новых фактов.'}
                </p>
                {inbox?.preview&&(
                <button
                  type="button"
                  onClick={inbox?.preview?.onReset}
                  className="mt-2 px-4 py-2 rounded-full text-[12.5px] font-semibold bg-[var(--mroya-primary)] text-[var(--mroya-on-primary)] hover:bg-[var(--mroya-primary-hover)] transition-colors cursor-pointer"
                >
                  Показать примеры предложений
                </button>)}
              </div>
            ) : null}

            {/* LIST OF PROPOSAL CARDS */}
            {!inboxLoading && visibleProposals.length > 0 && (
              <div className="space-y-4">
                {visibleProposals.map((proposal) => {
                  const isNew = proposal.status === 'new'||proposal.status==='pending';
                  const isReanalyzing = proposal.status === 'reanalyzing';
                  const isAccepted = ['accepted','pending_apply','applying','search_pending'].includes(proposal.status);
                  const isDeclined = proposal.status === 'declined'||proposal.status==='rejected';
                  const isApplied = proposal.status === 'applied'&&proposal.isConfirmed!==false;
                  const isOutdated = proposal.status === 'outdated'||proposal.status==='stale';
                  const isBackendError = ['error','apply_error','apply_retry','apply_conflict'].includes(proposal.status);
                  const isError = isBackendError||!!proposal.errorMessage;

                  return (
                    <div
                      key={proposal.id}
                      className={`p-5 sm:p-6 rounded-[12px] bg-[var(--mroya-surface)] border transition-all ${
                        isNew
                          ? 'border-[var(--mroya-divider)] shadow-[var(--mroya-shadow-subtle)]'
                          : isReanalyzing
                          ? 'border-indigo-500/40 bg-indigo-500/5'
                          : isAccepted
                          ? 'border-emerald-500/30 bg-emerald-500/5'
                          : isApplied
                          ? 'border-emerald-600/40 bg-emerald-600/5'
                          : isDeclined
                          ? 'border-[var(--mroya-divider)] opacity-60 bg-[var(--mroya-surface-muted)]/40'
                          : isOutdated
                          ? 'border-amber-500/30 bg-amber-500/5'
                          : isError
                          ? 'border-red-500/40 bg-red-500/5'
                          : 'border-[var(--mroya-divider)]'
                      }`}
                    >
                      {/* Top Bar: Title & Status Badge */}
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-[var(--mroya-divider)]/60">
                        <div className="space-y-1">
                          <h3 className="text-[17px] font-semibold text-[var(--mroya-text)] leading-[24px]">
                            {proposal.title}
                          </h3>

                          {/* Source and Provenance row */}
                          <div className="flex flex-wrap items-center gap-2 text-[12px] text-[var(--mroya-text-muted)]">
                            <span className="inline-flex items-center gap-1 font-medium text-[var(--mroya-text)]">
                              {proposal.source === 'Calendar' && <CalendarIcon className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
                              {proposal.source === 'Email' && <Mail className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                              {proposal.source === 'Drive' && <FileText className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                              <span>{proposal.sourceLabel??(proposal.source === 'Calendar' ? 'Google Calendar' : proposal.source === 'Email' ? 'Gmail' : 'Google Drive')}</span>
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{proposal.sourceResourceTitle}</span>
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums">{proposal.sourceDate}</span>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="shrink-0 self-start">
                          {!isNew&&!isReanalyzing&&!isAccepted&&!isApplied&&!isDeclined&&!isOutdated&&!isError&&proposal.statusLabel&&<span className="text-[12px] text-[var(--mroya-text-muted)]">{proposal.statusLabel}</span>}
                          {isNew && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11.5px] font-semibold bg-[var(--mroya-primary)]/15 text-[var(--mroya-primary)] border border-[var(--mroya-primary)]/30">
                              <Sparkles className="w-3 h-3" />
                              <span>{proposal.statusLabel??'Новое предложение'}</span>
                            </span>
                          )}
                          {isReanalyzing && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30">
                              <RefreshCw className={proposal.processingEnabled===false?"w-3 h-3":"w-3 h-3 animate-spin"} />
                              <span>{proposal.statusLabel??'Повторный анализ…'}</span>
                            </span>
                          )}
                          {isAccepted && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11.5px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                              <Check className="w-3 h-3" />
                              <span>{proposal.statusLabel??'Принято'}</span>
                            </span>
                          )}
                          {isApplied && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11.5px] font-semibold bg-emerald-600/20 text-emerald-800 dark:text-emerald-200 border border-emerald-600/30">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              <span>{proposal.statusLabel??'Успешно применено'}</span>
                            </span>
                          )}
                          {isDeclined && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11.5px] font-semibold bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border border-zinc-500/30">
                              <X className="w-3 h-3" />
                              <span>{proposal.statusLabel??'Отклонено'}</span>
                            </span>
                          )}
                          {isOutdated && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11.5px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                              <Clock className="w-3 h-3" />
                              <span>{proposal.statusLabel??'Устаревшее предложение'}</span>
                            </span>
                          )}
                          {isBackendError && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11.5px] font-semibold bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/30">
                              <AlertCircle className="w-3 h-3" />
                              <span>{proposal.statusLabel??'Ошибка'}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Main Card Content */}
                      <div className="py-3.5 space-y-3.5">
                        {/* What the model proposes to do */}
                        <div className="p-3 rounded-[10px] bg-[var(--mroya-surface-muted)]/60 border border-[var(--mroya-divider)]">
                          <div className="text-[11.5px] uppercase tracking-wider text-[var(--mroya-text-muted)] font-semibold mb-1">
                            Что предлагает сделать AI:
                          </div>
                          <div className="text-[13.5px] font-semibold text-[var(--mroya-text)] leading-[20px]">
                            {proposal.version!==undefined?proposal.actionProposed.split('\n').map((action,index)=><div key={index}>{action}</div>):proposal.actionProposed}
                          </div>
                        </div>

                        {/* Model explanation */}
                        <div className="flex items-start gap-2.5 p-3 rounded-[10px] bg-[var(--mroya-bg)] border border-[var(--mroya-divider)]/80 text-[13px] leading-[20px] text-[var(--mroya-text)]">
                          <Brain className="w-4 h-4 text-[var(--mroya-brand-honey)] shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <span className="text-[11px] font-semibold text-[var(--mroya-text-muted)] uppercase tracking-wider block">
                              Объяснение модели:
                            </span>
                            <p className="text-[13px] text-[var(--mroya-text)] leading-[20px]">
                              {proposal.explanation}
                            </p>
                          </div>
                        </div>

                        {/* Memory Matches Section */}
                        <div className="space-y-1.5">
                          <div className="text-[12px] font-semibold text-[var(--mroya-text)] flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-[var(--mroya-primary)]" />
                            <span>Найденные совпадения в памяти:</span>
                          </div>

                          {proposal.memoryMatches.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {proposal.memoryMatches.map((match, matchIndex) => (
                                <div
                                  key={`${match.id}:${matchIndex}`}
                                  className="p-2.5 rounded-[8px] bg-[var(--mroya-surface-muted)] border border-[var(--mroya-divider)] flex items-center justify-between gap-2"
                                >
                                  <div className="min-w-0">
                                    <div className="text-[13px] font-semibold text-[var(--mroya-text)] truncate">
                                      {match.name}
                                    </div>
                                    {match.relation && (
                                      <div className="text-[11.5px] text-[var(--mroya-text-muted)] truncate">
                                        {match.relation}
                                      </div>
                                    )}
                                  </div>
                                  {match.similarity && (
                                    <span className="px-2 py-0.5 rounded text-[10.5px] font-medium bg-[var(--mroya-surface-active)] text-[var(--mroya-primary)] shrink-0">
                                      {match.similarity}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="p-2.5 rounded-[8px] bg-[var(--mroya-surface-muted)]/50 border border-[var(--mroya-divider)] text-[12px] text-[var(--mroya-text-muted)] flex items-center gap-2">
                              <User className="w-3.5 h-3.5 text-[var(--mroya-text-muted)] shrink-0" />
                              <span>{proposal.version!==undefined?'Backend не указал найденные объекты памяти. Это не подтверждение отсутствия объекта.':'Совпадений в существующей памяти не найдено (новый объект). Информация не подтверждена до вашего одобрения.'}</span>
                            </div>
                          )}
                        </div>

                        {proposal.busy&&<p role="status" className="text-[12px] text-[var(--mroya-text-muted)]">Отправка решения…</p>}
                        {!isApplied&&proposal.resultMessage&&<p className="text-[13px] text-[var(--mroya-text)]">{proposal.resultMessage}</p>}
                        {proposal.sourceAvailable===false&&<p className="text-[12px] text-[var(--mroya-text-muted)]">Источник недоступен.</p>}
                        {proposal.statusMessage&&<p className="text-[12px] text-[var(--mroya-text-muted)]">{proposal.statusMessage}</p>}
                        {inbox?.onOpenProposal&&<details onToggle={e=>{if(e.currentTarget.open)inbox.onOpenProposal?.(proposal.id);}} className="text-[12px] text-[var(--mroya-text-muted)]">
                          <summary className="cursor-pointer text-[var(--mroya-primary)]">Детали и история решений</summary>
                          {proposal.history?.loading&&<p role="status">Загрузка истории…</p>}
                          {proposal.history?.error&&<p role="alert">{proposal.history.error}<button type="button" className="ml-3 underline" onClick={()=>inbox.onOpenProposal?.(proposal.id)}>Retry</button></p>}
                          {proposal.history?.entries.map(entry=><div key={entry.version} className="py-2 border-b border-[var(--mroya-divider)] break-words">
                            <p>v{entry.version} · {entry.kind} · {entry.createdAt}</p><p>{entry.summary}</p>{entry.comment&&<p>{entry.comment}</p>}
                          </div>)}
                          {proposal.history?.hasMore&&<button type="button" disabled={proposal.history.loading} onClick={()=>inbox.onMoreHistory?.(proposal.id)} className="text-[var(--mroya-primary)] hover:underline">Ещё история</button>}
                        </details>}

                        {!isError&&proposal.actions?.retry&&<button type="button" disabled={proposal.busy} onClick={()=>void inbox?.onRetryProposal?.(proposal.id)} className="text-[12px] font-semibold text-[var(--mroya-primary)] hover:underline">Повторить запрос</button>}

                        {/* REANALYZING ACTIVE FEEDBACK BLOCK */}
                        {isReanalyzing && (
                          <div className="p-3.5 rounded-[10px] bg-indigo-500/10 border border-indigo-500/20 space-y-1.5">
                            <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 text-[13px] font-semibold">
                              <RefreshCw className={proposal.processingEnabled===false?"w-4 h-4 shrink-0 text-indigo-600 dark:text-indigo-400":"w-4 h-4 animate-spin shrink-0 text-indigo-600 dark:text-indigo-400"} />
                              <span>{proposal.processingEnabled===false?'Повторный анализ ожидает включения фоновой обработки.':'Повторный семантический анализ с учетом вашего комментария…'}</span>
                            </div>
                            {proposal.comment && (
                              <p className="text-[12px] text-[var(--mroya-text)] italic pl-6">
                                «{proposal.comment}»
                              </p>
                            )}
                            {inbox?.preview&&<div className="pt-2 flex items-center gap-2">
                              <button
                                type="button"
                                disabled={proposal.busy||proposal.uncertain||!inbox?.onAcceptProposal||proposal.actions?.accept===false}
                                onClick={() => void inbox?.onAcceptProposal?.(proposal.id)}
                                className="px-3 py-1 rounded-[6px] text-[11.5px] font-semibold bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer"
                              >
                                Завершить анализ (Принять)
                              </button>
                            </div>}
                          </div>
                        )}

                        {/* APPLIED CONFIRMATION BLOCK */}
                        {isApplied && (
                          <div className="p-3.5 rounded-[10px] bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200 text-[13px]">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                              <span>{proposal.resultMessage??'Успешно сохранено в долговременную память. Карточка обновлена.'}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setActiveMainTab('memories')}
                              className="text-[12px] font-semibold text-[var(--mroya-primary)] hover:underline whitespace-nowrap cursor-pointer"
                            >
                              Перейти в память →
                            </button>
                          </div>
                        )}

                        {/* OUTDATED REASON BLOCK */}
                        {isOutdated && (
                          <div className="p-3 rounded-[10px] bg-amber-500/10 border border-amber-500/25 flex items-center gap-2 text-amber-800 dark:text-amber-300 text-[12.5px]">
                            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                            <span>{proposal.version!==undefined?'Предложение устарело. Требуется проверка источника и повторный анализ.':'Исходное событие было удалено из календаря. Предложение архивировано.'}</span>
                          </div>
                        )}

                        {/* ERROR NOTICE BLOCK */}
                        {isError && (
                          <div className="p-3.5 rounded-[10px] bg-red-500/10 border border-red-500/25 space-y-2">
                            <div className="flex items-center gap-2 text-red-800 dark:text-red-300 text-[13px] font-semibold">
                              <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
                              <span>Ошибка обработки предложения</span>
                            </div>
                            {proposal.errorMessage && (
                              <p className="text-[12px] text-red-700 dark:text-red-300">
                                {proposal.errorMessage}
                              </p>
                            )}
                            {(!proposal.actions||proposal.actions.retry||proposal.uncertain)&&<button
                              type="button"
                              disabled={proposal.busy||!inbox?.onRetryProposal}
                              onClick={() => void inbox?.onRetryProposal?.(proposal.id)}
                              className="px-3 py-1.5 rounded-[6px] text-[12px] font-semibold bg-red-600 text-white hover:bg-red-700 cursor-pointer inline-flex items-center gap-1.5"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span>Повторить запрос</span>
                            </button>}
                          </div>
                        )}

                        {/* DECLINED NOTICE BLOCK */}
                        {isDeclined && (
                          <div className="p-3 rounded-[10px] bg-[var(--mroya-surface-muted)] border border-[var(--mroya-divider)] flex items-center justify-between gap-3 text-[12.5px] text-[var(--mroya-text-muted)]">
                            <span>{proposal.version!==undefined?'Предложение отклонено. Возобновление анализа требует явного пересмотра.':'Предложение отклонено. Модель учла это для последующих предложений.'}</span>
                            <button
                              type="button"
                              disabled={proposal.busy||proposal.uncertain||(proposal.actions?!proposal.actions.reconsider:!inbox?.onAcceptProposal)}
                                onClick={() => void (proposal.actions?inbox?.onReconsiderProposal?.(proposal.id):inbox?.onAcceptProposal?.(proposal.id))}
                              className="text-[12px] font-semibold text-[var(--mroya-primary)] hover:underline cursor-pointer"
                            >
                              Отменить отклонение
                            </button>
                          </div>
                        )}

                        {/* COMMENT INPUT DRAWER */}
                        {drafts[proposal.id]?.open && (
                          <div className="p-3.5 rounded-[10px] bg-[var(--mroya-surface-muted)]/70 border border-[var(--mroya-divider)] space-y-2.5 animate-in fade-in">
                            <div className="flex items-center justify-between">
                              <label
                                htmlFor={`comment-${proposal.id}`}
                                className="block text-[12px] font-semibold text-[var(--mroya-text)]"
                              >
                                Комментарий для повторного анализа AI:
                              </label>
                              <button
                                type="button"
                                onClick={() => handleToggleComment(proposal.id)}
                                className="text-[11px] text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)]"
                              >
                                Закрыть
                              </button>
                            </div>

                            <textarea
                              id={`comment-${proposal.id}`}
                              rows={2}
                              value={drafts[proposal.id]?.text ?? ''}
                              onChange={(e) => handleDraftCommentChange(proposal.id, e.target.value)}
                              placeholder={inbox?.preview?.commentPlaceholder??'Комментарий для уточнения предложения'}
                              className="w-full p-2.5 rounded-[8px] bg-[var(--mroya-surface)] border border-[var(--mroya-input-outline)] text-[13px] text-[var(--mroya-text)] placeholder-[var(--mroya-text-muted)] focus:outline-none focus:border-[var(--mroya-primary)]"
                            />

                            {proposal.suggestedComment && (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[11px] text-[var(--mroya-text-muted)]">Пример уточнения:</span>
                                <button
                                  type="button"
                                  onClick={() => handleDraftCommentChange(proposal.id, proposal.suggestedComment || '')}
                                  className="px-2 py-0.5 rounded text-[11px] bg-[var(--mroya-surface-active)] text-[var(--mroya-primary)] hover:underline cursor-pointer"
                                >
                                  «{proposal.suggestedComment}»
                                </button>
                              </div>
                            )}

                            <div className="flex items-center justify-end gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => handleToggleComment(proposal.id)}
                                className="px-3 py-1.5 rounded-[8px] text-[12px] font-medium text-[var(--mroya-text-muted)] hover:bg-[var(--mroya-surface-active)]"
                              >
                                Отмена
                              </button>
                              <button
                                type="button"
                                disabled={proposal.busy||proposal.uncertain||!inbox?.onCommentProposal||proposal.actions?.comment===false||!drafts[proposal.id]?.text.trim()}
                                onClick={() => void handleSendComment(proposal.id)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[8px] text-[12px] font-semibold bg-[var(--mroya-primary)] hover:bg-[var(--mroya-primary-hover)] text-[var(--mroya-on-primary)] transition-colors cursor-pointer"
                              >
                                <Send className="w-3.5 h-3.5" />
                                <span>Отправить на повторный анализ</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Bottom Action Bar: Да / Нет / Комментарий */}
                      {!isDeclined && !isApplied && !isAccepted && (!proposal.actions||proposal.actions.accept||proposal.actions.reject||proposal.actions.comment) && (
                        <div className="pt-3.5 border-t border-[var(--mroya-divider)]/60 flex flex-wrap items-center justify-between gap-2.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              {/* 1: ДА — принять предложение */}
                              <button
                                type="button"
                                disabled={proposal.busy||proposal.uncertain||!inbox?.onAcceptProposal||proposal.actions?.accept===false}
                                onClick={() => void inbox?.onAcceptProposal?.(proposal.id)}
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-semibold bg-[var(--mroya-primary)] hover:bg-[var(--mroya-primary-hover)] text-[var(--mroya-on-primary)] transition-colors cursor-pointer shadow-xs"
                              >
                                <Check className="w-4 h-4" />
                                <span>Да</span>
                              </button>

                              {/* 2: НЕТ — отклонить предложение */}
                              <button
                                type="button"
                                disabled={proposal.busy||proposal.uncertain||!inbox?.onRejectProposal||proposal.actions?.reject===false}
                                onClick={() => void inbox?.onRejectProposal?.(proposal.id)}
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-semibold bg-[var(--mroya-surface-muted)] hover:bg-[var(--mroya-surface-active)] text-[var(--mroya-text)] border border-[var(--mroya-divider)] transition-colors cursor-pointer"
                              >
                                <X className="w-4 h-4" />
                                <span>Нет</span>
                              </button>

                              {/* 3: КОММЕНТАРИЙ — открыть текстовое поле */}
                              <button
                                type="button"
                                disabled={proposal.busy||proposal.uncertain||!inbox?.onCommentProposal||proposal.actions?.comment===false}
                                onClick={() => handleToggleComment(proposal.id)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-medium bg-[var(--mroya-surface-muted)] hover:bg-[var(--mroya-surface-active)] text-[var(--mroya-text)] border border-[var(--mroya-divider)] transition-colors cursor-pointer"
                              >
                                <MessageSquare className="w-3.5 h-3.5 text-[var(--mroya-primary)]" />
                                <span>Комментарий</span>
                              </button>
                            </div>

                          <div className="text-[11.5px] text-[var(--mroya-text-muted)]">
                            Требует подтверждения пользователя
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {inbox?.hasMore&&<button type="button" disabled={inbox.loadingMore||inbox.loading} onClick={inbox.onMore} className="text-[13px] font-semibold text-[var(--mroya-primary)] hover:underline">{inbox.loadingMore?'Загрузка…':'Ещё предложения'}</button>}
          </div>
        </div>
      )}

      {/* Add Memory Modal (preserved) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[1px]">
          <DialogFocus
            onClose={() => setIsAddModalOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-memory-title"
            tabIndex={-1}
            className="w-full max-w-md rounded-[14px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] shadow-[var(--mroya-shadow-elevated)] p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2
                id="add-memory-title"
                className="text-[16px] font-semibold text-[var(--mroya-text)]"
              >
                Tell Mroya something to remember
              </h2>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                aria-label="Close modal"
                className="w-7 h-7 rounded-lg inline-flex items-center justify-center text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateMemory} className="space-y-3.5">
              <div>
                <label className="block text-[12px] font-semibold text-[var(--mroya-text)] mb-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g., Preferred meeting time"
                  className="w-full px-3 py-2 rounded-[8px] bg-[var(--mroya-surface)] border border-[var(--mroya-input-outline)] text-[14px] text-[var(--mroya-text)]"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[var(--mroya-text)] mb-1">
                  Category
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as MemoryCategory)}
                  className="w-full px-3 py-2 rounded-[8px] bg-[var(--mroya-surface)] border border-[var(--mroya-input-outline)] text-[14px] text-[var(--mroya-text)]"
                >
                  <option value="Agreements & Decisions">Agreements & Decisions</option>
                  <option value="People & Clients">People & Clients</option>
                  <option value="Dates & Commitments">Dates & Commitments</option>
                  <option value="Preferences">Preferences</option>
                </select>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[var(--mroya-text)] mb-1">
                  Fact or agreement details
                </label>
                <textarea
                  rows={3}
                  required
                  value={newSummary}
                  onChange={(e) => setNewSummary(e.target.value)}
                  placeholder="Write what Mroya should remember for future conversations..."
                  className="w-full px-3 py-2 rounded-[8px] bg-[var(--mroya-surface)] border border-[var(--mroya-input-outline)] text-[14px] text-[var(--mroya-text)]"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[var(--mroya-text)] mb-1">
                  Related people or organizations (comma-separated)
                </label>
                <input
                  type="text"
                  value={newEntities}
                  onChange={(e) => setNewEntities(e.target.value)}
                  className="w-full px-3 py-2 rounded-[8px] bg-[var(--mroya-surface)] border border-[var(--mroya-input-outline)] text-[14px] text-[var(--mroya-text)]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-full bg-[var(--mroya-surface-muted)] text-[13px] font-medium text-[var(--mroya-text)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--mroya-primary)] hover:bg-[var(--mroya-primary-hover)] text-[var(--mroya-on-primary)] text-[13px] font-semibold cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Save to memory</span>
                </button>
              </div>
            </form>
          </DialogFocus>
        </div>
      )}
    </div>
  );
};
