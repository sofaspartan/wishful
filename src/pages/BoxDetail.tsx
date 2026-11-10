import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Download,
  EyeOff,
  MapPin,
  Minus,
  MoreHorizontal,
  NotebookPen,
  PackageOpen,
  PackagePlus,
  Pencil,
  Plus,
  Printer,
  QrCode as QrIcon,
  ScanLine,
  Search,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import { isDarkCover, type BoxDetail as Detail, type BoxLine, type Item } from '../../shared/types';
import { BOX_MATERIAL_LABELS, BOX_SIZE_LABELS } from '../../shared/constants';
import { MAX_BOX_LINES } from '../../shared/schemas';
import { keys, useBox, useInvalidate } from '../lib/queries';
import { ApiError, del, errorMessage, patch, post } from '../lib/api';
import { relativeTime } from '../lib/format';
import { ItemCard } from '../components/ItemCard';
import { ItemDetailModal } from '../components/ItemDetailModal';
import { EditItemModal } from '../components/EditItemModal';
import { CoverArt, CoverAvatar } from '../components/CoverArt';
import { BoxFormModal } from '../components/BoxFormModal';
import { BoxCodeDialog, PackItemsDialog, PutInBoxDialog } from '../components/BoxDialogs';
import { BoxNumberBadge, FragileBadge, OwnerOnlyBadge, thingCount } from '../components/BoxVisuals';
import { Menu, MenuItem, MenuSeparator } from '../components/ui/Menu';
import { Button } from '../components/ui/Button';
import { EmptyState, PageLoader, useConfirm } from '../components/ui/misc';
import { useToast } from '../components/ui/Toast';
import { SkyArt } from '../components/SkyArt';

export default function BoxDetailPage() {
  const { id } = useParams();
  const { data, isLoading, error } = useBox(id);
  if (isLoading) return <PageLoader />;
  if (error || !data) {
    const missing = error instanceof ApiError && error.status === 404;
    return (
      <div className="page">
        <EmptyState
          icon={<EyeOff size={22} />}
          title={missing ? 'Box not found' : 'Couldn’t load this box'}
          action={
            <Link to="/app/boxes" className="btn">
              Back to boxes
            </Link>
          }
        >
          {missing ? 'It may have been deleted.' : errorMessage(error)}
        </EmptyState>
      </div>
    );
  }
  return <BoxView detail={data} />;
}

const newLineId = () => `l${Math.random().toString(36).slice(2, 12)}`;

