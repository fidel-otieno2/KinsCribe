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

export async function uploadMedia(uri, type = 'image') {
  const token = await AsyncStorage.getItem('access_token');
  const formData = new FormData();
  const ext = type === 'video' ? 'mp4' : 'jpg';
  const mime = type === 'video' ? 'video/mp4' : 'image/jpeg';
  formData.append('file', { uri, name: `media.${ext}`, type: mime });
  const res = await fetch(`${BASE_URL}/messages/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Upload failed');
  return json.url;
}

export async function buildFileEntry(uri, filename, mimeType) {
  if (Platform.OS === 'web') {
    const res = await fetch(uri);
    const blob = await res.blob();
    return new File([blob], filename, { type: mimeType });
  }
  return { uri, name: filename, type: mimeType };
}
