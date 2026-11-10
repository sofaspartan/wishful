import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Download, Printer, Truck, Wine } from 'lucide-react';
import { formatBoxCode, isDarkCover, type BoxSummary } from '../../shared/types';
import { useBoxes } from '../lib/queries';
import { boxUrl, useLocalPref } from '../lib/prefs';
import { CoverArt } from '../components/CoverArt';
import { QrCode, boxDisplayName, boxNumberLabel } from '../components/BoxVisuals';
import { Button } from '../components/ui/Button';
import { EmptyState, PageLoader } from '../components/ui/misc';
import { SkyArt } from '../components/SkyArt';

type Variant = 'wide' | 'square' | 'tall' | 'page';

interface Format {
  name: string;
  hint: string;
  /** Page size in inches. */
  page: [number, number];
  cols: number;
  rows: number;
  /** Label size in inches. */
  cell: [number, number];
  /** Top and left page margins, in inches. */
  margin: [number, number];
  /** Column and row gaps, in inches. */
  gap: [number, number];
  variant: Variant;
}

const FORMATS = {
  avery5163: {
    name: 'Avery 5163 · 2×4 in, 10 per sheet',
    hint: 'Also fits Avery 8163, 5263, 15163 and 18163.',
    page: [8.5, 11],
    cols: 2,
    rows: 5,
    cell: [4, 2],
    margin: [0.5, 0.15625],
    gap: [0.1875, 0],
    variant: 'wide',
  },
  avery22806: {
    name: 'Avery 22806 · 2×2 in square, 12 per sheet',
    hint: 'Square labels vary a little between brands, so try a plain-paper test print first.',
    page: [8.5, 11],
    cols: 3,
    rows: 4,
    cell: [2, 2],
    margin: [0.625, 0.625],
    gap: [0.625, 0.5833],
    variant: 'square',
  },
  thermal: {
    name: '4×6 in shipping label',
    hint: 'For thermal label printers like Rollo, Zebra and DYMO 4XL.',
    page: [4, 6],
    cols: 1,
    rows: 1,
    cell: [4, 6],
    margin: [0, 0],
    gap: [0, 0],
    variant: 'tall',
  },
  page: {
    name: 'One big label per page',
    hint: 'Letter paper. Tape it to the side of the box.',
    page: [8.5, 11],
    cols: 1,
    rows: 1,
    cell: [7.5, 10],
    margin: [0.5, 0.5],
    gap: [0, 0],
    variant: 'page',
  },
} satisfies Record<string, Format>;

type FormatId = keyof typeof FORMATS;
const FORMAT_IDS = Object.keys(FORMATS) as FormatId[];
const STYLES = ['art', 'ink'] as const;
type LabelStyle = (typeof STYLES)[number];

const inch = (n: number) => `${n}in`;

