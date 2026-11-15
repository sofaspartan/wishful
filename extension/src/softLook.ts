/** Soft classic washes for the popup — kept separate from storage so the content script stays React-free. */

export const SOFT_LOOKS = ['plain', 'sky', 'blush', 'kraft'] as const;
export type SoftLook = (typeof SOFT_LOOKS)[number];

export const SOFT_LOOK_LABELS: Record<SoftLook, string> = {
  plain: 'Calm',
  sky: 'Sky',
  blush: 'Blush',
  kraft: 'Kraft',
};

export const SOFT_LOOK_HINTS: Record<SoftLook, string> = {
  plain: 'Soft neutral gray',
  sky: 'Blue wash like list heroes',
  blush: 'Coral wash like collections',
  kraft: 'Warm tan like boxes',
};

export const SOFT_LOOK_TINTS: Record<SoftLook, { tint: string; tint2: string }> = {
  plain: { tint: '#9aa3b5', tint2: '#b7becc' },
  sky: { tint: '#2f6fdc', tint2: '#5b8ee6' },
  blush: { tint: '#e8745b', tint2: '#f08d75' },
  kraft: { tint: '#b88958', tint2: '#c99a6b' },
};

const SOFT_LOOK = 'softLook';
const DEFAULT_SOFT_LOOK: SoftLook = 'sky';

export async function getSoftLook(): Promise<SoftLook> {
  const v = (await chrome.storage.local.get(SOFT_LOOK))[SOFT_LOOK];
  return (SOFT_LOOKS as readonly string[]).includes(v as string) ? (v as SoftLook) : DEFAULT_SOFT_LOOK;
}

export const setSoftLook = (scene: SoftLook) => chrome.storage.local.set({ [SOFT_LOOK]: scene });
