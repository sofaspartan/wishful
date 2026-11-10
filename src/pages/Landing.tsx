import { useRef, useState, type AnimationEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Gift, Library, Puzzle, Sparkles } from 'lucide-react';
import { useMe } from '../lib/queries';
import { brand } from '../config/brand';
import { Logo } from '../components/Logo';
import { Cloud, CloudBank, CloudPuff } from '../components/Cloud';
import { HeroSwirl } from '../components/HeroSwirl';
import { ReservedListArt } from '../components/ReservedListArt';
import { FEATURE_ILLUSTRATIONS, ILLUSTRATED_ITEMS } from '../components/ItemIllustrations';
import { ThemeToggle } from '../components/ThemeToggle';
import { ExtensionArt } from '../components/ExtensionInstall';

interface StageCloud {
  kind: 'front' | 'tint';
  width: number;
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
}

/**
 * One cloud layout per feature card, in paint order (back to front). Offsets
 * are px from the stage edges; clouds anchored on the right are mirrored.
 * Keep the middle ~100px clear for the illustration.
 */
const STAGE_CLOUDS: StageCloud[][] = [
  // Store: low banks on both sides, two small clouds up top
  [
    { kind: 'tint', width: 120, left: 30, bottom: -26 },
    { kind: 'tint', width: 128, right: 34, bottom: -30 },
    { kind: 'front', width: 132, left: -36, bottom: -34 },
    { kind: 'front', width: 150, right: -46, bottom: -38 },
    { kind: 'tint', width: 62, left: 22, top: 16 },
    { kind: 'tint', width: 76, right: 26, top: 20 },
  ],
  // Lists: a big bank on the left, a lighter right side with a cloud floating mid-height
  [
    { kind: 'tint', width: 110, left: 72, bottom: -34 },
    { kind: 'front', width: 176, left: -34, bottom: -36 },
    { kind: 'front', width: 104, right: -44, bottom: -46 },
    { kind: 'tint', width: 54, right: 54, bottom: 30 },
    { kind: 'tint', width: 92, right: 16, top: 18 },
    { kind: 'tint', width: 46, left: 34, top: 14 },
  ],
  // Surprise: clouds hanging from the top corners, small bottom puffs
  [
    { kind: 'tint', width: 124, left: -26, top: -18 },
    { kind: 'tint', width: 136, right: -30, top: -22 },
    { kind: 'front', width: 112, left: -38, bottom: -40 },
    { kind: 'front', width: 104, right: -28, bottom: -38 },
    { kind: 'tint', width: 44, left: 66, bottom: 22 },
    { kind: 'tint', width: 40, right: 74, top: 46 },
  ],
  // Share: a trail of clouds low on the left (the plane flies up and away to the right)
  [
    { kind: 'tint', width: 118, left: 84, bottom: -34 },
    { kind: 'front', width: 156, left: -26, bottom: -30 },
    { kind: 'tint', width: 70, left: 26, top: 30 },
    { kind: 'front', width: 108, right: -54, bottom: -52 },
    { kind: 'tint', width: 56, right: 22, top: 14 },
    { kind: 'tint', width: 42, right: 78, bottom: 32 },
  ],
  // Together: a symmetric bank meeting under the people, staggered clouds up top
  [
    { kind: 'tint', width: 132, left: 56, bottom: -38 },
    { kind: 'tint', width: 132, right: 56, bottom: -38 },
    { kind: 'front', width: 122, left: -30, bottom: -38 },
    { kind: 'front', width: 122, right: -30, bottom: -38 },
    { kind: 'tint', width: 58, left: 38, top: 20 },
    { kind: 'tint', width: 50, right: 34, top: 40 },
  ],
  // Phone: a big bank on the right, a cloud drifting in from the left edge
  [
    { kind: 'tint', width: 102, right: 82, bottom: -30 },
    { kind: 'front', width: 168, right: -36, bottom: -32 },
    { kind: 'front', width: 116, left: -52, bottom: -50 },
    { kind: 'tint', width: 94, left: -20, top: 34 },
    { kind: 'tint', width: 52, right: 40, top: 14 },
    { kind: 'tint', width: 40, left: 76, top: 12 },
  ],
];

