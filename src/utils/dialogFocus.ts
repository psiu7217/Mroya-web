const FOCUSABLE = 'button,a[href],input,select,textarea,[tabindex],[contenteditable="true"]';
type Entry = {container: HTMLElement; close: () => void; previous: HTMLElement | null};
const contexts = new WeakMap<Document, {entries: Entry[]; refresh: () => void; stop: () => void}>();

/** One active trap per document. Native LoginDialog retains top-layer ownership. */
export function trapDialogFocus(container: HTMLElement | null, onClose: () => void): (() => void) | undefined {
  if (!container) return;
  const doc = container.ownerDocument;
  let context = contexts.get(doc);
  if (!context) {
    const entries: Entry[] = [], inert = new Map<HTMLElement, boolean>();
    const top = () => entries.at(-1);
    const nativeOpen = () => doc.querySelector('dialog[open]');
    const visible = (el: HTMLElement) => el.isConnected && !el.closest('[inert],[hidden],[aria-hidden="true"]') &&
      !el.matches(':disabled') && el.getClientRects().length > 0 && doc.defaultView?.getComputedStyle(el).visibility === 'visible';
    const items = (el: HTMLElement) => Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(item =>
      visible(item) && (item.tabIndex >= 0 || (item.isContentEditable && !item.hasAttribute('tabindex'))));
    const focus = (entry: Entry, last = false) => {const list = items(entry.container); ((last ? list.at(-1) : list[0]) ?? entry.container).focus();};
    const restoreInert = () => {for (const [el, previous] of inert) el.inert = previous; inert.clear();};
    const refresh = () => {
      restoreInert();
      const entry = top();
      if (!entry || nativeOpen()) return;
      // Keep the active dialog's ancestry available, disable every other branch.
      for (let branch: HTMLElement | null = entry.container; branch && branch !== doc.body; branch = branch.parentElement) {
        for (const sibling of Array.from(branch.parentElement?.children ?? [])) {
          if (sibling !== branch && sibling instanceof HTMLElement) {inert.set(sibling, sibling.inert); sibling.inert = true;}
        }
      }
    };
    const keydown = (event: KeyboardEvent) => {
      const entry = top(); if (!entry || nativeOpen() || event.defaultPrevented) return;
      if (event.key === 'Escape') {event.preventDefault(); event.stopPropagation(); entry.close(); return;}
      if (event.key !== 'Tab') return;
      const list = items(entry.container), active = doc.activeElement;
      if (!list.length || !entry.container.contains(active) || active === entry.container ||
          (event.shiftKey ? active === list[0] : active === list.at(-1))) {
        event.preventDefault(); focus(entry, event.shiftKey);
      }
    };
    const focusin = (event: FocusEvent) => {
      const entry = top(); if (entry && !nativeOpen() && !entry.container.contains(event.target as Node)) focus(entry);
    };
    doc.addEventListener('keydown', keydown, true);doc.addEventListener('focusin', focusin, true);
    const observer = new MutationObserver(refresh);observer.observe(doc.body, {childList: true, subtree: true, attributes:true, attributeFilter:['open']});
    context = {entries, refresh, stop() {observer.disconnect();restoreInert();doc.removeEventListener('keydown', keydown, true);doc.removeEventListener('focusin', focusin, true);contexts.delete(doc);}};
    contexts.set(doc, context);
  }
  const entry: Entry = {container, close: onClose, previous: doc.activeElement as HTMLElement | null};
  const descendant = context.entries.findIndex(existing => container.contains(existing.container));
  context.entries.splice(descendant < 0 ? context.entries.length : descendant, 0, entry);context.refresh();
  if (context.entries.at(-1) === entry && !doc.querySelector('dialog[open]')) (Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).find(el =>
    el.tabIndex >= 0 && !el.matches(':disabled') && !el.closest('[inert],[hidden],[aria-hidden="true"]') && el.getClientRects().length && doc.defaultView?.getComputedStyle(el).visibility === 'visible') ?? container).focus();
  return () => {
    const wasTop = context.entries.at(-1) === entry, index = context.entries.indexOf(entry);
    if (index < 0) return;
    context.entries.splice(index, 1);context.refresh();
    if (!context.entries.length) context.stop();
    if (wasTop && !doc.querySelector('dialog[open]')) {
      const parent = context.entries.at(-1)?.container;
      if (entry.previous?.isConnected && !entry.previous.closest('[inert],[hidden]') && entry.previous.getClientRects().length && (!parent || parent.contains(entry.previous))) entry.previous.focus();
      else parent?.focus();
    }
  };
}
