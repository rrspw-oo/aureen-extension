/**
 * usePortalContainer Hook
 * Provides a portal container inside Shadow DOM for modals/dialogs
 */

import { useRef, useEffect } from 'react';

export function usePortalContainer(shadow: ShadowRoot | null): HTMLElement | null {
  const el = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!shadow) return;

    const div = document.createElement('div');
    div.id = 'portal-container';
    div.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 10000;
    `;
    shadow.appendChild(div);
    el.current = div;

    return () => {
      div.remove();
      el.current = null;
    };
  }, [shadow]);

  return el.current;
}
