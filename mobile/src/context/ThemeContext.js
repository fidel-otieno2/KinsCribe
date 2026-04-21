import { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkTheme, lightTheme } from '../theme';

const ThemeContext = createContext();

const THEME_KEY    = 'ks_theme_mode';
const FONTSIZE_KEY = 'ks_font_size';
const FONTTYPE_KEY = 'ks_font_type';
const LANG_KEY     = 'ks_language';

// ── Font sizes ────────────────────────────────────────────────
export const FONT_SIZES = [
  { key: 'xs',      label: 'Extra Small', scale: 0.80 },
  { key: 'sm',      label: 'Small',       scale: 0.90 },
  { key: 'md',      label: 'Default',     scale: 1.00 },
  { key: 'lg',      label: 'Large',       scale: 1.15 },
  { key: 'xl',      label: 'Extra Large', scale: 1.30 },
  { key: 'xxl',     label: 'Huge',        scale: 1.50 },
];

// ── Font types ────────────────────────────────────────────────
export const FONT_TYPES = [
  { key: 'default',        label: 'Default',          fontFamily: undefined,          style: {} },
  { key: 'serif',          label: 'Serif',             fontFamily: 'serif',            style: { fontFamily: 'serif' } },
  { key: 'monospace',      label: 'Monospace',         fontFamily: 'monospace',        style: { fontFamily: 'monospace' } },
  { key: 'italic',         label: 'Italic',            fontFamily: undefined,          style: { fontStyle: 'italic' } },
  { key: 'bold',           label: 'Bold',              fontFamily: undefined,          style: { fontWeight: '700' } },
  { key: 'bold-italic',    label: 'Bold Italic',       fontFamily: undefined,          style: { fontWeight: '700', fontStyle: 'italic' } },
  { key: 'light',          label: 'Light',             fontFamily: undefined,          style: { fontWeight: '300' } },
  { key: 'thin',           label: 'Thin',              fontFamily: undefined,          style: { fontWeight: '100' } },
  { key: 'condensed',      label: 'Condensed',         fontFamily: undefined,          style: { letterSpacing: -0.8 } },
  { key: 'wide',           label: 'Wide Spacing',      fontFamily: undefined,          style: { letterSpacing: 1.5 } },
];

