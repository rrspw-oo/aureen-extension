const PREFIX = /(NT\$|US\$|TWD|HK\$|\$|＄|¥|€|£)\s?(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?/;
const SUFFIX = /(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?\s?(元|円|TWD)/;

export function extractPrice(text: string): { amount: number; label: string } | null {
  const prefix = PREFIX.exec(text);
  const suffix = SUFFIX.exec(text);
  const match = prefix && (!suffix || prefix.index <= suffix.index) ? prefix : suffix;
  if (!match) return null;
  const digits = match === prefix ? `${match[2]}${match[3] ?? ''}` : `${match[1]}${match[2] ?? ''}`;
  return { amount: Number(digits.replace(/,/g, '')), label: match[0].trim() };
}

export function parsePriceInput(text: string): { amount: number; label: string } | null {
  const trimmed = text.trim();
  const bare = /^(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?$/.exec(trimmed);
  if (bare) {
    const amount = Number(`${bare[1]}${bare[2] ?? ''}`.replace(/,/g, ''));
    return { amount, label: `NT$${amount.toLocaleString('en-US')}` };
  }
  return extractPrice(trimmed);
}
