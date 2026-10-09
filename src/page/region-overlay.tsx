/**
 * Screenshot Selection Overlay
 * Full-screen overlay for selecting screenshot region
 */

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { SelectionRect } from '@/types/image-capture';

interface ScreenshotOverlayProps {
  onCapture: (rect: SelectionRect) => void;
  onCancel: () => void;
}

export const ScreenshotOverlay: React.FC<ScreenshotOverlayProps> = ({
  onCapture,
  onCancel
}) => {
  const [isSelecting, setIsSelecting] = useState(false);
  const [startPoint, setStartPoint] = useState({ x: 0, y: 0 });
  const [currentPoint, setCurrentPoint] = useState({ x: 0, y: 0 });

  const overlayRef = useRef<HTMLDivElement>(null);
  const isSelectingRef = useRef(false);
  const startPointRef = useRef({ x: 0, y: 0 });

  // Calculate selection rectangle
  const getSelectionRect = (): SelectionRect => {
    const x = Math.min(startPoint.x, currentPoint.x);
    const y = Math.min(startPoint.y, currentPoint.y);
    const width = Math.abs(currentPoint.x - startPoint.x);
    const height = Math.abs(currentPoint.y - startPoint.y);

    return { x, y, width, height };
  };

  // Mouse down - start selection
  const handleMouseDown = (e: React.MouseEvent) => {
    const x = e.clientX;
    const y = e.clientY;

    startPointRef.current = { x, y };
    setStartPoint({ x, y });
    setCurrentPoint({ x, y });
    setIsSelecting(true);
    isSelectingRef.current = true;
  };

  // Bind move/up to document so fast drags don't escape the overlay
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isSelectingRef.current) return;
      setCurrentPoint({ x: e.clientX, y: e.clientY });
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!isSelectingRef.current) return;
      isSelectingRef.current = false;

      const sp = startPointRef.current;
      const width = Math.abs(e.clientX - sp.x);
      const height = Math.abs(e.clientY - sp.y);

      if (width < 10 || height < 10) {
        setIsSelecting(false);
        return;
      }

      const rect: SelectionRect = {
        x: Math.min(sp.x, e.clientX),
        y: Math.min(sp.y, e.clientY),
        width,
        height
      };

      onCapture(rect);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [onCapture]);

  // ESC key - cancel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  // Disable body scroll and preserve current scroll position
  useEffect(() => {
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;

    // Fixed position body to prevent scrolling while preserving visual position
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = `-${scrollX}px`;
    document.body.style.width = '100%';
    document.body.style.height = '100%';

    return () => {
      // Restore scroll position
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.width = '';
      document.body.style.height = '';
      window.scrollTo(scrollX, scrollY);
    };
  }, []);

  const selectionRect = isSelecting ? getSelectionRect() : null;

  return createPortal(
    <div
      ref={overlayRef}
      onMouseDown={handleMouseDown}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        // Fully transparent — screen must NOT dim before/during selection
        backgroundColor: 'transparent',
        cursor: 'crosshair',
        zIndex: 999999,
        userSelect: 'none'
      }}
    >
      {/* Instructions */}
      <div
        style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          color: 'white',
          padding: '12px 24px',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: '500',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          zIndex: 1000000,
          pointerEvents: 'none'
        }}
      >
        Drag to select area • Press ESC to cancel
      </div>

      {/* Selection box — only shown after user starts dragging */}
      {selectionRect && selectionRect.width > 0 && selectionRect.height > 0 && (
        <>
          {/* The box-shadow here darkens everything OUTSIDE the selection rect.
              The selection rect itself stays fully visible (no overlay on top). */}
          <div
            style={{
              position: 'fixed',
              left: `${selectionRect.x}px`,
              top: `${selectionRect.y}px`,
              width: `${selectionRect.width}px`,
              height: `${selectionRect.height}px`,
              border: '2px solid rgba(255, 255, 255, 0.95)',
              outline: '1px solid rgba(0, 0, 0, 0.4)',
              backgroundColor: 'transparent',
              // Spread-radius trick: darkens everything outside the selection
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.45)',
              pointerEvents: 'none',
              zIndex: 1000001
            }}
          />

          {/* Size info */}
          <div
            style={{
              position: 'fixed',
              left: `${selectionRect.x}px`,
              top: `${selectionRect.y - 30}px`,
              backgroundColor: 'rgba(0, 0, 0, 0.85)',
              color: 'white',
              padding: '4px 12px',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: '500',
              pointerEvents: 'none',
              zIndex: 1000002
            }}
          >
            {Math.round(selectionRect.width)} × {Math.round(selectionRect.height)} px
          </div>
        </>
      )}
    </div>,
    document.body
  );
};
