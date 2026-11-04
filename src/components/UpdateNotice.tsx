import {tr, useLocale} from '../i18n';

export function UpdateNotice({onUpdate}: {onUpdate: () => void}) {
  useLocale();
  return <aside role="status" className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 z-50 max-w-sm rounded-[14px] border border-[var(--mroya-divider)] bg-[var(--mroya-surface)] text-[var(--mroya-text)] shadow-[var(--mroya-shadow-elevated)] p-4 flex items-center justify-between gap-4">
    <span>{tr('updateAvailable', {ns: 'common'})}</span>
    <button type="button" onClick={onUpdate} className="text-sm font-semibold text-[var(--mroya-primary)] hover:underline">{tr('updateAction', {ns: 'common'})}</button>
  </aside>;
}
