import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import { en } from "./locales/en";
import { zh } from "./locales/zh";

export const LANGUAGE_STORAGE_KEY = "bifrost_language";
export const SUPPORTED_LANGUAGES = ["en", "zh"] as const;

i18n
	.use(LanguageDetector)
	.use(initReactI18next)
	.init({
		resources: {
			en: { translation: en },
			zh: { translation: zh },
		},
		fallbackLng: "en",
		supportedLngs: SUPPORTED_LANGUAGES,
		load: "languageOnly",
		defaultNS: "translation",
		ns: ["translation"],
		interpolation: {
			escapeValue: false,
		},
		detection: {
			order: ["localStorage"],
			lookupLocalStorage: LANGUAGE_STORAGE_KEY,
			caches: ["localStorage"],
		},
		react: {
			useSuspense: false,
		},
	});

export default i18n;