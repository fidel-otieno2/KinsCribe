import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'https://kinscribe-1.onrender.com/api';

/**
 * Upload a FormData payload using native fetch.
 * Axios corrupts the multipart boundary in React Native — native fetch does not.
 */
export async function multipartPost(path, formData) {
  const token = await AsyncStorage.getItem('access_token');
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      // DO NOT set Content-Type — fetch sets it automatically with the correct boundary
    },
    body: formData,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `Server error ${res.status}`);
  return json;
}
