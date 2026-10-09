import React, { useEffect, useRef, useState } from 'react';

const MIN_FRACTION = 0.01;
const EDGE_PX = 48;
const SCROLL_STEP = 24;

interface TrimImageModalProps {
  imageData: string;
  onCancel: () => void;
  onApply: (dataUrl: string) => void;
}

type Edge = 'top' | 'bottom';

export const TrimImageModal: React.FC<TrimImageModalProps> = ({ imageData, onCancel, onApply }) => {
  const [top, setTop] = useState(0);
  const [bottom, setBottom] = useState(1);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<Edge | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onCancel();
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [onCancel]);

  const handlePointerDown = (edge: Edge) => (e: React.PointerEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = edge;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    const edge = dragging.current;
    const img = imgRef.current;
    const scroller = scrollRef.current;
    if (!edge || !img || !scroller) return;

    const box = scroller.getBoundingClientRect();
    if (e.clientY > box.bottom - EDGE_PX) scroller.scrollBy(0, SCROLL_STEP);
    if (e.clientY < box.top + EDGE_PX) scroller.scrollBy(0, -SCROLL_STEP);

    const rect = img.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    if (edge === 'top') {
      setTop(Math.min(fraction, bottom - MIN_FRACTION));
    } else {
      setBottom(Math.max(fraction, top + MIN_FRACTION));
    }
  };

  const handlePointerUp = (): void => {
    dragging.current = null;
  };

  const handleApply = (): void => {
    const img = imgRef.current;
    if (!img || !natural) return;
    const sy = Math.round(top * natural.h);
    const sh = Math.round((bottom - top) * natural.h);
    const canvas = document.createElement('canvas');
    canvas.width = natural.w;
    canvas.height = sh;
    canvas.getContext('2d')!.drawImage(img, 0, sy, natural.w, sh, 0, 0, natural.w, sh);
    onApply(canvas.toDataURL('image/jpeg', 0.95));
  };

  const handleStyle = (fraction: number): React.CSSProperties => ({
    position: 'absolute',
    left: 0,
    right: 0,
    top: `${fraction * 100}%`,
    height: '20px',
    transform: 'translateY(-50%)',
    cursor: 'ns-resize',
    touchAction: 'none',
    display: 'flex',
    alignItems: 'center',
  });

  const resultHeight = natural ? Math.round((bottom - top) * natural.h) : 0;

  return (
    <div
      data-aureen-modal
      className="fixed inset-0 z-[100001] flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-xl max-h-[90vh] flex flex-col rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-4 pb-3 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">Trim screenshot</h3>
          <p className="mt-1 text-xs text-gray-500">
            Drag the gold lines to cut off the top and bottom. Scroll to see the whole page.
          </p>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 bg-gray-100">
          <div className="relative select-none" onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}>
            <img
              ref={imgRef}
              src={imageData}
              alt="Screenshot to trim"
              draggable={false}
              onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              className="block w-full"
            />
            <div className="absolute left-0 right-0 top-0 bg-black/55 pointer-events-none" style={{ height: `${top * 100}%` }} />
            <div className="absolute left-0 right-0 bottom-0 bg-black/55 pointer-events-none" style={{ height: `${(1 - bottom) * 100}%` }} />

            <div style={handleStyle(top)} onPointerDown={handlePointerDown('top')}>
              <div className="w-full h-[3px] bg-[#C9A86C]" />
              <span className="absolute left-2 px-2 py-0.5 text-[10px] font-semibold rounded bg-[#C9A86C] text-[#2C2417]">Top</span>
            </div>
            <div style={handleStyle(bottom)} onPointerDown={handlePointerDown('bottom')}>
              <div className="w-full h-[3px] bg-[#C9A86C]" />
              <span className="absolute left-2 px-2 py-0.5 text-[10px] font-semibold rounded bg-[#C9A86C] text-[#2C2417]">Bottom</span>
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {natural ? `${natural.w} x ${resultHeight} px` : 'Loading...'}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={!natural}
              className="rounded-md bg-[#C9A86C] px-4 py-1.5 text-sm font-medium text-[#2C2417] hover:bg-[#B8975B] disabled:opacity-50"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
