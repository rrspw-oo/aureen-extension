import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { extractPrice } from '@/lib/price';
import { recognize } from './ocr';

interface Shot {
  id: number;
  image: string;
  text: string | null;
  price: { amount: number; label: string } | null;
  ms: number | null;
  error?: string;
}

export function App() {
  const [shots, setShots] = useState<Shot[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleCapture = useCallback(async (image: string) => {
    const id = Date.now();
    setError(null);
    setShots((prev) => [{ id, image, text: null, price: null, ms: null }, ...prev]);
    const started = performance.now();
    try {
      const text = await recognize(image);
      const patch = { text, price: extractPrice(text), ms: Math.round(performance.now() - started) };
      setShots((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setShots((prev) => prev.map((s) => (s.id === id ? { ...s, text: '', error: message } : s)));
    }
  }, []);

  useEffect(() => {
    const unlistenReady = listen<string>('capture-ready', (e) => void handleCapture(e.payload));
    const unlistenError = listen<string>('capture-error', (e) => setError(e.payload));
    return () => {
      void unlistenReady.then((fn) => fn());
      void unlistenError.then((fn) => fn());
    };
  }, [handleCapture]);

  return (
    <div className="panel">
      <header>
        <span className="title">Aureen</span>
        <button className="primary" onClick={() => void invoke('start_capture')}>
          截圖 <kbd>⌘⇧2</kbd>
        </button>
      </header>

      {error && <p className="error">{error}</p>}

      {shots.length === 0 && !error && (
        <p className="empty">按 ⌘⇧2 或上方按鈕,框選畫面上的任何區域。</p>
      )}

      <ul>
        {shots.map((s) => (
          <li key={s.id}>
            <img src={s.image} alt="" />
            <div className="meta">
              {s.text === null && <span className="muted">辨識中…</span>}
              {s.error && <span className="error">{s.error}</span>}
              {s.text !== null && !s.error && (
                <>
                  {s.price && <span className="price">{s.price.label}</span>}
                  <span className="muted">{s.ms} ms</span>
                  <button onClick={() => void navigator.clipboard.writeText(s.text ?? '')}>複製文字</button>
                </>
              )}
            </div>
            {s.text && <pre>{s.text}</pre>}
          </li>
        ))}
      </ul>
    </div>
  );
}
