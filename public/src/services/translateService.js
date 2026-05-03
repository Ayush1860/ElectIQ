/**
 * @fileoverview Google Cloud Translation service for ElectIQ.
 * Calls the translation Cloud Function proxy — never the API directly.
 * Supports auto-detection, caching, and batch translation.
 * @module services/translateService
 */

import { getIdToken } from './firebaseService.js';
import { trackLanguageChanged } from '../utils/analytics.js';

/**
 * Supported languages with native labels.
 * @constant {Array<{code: string, label: string, nativeLabel: string, flag: string}>}
 */
export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', nativeLabel: 'English', flag: '🇬🇧' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी', flag: '🇮🇳' },
  { code: 'ta', label: 'Tamil', nativeLabel: 'தமிழ்', flag: '🇮🇳' },
  { code: 'te', label: 'Telugu', nativeLabel: 'తెలుగు', flag: '🇮🇳' },
  { code: 'bn', label: 'Bengali', nativeLabel: 'বাংলা', flag: '🇮🇳' },
  { code: 'mr', label: 'Marathi', nativeLabel: 'मराठी', flag: '🇮🇳' },
  { code: 'gu', label: 'Gujarati', nativeLabel: 'ગુજરાતી', flag: '🇮🇳' },
  { code: 'kn', label: 'Kannada', nativeLabel: 'ಕನ್ನಡ', flag: '🇮🇳' },
  { code: 'ml', label: 'Malayalam', nativeLabel: 'മലയാളം', flag: '🇮🇳' },
  { code: 'pa', label: 'Punjabi', nativeLabel: 'ਪੰਜਾਬੀ', flag: '🇮🇳' },
  { code: 'ur', label: 'Urdu', nativeLabel: 'اردو', flag: '🇵🇰' },
  { code: 'es', label: 'Spanish', nativeLabel: 'Español', flag: '🇪🇸' }
];

/** @type {string} Current active language */
let currentLanguage = 'en';

/** @type {Map<string, string>} Translation cache: `${text}:${lang}` → translated */
const translationCache = new Map();

/** @type {string} Cloud Function endpoint */
const TRANSLATE_ENDPOINT = '/api/translate';

/**
 * Translates text to the specified language via Cloud Function proxy.
 *
 * @param {string} text - Text to translate.
 * @param {string} targetLang - Target language code (e.g., 'hi').
 * @param {string} [sourceLang='en'] - Source language code.
 * @returns {Promise<string>} Translated text.
 */
export async function translateText(text, targetLang, sourceLang = 'en') {
  if (!text || targetLang === sourceLang) return text;

  // Check cache
  const cacheKey = `${text}:${targetLang}`;
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey);
  }

  try {
    const idToken = await getIdToken();
    const response = await fetch(TRANSLATE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({
        text,
        targetLang,
        sourceLang
      })
    });

    if (!response.ok) {
      console.warn('[Translate] API error, returning original text');
      return text;
    }

    const data = await response.json();
    const translated = data.translatedText || text;

    // Cache the result
    translationCache.set(cacheKey, translated);

    return translated;
  } catch (error) {
    console.warn('[Translate] Failed:', error.message);
    return text;
  }
}

/**
 * Translates multiple texts in a single batch request.
 *
 * @param {string[]} texts - Array of texts to translate.
 * @param {string} targetLang - Target language code.
 * @returns {Promise<string[]>} Array of translated texts.
 */
export async function translateBatch(texts, targetLang) {
  if (targetLang === 'en') return texts;

  // Check cache for all texts first
  const uncached = [];
  const results = new Array(texts.length);

  texts.forEach((text, i) => {
    const cacheKey = `${text}:${targetLang}`;
    if (translationCache.has(cacheKey)) {
      results[i] = translationCache.get(cacheKey);
    } else {
      uncached.push({ text, index: i });
    }
  });

  if (uncached.length === 0) return results;

  try {
    const idToken = await getIdToken();
    const response = await fetch(TRANSLATE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({
        texts: uncached.map(u => u.text),
        targetLang,
        batch: true
      })
    });

    if (response.ok) {
      const data = await response.json();
      const translations = data.translations || [];

      uncached.forEach((item, i) => {
        const translated = translations[i] || item.text;
        results[item.index] = translated;
        translationCache.set(`${item.text}:${targetLang}`, translated);
      });
    }
  } catch (error) {
    console.warn('[Translate] Batch failed:', error.message);
    // Fill remaining with originals
    uncached.forEach(item => {
      if (!results[item.index]) results[item.index] = item.text;
    });
  }

  return results;
}

/**
 * Sets the active language and updates the HTML lang attribute.
 *
 * @param {string} langCode - Language code to set.
 */
export function setLanguage(langCode) {
  const oldLang = currentLanguage;
  currentLanguage = langCode;

  // Update HTML lang attribute for accessibility
  document.documentElement.setAttribute('lang', langCode);

  // Update text direction for RTL languages
  const rtlLanguages = ['ur', 'ar'];
  document.documentElement.setAttribute('dir', rtlLanguages.includes(langCode) ? 'rtl' : 'ltr');

  // Track language change
  if (oldLang !== langCode) {
    trackLanguageChanged(oldLang, langCode);
  }

  // Dispatch event for components to react
  window.dispatchEvent(new CustomEvent('languagechange', {
    detail: { from: oldLang, to: langCode }
  }));
}

/**
 * Gets the current active language code.
 * @returns {string}
 */
export function getCurrentLanguage() {
  return currentLanguage;
}

/**
 * Detects the user's preferred language from the browser.
 * @returns {string} Best matching supported language code.
 */
export function detectBrowserLanguage() {
  const browserLangs = navigator.languages || [navigator.language];

  for (const lang of browserLangs) {
    const code = lang.split('-')[0].toLowerCase();
    if (SUPPORTED_LANGUAGES.find(l => l.code === code)) {
      return code;
    }
  }

  return 'en';
}
