import { useMemo, useRef, useState } from 'react';
import { Camera, EyeOff, Eye, PawPrint, UserPlus, Users, X } from 'lucide-react';
import type { CircleKind, CirclePerson, FriendSummary } from '../../shared/types';
import { LIMITS, joinNames, possessiveNames } from '../../shared/constants';
import { uploadImage } from '../lib/images';
import { errorMessage } from '../lib/api';
import { firstName } from '../lib/format';
import { Button } from './ui/Button';
import { Field } from './ui/Field';
import { Avatar, Segmented } from './ui/misc';

export interface RecipientDraft {
  /** Local only, so cards keep their state when one above is removed. */
  key: string;
  name: string;
  avatarUrl: string | null;
  userId: string | null;
  canEdit: boolean;
  circlePersonId: string | null;
  /** Offer to save a brand-new someone into My Circle (default on). */
  saveToCircle: boolean;
  circleKind: CircleKind;
}

let nextKey = 0;
export const newRecipientDraft = (from: Partial<Omit<RecipientDraft, 'key'>> = {}): RecipientDraft => ({
  key: `person-${nextKey++}`,
  name: '',
  avatarUrl: null,
  userId: null,
  canEdit: false,
  circlePersonId: null,
  saveToCircle: true,
  circleKind: 'person',
  ...from,
});

/** Linked friends a list's people would see, for previews and hints. */
export const linkedRecipients = (people: RecipientDraft[]) => people.filter((p) => p.userId);

interface Props {
  value: RecipientDraft[];
  onChange: (next: RecipientDraft[]) => void;
  friends: FriendSummary[];
  circle: CirclePerson[];
  /** Wishlists only: whether the people it's for are kept from seeing reservations. */
  surprise?: { value: boolean; onChange: (v: boolean) => void };
  noun: string;
  errors: Record<string, string>;
  onUploadingChange: (uploading: boolean) => void;
}

