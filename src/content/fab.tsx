import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import styles from '@/index.css?inline';
import { registerFabFns, hideFab } from './fab-bridge';
import { startScreenshotCapture } from './screenshot-capture-handler';
import { startFullPageCapture } from './full-page-capture-handler';

let fabHost: HTMLDivElement | null = null;
let fabReactRoot: ReturnType<typeof createRoot> | null = null;

function mountFab(): void {
  if (fabHost) {
    fabHost.style.display = 'block';
    return;
  }

  // Another content-script instance (double injection) may already own a FAB.
  const existingHost = document.getElementById('aureen-fab-host');
  if (existingHost) {
    (existingHost as HTMLElement).style.display = 'block';
    return;
  }

  fabHost = document.createElement('div');
  fabHost.id = 'aureen-fab-host';
  fabHost.style.cssText = 'all: initial; position: fixed; bottom: 0; right: 0; z-index: 2147483647; pointer-events: auto;';
  document.documentElement.appendChild(fabHost);

  const fabShadowRoot = fabHost.attachShadow({ mode: 'open' });

  const styleEl = document.createElement('style');
  styleEl.textContent = styles + `
    @keyframes fabItemIn {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `;
  fabShadowRoot.appendChild(styleEl);

  const container = document.createElement('div');
  fabShadowRoot.appendChild(container);

  fabReactRoot = createRoot(container);
  fabReactRoot.render(<FabButton />);
}

function unmountFab(): void {
  if (fabHost) {
    fabHost.style.display = 'none';
  }
}

registerFabFns(mountFab, unmountFab);

const ICON_STROKE = '#6E5428';

const ITEMS = [
  {
    label: 'Open library',
    hint: 'Alt S',
    action: 'sidebar',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={ICON_STROKE} strokeWidth="1.8">
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <path d="M15 3v18" />
      </svg>
    ),
  },
  {
    label: 'Capture region',
    hint: '',
    action: 'screenshot',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={ICON_STROKE} strokeWidth="1.8" strokeLinecap="round">
        <path d="M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3" />
      </svg>
    ),
  },
  {
    label: 'Capture full page',
    hint: '',
    action: 'fullpage',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={ICON_STROKE} strokeWidth="1.8" strokeLinecap="round">
        <rect x="5" y="2" width="14" height="20" rx="2" />
        <path d="M8 7h8M8 11h8M8 15h5" />
      </svg>
    ),
  },
];

const FAB_SIZE = 52;
const DRAG_THRESHOLD = 4;
const POSITION_KEY = 'fabPosition';

interface FabPosition {
  top: number;
  left: number;
}

function defaultPosition(): FabPosition {
  return {
    top: window.innerHeight - FAB_SIZE - 28,
    left: window.innerWidth - FAB_SIZE - 28,
  };
}

function clampPosition(pos: FabPosition): FabPosition {
  return {
    top: Math.max(8, Math.min(pos.top, window.innerHeight - FAB_SIZE - 8)),
    left: Math.max(8, Math.min(pos.left, window.innerWidth - FAB_SIZE - 8)),
  };
}

const MENU_ROW: React.CSSProperties = {
  height: '44px',
  padding: '0 10px',
  border: 'none',
  borderRadius: '9px',
  background: 'transparent',
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  font: '500 14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  color: '#1F1F2E',
  cursor: 'pointer',
  textAlign: 'left',
};

