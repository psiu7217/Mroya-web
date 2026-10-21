import React, { useEffect, useRef } from 'react';
import { trapDialogFocus } from '../utils/dialogFocus';

type DialogFocusProps = React.ComponentPropsWithoutRef<'div'> & { onClose: () => void };

/**
 * Dialog surface with focus containment, Escape to close and focus restore.
 * Render it only while the dialog is open; it owns no data or transport.
 */
export function DialogFocus({ onClose, children, ...props }: DialogFocusProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => trapDialogFocus(ref.current, onClose), []);
  return (
    <div ref={ref} {...props}>
      {children}
    </div>
  );
}
