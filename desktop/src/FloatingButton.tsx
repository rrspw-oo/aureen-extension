import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';

const SUN_RAYS = [0, 45, 90, 135, 180, 225, 270, 315];
const DRAG_THRESHOLD = 4;
const GOLD_INK = '#9A7B43';
const MUTED_INK = '#8A8578';

const ITEMS = [
  {
    command: 'open_panel_from_fab',
    label: '打開面板',
    color: GOLD_INK,
    icon: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <rect x="2" y="2" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.6" />
        <line x1="13" y1="2" x2="13" y2="18" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    )
  },
  {
    command: 'start_capture',
    labelKey: 'fab.captureRegion',
    color: GOLD_INK,
    icon: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <rect x="1" y="4" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="10" cy="10.5" r="3" stroke="currentColor" strokeWidth="1.6" />
        <path d="M7 4l1.5-2.5h3L13 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    )
  },
  {
    command: 'start_full_page',
    labelKey: 'fab.captureFullPage',
    color: GOLD_INK,
    icon: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <rect x="2" y="1" width="16" height="18" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <line x1="5" y1="6" x2="15" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="5" y1="10" x2="15" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="5" y1="14" x2="11" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )
  },
  {
    command: 'hide_fab',
    labelKey: 'fab.hide',
    color: MUTED_INK,
    icon: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    )
  }
] as const;

interface Layout {
  up: boolean;
  left: boolean;
}

/**
 * The extension's floating button, as its own always-on-top window: drag it anywhere,
 * click it for the menu (open panel, capture region, full page, hide).
 */
export function FloatingButton() {
  const { t } = useTranslation();
  const [layout, setLayout] = useState<Layout | null>(null);
  const drag = useRef<{ x: number; y: number; dragging: boolean } | null>(null);
  const expanded = layout !== null;

  const collapse = (): void => {
    setLayout(null);
    void invoke('fab_set_expanded', { expanded: false });
  };

  useEffect(() => {
    const win = getCurrentWindow();
    const offCollapse = listen('fab-collapse', () => setLayout(null));
    const offBlur = win.onFocusChanged(({ payload: focused }) => {
      if (!focused) collapse();
    });
    const offMoved = win.onMoved(() => {
      if (drag.current?.dragging) void invoke('fab_moved');
    });
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') collapse();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      void offCollapse.then((f) => f());
      void offBlur.then((f) => f());
      void offMoved.then((f) => f());
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const onPointerDown = (e: React.PointerEvent): void => {
    if (e.button !== 0) return;
    drag.current = { x: e.screenX, y: e.screenY, dragging: false };
  };

  const onPointerMove = (e: React.PointerEvent): void => {
    const d = drag.current;
    if (!d || d.dragging || expanded) return;
    if (Math.hypot(e.screenX - d.x, e.screenY - d.y) < DRAG_THRESHOLD) return;
    d.dragging = true;
    void getCurrentWindow()
      .startDragging()
      .finally(() => void invoke('fab_moved'));
  };

  const onPointerUp = (): void => {
    const d = drag.current;
    drag.current = null;
    if (d?.dragging) return;
    if (expanded) {
      collapse();
    } else {
      void invoke<Layout>('fab_set_expanded', { expanded: true }).then(setLayout);
    }
  };

  const run = (command: string): void => {
    setLayout(null);
    void invoke('fab_set_expanded', { expanded: false }).then(() => invoke(command));
  };

  const up = layout?.up ?? true;
  const left = layout?.left ?? true;

  const button = (
    <button
      type="button"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      title="Aureen"
      aria-label={t('fab.menu')}
      aria-expanded={expanded}
      className="flex-shrink-0 flex items-center justify-center rounded-full"
      style={{
        width: 52,
        height: 52,
        margin: 6,
        background: 'linear-gradient(180deg, #F6DFB2 0%, #D9B377 100%)',
        border: 'none',
        cursor: 'grab',
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.65), inset 0 -1px 0 rgba(190,140,70,0.2), 0 0 0 0.5px rgba(190,140,70,0.45), 0 2px 5px rgba(190,140,70,0.35)'
      }}
    >
      <svg
        width="28"
        height="28"
        viewBox="0 0 28 28"
        fill="none"
        style={{
          transition: 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1)',
          transform: expanded ? 'rotate(135deg) scale(0.9)' : 'none'
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
  );

  return (
    <div
      className="h-screen w-screen flex select-none"
      style={{ flexDirection: up ? 'column' : 'column-reverse', alignItems: left ? 'flex-end' : 'flex-start', justifyContent: 'flex-end' }}
    >
      {expanded && (
        <div
          role="menu"
          className="flex gap-2 py-1"
          // Circles line up with the button's center (button: 6px margin + 26px radius).
          style={{
            flexDirection: up ? 'column' : 'column-reverse',
            alignItems: left ? 'flex-end' : 'flex-start',
            padding: left ? '4px 10px 4px 0' : '4px 0 4px 10px'
          }}
        >
          {ITEMS.map((item) => (
            <button
              key={item.command}
              type="button"
              role="menuitem"
              onClick={() => run(item.command)}
              className="group flex items-center gap-2.5 bg-transparent border-none p-0 cursor-pointer"
              style={{ flexDirection: left ? 'row' : 'row-reverse' }}
            >
              <span className="px-[11px] py-[5px] rounded-[20px] whitespace-nowrap text-xs font-semibold text-[#6E5428] bg-[#F4ECDD] border border-[#E8DCC2] shadow-[0_2px_8px_rgba(31,26,12,0.10)]">
                {'label' in item ? item.label : t(item.labelKey)}
              </span>
              <span
                className="w-11 h-11 rounded-full bg-white border border-[#E2D8C4] flex items-center justify-center shadow-[0_2px_6px_rgba(201,168,108,0.25)] transition-transform group-hover:scale-110 group-hover:bg-[#FBF4E6]"
                style={{ color: item.color }}
              >
                {item.icon}
              </span>
            </button>
          ))}
        </div>
      )}
      {button}
    </div>
  );
}
