import './chrome-shim';
import './native-save';
import React from 'react';
import ReactDOM from 'react-dom/client';
import '@/i18n/config';
import '@/index.css';
import { DesktopApp } from './DesktopApp';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DesktopApp />
  </React.StrictMode>
);
