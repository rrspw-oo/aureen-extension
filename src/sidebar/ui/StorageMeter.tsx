import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatBytes } from '@/lib/screenshot';

// chrome.storage.local's quota in the extension; the desktop app (IndexedDB) reports none.
const QUOTA_BYTES: number | undefined = (globalThis as { chrome?: { storage?: { local?: { QUOTA_BYTES?: number } } } }).chrome
  ?.storage?.local?.QUOTA_BYTES;

export const StorageMeter: React.FC<{ showLabel?: boolean }> = ({ showLabel = false }) => {
  const { t } = useTranslation();
  const [bytes, setBytes] = useState(0);

  useEffect(() => {
    const refresh = (): void => {
      chrome.storage.local.getBytesInUse(null).then(setBytes);
    };
    refresh();
    chrome.storage.onChanged.addListener(refresh);
    return () => chrome.storage.onChanged.removeListener(refresh);
  }, []);

  if (QUOTA_BYTES === undefined) {
    return <span className="text-xs text-[#6B6878]">{t('storage.usedOnly', { used: formatBytes(bytes) })}</span>;
  }

  const percent = Math.min(100, (bytes / QUOTA_BYTES) * 100);
  const color = percent > 80 ? '#C0533F' : '#C9A86C';

  return (
    <span className="flex items-center gap-2 text-xs text-[#6B6878]" title={t('storage.title', { used: formatBytes(bytes), quota: formatBytes(QUOTA_BYTES) })}>
      {showLabel ? t('storage.used', { used: formatBytes(bytes) }) : t('storage.label')}
      <span className="w-16 h-1 rounded-full bg-[#EDE6D8] overflow-hidden inline-block">
        <span className="block h-1" style={{ width: `${Math.max(percent, 2)}%`, background: color }} />
      </span>
    </span>
  );
};
