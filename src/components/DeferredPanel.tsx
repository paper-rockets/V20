import React, { Suspense, useRef } from 'react';

interface DeferredPanelProps {
  /** Whether the wrapped panel is currently open. */
  active: boolean;
  children: React.ReactNode;
}

/**
 * Defers a lazily-imported panel until the first time it is opened.
 *
 * Several modals are mounted unconditionally and hide themselves via an `isOpen`
 * prop. That is fine for a static import, but pairing it with React.lazy would
 * fetch the chunk on first paint and defeat the split entirely.
 *
 * This wrapper renders nothing until `active` first becomes true - identical to
 * what those panels render while closed - and then keeps them mounted for the
 * rest of the session, so their internal state survives close/reopen exactly as
 * it did when they were always mounted.
 */
export const DeferredPanel: React.FC<DeferredPanelProps> = ({ active, children }) => {
  const hasOpened = useRef<boolean>(active);
  if (active) hasOpened.current = true;
  if (!hasOpened.current) return null;

  return <Suspense fallback={null}>{children}</Suspense>;
};
