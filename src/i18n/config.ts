/**
 * i18n Configuration
 * Sets up internationalization with react-i18next
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from '@/i18n/locales/en.json';
import zhTW from '@/i18n/locales/zh-TW.json';
import fr from '@/i18n/locales/fr.json';

const resources = {
  en: { translation: en },
  'zh-TW': { translation: zhTW },
  fr: { translation: fr }
};

i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false
  },
  react: {
    useSuspense: false
  }
});

export default i18n;
