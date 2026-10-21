const FOCUSABLE =
  'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Focus and keyboard behaviour for a mounted workspace dialog: move focus inside,
 * keep Tab within the dialog, close on Escape and restore the previous focus.
 * Call it from a component effect and return the cleanup. No transport or storage.
 */
export function trapDialogFocus(
  container: HTMLElement | null,
  onClose: () => void
): (() => void) | undefined {
  if (!container || typeof document === 'undefined') return;

  const previous = document.activeElement as HTMLElement | null;
  const focusable = () =>
    Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (item) => item.getClientRects().length > 0
    );

  (focusable()[0] ?? container).focus();

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const items = focusable();
    if (!items.length) {
      event.preventDefault();
      container.focus();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  document.addEventListener('keydown', onKeyDown);
  return () => {
    document.removeEventListener('keydown', onKeyDown);
    previous?.focus?.();
  };
}
