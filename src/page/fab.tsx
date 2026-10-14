import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useTranslation } from 'react-i18next';
import '@/i18n/config';
import styles from '@/index.css?inline';
import { registerFabFns, hideFab } from '@/page/fab-bridge';
import { startScreenshotCapture } from '@/page/region-capture';
import { startFullPageCapture } from '@/page/full-page-capture';

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
      from { opacity: 0; transform: translateY(12px) scale(0.88); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes labelIn {
      from { opacity: 0; transform: translateX(6px); }
      to   { opacity: 1; transform: translateX(0); }
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

const GOLD_INK = '#9A7B43';
const MUTED_INK = '#8A8578';

const ITEMS = [
  {
    label: 'fab.openLibrary',
    iconColor: GOLD_INK,
    action: 'sidebar',
    icon: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <rect x="2" y="2" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.6" />
        <line x1="13" y1="2" x2="13" y2="18" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    ),
  },
  {
    label: 'fab.captureRegion',
    iconColor: GOLD_INK,
    action: 'screenshot',
    icon: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <rect x="1" y="4" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="10" cy="10.5" r="3" stroke="currentColor" strokeWidth="1.6" />
        <path d="M7 4l1.5-2.5h3L13 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: 'fab.captureFullPage',
    iconColor: GOLD_INK,
    action: 'fullpage',
    icon: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <rect x="2" y="1" width="16" height="18" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <line x1="5" y1="6" x2="15" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="5" y1="10" x2="15" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="5" y1="14" x2="11" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: 'fab.hide',
    iconColor: MUTED_INK,
    action: 'hide',
    icon: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
];

const SUN_RAYS = [0, 45, 90, 135, 180, 225, 270, 315];

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

const FabButton: React.FC = () => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [position, setPosition] = useState<FabPosition>(defaultPosition);
  const [dragging, setDragging] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setExpanded(false);
    };
    const onPointer = (e: PointerEvent): void => {
      if (!rootRef.current?.contains(e.composedPath()[0] as Node)) setExpanded(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer, true);
    };
  }, [expanded]);

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
    if (action === 'sidebar')    import('@/sidebar/shell').then(m => m.mountSidebarWithShadow());
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
      ref={rootRef}
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
      {expanded && !dragging && ITEMS.map((item, i) => {
        const order = expandUp ? ITEMS.length - 1 - i : i;
        return (
          <button
            key={item.action}
            type="button"
            role="menuitem"
            className="fab-item"
            onClick={() => handleAction(item.action)}
            style={{
              display: 'flex',
              flexDirection: expandLeft ? 'row' : 'row-reverse',
              alignItems: 'center',
              gap: '10px',
              padding: 0,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              animation: 'fabItemIn 0.22s cubic-bezier(0.34,1.56,0.64,1) both',
              animationDelay: `${order * 45}ms`,
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            }}
            onMouseEnter={e => {
              const circle = e.currentTarget.querySelector<HTMLElement>('.fab-circle');
              if (circle) { circle.style.transform = 'scale(1.12)'; circle.style.background = '#FBF4E6'; }
            }}
            onMouseLeave={e => {
              const circle = e.currentTarget.querySelector<HTMLElement>('.fab-circle');
              if (circle) { circle.style.transform = 'scale(1)'; circle.style.background = '#FFFFFF'; }
            }}
          >
            <span
              className="fab-label"
              style={{
                background: '#F4ECDD',
                color: '#6E5428',
                fontSize: '12px',
                fontWeight: 600,
                letterSpacing: '0.01em',
                padding: '5px 11px',
                borderRadius: '20px',
                whiteSpace: 'nowrap',
                border: '1px solid #E8DCC2',
                boxShadow: '0 2px 8px rgba(31,26,12,0.10)',
                animation: 'labelIn 0.18s ease-out both',
                animationDelay: `${order * 45 + 40}ms`,
              }}
            >
              {t(item.label)}
            </span>
            <span
              className="fab-circle"
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: '#FFFFFF',
                border: '1px solid #E2D8C4',
                color: item.iconColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(201,168,108,0.22), 0 1px 4px rgba(31,26,12,0.10)',
                transition: 'transform 0.15s cubic-bezier(0.34,1.56,0.64,1), background 0.15s',
                flexShrink: 0,
              }}
            >
              {item.icon}
            </span>
          </button>
        );
      })}

      <button
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        title="Aureen"
        aria-label={t('fab.menu')}
        aria-expanded={expanded}
        style={{
          width: `${FAB_SIZE}px`,
          height: `${FAB_SIZE}px`,
          borderRadius: '50%',
          background: 'linear-gradient(180deg, #F6DFB2 0%, #D9B377 100%)',
          border: 'none',
          color: '#FFFFFF',
          cursor: dragging ? 'grabbing' : 'grab',
          touchAction: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: expanded
            ? 'inset 0 1px 0 rgba(255,255,255,0.65), inset 0 -1px 0 rgba(190,140,70,0.2), 0 0 0 0.5px rgba(190,140,70,0.4), 0 2px 4px rgba(190,140,70,0.22), 0 14px 30px -8px rgba(190,140,70,0.7)'
            : 'inset 0 1px 0 rgba(255,255,255,0.65), inset 0 -1px 0 rgba(190,140,70,0.2), 0 0 0 0.5px rgba(190,140,70,0.4), 0 1px 2px rgba(190,140,70,0.2), 0 10px 24px -8px rgba(190,140,70,0.6)',
          transition: 'box-shadow 0.18s ease',
          flexShrink: 0,
        }}
      >
        <svg
          className="fab-sun"
          width="28"
          height="28"
          viewBox="0 0 28 28"
          fill="none"
          style={{
            transition: 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1)',
            transform: expanded ? 'rotate(135deg) scale(0.9)' : 'rotate(0deg) scale(1)',
          }}
        >
          <circle cx="14" cy="14" r="4.6" fill="#FFFFFF" />
          {SUN_RAYS.map((deg) => (
            <line
              key={deg}
              x1={14 + 7.6 * Math.cos((deg * Math.PI) / 180)}
              y1={14 + 7.6 * Math.sin((deg * Math.PI) / 180)}
              x2={14 + 10.8 * Math.cos((deg * Math.PI) / 180)}
              y2={14 + 10.8 * Math.sin((deg * Math.PI) / 180)}
              stroke="#FFFFFF"
              strokeWidth="1.9"
              strokeLinecap="round"
            />
          ))}
        </svg>
      </button>
    </div>
  );
};
