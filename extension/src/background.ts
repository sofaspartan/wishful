/**
 * Service worker: keep toolbar click behavior in sync with the saved display mode
 * (tooltip popup vs Chrome side panel).
 */
import { applyDisplayMode, getDisplayMode, type DisplayMode } from './displayMode';

const sync = async () => {
  try {
    await applyDisplayMode(await getDisplayMode());
  } catch {
    /* sidePanel may be unavailable in some Chromium builds */
  }
};

chrome.runtime.onInstalled.addListener(() => {
  void sync();
});

chrome.runtime.onStartup.addListener(() => {
  void sync();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes.displayMode) return;
  const next = changes.displayMode.newValue as DisplayMode | undefined;
  if (next === 'tooltip' || next === 'sidebar') void applyDisplayMode(next).catch(() => undefined);
});

void sync();
