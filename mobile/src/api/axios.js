

const api

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      const refresh = await AsyncStorage.getItem('refresh_token');
      if (refresh) {
        try {
          const { data } = await axios.post(`${api.defaults.baseURL}/auth/refresh`, {}, {
            headers: { Authorization: `Bearer ${refresh}` },
          });
          await AsyncStorage.setItem('access_token', data.access_token);
          err.config.headers.Authorization = `Bearer ${data.access_token}`;
          return api(err.config);
        } catch {
          await AsyncStorage.clear();
        }
      }
    }
    return Promise.reject(err);
  }
);

export default api;
