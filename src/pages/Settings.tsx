import { useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Bell,
  Blocks,
  Camera,
  ChevronRight,
  ExternalLink,
  Gamepad2,
  Gift,
  Globe,
  KeyRound,
  LifeBuoy,
  LogOut,
  Mail,
  Palette,
  Puzzle,
  RefreshCw,
  Shield,
  Trash2,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import {
  PROFILE_VISIBILITIES,
  VISIBILITIES,
  type CoverArt as CoverArtValue,
  type NotificationPreferences,
  type ProfileVisibility,
  type SelfUser,
  type SyncResult,
  type Visibility,
  type WishlistSettings,
} from '../../shared/types';
import {
  CURRENCIES,
  LIMITS,
  PROFILE_VISIBILITY_DESCRIPTIONS,
  PROFILE_VISIBILITY_LABELS,
  RESERVATION_DAY_OPTIONS,
  VISIBILITY_DESCRIPTIONS,
  VISIBILITY_LABELS,
  defaultCoverArt,
} from '../../shared/constants';
import { ageFromBirthYear } from '../../shared/profileVisibility';
import { CoverArtPicker } from '../components/CoverArtPicker';
import { CoverArt } from '../components/CoverArt';
import { keys, useBrickfolio, useExtensionConnections, useInvalidate, useMe, usePlayshelf, type BrickfolioResponse, type PlayshelfResponse } from '../lib/queries';
import { formatDate, relativeTime } from '../lib/format';
import { brand } from '../config/brand';
import { del, errorMessage, fieldErrors, patch, post, put } from '../lib/api';
import { uploadImage } from '../lib/images';
import { showRecoveryCode } from '../lib/recoveryCode';
import { ExtensionGetButton, InstallSteps } from '../components/ExtensionInstall';
import { PriorityLayoutField } from '../components/WishlistDialogs';
import { Button } from '../components/ui/Button';
import { Field, FormError } from '../components/ui/Field';
import { Avatar, PageLoader, Segmented, SwitchRow } from '../components/ui/misc';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { Cloud } from '../components/Cloud';
import { PageSky } from '../components/PageSky';

const TABS = [
  { id: 'profile', label: 'Profile', icon: UserRound },
  { id: 'privacy', label: 'Privacy & sharing', icon: Shield },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'extension', label: 'Browser extension', icon: Puzzle },
  { id: 'brickfolio', label: 'Brickfolio', icon: Blocks },
  { id: 'playshelf', label: 'Playshelf', icon: Gamepad2 },
  { id: 'account', label: 'Account', icon: KeyRound },
] as const;
type Tab = (typeof TABS)[number]['id'];

const tabsFor = (me: SelfUser) =>
  TABS.filter((t) => (t.id !== 'brickfolio' || me.integrations.brickfolio) && (t.id !== 'playshelf' || me.integrations.playshelf));

function CardTitle({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <h3 className="settings-card-title">
      <span className="tile-header-icon" aria-hidden>
        <Icon size={14} />
      </span>
      {children}
    </h3>
  );
}

function useSaveUser() {
  const qc = useQueryClient();
  return (user: SelfUser) => qc.setQueryData(keys.me, user);
}

export default function Settings() {
  const { data: me } = useMe();
  const [params, setParams] = useSearchParams();
  if (!me) return <PageLoader />;
  const tabs = tabsFor(me);
  const tab = (tabs.find((t) => t.id === params.get('tab'))?.id ?? 'profile') as Tab;
  return (
    <div className="page">
      <PageSky
        eyebrow="Settings"
        title={me.displayName}
        subtitle="Manage your profile, privacy defaults and account."
        art={
          <div className="settings-sky-art">
            <Cloud className="settings-sky-puff" />
            {[0, 1].map((i) => (
              <svg key={i} className={`sky-spark settings-sky-spark-${i}`} viewBox="0 0 12 12">
                <path d="M6 0l1.4 4.6L12 6l-4.6 1.4L6 12 4.6 7.4 0 6l4.6-1.4z" />
              </svg>
            ))}
            <Cloud className="settings-sky-cloud" />
            <span className="settings-sky-avatar">
              <Avatar name={me.displayName} src={me.avatarUrl} size={88} />
            </span>
          </div>
        }
      >
        <div className="sky-stats">
          <span className="sky-stat">@{me.username}</span>
          <span className="sky-stat">
            <span className="sky-stat-sub">Member since</span> {new Date(me.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
          </span>
          {me.profileVisibility !== 'private' && (
            <Link to={`/u/${me.username}`} className="sky-stat">
              <Globe size={13} aria-hidden /> {me.profileVisibility === 'public' ? 'Public profile' : 'Profile'}
            </Link>
          )}
        </div>
      </PageSky>
      <div className="settings-layout">
        <div className="tabs settings-nav" role="tablist" aria-label="Settings sections">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setParams({ tab: id }, { replace: true })}>
              <Icon size={16} aria-hidden />
              {label}
            </button>
          ))}
        </div>
        <div role="tabpanel" aria-label={tabs.find((t) => t.id === tab)?.label}>
          {tab === 'profile' && <ProfileSection me={me} />}
          {tab === 'privacy' && <PrivacySection me={me} />}
          {tab === 'notifications' && <NotificationsSection me={me} />}
          {tab === 'extension' && <ExtensionSection />}
          {tab === 'brickfolio' && <BrickfolioSection />}
          {tab === 'playshelf' && <PlayshelfSection />}
          {tab === 'account' && <AccountSection me={me} />}
        </div>
      </div>
      <div style={{ height: 'var(--s-12)' }} />
    </div>
  );
}

