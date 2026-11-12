import { PAYMENT_PROVIDERS, type PaymentMethod, type PaymentProvider } from './types';

export const PAYMENT_PROVIDER_LABELS: Record<PaymentProvider, string> = {
  venmo: 'Venmo',
  cashapp: 'Cash App',
  paypal: 'PayPal',
};

export const PAYMENT_PROVIDER_HINTS: Record<PaymentProvider, string> = {
  venmo: 'Your Venmo username',
  cashapp: 'Your $Cashtag without the $',
  paypal: 'The name after paypal.me/',
};

/** Strip leading @ / $ and trim. */
export function normalizePaymentHandle(provider: PaymentProvider, raw: string): string {
  let handle = raw.trim();
  if (provider === 'cashapp') handle = handle.replace(/^\$+/, '');
  else handle = handle.replace(/^@+/, '');
  return handle.trim();
}

const HANDLE_RE: Record<PaymentProvider, RegExp> = {
  venmo: /^[A-Za-z0-9_-]{3,30}$/,
  cashapp: /^[A-Za-z0-9_]{1,20}$/,
  paypal: /^[A-Za-z0-9._-]{3,64}$/,
};

export function isValidPaymentHandle(provider: PaymentProvider, handle: string): boolean {
  return HANDLE_RE[provider].test(normalizePaymentHandle(provider, handle));
}

/**
 * Deep link that opens the app/site with amount prefilled.
 * Amount is in dollars (e.g. 25 or 25.5). Prefill is a suggestion — the payer can change it.
 */
export function buildPaymentUrl(provider: PaymentProvider, handle: string, amountDollars: number, note?: string): string {
  const h = encodeURIComponent(normalizePaymentHandle(provider, handle));
  const dollars = Math.round(amountDollars * 100) / 100;
  if (dollars <= 0) throw new Error('Amount must be positive');
  const amountStr = Number.isInteger(dollars) ? String(dollars) : dollars.toFixed(2);

  if (provider === 'venmo') {
    const params = new URLSearchParams({ txn: 'pay', amount: dollars.toFixed(2) });
    if (note?.trim()) params.set('note', note.trim().slice(0, 200));
    return `https://venmo.com/u/${h}?${params.toString()}`;
  }
  if (provider === 'cashapp') {
    return `https://cash.app/$${h}/${amountStr}`;
  }
  return `https://paypal.me/${h}/${amountStr}`;
}

export function filterPaymentMethods(methods: PaymentMethod[], providers: PaymentProvider[] | null | undefined): PaymentMethod[] {
  const allowed = providers?.length ? new Set(providers) : null;
  return methods.filter((m) => PAYMENT_PROVIDERS.includes(m.provider) && m.handle && (!allowed || allowed.has(m.provider)));
}
