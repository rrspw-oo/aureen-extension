import React, { useState } from 'react';
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

  fabHost = document.createElement('div');
  fabHost.id = 'aureen-fab-host';
  fabHost.style.cssText = 'all: initial; position: fixed; bottom: 0; right: 0; z-index: 2147483647; pointer-events: auto;';
  document.documentElement.appendChild(fabHost);

  const fabShadowRoot = fabHost.attachShadow({ mode: 'open' });

  const styleEl = document.createElement('style');
  styleEl.textContent = styles + `
    @keyframes fabItemIn {
      from { opacity: 0; transform: translateY(12px) scale(0.88); }
      to   { opacity: 1; transform: translateY(0)   scale(1);    }
    }
    @keyframes labelIn {
      from { opacity: 0; transform: translateX(6px); }
      to   { opacity: 1; transform: translateX(0);   }
    }
    @keyframes spinOpen {
      from { transform: rotate(0deg);   }
      to   { transform: rotate(135deg); }
    }
    @keyframes spinClose {
      from { transform: rotate(135deg); }
      to   { transform: rotate(0deg);   }
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

const PRIMARY = '#9B8FCC';
const ACCENT  = '#C9A86C';

const ITEMS = [
  {
    label: 'Open sidebar',
    color: PRIMARY,
    bg: 'linear-gradient(135deg, #b5acde 0%, #9B8FCC 100%)',
    shadow: 'rgba(155,143,204,0.45)',
    action: 'sidebar',
    icon: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <rect x="2" y="2" width="16" height="16" rx="3" stroke="white" strokeWidth="1.6"/>
        <line x1="13" y1="2" x2="13" y2="18" stroke="white" strokeWidth="1.6"/>
      </svg>
    ),
  },
  {
    label: 'Screenshot',
    color: ACCENT,
    bg: 'linear-gradient(135deg, #dfc08a 0%, #C9A86C 100%)',
    shadow: 'rgba(201,168,108,0.45)',
    action: 'screenshot',
    icon: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <rect x="1" y="4" width="18" height="13" rx="2" stroke="white" strokeWidth="1.6"/>
        <circle cx="10" cy="10.5" r="3" stroke="white" strokeWidth="1.6"/>
        <path d="M7 4l1.5-2.5h3L13 4" stroke="white" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    label: 'Full page',
    color: ACCENT,
    bg: 'linear-gradient(135deg, #dfc08a 0%, #C9A86C 100%)',
    shadow: 'rgba(201,168,108,0.45)',
    action: 'fullpage',
    icon: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <rect x="2" y="1" width="16" height="18" rx="2" stroke="white" strokeWidth="1.6"/>
        <line x1="5" y1="6"  x2="15" y2="6"  stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="5" y1="10" x2="15" y2="10" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="5" y1="14" x2="11" y2="14" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
];

const FabButton: React.FC = () => {
  const [expanded, setExpanded] = useState(false);

  const handleAction = (action: string): void => {
    setExpanded(false);
    hideFab();
    if (action === 'sidebar')    import('./sidebar-shadow').then(m => m.mountSidebarWithShadow());
    if (action === 'screenshot') startScreenshotCapture();
    if (action === 'fullpage')   startFullPageCapture();
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '28px',
        right: '28px',
        zIndex: 2147483647,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '8px',
      }}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      {ITEMS.map((item, i) => (
        expanded ? (
          <div
            key={item.action}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              animation: `fabItemIn 0.22s cubic-bezier(0.34,1.56,0.64,1) both`,
              animationDelay: `${i * 45}ms`,
            }}
          >
            <span
              style={{
                background: 'rgba(255,255,255,0.88)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                color: 'rgba(50,44,80,0.92)',
                fontSize: '12px',
                fontWeight: 500,
                letterSpacing: '0.01em',
                padding: '4px 10px',
                borderRadius: '20px',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
                animation: 'labelIn 0.18s ease-out both',
                animationDelay: `${i * 45 + 40}ms`,
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              }}
            >
              {item.label}
            </span>
            <button
              onClick={() => handleAction(item.action)}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: item.bg,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: `0 4px 14px ${item.shadow}, 0 1px 4px rgba(0,0,0,0.12)`,
                transition: 'transform 0.15s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.15s ease',
                flexShrink: 0,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'scale(1.12)';
                e.currentTarget.style.boxShadow = `0 6px 20px ${item.shadow}, 0 2px 6px rgba(0,0,0,0.14)`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = `0 4px 14px ${item.shadow}, 0 1px 4px rgba(0,0,0,0.12)`;
              }}
            >
              {item.icon}
            </button>
          </div>
        ) : null
      ))}

      <button
        onClick={() => setExpanded(e => !e)}
        title="Aureen"
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #b5acde 0%, #8a7ec0 100%)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(138,126,192,0.5), 0 1px 6px rgba(0,0,0,0.15)',
          transition: 'transform 0.18s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.18s ease',
          flexShrink: 0,
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.boxShadow = '0 6px 24px rgba(138,126,192,0.6), 0 2px 8px rgba(0,0,0,0.18)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(138,126,192,0.5), 0 1px 6px rgba(0,0,0,0.15)';
        }}
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 28 28"
          fill="none"
          style={{
            transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)',
            transform: expanded ? 'rotate(135deg)' : 'rotate(0deg)',
          }}
        >
          <circle cx="14" cy="14" r="5" fill="white"/>
          {[0,30,60,90,120,150,180,210,240,270,300,330].map((deg, i) => (
            <line
              key={i}
              x1={14 + 7  * Math.cos((deg * Math.PI) / 180)}
              y1={14 + 7  * Math.sin((deg * Math.PI) / 180)}
              x2={14 + 12 * Math.cos((deg * Math.PI) / 180)}
              y2={14 + 12 * Math.sin((deg * Math.PI) / 180)}
              stroke="white" strokeWidth="1.5" strokeLinecap="round"
            />
          ))}
        </svg>
      </button>
    </div>
  );
};
