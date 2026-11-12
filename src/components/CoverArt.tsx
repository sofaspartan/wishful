import type { CSSProperties, ReactElement } from 'react';
import { coverPaint, isDarkCover, type CoverArt as CoverArtValue, type CoverBackdrop, type CoverFrame, type CoverIcon, type ListKind } from '../../shared/types';
import { CloudBank } from './Cloud';
import { FEATURE_ILLUSTRATIONS, ILLUSTRATED_ITEMS } from './ItemIllustrations';
import { COVER_ILLUSTRATIONS as C } from './CoverIllustrations';
import { defaultCoverArt } from '../../shared/constants';

const [camera, sweater, headphones, sneaker, watch, plant, book, mug] = ILLUSTRATED_ITEMS.map((i) => i.art);
const F = FEATURE_ILLUSTRATIONS;

export const COVER_ICON_ART: Record<CoverIcon, ReactElement> = {
  ...C,
  collection: F.collection,
  gift: F.surprise,
  bag: F.store,
  camera,
  headphones,
  sneaker,
  watch,
  sweater,
  plant,
  book,
  mug,
  idea: F.idea,
  plane: F.share,
};

export const COVER_ICON_LABELS: Record<CoverIcon, string> = {
  wishlist: 'Wishlist',
  collection: 'Collection (records and books)',
  sparkles: 'Sparkles',
  chest: 'Treasure chest',
  cash: 'Cash dollar',
  tree: 'Christmas tree',
  snowflake: 'Snowflake',
  holly: 'Holly',
  snowman: 'Snowman',
  ornament: 'Ornament',
  'candy-cane': 'Candy cane',
  pumpkin: 'Pumpkin',
  leaf: 'Autumn leaf',
  sun: 'Sunshine',
  flower: 'Flower',
  umbrella: 'Rain umbrella',
  'ice-cream': 'Ice cream',
  watermelon: 'Watermelon',
  acorn: 'Acorn',
  heart: 'Heart',
  cake: 'Birthday cake',
  balloon: 'Balloons',
  'grad-cap': 'Graduation cap',
  ring: 'Ring',
  house: 'Home',
  star: 'Star',
  suitcase: 'Suitcase',
  gift: 'Gift',
  bag: 'Shopping bag',
  camera: 'Camera',
  headphones: 'Headphones',
  sneaker: 'Sneaker',
  watch: 'Watch',
  sweater: 'Sweater',
  plant: 'Plant',
  book: 'Book',
  mug: 'Mug',
  record: 'Vinyl record',
  brick: 'Building brick',
  controller: 'Game controller',
  'jack-o-lantern': 'Jack-o’-lantern',
  ghost: 'Ghost',
  'witch-hat': 'Witch hat',
  bat: 'Bat',
  'candy-corn': 'Candy corn',
  shamrock: 'Shamrock',
  'pot-of-gold': 'Pot of gold',
  'leprechaun-hat': 'Leprechaun hat',
  rainbow: 'Rainbow',
  'love-letter': 'Love letter',
  chocolates: 'Box of chocolates',
  rose: 'Rose',
  turkey: 'Turkey',
  pie: 'Pumpkin pie',
  cornucopia: 'Cornucopia',
  menorah: 'Menorah',
  dreidel: 'Dreidel',
  'star-of-david': 'Star of David',
  blocks: 'Number blocks',
  robot: 'Wind-up robot',
  teddy: 'Teddy bear',
  duck: 'Rubber duck',
  train: 'Toy train',
  'rocking-horse': 'Rocking horse',
  dinosaur: 'Toy dinosaur',
  rocket: 'Toy rocket',
  'easter-egg': 'Easter egg',
  bunny: 'Bunny',
  chick: 'Chick',
  basket: 'Easter basket',
  fireworks: 'Fireworks',
  'party-hat': 'Party hat',
  champagne: 'Champagne toast',
  flag: 'American flag',
  diya: 'Diya lamp',
  'paper-lantern': 'Red lantern',
  'red-envelope': 'Red envelope',
  crescent: 'Crescent moon and star',
  fanous: 'Ramadan lantern',
  bouquet: 'Bouquet',
  necktie: 'Necktie',
  grill: 'Barbecue grill',
  'baby-bottle': 'Baby bottle',
  rattle: 'Rattle',
  stroller: 'Stroller',
  onesie: 'Onesie',
  backpack: 'Backpack',
  pencil: 'Pencil',
  apple: 'Apple',
  crayons: 'Crayons',
  palette: 'Paint palette',
  guitar: 'Guitar',
  yarn: 'Yarn and needles',
  tent: 'Tent',
  'fishing-rod': 'Fishing rod',
  'soccer-ball': 'Soccer ball',
  basketball: 'Basketball',
  baseball: 'Baseball',
  paw: 'Paw print',
  bone: 'Dog bone',
  fishbowl: 'Fishbowl',
  'toy-mouse': 'Cat toy',
  whisk: 'Whisk',
  'chef-hat': 'Chef hat',
  'watering-can': 'Watering can',
  candle: 'Candle',
  lipstick: 'Lipstick',
  perfume: 'Perfume',
  handbag: 'Handbag',
  laptop: 'Laptop',
  phone: 'Phone',
  tablet: 'Tablet',
  kite: 'Kite',
  doll: 'Doll',
  'toy-car': 'Toy car',
  puzzle: 'Puzzle',
  idea: 'Lightbulb',
  plane: 'Paper plane',
  box: 'Cardboard box',
  tote: 'Storage tote',
  'clear-tub': 'Clear plastic tub',
  crate: 'Wooden crate',
  'metal-case': 'Metal case',
  'fabric-bin': 'Fabric bin',
  drawers: 'Storage drawers',
  'archive-box': 'Archive box',
  duffel: 'Duffel bag',
};

