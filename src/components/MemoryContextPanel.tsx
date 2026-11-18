import React from 'react';
import {tr} from '../i18n';
import {formatDate} from '../i18n/format';
import {
  X,
  BookOpen,
  Share2,
  Calendar,
  ArrowUpRight,
  FileText,
  Clock,
} from 'lucide-react';
import { MemoryItem, CalendarEvent } from '../types/mroya';

interface MemoryContextPanelProps {
  isOpen: boolean;
  onClose: () => void;
  focusedMemory: MemoryItem | null;
  relatedMemories: MemoryItem[];
  upcomingEvent: CalendarEvent | null;
  onSelectMemory: (memoryId: string) => void;
  onOpenInMemoryView: (memoryId: string) => void;
  onOpenInMemoryMap: (nodeId: string) => void;
  onOpenInCalendar: (eventId: string) => void;
}

export const MemoryContextPanel: React.FC<MemoryContextPanelProps> = ({
  isOpen,
  onClose,
  focusedMemory,
  relatedMemories,
  upcomingEvent,
  onSelectMemory,
  onOpenInMemoryView,
  onOpenInMemoryMap,
  onOpenInCalendar,
}) => {
  if (!isOpen) return null;

  const activeMemory = focusedMemory || relatedMemories[0] || null;

  return (
    <aside
      aria-label={tr('contextPanel',{ns:'memory'})}
      className="w-full sm:w-[336px] h-full bg-[var(--mroya-surface-muted)] border-l border-[var(--mroya-divider)] flex flex-col shrink-0 z-30 fixed sm:static right-0 top-0 bottom-0 shadow-lg sm:shadow-none"
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--mroya-divider)]">
        <div className="flex items-center gap-2 min-w-0">
          <BookOpen className="w-4 h-4 text-[var(--mroya-primary)] shrink-0" />
          <h2 className="text-[14px] font-semibold text-[var(--mroya-text)] truncate">
            {tr('memoryContext',{ns:'memory'})}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={tr('closeMemoryContext',{ns:'memory'})}
          className="w-7 h-7 rounded-lg inline-flex items-center justify-center text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-active)] transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Panel Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {activeMemory ? (
          <>
            {/* Active / Cited Memory Detail */}
            <div className="p-4 rounded-[12px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] space-y-3">
              <div className="text-[12px] text-[var(--mroya-text-muted)] flex items-center gap-1.5">
                <span>{activeMemory.category}</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{activeMemory.dateSaved}</span>
              </div>

              <h3 className="text-[15px] font-semibold leading-[22px] text-[var(--mroya-text)]">
                {activeMemory.title}
              </h3>

              <p className="text-[13px] leading-[19px] text-[var(--mroya-text)]">
                {activeMemory.details}
              </p>

              {/* Source Attribution */}
              <div className="pt-2.5 border-t border-[var(--mroya-divider)] space-y-1">
                <div className="text-[11px] font-medium text-[var(--mroya-text-muted)]">
                  {tr('sourceProvenance',{ns:'memory'})}
                </div>
                <div className="flex items-center gap-2 text-[12px] text-[var(--mroya-text)]">
                  <FileText className="w-3.5 h-3.5 text-[var(--mroya-primary)] shrink-0" />
                  <span>{activeMemory.source}</span>
                </div>
              </div>

              {/* Entities */}
              {activeMemory.entities.length > 0 && (
                <div className="pt-2 border-t border-[var(--mroya-divider)]">
                  <div className="text-[11px] font-medium text-[var(--mroya-text-muted)] mb-1">
                    {tr('linkedEntities',{ns:'memory'})}
                  </div>
                  <div className="text-[12px] text-[var(--mroya-text)] leading-[18px]">
                    {activeMemory.entities.join(' · ')}
                  </div>
                </div>
              )}

              {/* Actions: Open in Memory + Explore in Memory Map */}
              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => onOpenInMemoryView(activeMemory.id)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-[8px] bg-[var(--mroya-surface-muted)] hover:bg-[var(--mroya-surface-active)] text-[13px] font-medium text-[var(--mroya-text)] transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <BookOpen className="w-3.5 h-3.5 text-[var(--mroya-primary)]" />
                    <span>{tr('openInMemory',{ns:'memory'})}</span>
                  </span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-[var(--mroya-text-muted)]" />
                </button>

                <button
                  type="button"
                  onClick={() => onOpenInMemoryMap(activeMemory.relatedNodeId)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-[8px] bg-[var(--mroya-surface-muted)] hover:bg-[var(--mroya-surface-active)] text-[13px] font-medium text-[var(--mroya-text)] transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Share2 className="w-3.5 h-3.5 text-[var(--mroya-primary)]" />
                    <span>{tr('exploreMap',{ns:'memory'})}</span>
                  </span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-[var(--mroya-text-muted)]" />
                </button>
              </div>
            </div>

            {/* Upcoming Related Event */}
            {upcomingEvent && (
              <div className="space-y-2">
                <div className="text-[12px] font-semibold text-[var(--mroya-text-muted)]">
                  {tr('upcomingRelatedCommitment',{ns:'memory'})}
                </div>
                <div className="p-3.5 rounded-[12px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] space-y-2">
                  <div className="flex items-center justify-between text-[12px] text-[var(--mroya-text-muted)] tabular-nums">
                    <span className="flex items-center gap-1.5 font-medium text-[var(--mroya-primary)]">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{formatDate(upcomingEvent.date,{month:'short',day:'numeric',year:'numeric'},'UTC')}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{upcomingEvent.time}</span>
                    </span>
                  </div>
                  <div className="text-[14px] font-semibold text-[var(--mroya-text)]">
                    {upcomingEvent.title}
                  </div>
                  <p className="text-[12px] text-[var(--mroya-text-muted)] leading-[17px]">
                    {upcomingEvent.notes}
                  </p>
                  <button
                    type="button"
                    onClick={() => onOpenInCalendar(upcomingEvent.id)}
                    className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--mroya-primary)] hover:underline cursor-pointer pt-0.5"
                  >
                    <span>{tr('viewInCalendar',{ns:'memory'})}</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Other Related Remembered Facts in Thread */}
            {relatedMemories.length > 1 && (
              <div className="space-y-2">
                <div className="text-[12px] font-semibold text-[var(--mroya-text-muted)]">
                  Related remembered facts ({relatedMemories.length})
                </div>
                <div className="space-y-2">
                  {relatedMemories.map((mem) => {
                    const isSelected = mem.id === activeMemory.id;
                    return (
                      <button
                        key={mem.id}
                        type="button"
                        onClick={() => onSelectMemory(mem.id)}
                        className={`w-full text-left p-3 rounded-[10px] border transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[var(--mroya-surface-active)] border-[var(--mroya-input-outline)]'
                            : 'bg-[var(--mroya-surface)] border-[var(--mroya-divider)] hover:bg-[var(--mroya-surface-active)]/50'
                        }`}
                      >
                        <div className="text-[13px] font-semibold text-[var(--mroya-text)] mb-1">
                          {mem.title}
                        </div>
                        <div className="text-[12px] text-[var(--mroya-text-muted)] line-clamp-2 leading-[17px]">
                          {mem.summary}
                        </div>
                        <div className="mt-1.5 text-[11px] text-[var(--mroya-text-muted)] tabular-nums">
                          {mem.source}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="p-6 text-center space-y-2">
            <p className="text-[14px] font-medium text-[var(--mroya-text)]">
              {tr('noSpecificMemorySelected',{ns:'memory'})}
            </p>
            <p className="text-[13px] text-[var(--mroya-text-muted)]">
              {tr('noSpecificMemoryHelp',{ns:'memory'})}
            </p>
          </div>
        )}
      </div>
    </aside>
  );
};
