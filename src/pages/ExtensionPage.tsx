import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { EyeOff, ImageIcon, ListChecks, MousePointerClick, ShieldCheck, Unplug } from 'lucide-react';
import { useMe } from '../lib/queries';
import { brand } from '../config/brand';
import { Logo } from '../components/Logo';
import { ThemeToggle } from '../components/ThemeToggle';
import { CloudPuff } from '../components/Cloud';
import { ExtensionArt, ExtensionGetButton, InstallSteps } from '../components/ExtensionInstall';

const HOW = [
  { icon: MousePointerClick, title: 'Click on any product', text: 'On a product page, click the button in your toolbar.' },
  { icon: ImageIcon, title: 'Check the details', text: 'The name, price and photos are filled in. Pick a photo, fix the price or add a note.' },
  { icon: ListChecks, title: 'Choose your lists', text: 'Save to one wishlist, several, a collection — or just your Saved Items.' },
];

export default function ExtensionPage() {
  const { data: me } = useMe();
  const name = brand.name;

  useEffect(() => {
    document.title = `Browser extension · ${name}`;
  }, [name]);

  return (
    <div className="public-shell">
      <header className="public-header">
        <Logo to="/" size={28} />
        <div className="spacer" />
        <Link to={me ? '/app' : '/register'} className="btn btn-sm">
          {me ? `My ${name}` : 'Get started'}
        </Link>
        <ThemeToggle />
      </header>
      <main id="main">
        <section className="ext-hero">
          <CloudPuff className="ext-hero-cloud-1" />
          <CloudPuff className="ext-hero-cloud-2" />
          <div className="ext-hero-inner">
            <div className="ext-hero-copy">
              <span className="eyebrow">Browser extension</span>
              <h1 className="display">Save from any store in one click.</h1>
              <p className="landing-lead">
                Spot something you love? Click the {name} button and it lands on your wishlist — name, price and photo included. No copying links.
                Already have a wishlist on Amazon, Target or Etsy? Open it and bring every item over at once.
              </p>
              <ExtensionGetButton size="lg" />
            </div>
            <ExtensionArt />
          </div>
        </section>

        <div className="ext-sections">
          <section className="ext-how" aria-labelledby="ext-how-title">
            <h2 id="ext-how-title" className="display">
              How it works
            </h2>
            <div className="ext-how-grid">
              {HOW.map(({ icon: Icon, title, text }, i) => (
                <div key={title} className="ext-how-step">
                  <span className="ext-how-num">{i + 1}</span>
                  <Icon size={20} aria-hidden />
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              ))}
            </div>
          </section>

          {!brand.extensionUrl && (
            <section id="install" className="ext-install card card-pad" aria-labelledby="ext-install-title">
              <div>
                <h2 id="ext-install-title" className="display">
                  Install it in a minute
                </h2>
                <p className="muted">
                  We’re getting {name} listed in the Chrome Web Store. Until then, you can add it yourself in a few clicks — it works in Chrome, Edge,
                  Brave and Arc on a computer.
                </p>
              </div>
              <InstallSteps />
              <ExtensionGetButton />
              <p className="muted text-sm">
                Your browser may show a reminder about developer-mode extensions — that’s normal for extensions added outside the store. To update,
                download it again, replace the folder and press the reload button on the extension’s card.
              </p>
            </section>
          )}

          <section className="ext-private" aria-labelledby="ext-private-title">
            <h2 id="ext-private-title" className="display">
              Private by design
            </h2>
            <ul>
              <li>
                <MousePointerClick size={18} aria-hidden />
                <span>It reads a page only when you click it, and only the tab you’re looking at.</span>
              </li>
              <li>
                <EyeOff size={18} aria-hidden />
                <span>It can’t see your browsing history or other tabs, and nothing is sent until you press Save.</span>
              </li>
              <li>
                <ShieldCheck size={18} aria-hidden />
                <span>It can only see your list names and add the items you choose — nothing else in your account.</span>
              </li>
              <li>
                <Unplug size={18} aria-hidden />
                <span>
                  Disconnect it any time in{' '}
                  {me ? <Link to="/app/settings?tab=extension">Settings → Browser extension</Link> : 'Settings → Browser extension'}.
                </span>
              </li>
            </ul>
            <p className="muted text-sm">
              More in our <Link to="/privacy">privacy policy</Link>.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
