import React, { useState } from 'react';
import {
  Wrench,
  Search,
  Database,
  Calendar,
  Clock,
  Check,
  AlertCircle,
  Copy,
  ChevronDown,
  Loader2,
  MinusCircle,
} from 'lucide-react';
import type { ToolActivity, ToolActivityStatus } from '../types/toolActivity';

export interface ToolActivityAccordionProps {
  activity: ToolActivity;
  defaultExpanded?: boolean;
  className?: string;
}

export function formatJsonPayload(payload: unknown): string {
  if (payload === null || payload === undefined) return '';
  if (typeof payload === 'string') {
    try {
      const parsed = JSON.parse(payload);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return payload;
    }
  }
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}

export function getToolIcon(toolName: string): React.ComponentType<{ className?: string }> {
  const name = toolName.toLowerCase();
  if (name.includes('search') || name.includes('find') || name.includes('query')) {
    return Search;
  }
  if (name.includes('memory') || name.includes('remember') || name.includes('knowledge') || name.includes('node')) {
    return Database;
  }
  if (name.includes('calendar') || name.includes('schedule') || name.includes('event')) {
    return Calendar;
  }
  if (name.includes('reminder') || name.includes('clock') || name.includes('time') || name.includes('alert')) {
    return Clock;
  }
  return Wrench;
}

export const ToolStatusBadge: React.FC<{ status: ToolActivityStatus; isTruncated?: boolean }> = ({
  status,
  isTruncated,
}) => {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {status === 'running' && (
        <span
          role="status"
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[5px] text-[10.5px] font-medium bg-[var(--mroya-brand-honey)]/15 text-[var(--mroya-brand-honey)] border border-[var(--mroya-brand-honey)]/30"
        >
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Running</span>
        </span>
      )}
      {status === 'success' && (
        <span
          role="status"
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[5px] text-[10.5px] font-medium bg-[var(--mroya-primary)]/15 text-[var(--mroya-primary)] border border-[var(--mroya-primary)]/30"
        >
          <Check className="w-3 h-3 stroke-[2.5]" />
          <span>Success</span>
        </span>
      )}
      {status === 'failed' && (
        <span
          role="status"
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[5px] text-[10.5px] font-medium bg-[var(--mroya-error)]/12 text-[var(--mroya-error)] border border-[var(--mroya-error)]/25"
        >
          <AlertCircle className="w-3 h-3" />
          <span>Failed</span>
        </span>
      )}
      {status === 'skipped' && (
        <span
          role="status"
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[5px] text-[10.5px] font-medium bg-[var(--mroya-surface-muted)] text-[var(--mroya-text-muted)] border border-[var(--mroya-divider)]"
        >
          <MinusCircle className="w-3 h-3" />
          <span>Skipped</span>
        </span>
      )}
      {isTruncated && (
        <span
          title="Result was truncated by model policy"
          className="inline-flex items-center px-1.5 py-0.5 rounded-[5px] text-[10px] font-semibold tracking-wide uppercase bg-[var(--mroya-brand-honey)]/15 text-[var(--mroya-brand-honey)] border border-[var(--mroya-brand-honey)]/30"
        >
          Truncated
        </span>
      )}
    </div>
  );
};

export const JsonPayloadViewer: React.FC<{
  title: string;
  data: unknown;
  status?: ToolActivityStatus;
  isTruncated?: boolean;
}> = ({ title, data, status, isTruncated }) => {
  const [copied, setCopied] = useState(false);
  const formatted = formatJsonPayload(data);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!formatted) return;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(formatted).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hasData = formatted.trim().length > 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px] font-medium text-[var(--mroya-text-muted)]">
        <span className="uppercase tracking-wider font-semibold text-[10.5px]">
          {title}
        </span>
        {hasData && (
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] text-[11px] text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)] transition-colors cursor-pointer"
            aria-label={`Copy ${title} JSON`}
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-[var(--mroya-primary)]" />
                <span className="text-[var(--mroya-primary)]">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Copy</span>
              </>
            )}
          </button>
        )}
      </div>

      <div className="rounded-[6px] border border-[var(--mroya-divider)] bg-[var(--mroya-bg)] p-2.5 max-h-[150px] overflow-y-auto">
        {hasData ? (
          <pre className="font-mono text-[11px] leading-[17px] text-[var(--mroya-text)] whitespace-pre-wrap break-all select-text">
            {formatted}
          </pre>
        ) : status === 'running' ? (
          <div className="flex items-center gap-2 text-[11px] text-[var(--mroya-text-muted)] italic py-1">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--mroya-brand-honey)]" />
            <span>Waiting for tool response…</span>
          </div>
        ) : status === 'skipped' ? (
          <div className="text-[11px] text-[var(--mroya-text-muted)] italic py-1">
            Execution was skipped
          </div>
        ) : (
          <div className="text-[11px] text-[var(--mroya-text-muted)] italic py-1">
            No data
          </div>
        )}
      </div>
      {isTruncated && (
        <div className="text-[10.5px] text-[var(--mroya-brand-honey)] italic">
          Output exceeds maximum size and was truncated.
        </div>
      )}
    </div>
  );
};

export const ToolActivityAccordion: React.FC<ToolActivityAccordionProps> = ({
  activity,
  defaultExpanded = false,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const IconComponent = getToolIcon(activity.name);
  const displayName = activity.label || activity.name;

  return (
    <div
      className={`rounded-[8px] border border-[var(--mroya-divider)] bg-[var(--mroya-surface)] shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-colors overflow-hidden ${className}`}
    >
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        aria-expanded={isExpanded}
        className="w-full flex items-center justify-between gap-2.5 px-3 py-2 text-left cursor-pointer hover:bg-[var(--mroya-surface-muted)]/60 transition-colors select-none"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-6 h-6 rounded-[6px] bg-[var(--mroya-surface-active)] border border-[var(--mroya-divider)] flex items-center justify-center shrink-0 text-[var(--mroya-brand-honey)]">
            <IconComponent className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[12px] font-semibold text-[var(--mroya-text)] truncate">
                {displayName}
              </span>
            </div>
            {activity.description && (
              <p className="text-[11px] text-[var(--mroya-text-muted)] truncate leading-tight mt-0.5">
                {activity.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <ToolStatusBadge status={activity.status} isTruncated={activity.isTruncated} />
          {activity.duration && (
            <span className="text-[11px] text-[var(--mroya-text-muted)] tabular-nums hidden sm:inline">
              {activity.duration}
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 text-[var(--mroya-text-muted)] transition-transform duration-200 ${
              isExpanded ? 'rotate-180' : ''
            }`}
          />
        </div>
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 pt-1 border-t border-[var(--mroya-divider)]/50 space-y-2.5">
          <JsonPayloadViewer title="Input" data={activity.input} />
          <JsonPayloadViewer
            title="Output"
            data={activity.output}
            status={activity.status}
            isTruncated={activity.isTruncated}
          />
        </div>
      )}
    </div>
  );
};

export default ToolActivityAccordion;
