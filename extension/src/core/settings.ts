import { DEFAULT_EXTENSION_SETTINGS, type AdapterName, type ExtensionSettings } from './types';
import { clampInteger } from './utils';

const SETTINGS_KEY = 'fkb-settings';

function normalizeCompanionUrl(value: unknown): string {
  if (value === '') return '';
  if (typeof value !== 'string') return DEFAULT_EXTENSION_SETTINGS.companionUrl;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]', '::1'].includes(url.hostname)) {
      return DEFAULT_EXTENSION_SETTINGS.companionUrl;
    }
    return url.href.replace(/\/$/, '');
  } catch {
    return DEFAULT_EXTENSION_SETTINGS.companionUrl;
  }
}

function normalizeSettings(value: Partial<ExtensionSettings> | null | undefined): ExtensionSettings {
  const adapterNames: AdapterName[] = ['auto', '4pda', 'generic-forum', 'generic-article', 'manual-selection'];
  return {
    companionUrl: normalizeCompanionUrl(value?.companionUrl),
    adapterName: adapterNames.includes(value?.adapterName as AdapterName)
      ? (value?.adapterName as AdapterName)
      : DEFAULT_EXTENSION_SETTINGS.adapterName,
    backgroundCheckEnabled: value?.backgroundCheckEnabled === true,
    maxPages: clampInteger(value?.maxPages, 1, 50, DEFAULT_EXTENSION_SETTINGS.maxPages),
    delayMs: clampInteger(value?.delayMs, 0, 30_000, DEFAULT_EXTENSION_SETTINGS.delayMs),
    imageMode:
      value?.imageMode === 'all' || value?.imageMode === 'keywords' || value?.imageMode === 'manual'
        ? value.imageMode
        : 'links',
    imageKeywords: Array.isArray(value?.imageKeywords)
      ? value.imageKeywords
          .filter((item): item is string => typeof item === 'string')
          .map((item) => item.trim())
          .filter(Boolean)
      : [],
    downloadImages: value?.downloadImages === true,
  };
}

export async function getSettings(): Promise<ExtensionSettings> {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  return normalizeSettings(stored[SETTINGS_KEY] as Partial<ExtensionSettings> | undefined);
}

export async function saveSettings(settings: ExtensionSettings): Promise<ExtensionSettings> {
  const normalized = normalizeSettings(settings);
  await chrome.storage.local.set({ [SETTINGS_KEY]: normalized });
  return normalized;
}
