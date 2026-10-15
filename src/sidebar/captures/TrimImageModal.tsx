import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const MIN_FRACTION = 0.01;
const EDGE_PX = 48;
const SCROLL_STEP = 24;

interface TrimImageModalProps {
  imageData: string;
  onCancel: () => void;
  onApply: (dataUrl: string) => void;
}

type Edge = 'top' | 'bottom' | 'left' | 'right';

export const TrimImageModal: React.FC<TrimImageModalProps> = ({ imageData, onCancel, onApply }) => {
  const { t } = useTranslation();
  const [top, setTop] = useState(0);
  const [bottom, setBottom] = useState(1);
  const [left, setLeft] = useState(0);
  const [right, setRight] = useState(1);
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
    const fy = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    const fx = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    if (edge === 'top') setTop(Math.min(fy, bottom - MIN_FRACTION));
    else if (edge === 'bottom') setBottom(Math.max(fy, top + MIN_FRACTION));
    else if (edge === 'left') setLeft(Math.min(fx, right - MIN_FRACTION));
    else setRight(Math.max(fx, left + MIN_FRACTION));
  };

  const handlePointerUp = (): void => {
    dragging.current = null;
  };

  const handleApply = (): void => {
    const img = imgRef.current;
    if (!img || !natural) return;
    const sx = Math.round(left * natural.w);
    const sy = Math.round(top * natural.h);
    const sw = Math.max(1, Math.round((right - left) * natural.w));
    const sh = Math.max(1, Math.round((bottom - top) * natural.h));
    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    canvas.getContext('2d')!.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    onApply(canvas.toDataURL('image/jpeg', 0.95));
  };

  // Labels sit on the kept side of each line so they never leave the image.
  const LABEL_POSITION: Record<Edge, React.CSSProperties> = {
    top: { left: 8, top: 13 },
    bottom: { left: 8, bottom: 13 },
    left: { top: 40, left: 13 },
    right: { top: 40, right: 13 }
  };

  const handleStyle = (edge: Edge, fraction: number): React.CSSProperties => {
    const horizontal = edge === 'top' || edge === 'bottom';
    return {
      position: 'absolute',
      touchAction: 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      ...(horizontal
        ? { left: 0, right: 0, top: `${fraction * 100}%`, height: '20px', transform: 'translateY(-50%)', cursor: 'ns-resize' }
        : { top: 0, bottom: 0, left: `${fraction * 100}%`, width: '20px', transform: 'translateX(-50%)', cursor: 'ew-resize' }),
    };
  };

  const resultWidth = natural ? Math.round((right - left) * natural.w) : 0;
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
          <h3 className="text-base font-semibold text-gray-900">{t('trim.title')}</h3>
          <p className="mt-1 text-xs text-gray-500">
            {t('trim.help')}
          </p>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 bg-gray-100">
          <div className="relative select-none" onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}>
            <img
              ref={imgRef}
              src={imageData}
              alt={t('trim.alt')}
              draggable={false}
              onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              className="block w-full"
            />
            <div className="absolute left-0 right-0 top-0 bg-black/55 pointer-events-none" style={{ height: `${top * 100}%` }} />
            <div className="absolute left-0 right-0 bottom-0 bg-black/55 pointer-events-none" style={{ height: `${(1 - bottom) * 100}%` }} />
            <div className="absolute bg-black/55 pointer-events-none" style={{ left: 0, width: `${left * 100}%`, top: `${top * 100}%`, bottom: `${(1 - bottom) * 100}%` }} />
            <div className="absolute bg-black/55 pointer-events-none" style={{ right: 0, width: `${(1 - right) * 100}%`, top: `${top * 100}%`, bottom: `${(1 - bottom) * 100}%` }} />

            {([['top', top], ['bottom', bottom], ['left', left], ['right', right]] as [Edge, number][]).map(([edge, value]) => {
              const horizontal = edge === 'top' || edge === 'bottom';
              return (
                <div key={edge} style={handleStyle(edge, value)} onPointerDown={handlePointerDown(edge)}>
                  <div className={horizontal ? 'w-full h-[3px] bg-[#C9A86C]' : 'h-full w-[3px] bg-[#C9A86C]'} />
                  <span
                    className="absolute px-2 py-0.5 text-[10px] font-semibold rounded bg-[#C9A86C] text-[#2C2417] whitespace-nowrap pointer-events-none"
                    style={LABEL_POSITION[edge]}
                  >
                    {t(`trim.${edge}`)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {natural ? `${resultWidth} x ${resultHeight} px` : t('common.loading')}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={!natural}
              className="rounded-md bg-[#C9A86C] px-4 py-1.5 text-sm font-medium text-[#2C2417] hover:bg-[#B8975B] disabled:opacity-50"
            >
              {t('common.apply')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
