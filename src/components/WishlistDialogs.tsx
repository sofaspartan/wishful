import { useEffect, useState, type FormEvent } from 'react';
import { Check, Copy, ExternalLink, Gift, Link2, Lock, Mail, MessageCircle, RefreshCw, Share2, Trash2, UserPlus, Users } from 'lucide-react';
import { VISIBILITIES, type Priority, type Visibility, type Wishlist, type WishlistDetail, type WishlistEntry, type WishlistSettings } from '../../shared/types';
import { PRIORITY_LABELS, RESERVATION_DAY_OPTIONS, VISIBILITY_DESCRIPTIONS, VISIBILITY_LABELS } from '../../shared/constants';
import { useInvalidate, useSharedWishlists, useWishlists } from '../lib/queries';
import { del, errorMessage, fieldErrors, patch, post } from '../lib/api';
import { shareUrl } from '../lib/prefs';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Field, FormError, FormNote } from './ui/Field';
import { Avatar, Segmented, SwitchRow, useConfirm } from './ui/misc';
import { useToast } from './ui/Toast';

// ── Share ───────────────────────────────────────────────────────────────────

export function ShareDialog({ open, onClose, wishlist, ownerName }: { open: boolean; onClose: () => void; wishlist: Wishlist; ownerName: string }) {
  const invalidate = useInvalidate();
  const toast = useToast();
  const confirm = useConfirm();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const url = wishlist.shareToken ? shareUrl(wishlist.shareToken) : '';
  const collection = wishlist.kind === 'collection';
  const message = `${ownerName.split(' ')[0]}'s ${collection ? 'collection' : 'wishlist'} “${wishlist.title}” on Wishful`;

  const run = async (key: string, fn: () => Promise<unknown>, success?: string) => {
    setBusy(key);
    try {
      await fn();
      invalidate([wishlist.id]);
      if (success) toast.success(success);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Copy failed — select the link and copy it manually.');
    }
  };

  const setVisibility = (visibility: Visibility) => run('visibility', () => patch(`/api/wishlists/${wishlist.id}`, { visibility }), `Now ${VISIBILITY_LABELS[visibility].toLowerCase()}`);

  const regenerate = async () => {
    const ok = await confirm({
      title: 'Create a new link?',
      message: 'The current link will stop working immediately. Anyone you shared it with will need the new one. Existing reservations are kept.',
      confirmLabel: 'Create new link',
    });
    if (ok) await run('regen', () => post(`/api/wishlists/${wishlist.id}/share/regenerate`), 'New link created');
  };

  const revoke = async () => {
    const ok = await confirm({
      title: 'Turn off sharing link?',
      message: 'Nobody will be able to open this list from the link until you create a new one.',
      confirmLabel: 'Turn off link',
      danger: true,
    });
    if (ok) await run('revoke', () => post(`/api/wishlists/${wishlist.id}/share/revoke`), 'Link turned off');
  };

  const canNativeShare = typeof navigator !== 'undefined' && 'share' in navigator;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={collection ? 'Share collection' : 'Share wishlist'}
      subtitle={
        collection
          ? wishlist.visibility === 'friends'
            ? 'Only your Wishful friends can see this collection.'
            : "Anyone with the link can browse it — no account needed."
          : wishlist.visibility === 'friends'
            ? 'Only your Wishful friends can view and reserve gifts on this list.'
            : "Friends and family don't need an account to view or reserve gifts."
      }
    >
      <div className="stack">
        <Segmented
          label="Visibility"
          full
          value={wishlist.visibility}
          onChange={setVisibility}
          options={VISIBILITIES.map((v) => ({ value: v, label: VISIBILITY_LABELS[v] }))}
        />
        <p className="muted text-sm" style={{ marginTop: -6 }}>
          {VISIBILITY_DESCRIPTIONS[wishlist.visibility]}
        </p>

        {wishlist.visibility === 'friends' && wishlist.shareToken && (
          <FormNote icon={<Users size={16} aria-hidden />}>
            Friends open this list from your profile in the Friends tab, or from this link once they’re signed in. Anyone else who gets the link will be asked to sign in and be your friend.
          </FormNote>
        )}

        {wishlist.visibility === 'private' ? (
          <FormNote icon={<Lock size={16} aria-hidden />}>Private lists can't be opened from a link. Choose Friends, Unlisted or Public to share it.</FormNote>
        ) : !wishlist.shareToken ? (
          <div className="stack-sm">
            <FormNote>The sharing link is turned off.</FormNote>
            <Button variant="primary" icon={<Link2 size={16} />} loading={busy === 'regen'} onClick={() => run('regen', () => post(`/api/wishlists/${wishlist.id}/share/regenerate`), 'Link created')}>
              Create a link
            </Button>
          </div>
        ) : (
          <>
            <div className="row">
              <input className="input" readOnly value={url} aria-label="Share link" onFocus={(e) => e.target.select()} />
              <Button variant="primary" onClick={copy} icon={copied ? <Check size={16} /> : <Copy size={16} />} style={{ flexShrink: 0 }}>
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <div className="row-wrap">
              {canNativeShare && (
                <Button icon={<Share2 size={16} />} onClick={() => navigator.share({ title: wishlist.title, text: message, url }).catch(() => undefined)}>
                  Share…
                </Button>
              )}
              <a className="btn" href={`mailto:?subject=${encodeURIComponent(message)}&body=${encodeURIComponent(`${message}\n\n${url}`)}`}>
                <Mail size={16} aria-hidden /> Email
              </a>
              <a className="btn" href={`sms:?&body=${encodeURIComponent(`${message} ${url}`)}`}>
                <MessageCircle size={16} aria-hidden /> Messages
              </a>
              <a className="btn" href={`https://wa.me/?text=${encodeURIComponent(`${message} ${url}`)}`} target="_blank" rel="noopener noreferrer">
                WhatsApp
              </a>
              <a className="btn btn-ghost" href={url} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={16} aria-hidden /> Preview
              </a>
            </div>
            {collection ? (
              <FormNote icon={<Gift size={16} aria-hidden />}>Visitors can browse what you have. What you paid is never shown.</FormNote>
            ) : (
              <FormNote icon={<Gift size={16} aria-hidden />}>
                {wishlist.surpriseMode
                  ? 'Surprise Mode is on — you won’t see who reserved or bought what.'
                  : 'Surprise Mode is off — you’ll see who reserved items.'}{' '}
                Change this in Gift settings.
              </FormNote>
            )}
            <div className="row-wrap" style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <Button size="sm" variant="ghost" icon={<RefreshCw size={14} />} loading={busy === 'regen'} onClick={regenerate}>
                Create new link
              </Button>
              <Button size="sm" variant="danger-ghost" icon={<Trash2 size={14} />} loading={busy === 'revoke'} onClick={revoke}>
                Turn off link
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

// ── Gift & privacy settings ─────────────────────────────────────────────────

export function GiftSettingsDialog({ open, onClose, wishlist }: { open: boolean; onClose: () => void; wishlist: Wishlist }) {
  const invalidate = useInvalidate();
  const toast = useToast();
  const [surpriseMode, setSurpriseMode] = useState(wishlist.surpriseMode);
  const [settings, setSettings] = useState<WishlistSettings>(wishlist.settings);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setSurpriseMode(wishlist.surpriseMode);
      setSettings(wishlist.settings);
    }
  }, [open, wishlist]);

  const set = <K extends keyof WishlistSettings>(k: K, v: WishlistSettings[K]) => setSettings((s) => ({ ...s, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      await patch(`/api/wishlists/${wishlist.id}`, { surpriseMode, settings });
      invalidate([wishlist.id]);
      toast.success('Gift settings saved');
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
      title="Gift settings"
      subtitle="Control what visitors can do on your shared list."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} loading={saving}>
            Save
          </Button>
        </>
      }
    >
      <div className="stack">
        <div className="card card-pad" style={{ padding: '4px 16px', background: surpriseMode ? 'var(--accent-soft)' : undefined, borderColor: surpriseMode ? 'transparent' : undefined }}>
          <SwitchRow
            title="Surprise Mode"
            description="Hide who reserved or bought what — from you and your editors. Gifts reserved while it's on stay hidden even if you turn it off later."
            checked={surpriseMode}
            onChange={setSurpriseMode}
          />
        </div>
        <div>
          <SwitchRow title="Visitors can reserve items" description="People with the link can claim a gift so nobody doubles up." checked={settings.allowClaims} onChange={(v) => set('allowClaims', v)} />
          <SwitchRow title="Visitors can mark items purchased" checked={settings.allowMarkPurchased} onChange={(v) => set('allowMarkPurchased', v)} disabled={!settings.allowClaims} />
          <SwitchRow title="Show reserved items" description="Turn off to hide reserved items from other visitors." checked={settings.showReserved} onChange={(v) => set('showReserved', v)} />
          <SwitchRow title="Show purchased items" description="Turn off to hide purchased items from other visitors." checked={settings.showPurchased} onChange={(v) => set('showPurchased', v)} />
          <SwitchRow title="Allow messages" description="Visitors can leave a short note with a reservation or group gift." checked={settings.allowMessages} onChange={(v) => set('allowMessages', v)} />
          <SwitchRow title="Show priorities" description="Let visitors see what you want most." checked={settings.showPriorities} onChange={(v) => set('showPriorities', v)} />
        </div>
        <Field label="Reservations expire after" hint="Unpurchased reservations lapse automatically so items don't stay blocked forever.">
          <select className="select" value={settings.reservationDays} onChange={(e) => set('reservationDays', Number(e.target.value))}>
            {RESERVATION_DAY_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d === 0 ? 'Never' : `${d} days`}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </Modal>
  );
}

