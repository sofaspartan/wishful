/** How the extension UI opens from the toolbar icon. */
export const DISPLAY_MODES = ['tooltip', 'sidebar'] as const;
export type DisplayMode = (typeof DISPLAY_MODES)[number];

export const DISPLAY_MODE_LABELS: Record<DisplayMode, string> = {
  tooltip: 'Tooltip',
  sidebar: 'Sidebar',
};

export const DISPLAY_MODE_HINTS: Record<DisplayMode, string> = {
  tooltip: 'Compact popup under the toolbar icon',
  sidebar: 'Persistent panel beside the page',
};

const KEY = 'displayMode';
const DEFAULT: DisplayMode = 'tooltip';

export async function getDisplayMode(): Promise<DisplayMode> {
  const v = (await chrome.storage.local.get(KEY))[KEY];
  return (DISPLAY_MODES as readonly string[]).includes(v as string) ? (v as DisplayMode) : DEFAULT;
}

export const setDisplayMode = (mode: DisplayMode) => chrome.storage.local.set({ [KEY]: mode });

/** Apply Chrome action / side-panel behavior for the chosen mode. */
export async function applyDisplayMode(mode: DisplayMode): Promise<void> {
  if (mode === 'sidebar') {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    await chrome.action.setPopup({ popup: '' });
  } else {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
    await chrome.action.setPopup({ popup: 'popup.html' });
  }
}