const FEATURES = [
  {
    art: FEATURE_ILLUSTRATIONS.store,
    tint: '#e8745b',
    title: 'Save from any store',
    text: 'Paste a link or use the browser extension, and we pull in the name, photo and price. Or add experiences, ideas and gift cards that don’t live online.',
  },
  {
    art: FEATURE_ILLUSTRATIONS.lists,
    tint: '#7c6cf0',
    title: 'Wishlists & collections',
    text: 'Put things on as many wishlists as you like. When you get one, tap “Got it” to file it in a collection of things you already have.',
  },
  {
    art: FEATURE_ILLUSTRATIONS.surprise,
    tint: '#f2c14e',
    title: 'Surprise Mode',
    text: 'Friends reserve gifts so nobody doubles up, while you stay blissfully unaware of who’s getting what.',
  },
  {
    art: FEATURE_ILLUSTRATIONS.share,
    tint: '#3f6fb5',
    title: 'Share anywhere',
    text: 'One link for messages, email or social. Gift-givers don’t need an account to view or reserve.',
  },
  {
    art: FEATURE_ILLUSTRATIONS.together,
    tint: '#4fa3a5',
    title: 'Plan together',
    text: 'Invite a partner as an editor, and let friends team up on big-ticket group gifts.',
  },
  {
    art: FEATURE_ILLUSTRATIONS.phone,
    tint: '#5f9e6e',
    title: 'Made for your phone',
    text: 'Add things the moment you spot them. Everything syncs to every device.',
  },
];

/** "Everything you want, all in one place." → ["Everything you want, ", "all in one place."] */
/** Items that ride across the footer in thought clouds. Must be longer than PARADE_SLOTS so on-screen clouds never repeat. */
const PARADE_ITEMS = [FEATURE_ILLUSTRATIONS.surprise, ...ILLUSTRATED_ITEMS.map((i) => i.art), FEATURE_ILLUSTRATIONS.store];
const PARADE_SECONDS = 42;
const PARADE_SLOTS = [
  { width: 112, top: 6 },
  { width: 92, top: 30 },
  { width: 120, top: 2 },
  { width: 100, top: 26 },
  { width: 108, top: 12 },
  { width: 88, top: 34 },
];

/**
 * Thought clouds drifting left to right on a loop. Each time a cloud wraps
 * (off-screen) it takes the next item in PARADE_ITEMS, so the clouds on screen
 * are always the most recent PARADE_SLOTS.length items and never repeat.
 */
function FooterParade() {
  const [slotItems, setSlotItems] = useState(() => PARADE_SLOTS.map((_, i) => i));
  const nextItem = useRef(PARADE_SLOTS.length);

  const onWrap = (slot: number) => (e: AnimationEvent) => {
    if (e.animationName !== 'thought-parade') return;
    const item = nextItem.current++ % PARADE_ITEMS.length;
    setSlotItems((current) => current.map((v, i) => (i === slot ? item : v)));
  };

  return (
    <>
      {PARADE_SLOTS.map(({ width, top }, i) => (
        <span
          key={i}
          className={`footer-thought${i % 2 ? ' footer-thought-alt' : ''}`}
          onAnimationIteration={onWrap(i)}
          style={{
            top,
            ['--w' as string]: `${width}px`,
            ['--rest' as string]: `calc(${(i + 0.3) / PARADE_SLOTS.length} * 100cqw)`,
            animationDelay: `${(-i / PARADE_SLOTS.length) * PARADE_SECONDS}s, ${-i * 0.8}s`,
          }}
        >
          <Cloud className="thought-cloud" />
          <span className="thought-art">{PARADE_ITEMS[slotItems[i]]}</span>
        </span>
      ))}
    </>
  );
}

