/**
 * Popup Entry Point
 * Renders the popup React application
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { Popup } from './Popup';
import '@/index.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Root element not found');
}

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>
);
