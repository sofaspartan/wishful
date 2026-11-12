import { useMemo, useState } from 'react';
import { ExternalLink, Pencil } from 'lucide-react';
import type { CashFundDisplayMode, CoverIcon, PaymentMethod, PaymentProvider, PublicCashFundView, PublicContribution } from '../../shared/types';
import { PAYMENT_PROVIDER_LABELS, buildPaymentUrl } from '../../shared/paymentLinks';
import { brand } from '../config/brand';
import { formatPrice } from '../lib/format';
import { CoverAvatar, DEFAULT_COVER_FRAME } from './CoverArt';
import { Button } from './ui/Button';
import { Field, FormError } from './ui/Field';
import { Modal } from './ui/Modal';
import { post, errorMessage } from '../lib/api';
import { forgetContribution, getStoredContributions, saveContribution } from '../lib/contributionTokens';

export function cashFundIcon(icon?: CoverIcon | null): CoverIcon {
  return icon ?? 'cash';
}

const AMOUNT_CHIPS = [25, 50, 100, 200];

function dollarsFromCents(cents: number) {
  return cents / 100;
}

function formatCents(cents: number | null | undefined, currency = 'USD') {
  if (cents == null) return '—';
  return formatPrice(dollarsFromCents(cents), currency);
}

export function cashFundProgress(raisedCents: number | null, goalCents: number | null) {
  if (raisedCents == null) return null;
  if (!goalCents || goalCents <= 0) return { raisedCents, goalCents: null as number | null, pct: null as number | null };
  return { raisedCents, goalCents, pct: Math.min(100, Math.round((raisedCents / goalCents) * 100)) };
}

/** Banner or card presentation of a cash fund (public + owner preview). */
export function CashFundDisplay({
  fund,
  mode,
  currency = 'USD',
  canContribute,
  onContribute,
  onEdit,
  className = '',
}: {
  fund: Pick<PublicCashFundView, 'title' | 'note' | 'goalCents' | 'raisedCents' | 'paymentMethods'> & { icon?: CoverIcon | null };
  mode: CashFundDisplayMode;
  currency?: string;
  canContribute?: boolean;
  onContribute?: () => void;
  /** Owner/editor: pencil control to open the cash fund settings. */
  onEdit?: () => void;
  className?: string;
}) {
  const progress = cashFundProgress(fund.raisedCents, fund.goalCents);
  const hasGoal = fund.goalCents != null && fund.goalCents > 0;
  const totalsHidden = fund.raisedCents == null;
  /** Banner always shows a goal track when a total is set (0% when nothing raised or totals hidden). */
  const bannerPct = hasGoal
    ? totalsHidden
      ? 0
      : Math.min(100, Math.round(((fund.raisedCents ?? 0) / fund.goalCents!) * 100))
    : null;
  const contribute =
    canContribute && onContribute ? (
      <Button className="cash-fund-cta" variant="primary" size={mode === 'banner' ? 'md' : 'sm'} onClick={onContribute}>
        Contribute
      </Button>
    ) : null;
  const editControl = onEdit ? (
    <div className="cash-fund-edit">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        iconOnly
        icon={<Pencil size={16} aria-hidden />}
        aria-label="Edit cash fund"
        title="Edit cash fund"
        onClick={onEdit}
      />
    </div>
  ) : null;

  if (mode === 'banner') {
    return (
      <aside className={`cash-fund cash-fund-banner ${className}`.trim()}>
        {editControl}
        <div className="cash-fund-head">
          <CoverAvatar className="cash-fund-avatar cash-fund-avatar-lg" icon={cashFundIcon(fund.icon)} frame={DEFAULT_COVER_FRAME} />
          <div className="cash-fund-copy">
            <strong className="cash-fund-title">{fund.title}</strong>
            {fund.note ? <p className="cash-fund-note">{fund.note}</p> : null}
          </div>
        </div>
        {hasGoal ? (
          <div className="cash-fund-progress cash-fund-progress-banner">
            <div className="cash-fund-amounts">
              <span>
                {totalsHidden ? `Goal ${formatCents(fund.goalCents, currency)}` : `${formatCents(fund.raisedCents, currency)} of ${formatCents(fund.goalCents, currency)}`}
              </span>
              {!totalsHidden ? <span className="muted">{bannerPct}%</span> : <span className="muted">Surprise Mode</span>}
            </div>
            <div
              className="cash-fund-bar cash-fund-bar-banner"
              role="progressbar"
              aria-valuenow={bannerPct ?? 0}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={totalsHidden ? `Goal ${formatCents(fund.goalCents, currency)}` : `${bannerPct}% of goal`}
            >
              <span style={{ width: `${bannerPct ?? 0}%` }} />
            </div>
            {totalsHidden ? (
              <p className="cash-fund-hidden muted text-sm">How much has been given is hidden while Surprise Mode is on.</p>
            ) : null}
          </div>
        ) : progress ? (
          <div className="cash-fund-progress cash-fund-progress-banner">
            <div className="cash-fund-amounts">
              <span>{formatCents(progress.raisedCents, currency)} raised</span>
            </div>
          </div>
        ) : null}
        {contribute}
      </aside>
    );
  }

  // Card mode mirrors item cards: square media + body, so grid row height matches.
  return (
    <article className={`cash-fund cash-fund-card ${className}`.trim()}>
      {editControl}
      <div className="cash-fund-media">
        <CoverAvatar className="cash-fund-avatar cash-fund-avatar-lg" icon={cashFundIcon(fund.icon)} frame={DEFAULT_COVER_FRAME} />
      </div>
      <div className="cash-fund-body">
        <strong className="cash-fund-title">{fund.title}</strong>
        {fund.note ? <p className="cash-fund-note">{fund.note}</p> : null}
        {progress ? (
          <div className="cash-fund-progress">
            <div className="cash-fund-amounts">
              <span>
                {formatCents(progress.raisedCents, currency)}
                {progress.goalCents != null ? ` of ${formatCents(progress.goalCents, currency)}` : ' raised'}
              </span>
              {progress.pct != null ? <span className="muted">{progress.pct}%</span> : null}
            </div>
            {progress.goalCents != null ? (
              <div className="cash-fund-bar" role="progressbar" aria-valuenow={progress.pct ?? 0} aria-valuemin={0} aria-valuemax={100}>
                <span style={{ width: `${progress.pct ?? 0}%` }} />
              </div>
            ) : null}
          </div>
        ) : hasGoal ? (
          <p className="cash-fund-hidden muted text-sm">Contribution totals are hidden while Surprise Mode is on.</p>
        ) : null}
        {contribute}
      </div>
    </article>
  );
}

