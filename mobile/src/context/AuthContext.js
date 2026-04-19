import { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api/axios';

const AuthContext = createContext();

const ACCOUNTS_KEY = 'saved_accounts'; // [{id, name, username, avatar, email, access_token, refresh_token}]
const ACTIVE_ACCOUNT_KEY = 'active_account_id';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savedAccounts, setSavedAccounts] = useState([]);

  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      await _loadSavedAccounts();
      const activeId = await AsyncStorage.getItem(ACTIVE_ACCOUNT_KEY);
      const token = await AsyncStorage.getItem('access_token');
      
      if (token) {
        const timeout = setTimeout(() => setLoading(false), 8000);
        try {
          const { data } = await api.get('/auth/me');
          setUser(data);
          await _saveAccountToList(data, token);
          if (!activeId) {
            await AsyncStorage.setItem(ACTIVE_ACCOUNT_KEY, data.id.toString());
          }
        } catch {
          await AsyncStorage.clear();
        } finally {
          clearTimeout(timeout);
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  };

  const _loadSavedAccounts = async () => {
    try {
      const raw = await AsyncStorage.getItem(ACCOUNTS_KEY);
      const accounts = raw ? JSON.parse(raw) : [];
      setSavedAccounts(accounts);
      return accounts;
    } catch {
      return [];
    }
  };

  const _saveAccountToList = async (userData, accessToken, refreshToken) => {
    try {
      const raw = await AsyncStorage.getItem(ACCOUNTS_KEY);
      const list = raw ? JSON.parse(raw) : [];
      const at = accessToken || await AsyncStorage.getItem('access_token');
      const rt = refreshToken || await AsyncStorage.getItem('refresh_token');
      
      const entry = {
        id: userData.id,
        name: userData.name,
        username: userData.username,
        avatar: userData.avatar_url,
        email: userData.email,
        access_token: at,
        refresh_token: rt,
        last_active: new Date().toISOString(),
      };
      
      const updated = [entry, ...list.filter(a => a.id !== userData.id)];
      await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(updated));
      setSavedAccounts(updated);
      return updated;
    } catch {
      return [];
    }
  };

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    await AsyncStorage.setItem('access_token', data.access_token);
    await AsyncStorage.setItem('refresh_token', data.refresh_token);
    await AsyncStorage.setItem(ACTIVE_ACCOUNT_KEY, data.user.id.toString());
    setUser(data.user);
    await _saveAccountToList(data.user, data.access_token, data.refresh_token);
    return data.user;
  };

  const loginWithGoogle = async (data) => {
    await AsyncStorage.setItem('access_token', data.access_token);
    await AsyncStorage.setItem('refresh_token', data.refresh_token);
    await AsyncStorage.setItem(ACTIVE_ACCOUNT_KEY, data.user.id.toString());
    setUser(data.user);
    await _saveAccountToList(data.user, data.access_token, data.refresh_token);
    return data.user;
  };

  const switchAccount = async (accountId) => {
    const accounts = await _loadSavedAccounts();
    const account = accounts.find(a => a.id === accountId);
    if (!account || !account.access_token) {
      throw new Error('Account not found or invalid token');
    }

    // Save current account state before switching
    if (user) {
      const currentToken = await AsyncStorage.getItem('access_token');
      const currentRefresh = await AsyncStorage.getItem('refresh_token');
      const updated = accounts.map(a =>
        a.id === user.id
          ? { ...a, access_token: currentToken, refresh_token: currentRefresh }
          : a
      );
      await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(updated));
    }

    // Switch to new account
    await AsyncStorage.setItem('access_token', account.access_token);
    await AsyncStorage.setItem('refresh_token', account.refresh_token);
    await AsyncStorage.setItem(ACTIVE_ACCOUNT_KEY, accountId.toString());

    // Verify token and get fresh user data
    try {
      const { data } = await api.get('/auth/me');
      setUser(data);
      await _saveAccountToList(data, account.access_token, account.refresh_token);
      return data;
    } catch (error) {
      // Token expired or invalid - remove from saved accounts
      await removeAccount(accountId);
      throw new Error('Account session expired. Please log in again.');
    }
  };

  const addAccount = async (email, password) => {
    // Save current session first
    if (user) {
      const currentToken = await AsyncStorage.getItem('access_token');
      const currentRefresh = await AsyncStorage.getItem('refresh_token');
      await _saveAccountToList(user, currentToken, currentRefresh);
    }

    // Login to new account
    const { data } = await api.post('/auth/login', { email, password });
    
    // Check if account already exists
    const accounts = await _loadSavedAccounts();
    const existing = accounts.find(a => a.id === data.user.id);
    if (existing) {
      // Just switch to existing account with new tokens
      await switchAccount(data.user.id);
      return data.user;
    }

    // Add new account and switch to it
    await AsyncStorage.setItem('access_token', data.access_token);
    await AsyncStorage.setItem('refresh_token', data.refresh_token);
    await AsyncStorage.setItem(ACTIVE_ACCOUNT_KEY, data.user.id.toString());
    setUser(data.user);
    await _saveAccountToList(data.user, data.access_token, data.refresh_token);
    return data.user;
  };

  const removeAccount = async (accountId) => {
    const accounts = await _loadSavedAccounts();
    const updated = accounts.filter(a => a.id !== accountId);
    await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(updated));
    setSavedAccounts(updated);

    // If removing current account, switch to another or logout
    if (user?.id === accountId) {
      if (updated.length > 0) {
        await switchAccount(updated[0].id);
      } else {
        await AsyncStorage.clear();
        setUser(null);
      }
    }
  };

  const logout = async () => {
    if (!user) return;

    const accounts = await _loadSavedAccounts();
    const remaining = accounts.filter(a => a.id !== user.id);
    await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(remaining));
    setSavedAccounts(remaining);

    if (remaining.length > 0) {
      // Auto-switch to most recently used account
      const next = remaining.sort((a, b) => 
        new Date(b.last_active || 0) - new Date(a.last_active || 0)
      )[0];
      
      try {
        await switchAccount(next.id);
        return; // Successfully switched
      } catch {
        // If switch fails, continue with full logout
      }
    }

    // Full logout - no other accounts available
    await AsyncStorage.clear();
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const { data } = await api.get('/auth/me');
      setUser(data);
      await _saveAccountToList(data);
      return data;
    } catch (error) {
      // Token might be expired
      throw error;
    }
  };

  const getAllAccounts = () => {
    return savedAccounts.map(account => ({
      ...account,
      isCurrent: user?.id === account.id,
      // Don't expose tokens
      access_token: undefined,
      refresh_token: undefined,
    }));
  };

  return (
    <AuthContext.Provider value={{
      user, loading, savedAccounts: getAllAccounts(),
      login, loginWithGoogle, logout,
      switchAccount, addAccount, removeAccount, refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