function ProfileSection({ me }: { me: SelfUser }) {
  const saveUser = useSaveUser();
  const toast = useToast();
  const [displayName, setDisplayName] = useState(me.displayName);
  const [username, setUsername] = useState(me.username);
  const [bio, setBio] = useState(me.bio);
  const [avatarUrl, setAvatarUrl] = useState(me.avatarUrl);
  const [profileVisibility, setProfileVisibility] = useState(me.profileVisibility);
  const [location, setLocation] = useState(me.location);
  const [birthYear, setBirthYear] = useState(me.birthYear ? String(me.birthYear) : '');
  const [showAge, setShowAge] = useState(me.birthYear != null);
  const [coverArt, setCoverArt] = useState<CoverArtValue | null>(me.profileCoverArt);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      setAvatarUrl(await uploadImage(file));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setError(null);
    const year = showAge && birthYear.trim() ? Number(birthYear) : null;
    try {
      const { user } = await patch<{ user: SelfUser }>('/api/account/profile', {
        displayName,
        username,
        bio,
        avatarUrl,
        profileVisibility,
        location,
        birthYear: year,
        profileCoverArt: coverArt,
      });
      saveUser(user);
      setShowAge(user.birthYear != null);
      setBirthYear(user.birthYear ? String(user.birthYear) : '');
      toast.success('Profile saved');
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const previewAge = showAge && birthYear ? ageFromBirthYear(Number(birthYear)) : null;

  return (
    <form className="settings-section" onSubmit={submit} noValidate>
      <div className="card card-pad stack">
        <CardTitle icon={UserRound}>Profile</CardTitle>
        <FormError message={error} />
        <div className="avatar-edit">
          <Avatar name={displayName || me.displayName} src={avatarUrl} size={72} />
          <div className="row-wrap">
            <label className="btn btn-sm" style={{ cursor: 'pointer' }}>
              <Camera size={15} aria-hidden /> {uploading ? 'Uploading…' : avatarUrl ? 'Change photo' : 'Upload photo'}
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => void onFile(e.target.files?.[0])} disabled={uploading} />
            </label>
            {avatarUrl && (
              <Button size="sm" variant="ghost" onClick={() => setAvatarUrl(null)}>
                Remove
              </Button>
            )}
          </div>
        </div>
        <div className="form-grid cols-2">
          <Field label="Name" error={errors.displayName}>
            <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={60} autoComplete="name" />
          </Field>
          <Field label="Username" error={errors.username}>
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              maxLength={30}
              autoCapitalize="none"
              spellCheck={false}
            />
          </Field>
          <Field label="About you" optional error={errors.bio} className="span-2" hint="Shown on your profile.">
            <textarea className="textarea" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} maxLength={LIMITS.bio} placeholder="A little about you, sizes, favourite colours…" />
          </Field>
          <Field label="Location" optional error={errors.location} hint="Leave blank to hide it.">
            <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={LIMITS.location} placeholder="Brooklyn, NY" />
          </Field>
          <div className="field">
            <SwitchRow title="Show my age" description="Uses your birth year so it stays accurate." checked={showAge} onChange={setShowAge} />
            {showAge && (
              <Field label="Birth year" error={errors.birthYear} hint={previewAge != null ? `Shown as ${previewAge}` : undefined}>
                <input
                  className="input"
                  type="number"
                  inputMode="numeric"
                  min={1900}
                  max={new Date().getFullYear() - 5}
                  value={birthYear}
                  onChange={(e) => setBirthYear(e.target.value)}
                  placeholder="1995"
                />
              </Field>
            )}
          </div>
        </div>
      </div>

      <div className="card card-pad stack">
        <CardTitle icon={Palette}>Profile style</CardTitle>
        <p className="muted text-sm" style={{ marginTop: '-0.5rem' }}>
          Styles the whole public profile page — scene, colour, or gradient behind your info and lists.
        </p>
        <Segmented<'none' | 'graphic'>
          label="Profile background"
          value={coverArt ? 'graphic' : 'none'}
          onChange={(mode) => setCoverArt(mode === 'graphic' ? (coverArt ?? defaultCoverArt('wishlist')) : null)}
          options={[
            { value: 'none', label: 'None' },
            { value: 'graphic', label: 'Graphic' },
          ]}
        />
        {coverArt && (
          <>
            <div className="profile-style-preview" aria-hidden>
              <CoverArt art={coverArt} showIcon={false} />
              <div className="profile-style-preview-face">
                <Avatar name={displayName || me.displayName} src={avatarUrl} size={44} />
                <div className="profile-style-preview-copy">
                  <strong className="truncate">{displayName || me.displayName}</strong>
                  <span className="truncate">@{username || me.username}</span>
                </div>
              </div>
            </div>
            <CoverArtPicker value={coverArt} onChange={setCoverArt} preview={false} title={displayName || 'Profile'} />
          </>
        )}
      </div>

      <div className="card card-pad stack">
        <div className="field">
          <span className="field-label">Who can find your profile</span>
          <Segmented<ProfileVisibility>
            label="Profile visibility"
            full
            value={profileVisibility}
            onChange={setProfileVisibility}
            options={PROFILE_VISIBILITIES.map((v) => ({ value: v, label: PROFILE_VISIBILITY_LABELS[v] }))}
          />
          <span className="field-hint">{PROFILE_VISIBILITY_DESCRIPTIONS[profileVisibility]}</span>
          {profileVisibility !== 'private' && (
            <span className="field-hint">
              <Link to={`/u/${me.username}`} style={{ textDecoration: 'underline' }}>
                View your profile <ExternalLink size={12} aria-hidden />
              </Link>
            </span>
          )}
        </div>
      </div>
      <div>
        <Button type="submit" variant="primary" loading={busy} disabled={uploading}>
          Save profile
        </Button>
      </div>
    </form>
  );
}

