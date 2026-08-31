import type { BackgroundRequest, BackgroundResponse } from './core/messages';
import type { ExtensionSettings } from './core/types';

const $ = <T extends HTMLElement>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Не найден элемент ${selector}`);
  return element;
};

const adapterName = $('#adapterName') as HTMLSelectElement;
const maxPages = $('#maxPages') as HTMLInputElement;
const delayMs = $('#delayMs') as HTMLInputElement;
const imageMode = $('#imageMode') as HTMLSelectElement;
const imageKeywords = $('#imageKeywords') as HTMLInputElement;
const downloadImages = $('#downloadImages') as HTMLInputElement;
const companionUrl = $('#companionUrl') as HTMLInputElement;
const settingsStatus = $('#settingsStatus');

async function send(request: BackgroundRequest): Promise<BackgroundResponse> {
  return chrome.runtime.sendMessage<BackgroundResponse>(request);
}

function setStatus(message: string, kind: 'neutral' | 'success' | 'warning' | 'error' = 'neutral'): void {
  settingsStatus.textContent = message;
  settingsStatus.className = `status ${kind}`;
}

function fill(settings: ExtensionSettings): void {
  adapterName.value = settings.adapterName;
  maxPages.value = String(settings.maxPages);
  delayMs.value = String(settings.delayMs);
  imageMode.value = settings.imageMode;
  imageKeywords.value = settings.imageKeywords.join(', ');
  downloadImages.checked = settings.downloadImages;
  companionUrl.value = settings.companionUrl;
}

async function load(): Promise<void> {
  const response = await send({ type: 'get-settings' });
  if (response.ok && 'settings' in response) fill(response.settings);
  else if (!response.ok) setStatus(response.error, 'error');
  else setStatus('Сервис расширения вернул неожиданный ответ.', 'error');
}

$('#saveSettings').addEventListener('click', () => {
  void (async () => {
    const settings: ExtensionSettings = {
      companionUrl: companionUrl.value.trim().replace(/\/$/, ''),
      adapterName: adapterName.value as ExtensionSettings['adapterName'],
      maxPages: Number(maxPages.value),
      delayMs: Number(delayMs.value),
      imageMode: imageMode.value as ExtensionSettings['imageMode'],
      imageKeywords: imageKeywords.value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      downloadImages: downloadImages.checked,
    };
    const response = await send({ type: 'save-settings', settings });
    if (response.ok && 'settings' in response) {
      fill(response.settings);
      setStatus('Настройки сохранены.', 'success');
    } else if (!response.ok) setStatus(response.error, 'error');
    else setStatus('Сервис расширения вернул неожиданный ответ.', 'error');
  })();
});

$('#testCompanion').addEventListener('click', () => {
  void (async () => {
    setStatus('Проверяю локальный сервис…');
    const response = await send({ type: 'test-companion' });
    if (!response.ok) setStatus(response.error, 'warning');
    else if ('message' in response) setStatus(response.message, 'success');
    else setStatus('Companion отвечает.', 'success');
  })();
});

void load().catch((error) => setStatus(error instanceof Error ? error.message : String(error), 'error'));
