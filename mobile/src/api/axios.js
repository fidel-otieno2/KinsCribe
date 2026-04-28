import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://kinscribe-1.onrender.com/api';

const api = axios.create({ baseURL: API_URL, timeout: 60000 });

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(p => error ? p.reject(error) : p.resolve(token));
  failedQueue = [];
};

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config;
    if (err.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }
      originalRequest._retry = true;
      isRefreshing = true;
      const refresh = await AsyncStorage.getItem('refresh_token');
      if (refresh) {
        try {
          const { data } = await axios.post(`${API_URL}/auth/refresh`, {}, {
            headers: { Authorization: `Bearer ${refresh}` },
          });
          await AsyncStorage.setItem('access_token', data.access_token);
          originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
          processQueue(null, data.access_token);
          return api(originalRequest);
        } catch (refreshErr) {
          processQueue(refreshErr, null);
          // Only clear auth tokens, preserve biometric and account settings
          await AsyncStorage.multiRemove(['access_token', 'refresh_token', 'active_account_id']);
        } finally {
          isRefreshing = false;
        }
      }
    }
    return Promise.reject(err);
  }
);

export default api;
