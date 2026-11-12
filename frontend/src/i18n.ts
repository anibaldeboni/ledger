import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { Window } from "@wailsio/runtime";
import en from "./i18n/locales/en/translation.json";
import es from "./i18n/locales/es/translation.json";
import ptBR from "./i18n/locales/pt-BR/translation.json";

export const languageOptions = [
  { code: "pt-BR", name: "Português" },
  { code: "en", name: "English" },
  { code: "es", name: "Español" },
] as const;

const resources = {
  "pt-BR": { translation: ptBR },
  en: { translation: en },
  es: { translation: es },
};

function updateDocumentLanguage() {
  if (typeof document === "undefined") return;
  document.documentElement.lang = i18n.resolvedLanguage ?? i18n.language;
  const title = i18n.t("app.title");
  document.title = title;
  if ("runtime" in window) void Window.SetTitle(title);
}

i18n.on("languageChanged", updateDocumentLanguage);
void i18n.use(initReactI18next).init({
  resources,
  lng: "pt-BR",
  fallbackLng: "pt-BR",
  supportedLngs: languageOptions.map(({ code }) => code),
  interpolation: { escapeValue: false },
}).then(updateDocumentLanguage);

export default i18n;
