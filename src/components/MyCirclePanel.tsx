import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Camera, Link2, PawPrint, Pencil, Plus, Search, Trash2, UserRound } from 'lucide-react';
import type { CircleKind, CirclePerson, FriendSummary } from '../../shared/types';
import { LIMITS } from '../../shared/constants';
import { keys } from '../lib/queries';
import { del, errorMessage, fieldErrors, patch, post } from '../lib/api';
import { uploadImage } from '../lib/images';
import { useLocalPref } from '../lib/prefs';
import { Button } from './ui/Button';
import { Field } from './ui/Field';
import { Modal } from './ui/Modal';
import { Avatar, EmptyState, PageLoader, Segmented } from './ui/misc';
import { useToast } from './ui/Toast';
import { Cloud } from './Cloud';
import { SkyArt } from './SkyArt';
import { CARD_LIST_VIEWS, ViewToggle, type CardListView } from './ViewToggle';

type Filter = 'all' | 'people' | 'pets';

interface Props {
  people: CirclePerson[] | undefined;
  loading: boolean;
  friends: FriendSummary[];
  /** Increment from the page sky “Add” button to open the new-person editor. */
  openAddTick?: number;
}

export function MyCirclePanel({ people, loading, friends, openAddTick = 0 }: Props) {
  const qc = useQueryClient();
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [view, setView] = useLocalPref<CardListView>('friends.circleView', 'grid', CARD_LIST_VIEWS);
  const [editor, setEditor] = useState<CirclePerson | 'new' | null>(null);
  const [linking, setLinking] = useState<CirclePerson | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = () => void qc.invalidateQueries({ queryKey: keys.circle });

  useEffect(() => {
    if (openAddTick > 0) setEditor('new');
  }, [openAddTick]);

  const filtered = useMemo(() => {
    const list = people ?? [];
    const byKind = filter === 'people' ? list.filter((p) => p.kind === 'person') : filter === 'pets' ? list.filter((p) => p.kind === 'pet') : list;
    const q = query.trim().toLowerCase().replace(/^@/, '');
    if (!q) return byKind;
    return byKind.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.username?.toLowerCase().includes(q) ?? false) ||
        (p.note?.toLowerCase().includes(q) ?? false),
    );
  }, [people, filter, query]);

  const remove = async (person: CirclePerson) => {
    if (!window.confirm(`Remove ${person.name} from My Circle? Lists that mention them keep the name.`)) return;
    setBusy(`del:${person.id}`);
    try {
      await del(`/api/circle/${person.id}`);
      refresh();
      toast.success(`Removed ${person.name}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  if (loading || !people) return <PageLoader />;

  const emptyTitle = filter === 'pets' ? 'No pets yet' : filter === 'people' ? 'No people yet' : 'My Circle is empty';
  const emptyCopy =
    filter === 'pets'
      ? 'Add a pet when a wishlist is for them, not a person.'
      : 'Add family, housemates, friends, or pets — then pick them when you make a list.';

  const circleMeta = (person: CirclePerson) =>
    person.userId && person.username ? `@${person.username}` : person.kind === 'pet' ? 'Pet profile' : 'Not on Wishful yet';

  return (
    <section className="section" aria-label="My Circle">
      <div className="toolbar" style={{ marginTop: 0, marginBottom: 'var(--s-4)' }}>
        <div className="input-group" style={{ flex: '1 1 220px', maxWidth: 360 }}>
          <Search size={16} aria-hidden />
          <input
            className="input"
            type="search"
            placeholder="Search My Circle"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search My Circle"
          />
        </div>
        <div className="row" style={{ gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
          <div className="segmented" role="group" aria-label="Filter My Circle">
            <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
              All
            </button>
            <button type="button" aria-pressed={filter === 'people'} onClick={() => setFilter('people')}>
              People
            </button>
            <button type="button" aria-pressed={filter === 'pets'} onClick={() => setFilter('pets')}>
              Pets
            </button>
          </div>
          <ViewToggle value={view} onChange={setView} />
        </div>
      </div>

      {filtered.length === 0 ? (
        people.length === 0 || (filter !== 'all' && !(people ?? []).some((p) => (filter === 'pets' ? p.kind === 'pet' : p.kind === 'person'))) ? (
          <EmptyState
            art={<SkyArt scene={filter === 'pets' ? 'gifts' : 'friends'} />}
            title={emptyTitle}
            action={
              <Button size="sm" variant="primary" icon={<Plus size={15} />} onClick={() => setEditor('new')}>
                Add someone
              </Button>
            }
          >
            {emptyCopy}
          </EmptyState>
        ) : (
          <EmptyState icon={<Search size={22} />} title="No matches">
            Nobody in this filter matches “{query.trim()}”.
          </EmptyState>
        )
      ) : view === 'list' ? (
        <div className="list-items list-items-sky">
          {filtered.map((person) => (
            <div className="item-row" key={person.id}>
              <Avatar name={person.name} src={person.avatarUrl} size={40} />
              <div className="item-row-main">
                <strong className="truncate">
                  {person.name}
                  {person.kind === 'pet' && <span className="people-me-badge">Pet</span>}
                </strong>
                <span className="muted text-xs truncate">
                  {circleMeta(person)}
                  {person.note ? ` · ${person.note}` : ''}
                </span>
              </div>
              <div className="item-row-side">
                {person.kind === 'person' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Link2 size={14} />}
                    onClick={() => setLinking(person)}
                    title={person.userId ? 'Change linked account' : 'Link Wishful account'}
                  >
                    {person.userId ? 'Linked' : 'Link'}
                  </Button>
                )}
                <Button size="sm" variant="ghost" icon={<Pencil size={14} />} onClick={() => setEditor(person)} aria-label={`Edit ${person.name}`} />
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Trash2 size={14} />}
                  loading={busy === `del:${person.id}`}
                  onClick={() => remove(person)}
                  aria-label={`Remove ${person.name}`}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="friend-grid">
          {filtered.map((person) => (
            <article className="friend-card circle-card" key={person.id}>
              <div className="friend-card-sky" aria-hidden>
                <Cloud className="friend-card-cloud friend-card-cloud-1" />
                <Cloud className="friend-card-cloud friend-card-cloud-2" />
              </div>
              <Avatar name={person.name} src={person.avatarUrl} size={64} />
              <div className="friend-card-body">
                <strong className="truncate">
                  {person.name}
                  {person.kind === 'pet' && <span className="people-me-badge">Pet</span>}
                </strong>
                <span className="muted text-xs truncate">{circleMeta(person)}</span>
                {person.note ? <span className="friend-card-since truncate">{person.note}</span> : null}
              </div>
              <div className="circle-card-actions">
                {person.kind === 'person' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Link2 size={14} />}
                    onClick={() => setLinking(person)}
                    title={person.userId ? 'Change linked account' : 'Link Wishful account'}
                  >
                    {person.userId ? 'Linked' : 'Link'}
                  </Button>
                )}
                <Button size="sm" variant="ghost" icon={<Pencil size={14} />} onClick={() => setEditor(person)} aria-label={`Edit ${person.name}`} />
                <Button
                  size="sm"
                  variant="danger-ghost"
                  icon={<Trash2 size={14} />}
                  loading={busy === `del:${person.id}`}
                  onClick={() => void remove(person)}
                  aria-label={`Remove ${person.name}`}
                />
              </div>
            </article>
          ))}
        </div>
      )}

      <CircleEditor
        open={editor !== null}
        person={editor === 'new' || editor === null ? null : editor}
        onClose={() => setEditor(null)}
        onSaved={() => {
          setEditor(null);
          refresh();
        }}
      />

      <CircleLinkModal
        open={linking !== null}
        person={linking}
        friends={friends}
        onClose={() => setLinking(null)}
        onSaved={() => {
          setLinking(null);
          refresh();
          void qc.invalidateQueries({ queryKey: keys.friends });
          void qc.invalidateQueries({ queryKey: keys.wishlists });
          void qc.invalidateQueries({ queryKey: keys.shared });
        }}
      />
    </section>
  );
}

function CircleEditor({
  open,
  person,
  onClose,
  onSaved,
}: {
  open: boolean;
  person: CirclePerson | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [kind, setKind] = useState<CircleKind>('person');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setName(person?.name ?? '');
    setNote(person?.note ?? '');
    setKind(person?.kind ?? 'person');
    setAvatarUrl(person?.avatarUrl ?? null);
    setErrors({});
  }, [open, person]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      setAvatarUrl(await uploadImage(file));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const body = { name, note, kind, avatarUrl };
      if (person) await patch(`/api/circle/${person.id}`, body);
      else await post('/api/circle', body);
      toast.success(person ? 'Saved' : `Added ${name.trim() || 'them'} to My Circle`);
      onSaved();
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={person ? 'Edit in My Circle' : 'Add to My Circle'}
      subtitle={person ? undefined : 'Reusable across your lists — link a Wishful account later if you want.'}
      size="sm"
      footer={
        <>
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="circle-editor" variant="primary" loading={saving} disabled={!name.trim()}>
            {person ? 'Save' : 'Add'}
          </Button>
        </>
      }
    >
      <form id="circle-editor" className="stack" onSubmit={submit}>
        <div className="avatar-edit">
          <Avatar name={name || '?'} src={avatarUrl} size={64} />
          <Field label="Name" error={errors.name}>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Ava" required data-autofocus />
          </Field>
        </div>
        <div className="row-wrap">
          <label className="btn btn-sm" style={{ cursor: 'pointer' }}>
            <Camera size={15} aria-hidden /> {uploading ? 'Uploading…' : avatarUrl ? 'Change photo' : 'Add a photo'}
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => void onFile(e.target.files?.[0])} disabled={uploading} />
          </label>
          {avatarUrl && (
            <Button type="button" size="sm" variant="ghost" onClick={() => setAvatarUrl(null)}>
              Remove photo
            </Button>
          )}
        </div>
        <div className="field">
          <span className="field-label">Kind</span>
          <Segmented
            label="Kind"
            value={kind}
            onChange={setKind}
            options={[
              { value: 'person', label: 'Person', icon: <UserRound size={15} aria-hidden /> },
              { value: 'pet', label: 'Pet', icon: <PawPrint size={15} aria-hidden /> },
            ]}
          />
        </div>
        <Field label="Note" optional error={errors.note} hint="Only you see this.">
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={LIMITS.circleNote} placeholder="Sister · lives nearby" />
        </Field>
      </form>
    </Modal>
  );
}

function CircleLinkModal({
  open,
  person,
  friends,
  onClose,
  onSaved,
}: {
  open: boolean;
  person: CirclePerson | null;
  friends: FriendSummary[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [friendId, setFriendId] = useState('');
  const [username, setUsername] = useState('');
  const [mode, setMode] = useState<'friend' | 'username'>('friend');
  const [saving, setSaving] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !person) return;
    setFriendId(person.userId && friends.some((f) => f.user.id === person.userId) ? person.userId : '');
    setUsername(person.username ?? '');
    setMode(friends.length ? 'friend' : 'username');
    setError(null);
  }, [open, person, friends]);

  const link = async (e: FormEvent) => {
    e.preventDefault();
    if (!person) return;
    setSaving(true);
    setError(null);
    try {
      const body = mode === 'friend' ? { userId: friendId } : { username: username.trim().replace(/^@/, '') };
      const res = await post<{
        friendStatus: string;
        listsUpdated: number;
        person: CirclePerson;
      }>(`/api/circle/${person.id}/link`, body);
      const status =
        res.friendStatus === 'already_friends'
          ? 'Already friends'
          : res.friendStatus === 'accepted'
            ? 'You’re friends now'
            : res.friendStatus === 'already_requested'
              ? 'Friend request already sent'
              : 'Friend request sent';
      toast.success(
        res.listsUpdated
          ? `${status}. Linked on ${res.listsUpdated} list${res.listsUpdated === 1 ? '' : 's'}.`
          : `${status}. Profile linked.`,
      );
      onSaved();
    } catch (err) {
      setError(fieldErrors(err).username ?? fieldErrors(err).userId ?? errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const unlink = async () => {
    if (!person) return;
    setUnlinking(true);
    try {
      await post(`/api/circle/${person.id}/unlink`, {});
      toast.success('Unlinked account');
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setUnlinking(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={person ? `Link ${person.name}` : 'Link account'}
      subtitle="Attaches their Wishful profile, sends a friend request if needed, and shares lists they’re already on."
      size="sm"
      footer={
        <>
          {person?.userId && (
            <Button type="button" variant="danger-ghost" loading={unlinking} onClick={() => void unlink()} style={{ marginRight: 'auto' }}>
              Unlink
            </Button>
          )}
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="circle-link"
            variant="primary"
            loading={saving}
            disabled={mode === 'friend' ? !friendId : username.trim().replace(/^@/, '').length < 3}
          >
            Link account
          </Button>
        </>
      }
    >
      <form id="circle-link" className="stack" onSubmit={link}>
        {friends.length > 0 && (
          <div className="field">
            <span className="field-label">How to find them</span>
            <Segmented
              label="Link method"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'friend', label: 'A friend' },
                { value: 'username', label: 'By username' },
              ]}
            />
          </div>
        )}
        {mode === 'friend' && friends.length > 0 ? (
          <Field label="Friend" error={error ?? undefined}>
            <select className="select" value={friendId} onChange={(e) => setFriendId(e.target.value)} required>
              <option value="">Choose…</option>
              {friends.map((f) => (
                <option key={f.user.id} value={f.user.id}>
                  {f.user.displayName} (@{f.user.username})
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <Field label="Username" error={error ?? undefined}>
            <div className="input-group">
              <span className="sky-form-at" aria-hidden>
                @
              </span>
              <input
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                data-autofocus
              />
            </div>
          </Field>
        )}
      </form>
    </Modal>
  );
}