export const COVER_ICON_GROUPS: Array<{ label: string; icons: CoverIcon[] }> = [
  { label: 'Wishlists & collections', icons: ['gift', 'wishlist', 'sparkles', 'star', 'bag', 'collection', 'chest', 'cash'] },
  { label: 'Celebrations', icons: ['cake', 'balloon', 'party-hat', 'grad-cap', 'ring', 'house', 'suitcase'] },
  { label: 'Christmas & winter', icons: ['tree', 'holly', 'snowflake', 'snowman', 'ornament', 'candy-cane'] },
  { label: 'Hanukkah', icons: ['menorah', 'dreidel', 'star-of-david'] },
  { label: 'New Year’s & Fourth of July', icons: ['fireworks', 'champagne', 'party-hat', 'flag'] },
  { label: 'Valentine’s Day', icons: ['heart', 'love-letter', 'chocolates', 'rose'] },
  { label: 'St. Patrick’s Day', icons: ['shamrock', 'pot-of-gold', 'leprechaun-hat', 'rainbow'] },
  { label: 'Easter', icons: ['easter-egg', 'bunny', 'chick', 'basket'] },
  { label: 'Mother’s & Father’s Day', icons: ['bouquet', 'necktie', 'grill'] },
  { label: 'Halloween', icons: ['jack-o-lantern', 'ghost', 'witch-hat', 'bat', 'candy-corn'] },
  { label: 'Thanksgiving', icons: ['turkey', 'pie', 'cornucopia'] },
  { label: 'Diwali, Eid & Lunar New Year', icons: ['diya', 'crescent', 'fanous', 'paper-lantern', 'red-envelope'] },
  { label: 'Seasons', icons: ['flower', 'umbrella', 'sun', 'ice-cream', 'watermelon', 'leaf', 'acorn', 'pumpkin'] },
  { label: 'Baby', icons: ['baby-bottle', 'rattle', 'stroller', 'onesie'] },
  { label: 'Toys', icons: ['blocks', 'teddy', 'robot', 'duck', 'train', 'rocking-horse', 'dinosaur', 'rocket', 'kite', 'doll', 'toy-car', 'puzzle', 'brick'] },
  { label: 'Back to school', icons: ['backpack', 'pencil', 'apple', 'crayons', 'book'] },
  { label: 'Hobbies', icons: ['palette', 'guitar', 'yarn', 'tent', 'fishing-rod', 'record', 'camera'] },
  { label: 'Sports', icons: ['soccer-ball', 'basketball', 'baseball', 'sneaker'] },
  { label: 'Pets', icons: ['paw', 'bone', 'fishbowl', 'toy-mouse'] },
  { label: 'Home & kitchen', icons: ['whisk', 'chef-hat', 'mug', 'candle', 'plant', 'watering-can'] },
  { label: 'Fashion & beauty', icons: ['lipstick', 'perfume', 'handbag', 'watch', 'sweater'] },
  { label: 'Tech & games', icons: ['laptop', 'phone', 'tablet', 'headphones', 'controller'] },
  {
    label: 'Storage & moving',
    icons: ['box', 'tote', 'clear-tub', 'crate', 'metal-case', 'fabric-bin', 'drawers', 'archive-box', 'chest', 'suitcase', 'duffel', 'backpack', 'handbag', 'basket', 'house'],
  },
  { label: 'Other', icons: ['idea', 'plane'] },
];

