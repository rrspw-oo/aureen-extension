import type { HighlightColor } from '@/types/highlight';

/** Colors offered by the selection toolbar (web page and desktop). */
export const TOOLBAR_COLORS: { color: HighlightColor; swatch: string; label: string }[] = [
  { color: 'yellow', swatch: '#F0DDAE', label: 'toolbar.champagne' },
  { color: 'mint', swatch: '#CDEBD8', label: 'toolbar.mint' },
  { color: 'coral', swatch: '#F6D0CC', label: 'toolbar.rose' },
  { color: 'sky', swatch: '#CFE0F6', label: 'toolbar.sky' }
];
