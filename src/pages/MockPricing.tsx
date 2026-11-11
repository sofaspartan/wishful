import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Minus } from 'lucide-react';
import { brand } from '../config/brand';
import { SiteFooter } from '../components/SiteFooter';
import { SiteNav } from '../components/SiteNav';
import { SkyBanner } from '../components/SkyBanner';

type PlanId = 'free' | 'plus' | 'pro' | 'family';

const PLANS: Array<{
  id: PlanId;
  name: string;
  price: string;
  period: string;
  blurb: string;
  cta: string;
  highlight?: boolean;
}> = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    blurb: 'Make a list, share a link, let people reserve gifts. Growth stays open.',
    cta: 'Stay free',
  },
  {
    id: 'plus',
    name: 'Plus',
    price: '$5',
    period: '/ month',
    blurb: 'For people who live in Wishful — more lists, friends, and polish.',
    cta: 'Imagine Plus',
    highlight: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$12',
    period: '/ month',
    blurb: 'Wishlists plus inventory: collections, boxes, labels, and big libraries.',
    cta: 'Imagine Pro',
  },
  {
    id: 'family',
    name: 'Family',
    price: '$20',
    period: '/ month',
    blurb: 'One bill for the household — up to five seats sharing the Pro toolkit.',
    cta: 'Imagine Family',
  },
];

type Cell = string | boolean;

const METERING: Array<{ label: string; free: Cell; plus: Cell; pro: Cell; family: Cell }> = [
  { label: 'Active wishlists', free: '3', plus: 'Unlimited', pro: 'Unlimited', family: 'Shared unlimited' },
  { label: 'Collections', free: '1', plus: 'Unlimited', pro: 'Unlimited', family: 'Shared unlimited' },
  { label: 'Boxes', free: '—', plus: '5', pro: 'Unlimited', family: 'Shared unlimited' },
  { label: 'QR box labels', free: false, plus: 'Print a few', pro: true, family: true },
  { label: 'Saved items (total)', free: '75', plus: '500', pro: 'Unlimited', family: 'Unlimited' },
  { label: 'Photo / upload storage', free: '50 MB', plus: '1 GB', pro: '10 GB', family: '25 GB' },
  { label: 'Collaborators per list', free: '2', plus: '10', pro: 'Unlimited', family: 'Unlimited' },
  { label: 'Recipients (“for Me + …”)', free: '1 person', plus: true, pro: true, family: true },
  { label: 'Public & unlisted share links', free: true, plus: true, pro: true, family: true },
  { label: 'Gift claims & surprise mode', free: true, plus: true, pro: true, family: true },
  { label: 'Friends & people search', free: true, plus: true, pro: true, family: true },
  { label: 'Cover art & public profile', free: 'Basics', plus: 'Full', pro: 'Full', family: 'Full' },
  { label: 'Browser extension', free: 'Save to 1 list', plus: 'Full', pro: 'Full + bulk', family: 'Full + bulk' },
  { label: 'CSV export', free: false, plus: false, pro: true, family: true },
  { label: 'Seats included', free: '1', plus: '1', pro: '1', family: '5' },
];

function CellValue({ value }: { value: Cell }) {
  if (value === true) return <Check size={18} className="pricing-yes" aria-label="Included" />;
  if (value === false) return <Minus size={16} className="pricing-no" aria-label="Not included" />;
  return <span>{value}</span>;
}

