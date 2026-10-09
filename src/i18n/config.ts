import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '@/i18n/locales/en.json';
import zhTW from '@/i18n/locales/zh-TW.json';
import type { LanguageSetting } from '@/types/highlight';

export function resolveLanguage(setting: LanguageSetting, browserLanguage: string): 'en' | 'zh-TW' {
  if (setting !== 'auto') return setting;
  return browserLanguage.toLowerCase().startsWith('zh') ? 'zh-TW' : 'en';
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    'zh-TW': { translation: zhTW }
  },
  lng: resolveLanguage('auto', navigator.language),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  react: { useSuspense: false }
});

const applySetting = (setting: LanguageSetting | undefined): void => {
  i18n.changeLanguage(resolveLanguage(setting ?? 'auto', navigator.language));
};

chrome.storage.sync.get('settings').then((data) => applySetting(data.settings?.language));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.settings) applySetting(changes.settings.newValue?.language);
});

export const t = i18n.t.bind(i18n);
export default i18n;
