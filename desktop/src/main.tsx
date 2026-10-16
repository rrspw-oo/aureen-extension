import './chrome-shim';
import './native-save';
import React from 'react';
import ReactDOM from 'react-dom/client';
import '@/i18n/config';
import '@/index.css';
import { DesktopApp } from './DesktopApp';
import { SelectionToolbar } from './SelectionToolbar';
import { FullPageBar } from './FullPageBar';
import { FloatingButton } from './FloatingButton';

// One bundle, four windows: the menu bar panel, the selection toolbar (#toolbar), the
// full-page capture bar (#fullbar) and the floating button (#fab).
const view = window.location.hash.slice(1);
const isToolbar = view === 'toolbar' || view === 'fullbar' || view === 'fab';
if (!isToolbar) {
  const style = document.createElement('style');
  style.textContent = 'header { cursor: grab; } header button, header [role="menu"] { cursor: pointer; }';
  document.head.appendChild(style);
}
if (isToolbar) {
  document.documentElement.style.background = 'transparent';
  document.body.style.background = 'transparent';
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {view === 'toolbar' ? (
      <SelectionToolbar />
    ) : view === 'fullbar' ? (
      <FullPageBar />
    ) : view === 'fab' ? (
      <FloatingButton />
    ) : (
      <DesktopApp />
    )}
  </React.StrictMode>
);
