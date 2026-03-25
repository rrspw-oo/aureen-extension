/**
 * Sidebar Entry Point
 * Renders the sidebar React application
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { Sidebar } from './Sidebar';
import '@/index.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Root element not found');
}

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <Sidebar />
  </React.StrictMode>
);
