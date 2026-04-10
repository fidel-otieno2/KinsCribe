import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const BASE_URL = 'https://kinscribe-1.onrender.com/api';

/**
 * Upload FormData using XMLHttpRequest — works on both React Native and Expo Web.
 * fetch() with { uri, name, type } objects only works on native, not web.
 */
export function multipartPost(path, formData) {
  return new Promise(async (resolve, reject) => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${BASE_URL}${path}`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      // Do NOT set Content-Type — XHR sets it automatically with boundary for FormData

      xhr.onload = () => {
        try {
          const json = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(json);
          } else {
            reject(new Error(json.error || json.message || `Server error ${xhr.status}`));
          }
        } catch {
          reject(new Error(`Server error ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error('Network error. Check your connection.'));
      xhr.ontimeout = () => reject(new Error('Request timed out.'));
      xhr.timeout = 60000; // 60s for large files

      xhr.send(formData);
    } catch (err) {
      reject(err);
    }
  });
}
