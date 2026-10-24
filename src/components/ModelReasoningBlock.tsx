import React, { useState } from 'react';
import { Brain, ChevronDown } from 'lucide-react';
import type { ToolActivity, ReasoningTimelineItem } from '../types/toolActivity';
import { ToolActivityAccordion } from './ToolActivityAccordion';
import {tr} from '../i18n';

export interface ModelReasoningBlockProps {
  /** Sequential text fragments or single reasoning text block */
  reasoning?: string | string[];
  /** Optional tool activities executed during reasoning */
  toolActivities?: ToolActivity[];
  /** Optional interleaved timeline of reasoning text and tool activities */
  timeline?: ReasoningTimelineItem[];
  /** Whether the model is currently actively streaming reasoning */
  isStreaming?: boolean;
  /** Whether this is a static or preview context (shows "Illustrative example" note) */
  isIllustrativeExample?: boolean;
  /** Default collapsed or expanded state (defaults to true) */
  defaultExpanded?: boolean;
  /** Extra class names */
  className?: string;
}

export const ModelReasoningBlock: React.FC<ModelReasoningBlockProps> = ({
  reasoning,
  toolActivities,
  timeline,
  isStreaming = false,
  isIllustrativeExample = false,
  defaultExpanded = true,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const fragments: string[] = Array.isArray(reasoning)
    ? reasoning
    : typeof reasoning === 'string'
    ? reasoning.split(/\n\n+/).map((s) => s.trim()).filter(Boolean)
    : [];

  const hasTimeline = Array.isArray(timeline) && timeline.length > 0;
  const hasTools = Array.isArray(toolActivities) && toolActivities.length > 0;
  const hasContent = fragments.length > 0 || hasTimeline || hasTools || isStreaming;

  if (!hasContent) {
    return null;
  }

  return (
    <div
      className={`w-full rounded-[10px] border border-[var(--mroya-divider)] bg-[var(--mroya-surface-muted)]/50 overflow-hidden transition-all duration-200 text-left ${className}`}
    >
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        aria-expanded={isExpanded}
        className="w-full flex items-center justify-between px-3.5 py-2.5 hover:bg-[var(--mroya-surface-muted)]/80 transition-colors cursor-pointer text-left select-none"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Brain className="w-3.5 h-3.5 text-[var(--mroya-brand-honey)] shrink-0" />
          <span className="text-[12.5px] font-semibold text-[var(--mroya-text)]">
            {tr('modelReasoning',{ns:'chat'})}
          </span>
          {isStreaming && (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--mroya-brand-honey)] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--mroya-brand-honey)] animate-ping shrink-0" />
              {tr('thinking',{ns:'chat'})}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isIllustrativeExample && (
            <span className="text-[11px] text-[var(--mroya-text-muted)] italic">
              {tr('illustrativeExample',{ns:'chat'})}
            </span>
          )}
          <span className="text-[11px] text-[var(--mroya-text-muted)] hidden sm:inline">
            {tr(isExpanded?'hide':'show',{ns:'chat'})}
          </span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-[var(--mroya-text-muted)] transition-transform duration-200 ${
              isExpanded ? 'rotate-180' : ''
            }`}
          />
        </div>
      </button>

      {isExpanded && (
        <div className="px-3.5 pb-3.5 pt-1.5 border-t border-[var(--mroya-divider)]/60 space-y-2.5 max-h-[380px] overflow-y-auto">
          {hasTimeline ? (
            timeline.map((item, index) => {
              if (item.type === 'reasoning') {
                return (
                  <p
                    key={`reasoning-${index}`}
                    className="text-[12.5px] leading-[19px] text-[var(--mroya-text-muted)]"
                  >
                    {item.text}
                  </p>
                );
              }
              return (
                <ToolActivityAccordion
                  key={item.activity.id || `tool-${index}`}
                  activity={item.activity}
                />
              );
            })
          ) : (
            <>
              {fragments.map((fragment, index) => (
                <p
                  key={index}
                  className="text-[12.5px] leading-[19px] text-[var(--mroya-text-muted)]"
                >
                  {fragment}
                </p>
              ))}
              {hasTools && (
                <div className="space-y-1.5 pt-1">
                  {toolActivities.map((activity) => (
                    <ToolActivityAccordion key={activity.id} activity={activity} />
                  ))}
                </div>
              )}
            </>
          )}

          {isStreaming && (
            <div className="flex items-center gap-2 pt-1 text-[11.5px] text-[var(--mroya-text-muted)]">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--mroya-brand-honey)] animate-pulse" />
              <span className="italic">{tr('generatingReasoning',{ns:'chat'})}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ModelReasoningBlock;
