import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { brand } from '../config/brand';
import { SiteFooter } from '../components/SiteFooter';
import { SiteNav } from '../components/SiteNav';
import { SkyBanner } from '../components/SkyBanner';

const UPDATED = 'November 10, 2026';

export default function Terms() {
  const name = brand.name;

  useEffect(() => {
    document.title = `Terms of Service · ${name}`;
  }, [name]);

  return (
    <div className="public-shell">
      <div className="landing-top">
        <SiteNav />
      </div>
      <main id="main">
        <SkyBanner className="legal-banner">
          <header className="legal-head">
            <span className="eyebrow">Legal</span>
            <h1 className="display">Terms of Service</h1>
            <p className="legal-updated">Last updated {UPDATED}</p>
          </header>
        </SkyBanner>
        <div className="public-content">
          <article className="legal">
            <p className="legal-lead">
              These terms are the rules for using {name}. By creating an account or using the site, you agree to them and to our{' '}
              <Link to="/privacy">privacy policy</Link>. If you don’t agree, please don’t use {name}.
            </p>

            <h2>Your account</h2>
            <ul>
              <li>You need to be at least 13 years old to create an account.</li>
              <li>
                Give accurate details, keep your password and recovery code safe, and tell us if you think someone else has got into your account.
              </li>
              <li>You’re responsible for what happens in your account, including anything collaborators you invite add to your lists.</li>
            </ul>

            <h2>Your content</h2>
            <p>
              Your lists, items, notes, photos and profile stay yours. You give {name} permission to store, copy and show them only as needed to run
              the service — for example, to show a list to the people you share it with. You can delete your content or your whole account at any
              time.
            </p>
            <p>
              Only add content you have the right to share. Don’t post anything illegal, hateful, harassing, sexually explicit or that infringes
              someone else’s rights, and don’t share other people’s private information without their permission.
            </p>

            <h2>Acceptable use</h2>
            <p>Please don’t:</p>
            <ul>
              <li>try to get around our security, rate limits or privacy protections, or into accounts and lists that aren’t yours;</li>
              <li>scrape, bulk-download or automate the site, except through features we offer such as the browser extension;</li>
              <li>use {name} to send spam, spread malware or phishing links, or mislead people;</li>
              <li>overload or disrupt the service, or resell it.</li>
            </ul>

            <h2>Gifts, reservations and stores</h2>
            <p>
              {name} helps you keep track of what you want and helps others avoid buying the same gift twice. We don’t sell, ship or take payment for
              anything. Purchases happen on other stores’ websites, under their terms, and those stores are responsible for their products, prices,
              delivery and refunds. Reservations and group-gift pledges are an honor system between people: we can’t guarantee that someone who
              reserves a gift will buy it.
            </p>
            <p>
              Prices, photos and availability shown in {name}, including in Gift ideas, come from stores or from what users enter. They can be out of
              date, so check the store before you buy. Some store links earn {name} a commission, as explained in the{' '}
              <Link to="/privacy">privacy policy</Link>.
            </p>

            <h2>Ending your use</h2>
            <p>
              You can stop using {name} and delete your account from Settings whenever you like. We may suspend or close accounts that break these
              terms or put other people or the service at risk, and we may change or discontinue features. If we ever plan to shut {name} down, we’ll
              try to give notice so you can save what matters to you.
            </p>

            <h2>No warranty</h2>
            <p>
              {name} is provided “as is”. We work to keep it running, secure and accurate, but we can’t promise it will always be available,
              error-free or that data will never be lost — keep your own copy of anything important.
            </p>

            <h2>Limitation of liability</h2>
            <p>
              To the extent the law allows, {name} isn’t liable for indirect or consequential losses, such as lost profits, missed gifts or lost data,
              or for anything a store or another user does. Nothing in these terms limits rights you have under consumer law that can’t be limited.
            </p>

            <h2>Changes</h2>
            <p>
              If we change these terms, we’ll update the date at the top of this page. For significant changes, we’ll let signed-in users know in the
              app. Continuing to use {name} after a change means you accept the new terms.
            </p>

            {brand.contactEmail && (
              <>
                <h2>Contact</h2>
                <p>
                  Questions about these terms, or want to report content? Email <a href={`mailto:${brand.contactEmail}`}>{brand.contactEmail}</a>.
                </p>
              </>
            )}
          </article>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
