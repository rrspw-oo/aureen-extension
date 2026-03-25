/**
 * Shadow DOM PoC (Proof of Concept)
 * Tests basic Shadow DOM + React + CSS injection functionality
 * This is a standalone test - does not affect existing code
 */

import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';

const TestSidebar: React.FC = () => {
  const [reactWorks, setReactWorks] = useState(false);
  const [eventWorks, setEventWorks] = useState(false);
  const [stateWorks, setStateWorks] = useState(0);

  return (
    <div className="poc-container">
      <h1 className="poc-header">Shadow DOM PoC</h1>

      <div className="poc-section">
        <span className="poc-label">Test Results:</span>

        <div className="poc-status success">
          ✓ Shadow DOM Created
        </div>

        <div className={`poc-status ${reactWorks ? 'success' : 'error'}`}>
          {reactWorks ? '✓' : '○'} React Rendering
        </div>

        <div className={`poc-status ${eventWorks ? 'success' : 'error'}`}>
          {eventWorks ? '✓' : '○'} Event Handling
        </div>

        <div className={`poc-status ${stateWorks > 0 ? 'success' : 'error'}`}>
          {stateWorks > 0 ? '✓' : '○'} State Management ({stateWorks})
        </div>
      </div>

      <div className="poc-section">
        <span className="poc-label">Interactive Tests:</span>

        <button
          className="poc-button"
          onClick={() => {
            setReactWorks(true);
            setEventWorks(true);
            alert('✓ React + Events work!');
          }}
        >
          Test React + Events
        </button>

        <button
          className="poc-button poc-success"
          onClick={() => setStateWorks(prev => prev + 1)}
        >
          Test State ({stateWorks} clicks)
        </button>

        <button
          className="poc-button poc-danger"
          onClick={() => {
            if (confirm('Close PoC sidebar?')) {
              removeShadowPoc();
            }
          }}
        >
          Close PoC
        </button>
      </div>

      <div className="poc-info">
        <strong>CSS Isolation Test:</strong>
        <div>If this sidebar has proper styling and is not affected by the host page's CSS, CSS injection works correctly.</div>
      </div>

      <div className="poc-code">
        {`// Shadow DOM Info
mode: open
delegatesFocus: true
adoptedStyleSheets: ${typeof CSSStyleSheet !== 'undefined' ? 'supported' : 'not supported'}`}
      </div>
    </div>
  );
};

let shadowHost: HTMLElement | null = null;
let shadowRoot: ShadowRoot | null = null;
let reactRoot: any = null;

/**
 * Mount Shadow DOM PoC
 */
export function mountShadowPoc(): void {
  if (shadowHost) {
    return;
  }


  try {
    // Create host element
    shadowHost = document.createElement('div');
    shadowHost.id = 'shadow-poc-host';
    shadowHost.style.cssText = `
      all: initial;
      position: fixed;
      top: 0;
      right: 0;
      z-index: 2147483647;
      width: 400px;
      height: 100vh;
    `;
    document.documentElement.appendChild(shadowHost);

    // Create Shadow DOM
    shadowRoot = shadowHost.attachShadow({
      mode: 'open',
      delegatesFocus: true
    });

    // Import and inject CSS
    import('./test.css?inline').then((module) => {
      const testCss = module.default;

      // Try Constructable Stylesheets (modern approach)
      if (typeof CSSStyleSheet !== 'undefined' && shadowRoot) {
        try {
          const sheet = new CSSStyleSheet();
          sheet.replaceSync(testCss);
          shadowRoot.adoptedStyleSheets = [sheet];
        } catch (e) {
          fallbackStyleInjection(testCss);
        }
      } else {
        fallbackStyleInjection(testCss);
      }
    }).catch((error) => {
      console.error('❌ CSS import failed:', error);
    });

    // Create React container
    const container = document.createElement('div');
    shadowRoot.appendChild(container);

    // Mount React app
    reactRoot = createRoot(container);
    reactRoot.render(<TestSidebar />);

  } catch (error) {
    console.error('❌ Shadow DOM PoC mount failed:', error);
    removeShadowPoc();
  }
}

/**
 * Fallback: Inject CSS using <style> tag
 */
function fallbackStyleInjection(css: string): void {
  if (!shadowRoot) return;

  const style = document.createElement('style');
  style.textContent = css;
  shadowRoot.appendChild(style);
}

/**
 * Remove Shadow DOM PoC
 */
export function removeShadowPoc(): void {
  if (reactRoot) {
    reactRoot.unmount();
    reactRoot = null;
  }

  if (shadowHost) {
    shadowHost.remove();
    shadowHost = null;
    shadowRoot = null;
  }

}

/**
 * Toggle Shadow DOM PoC
 */
export function toggleShadowPoc(): void {
  if (shadowHost) {
    removeShadowPoc();
  } else {
    mountShadowPoc();
  }
}

// Expose to window for manual testing
if (typeof window !== 'undefined') {
  (window as any).__shadowPoc = {
    mount: mountShadowPoc,
    remove: removeShadowPoc,
    toggle: toggleShadowPoc
  };
}
