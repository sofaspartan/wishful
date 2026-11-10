import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Info, Link2Off, Lock, MapPin, Package, Pencil, ScanLine, Search, Truck } from 'lucide-react';
import { formatBoxCode, isBoxCode, isDarkCover, normalizeBoxCode, type PublicBoxView } from '../../shared/types';
import { BOX_MATERIAL_LABELS } from '../../shared/constants';
import { useMe, usePublicBox } from '../lib/queries';
import { ApiError, errorMessage } from '../lib/api';
import { brand } from '../config/brand';
import { Logo } from '../components/Logo';
import { ThemeToggle } from '../components/ThemeToggle';
import { CoverArt, CoverAvatar } from '../components/CoverArt';
import { ItemCard, ItemCardSkeleton } from '../components/ItemCard';
import { ItemDetailModal } from '../components/ItemDetailModal';
import { BoxNumberBadge, FragileBadge, boxDisplayName, thingCount } from '../components/BoxVisuals';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/misc';
import { SkyArt } from '../components/SkyArt';

function ScanHeader() {
  const { data: me } = useMe();
  return (
    <header className="public-header">
      <Logo to="/" size={28} />
      <div className="spacer" />
      {me ? (
        <Link to="/app/boxes" className="btn btn-sm">
          My boxes
        </Link>
      ) : (
        <Link to="/register" className="btn btn-sm">
          <span className="hide-xs">Organize your own boxes</span>
          <span className="show-xs">Sign up free</span>
        </Link>
      )}
      <ThemeToggle />
    </header>
  );
}

/** `/b`: type the code printed under a box's QR code. */
export function BoxCodeEntry() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const clean = normalizeBoxCode(code);
    if (!isBoxCode(clean)) return setError('Box codes are 12 letters and numbers, like 7K3Q-M9XP-A2CD.');
    navigate(`/b/${clean}`);
  };
  return (
    <div className="public-shell">
      <ScanHeader />
      <main id="main" className="public-content box-entry">
        <EmptyState art={<SkyArt scene="boxes" />} title="Open a box">
          Type the code printed under the box’s QR code.
        </EmptyState>
        <form className="box-entry-form" onSubmit={submit} noValidate>
          <input
            className="input box-entry-input"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setError(null);
            }}
            placeholder="XXXX-XXXX-XXXX"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            aria-label="Box code"
            aria-invalid={Boolean(error)}
            autoFocus
          />
          <Button variant="primary" type="submit" icon={<ScanLine size={16} />}>
            Open box
          </Button>
        </form>
        {error && (
          <p className="field-error" role="alert" style={{ textAlign: 'center' }}>
            {error}
          </p>
        )}
      </main>
    </div>
  );
}

