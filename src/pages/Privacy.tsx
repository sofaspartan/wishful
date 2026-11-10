import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { brand } from '../config/brand';
import { SiteFooter } from '../components/SiteFooter';
import { SiteNav } from '../components/SiteNav';
import { SkyBanner } from '../components/SkyBanner';

const UPDATED = 'November 10, 2026';

export default function Privacy() {
  const name = brand.name;

  useEffect(() => {
    document.title = `Privacy policy · ${name}`;
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
            <h1 className="display">Privacy policy</h1>
            <p className="legal-updated">Last updated {UPDATED}</p>
          </header>
        </SkyBanner>
        <div className="public-content">
          <article className="legal">
            <p className="legal-lead">
              {name} is a place to keep wishlists and collections and share them with the people you choose. We collect only what the app needs to do
              that, we don’t show ads, and we never sell your information.
            </p>

            <h2>What we store</h2>
            <ul>
              <li>
                <strong>Your account:</strong> email address, display name and username. Your password is stored only as a salted scrypt hash, so
                nobody — including us — can read it. Your recovery code is likewise kept only as a one-way fingerprint.
              </li>
              <li>
                <strong>Your profile:</strong> the photo, bio and visibility setting you choose to add.
              </li>
              <li>
                <strong>Your lists and items:</strong> titles, links, prices, notes, photos you upload, cover choices, and who you’ve invited to
                collaborate.
              </li>
              <li>
                <strong>Friends and notifications:</strong> friend requests and connections, and the in-app notifications we generate for you.
              </li>
              <li>
                <strong>Gift reservations:</strong> when someone reserves or chips in on a gift from a shared list, we store the name, optional
                contact and message they enter.
              </li>
            </ul>

            <h2>Surprises stay surprises</h2>
            <p>
              While Surprise Mode is on for a list, our servers never tell its owner what has been reserved or bought, or by whom — and reservations
              made during Surprise Mode stay hidden even if it’s turned off later. This is enforced by the server, not just hidden on screen, and we
              never send owners notifications that would spoil a gift. Guests do see what’s been taken so they don’t buy the same thing twice, so if
              you open your own share link while signed out, we hide it on devices you’ve signed in on and warn you first.
            </p>

            <h2>Who can see your lists</h2>
            <p>
              Lists are private to you and anyone you invite to collaborate. A share link lets anyone who has it view that one list — you can turn a
              link off or replace it at any time. Your public profile shows only the lists you choose to make public, and only if you turn the profile
              on.
            </p>

            <h2>Link previews</h2>
            <p>
              When you paste a product link, our server visits that page once to read its title, price and image so the item fills itself in. We only
              fetch public web addresses, and we don’t keep the page itself. Product photos from those pages are shown from the store’s own servers,
              so the store can see that your browser loaded them, as with any image on the web.
            </p>

            <h2>Gift ideas</h2>
            <p>
              When you search Gift ideas, our server sends the search words, price limit and store filter to the stores we search — Shopify’s product
              catalog, and eBay, Best Buy and Etsy when they’re switched on. We don’t send your name, email or account to them. Results are kept for a
              short time (15 minutes to 6 hours) so repeat searches are faster, and they aren’t linked to you. Product photos load straight from the
              stores’ servers. You can browse Gift ideas without an account; adding a gift to a list needs one.
            </p>

            <h2>Shopping links and commissions</h2>
            <p>
              Links to stores, including Gift ideas results and the Amazon search link, may include referral codes, and {name} may earn a commission
              if you buy something through them. This never changes the price you pay. Once you follow a link, you’re on the store’s website, and its
              own privacy policy and cookies apply there.
            </p>

            <h2>Browser extension</h2>
            <p>
              The {name} extension reads a page only when you click its button, and only the tab you’re looking at. It picks out the product name,
              price and photos on your device, and nothing is sent to {name} until you choose Save — then only the item you saved. It can’t see your
              browsing history or other tabs, and it doesn’t send information anywhere except {name}.
            </p>
            <p>
              Connecting the extension creates a key that lets it see your list names and add items to your own lists — nothing else. We store only a
              fingerprint of that key, along with the browser type and when it was last used, so you can recognize it in Settings. Disconnect it there
              at any time; changing your password disconnects every browser.
            </p>

            <h2>Cookies and browser storage</h2>
            <p>
              We use a single sign-in cookie to keep you logged in for up to 30 days. There are no advertising, analytics or tracking cookies. Your
              browser also keeps a few conveniences on your device only: your light or dark theme and view choices, shared lists you’ve opened
              recently, the name and reservation keys you use on shared lists so you can change a reservation later, and a gift you chose on Gift
              ideas before logging in (kept only in that browser tab, for up to an hour). Clearing your browser data removes them. Because none of
              this tracks you, there’s no cookie banner to accept.
            </p>

            <h2>Services we use</h2>
            <p>
              {name} runs on Netlify, which hosts the site and stores its data. When we send emails, such as list invitations and reminders, they go
              through Resend. These providers process data only to run the service for us. Gift ideas searches go to the stores described above.
            </p>

            <h2>Your choices</h2>
            <ul>
              <li>Edit or delete any list, item or photo at any time.</li>
              <li>Turn email notifications on or off in Settings.</li>
              <li>
                Delete your account from Settings. This permanently removes your account, profile, lists, items, uploaded photos, friendships,
                notifications and connected browsers.
              </li>
            </ul>

            <h2>Children</h2>
            <p>{name} isn’t intended for children under 13, and we don’t knowingly collect information from them.</p>

            <h2>Changes</h2>
            <p>
              If we change this policy, we’ll update the date at the top of this page. The rules for using {name} are in our{' '}
              <Link to="/terms">Terms of Service</Link>.
            </p>

            {brand.contactEmail && (
              <>
                <h2>Contact</h2>
                <p>
                  Questions or requests about your data? Email <a href={`mailto:${brand.contactEmail}`}>{brand.contactEmail}</a>.
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