/** Speculative pricing page — not live billing. For kicks while we think through tiers. */
export default function MockPricing() {
  const name = brand.name;
  const [yearly, setYearly] = useState(true);

  useEffect(() => {
    document.title = `Mock pricing · ${name}`;
  }, [name]);

  const priceFor = (id: PlanId, sticker: string) => {
    if (id === 'free') return sticker;
    if (!yearly) return sticker;
    const n = Number(sticker.replace(/[^0-9.]/g, ''));
    return `$${Math.round(n * 0.8)}`;
  };

  return (
    <div className="public-shell">
      <div className="landing-top">
        <SiteNav />
      </div>
      <main id="main">
        <SkyBanner className="legal-banner">
          <header className="legal-head">
            <span className="eyebrow">For kicks · not live</span>
            <h1 className="display">Mock pricing</h1>
            <p className="legal-updated">
              A sketch of Free · Plus · Pro · Family — how metering <em>could</em> work. Nothing here bills you.
            </p>
          </header>
        </SkyBanner>

        <div className="public-content pricing-mock">
          <div className="notice notice-accent pricing-mock-note">
            <div>
              <strong>Speculative only.</strong> Limits and prices are placeholders for product discussion. Gift links, claims, and viewing shared
              lists stay free in every sketch — those are the growth loops.
            </div>
          </div>

          <div className="pricing-billing" role="group" aria-label="Billing period">
            <button type="button" className="chip" aria-pressed={!yearly} onClick={() => setYearly(false)}>
              Monthly
            </button>
            <button type="button" className="chip" aria-pressed={yearly} onClick={() => setYearly(true)}>
              Yearly <span className="faint">save ~20%</span>
            </button>
          </div>

          <div className="pricing-grid">
            {PLANS.map((plan) => (
              <article key={plan.id} className={['pricing-card', plan.highlight && 'pricing-card-featured'].filter(Boolean).join(' ')}>
                {plan.highlight && <span className="pricing-badge">Most loved (guess)</span>}
                <h2 className="pricing-name">{plan.name}</h2>
                <p className="pricing-price">
                  <span className="pricing-amount">{priceFor(plan.id, plan.price)}</span>
                  {plan.id !== 'free' && (
                    <span className="pricing-period">
                      {yearly ? '/ month, billed yearly' : plan.period}
                    </span>
                  )}
                  {plan.id === 'free' && <span className="pricing-period">{plan.period}</span>}
                </p>
                <p className="pricing-blurb">{plan.blurb}</p>
                <Link to="/register" className={`btn${plan.highlight ? ' btn-primary' : ''}`}>
                  {plan.cta}
                </Link>
              </article>
            ))}
          </div>

          <section className="pricing-metering" aria-labelledby="metering-title">
            <h2 id="metering-title" className="display pricing-section-title">
              Metering sketch
            </h2>
            <p className="muted" style={{ maxWidth: '52rem', marginBottom: 'var(--s-5)' }}>
              Soft caps over hard walls: you’d keep existing lists if you hit a limit — creating new ones (or packing new boxes) would nudge an
              upgrade. Public viewers never need a plan.
            </p>

            <div className="pricing-table-wrap">
              <table className="pricing-table">
                <thead>
                  <tr>
                    <th scope="col">Limit</th>
                    {PLANS.map((p) => (
                      <th key={p.id} scope="col">
                        {p.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {METERING.map((row) => (
                    <tr key={row.label}>
                      <th scope="row">{row.label}</th>
                      <td>
                        <CellValue value={row.free} />
                      </td>
                      <td>
                        <CellValue value={row.plus} />
                      </td>
                      <td>
                        <CellValue value={row.pro} />
                      </td>
                      <td>
                        <CellValue value={row.family} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="pricing-notes" aria-labelledby="notes-title">
            <h2 id="notes-title" className="pricing-section-title">
              Guardrails we’d keep
            </h2>
            <ul className="pricing-note-list">
              <li>
                <strong>Never paywall the gift.</strong> Opening a shared list, reserving an item, and surprise-mode basics stay free for guests.
              </li>
              <li>
                <strong>Holiday-safe upgrades.</strong> Hitting a cap mid-season shouldn’t break a live birthday list — only block new capacity.
              </li>
              <li>
                <strong>Pro owns the “stuff” wedge.</strong> Boxes + QR labels + big collections are the clearest reason to leave Plus.
              </li>
              <li>
                <strong>Family before Enterprise.</strong> Household seats first; branded registries / SSO later if a B2B channel appears.
              </li>
            </ul>
            <p className="muted text-sm" style={{ marginTop: 'var(--s-6)' }}>
              Back to the <Link to="/">home page</Link>, or keep browsing <Link to="/gifts">gift ideas</Link>.
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
