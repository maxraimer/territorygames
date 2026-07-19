import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import uk from "./locales/uk.json";
import en from "./locales/en.json";
import ru from "./locales/ru.json";
import es from "./locales/es.json";
import fr from "./locales/fr.json";
import pl from "./locales/pl.json";
import de from "./locales/de.json";

export const SUPPORTED_LANGUAGES = ["uk", "en", "ru", "es", "fr", "pl", "de"];
const LANG_STORAGE_KEY = "territorygames-lang";

function detectLanguage() {
  const stored = localStorage.getItem(LANG_STORAGE_KEY);
  if (stored && SUPPORTED_LANGUAGES.includes(stored)) return stored;

  const browserLang = (navigator.language || "uk").slice(0, 2).toLowerCase();
  if (SUPPORTED_LANGUAGES.includes(browserLang)) return browserLang;

  return "uk";
}

i18next.use(initReactI18next).init({
  resources: {
    uk: { translation: uk },
    en: { translation: en },
    ru: { translation: ru },
    es: { translation: es },
    fr: { translation: fr },
    pl: { translation: pl },
    de: { translation: de },
  },
  lng: detectLanguage(),
  fallbackLng: "uk",
  interpolation: { escapeValue: false },
});

document.documentElement.lang = i18next.language;

export function changeLanguage(lng) {
  if (!SUPPORTED_LANGUAGES.includes(lng)) return;
  localStorage.setItem(LANG_STORAGE_KEY, lng);
  document.documentElement.lang = lng;
  i18next.changeLanguage(lng);
}

export default i18next;
