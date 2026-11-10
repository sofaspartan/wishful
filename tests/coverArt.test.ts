import { describe, expect, it } from 'vitest';
import {
  COVER_BACKDROPS,
  COVER_ICONS,
  DEFAULT_GRADIENT,
  DEFAULT_SOLID_COLOR,
  PLAIN_COVER_BACKDROPS,
  coverColors,
  coverPaint,
  isDarkCover,
} from '../shared/types';
import {
  COVER_BACKDROP_LABELS,
  COVER_BACKDROP_ORDER,
  COVER_GRADIENTS,
  COVER_SOLID_COLORS,
  COVER_ICON_ART,
  COVER_ICON_GROUPS,
  COVER_ICON_LABELS,
  searchCoverIcons,
  suggestCoverArt,
} from '../src/components/CoverArt';

describe('cover art catalogue', () => {
  it('draws, labels and lists every icon somewhere in the picker', () => {
    const grouped = new Set(COVER_ICON_GROUPS.flatMap((g) => g.icons));
    for (const icon of COVER_ICONS) {
      expect(COVER_ICON_ART[icon], icon).toBeTruthy();
      expect(COVER_ICON_LABELS[icon], icon).toBeTruthy();
      expect(grouped.has(icon), `${icon} is in a picker group`).toBe(true);
    }
  });

  it('offers every backdrop in the picker', () => {
    expect([...COVER_BACKDROP_ORDER, ...PLAIN_COVER_BACKDROPS].sort()).toEqual([...COVER_BACKDROPS].sort());
    for (const b of COVER_BACKDROPS) expect(COVER_BACKDROP_LABELS[b], b).toBeTruthy();
  });

  it('only offers valid preset colours and gradients', () => {
    const hex = /^#[0-9a-f]{6}$/;
    for (const c of COVER_SOLID_COLORS) expect(c.color).toMatch(hex);
    for (const g of COVER_GRADIENTS) for (const c of g.colors) expect(c).toMatch(hex);
  });
});

describe('plain colour covers', () => {
  it('paints a solid colour or a diagonal gradient, and nothing for scenes', () => {
    expect(coverPaint({ backdrop: 'solid', colors: ['#3f6fb5'] })).toBe('#3f6fb5');
    expect(coverPaint({ backdrop: 'gradient', colors: ['#fbd5cb', '#7c6cf0'] })).toBe('linear-gradient(135deg, #fbd5cb 0%, #7c6cf0 100%)');
    expect(coverPaint({ backdrop: 'night' })).toBeNull();
  });

  it('falls back to default colours when they are missing', () => {
    expect(coverPaint({ backdrop: 'solid' })).toBe(DEFAULT_SOLID_COLOR);
    expect(coverColors({ backdrop: 'gradient' })).toEqual(DEFAULT_GRADIENT);
  });

  it('switches to white text on dark colours only', () => {
    expect(isDarkCover({ backdrop: 'solid', colors: ['#1f2f5c'] })).toBe(true);
    expect(isDarkCover({ backdrop: 'solid', colors: ['#fff4dc'] })).toBe(false);
    expect(isDarkCover({ backdrop: 'gradient', colors: ['#2f3440', '#1f2f5c'] })).toBe(true);
    expect(isDarkCover({ backdrop: 'gradient', colors: ['#fbd5cb', '#d6e4fb'] })).toBe(false);
    expect(isDarkCover({ backdrop: 'night' })).toBe(true);
    expect(isDarkCover({ backdrop: 'sky' })).toBe(false);
    expect(isDarkCover(null)).toBe(false);
  });
});

describe('searchCoverIcons', () => {
  it('finds icons by holiday, occasion and everyday words', () => {
    expect(searchCoverIcons('halloween')).toEqual(expect.arrayContaining(['jack-o-lantern', 'ghost', 'bat', 'witch-hat']));
    expect(searchCoverIcons('dog')).toEqual(expect.arrayContaining(['paw', 'bone']));
    expect(searchCoverIcons('baby')).toEqual(expect.arrayContaining(['baby-bottle', 'rattle', 'stroller']));
    expect(searchCoverIcons('hanukkah')).toEqual(expect.arrayContaining(['menorah', 'dreidel']));
  });

  it('ignores case, apostrophes, plurals and partly typed words', () => {
    expect(searchCoverIcons("St. Patrick's")).toContain('shamrock');
    expect(searchCoverIcons('VALENTINES')).toContain('heart');
    expect(searchCoverIcons('robots')).toContain('robot');
    expect(searchCoverIcons('dino')).toContain('dinosaur');
  });

  it('skips filler words and knows everyday names for occasions', () => {
    expect(searchCoverIcons('4th of July')).toEqual(expect.arrayContaining(['flag', 'fireworks']));
    expect(searchCoverIcons("Mother's Day")).toContain('bouquet');
    expect(searchCoverIcons('grandma')).toContain('bouquet');
    expect(searchCoverIcons('dad')).toContain('necktie');
  });

  it('requires every word to match, ranks name matches first and never repeats an icon', () => {
    const results = searchCoverIcons('easter');
    expect(results[0]).toBe('easter-egg');
    expect(new Set(results).size).toBe(results.length);
    expect(searchCoverIcons('halloween dog')).toEqual([]);
    expect(searchCoverIcons('zzzz')).toEqual([]);
    expect(searchCoverIcons('   ')).toEqual([]);
  });
});

describe('suggestCoverArt', () => {
  it('picks a holiday look from the occasion', () => {
    expect(suggestCoverArt('Halloween party', 'wishlist')).toMatchObject({ icon: 'jack-o-lantern', backdrop: 'spooky' });
    expect(suggestCoverArt('Lunar New Year', 'wishlist')).toMatchObject({ icon: 'paper-lantern' });
    expect(suggestCoverArt('New Year’s Eve', 'wishlist')).toMatchObject({ icon: 'fireworks' });
    expect(suggestCoverArt('Eid', 'wishlist')).toMatchObject({ icon: 'crescent' });
    expect(suggestCoverArt("Heidi's birthday", 'wishlist')).toMatchObject({ icon: 'cake' });
  });
});