export default function Landing() {
  const { data: me } = useMe();
  return (
    <div>
      <div className="landing-top">
        <header className="landing-nav">
          <Logo to="/" />
          <div className="spacer" />
          <ThemeToggle />
          {me ? (
            <Link to="/app" className="btn btn-primary">
              Open {brand.name} <ArrowRight size={16} aria-hidden />
            </Link>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost">
                Log in
              </Link>
              <Link to="/register" className="btn btn-primary">
                Get started
              </Link>
            </>
          )}
        </header>
      </div>

      <main id="main">
        <div className="landing-hero-wrap">
          <CloudPuff className="cloud-1" />
          <CloudPuff className="cloud-2" />
          <CloudPuff className="cloud-3" />
          <CloudPuff className="cloud-4" />
          <section className="landing-hero">
            <div>
              <span className="badge badge-accent">
                <Sparkles aria-hidden /> Wishlists, collections & gift registry
              </span>
              <h1 className="display" style={{ marginTop: 'var(--s-5)' }}>
                Everything you want, <span className="landing-hero-muted">everything you have.</span>
              </h1>
              <p className="landing-lead">
                {brand.name} keeps the things you’re wishing for and the things you already own side by side — from any store, plus the experiences and
                ideas money can’t link to.
              </p>
              <ul className="landing-pair" aria-label={`What you can keep in ${brand.name}`}>
                <li>
                  <span className="landing-pair-icon" aria-hidden>
                    <Gift size={16} />
                  </span>
                  <span>
                    <strong>Wishlists</strong> for what you want — share them and friends reserve gifts.
                  </span>
                </li>
                <li>
                  <span className="landing-pair-icon is-have" aria-hidden>
                    <Library size={16} />
                  </span>
                  <span>
                    <strong>Collections</strong> for what you have — records, sneakers, books, plants.
                  </span>
                </li>
              </ul>
              <div className="landing-ctas">
                <Link to={me ? '/app' : '/register'} className="btn btn-primary btn-lg">
                  {me ? 'Go to your lists' : 'Get started'} <ArrowRight size={17} aria-hidden />
                </Link>
                {!me && (
                  <Link to="/login" className="btn btn-lg">
                    I have an account
                  </Link>
                )}
              </div>
              <p className="landing-note text-sm">Free to use. Friends don’t need an account to reserve gifts.</p>
            </div>
            <HeroSwirl />
          </section>
          <CloudBank className="hero-bottom" />
        </div>

        <section className="features" aria-label="Features">
          {FEATURES.map(({ art, tint, title, text }, i) => (
            <div className="feature" key={title}>
              <div className="feature-stage" style={{ ['--tint' as string]: tint, ['--delay' as string]: `${i * -0.6}s` }}>
                {STAGE_CLOUDS[i].map(({ kind, ...pos }, n) => (
                  <Cloud
                    key={n}
                    className={`stage-cloud stage-cloud-${kind}${pos.right !== undefined ? ' stage-cloud-flip' : ''}`}
                    style={{ ...pos, animationDuration: `${8 + ((n * 1.7) % 5)}s`, animationDirection: n % 2 ? 'alternate-reverse' : 'alternate' }}
                  />
                ))}
                <span className="feature-art">{art}</span>
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </section>

        <section className="landing-extension" aria-labelledby="landing-extension-title">
          <div className="landing-extension-copy">
            <span className="eyebrow">Browser extension</span>
            <h2 id="landing-extension-title" className="display">
              Save from any store in one click.
            </h2>
            <p>
              Add {brand.name} to your browser and every online shop gets a save button. It fills in the name, price and photo — you just pick the
              list.
            </p>
            <ul className="landing-extension-points">
              <li>
                <Check size={16} aria-hidden /> Works in Chrome, Edge, Brave and Arc
              </li>
              <li>
                <Check size={16} aria-hidden /> Save to several wishlists or a collection at once
              </li>
              <li>
                <Check size={16} aria-hidden /> Bring over a whole Amazon wishlist or gift registry
              </li>
              <li>
                <Check size={16} aria-hidden /> Only reads the page when you click it
              </li>
            </ul>
            <Link to="/extension" className="btn btn-primary btn-lg">
              <Puzzle size={17} aria-hidden /> Get the extension
            </Link>
          </div>
          <ExtensionArt />
        </section>

        <section className="landing-band">
          <div className="landing-band-inner">
            <div className="landing-band-copy">
              <h2 className="display">Never get a duplicate gift again.</h2>
              <p>Friends reserve what they’re giving, so everyone else sees it’s taken. Make a list in under a minute and share it with one link.</p>
              <Link to={me ? '/app' : '/register'} className="btn btn-primary btn-lg">
                {me ? 'Open your dashboard' : 'Start your first wishlist'} <ArrowRight size={17} aria-hidden />
              </Link>
            </div>
            <ReservedListArt />
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="footer-sky" aria-hidden>
          <FooterParade />
          <CloudBank className="footer-bank" />
        </div>
        <div className="landing-footer-inner">
          <Logo to="/" size={26} />
          <span>{brand.tagline}</span>
          <span className="spacer" />
          <nav className="legal-links" aria-label="More">
            <Link to="/extension">Browser extension</Link>
            <Link to="/privacy">Privacy</Link>
          </nav>
          <span>
            © {new Date().getFullYear()} {brand.name}
          </span>
        </div>
      </footer>
    </div>
  );
}