/** Extra words people might search for, beyond each icon's label and section. */
const COVER_ICON_KEYWORDS: Partial<Record<CoverIcon, string>> = {
  wishlist: 'list checklist',
  collection: 'records books shelf library',
  sparkles: 'magic shiny',
  chest: 'treasure',
  cash: 'dollar money coin fund contribute tip',
  tree: 'christmas xmas holiday pine',
  snowflake: 'snow cold winter',
  holly: 'christmas berries',
  snowman: 'snow winter frosty',
  ornament: 'christmas bauble decoration',
  'candy-cane': 'christmas sweets peppermint',
  pumpkin: 'fall autumn october',
  leaf: 'fall autumn maple',
  sun: 'summer sunny beach',
  flower: 'spring garden daisy',
  umbrella: 'rain spring weather',
  'ice-cream': 'summer dessert cone',
  watermelon: 'summer fruit picnic',
  acorn: 'fall autumn squirrel',
  heart: 'love romance',
  cake: 'birthday party dessert',
  balloon: 'birthday party baby shower gender reveal',
  'grad-cap': 'graduation school college',
  ring: 'wedding engagement anniversary bridal registry jewelry',
  house: 'housewarming new home move',
  star: 'favorite wish',
  suitcase: 'travel trip vacation luggage',
  gift: 'present birthday christmas',
  bag: 'shopping store',
  camera: 'photography photo',
  headphones: 'music audio',
  sneaker: 'shoes running gym fitness',
  watch: 'jewelry accessories',
  sweater: 'clothes clothing',
  plant: 'garden houseplant',
  book: 'reading books library',
  mug: 'coffee tea',
  record: 'music vinyl',
  brick: 'lego building',
  controller: 'video games gaming console',
  'jack-o-lantern': 'pumpkin spooky october',
  ghost: 'spooky boo',
  'witch-hat': 'witch costume spooky',
  bat: 'spooky night vampire',
  'candy-corn': 'candy sweets trick treat',
  shamrock: 'clover luck irish',
  'pot-of-gold': 'gold coins luck irish',
  'leprechaun-hat': 'irish hat',
  rainbow: 'pride colorful weather',
  'love-letter': 'love note mail',
  chocolates: 'candy sweets love',
  rose: 'flower love romance',
  turkey: 'dinner feast',
  pie: 'dessert baking',
  cornucopia: 'harvest feast fall',
  menorah: 'chanukah candles jewish festival lights',
  dreidel: 'chanukah jewish game',
  'star-of-david': 'chanukah jewish',
  blocks: 'kids baby numbers abc',
  robot: 'kids wind up toy',
  teddy: 'kids baby plush stuffed animal',
  duck: 'kids baby bath',
  train: 'kids toy',
  'rocking-horse': 'kids baby toy',
  dinosaur: 'kids dino toy',
  rocket: 'kids space toy',
  'easter-egg': 'spring egg hunt',
  bunny: 'easter rabbit spring',
  chick: 'easter spring baby bird',
  basket: 'easter eggs spring',
  fireworks: 'new year nye fourth 4th july independence celebration',
  'party-hat': 'birthday new year celebration',
  champagne: 'new year nye wedding cheers celebration drinks',
  flag: 'fourth 4th july independence usa america patriotic memorial',
  diya: 'diwali lamp festival lights',
  'paper-lantern': 'lunar new year chinese new year',
  'red-envelope': 'lunar new year chinese new year hongbao money',
  crescent: 'eid ramadan moon',
  fanous: 'eid ramadan lantern',
  bouquet: 'mothers day mom mum mama grandma nana flowers',
  necktie: 'fathers day tie dad papa grandpa',
  grill: 'fathers day barbecue bbq summer cookout dad grandpa',
  'baby-bottle': 'baby shower newborn',
  rattle: 'baby shower newborn',
  stroller: 'baby shower newborn pram',
  onesie: 'baby shower newborn clothes',
  backpack: 'school bag',
  pencil: 'school writing',
  apple: 'school teacher fruit',
  crayons: 'school art kids drawing',
  palette: 'art painting artist crafts',
  guitar: 'music instrument',
  yarn: 'knitting crochet crafts',
  tent: 'camping outdoors hiking',
  'fishing-rod': 'fishing outdoors',
  'soccer-ball': 'football sports',
  basketball: 'sports',
  baseball: 'sports',
  paw: 'pets dog cat puppy kitten kitty',
  bone: 'pets dog puppy',
  fishbowl: 'pets fish goldfish',
  'toy-mouse': 'pets cat kitten kitty',
  whisk: 'kitchen baking cooking',
  'chef-hat': 'kitchen cooking chef',
  'watering-can': 'garden gardening plants',
  candle: 'home decor cozy',
  lipstick: 'makeup beauty cosmetics',
  perfume: 'fragrance beauty skincare',
  handbag: 'purse fashion accessories',
  laptop: 'computer tech',
  phone: 'smartphone mobile tech',
  tablet: 'ipad tech',
  kite: 'kids outdoors toy',
  doll: 'kids toy',
  'toy-car': 'kids car toy',
  puzzle: 'games jigsaw',
  idea: 'ideas lightbulb',
  plane: 'travel trip flight',
  box: 'storage moving packing carton',
  tote: 'storage bin container plastic tub',
  'clear-tub': 'storage bin container plastic tub clear see through transparent',
  crate: 'storage wood wooden box crate',
  'metal-case': 'storage metal toolbox tools footlocker trunk case',
  'fabric-bin': 'storage fabric cloth cube bin canvas',
  drawers: 'storage drawers drawer unit plastic organizer',
  'archive-box': 'storage archive files documents paperwork bankers box',
  duffel: 'storage travel gym bag luggage weekend',
};

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((w) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w));

const SEARCH_INDEX: Array<{ icon: CoverIcon; label: string[]; words: string[] }> = (() => {
  const seen = new Set<CoverIcon>();
  const index: Array<{ icon: CoverIcon; label: string[]; words: string[] }> = [];
  for (const g of COVER_ICON_GROUPS) {
    for (const icon of g.icons) {
      if (seen.has(icon)) continue;
      seen.add(icon);
      const sections = COVER_ICON_GROUPS.filter((x) => x.icons.includes(icon)).map((x) => x.label);
      const label = normalize(COVER_ICON_LABELS[icon]);
      index.push({ icon, label, words: [...label, ...normalize(`${icon} ${sections.join(' ')} ${COVER_ICON_KEYWORDS[icon] ?? ''}`)] });
    }
  }
  return index;
})();

const FILLER_WORDS = new Set(['a', 'an', 'and', 'day', 'for', 'my', 'of', 'our', 'the', 'to']);

