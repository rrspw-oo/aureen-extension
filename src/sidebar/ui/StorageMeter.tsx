import React, { useEffect, useState } from 'react';
import { formatBytes } from '@/lib/screenshot';

const QUOTA_BYTES = 10 * 1024 * 1024;

export const StorageMeter: React.FC<{ showLabel?: boolean }> = ({ showLabel = false }) => {
  const [bytes, setBytes] = useState(0);

  useEffect(() => {
    const refresh = (): void => {
      chrome.storage.local.getBytesInUse(null).then(setBytes);
    };
    refresh();
    chrome.storage.onChanged.addListener(refresh);
    return () => chrome.storage.onChanged.removeListener(refresh);
  }, []);

  const percent = Math.min(100, (bytes / QUOTA_BYTES) * 100);
  const color = percent > 80 ? '#C0533F' : '#C9A86C';

  return (
    <span className="flex items-center gap-2 text-xs text-[#6B6878]" title={`${formatBytes(bytes)} of ${formatBytes(QUOTA_BYTES)} used`}>
      {showLabel ? `${formatBytes(bytes)} of 10 MB` : 'Storage'}
      <span className="w-16 h-1 rounded-full bg-[#EDE6D8] overflow-hidden inline-block">
        <span className="block h-1" style={{ width: `${Math.max(percent, 2)}%`, background: color }} />
      </span>
    </span>
  );
};
