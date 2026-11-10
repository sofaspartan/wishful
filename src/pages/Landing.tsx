import { useState, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Gift, Library, Package, Puzzle, Sparkles } from 'lucide-react';
import { useMe } from '../lib/queries';
import { brand } from '../config/brand';
import { Cloud, CloudBank, CloudPuff } from '../components/Cloud';
import { HeroSwirl, type HeroSceneId } from '../components/HeroSwirl';
import { ReservedListArt } from '../components/ReservedListArt';
import { FEATURE_ILLUSTRATIONS } from '../components/ItemIllustrations';
import { SiteFooter } from '../components/SiteFooter';
import { SiteNav } from '../components/SiteNav';
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
  // Boxes (wide card): stacked banks on both sides, a cloud drifting past the phone
  [
    { kind: 'tint', width: 140, left: 40, bottom: -34 },
    { kind: 'tint', width: 120, right: 50, bottom: -30 },
    { kind: 'front', width: 180, left: -40, bottom: -40 },
    { kind: 'front', width: 160, right: -40, bottom: -42 },
    { kind: 'tint', width: 70, left: 30, top: 18 },
    { kind: 'tint', width: 58, right: 36, top: 26 },
  ],
];

const BOX_POINTS = [
  'Print QR labels on Avery sheets, a 4×6 label printer or plain paper',
  'Anyone who scans sees what’s inside — no app or account, prices hidden',
  'Moving? Mark the room each box goes to and whether it’s fragile',
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

function FeatureStage({ art, tint, index }: { art: ReactElement; tint: string; index: number }) {
  return (
    <div className="feature-stage" style={{ ['--tint' as string]: tint, ['--delay' as string]: `${index * -0.6}s` }}>
      {STAGE_CLOUDS[index].map(({ kind, ...pos }, n) => (
        <Cloud
          key={n}
          className={`stage-cloud stage-cloud-${kind}${pos.right !== undefined ? ' stage-cloud-flip' : ''}`}
          style={{ ...pos, animationDuration: `${8 + ((n * 1.7) % 5)}s`, animationDirection: n % 2 ? 'alternate-reverse' : 'alternate' }}
        />
      ))}
      <span className="feature-art">{art}</span>
    </div>
  );
}

export default function Landing() {
  const { data: me } = useMe();
  const [heroScene, setHeroScene] = useState<HeroSceneId>('wishlist');
  return (
    <div>
      <div className="landing-top">
        <SiteNav current="home" />
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
                <li className={heroScene === 'wishlist' ? 'is-active' : undefined}>
                  <span className="landing-pair-icon" aria-hidden>
                    <Gift size={16} />
                  </span>
                  <span>
                    <strong>Wishlists</strong> for what you want — share them and friends reserve gifts.
                  </span>
                </li>
                <li className={heroScene === 'collection' ? 'is-active' : undefined}>
                  <span className="landing-pair-icon is-have" aria-hidden>
                    <Library size={16} />
                  </span>
                  <span>
                    <strong>Collections</strong> for what you have — records, sneakers, books, plants.
                  </span>
                </li>
                <li className={heroScene === 'box' ? 'is-active' : undefined}>
                  <span className="landing-pair-icon is-box" aria-hidden>
                    <Package size={16} />
                  </span>
                  <span>
                    <strong>Boxes</strong> for what’s packed away — scan the QR label to see what’s inside.
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
            <HeroSwirl onSceneChange={setHeroScene} />
          </section>
          <CloudBank className="hero-bottom" />
        </div>

        <section className="features" aria-labelledby="landing-features-title">
          <header className="features-head">
            <span className="eyebrow">The details</span>
            <h2 id="landing-features-title" className="display">
              Thoughtful where it counts.
            </h2>
            <p>Secrets stay secret, families plan together, and sharing works whether or not people have an account.</p>
          </header>
          {FEATURES.map(({ art, tint, title, text }, i) => (
            <div className="feature" key={title}>
              <FeatureStage art={art} tint={tint} index={i} />
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
          <div className="feature feature-wide">
            <FeatureStage art={FEATURE_ILLUSTRATIONS.boxes} tint="#c8873f" index={FEATURES.length} />
            <div className="feature-wide-copy">
              <span className="badge badge-accent">New</span>
              <h3>Boxes that know what’s inside</h3>
              <p>
                Pack things from your collections into real-world boxes and bins, add quick notes like “winter coats”, and stick a QR label on the
                side. Scan it with any phone camera to see what’s in there — or search “Where’s my…?” and find the box.
              </p>
              <ul className="landing-extension-points">
                {BOX_POINTS.map((point) => (
                  <li key={point}>
                    <Check size={16} aria-hidden /> {point}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <hr className="divider landing-divider" />

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

      <SiteFooter />
    </div>
  );
}