/** Icons matching every word of `query` (by word prefix), best label matches first. */
export function searchCoverIcons(query: string): CoverIcon[] {
  const words = normalize(query);
  const meaningful = words.filter((w) => !FILLER_WORDS.has(w));
  const terms = meaningful.length ? meaningful : words;
  if (!terms.length) return [];
  const score = (e: (typeof SEARCH_INDEX)[number]) =>
    terms.every((t) => e.label.some((w) => w.startsWith(t))) ? 0 : terms.every((t) => e.words.some((w) => w.startsWith(t))) ? 1 : -1;
  return SEARCH_INDEX.map((e) => ({ e, s: score(e) }))
    .filter((r) => r.s >= 0)
    .sort((a, b) => a.s - b.s)
    .map((r) => r.e.icon);
}

export const COVER_BACKDROP_LABELS: Record<CoverBackdrop, string> = {
  sky: 'Blue sky',
  blush: 'Blush',
  mint: 'Mint',
  lilac: 'Lilac',
  sunset: 'Sunset',
  spring: 'Spring',
  summer: 'Summer',
  autumn: 'Autumn',
  snow: 'Winter',
  night: 'Starry night',
  confetti: 'Confetti',
  hearts: 'Hearts',
  shamrock: 'Shamrocks',
  spooky: 'Spooky night',
  harvest: 'Harvest',
  hanukkah: 'Festival of lights',
  solid: 'Color',
  gradient: 'Gradient',
};

export const COVER_SOLID_COLORS: Array<{ color: string; label: string }> = [
  { color: '#d6e4fb', label: 'Sky' },
  { color: '#fbd5cb', label: 'Blush' },
  { color: '#d4ecd9', label: 'Mint' },
  { color: '#e3defc', label: 'Lilac' },
  { color: '#fff4dc', label: 'Cream' },
  { color: '#f9d976', label: 'Sunshine' },
  { color: '#e8745b', label: 'Coral' },
  { color: '#4fa3a5', label: 'Teal' },
  { color: '#3f6fb5', label: 'Blue' },
  { color: '#7c6cf0', label: 'Violet' },
  { color: '#1f2f5c', label: 'Navy' },
  { color: '#2f3440', label: 'Charcoal' },
];

export const COVER_GRADIENTS: Array<{ colors: [string, string]; label: string }> = [
  { colors: ['#fbd5cb', '#d6e4fb'], label: 'Cotton candy' },
  { colors: ['#fbd5cb', '#f9d976'], label: 'Peach' },
  { colors: ['#d4ecd9', '#a8d8f0'], label: 'Seafoam' },
  { colors: ['#e3defc', '#f7c4d2'], label: 'Lavender' },
  { colors: ['#f9d976', '#e8745b'], label: 'Citrus' },
  { colors: ['#f6a07a', '#7c6cf0'], label: 'Sunset' },
  { colors: ['#a8d8f0', '#3f6fb5'], label: 'Ocean' },
  { colors: ['#4fa3a5', '#1f5c47'], label: 'Forest' },
  { colors: ['#7c6cf0', '#1f2f5c'], label: 'Twilight' },
  { colors: ['#2f3440', '#1f2f5c'], label: 'Midnight' },
];

/** Scene picker order: cloudy pastels, then the four seasons, then the special ones, then holidays through the year. */
export const COVER_BACKDROP_ORDER: CoverBackdrop[] = [
  'sky',
  'blush',
  'mint',
  'lilac',
  'sunset',
  'spring',
  'summer',
  'autumn',
  'snow',
  'night',
  'confetti',
  'hearts',
  'shamrock',
  'spooky',
  'harvest',
  'hanukkah',
];

const CLOUDY: CoverBackdrop[] = ['sky', 'blush', 'mint', 'lilac', 'sunset'];

export const DEFAULT_COVER_FRAME: CoverFrame = { shape: 'rounded', fill: 'glass', color: '#ffffff' };

export const COVER_FRAME_COLORS: Array<{ color: string; label: string }> = [
  { color: '#ffffff', label: 'White' },
  { color: '#fff4dc', label: 'Cream' },
  { color: '#fbd5cb', label: 'Blush' },
  { color: '#d4ecd9', label: 'Mint' },
  { color: '#d6e4fb', label: 'Sky' },
  { color: '#e3defc', label: 'Lilac' },
  { color: '#f9d976', label: 'Sunshine' },
  { color: '#e8745b', label: 'Coral' },
  { color: '#4fa3a5', label: 'Teal' },
  { color: '#3f6fb5', label: 'Blue' },
  { color: '#1f2f5c', label: 'Navy' },
  { color: '#2f3440', label: 'Charcoal' },
];

function CloudFrame() {
  const puffs = (
    <>
      <circle cx="28" cy="56" r="18" />
      <circle cx="48" cy="36" r="24" />
      <circle cx="72" cy="40" r="20" />
      <circle cx="84" cy="58" r="14" />
      <rect x="16" y="50" width="70" height="24" rx="12" />
    </>
  );
  return (
    <svg className="cover-avatar-cloud" viewBox="6 4 96 76" aria-hidden focusable="false">
      <g>
        <g className="cover-avatar-cloud-edge">{puffs}</g>
        <g fill="var(--frame-color)">{puffs}</g>
      </g>
    </svg>
  );
}

