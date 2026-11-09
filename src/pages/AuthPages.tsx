import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, MailCheck } from 'lucide-react';
import type { SelfUser } from '../../shared/types';
import { keys } from '../lib/queries';
import { errorMessage, fieldErrors, post } from '../lib/api';
import { brand, taglineParts } from '../config/brand';
import { Logo } from '../components/Logo';
import { Cloud, CloudBank, CloudPuff } from '../components/Cloud';
import { FEATURE_ILLUSTRATIONS, ILLUSTRATED_ITEMS } from '../components/ItemIllustrations';
import { Button } from '../components/ui/Button';
import { Field, FormError, FormNote } from '../components/ui/Field';
import { useToast } from '../components/ui/Toast';
import { ThemeToggle } from '../components/ThemeToggle';

type Mode = 'login' | 'register' | 'forgot' | 'reset';

function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/app';
}

function suggestUsername(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24);
}

function PasswordInput(props: { value: string; onChange: (v: string) => void; autoComplete: string; id?: string }) {
  const [show, setShow] = useState(false);
  const { value, onChange, autoComplete, ...rest } = props;
  return (
    <div className="input-group">
      <input {...rest} className="input" type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} style={{ paddingRight: 44 }} />
      <button type="button" className="btn btn-ghost btn-icon btn-sm" style={{ position: 'absolute', right: 4 }} onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

export default function AuthPages({ mode }: { mode: Mode }) {
  return (
    <div className="auth-page">
      <CloudPuff className="auth-cloud-1" />
      <CloudPuff className="auth-cloud-2" />
      <CloudPuff className="auth-cloud-3" />
      <ThemeToggle className="auth-theme-toggle" />
      <div className="auth-panel">
        <Logo to="/" />
        <div className="auth-form-wrap">
          {mode === 'login' && <LoginForm />}
          {mode === 'register' && <RegisterForm />}
          {mode === 'forgot' && <ForgotForm />}
          {mode === 'reset' && <ResetForm />}
        </div>
        <p className="faint text-xs legal-links">
          <span>
            © {new Date().getFullYear()} {brand.name}
          </span>
          <Link to="/privacy">Privacy</Link>
        </p>
      </div>
      <AuthArt />
      <CloudBank className="auth-bank" />
    </div>
  );
}

function useSignedIn() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  return (user: SelfUser) => {
    qc.clear();
    qc.setQueryData(keys.me, user);
    navigate(safeNext(params.get('next')), { replace: true });
  };
}

function LoginForm() {
  const [params] = useSearchParams();
  const signedIn = useSignedIn();
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setErrors({});
    try {
      const { user } = await post<{ user: SelfUser }>('/api/auth/login', { email, password });
      signedIn(user);
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const nextQs = params.get('next') ? `?next=${encodeURIComponent(params.get('next')!)}` : '';

  return (
    <>
      <div>
        <h1 className="display">Welcome back</h1>
        <p className="muted" style={{ marginTop: 8 }}>
          Log in to your wishlists.
        </p>
      </div>
      <form className="stack" onSubmit={submit} noValidate>
        <FormError message={error} />
        <Field label="Email" error={errors.email}>
          <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </Field>
        <Field
          label={
            <span className="row" style={{ justifyContent: 'space-between', width: '100%' }}>
              Password
              <Link to="/forgot-password" className="text-sm muted" style={{ fontWeight: 500 }}>
                Forgot password?
              </Link>
            </span>
          }
          error={errors.password}
        >
          <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" />
        </Field>
        <Button type="submit" variant="primary" size="lg" block loading={busy}>
          Log in
        </Button>
      </form>
      <p className="muted text-sm">
        New to {brand.name}?{' '}
        <Link to={`/register${nextQs}`} style={{ color: 'var(--ink)', fontWeight: 600 }}>
          Create an account
        </Link>
      </p>
    </>
  );
}

function RegisterForm() {
  const [params] = useSearchParams();
  const signedIn = useSignedIn();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!usernameTouched) setUsername(suggestUsername(displayName));
  }, [displayName, usernameTouched]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!displayName.trim()) local.displayName = 'Tell us your name';
    if (password.length < 8) local.password = 'Use at least 8 characters';
    if (username && !/^[a-z0-9_]{3,30}$/.test(username)) local.username = '3–30 lowercase letters, numbers or underscores';
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }
    setBusy(true);
    setError(null);
    setErrors({});
    try {
      const { user } = await post<{ user: SelfUser }>('/api/auth/register', {
        displayName,
        email,
        password,
        username: username || undefined,
      });
      signedIn(user);
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const nextQs = params.get('next') ? `?next=${encodeURIComponent(params.get('next')!)}` : '';

  return (
    <>
      <div>
        <h1 className="display">Create your account</h1>
        <p className="muted" style={{ marginTop: 8 }}>
          {brand.tagline} Free, and takes a minute.
        </p>
      </div>
      <form className="stack" onSubmit={submit} noValidate>
        <FormError message={error} />
        <Field label="Your name" error={errors.displayName}>
          <input className="input" autoComplete="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={60} autoFocus />
        </Field>
        <Field label="Username" error={errors.username} hint="Friends can find and invite you with this.">
          <input
            className="input"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={username}
            onChange={(e) => {
              setUsernameTouched(true);
              setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''));
            }}
            maxLength={30}
          />
        </Field>
        <Field label="Email" error={errors.email}>
          <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password" error={errors.password} hint="At least 8 characters.">
          <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" />
        </Field>
        <Button type="submit" variant="primary" size="lg" block loading={busy}>
          Create account
        </Button>
      </form>
      <p className="muted text-sm">
        Already have an account?{' '}
        <Link to={`/login${nextQs}`} style={{ color: 'var(--ink)', fontWeight: 600 }}>
          Log in
        </Link>
      </p>
    </>
  );
}