const FabButton: React.FC = () => {
  const [expanded, setExpanded] = useState(false);
  const [position, setPosition] = useState<FabPosition>(defaultPosition);
  const [dragging, setDragging] = useState(false);

  const dragState = useRef<{ startX: number; startY: number; originTop: number; originLeft: number; moved: boolean } | null>(null);

  useEffect(() => {
    chrome.storage.local.get(POSITION_KEY).then((data) => {
      const saved = data[POSITION_KEY] as FabPosition | undefined;
      if (saved && typeof saved.top === 'number' && typeof saved.left === 'number') {
        setPosition(clampPosition(saved));
      }
    });
  }, []);

  // Expand toward the inside of the viewport so the menu never overflows.
  const expandUp = position.top > window.innerHeight / 2;
  const expandLeft = position.left > window.innerWidth / 2;

  const handleAction = (action: string): void => {
    setExpanded(false);
    hideFab();
    if (action === 'sidebar')    import('./sidebar-shadow').then(m => m.mountSidebarWithShadow());
    if (action === 'screenshot') startScreenshotCapture();
    if (action === 'fullpage')   startFullPageCapture();
  };

  const handlePointerDown = (e: React.PointerEvent): void => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      originTop: position.top,
      originLeft: position.left,
      moved: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent): void => {
    const state = dragState.current;
    if (!state) return;
    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;
    if (!state.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!state.moved) {
      state.moved = true;
      setDragging(true);
      setExpanded(false);
    }
    setPosition(clampPosition({ top: state.originTop + dy, left: state.originLeft + dx }));
  };

  const handlePointerUp = (e: React.PointerEvent): void => {
    const state = dragState.current;
    dragState.current = null;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    if (state?.moved) {
      setDragging(false);
      setPosition((current) => {
        chrome.storage.local.set({ [POSITION_KEY]: current });
        return current;
      });
    } else {
      setExpanded((v) => !v);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        zIndex: 2147483647,
        display: 'flex',
        // Pin the container to the corner the FAB lives in and let the menu
        // grow toward the inside of the viewport so it never overflows.
        flexDirection: expandUp ? 'column' : 'column-reverse',
        alignItems: expandLeft ? 'flex-end' : 'flex-start',
        gap: '8px',
        ...(expandUp
          ? { bottom: `${Math.max(8, window.innerHeight - position.top - FAB_SIZE)}px` }
          : { top: `${position.top}px` }),
        ...(expandLeft
          ? { right: `${Math.max(8, window.innerWidth - position.left - FAB_SIZE)}px` }
          : { left: `${position.left}px` }),
      }}
    >
      {expanded && !dragging && (
        <div
          role="menu"
          aria-label="Aureen"
          style={{
            width: '216px',
            padding: '6px',
            background: '#FFFFFF',
            border: '1px solid #ECE4D4',
            borderRadius: '14px',
            boxShadow: '0 12px 32px rgba(31,26,12,0.16)',
            display: 'flex',
            flexDirection: 'column',
            animation: 'fabItemIn 0.18s ease-out both',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          }}
        >
          {ITEMS.map((item) => (
            <button
              key={item.action}
              role="menuitem"
              onClick={() => handleAction(item.action)}
              style={MENU_ROW}
              onMouseEnter={e => (e.currentTarget.style.background = '#FBF4E6')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {item.icon}
              <span>{item.label}</span>
              {item.hint && <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#6B6878' }}>{item.hint}</span>}
            </button>
          ))}
          <span style={{ height: '1px', background: '#ECE4D4', margin: '4px 6px' }} />
          <button
            role="menuitem"
            onClick={() => handleAction('hide')}
            style={{ ...MENU_ROW, height: '40px', fontSize: '13px', color: '#6B6878' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#F4F1EA')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B6878" strokeWidth="1.8" strokeLinecap="round">
              <path d="M3 3l18 18" />
              <path d="M10.6 5.1A10 10 0 0122 12a17 17 0 01-2.6 3.4M6.3 6.3A17 17 0 002 12s3.6 7 10 7a9.6 9.6 0 004.3-1" />
            </svg>
            <span>Hide</span>
          </button>
        </div>
      )}

      <button
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        title="Aureen"
        aria-label="Aureen menu"
        aria-expanded={expanded}
        style={{
          width: `${FAB_SIZE}px`,
          height: `${FAB_SIZE}px`,
          borderRadius: '50%',
          background: '#1F1F2E',
          border: 'none',
          cursor: dragging ? 'grabbing' : 'grab',
          touchAction: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 20px rgba(31,31,46,0.28)',
          flexShrink: 0,
        }}
      >
        <span style={{ font: '600 21px Georgia, "Times New Roman", serif', color: '#C9A86C', lineHeight: 1 }}>A</span>
      </button>
    </div>
  );
};
