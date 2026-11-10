import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Lock, MapPin, Package, Truck, Wine } from 'lucide-react';
import type { Box, BoxSummary } from '../../shared/types';
import { qrPath } from '../../shared/qr';
import { relativeTime } from '../lib/format';
import { useBoxes } from '../lib/queries';
import { CoverArt } from './CoverArt';

/** A QR code with a two-module quiet zone, drawn crisp at any size. */
export function QrCode({ value, className, label = 'QR code' }: { value: string; className?: string; label?: string }) {
  const { size, path } = useMemo(() => qrPath(value), [value]);
  const full = size + 4;
  return (
    <svg
      className={['qr', className].filter(Boolean).join(' ')}
      viewBox={`-2 -2 ${full} ${full}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
    >
      <rect x={-2} y={-2} width={full} height={full} fill="#fff" />
      <path d={path} fill="#111" />
    </svg>
  );
}

export const boxNumberLabel = (box: Pick<Box, 'number'>): string | null => (box.number ? `Box ${box.number}` : null);

/** "Box 3 · Winter clothes", or just the name. */
export const boxDisplayName = (box: Pick<Box, 'number' | 'name'>): string => [boxNumberLabel(box), box.name].filter(Boolean).join(' · ');

export function BoxNumberBadge({ box, outline }: { box: Pick<Box, 'number' | 'color'>; outline?: boolean }) {
  const label = boxNumberLabel(box);
  if (!label) return null;
  return (
    <span className={`badge box-badge${outline ? ' badge-outline' : ''}`}>
      <span className="box-dot" style={{ background: box.color }} aria-hidden />
      {label}
    </span>
  );
}

export function FragileBadge({ outline }: { outline?: boolean }) {
  return (
    <span className={`badge badge-warning${outline ? ' badge-outline' : ''}`}>
      <Wine aria-hidden /> Fragile
    </span>
  );
}

export function OwnerOnlyBadge({ outline }: { outline?: boolean }) {
  return (
    <span className={`badge${outline ? ' badge-outline' : ''}`}>
      <Lock aria-hidden /> Only you
    </span>
  );
}

export const thingCount = (n: number) => `${n} ${n === 1 ? 'thing' : 'things'}`;

type BoxCardFields = Pick<BoxSummary, 'name' | 'number' | 'color' | 'coverArt' | 'fragile' | 'access' | 'location' | 'room'>;

export function BoxCard({ box, menu }: { box: BoxSummary; menu?: ReactNode }) {
  return (
    <article className="wl-card box-card" aria-label={box.name}>
      <Link to={`/app/boxes/${box.id}`} className="wl-card-link" aria-label={`Open ${boxDisplayName(box)}`} />
      <BoxCardFace box={box} things={box.itemCount + box.lineCount} updatedAt={box.updatedAt} menu={menu} />
    </article>
  );
}

/** A non-interactive box card showing how a box will look while it's being edited. */
export function BoxCardPreview({ box, things, placeholder }: { box: BoxCardFields; things: number; placeholder: string }) {
  return (
    <div className="wl-card box-card wl-card-preview" aria-hidden>
      <BoxCardFace box={{ ...box, name: box.name.trim() || placeholder }} things={things} />
    </div>
  );
}

function BoxCardFace({ box, things, updatedAt, menu }: { box: BoxCardFields; things: number; updatedAt?: string; menu?: ReactNode }) {
  return (
    <>
      <div className="box-card-cover" style={{ ['--box-color' as string]: box.color }}>
        <div className="wl-cover">
          <CoverArt art={box.coverArt} />
        </div>
        <span className="box-stripe" aria-hidden />
        <div className="wl-card-badges">
          <BoxNumberBadge box={box} />
          {box.fragile && <FragileBadge />}
          {box.access === 'owner' && <OwnerOnlyBadge />}
        </div>
        {menu && <div className="wl-card-menu row">{menu}</div>}
      </div>
      <div className="wl-body">
        <h3 className="wl-title truncate">{box.name}</h3>
        {box.location && (
          <p className="wl-desc row truncate" style={{ gap: 6 }}>
            <MapPin size={13} aria-hidden /> {box.location}
          </p>
        )}
        <div className="wl-meta">
          <span>
            <Package size={13} aria-hidden /> {thingCount(things)}
          </span>
          {box.room && (
            <span>
              <Truck size={13} aria-hidden /> {box.room}
            </span>
          )}
          {updatedAt && <span style={{ marginLeft: 'auto' }}>Updated {relativeTime(updatedAt)}</span>}
        </div>
      </div>
    </>
  );
}

/** Where an item is packed, as a small link to its box. */
export function BoxChip({ box }: { box: Pick<BoxSummary, 'id' | 'name' | 'number' | 'color' | 'location'> }) {
  return (
    <Link to={`/app/boxes/${box.id}`} className="box-chip" title={box.location ? `${boxDisplayName(box)} · ${box.location}` : boxDisplayName(box)}>
      <span className="box-dot" style={{ background: box.color }} aria-hidden />
      <span className="truncate">{boxNumberLabel(box) ?? box.name}</span>
      {box.location && <span className="box-chip-where truncate">{box.location}</span>}
    </Link>
  );
}

/** The signed-in user's boxes by id, for showing where items are packed. */
export function useBoxMap(enabled = true): Map<string, BoxSummary> {
  const { data } = useBoxes(enabled);
  return useMemo(() => new Map((data ?? []).map((b) => [b.id, b])), [data]);
}
