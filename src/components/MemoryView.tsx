import React, { useState } from 'react';
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
  PanelLeftOpen,
  MessageSquare,
} from 'lucide-react';
import { MemoryItem, MemoryCategory } from '../types/mroya';

export interface MemoryViewProps {
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
          <h1 className="text-[16px] font-semibold text-[var(--mroya-text)] truncate">
            Saved Memories ({memories.length})
          </h1>
        </div>

        <button
          type="button"
          disabled={readOnly}
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[var(--mroya-primary)] hover:bg-[var(--mroya-primary-hover)] text-[var(--mroya-on-primary)] text-[13px] font-semibold transition-colors cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>Add memory</span>
        </button>
      </header>

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

          {/* Right 7 cols: Memory Detail Inspector with Edit & Forget actions */}
          <div className="lg:col-span-7">
            {activeMemory ? (
              <div className="p-5 sm:p-6 rounded-[12px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] shadow-[var(--mroya-shadow-subtle)] space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-[var(--mroya-divider)]">
                  <div className="text-[12px] text-[var(--mroya-text-muted)] flex items-center gap-1.5 tabular-nums">
                    <span>{activeMemory.category}</span>
                    <span aria-hidden="true">·</span>
                    <span>Saved {activeMemory.dateSaved}</span>
                  </div>

                  {/* Edit & Forget controls */}
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

                    {/* Provenance / Source & Entities */}
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

                    {/* Cross-navigation actions */}
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

      {/* Add Memory Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[1px]">
          <div className="w-full max-w-md rounded-[14px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] shadow-[var(--mroya-shadow-elevated)] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-semibold text-[var(--mroya-text)]">
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
          </div>
        </div>
      )}
    </div>
  );
};