function ForgotForm() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<{ devResetUrl?: string } | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setSent(await post<{ ok: true; devResetUrl?: string }>('/api/auth/forgot', { email }));
    } catch (err) {
      setError(fieldErrors(err).email ?? errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <>
        <div className="empty-icon" style={{ background: 'var(--accent-soft)', color: 'var(--accent-ink)', border: 0 }}>
          <MailCheck size={22} />
        </div>
        <div>
          <h1 className="display">Check your inbox</h1>
          <p className="muted" style={{ marginTop: 8 }}>
            If an account exists for <strong>{email}</strong>, we've sent a link to reset your password. It expires in an hour.
          </p>
        </div>
        {sent.devResetUrl && (
          <FormNote>
            Email isn't configured in this development environment.{' '}
            <a href={sent.devResetUrl} style={{ textDecoration: 'underline', fontWeight: 600 }}>
              Open the reset link
            </a>
          </FormNote>
        )}
        <Link to="/login" className="btn">
          Back to log in
        </Link>
      </>
    );
  }

  return (
    <>
      <div>
        <h1 className="display">Reset your password</h1>
        <p className="muted" style={{ marginTop: 8 }}>
          Enter your email and we'll send you a reset link.
        </p>
      </div>
      <form className="stack" onSubmit={submit} noValidate>
        <Field label="Email" error={error ?? undefined}>
          <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </Field>
        <Button type="submit" variant="primary" size="lg" block loading={busy}>
          Send reset link
        </Button>
      </form>
      <p className="muted text-sm">
        Remembered it?{' '}
        <Link to="/login" style={{ color: 'var(--ink)', fontWeight: 600 }}>
          Log in
        </Link>
      </p>
    </>
  );
}

function ResetForm() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const qc = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setErrors({ password: 'Use at least 8 characters' });
    if (password !== confirm) return setErrors({ confirm: "Passwords don't match" });
    setBusy(true);
    setErrors({});
    setError(null);
    try {
      const { user } = await post<{ user: SelfUser }>('/api/auth/reset', { token, password });
      qc.clear();
      qc.setQueryData(keys.me, user);
      toast.success('Password updated — you’re logged in');
      navigate('/app', { replace: true });
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <>
        <h1 className="display">Link incomplete</h1>
        <p className="muted">This reset link is missing its code. Request a new one.</p>
        <Link to="/forgot-password" className="btn btn-primary">
          Request a new link
        </Link>
      </>
    );
  }

  return (
    <>
      <div>
        <h1 className="display">Choose a new password</h1>
        <p className="muted" style={{ marginTop: 8 }}>
          You'll be logged out everywhere else.
        </p>
      </div>
      <form className="stack" onSubmit={submit} noValidate>
        <FormError message={error} />
        <Field label="New password" error={errors.password} hint="At least 8 characters.">
          <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" />
        </Field>
        <Field label="Confirm password" error={errors.confirm}>
          <PasswordInput value={confirm} onChange={setConfirm} autoComplete="new-password" />
        </Field>
        <Button type="submit" variant="primary" size="lg" block loading={busy}>
          Update password
        </Button>
      </form>
      {error && (
        <Link to="/forgot-password" className="text-sm" style={{ textDecoration: 'underline' }}>
          Request a new reset link
        </Link>
      )}
    </>
  );
}

const [camera, , headphones, sneaker, watch, plant, , mug] = ILLUSTRATED_ITEMS.map((i) => i.art);

/** Thought clouds for the auth sky, as % of the scene box (width, left, top); the first is the large centre one. */
const AUTH_SKY: { art: ReactNode; w: number; left: number; top: number }[] = [
  { art: FEATURE_ILLUSTRATIONS.surprise, w: 40, left: 30, top: 30 },
  { art: camera, w: 27, left: 0, top: 6 },
  { art: watch, w: 21, left: 38, top: 0 },
  { art: headphones, w: 28, left: 68, top: 4 },
  { art: plant, w: 25, left: 3, top: 60 },
  { art: sneaker, w: 28, left: 70, top: 56 },
  { art: mug, w: 22, left: 40, top: 80 },
];

function AuthArt() {
  return (
    <aside className="auth-art" aria-hidden>
      <div className="auth-art-inner">
        <div className="auth-sky-scene">
          {AUTH_SKY.map(({ art, w, left, top }, i) => (
            <span
              key={i}
              className={`auth-thought${i === 0 ? ' auth-thought-main' : ''}`}
              style={{ width: `${w}%`, left: `${left}%`, top: `${top}%`, animationDuration: `${4 + (i % 3) * 0.7}s`, animationDelay: `${-i * 0.9}s` }}
            >
              <Cloud className="thought-cloud" />
              <span className="thought-art">{art}</span>
            </span>
          ))}
        </div>
        <div className="auth-art-copy">
          <p className="display">
            {taglineParts[0]}
            {taglineParts[1] && <span className="landing-hero-muted">{taglineParts[1]}</span>}
          </p>
          <p className="muted">Save anything from anywhere, share with the people who matter, and never get a duplicate gift again.</p>
        </div>
      </div>
    </aside>
  );
}
