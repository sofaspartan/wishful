export function formatPrice(amount: number | null | undefined, currency = 'USD'): string {
  if (amount === null || amount === undefined) return '';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/** Parse a YYYY-MM-DD date as a local calendar date. */
export function parseDateOnly(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function formatDate(value: string | null | undefined, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }): string {
  if (!value) return '';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? parseDateOnly(value) : new Date(value);
  return date.toLocaleDateString(undefined, opts);
}

export function daysUntil(dateOnly: string | null | undefined): number | null {
  if (!dateOnly) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((parseDateOnly(dateOnly).getTime() - today.getTime()) / 86_400_000);
}

export function countdownLabel(dateOnly: string | null | undefined): string {
  const d = daysUntil(dateOnly);
  if (d === null) return '';
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  if (d > 1 && d < 60) return `In ${d} days`;
  if (d < 0) return 'Passed';
  return formatDate(dateOnly);
}

const rtf = typeof Intl !== 'undefined' && 'RelativeTimeFormat' in Intl ? new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }) : null;

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  for (const [unit, secs] of units) {
    if (abs >= secs) return rtf ? rtf.format(Math.round(diff / secs), unit) : `${Math.round(abs / secs)} ${unit}s ago`;
  }
  return 'just now';
}

export function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return 'Good evening';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || '?'
  );
}

export function hostname(url: string | null | undefined): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? '';
}

export function possessive(name: string): string {
  const first = name.split(' ')[0] || name;
  return first.endsWith('s') ? `${first}’` : `${first}’s`;
}