/** The list's icon in its avatar slot: floating, or in a solid or frosted tile, circle or cloud. A cover photo always fills a solid tile. */
export function CoverAvatar({ icon, frame, photo, className }: { icon: CoverIcon; frame?: CoverFrame; photo?: string | null; className?: string }) {
  const f = photo ? { ...DEFAULT_COVER_FRAME, fill: 'solid' as const } : (frame ?? DEFAULT_COVER_FRAME);
  return (
    <div
      className={['cover-avatar', `frame-${f.shape}`, f.shape !== 'none' && `frame-${f.fill}`, className].filter(Boolean).join(' ')}
      style={{ ['--frame-color' as string]: f.color }}
      aria-hidden
    >
      {!photo && f.shape === 'cloud' && <CloudFrame />}
      {photo ? <img src={photo} alt="" referrerPolicy="no-referrer" /> : <span className="cover-avatar-art">{COVER_ICON_ART[icon] ?? COVER_ICON_ART.gift}</span>}
    </div>
  );
}

/** A sensible starting graphic for a list, based on its occasion. */
export function suggestCoverArt(occasion: string, kind: ListKind): CoverArtValue {
  const o = occasion.toLowerCase();
  const art = (icon: CoverIcon, backdrop: CoverBackdrop): CoverArtValue => ({ icon, backdrop, frame: DEFAULT_COVER_FRAME });
  if (/hanukkah|chanukah|hanukah/.test(o)) return art('menorah', 'hanukkah');
  if (/christmas|xmas|holiday|winter/.test(o)) return art('tree', 'night');
  if (/lunar|chinese new/.test(o)) return art('paper-lantern', 'blush');
  if (/new year|\bnye\b/.test(o)) return art('fireworks', 'night');
  if (/diwali|deepavali/.test(o)) return art('diya', 'night');
  if (/\beid\b|ramadan/.test(o)) return art('crescent', 'night');
  if (/birthday|bday/.test(o)) return art('cake', 'confetti');
  if (/wedding|engage|anniversary/.test(o)) return art('ring', 'blush');
  if (/valentine/.test(o)) return art('heart', 'hearts');
  if (/patrick/.test(o)) return art('shamrock', 'shamrock');
  if (/easter/.test(o)) return art('easter-egg', 'spring');
  if (/mother/.test(o)) return art('bouquet', 'spring');
  if (/father/.test(o)) return art('necktie', 'sky');
  if (/july|independence/.test(o)) return art('flag', 'summer');
  if (/graduat/.test(o)) return art('grad-cap', 'sky');
  if (/school/.test(o)) return art('backpack', 'sky');
  if (/house|home|move/.test(o)) return art('house', 'mint');
  if (/halloween/.test(o)) return art('jack-o-lantern', 'spooky');
  if (/thanksgiving/.test(o)) return art('turkey', 'harvest');
  if (/autumn|fall/.test(o)) return art('pumpkin', 'autumn');
  if (/spring/.test(o)) return art('flower', 'spring');
  if (/summer|beach|pool/.test(o)) return art('ice-cream', 'summer');
  if (/baby|shower/.test(o)) return art('teddy', 'lilac');
  if (/toy|kid/.test(o)) return art('blocks', 'confetti');
  if (/\bpets?\b|dog|cat|puppy|kitten/.test(o)) return art('paw', 'mint');
  if (/travel|trip|vacation/.test(o)) return art('suitcase', 'sky');
  return defaultCoverArt(kind);
}

/** [x, y, radius] in a 320×180 reference space */
const STARS: Array<[number, number, number]> = [
  [22, 24, 1.6],
  [58, 60, 1.1],
  [96, 18, 1.4],
  [142, 44, 1],
  [186, 16, 1.5],
  [214, 64, 1.1],
  [300, 92, 1.3],
  [36, 104, 1.2],
  [118, 86, 0.9],
  [258, 112, 1],
];
const FLAKES: Array<[number, number, number]> = [
  [18, 20, 3],
  [62, 52, 2.2],
  [104, 14, 2.6],
  [150, 40, 1.8],
  [206, 22, 2.8],
  [246, 58, 2],
  [292, 30, 2.6],
  [40, 92, 2],
  [120, 76, 2.4],
  [272, 96, 2.2],
  [190, 84, 1.6],
];
const CONFETTI: Array<[number, number, number, string]> = [
  [24, 26, 20, '#e8745b'],
  [70, 70, -30, '#4fa3a5'],
  [112, 22, 45, '#f2c14e'],
  [210, 30, -15, '#7c6cf0'],
  [252, 74, 30, '#e8745b'],
  [292, 28, -40, '#5b8fd6'],
  [40, 132, 60, '#f2c14e'],
  [280, 140, 10, '#4fa3a5'],
  [160, 152, -20, '#f19bb0'],
  [92, 150, 35, '#5b8fd6'],
  [232, 150, -50, '#f2c14e'],
];