function BoxView({ detail }: { detail: Detail }) {
  const { box, items } = detail;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const invalidate = useInvalidate();
  const toast = useToast();
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState(false);
  const [packing, setPacking] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [moving, setMoving] = useState<Item | null>(null);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const shownItems = useMemo(
    () => (q ? items.filter((i) => [i.title, i.brand, i.category, i.tags.join(' ')].some((s) => s.toLowerCase().includes(q))) : items),
    [items, q],
  );
  const shownLines = q ? box.lines.filter((l) => l.text.toLowerCase().includes(q)) : box.lines;
  const total = items.length + box.lines.length;

  const openItemId = params.get('item');
  const openItem = openItemId ? (items.find((i) => i.id === openItemId) ?? null) : null;
  const setOpenItem = (itemId: string | null) => {
    const next = new URLSearchParams(params);
    if (itemId) next.set('item', itemId);
    else next.delete('item');
    setParams(next, { replace: !itemId });
  };

  const saveLines = async (lines: BoxLine[]) => {
    qc.setQueryData<Detail>(keys.box(box.id), (prev) => (prev ? { ...prev, box: { ...prev.box, lines } } : prev));
    try {
      await patch(`/api/boxes/${box.id}`, { lines });
      void qc.invalidateQueries({ queryKey: keys.boxes });
    } catch (err) {
      toast.error(errorMessage(err));
      void qc.invalidateQueries({ queryKey: keys.box(box.id) });
    }
  };

  const takeOut = async (item: Item) => {
    try {
      await post('/api/boxes/pack', { itemIds: [item.id], boxId: null });
      invalidate([]);
      toast.success(`Took “${item.title}” out of the box`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const remove = async () => {
    const ok = await confirm({
      title: `Delete “${box.name}”?`,
      message: 'Everything in it stays in your Saved Items and collections, just not in a box. Its label stops working.',
      confirmLabel: 'Delete box',
      danger: true,
    });
    if (!ok) return;
    try {
      await del(`/api/boxes/${box.id}`);
      invalidate([]);
      toast.success('Box deleted');
      navigate('/app/boxes', { replace: true });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const facts = [BOX_MATERIAL_LABELS[box.material], box.size ? BOX_SIZE_LABELS[box.size] : null].filter(Boolean).join(' · ');

  return (
    <div className="page">
      <Link to="/app/boxes" className="section-link" style={{ marginLeft: 0, marginBottom: 'var(--s-3)' }}>
        <ArrowLeft size={14} /> Boxes
      </Link>

      <header
        className={['wl-hero', 'box-hero', isDarkCover(box.coverArt) && 'wl-hero-dark'].filter(Boolean).join(' ')}
        style={{ ['--box-color' as string]: box.color }}
      >
        <div className="wl-hero-bg" aria-hidden>
          <CoverArt art={box.coverArt} showIcon={false} />
        </div>
        <span className="box-stripe" aria-hidden />
        <div className="wl-hero-body">
          <CoverAvatar className="wl-hero-avatar" icon={box.coverArt.icon} frame={box.coverArt.frame} />
          <div className="wl-hero-main">
            <div className="row-wrap">
              <BoxNumberBadge box={box} outline />
              <span className="badge badge-outline">{facts}</span>
              {box.fragile && <FragileBadge outline />}
              {box.access === 'owner' && <OwnerOnlyBadge outline />}
            </div>
            <h1 className="wl-hero-title display">{box.name}</h1>
            <div className="row-wrap text-sm muted" style={{ gap: 'var(--s-4)' }}>
              {box.location && (
                <span className="row" style={{ gap: 6 }}>
                  <MapPin size={15} aria-hidden /> {box.location}
                </span>
              )}
              {box.room && (
                <span className="row" style={{ gap: 6 }}>
                  <Truck size={15} aria-hidden /> Goes to {box.room}
                </span>
              )}
              <span>{thingCount(total)}</span>
              <span>Updated {relativeTime(box.updatedAt)}</span>
              {box.lastScannedAt && (
                <span className="row" style={{ gap: 6 }}>
                  <ScanLine size={15} aria-hidden /> Scanned {relativeTime(box.lastScannedAt)}
                </span>
              )}
            </div>
            <div className="wl-hero-actions">
              <Button variant="primary" icon={<PackagePlus size={17} />} onClick={() => setPacking(true)}>
                Pack items
              </Button>
              <Link to={`/app/boxes/labels?ids=${box.id}`} className="btn">
                <Printer size={16} aria-hidden /> Print label
              </Link>
              <Button icon={<QrIcon size={16} />} onClick={() => setShowCode(true)}>
                QR code
              </Button>
              <Menu label="More box actions" icon={<MoreHorizontal size={18} />} buttonClassName="btn btn-icon">
                <MenuItem icon={<Pencil size={16} />} onSelect={() => setEditing(true)}>
                  Edit details
                </MenuItem>
                <MenuItem icon={<Download size={16} />} onSelect={() => window.open(`/og/box/${box.id}.png`, '_blank', 'noopener')}>
                  Label as an image
                </MenuItem>
                <MenuSeparator />
                <MenuItem icon={<Trash2 size={16} />} danger onSelect={remove}>
                  Delete box
                </MenuItem>
              </Menu>
            </div>
          </div>
        </div>
      </header>

      {box.notes && (
        <div className="notice">
          <NotebookPen size={18} aria-hidden />
          <div style={{ flex: 1, whiteSpace: 'pre-line' }}>
            {box.notes}
            <span className="muted text-xs" style={{ display: 'block', marginTop: 4 }}>
              Only you see these notes.
            </span>
          </div>
        </div>
      )}

      {total === 0 ? (
        <EmptyState
          art={<SkyArt scene="boxes" />}
          title="This box is empty"
          action={
            <Button variant="primary" icon={<PackagePlus size={16} />} onClick={() => setPacking(true)}>
              Pack items
            </Button>
          }
        >
          Pack things from your collections, or jot down other things below, like “3 winter blankets”.
        </EmptyState>
      ) : (
        total > 6 && (
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
        )
      )}

      {items.length > 0 && (
        <section className="section" aria-labelledby="box-items-title">
          <h2 id="box-items-title" className="section-label">
            Items <span className="faint">{items.length}</span>
          </h2>
          {shownItems.length === 0 ? (
            <p className="muted text-sm">No items match.</p>
          ) : (
            <div className="grid-items">
              {shownItems.map((item) => (
                <div key={item.id} style={{ minWidth: 0 }}>
                  <ItemCard
                    item={item}
                    owned={item.owned}
                    onOpen={() => setOpenItem(item.id)}
                    menu={
                      <Menu label={`Actions for ${item.title}`} icon={<MoreHorizontal size={18} />} buttonClassName="btn btn-icon btn-sm">
                        <MenuItem icon={<Pencil size={16} />} onSelect={() => setEditingItem(item)}>
                          Edit item
                        </MenuItem>
                        <MenuItem icon={<ArrowLeft size={16} style={{ transform: 'scaleX(-1)' }} />} onSelect={() => setMoving(item)}>
                          Move to another box
                        </MenuItem>
                        <MenuSeparator />
                        <MenuItem icon={<PackageOpen size={16} />} onSelect={() => takeOut(item)}>
                          Take out of box
                        </MenuItem>
                      </Menu>
                    }
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <BoxLines lines={box.lines} shown={shownLines} filtered={Boolean(q)} onChange={saveLines} />
      <div style={{ height: 'var(--s-12)' }} />

      <ItemDetailModal
        item={openItem}
        onClose={() => setOpenItem(null)}
        footer={
          openItem ? (
            <>
              <Button
                icon={<ArrowLeft size={16} style={{ transform: 'scaleX(-1)' }} />}
                onClick={() => {
                  setMoving(openItem);
                  setOpenItem(null);
                }}
              >
                Move
              </Button>
              <Button
                variant="primary"
                icon={<Pencil size={16} />}
                onClick={() => {
                  setEditingItem(openItem);
                  setOpenItem(null);
                }}
              >
                Edit item
              </Button>
            </>
          ) : undefined
        }
      />
      <EditItemModal item={editingItem} onClose={() => setEditingItem(null)} isOwner inCollection={Boolean(editingItem?.owned)} />
      <PutInBoxDialog
        itemIds={moving ? [moving.id] : []}
        currentBoxId={box.id}
        title={moving?.title ?? ''}
        open={Boolean(moving)}
        onClose={() => setMoving(null)}
      />
      <PackItemsDialog box={box} open={packing} onClose={() => setPacking(false)} />
      <BoxCodeDialog box={box} open={showCode} onClose={() => setShowCode(false)} />
      <BoxFormModal open={editing} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} box={box} />
    </div>
  );
}

/** Things in the box that aren't worth a full item: a quantity and a few words each, saved as you go. */
function BoxLines({
  lines,
  shown,
  filtered,
  onChange,
}: {
  lines: BoxLine[];
  shown: BoxLine[];
  filtered: boolean;
  onChange: (lines: BoxLine[]) => void;
}) {
  const [text, setText] = useState('');
  const [quantity, setQuantity] = useState('1');
  const full = lines.length >= MAX_BOX_LINES;

  const update = (id: string, patchLine: Partial<BoxLine>) => onChange(lines.map((l) => (l.id === id ? { ...l, ...patchLine } : l)));
  const add = (e: FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || full) return;
    const n = Math.min(9999, Math.max(1, Math.round(Number(quantity)) || 1));
    onChange([...lines, { id: newLineId(), text: t.slice(0, 120), quantity: n }]);
    setText('');
    setQuantity('1');
  };

  return (
    <section className="section" aria-labelledby="box-lines-title">
      <h2 id="box-lines-title" className="section-label">
        Other things {lines.length > 0 && <span className="faint">{lines.length}</span>}
      </h2>
      {shown.length > 0 && (
        <ul className="box-lines">
          {shown.map((line) => (
            <li key={line.id} className="box-line">
              <div className="box-line-qty" role="group" aria-label={`How many ${line.text}`}>
                <button
                  type="button"
                  className="btn btn-ghost btn-icon btn-sm"
                  aria-label="One fewer"
                  disabled={line.quantity <= 1}
                  onClick={() => update(line.id, { quantity: line.quantity - 1 })}
                >
                  <Minus size={14} />
                </button>
                <span className="box-line-count">{line.quantity}</span>
                <button
                  type="button"
                  className="btn btn-ghost btn-icon btn-sm"
                  aria-label="One more"
                  disabled={line.quantity >= 9999}
                  onClick={() => update(line.id, { quantity: line.quantity + 1 })}
                >
                  <Plus size={14} />
                </button>
              </div>
              <input
                className="input box-line-text"
                defaultValue={line.text}
                maxLength={120}
                aria-label="What it is"
                onBlur={(e) => {
                  const v = e.currentTarget.value.trim();
                  if (!v) e.currentTarget.value = line.text;
                  else if (v !== line.text) update(line.id, { text: v });
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                }}
              />
              <button
                type="button"
                className="btn btn-ghost btn-icon btn-sm"
                aria-label={`Remove ${line.text}`}
                onClick={() => onChange(lines.filter((l) => l.id !== line.id))}
              >
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {filtered && shown.length === 0 && lines.length > 0 && <p className="muted text-sm">No other things match.</p>}
      {!filtered && (
        <form className="box-line-add" onSubmit={add}>
          <input
            className="input box-line-add-qty"
            type="number"
            inputMode="numeric"
            min={1}
            max={9999}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            aria-label="How many"
          />
          <input
            className="input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={full ? `A box can list up to ${MAX_BOX_LINES} other things` : 'Add something, like “winter blankets”'}
            maxLength={120}
            disabled={full}
            aria-label="Something else in the box"
          />
          <Button type="submit" icon={<Plus size={16} />} disabled={!text.trim() || full}>
            Add
          </Button>
        </form>
      )}
    </section>
  );
}
