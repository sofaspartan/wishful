import { useEffect, useState, type FormEvent } from 'react';
import { Camera, Eye, FileText, MapPin, Palette } from 'lucide-react';
import {
  PROFILE_VISIBILITIES,
  isDarkCover,
  type CoverArt as CoverArtValue,
  type ProfileVisibility,
  type SelfUser,
} from '../../shared/types';
import {
  LIMITS,
  PROFILE_VISIBILITY_DESCRIPTIONS,
  PROFILE_VISIBILITY_LABELS,
  defaultCoverArt,
} from '../../shared/constants';
import { ageFromBirthYear } from '../../shared/profileVisibility';
import { errorMessage, fieldErrors, patch } from '../lib/api';
import { uploadImage } from '../lib/images';
import { CoverArt } from './CoverArt';
import { CoverArtPicker } from './CoverArtPicker';
import { Button } from './ui/Button';
import { Field, FormError } from './ui/Field';
import { EditorLayout, PreviewBlock, firstInvalidTab, hasFieldError } from './ui/EditorLayout';
import { Avatar, Segmented, SwitchRow } from './ui/misc';
import { Modal } from './ui/Modal';
import { useToast } from './ui/Toast';

type Tab = 'details' | 'look' | 'visibility';

const TAB_FIELDS: Record<Tab, readonly string[]> = {
  details: ['displayName', 'username', 'bio', 'location', 'birthYear', 'avatarUrl'],
  look: ['profileCoverArt'],
  visibility: ['profileVisibility'],
};

type Props = {
  open: boolean;
  me: SelfUser;
  onClose: () => void;
  onSaved: (user: SelfUser) => void;
};

function ProfilePagePreview({
  displayName,
  username,
  bio,
  location,
  age,
  avatarUrl,
  coverArt,
  visibility,
}: {
  displayName: string;
  username: string;
  bio: string;
  location: string;
  age: number | null;
  avatarUrl: string | null;
  coverArt: CoverArtValue | null;
  visibility: ProfileVisibility;
}) {
  const dark = coverArt ? isDarkCover(coverArt) : false;
  const name = displayName.trim() || 'Your name';
  const handle = username.trim() || 'username';

  return (
    <div className={['profile-editor-preview', coverArt && 'has-cover', dark && 'is-dark'].filter(Boolean).join(' ')}>
      {coverArt ? (
        <div className="profile-editor-preview-sky" aria-hidden>
          <CoverArt art={coverArt} showIcon={false} />
        </div>
      ) : (
        <div className="profile-editor-preview-plain" aria-hidden />
      )}
      <div className="profile-editor-preview-card">
        <Avatar name={name} src={avatarUrl} size={48} />
        <div className="profile-editor-preview-copy">
          <strong className="truncate">{name}</strong>
          <span className="truncate">@{handle}</span>
          {(age != null || location) && (
            <span className="profile-editor-preview-meta truncate">
              {age != null && <span>{age}</span>}
              {age != null && location && <span aria-hidden> · </span>}
              {location && (
                <span className="profile-editor-preview-location">
                  <MapPin size={11} aria-hidden /> {location}
                </span>
              )}
            </span>
          )}
          {bio.trim() && <span className="profile-editor-preview-bio clamp-2">{bio.trim()}</span>}
          <span className="badge badge-outline">{PROFILE_VISIBILITY_LABELS[visibility]}</span>
        </div>
      </div>
    </div>
  );
}

export function EditProfileModal({ open, me, onClose, onSaved }: Props) {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('details');
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

  useEffect(() => {
    if (!open) return;
    setTab('details');
    setDisplayName(me.displayName);
    setUsername(me.username);
    setBio(me.bio);
    setAvatarUrl(me.avatarUrl);
    setProfileVisibility(me.profileVisibility);
    setLocation(me.location);
    setBirthYear(me.birthYear ? String(me.birthYear) : '');
    setShowAge(me.birthYear != null);
    setCoverArt(me.profileCoverArt);
    setErrors({});
    setError(null);
  }, [open, me]);

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
      toast.success('Profile saved');
      onSaved(user);
      onClose();
    } catch (err) {
      const next = fieldErrors(err);
      setErrors(next);
      setError(errorMessage(err));
      const jump = firstInvalidTab(TAB_FIELDS, next);
      if (jump) setTab(jump);
    } finally {
      setBusy(false);
    }
  };

  const previewAge = showAge && birthYear ? ageFromBirthYear(Number(birthYear)) : null;

  const details = (
    <>
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
    </>
  );

  const look = (
    <div className="field">
      <span className="field-label">Profile background</span>
      <Segmented<'none' | 'graphic'>
        label="Profile background"
        value={coverArt ? 'graphic' : 'none'}
        onChange={(mode) => setCoverArt(mode === 'graphic' ? (coverArt ?? defaultCoverArt('wishlist')) : null)}
        options={[
          { value: 'none', label: 'None' },
          { value: 'graphic', label: 'Graphic' },
        ]}
      />
      {coverArt ? (
        <>
          <span className="field-hint">Styles the sky behind your public profile.</span>
          <CoverArtPicker value={coverArt} onChange={setCoverArt} preview={false} part="style" title={displayName || 'Profile'} />
        </>
      ) : (
        <span className="field-hint">Your profile page uses the standard page background.</span>
      )}
    </div>
  );

  const visibility = (
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
    </div>
  );

  const preview = (
    <PreviewBlock caption="Public profile" className="editor-preview-page">
      <ProfilePagePreview
        displayName={displayName}
        username={username}
        bio={bio}
        location={location}
        age={previewAge}
        avatarUrl={avatarUrl}
        coverArt={coverArt}
        visibility={profileVisibility}
      />
    </PreviewBlock>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit profile"
      subtitle="Changes show up on your public profile right away."
      size="xl"
      className="editor-modal"
      bodyClassName="editor-body"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="edit-profile-form" variant="primary" loading={busy} disabled={uploading}>
            Save profile
          </Button>
        </>
      }
    >
      <form id="edit-profile-form" className="editor-form" onSubmit={submit} noValidate>
        <EditorLayout<Tab>
          label="Profile settings"
          active={tab}
          onTabChange={setTab}
          previewTabs={['look']}
          preview={preview}
          alert={<FormError message={error} />}
          tabs={[
            {
              id: 'details',
              label: 'Details',
              icon: <FileText size={16} aria-hidden />,
              invalid: hasFieldError(TAB_FIELDS.details, errors),
              content: details,
            },
            {
              id: 'look',
              label: 'Look',
              icon: <Palette size={16} aria-hidden />,
              invalid: hasFieldError(TAB_FIELDS.look, errors),
              content: look,
            },
            {
              id: 'visibility',
              label: 'Visibility',
              icon: <Eye size={16} aria-hidden />,
              invalid: hasFieldError(TAB_FIELDS.visibility, errors),
              content: visibility,
            },
          ]}
        />
      </form>
    </Modal>
  );
}