/** [x, y, size (decor units), rotation, colour] */
const LEAVES: Array<[number, number, number, number, string]> = [
  [30, 40, 13, -30, '#e8745b'],
  [84, 82, 10, 40, '#f2a541'],
  [126, 18, 8, -60, '#c4553d'],
  [212, 22, 9, 20, '#f2c14e'],
  [254, 50, 12, -15, '#e98a3a'],
  [300, 96, 10, 70, '#c4553d'],
  [54, 120, 9, 110, '#f2c14e'],
  [236, 112, 9, -80, '#e8745b'],
];
const CLOVERS: Array<[number, number, number, number, string]> = [
  [30, 40, 12, -20, '#4f9e68'],
  [84, 84, 9, 30, '#76b584'],
  [128, 20, 7, -50, '#3f8a5a'],
  [214, 24, 8, 15, '#76b584'],
  [256, 50, 11, -10, '#4f9e68'],
  [298, 94, 9, 60, '#3f8a5a'],
  [56, 120, 8, 100, '#76b584'],
  [238, 114, 8, -70, '#4f9e68'],
];
const COINS: Array<[number, number, number]> = [
  [62, 30, 2.6],
  [172, 18, 2.2],
  [286, 46, 2.4],
  [110, 104, 2],
];
/** [x, y, width (decor units), rotation] */
const BATS: Array<[number, number, number, number]> = [
  [64, 40, 22, -8],
  [118, 76, 14, 10],
  [204, 32, 17, -14],
];
const SIX_STARS: Array<[number, number, number, string]> = [
  [40, 36, 11, '0s'],
  [110, 82, 7, '-1.1s'],
  [196, 22, 8, '-2s'],
  [282, 56, 10, '-0.6s'],
  [250, 120, 6.5, '-1.6s'],
];
const WHEAT: Array<[number, number, number, number]> = [
  [34, 44, 14, -24],
  [128, 22, 9, 30],
  [256, 46, 12, 18],
  [60, 118, 9, -50],
];
const HARVEST_LEAVES: Array<[number, number, number, number, string]> = [
  [86, 80, 10, 40, '#c4553d'],
  [212, 24, 9, -20, '#e98a3a'],
  [300, 96, 11, 70, '#a5582a'],
  [236, 114, 8, -80, '#f2a541'],
];
const SIX_STAR_PATH = 'M10 1L17.8 14.5H2.2zM10 19L2.2 5.5h15.6z';
const LEAF_PATH = 'M10 1c7 5 9 12 7 17-1.5 3-4 4.5-7 5-3-.5-5.5-2-7-5C1 13 3 6 10 1z';
const CLOVER_LEAF = 'M0 0C-2-1.4-6-3.4-6-6.6a3 3 0 0 1 6-1 3 3 0 0 1 6 1C6-3.4 2-1.4 0 0z';

const BLOSSOMS: Array<[number, number, number, string]> = [
  [32, 40, 11, '#f19bb0'],
  [86, 84, 8, '#fff'],
  [128, 20, 6.5, '#f7c4d2'],
  [214, 24, 7, '#fff'],
  [258, 46, 9, '#fff'],
  [298, 92, 11, '#f19bb0'],
  [56, 120, 7.5, '#f7c4d2'],
  [246, 114, 8, '#f7c4d2'],
];
const HEARTS: Array<[number, number, number, string]> = [
  [34, 42, 12, '#e8745b'],
  [88, 86, 8, '#fff'],
  [128, 20, 6.5, '#f19bb0'],
  [212, 24, 7, '#e8745b'],
  [256, 48, 9, '#fff'],
  [296, 94, 12, '#f19bb0'],
  [58, 122, 8, '#f19bb0'],
  [244, 116, 8, '#fff'],
];
const PETALS = [0, 1, 2, 3, 4].map((k) => {
  const a = ((k * 72 - 90) * Math.PI) / 180;
  return [4.8 * Math.cos(a), 4.8 * Math.sin(a)] as const;
});
const RAYS = Array.from({ length: 12 }, (_, k) => {
  const a = (k * 30 * Math.PI) / 180;
  return `M${(15 * Math.cos(a)).toFixed(2)} ${(15 * Math.sin(a)).toFixed(2)}L${(21 * Math.cos(a)).toFixed(2)} ${(21 * Math.sin(a)).toFixed(2)}`;
}).join('');

function starPoints(cx: number, cy: number, r: number): string {
  return `M${cx} ${cy - r}L${cx + r * 0.3} ${cy - r * 0.3}L${cx + r} ${cy}L${cx + r * 0.3} ${cy + r * 0.3}L${cx} ${cy + r}L${cx - r * 0.3} ${cy + r * 0.3}L${cx - r} ${cy}L${cx - r * 0.3} ${cy - r * 0.3}Z`;
}

/**
 * Pieces are positioned in percent of the cover but sized in `--u`, 1% of the cover's
 * height or of a 16:9 box fitted to its width, whichever is smaller, so wide banners,
 * small cards and tall phone headers all get the same-looking moon, clouds and sprinkles.
 */
const at = (x: number, y: number, extra?: CSSProperties): CSSProperties => ({ left: `${x / 3.2}%`, top: `${y / 1.8}%`, ...extra });
const u = (n: number) => `calc(${n} * var(--u))`;
const dot = (r: number) => `calc(${((r * 2) / 1.8).toFixed(2)} * var(--u) + 1px)`;

const CloudPiece = ({ x, y, w, className }: { x: number; y: number; w: number; className: string }) => (
  <svg className={`cover-piece cover-cloud ${className}`} style={at(x, y, { width: u(w) })} viewBox="20 8 176 96" focusable="false">
    <circle cx="52" cy="70" r="30" />
    <circle cx="92" cy="50" r="40" />
    <circle cx="140" cy="60" r="32" />
    <circle cx="172" cy="80" r="22" />
    <rect x="22" y="70" width="172" height="32" rx="16" />
  </svg>
);

