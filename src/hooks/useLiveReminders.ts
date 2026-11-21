import {useEffect, useMemo, useSyncExternalStore} from 'react';
import {ApiError} from '../api/errors.ts';
import type {ReminderChange, ReminderRecord, RemindersPresentation} from '../types/reminders.ts';
import type {WorkspaceSource} from '../types/source.ts';

type State = {
  rows: ReminderRecord[];
  loaded: boolean;
  loading: boolean;
  busy: boolean;
  next: number | null;
  error: string | null;
};

const INITIAL: State = {rows: [], loaded: false, loading: false, busy: false, next: null, error: null};
const DISPLAY_ERRORS = new Set([
  'invalid_reminder_time', 'ambiguous_reminder_time', 'reminder_time_past',
  'reminder_timezone_required', 'reminder_version_conflict',
]);

class RemindersController {
  private state = INITIAL;
  private request: AbortController | null = null;
  private readonly listeners = new Set<() => void>();

  constructor(private readonly source: WorkspaceSource, private readonly onExpired: () => void) {}

  snapshot = () => this.state;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private publish(changes: Partial<State>) {
    this.state = {...this.state, ...changes};
    this.listeners.forEach(listener => listener());
  }

  private active(request: AbortController) {
    return this.request === request && !request.signal.aborted;
  }

  private failure(error: unknown) {
    if (error instanceof ApiError && error.status === 401) {
      this.stop();
      this.onExpired();
      return;
    }
    const code = error instanceof ApiError && DISPLAY_ERRORS.has(error.code) ? error.code : 'generic';
    this.publish({error: code});
  }

  stop = () => {
    this.request?.abort();
    this.request = null;
    this.publish(INITIAL);
  };

  private async load(offset: number, request: AbortController) {
    const page = await this.source.reminders!(offset, request.signal);
    if (!this.active(request)) return;
    const rows = offset ? [...this.state.rows, ...page.reminders] : page.reminders;
    this.publish({rows: [...new Map(rows.map(row => [row.id, row])).values()], next: page.next_offset, loaded: true});
  }

  private async fetch(offset: number) {
    if (this.request) return;
    const request = new AbortController();
    this.request = request;
    this.publish({loading: true, error: null});
    try {
      await this.load(offset, request);
    } catch (error) {
      if (this.active(request)) this.failure(error);
    } finally {
      if (this.active(request)) {
        this.request = null;
        this.publish({loading: false});
      }
    }
  }

  refresh = () => { void this.fetch(0); };

  more = () => {
    if (this.state.next !== null) void this.fetch(this.state.next);
  };

  change = async (change: ReminderChange): Promise<boolean> => {
    if (this.request) return false;
    const request = new AbortController();
    this.request = request;
    this.publish({busy: true, error: null});
    try {
      const result = await this.source.changeReminder!(change, request.signal);
      if (!this.active(request)) return false;
      const rows = this.state.rows.filter(row => row.id !== result.id);
      this.publish({rows: result.status === 'cancelled' ? rows : [result, ...rows]});
      // Use the backend order and pagination after the mutation.
      try { await this.load(0, request); } catch (error) {
        if (this.active(request)) this.failure(error);
      }
      return this.active(request);
    } catch (error) {
      if (!this.active(request)) return false;
      this.failure(error);
      // A write response may have been lost. Read canonical state without retrying the write.
      if (this.active(request)) {
        try { await this.load(0, request); } catch {}
      }
      return false;
    } finally {
      if (this.active(request)) {
        this.request = null;
        this.publish({busy: false});
      }
    }
  };
}

export function useLiveReminders(source: WorkspaceSource, ownerId: number, capable: boolean,
                                 visible: boolean, timezone: string, onExpired: () => void) {
  const controller = useMemo(() => new RemindersController(source, onExpired), [source, ownerId, onExpired]);
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot, controller.snapshot);
  const available = capable && !!source.reminders && !!source.changeReminder;

  useEffect(() => () => controller.stop(), [controller, available]);
  useEffect(() => {
    if (available && visible) controller.refresh();
  }, [controller, available, visible]);

  const presentation: RemindersPresentation | undefined = available ? {
    ...state, timezone, hasMore: state.next !== null, onRefresh: controller.refresh,
    onMore: controller.more, onChange: controller.change,
  } : undefined;
  return {available, presentation, stop: controller.stop};
}