function PrivacySection({ me }: { me: SelfUser }) {
  const saveUser = useSaveUser();
  const toast = useToast();
  const prefs = me.preferences;
  const [defaultVisibility, setDefaultVisibility] = useState<Visibility>(prefs.defaultVisibility);
  const [defaultSurpriseMode, setDefaultSurpriseMode] = useState(prefs.defaultSurpriseMode);
  const [settings, setSettings] = useState<WishlistSettings>(prefs.defaultSettings);
  const [currency, setCurrency] = useState(prefs.currency);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof WishlistSettings>(k: K, v: WishlistSettings[K]) => setSettings((s) => ({ ...s, [k]: v }));

  const save = async () => {
    setBusy(true);
    try {
      const { user } = await patch<{ user: SelfUser }>('/api/account/preferences', { defaultVisibility, defaultSurpriseMode, defaultSettings: settings, currency });
      saveUser(user);
      toast.success('Defaults saved');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="settings-section">
      <div className="card card-pad stack">
        <div>
          <CardTitle icon={Gift}>Defaults for new wishlists</CardTitle>
          <p className="muted text-sm">Each wishlist can override these in its own gift settings.</p>
        </div>
        <div className="field">
          <span className="field-label">Visibility</span>
          <Segmented
            label="Default visibility"
            value={defaultVisibility}
            onChange={setDefaultVisibility}
            options={VISIBILITIES.map((v) => ({ value: v, label: VISIBILITY_LABELS[v] }))}
          />
          <span className="field-hint">{VISIBILITY_DESCRIPTIONS[defaultVisibility]}</span>
        </div>
        <div>
          <SwitchRow title="Surprise Mode" description="Hide reservations and purchases from you so gifts stay a surprise." checked={defaultSurpriseMode} onChange={setDefaultSurpriseMode} />
          <SwitchRow title="Visitors can reserve items" checked={settings.allowClaims} onChange={(v) => set('allowClaims', v)} />
          <SwitchRow title="Visitors can mark items purchased" checked={settings.allowMarkPurchased} onChange={(v) => set('allowMarkPurchased', v)} />
          <SwitchRow title="Show reserved items to visitors" checked={settings.showReserved} onChange={(v) => set('showReserved', v)} />
          <SwitchRow title="Show purchased items to visitors" checked={settings.showPurchased} onChange={(v) => set('showPurchased', v)} />
          <SwitchRow title="Allow messages from gift-givers" checked={settings.allowMessages} onChange={(v) => set('allowMessages', v)} />
        </div>
        <PriorityLayoutField settings={settings} onChange={(change) => setSettings((s) => ({ ...s, ...change }))} />
        <div className="form-grid cols-2">
          <Field label="Reservations expire after">
            <select className="select" value={settings.reservationDays} onChange={(e) => set('reservationDays', Number(e.target.value))}>
              {RESERVATION_DAY_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d === 0 ? 'Never' : `${d} days`}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Default currency">
            <select className="select" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
        </div>
      </div>
      <div>
        <Button variant="primary" onClick={save} loading={busy}>
          Save defaults
        </Button>
      </div>
    </div>
  );
}

function NotificationsSection({ me }: { me: SelfUser }) {
  const saveUser = useSaveUser();
  const toast = useToast();
  const [n, setN] = useState<NotificationPreferences>(me.preferences.notifications);

  useEffect(() => setN(me.preferences.notifications), [me]);

  const update = async (key: keyof NotificationPreferences, value: boolean) => {
    const prev = n;
    setN({ ...n, [key]: value });
    try {
      const { user } = await patch<{ user: SelfUser }>('/api/account/preferences', { notifications: { [key]: value } });
      saveUser(user);
    } catch (err) {
      setN(prev);
      toast.error(errorMessage(err));
    }
  };

  return (
    <div className="settings-section">
      <div className="card card-pad">
        <CardTitle icon={Mail}>Email notifications</CardTitle>
        <p className="muted text-sm">In-app notifications are always on. Choose what we also email you about.</p>
        <div style={{ marginTop: 8 }}>
          <SwitchRow title="Wishlists shared with me" description="When someone adds you as a collaborator." checked={n.emailSharing} onChange={(v) => update('emailSharing', v)} />
          <SwitchRow title="Collaborator changes" description="When an editor adds or changes items on your lists." checked={n.emailCollaboratorEdits} onChange={(v) => update('emailCollaboratorEdits', v)} />
          <SwitchRow title="Upcoming occasions" description="A reminder a week before a wishlist's date." checked={n.emailOccasionReminders} onChange={(v) => update('emailOccasionReminders', v)} />
          <SwitchRow
            title="Price drop alerts"
            description={
              <>
                <span className="badge" style={{ marginRight: 6 }}>
                  Coming soon
                </span>
                Price tracking isn't available yet.
              </>
            }
            checked={false}
            onChange={() => undefined}
            disabled
          />
        </div>
      </div>
      <p className="muted text-sm">We never notify you about gifts reserved while Surprise Mode is on.</p>
    </div>
  );
}

function ExtensionSection() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data: connections, isLoading } = useExtensionConnections();
  const [removing, setRemoving] = useState<string | null>(null);

  const disconnect = async (id: string) => {
    setRemoving(id);
    try {
      await del(`/api/extension/connections/${id}`);
      await qc.invalidateQueries({ queryKey: keys.extensionConnections });
      toast.success('Extension disconnected');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="settings-section">
      <div className="card card-pad stack">
        <div>
          <CardTitle icon={Puzzle}>{brand.name} for your browser</CardTitle>
          <p className="muted text-sm">
            Save products from any store with one click. The extension fills in the name, price and photo from the page you're on, and can only see
            your list names and add the items you choose.
          </p>
        </div>
        <ExtensionGetButton />
        {!brand.extensionUrl && (
          <details className="disclosure ext-settings-steps">
            <summary>
              <ChevronRight size={16} aria-hidden /> How to install it
            </summary>
            <InstallSteps />
            <Link to="/extension" className="text-sm">
              More about the extension
            </Link>
          </details>
        )}
      </div>

      <div className="card card-pad stack">
        <CardTitle icon={Globe}>Connected browsers</CardTitle>
        {isLoading ? (
          <p className="muted text-sm">Loading…</p>
        ) : !connections?.length ? (
          <p className="muted text-sm">No browsers are connected. Open the extension and choose Connect to {brand.name}.</p>
        ) : (
          <ul className="connection-list">
            {connections.map((c) => (
              <li key={c.id} className="connection-row">
                <span className="tile-header-icon" aria-hidden>
                  <Puzzle size={14} />
                </span>
                <div className="connection-copy">
                  <strong>{c.label}</strong>
                  <span className="muted text-sm">
                    Connected {formatDate(c.createdAt)} · {c.lastUsedAt ? `last used ${relativeTime(c.lastUsedAt)}` : 'not used yet'}
                  </span>
                </div>
                <Button size="sm" onClick={() => void disconnect(c.id)} loading={removing === c.id}>
                  Disconnect
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="muted text-sm">Changing your password also disconnects every browser.</p>
    </div>
  );
}

function syncSummary(r: SyncResult): string {
  const parts = [
    r.added && `${r.added} added`,
    r.updated && `${r.updated} updated`,
    r.moved && `${r.moved} moved to your collection`,
    r.removed && `${r.removed} removed`,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Everything was already up to date';
}

function BrickfolioSection() {
  const qc = useQueryClient();
  const invalidate = useInvalidate();
  const toast = useToast();
  const { data: status, isLoading } = useBrickfolio();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ siteUrl: '', fullSetsCsvUrl: '', wishlistCsvUrl: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<'connect' | 'sync' | 'disconnect' | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  useEffect(() => {
    if (status?.connected) setForm({ siteUrl: status.siteUrl, fullSetsCsvUrl: status.fullSetsCsvUrl, wishlistCsvUrl: status.wishlistCsvUrl });
  }, [status?.connected, status?.siteUrl, status?.fullSetsCsvUrl, status?.wishlistCsvUrl]);

  const done = (r: BrickfolioResponse, okMessage: string) => {
    qc.setQueryData(keys.brickfolio, r.status);
    invalidate();
    if (r.status.lastError) toast.error(r.status.lastError);
    else toast.success(okMessage);
  };

  const connect = async (e: FormEvent) => {
    e.preventDefault();
    setBusy('connect');
    setErrors({});
    try {
      const r = await put<BrickfolioResponse>('/api/integrations/brickfolio', form);
      setEditing(false);
      done(r, r.status.lastResult ? `Synced: ${syncSummary(r.status.lastResult)}` : 'Connected');
    } catch (err) {
      const f = fieldErrors(err);
      setErrors(Object.keys(f).length ? f : { form: errorMessage(err) });
    } finally {
      setBusy(null);
    }
  };

  const syncNow = async () => {
    setBusy('sync');
    try {
      const r = await post<BrickfolioResponse>('/api/integrations/brickfolio/sync');
      done(r, r.status.lastResult ? syncSummary(r.status.lastResult) : 'Synced');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async () => {
    setBusy('disconnect');
    try {
      const r = await del<BrickfolioResponse>('/api/integrations/brickfolio');
      qc.setQueryData(keys.brickfolio, r.status);
      invalidate();
      setConfirmDisconnect(false);
      setForm({ siteUrl: '', fullSetsCsvUrl: '', wishlistCsvUrl: '' });
      toast.success('Brickfolio disconnected. Your sets stay, as ordinary items.');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  if (isLoading || !status) return <p className="muted text-sm">Loading…</p>;
  const set = (k: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const linksForm = (
    <form className="stack" onSubmit={connect} noValidate>
      <FormError message={errors.form ?? null} />
      <Field label="Brickfolio site" error={errors.siteUrl} hint="Used for your own set photos and the set catalog (sets.csv).">
        <input className="input" type="url" inputMode="url" placeholder="https://your-collection.netlify.app" value={form.siteUrl} onChange={set('siteUrl')} spellCheck={false} />
      </Field>
      <Field label="full_sets tab (published CSV link)" error={errors.fullSetsCsvUrl}>
        <input className="input" type="url" inputMode="url" placeholder="https://docs.google.com/spreadsheets/d/e/…/pub?gid=…&output=csv" value={form.fullSetsCsvUrl} onChange={set('fullSetsCsvUrl')} spellCheck={false} />
      </Field>
      <Field label="wishlist tab (published CSV link)" error={errors.wishlistCsvUrl}>
        <input className="input" type="url" inputMode="url" placeholder="https://docs.google.com/spreadsheets/d/e/…/pub?gid=…&output=csv" value={form.wishlistCsvUrl} onChange={set('wishlistCsvUrl')} spellCheck={false} />
      </Field>
      <p className="muted text-sm">
        These are the same links Brickfolio reads. In Google Sheets: File → Share → Publish to web, choose the tab, pick “Comma-separated values (.csv)” and copy the link.
      </p>
      <div className="row-wrap">
        <Button type="submit" variant="primary" loading={busy === 'connect'} disabled={!form.siteUrl || !form.fullSetsCsvUrl || !form.wishlistCsvUrl}>
          {status.connected ? 'Save and sync' : 'Connect and sync'}
        </Button>
        {status.connected && <Button onClick={() => setEditing(false)}>Cancel</Button>}
      </div>
    </form>
  );

  return (
    <div className="settings-section">
      <div className="card card-pad stack">
        <div>
          <CardTitle icon={Blocks}>Brickfolio</CardTitle>
          <p className="muted text-sm">
            Your Google Sheet stays the one place you edit. {brand.name} mirrors the full_sets tab into a LEGO collection and the wishlist tab into a LEGO wishlist,
            with the same names, photos, ratings and reviews. Move a row from wishlist to full_sets and it moves here too. It syncs every hour and whenever you open
            one of those lists.
          </p>
        </div>
        {!status.connected || editing ? (
          linksForm
        ) : (
          <>
            {status.lastError && (
              <div className="notice notice-warning" role="alert" style={{ marginBottom: 0 }}>
                <AlertTriangle size={16} aria-hidden />
                <span>{status.lastError}</span>
              </div>
            )}
            <dl className="detail-facts">
              <dt>Site</dt>
              <dd>
                <a href={status.siteUrl} target="_blank" rel="noreferrer">
                  {status.siteUrl.replace(/^https:\/\//, '')} <ExternalLink size={12} aria-hidden />
                </a>
              </dd>
              <dt>Last synced</dt>
              <dd>{status.lastSuccessAt ? relativeTime(status.lastSuccessAt) : 'Not yet'}</dd>
              {status.lastResult && (
                <>
                  <dt>Last change</dt>
                  <dd>{syncSummary(status.lastResult)}</dd>
                </>
              )}
              {status.lastResult && status.lastResult.notInCatalog.length > 0 && (
                <>
                  <dt>Not in catalog</dt>
                  <dd>
                    {status.lastResult.notInCatalog.join(', ')} <span className="muted">(shown with your sheet’s details only)</span>
                  </dd>
                </>
              )}
            </dl>
            <div className="row-wrap">
              {status.collectionId && (
                <Link className="btn btn-sm" to={`/app/lists/${status.collectionId}`}>
                  LEGO collection
                </Link>
              )}
              {status.wishlistId && (
                <Link className="btn btn-sm" to={`/app/lists/${status.wishlistId}`}>
                  LEGO wishlist
                </Link>
              )}
            </div>
            <div className="row-wrap">
              <Button variant="primary" icon={<RefreshCw size={16} />} onClick={() => void syncNow()} loading={busy === 'sync'}>
                Sync now
              </Button>
              <Button onClick={() => setEditing(true)}>Change links</Button>
              <Button variant="ghost" onClick={() => setConfirmDisconnect(true)}>
                Disconnect
              </Button>
            </div>
          </>
        )}
      </div>
      <p className="muted text-sm">
        Synced sets can’t be renamed, deleted or moved here; change them in the sheet. Your own notes, where and when you got a set, what you paid and its
        condition are kept in {brand.name}.
      </p>
      <Modal
        open={confirmDisconnect}
        onClose={() => setConfirmDisconnect(false)}
        title="Disconnect Brickfolio?"
        size="sm"
        footer={
          <>
            <Button onClick={() => setConfirmDisconnect(false)}>Cancel</Button>
            <Button variant="danger" onClick={() => void disconnect()} loading={busy === 'disconnect'}>
              Disconnect
            </Button>
          </>
        }
      >
        <p className="muted">Syncing stops. Your LEGO lists and sets stay as ordinary items you can edit or delete. Your sheet isn’t touched.</p>
      </Modal>
    </div>
  );
}

function PlayshelfSection() {
  const qc = useQueryClient();
  const invalidate = useInvalidate();
  const toast = useToast();
  const { data: status, isLoading } = usePlayshelf();
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<'connect' | 'sync' | 'disconnect' | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  useEffect(() => {
    if (status?.connected) setUsername(status.username);
  }, [status?.connected, status?.username]);

  const done = (r: PlayshelfResponse, okMessage: string) => {
    qc.setQueryData(keys.playshelf, r.status);
    invalidate();
    if (r.status.lastError) toast.error(r.status.lastError);
    else toast.success(okMessage);
  };

  const connect = async (e: FormEvent) => {
    e.preventDefault();
    setBusy('connect');
    setErrors({});
    try {
      const r = await put<PlayshelfResponse>('/api/integrations/playshelf', { username });
      setEditing(false);
      done(r, r.status.lastResult ? `Synced: ${syncSummary(r.status.lastResult)}` : 'Connected');
    } catch (err) {
      const f = fieldErrors(err);
      setErrors(Object.keys(f).length ? f : { form: errorMessage(err) });
    } finally {
      setBusy(null);
    }
  };

  const syncNow = async () => {
    setBusy('sync');
    try {
      const r = await post<PlayshelfResponse>('/api/integrations/playshelf/sync');
      done(r, r.status.lastResult ? syncSummary(r.status.lastResult) : 'Synced');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async () => {
    setBusy('disconnect');
    try {
      const r = await del<PlayshelfResponse>('/api/integrations/playshelf');
      qc.setQueryData(keys.playshelf, r.status);
      invalidate();
      setConfirmDisconnect(false);
      setUsername('');
      toast.success('Playshelf disconnected. Your games stay, as ordinary items.');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  if (isLoading || !status) return <p className="muted text-sm">Loading…</p>;

  const usernameForm = (
    <form className="stack" onSubmit={connect} noValidate>
      <FormError message={errors.form ?? null} />
      <Field label="Playshelf username" error={errors.username} hint="Your library needs Library Visibility set to public on your Playshelf profile.">
        <input className="input" placeholder="Ethan" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" spellCheck={false} />
      </Field>
      <div className="row-wrap">
        <Button type="submit" variant="primary" loading={busy === 'connect'} disabled={!username.trim()}>
          {status.connected ? 'Save and sync' : 'Connect and sync'}
        </Button>
        {status.connected && <Button onClick={() => setEditing(false)}>Cancel</Button>}
      </div>
    </form>
  );

  return (
    <div className="settings-section">
      <div className="card card-pad stack">
        <div>
          <CardTitle icon={Gamepad2}>Playshelf</CardTitle>
          <p className="muted text-sm">
            Playshelf stays the one place you edit your games. {brand.name} mirrors your library into a Video Game Collection, with cover art, platform,
            play status, genres, your star ratings and reviews, and your Playshelf wishlist into a Video Game Wishlist. Add a game to your library and it
            moves here too. It syncs every hour and whenever you open one of those lists.
          </p>
        </div>
        {!status.configured ? (
          <div className="notice notice-warning" role="alert" style={{ marginBottom: 0 }}>
            <AlertTriangle size={16} aria-hidden />
            <span>
              Playshelf isn’t set up on this site yet. Add <code>PLAYSHELF_SUPABASE_URL</code> and <code>PLAYSHELF_SUPABASE_ANON_KEY</code> to the site’s
              environment variables, then come back here.
            </span>
          </div>
        ) : !status.connected || editing ? (
          usernameForm
        ) : (
          <>
            {status.lastError && (
              <div className="notice notice-warning" role="alert" style={{ marginBottom: 0 }}>
                <AlertTriangle size={16} aria-hidden />
                <span>{status.lastError}</span>
              </div>
            )}
            <dl className="detail-facts">
              <dt>Account</dt>
              <dd>
                {status.profileUrl ? (
                  <a href={status.profileUrl} target="_blank" rel="noreferrer">
                    {status.username} <ExternalLink size={12} aria-hidden />
                  </a>
                ) : (
                  status.username
                )}
              </dd>
              <dt>Last synced</dt>
              <dd>{status.lastSuccessAt ? relativeTime(status.lastSuccessAt) : 'Not yet'}</dd>
              {status.lastResult && (
                <>
                  <dt>Last change</dt>
                  <dd>{syncSummary(status.lastResult)}</dd>
                </>
              )}
            </dl>
            <div className="row-wrap">
              {status.collectionId && (
                <Link className="btn btn-sm" to={`/app/lists/${status.collectionId}`}>
                  Game collection
                </Link>
              )}
              {status.wishlistId && (
                <Link className="btn btn-sm" to={`/app/lists/${status.wishlistId}`}>
                  Game wishlist
                </Link>
              )}
            </div>
            <div className="row-wrap">
              <Button variant="primary" icon={<RefreshCw size={16} />} onClick={() => void syncNow()} loading={busy === 'sync'}>
                Sync now
              </Button>
              <Button onClick={() => setEditing(true)}>Change account</Button>
              <Button variant="ghost" onClick={() => setConfirmDisconnect(true)}>
                Disconnect
              </Button>
            </div>
          </>
        )}
      </div>
      <p className="muted text-sm">
        Synced games can’t be renamed, deleted or moved here; change them on Playshelf. Your own notes, where and when you got a game, what you paid and its
        condition are kept in {brand.name}.
      </p>
      <Modal
        open={confirmDisconnect}
        onClose={() => setConfirmDisconnect(false)}
        title="Disconnect Playshelf?"
        size="sm"
        footer={
          <>
            <Button onClick={() => setConfirmDisconnect(false)}>Cancel</Button>
            <Button variant="danger" onClick={() => void disconnect()} loading={busy === 'disconnect'}>
              Disconnect
            </Button>
          </>
        }
      >
        <p className="muted">Syncing stops. Your game lists and games stay as ordinary items you can edit or delete. Playshelf isn’t touched.</p>
      </Modal>
    </div>
  );
}

function RecoveryCodeCard({ me }: { me: SelfUser }) {
  const saveUser = useSaveUser();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const hasCode = Boolean(me.recoveryCodeCreatedAt);

  const close = () => {
    setOpen(false);
    setPassword('');
    setError(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await post<{ user: SelfUser; recoveryCode: string }>('/api/account/recovery-code', { password });
      saveUser(res.user);
      close();
      showRecoveryCode({ code: res.recoveryCode, email: res.user.email, reason: hasCode ? 'replaced' : 'created' });
    } catch (err) {
      setError(fieldErrors(err).password ?? errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`card card-pad stack${hasCode ? '' : ' recovery-missing'}`}>
      <div>
        <CardTitle icon={LifeBuoy}>Recovery code</CardTitle>
        <p className="muted text-sm">
          {hasCode
            ? `Made ${formatDate(me.recoveryCodeCreatedAt!)}. If you forget your password, use it on the Forgot password page to choose a new one. Lost it? Make a new one — the old code stops working.`
            : 'You don’t have a recovery code yet. Without one, there’s no way back into your account if you forget your password.'}
        </p>
      </div>
      <div>
        <Button variant={hasCode ? 'default' : 'primary'} icon={<KeyRound size={16} />} onClick={() => setOpen(true)}>
          {hasCode ? 'Make a new code' : 'Create a recovery code'}
        </Button>
      </div>
      <Modal
        open={open}
        onClose={close}
        title={hasCode ? 'Make a new recovery code?' : 'Create a recovery code'}
        size="sm"
        footer={
          <>
            <Button onClick={close}>Cancel</Button>
            <Button variant="primary" type="submit" form="recovery-code-form" loading={busy} disabled={!password}>
              {hasCode ? 'Make new code' : 'Create code'}
            </Button>
          </>
        }
      >
        <form id="recovery-code-form" className="stack" onSubmit={submit}>
          {hasCode && <p className="muted">Your current code will stop working.</p>}
          <FormError message={error} />
          <Field label="Enter your password to continue">
            <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
        </form>
      </Modal>
    </div>
  );
}

function AccountSection({ me }: { me: SelfUser }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({});
  const [pwBusy, setPwBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) return setPwErrors({ newPassword: 'Use at least 8 characters' });
    setPwBusy(true);
    setPwErrors({});
    try {
      await post('/api/auth/change-password', { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      toast.success('Password changed. Other devices have been logged out.');
    } catch (err) {
      const f = fieldErrors(err);
      setPwErrors(Object.keys(f).length ? f : { currentPassword: errorMessage(err) });
    } finally {
      setPwBusy(false);
    }
  };

  const logout = async () => {
    await post('/api/auth/logout').catch(() => undefined);
    qc.clear();
    navigate('/', { replace: true });
  };

  const deleteAccount = async (e: FormEvent) => {
    e.preventDefault();
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await del('/api/account', { password: deletePassword });
      qc.clear();
      navigate('/', { replace: true });
    } catch (err) {
      setDeleteError(fieldErrors(err).password ?? errorMessage(err));
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="settings-section">
      <div className="card card-pad stack">
        <CardTitle icon={UserRound}>Sign-in</CardTitle>
        <dl className="detail-facts">
          <dt>Email</dt>
          <dd>{me.email}</dd>
          <dt>Member since</dt>
          <dd>{new Date(me.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</dd>
        </dl>
      </div>

      <form className="card card-pad stack" onSubmit={changePassword} noValidate>
        <CardTitle icon={KeyRound}>Change password</CardTitle>
        <div className="form-grid cols-2">
          <Field label="Current password" error={pwErrors.currentPassword}>
            <input className="input" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </Field>
          <Field label="New password" error={pwErrors.newPassword} hint="At least 8 characters.">
            <input className="input" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </Field>
        </div>
        <div>
          <Button type="submit" loading={pwBusy} disabled={!currentPassword || !newPassword}>
            Update password
          </Button>
        </div>
      </form>

      <RecoveryCodeCard me={me} />

      <div className="card card-pad row-wrap" style={{ justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ fontSize: 'var(--text-md)' }}>Log out</h3>
          <p className="muted text-sm">Sign out of this device.</p>
        </div>
        <Button icon={<LogOut size={16} />} onClick={logout}>
          Log out
        </Button>
      </div>

      <div className="card card-pad danger-zone stack">
        <div>
          <h3>Delete account</h3>
          <p className="muted text-sm">
            Permanently deletes your profile, wishlists, items and uploaded images. Shared links stop working immediately, and you're removed from lists you collaborate on. This can't be undone.
          </p>
        </div>
        <div>
          <Button variant="danger" icon={<Trash2 size={16} />} onClick={() => setDeleting(true)}>
            Delete my account
          </Button>
        </div>
      </div>

      <Modal
        open={deleting}
        onClose={() => setDeleting(false)}
        title="Delete your account?"
        size="sm"
        footer={
          <>
            <Button onClick={() => setDeleting(false)}>Cancel</Button>
            <Button variant="danger" type="submit" form="delete-account-form" loading={deleteBusy} disabled={!deletePassword}>
              Delete forever
            </Button>
          </>
        }
      >
        <form id="delete-account-form" className="stack" onSubmit={deleteAccount}>
          <p className="muted">Everything you've created on this account will be permanently removed.</p>
          <FormError message={deleteError} />
          <Field label="Enter your password to confirm">
            <input className="input" type="password" autoComplete="current-password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
