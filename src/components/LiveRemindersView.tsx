import {useState, type FormEvent} from 'react';
import {Bell, ChevronDown, History, PanelLeftOpen, Plus} from 'lucide-react';
import {tr} from '../i18n';
import {formatDate} from '../i18n/format';
import {reminderRepeats, type ReminderInput, type ReminderRecord, type RemindersPresentation} from '../types/reminders';
import {WorkspaceMenuButton} from './WorkspaceMenuButton';

type Editor =
  | {kind: 'create'; submissionId: string; input: ReminderInput}
  | {kind: 'edit'; id: string; version: number; input: ReminderInput};

interface Props {
  reminders: RemindersPresentation;
  showTelegramSetup: boolean;
  onOpenConnections: () => void;
  isSidebarCollapsed: boolean;
  onExpandSidebar: () => void;
}

const repeatLabels = {
  once: 'doesNotRepeat', daily: 'everyDay', weekly: 'everyWeek', monthly: 'everyMonth', yearly: 'everyYear',
};
const button = 'rounded-lg border border-[var(--mroya-divider)] px-3 py-2 text-sm hover:bg-[var(--mroya-surface-muted)] disabled:opacity-50';
const primary = 'inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium bg-[var(--mroya-primary)] text-[var(--mroya-on-primary)] disabled:opacity-50';
const inputStyle = 'w-full min-w-0 rounded-lg border border-[var(--mroya-divider)] bg-[var(--mroya-bg)] px-3 py-2 text-sm text-[var(--mroya-text)]';

