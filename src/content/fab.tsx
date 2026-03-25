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
    @keyframes fabIn {
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

const PRIMARY = '#9B8FCC';
const ACCENT = '#C9A86C';

const FabButton: React.FC = () => {
  const [expanded, setExpanded] = useState(false);

  const handleExpandSidebar = (): void => {
    hideFab();
    import('./sidebar-shadow').then(m => m.mountSidebarWithShadow());
  };

  const handleScreenshot = (): void => {
    hideFab();
    startScreenshotCapture();
  };

  const handleFullPageScreenshot = (): void => {
    hideFab();
    startFullPageCapture();
  };

  return (
    <div
      style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 2147483647, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      {expanded && (
        <>
          <SubButton
            label="Open sidebar"
            color={PRIMARY}
            onClick={handleExpandSidebar}
            icon={
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="2" y="2" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.5"/>
                <line x1="13" y1="2" x2="13" y2="18" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
            }
          />
          <SubButton
            label="Screenshot"
            color={ACCENT}
            onClick={handleScreenshot}
            icon={
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="1" y="4" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                <circle cx="10" cy="10.5" r="3" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M7 4l1.5-2.5h3L13 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            }
          />
          <SubButton
            label="Full page"
            color={ACCENT}
            onClick={handleFullPageScreenshot}
            icon={
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="2" y="1" width="16" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                <line x1="5" y1="6" x2="15" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="5" y1="10" x2="15" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="5" y1="14" x2="11" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            }
          />
        </>
      )}

      <button
        onClick={() => setExpanded(e => !e)}
        title="Aureen"
        style={{
          width: '56px', height: '56px', borderRadius: '50%',
          background: PRIMARY, border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(155,143,204,0.4)',
          transition: 'transform 0.15s ease',
        }}
        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.08)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
      >
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <circle cx="14" cy="14" r="5" fill="white"/>
          {[0,30,60,90,120,150,180,210,240,270,300,330].map((deg, i) => (
            <line
              key={i}
              x1={14 + 7 * Math.cos((deg * Math.PI) / 180)}
              y1={14 + 7 * Math.sin((deg * Math.PI) / 180)}
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

interface SubButtonProps {
  label: string;
  color: string;
  icon: React.ReactNode;
  onClick: () => void;
}

const SubButton: React.FC<SubButtonProps> = ({ label, color, icon, onClick }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', animation: 'fabIn 0.18s ease-out' }}>
    <span style={{
      background: 'rgba(31,31,46,0.75)', color: 'white', fontSize: '12px',
      padding: '3px 8px', borderRadius: '4px', whiteSpace: 'nowrap', backdropFilter: 'blur(4px)',
    }}>
      {label}
    </span>
    <button
      onClick={onClick}
      style={{
        width: '44px', height: '44px', borderRadius: '50%',
        background: 'white', border: `2px solid ${color}`,
        cursor: 'pointer', display: 'flex', alignItems: 'center',
        justifyContent: 'center', color: color,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)', transition: 'transform 0.15s ease',
      }}
      onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.1)')}
      onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
    >
      {icon}
    </button>
  </div>
);