const Twinkle = ({ x, y, w, delay }: { x: number; y: number; w: number; delay?: string }) => (
  <svg className="cover-piece cover-star" style={at(x, y, { width: u(w), animationDelay: delay })} viewBox="-5 -5 10 10" focusable="false">
    <path d={starPoints(0, 0, 5)} />
  </svg>
);

function Decor({ backdrop }: { backdrop: CoverBackdrop }) {
  return (
    <div className="cover-decor">
      {backdrop === 'sunset' && <span className="cover-piece cover-sun" style={at(256, 128, { width: u(44) })} />}
      {/* Default: both sides (mobile title cards center the avatar). Desktop title cards shift cloud-a right via CSS. */}
      {CLOUDY.includes(backdrop) && (
        <>
          <CloudPiece x={30} y={86} w={44} className="cover-cloud-a" />
          <CloudPiece x={292} y={68} w={34} className="cover-cloud-b" />
        </>
      )}
      {backdrop === 'spooky' && (
        <>
          <svg className="cover-piece" style={at(262, 66, { width: u(30) })} viewBox="0 0 40 40" focusable="false">
            <circle cx="20" cy="20" r="19" fill="#f8d57e" />
            <circle cx="13" cy="15" r="3.4" fill="#eebf5c" />
            <circle cx="25" cy="25" r="4.6" fill="#eebf5c" />
            <circle cx="26" cy="11" r="2" fill="#eebf5c" />
          </svg>
          {STARS.slice(0, 7).map(([x, y, r], i) => (
            <span key={i} className="cover-piece cover-dot cover-star" style={at(x, y, { width: dot(r), animationDelay: `${-i * 0.7}s` })} />
          ))}
          <div className="cover-rise">
            {BATS.map(([x, y, w, rot], i) => (
              <svg key={i} className="cover-piece cover-bat" style={at(x, y, { width: u(w), rotate: `${rot}deg`, animationDelay: `${-i * 0.3}s` })} viewBox="3 15 42 17" focusable="false">
                <path d="M24 18c-2 0-3.5 1-4 2.5l-1.5-4-1 4.2C14 18 9 17 4 19c3 2 4 5 3.5 8 2-1.5 4.5-1.5 6 .5 1.5-1.8 4-2 5.5-.5 1.5 2.5 3 4 5 4s3.5-1.5 5-4c1.5-1.5 4-1.3 5.5.5 1.5-2 4-2 6-.5-.5-3 .5-6 3.5-8-5-2-10-1-13.5 1.7l-1-4.2-1.5 4C27.5 19 26 18 24 18z" />
              </svg>
            ))}
          </div>
        </>
      )}
      {backdrop === 'shamrock' && (
        <div className="cover-flakes">
          {CLOVERS.map(([x, y, w, rot, fill], i) => (
            <svg key={i} className="cover-piece" style={at(x, y, { width: u(w), rotate: `${rot}deg` })} viewBox="-10 -10 20 20" focusable="false">
              {[0, -115, 115].map((a) => (
                <path key={a} d={CLOVER_LEAF} transform={`rotate(${a})`} fill={fill} />
              ))}
            </svg>
          ))}
          {COINS.map(([x, y, r], i) => (
            <span key={i} className="cover-piece cover-dot cover-coin" style={at(x, y, { width: dot(r) })} />
          ))}
        </div>
      )}
      {backdrop === 'hanukkah' && (
        <>
          {STARS.map(([x, y, r], i) => (
            <span key={i} className="cover-piece cover-dot cover-star" style={at(x, y, { width: dot(r * 0.8), animationDelay: `${-i * 0.7}s` })} />
          ))}
          {SIX_STARS.map(([x, y, w, delay], i) => (
            <svg key={i} className="cover-piece cover-glow" style={at(x, y, { width: u(w), animationDelay: delay })} viewBox="0 0 20 20" focusable="false">
              <path d={SIX_STAR_PATH} fill="none" stroke="#f6d77a" strokeWidth="1.8" strokeLinejoin="round" />
            </svg>
          ))}
        </>
      )}
      {backdrop === 'harvest' && (
        <div className="cover-flakes">
          {WHEAT.map(([x, y, w, rot], i) => (
            <svg key={i} className="cover-piece" style={at(x, y, { width: u(w), rotate: `${rot}deg` })} viewBox="0 0 20 40" focusable="false">
              <path d="M10 39V8" stroke="#b97a3c" strokeWidth="1.6" strokeLinecap="round" />
              {[10, 16, 22, 28].map((cy) => (
                <g key={cy} fill="#e3a656">
                  <ellipse cx="6.5" cy={cy} rx="2.4" ry="4" transform={`rotate(-30 6.5 ${cy})`} />
                  <ellipse cx="13.5" cy={cy} rx="2.4" ry="4" transform={`rotate(30 13.5 ${cy})`} />
                </g>
              ))}
              <ellipse cx="10" cy="5" rx="2.4" ry="4" fill="#e3a656" />
            </svg>
          ))}
          {HARVEST_LEAVES.map(([x, y, w, rot, fill], i) => (
            <svg key={i} className="cover-piece" style={at(x, y, { width: u(w), rotate: `${rot}deg` })} viewBox="0 0 20 24" focusable="false">
              <path d={LEAF_PATH} fill={fill} />
              <path d="M10 5v18" stroke="rgba(0,0,0,.16)" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          ))}
        </div>
      )}
      {backdrop === 'night' && (
        <>
          <svg className="cover-piece cover-moon" style={at(268, 74, { width: u(24) })} viewBox="-1 1 40 42" focusable="false">
            <path d="M20 2a20 20 0 1 0 18 30 16 16 0 1 1-18-30z" />
          </svg>
          {STARS.map(([x, y, r], i) => (
            <span key={i} className="cover-piece cover-dot cover-star" style={at(x, y, { width: dot(r), animationDelay: `${-i * 0.7}s` })} />
          ))}
          <Twinkle x={70} y={34} w={7} />
          <Twinkle x={214} y={40} w={5.5} delay="-1.4s" />
        </>
      )}
      {backdrop === 'snow' && (
        <div className="cover-flakes">
          {FLAKES.map(([x, y, r], i) => (
            <span key={i} className="cover-piece cover-dot" style={at(x, y, { width: dot(r) })} />
          ))}
        </div>
      )}
      {backdrop === 'autumn' && (
        <div className="cover-flakes">
          {LEAVES.map(([x, y, w, rot, fill], i) => (
            <svg key={i} className="cover-piece" style={at(x, y, { width: u(w), rotate: `${rot}deg` })} viewBox="0 0 20 24" focusable="false">
              <path d="M10 1c7 5 9 12 7 17-1.5 3-4 4.5-7 5-3-.5-5.5-2-7-5C1 13 3 6 10 1z" fill={fill} />
              <path d="M10 5v18" stroke="rgba(0,0,0,.16)" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          ))}
        </div>
      )}
      {backdrop === 'spring' && (
        <div className="cover-flakes">
          {BLOSSOMS.map(([x, y, w, fill], i) => (
            <svg key={i} className="cover-piece" style={at(x, y, { width: u(w) })} viewBox="-10 -10 20 20" focusable="false">
              {PETALS.map(([cx, cy], k) => (
                <circle key={k} cx={cx} cy={cy} r="4.4" fill={fill} />
              ))}
              <circle r="2.6" fill="#f2c14e" />
            </svg>
          ))}
        </div>
      )}
      {backdrop === 'summer' && (
        <>
          <svg className="cover-piece cover-summer-sun" style={at(52, 62, { width: u(40) })} viewBox="-24 -24 48 48" focusable="false">
            <path className="cover-summer-rays" d={RAYS} stroke="#fff3b0" strokeWidth="3" strokeLinecap="round" />
            <circle r="12" fill="#ffd54f" />
            <circle r="12" fill="none" stroke="#fff3b0" strokeWidth="2" opacity=".6" />
          </svg>
          <CloudPiece x={286} y={84} w={32} className="cover-cloud-b" />
          <svg className="cover-piece cover-gull" style={at(236, 34, { width: u(9) })} viewBox="0 0 14 6" focusable="false">
            <path d="M1 5q3-4 6 0q3-4 6 0" />
          </svg>
          <svg className="cover-piece cover-gull" style={at(266, 52, { width: u(6.5) })} viewBox="0 0 14 6" focusable="false">
            <path d="M1 5q3-4 6 0q3-4 6 0" />
          </svg>
        </>
      )}
      {backdrop === 'hearts' && (
        <div className="cover-rise">
          {HEARTS.map(([x, y, w, fill], i) => (
            <svg key={i} className="cover-piece" style={at(x, y, { width: u(w) })} viewBox="0 0 20 18" focusable="false">
              <path d="M10 17.5L2.2 10A4.9 4.9 0 0 1 9.2 3.1l.8.8.8-.8A4.9 4.9 0 0 1 17.8 10z" fill={fill} />
            </svg>
          ))}
        </div>
      )}
      {backdrop === 'confetti' &&
        CONFETTI.map(([x, y, rot, fill], i) => (
          <span
            key={i}
            className={`cover-piece ${i % 3 === 2 ? 'cover-dot' : 'cover-confetti'}`}
            style={at(x, y, { background: fill, rotate: `${rot}deg`, width: u(i % 3 === 2 ? 3.8 : 6.8) })}
          />
        ))}
    </div>
  );
}

/** A list cover drawn as an illustration on a backdrop, or on the owner's own colour or gradient. `sm` drops the decoration for tiny thumbnails. */
export function CoverArt({
  art,
  size = 'md',
  showIcon = true,
  className,
}: {
  art: CoverArtValue;
  size?: 'sm' | 'md';
  showIcon?: boolean;
  className?: string;
}) {
  const paint = coverPaint(art);
  const scene = size === 'md' && !paint;
  const showBank = scene && art.backdrop !== 'confetti';
  return (
    <div
      className={['cover-art', `cover-bg-${art.backdrop}`, `cover-art-${size}`, paint && isDarkCover(art) && 'is-dark', className].filter(Boolean).join(' ')}
      style={paint ? { background: paint } : undefined}
      aria-hidden
    >
      {scene && <Decor backdrop={art.backdrop} />}
      {showBank && <CloudBank className="cover-bank" />}
      {showIcon &&
        (size === 'md' ? (
          <CoverAvatar className="cover-art-avatar" icon={art.icon} frame={art.frame} />
        ) : (
          <span className="cover-art-icon">{COVER_ICON_ART[art.icon] ?? COVER_ICON_ART.gift}</span>
        ))}
    </div>
  );
}