/** Guest flow: pick amount → open pay app → confirm “I sent it”. */
export function ContributeDialog({
  open,
  onClose,
  token,
  fund,
  currency = 'USD',
  onRecorded,
}: {
  open: boolean;
  onClose: () => void;
  token: string;
  fund: PublicCashFundView;
  currency?: string;
  onRecorded: () => void;
}) {
  const [step, setStep] = useState<'amount' | 'confirm'>('amount');
  const [amountDollars, setAmountDollars] = useState(50);
  const [custom, setCustom] = useState('');
  const [provider, setProvider] = useState<PaymentProvider | null>(fund.paymentMethods[0]?.provider ?? null);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const method = useMemo(
    () => fund.paymentMethods.find((m) => m.provider === provider) ?? fund.paymentMethods[0] ?? null,
    [fund.paymentMethods, provider],
  );

  const resolvedAmount = custom.trim() ? Number(custom) : amountDollars;
  const amountOk = Number.isFinite(resolvedAmount) && resolvedAmount >= 1;

  const openPayApp = () => {
    if (!method || !amountOk) return;
    setError(null);
    try {
      const url = buildPaymentUrl(method.provider, method.handle, resolvedAmount, fund.title);
      window.open(url, '_blank', 'noopener,noreferrer');
      setProvider(method.provider);
      setStep('confirm');
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const confirmSent = async () => {
    if (!method || !amountOk || !name.trim()) {
      setError('Enter your name and a valid amount.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await post<{
        contributionToken: string;
        contributionId: string;
        amountCents: number;
        provider: PaymentProvider;
        createdAt: string;
      }>(`/api/public/lists/${token}/contributions`, {
        amountCents: Math.round(resolvedAmount * 100),
        name: name.trim(),
        message: message.trim() || undefined,
        provider: method.provider,
      });
      saveContribution(token, {
        token: res.contributionToken,
        contributionId: res.contributionId,
        amountCents: res.amountCents,
        provider: res.provider,
        title: fund.title,
        createdAt: res.createdAt,
      });
      onRecorded();
      onClose();
      setStep('amount');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={step === 'amount' ? `Contribute to ${fund.title}` : 'Confirm what you sent'}
      subtitle={
        step === 'amount'
          ? `Pay on ${method ? PAYMENT_PROVIDER_LABELS[method.provider] : 'your app'} — ${brand.name} never handles the money.`
          : 'So the list can show progress. This is honor-system — we can’t see your payment app.'
      }
      footer={
        step === 'amount' ? (
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={openPayApp} disabled={!method || !amountOk}>
              Open {method ? PAYMENT_PROVIDER_LABELS[method.provider] : 'app'} <ExternalLink size={14} aria-hidden />
            </Button>
          </>
        ) : (
          <>
            <Button
              onClick={() => {
                setStep('amount');
                setError(null);
              }}
            >
              Back
            </Button>
            <Button variant="primary" onClick={confirmSent} loading={busy}>
              I sent it
            </Button>
          </>
        )
      }
    >
      <div className="stack">
        <FormError message={error} />
        {step === 'amount' ? (
          <>
            <div className="cash-amount-chips" role="group" aria-label="Suggested amounts">
              {AMOUNT_CHIPS.map((n) => (
                <button
                  key={n}
                  type="button"
                  className="chip"
                  aria-pressed={custom === '' && amountDollars === n}
                  onClick={() => {
                    setAmountDollars(n);
                    setCustom('');
                  }}
                >
                  {formatPrice(n, currency)}
                </button>
              ))}
            </div>
            <Field label="Custom amount" hint="USD">
              <input
                className="input"
                type="number"
                min={1}
                step="0.01"
                inputMode="decimal"
                placeholder="Other amount"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
              />
            </Field>
            {fund.paymentMethods.length > 1 && (
              <div className="cash-provider-row" role="group" aria-label="Payment app">
                {fund.paymentMethods.map((m) => (
                  <button
                    key={m.provider}
                    type="button"
                    className="chip"
                    aria-pressed={(provider ?? method?.provider) === m.provider}
                    onClick={() => setProvider(m.provider)}
                  >
                    {PAYMENT_PROVIDER_LABELS[m.provider]}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <Field label="Amount you sent">
              <input
                className="input"
                type="number"
                min={1}
                step="0.01"
                inputMode="decimal"
                value={custom || String(amountDollars)}
                onChange={(e) => {
                  setCustom(e.target.value);
                }}
              />
            </Field>
            <Field label="Your name">
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="name" />
            </Field>
            <Field label="Message" optional>
              <textarea className="textarea" rows={2} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={500} />
            </Field>
          </>
        )}
      </div>
    </Modal>
  );
}

export function MyContributions({
  token,
  contributions,
  currency = 'USD',
  onChanged,
}: {
  token: string;
  contributions: PublicContribution[] | null;
  currency?: string;
  onChanged: () => void;
}) {
  const mine = getStoredContributions(token);
  if (!mine.length) return null;
  const visibleIds = new Set((contributions ?? []).map((c) => c.id));

  const withdraw = async (contributionId: string, contributionToken: string) => {
    try {
      await post(`/api/public/lists/${token}/contributions/withdraw`, { contributionToken });
      forgetContribution(token, contributionId);
      onChanged();
    } catch (err) {
      // Still drop local token if server already removed it
      if (String(errorMessage(err)).toLowerCase().includes('couldn’t find')) {
        forgetContribution(token, contributionId);
        onChanged();
      }
    }
  };

  return (
    <div className="cash-mine">
      <strong className="text-sm">Your contributions</strong>
      <ul>
        {mine.map((c) => (
          <li key={c.contributionId}>
            <span>
              {formatCents(c.amountCents, currency)}
              {!visibleIds.has(c.contributionId) && contributions ? ' (removed)' : ''}
            </span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void withdraw(c.contributionId, c.token)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export type { PaymentMethod };
