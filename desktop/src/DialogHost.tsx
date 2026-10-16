import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { setDialogHandlers } from '@/lib/dialogs';

interface Pending {
  message: string;
  danger: boolean;
  confirm: boolean;
  confirmLabel?: string;
  resolve: (ok: boolean) => void;
}

/**
 * In-app replacement for window.confirm / alert, which the macOS WebView ignores
 * (confirm() returned false there, so deleting did nothing).
 */
export function DialogHost() {
  const { t } = useTranslation();
  const [queue, setQueue] = useState<Pending[]>([]);
  const okRef = useRef<HTMLButtonElement>(null);
  const current = queue[0];

  useEffect(() => {
    setDialogHandlers({
      confirm: (message, options) =>
        new Promise<boolean>((resolve) =>
          setQueue((q) => [
            ...q,
            { message, danger: Boolean(options?.danger), confirm: true, confirmLabel: options?.confirmLabel, resolve }
          ])
        ),
      notify: (message) =>
        setQueue((q) => [...q, { message, danger: false, confirm: false, resolve: () => {} }])
    });
  }, []);

  useEffect(() => {
    okRef.current?.focus();
  }, [current]);

  if (!current) return null;

  const close = (ok: boolean): void => {
    current.resolve(ok);
    setQueue((q) => q.slice(1));
  };

  return (
    <div
      data-aureen-modal
      role="alertdialog"
      aria-modal="true"
      className="fixed inset-0 z-[200000] flex items-center justify-center bg-black/30 p-6"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          close(false);
        }
      }}
    >
      <div className="w-full max-w-xs rounded-xl bg-white p-5 shadow-xl">
        <p className="m-0 text-sm leading-relaxed text-[#1F1F2E] whitespace-pre-line">{current.message}</p>
        <div className="mt-5 flex justify-end gap-2">
          {current.confirm && (
            <button type="button" onClick={() => close(false)} className="h-8 px-3 rounded-lg text-sm text-[#5E5A4E] hover:bg-[#F4F1EA]">
              {t('common.cancel')}
            </button>
          )}
          <button
            ref={okRef}
            type="button"
            onClick={() => close(true)}
            className={`h-8 px-4 rounded-lg text-sm font-semibold ${
              current.danger ? 'bg-[#B5533F] text-white hover:bg-[#9E4634]' : 'bg-[#C9A86C] text-[#2C2417] hover:bg-[#B8975B]'
            }`}
          >
            {current.confirmLabel ?? (current.confirm && current.danger ? t('common.delete') : t('common.ok'))}
          </button>
        </div>
      </div>
    </div>
  );
}
