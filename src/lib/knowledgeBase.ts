/** User-facing knowledge base — plain-language guides for Wishful features. */

export const KB_CATEGORIES = [
  { id: 'getting-started', label: 'Getting started' },
  { id: 'lists', label: 'Lists & items' },
  { id: 'gifting', label: 'Sharing & gifts' },
  { id: 'people', label: 'Friends & circle' },
  { id: 'boxes', label: 'Boxes' },
  { id: 'tools', label: 'Tools & extras' },
  { id: 'account', label: 'Account & settings' },
] as const;

export type KbCategoryId = (typeof KB_CATEGORIES)[number]['id'];

export interface KbSection {
  heading?: string;
  paragraphs: string[];
}

export interface KbArticle {
  slug: string;
  title: string;
  category: KbCategoryId;
  summary: string;
  keywords: string[];
  sections: KbSection[];
}

export const KB_ARTICLES: KbArticle[] = [
  {
    slug: 'what-is-wishful',
    title: 'What is Wishful?',
    category: 'getting-started',
    summary: 'A home for wishlists, collections, gifts, and the people you share them with.',
    keywords: ['overview', 'intro', 'platform', 'about'],
    sections: [
      {
        paragraphs: [
          'Wishful is a place to keep everything you want — and everything you already love — in one calm space. Save products, experiences, ideas, and gift cards; organize them into wishlists or collections; then share with friends and family who can reserve gifts without needing an account.',
          'Surprise Mode keeps gift-givers’ choices hidden from you when you want the magic intact. Boxes help you pack and label real-world storage. Friends and My Circle keep people (and pets) close when you build lists for others.',
        ],
      },
    ],
  },
  {
    slug: 'creating-an-account',
    title: 'Creating an account & recovery code',
    category: 'getting-started',
    summary: 'Sign up with email, save your recovery code, and get back in even without inbox access.',
    keywords: ['register', 'signup', 'login', 'password', 'recovery'],
    sections: [
      {
        paragraphs: [
          'Create an account with your email, a display name, a username, and a password. After you register, Wishful shows a one-time recovery code — write it down or store it somewhere safe. That code is how you reset your password if you can’t use email.',
          'You can log in anytime from the Log in page. Forgot your password? Use Forgot password for an emailed reset when email is configured, or recover with your email plus recovery code.',
        ],
      },
      {
        heading: 'New recovery codes',
        paragraphs: [
          'From Profile & settings you can generate a replacement recovery code (you’ll need your current password). The old code stops working. If you registered before recovery codes existed, the notification bell may remind you to save one.',
        ],
      },
    ],
  },
  {
    slug: 'home-dashboard',
    title: 'Your home dashboard',
    category: 'getting-started',
    summary: 'A quick look at your lists, saved items, and shortcuts to create or paste something new.',
    keywords: ['home', 'dashboard', 'quick actions', 'palette', 'look'],
    sections: [
      {
        paragraphs: [
          'Home greets you with a short summary of your wishlists, collections, and saved items, plus a Quick actions card for pasting a link, starting a list, or opening common tasks.',
          'Use the paint-palette icon in the top bar (before notifications) to pick a soft dashboard look: Calm gray, Sky, Blush, or Kraft — matching the washes used on list heroes. Dark mode switches each look to a night version with stars.',
        ],
      },
    ],
  },
  {
    slug: 'wishlists-vs-collections',
    title: 'Wishlists vs collections',
    category: 'lists',
    summary: 'Wishlists are for things you want; collections chronicle what you already have.',
    keywords: ['wishlist', 'collection', 'kind', 'owned', 'got it'],
    sections: [
      {
        paragraphs: [
          'A wishlist is for gifts and wants — priorities, occasions, Surprise Mode, reservations, and group gifts all live here.',
          'A collection is for things you already own or keep. Surprise Mode, gift reservations, and occasion settings stay off. Items can track ownership details like when you got them, condition, rating, and a short review.',
        ],
      },
      {
        heading: 'Got it',
        paragraphs: [
          'When something on a wishlist becomes yours, use Got it to file it into a collection (new or existing) and optionally remove it from the wishlist it came from.',
        ],
      },
    ],
  },
  {
    slug: 'adding-items',
    title: 'Adding items',
    category: 'lists',
    summary: 'Paste a link, add manually, import in bulk, or save from the browser extension.',
    keywords: ['add item', 'paste', 'url', 'csv', 'bulk', 'extension', 'priority'],
    sections: [
      {
        paragraphs: [
          'From Home, a list, or the Add menu, you can paste a product URL and Wishful will try to fill in title, price, and image. You can also add an item by hand, enter several lines at once, or import a CSV.',
          'Each item can live on multiple lists. On a wishlist, set priority (Must have, Really want, Interested), notes for gift-givers, and optional private notes only you (and editors) see.',
        ],
      },
      {
        heading: 'Saved Items',
        paragraphs: [
          'Saved Items is your personal library of everything you’ve added — search, sort, and open an item to see which lists it belongs to or add it somewhere new.',
        ],
      },
    ],
  },
  {
    slug: 'organizing-lists',
    title: 'Organizing My Lists',
    category: 'lists',
    summary: 'Switch between wishlists, collections, and boxes; sort; and toggle card or list view.',
    keywords: ['my lists', 'sort', 'grid', 'card', 'archive', 'shared'],
    sections: [
      {
        paragraphs: [
          'My Lists lets you focus on Wishlists, Collections, or Boxes with a segmented control. Sort and switch between card and list layouts. Shared With Me lists appear in the Shared area so collaborations stay easy to find.',
          'Archive a list when you’re done without deleting it. You can restore it later from archived views where available.',
        ],
      },
    ],
  },
  {
    slug: 'covers-and-art',
    title: 'Covers, accents & dashboard looks',
    category: 'lists',
    summary: 'Pick illustrated covers or photos for lists, and tint your signed-in workspace.',
    keywords: ['cover', 'art', 'backdrop', 'accent', 'theme', 'dark mode'],
    sections: [
      {
        paragraphs: [
          'Every list can have a photo cover or an illustrated cover (icon + backdrop). Accents help lists stand out in grids and the sidebar.',
          'The whole app supports light and dark mode from the top bar. Dashboard looks (Calm, Sky, Blush, Kraft) only change the soft background wash behind your signed-in pages — they don’t change list covers.',
        ],
      },
    ],
  },
  {
    slug: 'sharing-lists',
    title: 'Sharing a list',
    category: 'gifting',
    summary: 'Share a private link, invite collaborators, or publish lists on your profile.',
    keywords: ['share', 'link', 'collaborator', 'invite', 'public', 'friends-only'],
    sections: [
      {
        paragraphs: [
          'Open a wishlist and use Share to copy a private link anyone can open — no account required for guests. You can turn a link off or replace it anytime.',
          'Invite collaborators by email or username with viewer or editor access. Pending invites wait until someone joins Wishful.',
        ],
      },
      {
        heading: 'Visibility',
        paragraphs: [
          'Lists can be private, friends-only, or public on your profile (when your profile is visible). Friends-only lists still need the share link plus a signed-in friend, owner, or collaborator to open.',
        ],
      },
    ],
  },
  {
    slug: 'surprise-mode',
    title: 'Surprise Mode',
    category: 'gifting',
    summary: 'Keep reservations and purchases hidden from you so gifts stay a surprise.',
    keywords: ['surprise', 'spoiler', 'hidden', 'reservation'],
    sections: [
      {
        paragraphs: [
          'Turn on Surprise Mode for a wishlist when you don’t want to know what’s been claimed. The server hides reservation details from you as the owner — not just in the UI. Guests still see what’s taken so they don’t double-buy.',
          'Reservations made while Surprise Mode was on stay hidden even if you turn it off later. Opening your own share link on a device you’ve used signed-in may warn you first so you don’t spoil yourself.',
        ],
      },
    ],
  },
  {
    slug: 'reserving-gifts',
    title: 'Reserving & group gifts',
    category: 'gifting',
    summary: 'Guests can reserve items or chip in together — with a private manage link on their device.',
    keywords: ['reserve', 'claim', 'pledge', 'group gift', 'buy', 'purchase'],
    sections: [
      {
        paragraphs: [
          'On a shared wishlist, guests can reserve an item so others know it’s covered. They get a private manage token stored on their device (and can copy a manage link) to release or mark purchased later.',
          'Group gifts let several people pledge toward one item. Enable group gift on an entry and optionally add a note for contributors.',
        ],
      },
    ],
  },
  {
    slug: 'gift-ideas',
    title: 'Gift ideas search',
    category: 'gifting',
    summary: 'Browse gift ideas from connected stores — signed in or out — then save finds to a list.',
    keywords: ['gifts', 'search', 'shop', 'etsy', 'ebay', 'amazon'],
    sections: [
      {
        paragraphs: [
          'Gift ideas lets anyone search curated store catalogs. Signed-out visitors can browse; adding a result to a list needs an account. From inside the app, Gift ideas lives in the sidebar and mobile menu too.',
        ],
      },
    ],
  },
  {
    slug: 'friends',
    title: 'Friends',
    category: 'people',
    summary: 'Find people, send requests, and see friends-only lists once you’re connected.',
    keywords: ['friend', 'request', 'search people', 'profile'],
    sections: [
      {
        paragraphs: [
          'On Friends, search for people, send requests, and manage who you’re connected with. Accepted friends can open friends-only lists (with the share link) and see which of your lists you’ve shared with friends.',
          'Open a friend’s profile to browse the lists they’re happy to show friends.',
        ],
      },
    ],
  },
  {
    slug: 'my-circle',
    title: 'My Circle',
    category: 'people',
    summary: 'Keep recipients — including pets — for Me + someone lists, with optional Wishful accounts linked later.',
    keywords: ['circle', 'recipient', 'pet', 'me + someone', 'people'],
    sections: [
      {
        paragraphs: [
          'My Circle is your personal address book of people (and pets) you shop for. Add names when you create Me + someone lists, or manage everyone from the Friends → My Circle tab.',
          'You can link a circle person to a Wishful account later — that can send a friend request and help fill collaborators where it makes sense. Notices on My Circle are dismissible; restore tips anytime from Profile & settings.',
        ],
      },
    ],
  },
  {
    slug: 'boxes',
    title: 'Boxes & labels',
    category: 'boxes',
    summary: 'Track packed boxes, print QR labels, and let anyone scan a code to see what’s inside.',
    keywords: ['box', 'qr', 'label', 'pack', 'archive', 'scan'],
    sections: [
      {
        paragraphs: [
          'Boxes help you inventory storage — attic bins, moving boxes, hobby crates. Create a box, add what’s inside, and print labels with a QR code that opens a public scan page.',
          'On My Lists → Boxes, switch Active, Archived, and Shared. Archive boxes you’re done packing; archived boxes won’t resolve on public scans the same way active ones do.',
        ],
      },
      {
        heading: 'Scanning',
        paragraphs: [
          'Anyone with the code can open /b/your-code (or type a code at /b) to see the box contents you’ve chosen to show. Perfect for helpers during a move.',
        ],
      },
    ],
  },
  {
    slug: 'browser-extension',
    title: 'Browser extension',
    category: 'tools',
    summary: 'Save products from shopping tabs straight into Wishful with a connected browser.',
    keywords: ['extension', 'chrome', 'edge', 'save', 'connect'],
    sections: [
      {
        paragraphs: [
          'Install the Wishful extension for Chrome or Edge, then connect it while signed in. From a product page, save to one of your lists without copying links by hand.',
          'Manage or revoke connected browsers in Settings. Changing your password signs out extension connections too.',
        ],
      },
    ],
  },
  {
    slug: 'profiles',
    title: 'Public profiles',
    category: 'tools',
    summary: 'Optionally show a public page of lists you’ve marked public, with cover styling.',
    keywords: ['profile', 'username', 'visibility', 'public'],
    sections: [
      {
        paragraphs: [
          'In Profile & settings, choose whether your profile is private or visible. Public profiles live at /u/your-username and only list the lists you’ve made public.',
          'You can style your profile cover art the same way you style list covers.',
        ],
      },
    ],
  },
  {
    slug: 'notifications',
    title: 'Notifications',
    category: 'tools',
    summary: 'The bell gathers friend requests, invites, reminders, and recovery nudges.',
    keywords: ['bell', 'alerts', 'invite', 'reminder'],
    sections: [
      {
        paragraphs: [
          'The notification bell in the top bar collects in-app updates — friend requests, collaborator invites, occasion reminders when email is available, and gentle nudges like saving a recovery code. Wishful stays free-tier friendly and doesn’t rely on push notifications unless you opt into flows that use email.',
        ],
      },
    ],
  },
  {
    slug: 'settings-privacy',
    title: 'Settings & your data',
    category: 'account',
    summary: 'Update profile details, visibility, recovery, and understand what Wishful stores.',
    keywords: ['settings', 'privacy', 'delete', 'data', 'password'],
    sections: [
      {
        paragraphs: [
          'Profile & settings is where you change display name, username, bio, avatar, profile visibility, password, and recovery code. You can also restore dismissed in-app tips.',
          'Wishful stores what the app needs to run your lists and friendships — not ads, and never sold. Read the Privacy policy and Terms from any page footer for the formal details. Contact email is on the Privacy page when provided.',
        ],
      },
    ],
  },
];

export function kbCategoryLabel(id: KbCategoryId): string {
  return KB_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

export function getKbArticle(slug: string): KbArticle | undefined {
  return KB_ARTICLES.find((a) => a.slug === slug);
}

/** Case-insensitive search across title, summary, keywords, and body. */
export function searchKbArticles(query: string, category?: KbCategoryId | 'all'): KbArticle[] {
  const q = query.trim().toLowerCase();
  return KB_ARTICLES.filter((article) => {
    if (category && category !== 'all' && article.category !== category) return false;
    if (!q) return true;
    const hay = [
      article.title,
      article.summary,
      ...article.keywords,
      ...article.sections.flatMap((s) => [s.heading ?? '', ...s.paragraphs]),
    ]
      .join('\n')
      .toLowerCase();
    return q.split(/\s+/).every((word) => hay.includes(word));
  });
}