/** Printable QR labels for one or more boxes, sized to real label sheets. */
export default function BoxLabels() {
  const { data: boxes, isLoading } = useBoxes();
  const [params] = useSearchParams();
  const [formatId, setFormatId] = useLocalPref<FormatId>('labels.format', 'avery5163', FORMAT_IDS);
  const [style, setStyle] = useLocalPref<LabelStyle>('labels.style', 'art', STYLES);
  const [showRoom, setShowRoom] = useState(true);
  const [showLocation, setShowLocation] = useState(false);
  const [skip, setSkip] = useState(0);
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const format: Format = FORMATS[formatId];
  const perSheet = format.cols * format.rows;

  useEffect(() => {
    const root = document.documentElement;
    const before = root.dataset.theme;
    root.dataset.theme = 'light';
    document.title = 'Print box labels';
    return () => {
      if (before) root.dataset.theme = before;
    };
  }, []);

  const all = useMemo(
    () => [...(boxes ?? [])].sort((a, b) => (a.number ?? Infinity) - (b.number ?? Infinity) || a.name.localeCompare(b.name)),
    [boxes],
  );
  const selected = useMemo(() => {
    if (picked) return picked;
    const fromUrl = params.get('ids')?.split(',').filter(Boolean);
    return new Set(fromUrl?.length ? fromUrl : all.map((b) => b.id));
  }, [picked, params, all]);
  const chosen = all.filter((b) => selected.has(b.id));
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  };

  const skipped = perSheet > 1 ? Math.min(skip, perSheet - 1) : 0;
  const cells: Array<BoxSummary | null> = [...Array.from({ length: skipped }, () => null), ...chosen];
  const sheets: Array<Array<BoxSummary | null>> = [];
  for (let i = 0; i < cells.length; i += perSheet) sheets.push(cells.slice(i, i + perSheet));

  if (isLoading) return <PageLoader />;

  const sheetStyle: CSSProperties = {
    width: inch(format.page[0]),
    height: `calc(${inch(format.page[1])} - 1px)`,
    paddingTop: inch(format.margin[0]),
    paddingLeft: inch(format.margin[1]),
    gridTemplateColumns: `repeat(${format.cols}, ${inch(format.cell[0])})`,
    gridAutoRows: inch(format.cell[1]),
    columnGap: inch(format.gap[0]),
    rowGap: inch(format.gap[1]),
  };

  return (
    <div className="labels-page">
      <style>{`@page { size: ${format.page[0]}in ${format.page[1]}in; margin: 0; }`}</style>
      <header className="labels-toolbar no-print">
        <div className="labels-toolbar-top">
          <Link to="/app/boxes" className="btn btn-ghost btn-sm">
            <ArrowLeft size={16} aria-hidden /> Boxes
          </Link>
          <h1 className="labels-title display">Print labels</h1>
          <div className="spacer" />
          <Button variant="primary" icon={<Printer size={16} />} onClick={() => window.print()} disabled={chosen.length === 0}>
            Print {chosen.length > 1 ? `${chosen.length} labels` : 'label'}
          </Button>
        </div>
        <div className="labels-controls">
          <label className="field">
            <span className="field-label">Label paper</span>
            <select className="select" value={formatId} onChange={(e) => setFormatId(e.target.value as FormatId)}>
              {FORMAT_IDS.map((id) => (
                <option key={id} value={id}>
                  {FORMATS[id].name}
                </option>
              ))}
            </select>
            <span className="field-hint">{format.hint}</span>
          </label>
          <div className="field">
            <span className="field-label" id="label-style">
              Style
            </span>
            <div className="segmented" role="group" aria-labelledby="label-style">
              {STYLES.map((s) => (
                <button key={s} type="button" aria-pressed={style === s} onClick={() => setStyle(s)}>
                  {s === 'art' ? 'Colour art' : 'Ink saver'}
                </button>
              ))}
            </div>
          </div>
          <div className="field labels-checks">
            <label className="check">
              <input type="checkbox" checked={showRoom} onChange={(e) => setShowRoom(e.target.checked)} /> Room it goes to
            </label>
            <label className="check">
              <input type="checkbox" checked={showLocation} onChange={(e) => setShowLocation(e.target.checked)} /> Where it’s kept
            </label>
          </div>
          {perSheet > 1 && (
            <label className="field labels-skip">
              <span className="field-label">Skip used labels</span>
              <input
                className="input"
                type="number"
                min={0}
                max={perSheet - 1}
                value={skip}
                onChange={(e) => setSkip(Math.max(0, Math.min(perSheet - 1, Number(e.target.value) || 0)))}
              />
              <span className="field-hint">For a sheet you’ve already used part of.</span>
            </label>
          )}
        </div>
        <p className="field-hint" style={{ margin: 0 }}>
          Print at 100% (“Actual size”) with no scaling or headers.
        </p>
        {all.length > 1 && (
          <div className="labels-picker" role="group" aria-label="Boxes to print">
            <button type="button" className="link-button text-sm" onClick={() => setPicked(new Set(all.map((b) => b.id)))}>
              All
            </button>
            <button type="button" className="link-button text-sm" onClick={() => setPicked(new Set())}>
              None
            </button>
            {all.map((b) => (
              <label key={b.id} className={`labels-pick${selected.has(b.id) ? ' is-on' : ''}`}>
                <input type="checkbox" checked={selected.has(b.id)} onChange={() => toggle(b.id)} />
                <span className="box-dot" style={{ background: b.color }} aria-hidden />
                <span className="truncate">{boxDisplayName(b)}</span>
              </label>
            ))}
          </div>
        )}
        {chosen.length === 1 && (
          <a
            className="btn btn-sm"
            href={`/og/box/${chosen[0].id}.png`}
            download={`${boxDisplayName(chosen[0])}.png`}
            style={{ alignSelf: 'flex-start' }}
          >
            <Download size={14} aria-hidden /> Download as an image
          </a>
        )}
      </header>

      {all.length === 0 ? (
        <EmptyState
          art={<SkyArt scene="boxes" />}
          title="No boxes to label"
          action={
            <Link to="/app/boxes" className="btn btn-primary">
              Make a box
            </Link>
          }
        >
          Make a box first, then come back to print its QR label.
        </EmptyState>
      ) : chosen.length === 0 ? (
        <p className="muted no-print" style={{ textAlign: 'center' }}>
          Pick at least one box to print.
        </p>
      ) : (
        <div className="labels-sheets">
          {sheets.map((sheet, i) => (
            <div key={i} className="label-sheet" style={sheetStyle}>
              {sheet.map((box, j) =>
                box ? (
                  <BoxLabel key={box.id} box={box} variant={format.variant} ink={style === 'ink'} showRoom={showRoom} showLocation={showLocation} />
                ) : (
                  <div key={`skip-${j}`} className="label-skipped" aria-hidden />
                ),
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function BoxLabel({
  box,
  variant,
  ink,
  showRoom,
  showLocation,
}: {
  box: BoxSummary;
  variant: Variant;
  ink: boolean;
  showRoom: boolean;
  showLocation: boolean;
}) {
  const number = boxNumberLabel(box);
  const banded = variant === 'tall' || variant === 'page';
  const dark = !ink && !banded && isDarkCover(box.coverArt);
  const room = showRoom && box.room;
  const where = showLocation && box.location;
  return (
    <div
      className={['box-label', `box-label-${variant}`, ink ? 'is-ink' : 'is-art', dark && 'is-dark'].filter(Boolean).join(' ')}
      style={{ ['--box-color' as string]: box.color }}
    >
      {!ink && (
        <div className="box-label-art" aria-hidden>
          <CoverArt art={box.coverArt} showIcon={banded} />
        </div>
      )}
      {banded && ink && (
        <div className="box-label-band-ink" aria-hidden>
          {number ?? box.name}
        </div>
      )}
      <div className="box-label-qr">
        <QrCode value={boxUrl(box.code)} label={`QR code for ${box.name}`} />
      </div>
      <div className="box-label-text">
        {number && variant !== 'square' && (
          <span className="box-label-number">
            <span className="box-dot" style={{ background: box.color }} aria-hidden />
            {number}
          </span>
        )}
        <span className="box-label-name">{variant === 'square' ? boxDisplayName(box) : box.name}</span>
        {room && (
          <span className="box-label-room">
            <Truck aria-hidden /> {box.room}
          </span>
        )}
        {where && <span className="box-label-where">{box.location}</span>}
        {box.fragile && (
          <span className="box-label-fragile">
            <Wine aria-hidden /> Fragile
          </span>
        )}
        <span className="box-label-code">
          {variant !== 'square' && <span className="box-label-host">{window.location.host}/b</span>}
          <span>{formatBoxCode(box.code)}</span>
        </span>
      </div>
    </div>
  );
}
