import './chrome-shim';
import './native-save';
import React from 'react';
import ReactDOM from 'react-dom/client';
import '@/i18n/config';
import '@/index.css';
import { DesktopApp } from './DesktopApp';
import { SelectionToolbar } from './SelectionToolbar';

// One bundle, two windows: the menu bar panel and the selection toolbar (index.html#toolbar).
const isToolbar = window.location.hash === '#toolbar';
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
  <React.StrictMode>{isToolbar ? <SelectionToolbar /> : <DesktopApp />}</React.StrictMode>
);
