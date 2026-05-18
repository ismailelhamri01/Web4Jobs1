import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import translationFR from './locales/fr.json';
import translationEN from './locales/en.json';

const resources = {
  fr: {
    translation: translationFR
  },
  en: {
    translation: translationEN
  }
};

const urlParams = new URLSearchParams(window.location.search);
const langParam = urlParams.get('lang') || 'fr';

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: langParam,
    fallbackLng: 'fr',
    nsSeparator: false,
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