export function LiveRemindersView({reminders, showTelegramSetup, onOpenConnections,
                                   isSidebarCollapsed, onExpandSidebar}: Props) {
  const [history, setHistory] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [confirm, setConfirm] = useState<ReminderRecord | null>(null);
  const locked = reminders.busy || reminders.loading;
  const rows = reminders.rows.filter(row => (row.status !== 'scheduled') === history);
  const label = (key: string) => tr(key, {ns: 'reminders'});
  const repeatLabel = (repeat: ReminderInput['repeat']) => tr(repeatLabels[repeat], {ns: 'reminders', days: ''});

  const openCreate = () => {
    setConfirm(null);
    setEditor({kind: 'create', submissionId: crypto.randomUUID(),
      input: {text: '', date: '', time: '', repeat: 'once', timezone: ''}});
  };
  const openEdit = ({id, version, text, date, time, repeat, timezone}: ReminderRecord) => {
    setConfirm(null);
    setEditor({kind: 'edit', id, version, input: {text, date, time, repeat, timezone}});
  };
  const update = (changes: Partial<ReminderInput>) => {
    setEditor(current => current ? {...current, input: {...current.input, ...changes}} : null);
  };
  const zone = editor?.input.timezone || reminders.timezone;
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editor || !zone || locked) return;
    if (await reminders.onChange({...editor, input: {...editor.input, timezone: zone}})) {
      setHistory(false);
      setEditor(null);
    }
  };
  const cancel = async (row: ReminderRecord) => {
    if (await reminders.onChange({kind: 'cancel', id: row.id, version: row.version})) setConfirm(null);
  };

  return <section className="flex min-h-0 flex-1 flex-col">
    <header className="flex min-h-14 shrink-0 items-center gap-3 bg-[var(--mroya-surface)] px-3 py-2 sm:px-6">
      <WorkspaceMenuButton/>
      {isSidebarCollapsed && <button type="button" onClick={onExpandSidebar} aria-label={tr('expandSidebar', {ns: 'common'})}
        className="hidden rounded-lg p-2 lg:inline-flex"><PanelLeftOpen size={19}/></button>}
      <Bell size={19} className="hidden shrink-0 sm:block" aria-hidden="true"/>
      <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{label('liveTitle')}</h1>
      <button type="button" className={`${primary} size-10 rounded-full sm:w-auto`} aria-label={label('liveNew')} disabled={locked || !!editor} onClick={openCreate}>
        <Plus size={18} aria-hidden="true"/><span className="hidden sm:inline">{label('liveNew')}</span>
      </button>
    </header>

    <div className="flex-1 overflow-auto px-4 py-4 sm:px-6">
      <div className="mx-auto max-w-2xl space-y-4">
        {showTelegramSetup && <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--mroya-divider)] px-4 py-3 text-sm">
          <p>{label('liveTelegramHint')}</p>
          <button type="button" className={button} onClick={onOpenConnections}>{label('liveTelegramSettings')}</button>
        </div>}

        {reminders.error && <div role="alert" className="rounded-xl border border-[var(--mroya-divider)] px-4 py-3 text-sm">
          <p>{label('liveError_' + reminders.error)}</p>
          <button type="button" disabled={locked} onClick={reminders.onRefresh} className="mt-2 underline">
            {label('liveRefresh')}
          </button>
        </div>}

        {editor && <form aria-label={label(editor.kind === 'create' ? 'newReminder' : 'edit')} onSubmit={save}
          className="space-y-4 rounded-xl border border-[var(--mroya-divider)] bg-[var(--mroya-surface-muted)] p-4">
          <fieldset disabled={locked} className="space-y-3">
            <legend className="mb-2 font-medium">{label(editor.kind === 'create' ? 'newReminder' : 'edit')}</legend>
            <label className="grid gap-1 text-sm">
              {label('liveText')}
              <textarea required maxLength={500} rows={2} value={editor.input.text} className={inputStyle}
                onChange={event => update({text: event.target.value})}/>
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="grid min-w-0 gap-1 text-sm">{label('notificationDate')}
                <input required type="date" value={editor.input.date} className={inputStyle}
                  onChange={event => update({date: event.target.value})}/>
              </label>
              <label className="grid min-w-0 gap-1 text-sm">{label('notificationTime')}
                <input required type="time" value={editor.input.time} className={inputStyle}
                  onChange={event => update({time: event.target.value})}/>
              </label>
              <label className="grid min-w-0 gap-1 text-sm">{label('repeat')}
                <select value={editor.input.repeat} className={inputStyle}
                  onChange={event => update({repeat: event.target.value as ReminderInput['repeat']})}>
                  {reminderRepeats.map(repeat => <option key={repeat} value={repeat}>{repeatLabel(repeat)}</option>)}
                </select>
              </label>
            </div>
            <p className="text-xs text-[var(--mroya-text-muted)]">
              {zone ? tr('liveTimezone', {ns: 'reminders', timezone: zone}) : label('liveError_reminder_timezone_required')}
            </p>
          </fieldset>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className={primary} disabled={locked || !zone || !editor.input.text.trim()}>
              {tr(reminders.busy ? 'saving' : 'save', {ns: 'common'})}
            </button>
            <button type="button" className={button} disabled={reminders.busy} onClick={() => setEditor(null)}>
              {tr('cancel', {ns: 'common'})}
            </button>
          </div>
        </form>}

        <div className="flex justify-center">
          <div className="inline-flex overflow-hidden rounded-full border border-[var(--mroya-input-outline)]">
            {[false, true].map(value => <button key={String(value)} type="button" aria-pressed={history === value}
              onClick={() => {setHistory(value);setConfirm(null);setExpanded(null);}}
              className="min-h-9 px-4 text-xs font-semibold aria-pressed:bg-[var(--mroya-input-outline)] aria-pressed:text-[var(--mroya-bg)]">
              {label(value ? 'liveHistory' : 'liveUpcoming')}
            </button>)}
          </div>
        </div>
        {reminders.loading && !reminders.loaded && <p role="status" className="text-sm">{tr('loading', {ns: 'common'})}</p>}
        {reminders.loaded && !rows.length && <p className="p-4 text-center text-sm text-[var(--mroya-text-muted)]">
          {label(history ? 'liveHistoryEmpty' : 'liveEmpty')}
        </p>}
        {!!rows.length && <ul className="space-y-2.5">
          {rows.map(row => {
            const Icon = history ? History : Bell;
            const open = expanded === row.id;
            const status = row.status === 'cancelled' ? 'liveCancelled' : row.last_outcome === 'skipped' ? 'liveSkipped' : 'liveFinished';
            return <li key={row.id} className="rounded-xl bg-[var(--mroya-surface-muted)]">
              <button type="button" aria-expanded={open} onClick={() => {setExpanded(open ? null : row.id);setConfirm(null);}}
                className="flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left">
                <Icon aria-hidden="true" className="size-5 shrink-0 text-[var(--mroya-primary)]"/>
                <span className="min-w-0 flex-1">
                  <span className="block whitespace-pre-line break-words text-sm font-semibold">{row.text}</span>
                  <span className="mt-1 block text-xs text-[var(--mroya-text-muted)]">
                    {row.next_run_at ? formatDate(row.next_run_at, {dateStyle: 'medium', timeStyle: 'short'}, row.timezone)
                      : <>{formatDate(row.date + 'T12:00:00Z', {dateStyle: 'medium'}, 'UTC')} · {row.time}</>}
                    <br/>{repeatLabel(row.repeat)} · {row.timezone}
                    {history && <><br/>{label(status)}</>}
                  </span>
                </span>
                <ChevronDown aria-hidden="true" className={`size-4 shrink-0 text-[var(--mroya-text-muted)] ${open ? 'rotate-180' : ''}`}/>
              </button>
              {open && <div className="flex flex-wrap gap-2 px-3.5 pb-3">
                <button type="button" disabled={locked || !!editor} className={button} onClick={() => openEdit(row)}>{label('editLabel')}</button>
                <button type="button" disabled={locked || !!editor} className={button} onClick={() => setConfirm(row)}>{label('deleteLabel')}</button>
              </div>}
              {open && confirm?.id === row.id && <div className="flex flex-wrap items-center gap-2 border-t border-[var(--mroya-divider)] p-3 text-sm">
                <p>{label('liveDeleteConfirm')}</p>
                <button type="button" className={button} disabled={locked} onClick={() => void cancel(row)}>{label('deleteLabel')}</button>
                <button type="button" className={button} disabled={reminders.busy} onClick={() => setConfirm(null)}>{tr('cancel', {ns: 'common'})}</button>
              </div>}
            </li>;
          })}
        </ul>}
        {reminders.hasMore && <button type="button" className={button} disabled={locked} onClick={reminders.onMore}>{label('liveMore')}</button>}
      </div>
    </div>
  </section>;
}
