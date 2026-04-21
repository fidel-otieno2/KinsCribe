import { useCallback } from 'react';
import { useTheme } from '../context/ThemeContext';

import en from './en';
import fr from './fr';
import es from './es';
import de from './de';
import pt from './pt';
import sw from './sw';
import hi from './hi';
import zh from './zh';
import ar from './ar';

// ── Translation map ───────────────────────────────────────────
// Add more languages here as files are created
const TRANSLATIONS = { en, fr, es, de, pt, sw, hi, zh, ar };

// RTL languages
export const RTL_LANGUAGES = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'ku']);

/**
 * useTranslation()
 *
 * Returns a `t(key, vars?)` function that:
 * 1. Looks up the key in the current language
 * 2. Falls back to English if the key is missing
 * 3. Replaces {{variable}} placeholders with values from `vars`
 *
 * Usage:
 *   const { t, isRTL } = useTranslation();
 *   t('home')                          → 'Accueil'  (French)
 *   t('view_all_comments', { count: 5 }) → 'Voir les 5 commentaires'
 */
export function useTranslation() {
  const { language } = useTheme();

  const t = useCallback((key, vars = {}) => {
    const dict = TRANSLATIONS[language] || TRANSLATIONS.en;
    let str = dict[key] ?? TRANSLATIONS.en[key] ?? key;

    // Replace {{variable}} placeholders
    Object.entries(vars).forEach(([k, v]) => {
      str = str.replace(new RegExp(`{{${k}}}`, 'g'), String(v));
    });

    return str;
  }, [language]);

  const isRTL = RTL_LANGUAGES.has(language);

  return { t, isRTL, language };
}

export default TRANSLATIONS;
