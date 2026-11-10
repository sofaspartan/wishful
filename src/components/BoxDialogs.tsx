import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Download, ExternalLink, PackageOpen, Plus, Printer, RefreshCw, Search } from 'lucide-react';
import { formatBoxCode, type Box, type BoxDetail, type Item } from '../../shared/types';
import { useBoxes, useInvalidate, useItems, useWishlists } from '../lib/queries';
import { errorMessage, post } from '../lib/api';
import { boxUrl } from '../lib/prefs';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { useConfirm } from './ui/misc';
import { useToast } from './ui/Toast';
import { ItemImage } from './ItemVisuals';
import { CoverArt } from './CoverArt';
import { QrCode, boxDisplayName, boxNumberLabel, thingCount } from './BoxVisuals';

const matches = (item: Item, q: string) =>
  [item.title, item.brand, item.retailer, item.category, item.tags.join(' ')].some((s) => s.toLowerCase().includes(q));

/** Pick things from your Saved Items (or one collection) to pack into a box. */
export function PackItemsDialog({ box, open, onClose }: { box: Box; open: boolean; onClose: () => void }) {
  const { data: itemData } = useItems(open);
  const { data: lists } = useWishlists(open);
  const { data: boxes } = useBoxes(open);
  const invalidate = useInvalidate();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setSelected(new Set());
  }, [open]);

  const boxById = useMemo(() => new Map((boxes ?? []).map((b) => [b.id, b])), [boxes]);
  const collections = (lists ?? []).filter((l) => l.kind === 'collection' && !l.archivedAt);
  const q = query.trim().toLowerCase();
  const candidates = (itemData?.items ?? []).filter((i) => {
    if (i.boxId === box.id) return false;
    if (scope === 'unboxed' && i.boxId) return false;
    if (scope === 'owned' && !i.owned) return false;
    if (scope.startsWith('list:') && !i.wishlistIds.includes(scope.slice(5))) return false;
    return !q || matches(i, q);
  });

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const pack = async () => {
    setSaving(true);
    try {
      await post('/api/boxes/pack', { itemIds: [...selected], boxId: box.id });
      invalidate([]);
      toast.success(`Packed ${thingCount(selected.size)} into ${boxDisplayName(box)}`);
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Pack ${boxNumberLabel(box) ?? 'this box'}`}
      subtitle="Choose what’s going in. Anything already in another box moves here."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={pack} loading={saving} disabled={!selected.size}>
            {selected.size ? `Pack ${thingCount(selected.size)}` : 'Pack'}
          </Button>
        </>
      }
    >
      <div className="stack">
        <div className="row-wrap pack-filters">
          <div className="input-group" style={{ flex: '1 1 220px' }}>
            <Search size={16} aria-hidden />
            <input
              className="input"
              type="search"
              placeholder="Search your things"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search your things"
            />
          </div>
          <select className="select" value={scope} onChange={(e) => setScope(e.target.value)} aria-label="Show">
            <option value="all">All saved items</option>
            <option value="owned">Things I have</option>
            <option value="unboxed">Not in a box yet</option>
            {collections.map((c) => (
              <option key={c.id} value={`list:${c.id}`}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
        {!itemData ? (
          <p className="muted text-sm">Loading your things…</p>
        ) : candidates.length === 0 ? (
          <p className="muted text-sm">
            {q
              ? `Nothing matches “${query.trim()}”.`
              : 'Nothing to pack here. Add items to your collections first, or list them as other things in the box.'}
          </p>
        ) : (
          <div className="pack-list" role="group" aria-label="Your things">
            {candidates.map((item) => {
              const inBox = item.boxId ? boxById.get(item.boxId) : null;
              return (
                <label key={item.id} className={`pack-row${selected.has(item.id) ? ' is-selected' : ''}`}>
                  <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} />
                  <span className="pack-thumb">
                    <ItemImage src={item.imageUrl} type={item.type} iconSize={18} />
                  </span>
                  <span className="pack-text">
                    <span className="truncate pack-title">{item.title}</span>
                    <span className="truncate muted text-xs">
                      {inBox ? `In ${boxDisplayName(inBox)}` : item.brand || item.retailer || 'Not in a box'}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}

/** Choose the box an item (or several) goes in, make a new one, or take it out of its box. */
export function PutInBoxDialog({
  itemIds,
  currentBoxId,
  title,
  open,
  onClose,
}: {
  itemIds: string[];
  currentBoxId?: string | null;
  title: string;
  open: boolean;
  onClose: () => void;
}) {
  const { data: boxes } = useBoxes(open);
  const invalidate = useInvalidate();
  const toast = useToast();
  const [choice, setChoice] = useState<string>('');
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setChoice('');
    setNewName('');
  }, [open]);

  const sorted = useMemo(
    () => [...(boxes ?? [])].sort((a, b) => (a.number ?? Infinity) - (b.number ?? Infinity) || a.name.localeCompare(b.name)),
    [boxes],
  );
  const ready = choice === 'new' ? Boolean(newName.trim()) : Boolean(choice);

  const send = async (boxId: string | null, label: string) => {
    setSaving(true);
    try {
      await post('/api/boxes/pack', { itemIds, boxId });
      invalidate([]);
      toast.success(label);
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    if (choice === 'new') {
      setSaving(true);
      try {
        const made = await post<BoxDetail>('/api/boxes', { name: newName.trim() });
        await send(made.box.id, `Packed into ${boxDisplayName(made.box)}`);
      } catch (err) {
        toast.error(errorMessage(err));
        setSaving(false);
      }
      return;
    }
    const target = sorted.find((b) => b.id === choice);
    await send(choice, `Packed into ${target ? boxDisplayName(target) : 'the box'}`);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Put in a box"
      subtitle={title}
      footer={
        <>
          {currentBoxId && (
            <Button
              variant="ghost"
              icon={<PackageOpen size={16} />}
              onClick={() => send(null, 'Taken out of its box')}
              disabled={saving}
              style={{ marginRight: 'auto' }}
            >
              Take out
            </Button>
          )}
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="put-in-box" loading={saving} disabled={!ready}>
            Pack
          </Button>
        </>
      }
    >
      <form id="put-in-box" className="stack" onSubmit={submit}>
        <div className="box-choices" role="radiogroup" aria-label="Box">
          {sorted.map((b) => (
            <label key={b.id} className={`box-choice${choice === b.id ? ' is-selected' : ''}`}>
              <input type="radio" name="box" checked={choice === b.id} onChange={() => setChoice(b.id)} disabled={b.id === currentBoxId} />
              <span className="box-choice-art" style={{ ['--box-color' as string]: b.color }}>
                <CoverArt art={b.coverArt} size="sm" />
              </span>
              <span className="pack-text">
                <span className="truncate pack-title">{boxDisplayName(b)}</span>
                <span className="truncate muted text-xs">
                  {b.id === currentBoxId ? 'It’s in here now' : [b.location, thingCount(b.itemCount + b.lineCount)].filter(Boolean).join(' · ')}
                </span>
              </span>
            </label>
          ))}
          <label className={`box-choice${choice === 'new' ? ' is-selected' : ''}`}>
            <input type="radio" name="box" checked={choice === 'new'} onChange={() => setChoice('new')} />
            <span className="box-choice-art box-choice-new">
              <Plus size={18} aria-hidden />
            </span>
            <span className="pack-text">
              <span className="pack-title">A new box</span>
              {choice === 'new' && (
                <input
                  className="input input-sm"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Name it, like “Winter clothes”"
                  maxLength={80}
                  autoFocus
                  aria-label="New box name"
                />
              )}
            </span>
          </label>
        </div>
      </form>
    </Modal>
  );
}

/** The box's QR code and link, with printing, a PNG download and a way to replace the code. */
export function BoxCodeDialog({ box, open, onClose }: { box: Box; open: boolean; onClose: () => void }) {
  const invalidate = useInvalidate();
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const url = boxUrl(box.code);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    } catch {
      toast.error('Couldn’t copy. Select the link and copy it instead.');
    }
  };

  const regenerate = async () => {
    const ok = await confirm({
      title: 'Make a new code?',
      message: 'The label on the box now will stop working. You’ll need to print and stick on a new one.',
      confirmLabel: 'Make a new code',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await post(`/api/boxes/${box.id}/code`);
      invalidate([]);
      toast.success('New code made. Print a fresh label for the box.');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="QR code & link"
      subtitle={
        box.access === 'owner'
          ? 'Only you can open it, after signing in.'
          : `Anyone who scans it sees what’s inside, without signing in.${box.showPrices ? '' : ' Prices stay hidden.'}`
      }
      footer={
        <>
          <Button variant="ghost" icon={<RefreshCw size={16} />} onClick={regenerate} loading={busy} style={{ marginRight: 'auto' }}>
            New code
          </Button>
          <Button onClick={onClose}>Done</Button>
        </>
      }
    >
      <div className="stack box-code">
        <div className="box-code-qr">
          <QrCode value={url} label={`QR code for ${boxDisplayName(box)}`} />
        </div>
        <div className="box-code-text">
          <span className="eyebrow">Box code</span>
          <strong className="box-code-value">{formatBoxCode(box.code)}</strong>
          <span className="muted text-xs">Type it at {window.location.host}/b if the label gets damaged.</span>
        </div>
        <div className="input-group">
          <input className="input" value={url} readOnly aria-label="Box link" onFocus={(e) => e.currentTarget.select()} />
          <Button size="sm" icon={<Copy size={14} />} onClick={copy}>
            Copy
          </Button>
        </div>
        <div className="row-wrap">
          <Link to={`/app/boxes/labels?ids=${box.id}`} className="btn">
            <Printer size={16} aria-hidden /> Print label
          </Link>
          <a className="btn" href={`/og/box/${box.id}.png`} download={`${boxDisplayName(box)}.png`}>
            <Download size={16} aria-hidden /> Download PNG
          </a>
          <a className="btn btn-ghost" href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={16} aria-hidden /> Open
          </a>
        </div>
      </div>
    </Modal>
  );
}
