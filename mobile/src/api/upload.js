import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const BASE_URL = 'https://kinscribe-1.onrender.com/api';

export function multipartPost(path, formData) {
  return new Promise(async (resolve, reject) => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${BASE_URL}${path}`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      xhr.onload = () => {
        try {
          const json = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(json);
          } else {
            reject(new Error(json.error || json.message || `Server error ${xhr.status}: ${xhr.responseText}`));
          }
        } catch {
          reject(new Error(`Server error ${xhr.status}: ${xhr.responseText}`));
        }
      };

      xhr.onerror = () => reject(new Error('Network error. Check your connection.'));
      xhr.ontimeout = () => reject(new Error('Request timed out.'));
      xhr.timeout = 120000;

      xhr.send(formData);
    } catch (err) {
      reject(err);
    }
  });
}

// Convert a URI to a File/Blob for web, or return native object for mobile
export async function buildFileEntry(uri, filename, mimeType) {
  if (Platform.OS === 'web') {
    const res = await fetch(uri);
    const blob = await res.blob();
    return new File([blob], filename, { type: mimeType });
  }
  return { uri, name: filename, type: mimeType };
}