/** Who a list is made for: friends, My Circle, or someone new (optionally saved to My Circle). */
export function RecipientFields({ value, onChange, friends, circle, surprise, noun, errors, onUploadingChange }: Props) {
  const uploads = useRef(0);
  const trackUpload = (on: boolean) => {
    uploads.current += on ? 1 : -1;
    onUploadingChange(uploads.current > 0);
  };
  const update = (key: string, next: RecipientDraft) => onChange(value.map((p) => (p.key === key ? next : p)));
  const linked = linkedRecipients(value);
  const names = joinNames(linked.map((p) => p.name.trim()).filter(Boolean));
  const theySee = names ? `${names} ${linked.length > 1 ? 'see' : 'sees'}` : 'They see';
  const whatTheySee = names ? `What ${names} ${linked.length > 1 ? 'see' : 'sees'}` : 'What they see';

  const usedCircleIds = new Set(value.map((p) => p.circlePersonId).filter(Boolean));
  const availableCircle = circle.filter((p) => !usedCircleIds.has(p.id));

  const addFromCircle = (id: string) => {
    const person = circle.find((p) => p.id === id);
    if (!person || value.length >= LIMITS.recipients) return;
    const empty = value.length === 1 && !value[0].name.trim() && !value[0].userId && !value[0].circlePersonId;
    const draft = newRecipientDraft({
      name: person.name,
      avatarUrl: person.avatarUrl,
      userId: person.userId,
      circlePersonId: person.id,
      saveToCircle: false,
      circleKind: person.kind,
    });
    onChange(empty ? [draft] : [...value, draft]);
  };

  return (
    <div className="recipient-list stack">
      {(availableCircle.length > 0 || friends.length > 0) && value.length < LIMITS.recipients && (
        <div className="recipient-pickers stack" style={{ gap: 'var(--s-3)' }}>
          {availableCircle.length > 0 && (
            <Field label="Add from My Circle" optional hint="People and pets you’ve saved — reusable across lists.">
              <select
                className="select"
                value=""
                onChange={(e) => {
                  if (e.target.value) addFromCircle(e.target.value);
                  e.target.value = '';
                }}
              >
                <option value="">Choose someone…</option>
                {availableCircle.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.kind === 'pet' ? `🐾 ${p.name}` : p.name}
                    {p.username ? ` (@${p.username})` : ''}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
      )}

      {value.map((person, i) => (
        <PersonFields
          key={person.key}
          index={i}
          value={person}
          onChange={(next) => update(person.key, next)}
          onRemove={value.length > 1 ? () => onChange(value.filter((p) => p.key !== person.key)) : undefined}
          friends={friends.filter((f) => f.user.id === person.userId || !value.some((p) => p.userId === f.user.id))}
          circle={circle}
          hasFriends={friends.length > 0}
          noun={noun}
          errors={errors}
          onUploadingChange={trackUpload}
        />
      ))}
      {value.length < LIMITS.recipients && (
        <div className="recipient-add">
          <Button size="sm" icon={<UserPlus size={15} />} onClick={() => onChange([...value, newRecipientDraft()])}>
            Add someone new
          </Button>
          {value.length === 1 && <span className="field-hint">For a joint {noun}: siblings, a couple, a group trip.</span>}
        </div>
      )}
      {errors.recipients && <span className="field-error">{errors.recipients}</span>}

      {linked.length > 0 && surprise && (
        <div className="field">
          <span className="field-label">{whatTheySee}</span>
          <Segmented
            label={whatTheySee}
            full
            value={surprise.value ? 'surprise' : 'everything'}
            onChange={(v) => surprise.onChange(v === 'surprise')}
            options={[
              { value: 'surprise', label: 'Keep it a surprise', icon: <EyeOff size={15} aria-hidden /> },
              { value: 'everything', label: 'Everything', icon: <Eye size={15} aria-hidden /> },
            ]}
          />
          <span className="field-hint">
            {surprise.value
              ? `${theySee} the ${noun} but not who reserved or bought what. You still see it all.`
              : `${theySee} who reserved and bought things, just like you.`}
          </span>
        </div>
      )}
    </div>
  );
}

interface PersonProps {
  index: number;
  value: RecipientDraft;
  onChange: (next: RecipientDraft) => void;
  onRemove?: () => void;
  /** Friends not already linked to someone else on the list. */
  friends: FriendSummary[];
  circle: CirclePerson[];
  hasFriends: boolean;
  noun: string;
  errors: Record<string, string>;
  onUploadingChange: (uploading: boolean) => void;
}

function PersonFields({ index, value, onChange, onRemove, friends, circle, hasFriends, noun, errors, onUploadingChange }: PersonProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const set = (change: Partial<RecipientDraft>) => onChange({ ...value, ...change });
  const friend = friends.find((f) => f.user.id === value.userId)?.user;
  const circleMatch = useMemo(
    () => (value.circlePersonId ? circle.find((p) => p.id === value.circlePersonId) : undefined),
    [circle, value.circlePersonId],
  );
  const name = value.name.trim() || (friend ? firstName(friend.displayName) : '');
  const them = name || 'them';
  const error = (field: string) => errors[`recipients.${index}.${field}`];
  const isNew = !value.circlePersonId;

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    onUploadingChange(true);
    setUploadError(null);
    try {
      set({ avatarUrl: await uploadImage(file) });
    } catch (err) {
      setUploadError(errorMessage(err));
    } finally {
      setUploading(false);
      onUploadingChange(false);
    }
  };

  const pickFriend = (userId: string) => {
    const next = friends.find((f) => f.user.id === userId)?.user;
    const previous = friend ? firstName(friend.displayName) : '';
    const name = next && (!value.name.trim() || value.name.trim() === previous) ? firstName(next.displayName) : value.name;
    set({ userId: next?.id ?? null, name });
  };

  return (
    <div className="recipient-card stack">
      <div className="avatar-edit">
        <Avatar name={value.name || '?'} src={value.avatarUrl ?? friend?.avatarUrl} size={64} />
        <Field label="Their name" error={error('name')}>
          <input
            className="input"
            value={value.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="Ava"
            maxLength={60}
            autoComplete="off"
          />
        </Field>
      </div>
      <div className="row-wrap" style={{ marginTop: -4 }}>
        <label className="btn btn-sm" style={{ cursor: 'pointer' }}>
          <Camera size={15} aria-hidden /> {uploading ? 'Uploading…' : value.avatarUrl ? 'Change photo' : 'Add a photo'}
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => void onFile(e.target.files?.[0])} disabled={uploading} />
        </label>
        {value.avatarUrl && (
          <Button size="sm" variant="ghost" onClick={() => set({ avatarUrl: null })}>
            Remove photo
          </Button>
        )}
        {onRemove && (
          <Button
            size="sm"
            variant="danger-ghost"
            icon={<X size={15} />}
            onClick={onRemove}
            aria-label={value.name.trim() ? `Remove ${value.name.trim()}` : 'Remove this person'}
            style={{ marginLeft: 'auto' }}
          >
            Remove
          </Button>
        )}
      </div>
      {uploadError && <span className="field-error">{uploadError}</span>}

      {circleMatch && (
        <p className="field-hint" style={{ margin: 0 }}>
          From My Circle{circleMatch.kind === 'pet' ? ' · pet' : ''}
          {circleMatch.username ? ` · linked to @${circleMatch.username}` : ''}
        </p>
      )}

      {isNew && (
        <>
          <label className="check">
            <input type="checkbox" checked={value.saveToCircle} onChange={(e) => set({ saveToCircle: e.target.checked })} />
            <span>
              <strong style={{ fontWeight: 550 }}>Save to My Circle</strong>
              <span className="muted text-sm" style={{ display: 'block' }}>
                Keep them for other lists — household, family, friends, or pets.
              </span>
            </span>
          </label>
          {value.saveToCircle && (
            <div className="field">
              <span className="field-label" id={`circle-kind-${value.key}`}>
                Kind
              </span>
              <Segmented
                label="Kind"
                value={value.circleKind}
                onChange={(kind) => set({ circleKind: kind, userId: kind === 'pet' ? null : value.userId })}
                options={[
                  { value: 'person', label: 'Person', icon: <Users size={15} aria-hidden /> },
                  { value: 'pet', label: 'Pet', icon: <PawPrint size={15} aria-hidden /> },
                ]}
              />
            </div>
          )}
        </>
      )}

      {value.circleKind !== 'pet' && (
        <Field
          label="Share it with them"
          optional
          error={error('userId')}
          hint={
            value.userId
              ? `It shows up in ${name ? possessiveNames([name]) : 'their'} Shared with me, and their friends can find it on their profile.`
              : hasFriends
                ? `No account needed — it’s for ${them} either way.${friends.length ? '' : ' Your friends are all on this list already.'}`
                : 'No account needed. Once they’re your friend on Wishful you can share it with them here.'
          }
        >
          <select
            className="select"
            value={value.userId ?? ''}
            onChange={(e) => pickFriend(e.target.value)}
            disabled={!friends.length && !value.userId}
          >
            <option value="">Don’t share — they’re not on Wishful</option>
            {friends.map((f) => (
              <option key={f.user.id} value={f.user.id}>
                {f.user.displayName} (@{f.user.username})
              </option>
            ))}
            {value.userId && !friend && <option value={value.userId}>{value.name} (linked)</option>}
          </select>
        </Field>
      )}

      {value.userId && value.circleKind !== 'pet' && (
        <label className="check">
          <input type="checkbox" checked={value.canEdit} onChange={(e) => set({ canEdit: e.target.checked })} />
          <span>
            <strong style={{ fontWeight: 550 }}>Let {them} add and edit things</strong>
            <span className="muted text-sm" style={{ display: 'block' }}>
              Otherwise they can look but not change the {noun}.
            </span>
          </span>
        </label>
      )}
    </div>
  );
}