/** `/b/:code`: what's in a box, for whoever scanned its label. */
export default function BoxScan() {
  const { code: raw } = useParams();
  const code = raw ? normalizeBoxCode(raw) : undefined;
  const { data, isLoading, error } = usePublicBox(code);

  if (isLoading) {
    return (
      <div className="public-shell">
        <ScanHeader />
        <div className="public-content">
          <div className="grid-items">
            {Array.from({ length: 6 }, (_, i) => (
              <ItemCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }
  if (error || !data) {
    const status = error instanceof ApiError ? error.status : 0;
    return (
      <div className="public-shell">
        <ScanHeader />
        <main id="main" className="public-content">
          {status === 403 ? (
            <EmptyState
              icon={<Lock size={22} />}
              title="This box is private"
              action={
                <Link to={`/login?next=${encodeURIComponent(`/b/${code}`)}`} className="btn btn-primary">
                  Sign in
                </Link>
              }
            >
              {errorMessage(error)}
            </EmptyState>
          ) : (
            <EmptyState
              icon={<Link2Off size={22} />}
              title={status === 404 ? 'No box with this code' : status === 429 ? 'Slow down a little' : 'Something went wrong'}
              action={
                <Link to="/b" className="btn">
                  Type a code
                </Link>
              }
            >
              {status === 404 ? 'The label may have been replaced with a new one, or the code was typed wrong.' : errorMessage(error)}
            </EmptyState>
          )}
        </main>
      </div>
    );
  }
  return <BoxScanView view={data} />;
}

function BoxScanView({ view }: { view: PublicBoxView }) {
  const { box, items, lines, viewer } = view;
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const q = query.trim().toLowerCase();
  const shownItems = useMemo(
    () => (q ? items.filter((i) => [i.title, i.brand, i.category].some((s) => s.toLowerCase().includes(q))) : items),
    [items, q],
  );
  const shownLines = q ? lines.filter((l) => l.text.toLowerCase().includes(q)) : lines;
  const total = items.length + lines.length;
  const openItem = openId ? (items.find((i) => i.id === openId) ?? null) : null;

  useEffect(() => {
    document.title = `${boxDisplayName(box)} · ${brand.name}`;
  }, [box]);

  return (
    <div className="public-shell box-scan" style={{ ['--box-color' as string]: box.color }}>
      <ScanHeader />

      {viewer.isOwner && box.id && (
        <div className="public-hero" style={{ marginBottom: 'var(--s-4)' }}>
          <div className="notice notice-accent" style={{ marginBottom: 0 }}>
            <Info size={18} aria-hidden />
            <div style={{ flex: 1 }}>
              <strong>This is your box.</strong> {box.location ? `It’s kept in ${box.location}. ` : ''}People who scan it don’t see where it’s kept
              {box.showPrices ? '.' : ' or any prices.'}
            </div>
            <Link to={`/app/boxes/${box.id}`} className="btn btn-sm">
              <Pencil size={14} aria-hidden /> Manage box
            </Link>
          </div>
        </div>
      )}

      <section className="public-hero">
        <header className={['wl-hero', 'public-wl-hero', 'box-hero', isDarkCover(box.coverArt) && 'wl-hero-dark'].filter(Boolean).join(' ')}>
          <div className="wl-hero-bg" aria-hidden>
            <CoverArt art={box.coverArt} showIcon={false} />
          </div>
          <span className="box-stripe" aria-hidden />
          <div className="wl-hero-body">
            <CoverAvatar className="wl-hero-avatar" icon={box.coverArt.icon} frame={box.coverArt.frame} />
            <div className="wl-hero-main">
              <div className="row-wrap">
                <BoxNumberBadge box={box} outline />
                {box.fragile && <FragileBadge outline />}
                <span className="badge badge-outline">{BOX_MATERIAL_LABELS[box.material]}</span>
              </div>
              <h1 className="wl-hero-title display">{box.name}</h1>
              {box.room && (
                <p className="box-scan-room">
                  <Truck size={18} aria-hidden /> Goes to the <strong>{box.room}</strong>
                </p>
              )}
              <div className="row-wrap text-sm muted" style={{ gap: 'var(--s-4)' }}>
                <span className="row" style={{ gap: 6 }}>
                  <Package size={15} aria-hidden /> {thingCount(total)} inside
                </span>
                {viewer.isOwner && box.location && (
                  <span className="row" style={{ gap: 6 }}>
                    <MapPin size={15} aria-hidden /> {box.location}
                  </span>
                )}
              </div>
            </div>
          </div>
        </header>
      </section>

      <main id="main" className="public-content">
        {total === 0 ? (
          <EmptyState art={<SkyArt scene="boxes" />} title="This box is empty">
            Nothing has been packed in it yet.
          </EmptyState>
        ) : (
          <>
            {total > 6 && (
              <div className="toolbar">
                <div className="input-group" style={{ flex: '1 1 260px' }}>
                  <Search size={16} aria-hidden />
                  <input
                    className="input"
                    type="search"
                    placeholder="Search this box"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    aria-label="Search this box"
                  />
                </div>
              </div>
            )}
            {items.length > 0 && (
              <section className="section" aria-label="Items">
                {lines.length > 0 && <h2 className="section-label">Items</h2>}
                {shownItems.length ? (
                  <div className="grid-items">
                    {shownItems.map((item) => (
                      <div key={item.id} style={{ minWidth: 0 }}>
                        <ItemCard item={item} owned={item.owned} onOpen={() => setOpenId(item.id)} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted text-sm">No items match.</p>
                )}
              </section>
            )}
            {lines.length > 0 && (
              <section className="section" aria-label="Other things">
                {items.length > 0 && <h2 className="section-label">Other things</h2>}
                {shownLines.length ? (
                  <ul className="box-lines box-lines-readonly">
                    {shownLines.map((l) => (
                      <li key={l.id} className="box-line">
                        <span className="box-line-count">{l.quantity}×</span>
                        <span className="box-line-label">{l.text}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted text-sm">No other things match.</p>
                )}
              </section>
            )}
          </>
        )}
      </main>

      <footer className="public-footer">
        <p className="box-scan-code">
          Box code <strong>{formatBoxCode(box.code)}</strong>
        </p>
        <Logo to="/" size={22} />
        <p style={{ marginTop: 8 }}>
          Organized with {brand.name}.{' '}
          <Link to="/register" style={{ textDecoration: 'underline' }}>
            Label your own boxes
          </Link>
        </p>
      </footer>

      <ItemDetailModal item={openItem} onClose={() => setOpenId(null)} />
    </div>
  );
}
