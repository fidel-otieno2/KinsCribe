import { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api/axios';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem('access_token').then((token) => {
      if (token) {
        api.get('/auth/me')
          .then(({ data }) => setUser(data))
          .catch(async () => {
            await AsyncStorage.clear();
          })
          .finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    await AsyncStorage.setItem('access_token', data.access_token);
    await AsyncStorage.setItem('refresh_token', data.refresh_token);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    await AsyncStorage.clear();
    setUser(null);
  };

  const refreshUser = async () => {
    const { data } = await api.get('/auth/me');
    setUser(data);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