// ── Languages ─────────────────────────────────────────────────
export const LANGUAGES = [
  // Africa
  { code: 'sw',  label: 'Kiswahili',          native: 'Kiswahili',          flag: '🇰🇪' },
  { code: 'am',  label: 'Amharic',            native: 'አማርኛ',               flag: '🇪🇹' },
  { code: 'ha',  label: 'Hausa',              native: 'Hausa',              flag: '🇳🇬' },
  { code: 'yo',  label: 'Yoruba',             native: 'Yorùbá',             flag: '🇳🇬' },
  { code: 'ig',  label: 'Igbo',               native: 'Igbo',               flag: '🇳🇬' },
  { code: 'zu',  label: 'Zulu',               native: 'isiZulu',            flag: '🇿🇦' },
  { code: 'xh',  label: 'Xhosa',              native: 'isiXhosa',           flag: '🇿🇦' },
  { code: 'af',  label: 'Afrikaans',          native: 'Afrikaans',          flag: '🇿🇦' },
  { code: 'so',  label: 'Somali',             native: 'Soomaali',           flag: '🇸🇴' },
  { code: 'rw',  label: 'Kinyarwanda',        native: 'Kinyarwanda',        flag: '🇷🇼' },
  { code: 'ln',  label: 'Lingala',            native: 'Lingála',            flag: '🇨🇩' },
  { code: 'mg',  label: 'Malagasy',           native: 'Malagasy',           flag: '🇲🇬' },
  { code: 'sn',  label: 'Shona',              native: 'chiShona',           flag: '🇿🇼' },
  { code: 'ny',  label: 'Chichewa',           native: 'Chichewa',           flag: '🇲🇼' },
  { code: 'st',  label: 'Sesotho',            native: 'Sesotho',            flag: '🇱🇸' },
  { code: 'tn',  label: 'Setswana',           native: 'Setswana',           flag: '🇧🇼' },
  { code: 'om',  label: 'Oromo',              native: 'Afaan Oromoo',       flag: '🇪🇹' },
  { code: 'ti',  label: 'Tigrinya',           native: 'ትግርኛ',               flag: '🇪🇷' },
  { code: 'wo',  label: 'Wolof',              native: 'Wolof',              flag: '🇸🇳' },
  { code: 'ff',  label: 'Fula',               native: 'Fulfulde',           flag: '🇬🇳' },
  // Europe
  { code: 'en',  label: 'English',            native: 'English',            flag: '🇬🇧' },
  { code: 'fr',  label: 'French',             native: 'Français',           flag: '🇫🇷' },
  { code: 'de',  label: 'German',             native: 'Deutsch',            flag: '🇩🇪' },
  { code: 'es',  label: 'Spanish',            native: 'Español',            flag: '🇪🇸' },
  { code: 'pt',  label: 'Portuguese',         native: 'Português',          flag: '🇵🇹' },
  { code: 'it',  label: 'Italian',            native: 'Italiano',           flag: '🇮🇹' },
  { code: 'nl',  label: 'Dutch',              native: 'Nederlands',         flag: '🇳🇱' },
  { code: 'pl',  label: 'Polish',             native: 'Polski',             flag: '🇵🇱' },
  { code: 'ru',  label: 'Russian',            native: 'Русский',            flag: '🇷🇺' },
  { code: 'uk',  label: 'Ukrainian',          native: 'Українська',         flag: '🇺🇦' },
  { code: 'cs',  label: 'Czech',              native: 'Čeština',            flag: '🇨🇿' },
  { code: 'sk',  label: 'Slovak',             native: 'Slovenčina',         flag: '🇸🇰' },
  { code: 'ro',  label: 'Romanian',           native: 'Română',             flag: '🇷🇴' },
  { code: 'hu',  label: 'Hungarian',          native: 'Magyar',             flag: '🇭🇺' },
  { code: 'sv',  label: 'Swedish',            native: 'Svenska',            flag: '🇸🇪' },
  { code: 'no',  label: 'Norwegian',          native: 'Norsk',              flag: '🇳🇴' },
  { code: 'da',  label: 'Danish',             native: 'Dansk',              flag: '🇩🇰' },
  { code: 'fi',  label: 'Finnish',            native: 'Suomi',              flag: '🇫🇮' },
  { code: 'el',  label: 'Greek',              native: 'Ελληνικά',           flag: '🇬🇷' },
  { code: 'bg',  label: 'Bulgarian',          native: 'Български',          flag: '🇧🇬' },
  { code: 'hr',  label: 'Croatian',           native: 'Hrvatski',           flag: '🇭🇷' },
  { code: 'sr',  label: 'Serbian',            native: 'Српски',             flag: '🇷🇸' },
  { code: 'lt',  label: 'Lithuanian',         native: 'Lietuvių',           flag: '🇱🇹' },
  { code: 'lv',  label: 'Latvian',            native: 'Latviešu',           flag: '🇱🇻' },
  { code: 'et',  label: 'Estonian',           native: 'Eesti',              flag: '🇪🇪' },
  { code: 'sl',  label: 'Slovenian',          native: 'Slovenščina',        flag: '🇸🇮' },
  { code: 'ca',  label: 'Catalan',            native: 'Català',             flag: '🇪🇸' },
  { code: 'gl',  label: 'Galician',           native: 'Galego',             flag: '🇪🇸' },
  { code: 'eu',  label: 'Basque',             native: 'Euskara',            flag: '🇪🇸' },
  { code: 'cy',  label: 'Welsh',              native: 'Cymraeg',            flag: '🏴󠁧󠁢󠁷󠁬󠁳󠁿' },
  { code: 'ga',  label: 'Irish',              native: 'Gaeilge',            flag: '🇮🇪' },
  { code: 'is',  label: 'Icelandic',          native: 'Íslenska',           flag: '🇮🇸' },
  { code: 'mt',  label: 'Maltese',            native: 'Malti',              flag: '🇲🇹' },
  { code: 'lb',  label: 'Luxembourgish',      native: 'Lëtzebuergesch',     flag: '🇱🇺' },
  { code: 'mk',  label: 'Macedonian',         native: 'Македонски',         flag: '🇲🇰' },
  { code: 'sq',  label: 'Albanian',           native: 'Shqip',              flag: '🇦🇱' },
  { code: 'be',  label: 'Belarusian',         native: 'Беларуская',         flag: '🇧🇾' },
  // Asia
  { code: 'zh',  label: 'Chinese (Simplified)',  native: '中文 (简体)',      flag: '🇨🇳' },
  { code: 'zh-TW', label: 'Chinese (Traditional)', native: '中文 (繁體)',   flag: '🇹🇼' },
  { code: 'ja',  label: 'Japanese',           native: '日本語',              flag: '🇯🇵' },
  { code: 'ko',  label: 'Korean',             native: '한국어',              flag: '🇰🇷' },
  { code: 'hi',  label: 'Hindi',              native: 'हिन्दी',              flag: '🇮🇳' },
  { code: 'bn',  label: 'Bengali',            native: 'বাংলা',               flag: '🇧🇩' },
  { code: 'ur',  label: 'Urdu',               native: 'اردو',               flag: '🇵🇰' },
  { code: 'ar',  label: 'Arabic',             native: 'العربية',            flag: '🇸🇦' },
  { code: 'fa',  label: 'Persian (Farsi)',     native: 'فارسی',              flag: '🇮🇷' },
  { code: 'tr',  label: 'Turkish',            native: 'Türkçe',             flag: '🇹🇷' },
  { code: 'vi',  label: 'Vietnamese',         native: 'Tiếng Việt',         flag: '🇻🇳' },
  { code: 'th',  label: 'Thai',               native: 'ภาษาไทย',            flag: '🇹🇭' },
  { code: 'id',  label: 'Indonesian',         native: 'Bahasa Indonesia',   flag: '🇮🇩' },
  { code: 'ms',  label: 'Malay',              native: 'Bahasa Melayu',      flag: '🇲🇾' },
  { code: 'tl',  label: 'Filipino',           native: 'Filipino',           flag: '🇵🇭' },
  { code: 'ta',  label: 'Tamil',              native: 'தமிழ்',               flag: '🇮🇳' },
  { code: 'te',  label: 'Telugu',             native: 'తెలుగు',              flag: '🇮🇳' },
  { code: 'ml',  label: 'Malayalam',          native: 'മലയാളം',             flag: '🇮🇳' },
  { code: 'kn',  label: 'Kannada',            native: 'ಕನ್ನಡ',               flag: '🇮🇳' },
  { code: 'gu',  label: 'Gujarati',           native: 'ગુજરાતી',             flag: '🇮🇳' },
  { code: 'mr',  label: 'Marathi',            native: 'मराठी',               flag: '🇮🇳' },
  { code: 'pa',  label: 'Punjabi',            native: 'ਪੰਜਾਬੀ',              flag: '🇮🇳' },
  { code: 'ne',  label: 'Nepali',             native: 'नेपाली',              flag: '🇳🇵' },
  { code: 'si',  label: 'Sinhala',            native: 'සිංහල',               flag: '🇱🇰' },
  { code: 'my',  label: 'Burmese',            native: 'မြန်မာဘာသာ',          flag: '🇲🇲' },
  { code: 'km',  label: 'Khmer',              native: 'ភាសាខ្មែរ',            flag: '🇰🇭' },
  { code: 'lo',  label: 'Lao',                native: 'ພາສາລາວ',             flag: '🇱🇦' },
  { code: 'ka',  label: 'Georgian',           native: 'ქართული',             flag: '🇬🇪' },
  { code: 'hy',  label: 'Armenian',           native: 'Հայերեն',             flag: '🇦🇲' },
  { code: 'az',  label: 'Azerbaijani',        native: 'Azərbaycan',         flag: '🇦🇿' },
  { code: 'kk',  label: 'Kazakh',             native: 'Қазақша',             flag: '🇰🇿' },
  { code: 'uz',  label: 'Uzbek',              native: "O'zbek",             flag: '🇺🇿' },
  { code: 'tk',  label: 'Turkmen',            native: 'Türkmen',            flag: '🇹🇲' },
  { code: 'ky',  label: 'Kyrgyz',             native: 'Кыргызча',           flag: '🇰🇬' },
  { code: 'tg',  label: 'Tajik',              native: 'Тоҷикӣ',             flag: '🇹🇯' },
  { code: 'mn',  label: 'Mongolian',          native: 'Монгол',             flag: '🇲🇳' },
  { code: 'he',  label: 'Hebrew',             native: 'עברית',              flag: '🇮🇱' },
  { code: 'ps',  label: 'Pashto',             native: 'پښتو',               flag: '🇦🇫' },
  { code: 'ku',  label: 'Kurdish',            native: 'Kurdî',              flag: '🏳️' },
  // Americas
  { code: 'pt-BR', label: 'Portuguese (Brazil)', native: 'Português (Brasil)', flag: '🇧🇷' },
  { code: 'es-MX', label: 'Spanish (Mexico)',    native: 'Español (México)',   flag: '🇲🇽' },
  { code: 'qu',  label: 'Quechua',            native: 'Runasimi',           flag: '🇵🇪' },
  { code: 'gn',  label: 'Guaraní',            native: "Avañe'ẽ",           flag: '🇵🇾' },
  { code: 'ht',  label: 'Haitian Creole',     native: 'Kreyòl ayisyen',     flag: '🇭🇹' },
  // Pacific / Other
  { code: 'mi',  label: 'Māori',              native: 'Te Reo Māori',       flag: '🇳🇿' },
  { code: 'haw', label: 'Hawaiian',           native: 'ʻŌlelo Hawaiʻi',    flag: '🇺🇸' },
  { code: 'sm',  label: 'Samoan',             native: 'Gagana Samoa',       flag: '🇼🇸' },
  { code: 'to',  label: 'Tongan',             native: 'Lea faka-Tonga',     flag: '🇹🇴' },
  { code: 'fj',  label: 'Fijian',             native: 'Vosa Vakaviti',      flag: '🇫🇯' },
];

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  const [mode, setMode]           = useState('dark');
  const [fontSize, setFontSize]   = useState('md');
  const [fontType, setFontType]   = useState('default');
  const [language, setLanguage]   = useState('en');
  const [loaded, setLoaded]       = useState(false);

  useEffect(() => {
    AsyncStorage.multiGet([THEME_KEY, FONTSIZE_KEY, FONTTYPE_KEY, LANG_KEY]).then(pairs => {
      const map = Object.fromEntries(pairs.map(([k, v]) => [k, v]));
      if (map[THEME_KEY])    setMode(map[THEME_KEY]);
      if (map[FONTSIZE_KEY]) setFontSize(map[FONTSIZE_KEY]);
      if (map[FONTTYPE_KEY]) setFontType(map[FONTTYPE_KEY]);
      if (map[LANG_KEY])     setLanguage(map[LANG_KEY]);
      setLoaded(true);
    });
  }, []);

  const setThemeMode = async (newMode) => {
    setMode(newMode);
    await AsyncStorage.setItem(THEME_KEY, newMode);
  };

  const toggleTheme = async () => {
    const next = mode === 'dark' ? 'light' : 'dark';
    setMode(next);
    await AsyncStorage.setItem(THEME_KEY, next);
  };

  const saveFontSize = async (key) => {
    setFontSize(key);
    await AsyncStorage.setItem(FONTSIZE_KEY, key);
  };

  const saveFontType = async (key) => {
    setFontType(key);
    await AsyncStorage.setItem(FONTTYPE_KEY, key);
  };

  const saveLanguage = async (code) => {
    setLanguage(code);
    await AsyncStorage.setItem(LANG_KEY, code);
  };

  const resolvedMode = mode === 'system'
    ? (systemScheme === 'light' ? 'light' : 'dark')
    : mode;

  const theme   = resolvedMode === 'light' ? lightTheme : darkTheme;
  const isDark  = resolvedMode === 'dark';

  // Resolved objects for consumers
  const fontSizeObj = FONT_SIZES.find(f => f.key === fontSize) || FONT_SIZES[2];
  const fontTypeObj = FONT_TYPES.find(f => f.key === fontType) || FONT_TYPES[0];
  const languageObj = LANGUAGES.find(l => l.code === language) || LANGUAGES.find(l => l.code === 'en');

  // Helper: scale a base font size
  const fs = (base) => Math.round(base * fontSizeObj.scale);

  return (
    <ThemeContext.Provider value={{
      theme, mode, isDark, toggleTheme, setThemeMode,
      fontSize, fontSizeObj, saveFontSize, fs,
      fontType, fontTypeObj, saveFontType,
      language, languageObj, saveLanguage,
      loaded,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
