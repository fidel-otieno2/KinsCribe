import { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkTheme, lightTheme } from '../theme';

const ThemeContext = createContext();

const THEME_KEY = 'ks_theme_mode';

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme(); // 'dark' | 'light' | null
  const [mode, setMode] = useState('dark'); // 'dark' | 'light' | 'system'
  const [loaded, setLoaded] = useState(false);

  // Load saved preference on mount
  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then(saved => {
      if (saved) setMode(saved);
      else setMode('dark'); // default to dark
      setLoaded(true);
    });
  }, []);

  const toggleTheme = async () => {
    const next = mode === 'dark' ? 'light' : 'dark';
    setMode(next);
    await AsyncStorage.setItem(THEME_KEY, next);
  };

  const setThemeMode = async (newMode) => {
    setMode(newMode);
    await AsyncStorage.setItem(THEME_KEY, newMode);
  };

  // Resolve actual theme
  const resolvedMode = mode === 'system'
    ? (systemScheme === 'light' ? 'light' : 'dark')
    : mode;

  const theme = resolvedMode === 'light' ? lightTheme : darkTheme;
  const isDark = resolvedMode === 'dark';

  return (
    <ThemeContext.Provider value={{ theme, mode, isDark, toggleTheme, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