// ── Collaborators ───────────────────────────────────────────────────────────

export function CollaboratorsDialog({ open, onClose, detail }: { open: boolean; onClose: () => void; detail: WishlistDetail }) {
  const invalidate = useInvalidate();
  const toast = useToast();
  const confirm = useConfirm();
  const [identifier, setIdentifier] = useState('');
  const [role, setRole] = useState<'viewer' | 'editor'>('editor');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const w = detail.wishlist;
  const isOwner = detail.role === 'owner';

  const invite = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await post(`/api/wishlists/${w.id}/collaborators`, { identifier, role });
      invalidate([w.id]);
      toast.success(identifier.includes('@') ? 'Invitation sent' : 'Collaborator added');
      setIdentifier('');
    } catch (err) {
      setError(fieldErrors(err).identifier ?? errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const changeRole = async (userId: string, next: 'viewer' | 'editor') => {
    try {
      await patch(`/api/wishlists/${w.id}/collaborators/${userId}`, { role: next });
      invalidate([w.id]);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const remove = async (userId: string, name: string) => {
    if (!(await confirm({ title: `Remove ${name}?`, message: 'They will lose access to this list.', confirmLabel: 'Remove', danger: true }))) return;
    try {
      await del(`/api/wishlists/${w.id}/collaborators/${userId}`);
      invalidate([w.id]);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const cancelInvite = async (email: string) => {
    try {
      await del(`/api/wishlists/${w.id}/invites/${encodeURIComponent(email)}`);
      invalidate([w.id]);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Collaborators" subtitle="Editors can add, edit and organise items. Viewers can only look.">
      <div className="stack">
        {isOwner && (
          <form className="stack-sm" onSubmit={invite}>
            <div className="row" style={{ alignItems: 'stretch' }}>
              <input
                className="input"
                placeholder="Email or username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                aria-label="Email or username"
                aria-invalid={error ? true : undefined}
                autoCapitalize="none"
                data-autofocus
              />
              <select className="select" style={{ width: 'auto' }} value={role} onChange={(e) => setRole(e.target.value as 'viewer' | 'editor')} aria-label="Role">
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            {error && <span className="field-error">{error}</span>}
            <Button type="submit" variant="primary" icon={<UserPlus size={16} />} loading={busy} disabled={identifier.trim().length < 3} style={{ alignSelf: 'flex-start' }}>
              Invite
            </Button>
            <span className="field-hint">Collaborators need a free account. If they don't have one yet, we'll add them as soon as they sign up with that email.</span>
          </form>
        )}

        <div className="list-items">
          <div className="item-row">
            <Avatar name={detail.owner.displayName} src={detail.owner.avatarUrl} size={36} />
            <div className="item-row-main">
              <strong className="truncate">{detail.owner.displayName}</strong>
              <span className="muted text-xs">@{detail.owner.username}</span>
            </div>
            <span className="badge">Owner</span>
          </div>
          {w.collaborators.map((c) => (
            <div className="item-row" key={c.userId}>
              <Avatar name={c.user?.displayName ?? '?'} src={c.user?.avatarUrl} size={36} />
              <div className="item-row-main">
                <strong className="truncate">{c.user?.displayName}</strong>
                <span className="muted text-xs">@{c.user?.username}</span>
              </div>
              {isOwner ? (
                <div className="item-row-side">
                  <select className="select" style={{ width: 'auto', minHeight: 32, height: 32, paddingTop: 0, paddingBottom: 0, fontSize: 13 }} value={c.role} onChange={(e) => changeRole(c.userId, e.target.value as 'viewer' | 'editor')} aria-label={`Role for ${c.user?.displayName}`}>
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <Button size="sm" variant="ghost" iconOnly aria-label={`Remove ${c.user?.displayName}`} icon={<Trash2 size={15} />} onClick={() => remove(c.userId, c.user?.displayName ?? 'collaborator')} />
                </div>
              ) : (
                <span className="badge">{c.role === 'editor' ? 'Editor' : 'Viewer'}</span>
              )}
            </div>
          ))}
          {w.pendingInvites.map((p) => (
            <div className="item-row" key={p.email}>
              <Avatar name={p.email} size={36} />
              <div className="item-row-main">
                <strong className="truncate">{p.email}</strong>
                <span className="muted text-xs">Invited as {p.role} · waiting for sign-up</span>
              </div>
              <Button size="sm" variant="ghost" onClick={() => cancelInvite(p.email)}>
                Cancel
              </Button>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

// ── Entry (per-list item) settings ──────────────────────────────────────────

export function EntrySettingsDialog({ wishlistId, entry, itemTitle, onClose }: { wishlistId: string; entry: WishlistEntry | null; itemTitle: string; onClose: () => void }) {
  const invalidate = useInvalidate();
  const toast = useToast();
  const [priority, setPriority] = useState<Priority | 'none'>('none');
  const [customNotes, setCustomNotes] = useState('');
  const [groupGift, setGroupGift] = useState(false);
  const [groupGiftNote, setGroupGiftNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!entry) return;
    setPriority(entry.priority ?? 'none');
    setCustomNotes(entry.customNotes);
    setGroupGift(entry.groupGift);
    setGroupGiftNote(entry.groupGiftNote);
    setError(null);
  }, [entry]);

  if (!entry) return null;

  const save = async () => {
    setSaving(true);
    try {
      await patch(`/api/wishlists/${wishlistId}/entries/${entry.id}`, { priority: priority === 'none' ? null : priority, customNotes, groupGift, groupGiftNote });
      invalidate([wishlistId]);
      toast.success('Saved');
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="On this list"
      subtitle={`Settings for “${itemTitle}” on this wishlist only.`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} loading={saving}>
            Save
          </Button>
        </>
      }
    >
      <div className="stack">
        <FormError message={error} />
        <div className="field">
          <span className="field-label">Priority</span>
          <Segmented
            label="Priority"
            value={priority}
            onChange={setPriority}
            options={[
              { value: 'none', label: 'None' },
              { value: 'must_have', label: PRIORITY_LABELS.must_have },
              { value: 'really_want', label: PRIORITY_LABELS.really_want },
              { value: 'interested', label: PRIORITY_LABELS.interested },
            ]}
          />
        </div>
        <Field label="Note for gift-givers" optional hint="Shown on the shared page, e.g. “Size M, any colour but yellow”.">
          <textarea className="textarea" rows={2} maxLength={500} value={customNotes} onChange={(e) => setCustomNotes(e.target.value)} />
        </Field>
        <div className="card" style={{ padding: '4px 16px' }}>
          <SwitchRow
            title="Group gift"
            description="Several people can chip in together. Visitors can join and pick a coordinator instead of reserving it alone."
            checked={groupGift}
            onChange={setGroupGift}
          />
        </div>
        {groupGift && (
          <Field label="Message for the group" optional>
            <textarea className="textarea" rows={2} maxLength={500} value={groupGiftNote} onChange={(e) => setGroupGiftNote(e.target.value)} placeholder="This one's pricey — happy for people to team up!" />
          </Field>
        )}
      </div>
    </Modal>
  );
}

// ── Move entry ──────────────────────────────────────────────────────────────

export function MoveEntryDialog({ detail, entry, onClose }: { detail: WishlistDetail; entry: WishlistEntry | null; onClose: () => void }) {
  const { data: own = [] } = useWishlists(Boolean(entry));
  const { data: shared = [] } = useSharedWishlists(Boolean(entry) && detail.role !== 'owner');
  const invalidate = useInvalidate();
  const toast = useToast();
  const [target, setTarget] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => setTarget(null), [entry]);
  if (!entry) return null;

  const ownerId = detail.wishlist.ownerId;
  const options = (detail.role === 'owner' ? own : shared.filter((l) => l.role === 'editor' && l.ownerId === ownerId)).filter(
    (l) => l.id !== detail.wishlist.id && !l.archivedAt,
  );

  const move = async () => {
    if (!target) return;
    setSaving(true);
    try {
      await post(`/api/wishlists/${detail.wishlist.id}/entries/${entry.id}/move`, { toWishlistId: target });
      invalidate([detail.wishlist.id, target]);
      toast.success(`Moved to “${options.find((o) => o.id === target)?.title}”`);
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Move to another list"
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={move} loading={saving} disabled={!target}>
            Move
          </Button>
        </>
      }
    >
      {options.length ? (
        <div className="check-list" role="radiogroup" aria-label="Destination">
          {options.map((l) => (
            <label key={l.id} className="check">
              <input type="radio" name="move-target" checked={target === l.id} onChange={() => setTarget(l.id)} />
              <span className="swatch-dot" style={{ background: l.accentColor }} aria-hidden />
              <span className="truncate" style={{ flex: 1 }}>
                {l.title}
              </span>
            </label>
          ))}
        </div>
      ) : (
        <p className="muted">There are no other lists to move this item to.</p>
      )}
    </Modal>
  );
}
