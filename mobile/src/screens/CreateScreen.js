import { useState, useCallback, useEffect, useRef } from 'react';
import { Audio } from 'expo-av';
import {
  View, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView,
  Platform, Image, Dimensions, Modal, FlatList,
} from 'react-native';
import AppText from '../components/AppText';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from '../i18n';
import api from '../api/axios';
import { colors, radius } from '../theme';
import Toast from '../components/Toast';
import * as Location from 'expo-location';
import useToast from '../hooks/useToast';

const { width } = Dimensions.get('window');

const DRAFT_KEY = '@create_screen_draft';

const MODES = [
  { key: 'post', label: 'Post', icon: 'grid-outline' },
  { key: 'story', label: 'Story', icon: 'time-outline' },
  { key: 'family', label: 'Family', icon: 'people-outline' },
];

const PRIVACY_OPTS = [
  { key: 'public', label: 'Public', icon: 'globe-outline', color: '#3b82f6' },
  { key: 'connections', label: 'Connections', icon: 'people-outline', color: '#7c3aed' },
  { key: 'family', label: 'Family', icon: 'home-outline', color: '#10b981' },
];

const BG_COLORS = ['#7c3aed', '#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#e11d48', '#0f172a'];

// Multiple Audius hosts for fallback
const DEEZER_API = 'https://api.deezer.com';

const QUICK_SEARCHES = [
  { label: 'Trending', query: 'trending', icon: '🔥' },
  { label: 'Afrobeats', query: 'afrobeats', icon: '🌍' },
  { label: 'Amapiano', query: 'amapiano', icon: '🎹' },
  { label: 'Hip Hop', query: 'hip hop', icon: '🎤' },
  { label: 'EDM', query: 'edm', icon: '🎚️' },
  { label: 'Gospel', query: 'gospel', icon: '🙏' },
  { label: 'Drill', query: 'drill', icon: '⚡' },
  { label: 'R&B', query: 'rnb', icon: '❤️' },
  { label: 'Jazz', query: 'jazz', icon: '🎺' },
  { label: 'Lofi', query: 'lofi', icon: '🎧' },
  { label: 'Reggae', query: 'reggae', icon: '🌴' },
  { label: 'Rock', query: 'rock', icon: '🤘' },
  { label: 'Classical', query: 'classical', icon: '🎻' },
  { label: 'Trap', query: 'trap', icon: '🔥' },
  { label: 'Dancehall', query: 'dancehall', icon: '💃' },
  { label: 'Soul', query: 'soul', icon: '💋' },
  { label: 'Chill', query: 'chill vibes', icon: '🌿' },
  { label: 'Party', query: 'party', icon: '🎉' },
  { label: 'Sad', query: 'sad emotional', icon: '💔' },
  { label: 'Workout', query: 'workout gym', icon: '💪' },
];

export default function CreateScreen({ navigation, route }) {
  const { user } = useAuth();
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();
  const { toast, hide, success, error, info } = useToast();

  // Core state
  const [mode, setMode] = useState(route?.params?.initialMode || 'post');

  // Handle media captured from StoryCameraScreen
  useEffect(() => {
    if (route?.params?.capturedMedia) {
      const { uri, type } = route.params.capturedMedia;
      setMediaFiles([{ uri, type: type === 'video' ? 'video/mp4' : 'image/jpeg', mediaType: type }]);
    }
  }, [route?.params?.capturedMedia]);
  const [mediaFiles, setMediaFiles] = useState([]);
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [locationResults, setLocationResults] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const locationTimer = useRef(null);
  const [hashtags, setHashtags] = useState('');
  const [privacy, setPrivacy] = useState('public');
  const [loading, setLoading] = useState(false);
  const [altText, setAltText] = useState('');
  const [collaborators, setCollaborators] = useState([]);
  const [collabSearch, setCollabSearch] = useState('');
  const [collabResults, setCollabResults] = useState([]);
  const [searchingCollab, setSearchingCollab] = useState(false);
  const [showCollabSearch, setShowCollabSearch] = useState(false);
  const collabSearchTimer = useRef(null);

  // AI state
  const [toneResult, setToneResult] = useState(null);
  const [checkingTone, setCheckingTone] = useState(false);
  const [generatingCaption, setGeneratingCaption] = useState(false);
  const [hashtagSuggestions, setHashtagSuggestions] = useState([]);
  const [loadingHashtags, setLoadingHashtags] = useState(false);
  const [hashtagCount, setHashtagCount] = useState('balanced');
  const [showHashtagPanel, setShowHashtagPanel] = useState(false);
  const [captionOptions, setCaptionOptions] = useState([]);
  const [showCaptionPanel, setShowCaptionPanel] = useState(false);
  const [selectedTone, setSelectedTone] = useState('warm');
  const [captionLength, setCaptionLength] = useState('medium');
  const [emojiLevel, setEmojiLevel] = useState('minimal');

  // Draft state
  const [draftSaved, setDraftSaved] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const draftTimer = useRef(null);

  // ─── MUSIC STATE ─────────────────────────────────────────────────
  const [showMusicModal, setShowMusicModal] = useState(false);
  const [selectedMusic, setSelectedMusic] = useState(null);
  const [musicSearch, setMusicSearch] = useState('');
  const [musicTracks, setMusicTracks] = useState([]);
  const [musicLoading, setMusicLoading] = useState(false);
  const [playingTrackId, setPlayingTrackId] = useState(null);   // track being previewed
  const [suggestingMusic, setSuggestingMusic] = useState(false);
  const [activeQuick, setActiveQuick] = useState('Trending');
  // Snippet / trim state
  const [snippetTrack, setSnippetTrack] = useState(null);       // track open in snippet selector
  const [snippetStart, setSnippetStart] = useState(0);          // seconds
  const [trackDuration, setTrackDuration] = useState(0);        // seconds
  const [snippetPlaying, setSnippetPlaying] = useState(false);
  const musicSoundRef = useRef(null);
  const musicSearchTimer = useRef(null);
  const snippetTimer = useRef(null);

  // Schedule state
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [scheduledDate, setScheduledDate] = useState(null);
  const [pickerDay, setPickerDay] = useState(new Date().getDate());
  const [pickerMonth, setPickerMonth] = useState(new Date().getMonth());
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const [pickerHour, setPickerHour] = useState(new Date().getHours());
  const [pickerMinute, setPickerMinute] = useState(0);

  // Story state
  const [textContent, setTextContent] = useState('');
  const [bgColor, setBgColor] = useState('#7c3aed');

  // Family story state
  const [familyTitle, setFamilyTitle] = useState('');
  const [familyContent, setFamilyContent] = useState('');
  const [storyDate, setStoryDate] = useState('');
  const [familyPrivacy, setFamilyPrivacy] = useState('family');

  // ─── ON MOUNT ───────────────────────────────────────────────────
  useEffect(() => {
    checkExistingDraft();
    Audio.setAudioModeAsync({ playsInSilentModeIOS: true, allowsRecordingIOS: false });
    return () => { stopAllAudio(); };
  }, []);

  // ─── DRAFT SYSTEM ───────────────────────────────────────────────
  const checkExistingDraft = async () => {
    try {
      const raw = await AsyncStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft.caption || draft.hashtags || draft.location) {
          setHasDraft(true);
          setShowDraftBanner(true);
        }
      }
    } catch {}
  };

  const loadDraft = async () => {
    try {
      const raw = await AsyncStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft.caption) setCaption(draft.caption);
      if (draft.hashtags) setHashtags(draft.hashtags);
      if (draft.location) setLocation(draft.location);
      if (draft.privacy) setPrivacy(draft.privacy);
      if (draft.altText) setAltText(draft.altText);
      if (draft.mode) setMode(draft.mode);
      setShowDraftBanner(false);
      setHasDraft(false);
      info('Draft restored');
    } catch {}
  };

  const discardDraft = async () => {
    await AsyncStorage.removeItem(DRAFT_KEY);
    setShowDraftBanner(false);
    setHasDraft(false);
  };

  const saveDraft = useCallback(async (data) => {
    try {
      await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(data));
      setDraftSaved(true);
      setTimeout(() => setDraftSaved(false), 2000);
    } catch {}
  }, []);

  useEffect(() => {
    if (!caption && !hashtags && !location) return;
    clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      saveDraft({ caption, hashtags, location, privacy, altText, mode });
    }, 2000);
    return () => clearTimeout(draftTimer.current);
  }, [caption, hashtags, location, privacy, altText, mode]);

  // ─── AI: TONE CHECK ─────────────────────────────────────────────
  const toneTimer = useRef(null);
  const checkTone = useCallback((text) => {
    clearTimeout(toneTimer.current);
    if (!text || text.length < 20) { setToneResult(null); return; }
    toneTimer.current = setTimeout(async () => {
      setCheckingTone(true);
      try {
        const { data } = await api.post('/ai/tone-check', { text });
        setToneResult(data);
      } catch {} finally { setCheckingTone(false); }
    }, 800);
  }, []);

  // ─── LOCATION ───────────────────────────────────────────────────
  const searchLocation = (text) => {
    setLocationQuery(text);
    if (!text.trim()) { setSelectedLocation(null); setLocation(''); setLocationResults([]); return; }
    clearTimeout(locationTimer.current);
    if (text.length < 2) { setLocationResults([]); return; }
    locationTimer.current = setTimeout(async () => {
      setLocationLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&limit=6&addressdetails=1`,
          { headers: { 'Accept-Language': 'en', 'User-Agent': 'KinsCribeApp/1.0' } }
        );
        const data = await res.json();
        setLocationResults(data.map(p => ({
          id: p.place_id,
          name: p.display_name.split(',').slice(0, 2).join(', '),
          full: p.display_name,
          lat: parseFloat(p.lat),
          lng: parseFloat(p.lon),
          type: p.type,
        })));
      } catch {} finally { setLocationLoading(false); }
    }, 500);
  };

  const selectLocation = (place) => {
    setSelectedLocation(place);
    setLocation(place.name);
    setLocationQuery(place.name);
    setLocationResults([]);
  };

  const clearLocation = () => {
    setSelectedLocation(null);
    setLocation('');
    setLocationQuery('');
    setLocationResults([]);
  };

  const detectCurrentLocation = async () => {
    setDetectingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { info('Allow location access in settings'); setDetectingLocation(false); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = pos.coords;
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
        { headers: { 'Accept-Language': 'en', 'User-Agent': 'KinsCribeApp/1.0' } }
      );
      const data = await res.json();
      const name = [
        data.address?.suburb || data.address?.neighbourhood || data.address?.quarter,
        data.address?.city || data.address?.town || data.address?.village,
      ].filter(Boolean).join(', ') || data.display_name?.split(',').slice(0, 2).join(', ');
      selectLocation({ id: data.place_id, name, full: data.display_name, lat: latitude, lng: longitude });
    } catch { info('Could not detect location'); }
    finally { setDetectingLocation(false); }
  };

  // ─── AI: CAPTION GENERATOR ──────────────────────────────────────
  const buildContext = () => {
    const hour = new Date().getHours();
    const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'night';
    let parts = [];
    if (mediaFiles.length > 0) {
      const hasVideo = mediaFiles.some(f => f.type === 'video');
      const count = mediaFiles.length;
      parts.push(count > 1 ? `${count} ${hasVideo ? 'media files' : 'photos'}` : hasVideo ? 'a video' : 'a photo');
    }
    if (location) parts.push(`at ${location}`);
    parts.push(`posted in the ${timeOfDay}`);
    if (mode === 'family') parts.push('for a family memory');
    return parts.join(', ') || 'a social media post';
  };

  const generateCaption = async () => {
    setGeneratingCaption(true);
    setShowCaptionPanel(true);
    setCaptionOptions([]);
    try {
      const { data } = await api.post('/ai/caption', {
        context: buildContext(),
        tone: selectedTone,
        length: captionLength,
        emoji: emojiLevel,
        count: 6,
      });
      setCaptionOptions(data.captions || (data.caption ? [data.caption] : []));
    } catch {
      info('Caption generation unavailable');
      setShowCaptionPanel(false);
    } finally { setGeneratingCaption(false); }
  };

  const pickCaption = (text) => {
    setCaption(text);
    setShowCaptionPanel(false);
    checkTone(text);
    suggestHashtagsForCaption(text);
  };

  // ─── AI: HASHTAG SUGGESTIONS ────────────────────────────────────
  const suggestHashtagsForCaption = async (text) => {
    if (!text || text.length < 5) return;
    setLoadingHashtags(true);
    try {
      const countMap = { minimal: 5, balanced: 10, maximum: 25 };
      const { data } = await api.post('/ai/hashtags', {
        caption: text, location, tone: selectedTone, count: countMap[hashtagCount] || 10,
      });
      setHashtagSuggestions(data.hashtags || []);
      if (data.hashtags?.length) setShowHashtagPanel(true);
    } catch {
      setHashtagSuggestions([
        { tag: '#explore', category: 'trending', level: 'high' },
        { tag: '#viral', category: 'trending', level: 'high' },
        { tag: '#photooftheday', category: 'niche', level: 'medium' },
      ]);
    } finally { setLoadingHashtags(false); }
  };

  const suggestHashtags = async () => {
    const text = caption.trim();
    setShowHashtagPanel(true);
    setHashtagSuggestions([]);
    setLoadingHashtags(true);
    try {
      const countMap = { minimal: 5, balanced: 10, maximum: 25 };
      const { data } = await api.post('/ai/hashtags', {
        caption: text || buildContext(), location, tone: selectedTone, count: countMap[hashtagCount] || 10,
      });
      setHashtagSuggestions(data.hashtags || []);
    } catch {
      setHashtagSuggestions([
        { tag: '#explore', category: 'trending', level: 'high' },
        { tag: '#viral', category: 'trending', level: 'high' },
        { tag: '#photooftheday', category: 'niche', level: 'medium' },
      ]);
    } finally { setLoadingHashtags(false); }
  };

  const addHashtag = (tag) => {
    const clean = tag.startsWith('#') ? tag : `#${tag}`;
    if (hashtags.includes(clean)) return;
    setHashtags(prev => prev.trim() ? `${prev.trim()} ${clean}` : clean);
    setHashtagSuggestions(prev => prev.filter(h => h.tag !== clean));
  };

  const addAllHashtags = () => {
    const all = hashtagSuggestions.map(h => h.tag).join(' ');
    setHashtags(prev => prev.trim() ? `${prev.trim()} ${all}` : all);
    setHashtagSuggestions([]);
    setShowHashtagPanel(false);
  };

  // ─── COLLABORATORS ───────────────────────────────────────────────
  const searchCollaborators = (q) => {
    setCollabSearch(q);
    clearTimeout(collabSearchTimer.current);
    if (!q.trim() || q.length < 2) { setCollabResults([]); return; }
    collabSearchTimer.current = setTimeout(async () => {
      setSearchingCollab(true);
      try {
        const { data } = await api.get(`/posts/collab/search?q=${encodeURIComponent(q)}`);
        setCollabResults(data.users || []);
      } catch {} finally { setSearchingCollab(false); }
    }, 400);
  };

  const addCollaborator = (u, role = 'creator') => {
    if (collaborators.find(c => c.id === u.id)) return;
    setCollaborators(prev => [...prev, { ...u, role }]);
    setCollabSearch('');
    setCollabResults([]);
  };

  const removeCollaborator = (id) => setCollaborators(prev => prev.filter(c => c.id !== id));
  const updateCollabRole = (id, role) => setCollaborators(prev => prev.map(c => c.id === id ? { ...c, role } : c));

  // ─── MEDIA PICKER ───────────────────────────────────────────────
  const pickMedia = useCallback(async (allowMultiple = false) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return info('Allow photo access in your device settings');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: allowMultiple,
      quality: 0.9,
    });
    if (!result.canceled) {
      const assets = result.assets || [result];
      const files = assets.map(a => ({
        uri: a.uri,
        type: a.type === 'video' ? 'video' : 'image',
        name: a.fileName || `media_${Date.now()}.jpg`,
      }));
      setMediaFiles(prev => allowMultiple ? [...prev, ...files].slice(0, 10) : files);
    }
  }, []);

  const takePhoto = useCallback(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return info('Allow camera access in your device settings');
    const result = await ImagePicker.launchCameraAsync({ quality: 0.9 });
    if (!result.canceled) {
      const a = result.assets?.[0] || result;
      setMediaFiles([{ uri: a.uri, type: 'image', name: 'photo.jpg' }]);
    }
  }, []);

  const removeMedia = (idx) => setMediaFiles(prev => prev.filter((_, i) => i !== idx));

  const moveMediaLeft = (idx) => {
    if (idx === 0) return;
    setMediaFiles(prev => {
      const arr = [...prev];
      [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
      return arr;
    });
  };

  const moveMediaRight = (idx) => {
    setMediaFiles(prev => {
      if (idx === prev.length - 1) return prev;
      const arr = [...prev];
      [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
      return arr;
    });
  };

  const cropMedia = async (idx) => {
    try {
      const file = mediaFiles[idx];
      const result = await ImageManipulator.manipulateAsync(
        file.uri, [{ resize: { width: 1080 } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
      );
      const updated = [...mediaFiles];
      updated[idx] = { ...file, uri: result.uri };
      setMediaFiles(updated);
      info('Image optimised');
    } catch { info('Could not process image'); }
  };

  // ─── DEEZER MUSIC ────────────────────────────────────────────────
  const stopAllAudio = async () => {
    clearTimeout(snippetTimer.current);
    try {
      if (musicSoundRef.current) {
        await musicSoundRef.current.stopAsync();
        await musicSoundRef.current.unloadAsync();
        musicSoundRef.current = null;
      }
    } catch {}
    setPlayingTrackId(null);
    setSnippetPlaying(false);
  };

  // Build Audius stream URL safely
  // Deezer preview URL is stored directly on the track object
  const getStreamUrl = (track) => track.preview || '';

  // Preview a track (30-sec snippet from snippetStart)
  const togglePreview = async (track) => {
    if (playingTrackId === track.id) {
      await stopAllAudio();
      return;
    }
    await stopAllAudio();

    const url = getStreamUrl(track);
    try {
      const { sound, status } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true, positionMillis: (snippetTrack?.id === track.id ? snippetStart : 0) * 1000 },
        (st) => {
          if (st.isLoaded) {
            if (st.didJustFinish) { setPlayingTrackId(null); setSnippetPlaying(false); }
            if (st.durationMillis && st.durationMillis > 0) {
              setTrackDuration(Math.floor(st.durationMillis / 1000));
            }
          }
        }
      );
      musicSoundRef.current = sound;
      setPlayingTrackId(track.id);

      // Auto-stop after 30 seconds
      snippetTimer.current = setTimeout(() => stopAllAudio(), 30000);
    } catch (e) {
      console.warn('Preview error:', e);
      // Try next host on failure
      info('Could not play preview');
    }
  };

  // Seek to a new start time during snippet selection
  const seekSnippet = async (newStart) => {
    setSnippetStart(newStart);
    if (musicSoundRef.current && playingTrackId === snippetTrack?.id) {
      try {
        await musicSoundRef.current.setPositionAsync(newStart * 1000);
      } catch {}
    }
  };

  // Open snippet selector for a track
  const openSnippetSelector = async (track) => {
    setSnippetTrack(track);
    setSnippetStart(0);
    setTrackDuration(0);
    // Start playing so user hears the snippet
    await togglePreview(track);
  };

  // Confirm track + snippet and add to post
  const selectMusicWithSnippet = async (track, startSec = 0) => {
    await stopAllAudio();
    setSelectedMusic({
      id: track.id,
      title: track.title,
      artist: track.artist?.name || 'Unknown',
      artwork: track.album?.cover_medium || track.album?.cover || null,
      stream_url: track.preview || '',
      start_time: startSec,
      duration: 30,
    });
    setSnippetTrack(null);
    setShowMusicModal(false);
  };

  const fetchTrending = async () => {
    setMusicLoading(true);
    try {
      const res = await fetch(`${DEEZER_API}/chart/0/tracks?limit=25`);
      if (!res.ok) throw new Error('Network error');
      const data = await res.json();
      setMusicTracks(data.data || []);
    } catch {
      info('Could not load trending — check your connection');
      setMusicTracks([]);
    } finally { setMusicLoading(false); }
  };

  const searchAudius = async (query) => {
    if (!query.trim()) { fetchTrending(); return; }
    setMusicLoading(true);
    try {
      const res = await fetch(`${DEEZER_API}/search?q=${encodeURIComponent(query)}&limit=25`);
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      setMusicTracks(data.data || []);
    } catch { info('Search failed'); }
    finally { setMusicLoading(false); }
  };

  const handleMusicSearch = (text) => {
    setMusicSearch(text);
    clearTimeout(musicSearchTimer.current);
    musicSearchTimer.current = setTimeout(() => searchAudius(text), 500);
  };

  const suggestMusicForCaption = async () => {
    setSuggestingMusic(true);
    const query = caption.trim() || selectedTone || 'chill vibes';
    await searchAudius(query);
    setSuggestingMusic(false);
  };

  // Preview selected music inline on main screen
  const toggleSelectedMusicPreview = async () => {
    if (!selectedMusic) return;
    if (playingTrackId === selectedMusic.id) {
      await stopAllAudio();
      return;
    }
    await stopAllAudio();
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: selectedMusic.stream_url || '' },
        { shouldPlay: true, positionMillis: (selectedMusic.start_time || 0) * 1000 }
      );
      musicSoundRef.current = sound;
      setPlayingTrackId(selectedMusic.id);
      snippetTimer.current = setTimeout(() => stopAllAudio(), 30000);
    } catch { info('Could not play preview'); }
  };

  // ─── CUSTOM SCHEDULE PICKER ─────────────────────────────────────
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const getDaysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();

  const confirmSchedule = () => {
    const days = getDaysInMonth(pickerMonth, pickerYear);
    const safeDay = Math.min(pickerDay, days);
    const d = new Date(pickerYear, pickerMonth, safeDay, pickerHour, pickerMinute);
    if (mode === 'family') {
      setStoryDate(`${pickerYear}-${String(pickerMonth + 1).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`);
      setShowSchedulePicker(false);
      return;
    }
    if (d <= new Date()) return info('Please pick a future date and time');
    setScheduledDate(d);
    setShowSchedulePicker(false);
  };

  const formatSchedule = (date) => {
    if (!date) return '';
    return date.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const captionDebounce = useRef(null);
  const handleCaptionChange = (v) => {
    setCaption(v);
    checkTone(v);
    clearTimeout(captionDebounce.current);
    if (v.length > 15) {
      captionDebounce.current = setTimeout(() => suggestHashtagsForCaption(v), 1500);
    } else {
      setHashtagSuggestions([]);
    }
  };

  // ─── PICKER COLUMN ──────────────────────────────────────────────
  const PickerColumn = ({ values, selected, onSelect, label }) => (
    <View style={s.pickerCol}>
      <AppText style={s.pickerColLabel}>{label}</AppText>
      <ScrollView style={s.pickerScroll} showsVerticalScrollIndicator={false}>
        {values.map((v, i) => (
          <TouchableOpacity key={i} style={[s.pickerItem, selected === v && s.pickerItemActive]} onPress={() => onSelect(v)}>
            <AppText style={[s.pickerItemText, selected === v && s.pickerItemTextActive]}>
              {String(v).padStart(2, '0')}
            </AppText>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  // ─── POST SUBMIT ────────────────────────────────────────────────
  const handlePost = async () => {
    if (mode === 'family') {
      if (!familyTitle.trim()) return info('Please add a title for your story');
      setLoading(true);
      try {
        const formData = new FormData();
        formData.append('title', familyTitle);
        formData.append('content', familyContent);
        formData.append('privacy', familyPrivacy);
        if (storyDate) formData.append('story_date', storyDate);
        if (mediaFiles[0]) {
          formData.append('file', { uri: mediaFiles[0].uri, type: 'image/jpeg', name: 'media.jpg' });
        }
        const { data } = await api.post('/stories/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        await AsyncStorage.removeItem(DRAFT_KEY);
        setFamilyTitle(''); setFamilyContent(''); setMediaFiles([]);
        navigation.navigate('AIProcessing', { storyId: data.story?.id });
      } catch (err) {
        error(err.response?.data?.error || 'Failed to post story. Try again.');
      } finally { setLoading(false); }
      return;
    }

    if (mode === 'story') {
      if (!textContent.trim() && !mediaFiles[0]) return info('Add text or pick a photo for your story');
      setLoading(true);
      try {
        const formData = new FormData();
        formData.append('privacy', privacy);
        formData.append('bg_color', bgColor);
        if (textContent) formData.append('text_content', textContent);
        if (location) formData.append('location', location);
        if (selectedMusic) {
          formData.append('music', JSON.stringify({
            title: selectedMusic.title,
            artist: selectedMusic.artist,
            cover: selectedMusic.artwork || '',
            music_id: String(selectedMusic.id),
            start_time: selectedMusic.start_time || 0,
          }));
          formData.append('music_id', selectedMusic.id);
        }
        if (mediaFiles[0]) {
          const isVid = mediaFiles[0].type === 'video' || mediaFiles[0].mediaType === 'video';
          formData.append('file', {
            uri: mediaFiles[0].uri,
            type: isVid ? 'video/mp4' : 'image/jpeg',
            name: isVid ? 'story_media.mp4' : 'story_media.jpg',
          });
        }
        await api.post('/pstories/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        setMediaFiles([]); setTextContent(''); setSelectedMusic(null);
        success('Story posted! It will disappear in 24 hours');
        navigation.navigate('Feed');
      } catch (err) {
        error(err.response?.data?.error || 'Failed to post story. Try again.');
      } finally { setLoading(false); }
      return;
    }

    if (!caption.trim() && mediaFiles.length === 0) return info('Add a caption or pick some media');
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('caption', caption);
      formData.append('privacy', privacy);
      if (location) formData.append('location', location);
      if (selectedLocation?.lat) formData.append('location_lat', selectedLocation.lat);
      if (selectedLocation?.lng) formData.append('location_lng', selectedLocation.lng);
      if (hashtags) formData.append('hashtags', hashtags);
      if (altText) formData.append('alt_text', altText);
      if (collaborators.length) formData.append('collaborators', JSON.stringify(collaborators.map(c => ({ id: c.id, role: c.role }))));
      if (selectedMusic) {
        formData.append('music_id', String(selectedMusic.id));
        formData.append('music_title', selectedMusic.title || '');
        formData.append('music_artist', selectedMusic.artist || '');
        formData.append('music_artwork', selectedMusic.artwork || '');
        formData.append('music_stream_url', selectedMusic.stream_url || '');
        formData.append('music_start_time', String(selectedMusic.start_time || 0));
        // Backend will upload this to Cloudinary for permanent storage
      }
      if (scheduledDate) formData.append('scheduled_for', scheduledDate.toISOString());
      if (mediaFiles.length === 1) {
        formData.append('file', { uri: mediaFiles[0].uri, type: mediaFiles[0].type === 'video' ? 'video/mp4' : 'image/jpeg', name: 'media.jpg' });
      } else if (mediaFiles.length > 1) {
        mediaFiles.forEach((f, i) => {
          formData.append('files', { uri: f.uri, type: f.type === 'video' ? 'video/mp4' : 'image/jpeg', name: `media_${i}.jpg` });
        });
      }
      await api.post('/posts/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      await AsyncStorage.removeItem(DRAFT_KEY);
      setCaption(''); setMediaFiles([]); setLocation(''); setHashtags('');
      setSelectedMusic(null); setScheduledDate(null); setToneResult(null);
      setHashtagSuggestions([]); setCollaborators([]);
      setSelectedLocation(null); setLocationQuery('');
      success(scheduledDate ? `Post scheduled for ${formatSchedule(scheduledDate)}` : collaborators.length > 0 ? 'Post shared! Co-creator invitations sent.' : 'Post shared!');
      navigation.navigate('Feed');
    } catch (err) {
      error(err.response?.data?.error || 'Failed to post. Try again.');
    } finally { setLoading(false); }
  };

  // ─── SCHEDULE PICKER MODAL ──────────────────────────────────────
  const SchedulePickerModal = () => {
    const now = new Date();
    const years = [now.getFullYear(), now.getFullYear() + 1];
    const days = Array.from({ length: getDaysInMonth(pickerMonth, pickerYear) }, (_, i) => i + 1);
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

    return (
      <Modal visible={showSchedulePicker} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={[s.modalSheet, { backgroundColor: theme.bgCard }]}>
            <View style={s.modalHandle} />
            <AppText style={[s.modalTitle, { color: theme.text }]}>Schedule Post</AppText>
            <View style={s.pickerRow}>
              <PickerColumn label="Day" values={days} selected={pickerDay} onSelect={setPickerDay} />
              <PickerColumn label="Month" values={MONTHS} selected={MONTHS[pickerMonth]} onSelect={(v) => setPickerMonth(MONTHS.indexOf(v))} />
              <PickerColumn label="Year" values={years} selected={pickerYear} onSelect={setPickerYear} />
              <PickerColumn label="Hour" values={hours} selected={pickerHour} onSelect={setPickerHour} />
              <PickerColumn label="Min" values={minutes} selected={pickerMinute} onSelect={setPickerMinute} />
            </View>
            <View style={s.pickerActions}>
              <TouchableOpacity style={[s.pickerCancelBtn, { borderColor: theme.border2 }]} onPress={() => setShowSchedulePicker(false)}>
                <AppText style={{ color: theme.muted, fontWeight: '600' }}>Cancel</AppText>
              </TouchableOpacity>
              <TouchableOpacity style={s.pickerConfirmBtn} onPress={confirmSchedule}>
                <AppText style={{ color: '#fff', fontWeight: '700' }}>Confirm</AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  // ════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════
  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hide} />

      {/* Modals — rendered at root level so they work correctly */}
    <Modal
      visible={showMusicModal}
      animationType="slide"
      transparent
      onRequestClose={() => { stopAllAudio(); setShowMusicModal(false); }}
      onShow={() => { if (musicTracks.length === 0) fetchTrending(); }}
    >
      <View style={s.modalOverlay}>
        <View style={[s.musicSheet, { backgroundColor: theme.bgCard }]}>
          <View style={s.modalHandle} />

          {/* Header */}
          <View style={s.musicSheetHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="musical-notes" size={18} color="#a78bfa" />
              <AppText style={[s.modalTitle, { color: theme.text, marginBottom: 0 }]}>Add Music</AppText>
            </View>
            <TouchableOpacity
              style={[s.musicAiBtn, suggestingMusic && { opacity: 0.6 }]}
              onPress={suggestMusicForCaption}
              disabled={suggestingMusic}
            >
              {suggestingMusic
                ? <ActivityIndicator size="small" color="#a78bfa" />
                : <Ionicons name="sparkles" size={13} color="#a78bfa" />}
              <AppText style={s.musicAiBtnText}>AI Match</AppText>
            </TouchableOpacity>
          </View>

          {/* Search bar */}
          <View style={[s.musicSearchRow, { backgroundColor: theme.bgSecondary, borderColor: musicSearch ? '#7c3aed' : theme.border2 }]}>
            <Ionicons name="search" size={15} color={musicSearch ? '#7c3aed' : theme.muted} />
            <TextInput
              style={[s.musicSearchInput, { color: theme.text }]}
              placeholder="Search any song, artist, genre..."
              placeholderTextColor={theme.dim}
              value={musicSearch}
              onChangeText={handleMusicSearch}
              returnKeyType="search"
              onSubmitEditing={() => searchAudius(musicSearch)}
            />
            {musicSearch
              ? <TouchableOpacity onPress={() => { setMusicSearch(''); fetchTrending(); }}>
                  <Ionicons name="close-circle" size={15} color={theme.muted} />
                </TouchableOpacity>
              : null}
          </View>

          {/* Quick search chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.musicQuickRow} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
            {QUICK_SEARCHES.map(q => (
              <TouchableOpacity
                key={q.label}
                style={[s.musicQuickChip, {
                  borderColor: activeQuick === q.label ? '#7c3aed' : theme.border2,
                  backgroundColor: activeQuick === q.label ? 'rgba(124,58,237,0.15)' : 'rgba(30,41,59,0.4)',
                }]}
                onPress={() => { setActiveQuick(q.label); setMusicSearch(q.query); searchAudius(q.query); }}
              >
                <AppText style={s.musicQuickIcon}>{q.icon}</AppText>
                <AppText style={[s.musicQuickLabel, { color: activeQuick === q.label ? '#a78bfa' : theme.muted }]}>{q.label}</AppText>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Track list */}
          {musicLoading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <ActivityIndicator size="large" color="#7c3aed" />
              <AppText style={{ color: theme.muted, fontSize: 13 }}>Loading tracks...</AppText>
            </View>
          ) : (
            <FlatList
              data={musicTracks}
              keyExtractor={item => item.id}
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', paddingTop: 40 }}>
                  <Ionicons name="musical-notes-outline" size={40} color={theme.dim} />
                  <AppText style={{ color: theme.muted, marginTop: 10, fontSize: 14 }}>No tracks found</AppText>
                  <TouchableOpacity style={{ marginTop: 12 }} onPress={fetchTrending}>
                    <AppText style={{ color: '#a78bfa', fontWeight: '700' }}>Load Trending</AppText>
                  </TouchableOpacity>
                </View>
              }
              renderItem={({ item }) => {
                const isSelected = selectedMusic?.id === item.id;
                const isPlaying = playingTrackId === item.id;
                return (
                  <View style={[s.musicRow, { borderBottomColor: theme.border }, isSelected && { backgroundColor: 'rgba(124,58,237,0.08)' }]}>
                    {/* Artwork */}
                    {item.album?.cover_medium
                      ? <Image source={{ uri: item.album.cover_medium }} style={s.musicCover} />
                      : <View style={[s.musicCover, { backgroundColor: 'rgba(124,58,237,0.2)', alignItems: 'center', justifyContent: 'center' }]}>
                          <Ionicons name="musical-notes" size={18} color="#7c3aed" />
                        </View>}

                    {/* Info */}
                    <View style={{ flex: 1 }}>
                      <AppText style={[s.musicTitle, { color: theme.text }]} numberOfLines={1}>{item.title}</AppText>
                      <AppText style={[s.musicArtist, { color: theme.muted }]} numberOfLines={1}>
                        {item.artist?.name || 'Unknown'}
                      </AppText>
                    </View>

                    {/* Play preview */}
                    <TouchableOpacity
                      style={[s.musicPlayBtn, { backgroundColor: isPlaying ? '#7c3aed' : 'rgba(124,58,237,0.15)' }]}
                      onPress={() => togglePreview(item)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name={isPlaying ? 'pause' : 'play'} size={14} color={isPlaying ? '#fff' : '#7c3aed'} style={!isPlaying ? { marginLeft: 2 } : {}} />
                    </TouchableOpacity>

                    {/* Snippet / Use button */}
                    <TouchableOpacity
                      style={[s.musicUseBtn, { backgroundColor: isSelected ? '#10b981' : 'rgba(124,58,237,0.15)' }]}
                      onPress={() => openSnippetSelector(item)}
                    >
                      <AppText style={[s.musicUseBtnText, { color: isSelected ? '#fff' : '#a78bfa' }]}>
                        {isSelected ? '✓ Used' : 'Use'}
                      </AppText>
                    </TouchableOpacity>
                  </View>
                );
              }}
            />
          )}

          <TouchableOpacity
            style={[s.modalClose, { borderColor: theme.border2 }]}
            onPress={() => { stopAllAudio(); setShowMusicModal(false); }}
          >
            <AppText style={{ color: theme.text, fontWeight: '600' }}>Cancel</AppText>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
      {snippetTrack && (() => {
        const maxStart = Math.max(0, trackDuration - 30);
        const barCount = 40;
        return (
      <Modal visible={!!snippetTrack} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={[s.modalSheet, { backgroundColor: theme.bgCard, maxHeight: '55%' }]}>
            <View style={s.modalHandle} />
            <AppText style={[s.modalTitle, { color: theme.text }]}>Choose Snippet</AppText>

            {/* Track info */}
            <View style={s.snippetTrackRow}>
              {snippetTrack.album?.cover_medium
                ? <Image source={{ uri: snippetTrack.album.cover_medium }} style={s.snippetArt} />
                : <View style={[s.snippetArt, { backgroundColor: 'rgba(124,58,237,0.25)', alignItems: 'center', justifyContent: 'center' }]}>
                    <Ionicons name="musical-notes" size={22} color="#7c3aed" />
                  </View>}
              <View style={{ flex: 1 }}>
                <AppText style={[s.snippetTitle, { color: theme.text }]} numberOfLines={1}>{snippetTrack.title}</AppText>
                <AppText style={[s.snippetArtist, { color: theme.muted }]} numberOfLines={1}>{snippetTrack.artist?.name || 'Unknown'}</AppText>
              </View>
              <TouchableOpacity
                style={[s.snippetPlayBtn, { backgroundColor: playingTrackId === snippetTrack.id ? '#7c3aed' : 'rgba(124,58,237,0.2)' }]}
                onPress={() => togglePreview(snippetTrack)}
              >
                <Ionicons name={playingTrackId === snippetTrack.id ? 'pause' : 'play'} size={18} color={playingTrackId === snippetTrack.id ? '#fff' : '#7c3aed'} />
              </TouchableOpacity>
            </View>

            {/* Waveform bars (decorative + touch) */}
            <AppText style={[s.cpLabel, { color: theme.muted, paddingHorizontal: 16, marginTop: 8 }]}>DRAG TO PICK START (30-SEC CLIP)</AppText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 16, marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, height: 56 }}>
                {Array.from({ length: barCount }, (_, i) => {
                  const sec = Math.floor((i / barCount) * (trackDuration || 180));
                  const inSnippet = sec >= snippetStart && sec < snippetStart + 30;
                  const barH = 8 + Math.abs(Math.sin(i * 0.47 + 1.2) * 30);
                  return (
                    <TouchableOpacity
                      key={i}
                      onPress={() => seekSnippet(Math.min(sec, maxStart || 0))}
                      hitSlop={{ top: 10, bottom: 10, left: 1, right: 1 }}
                    >
                      <View style={[s.waveBar, {
                        height: barH,
                        backgroundColor: inSnippet ? '#7c3aed' : 'rgba(124,58,237,0.25)',
                        opacity: inSnippet ? 1 : 0.5,
                      }]} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* Time display */}
            <View style={s.snippetTimeRow}>
              <AppText style={[s.snippetTimeText, { color: theme.muted }]}>
                Start: {Math.floor(snippetStart / 60)}:{String(snippetStart % 60).padStart(2, '0')}
              </AppText>
              <AppText style={[s.snippetTimeText, { color: '#7c3aed', fontWeight: '700' }]}>30 sec clip</AppText>
              {trackDuration > 0 && (
                <AppText style={[s.snippetTimeText, { color: theme.muted }]}>
                  / {Math.floor(trackDuration / 60)}:{String(trackDuration % 60).padStart(2, '0')}
                </AppText>
              )}
            </View>

            {/* Seek buttons */}
            <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 12 }}>
              {[-10, -5, 5, 10].map(delta => (
                <TouchableOpacity
                  key={delta}
                  style={[s.seekBtn, { borderColor: theme.border2 }]}
                  onPress={() => seekSnippet(Math.max(0, Math.min(snippetStart + delta, maxStart || 0)))}
                >
                  <AppText style={{ color: theme.muted, fontSize: 12, fontWeight: '600' }}>
                    {delta > 0 ? `+${delta}s` : `${delta}s`}
                  </AppText>
                </TouchableOpacity>
              ))}
            </View>

            {/* Confirm + Cancel */}
            <View style={s.pickerActions}>
              <TouchableOpacity
                style={[s.pickerCancelBtn, { borderColor: theme.border2 }]}
                onPress={() => { stopAllAudio(); setSnippetTrack(null); }}
              >
                <AppText style={{ color: theme.muted, fontWeight: '600' }}>Cancel</AppText>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.pickerConfirmBtn}
                onPress={() => selectMusicWithSnippet(snippetTrack, snippetStart)}
              >
                <AppText style={{ color: '#fff', fontWeight: '700' }}>Use This Clip ✓</AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
        );
      })()}
      <SchedulePickerModal />

      <LinearGradient
        colors={isDark ? ['#0f172a', '#1e1040', '#0f172a'] : [theme.bg, theme.bgSecondary, theme.bg]}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <AppText style={[s.headerTitle, { color: theme.text }]}>Create</AppText>
        <View style={s.headerRight}>
          {draftSaved && <AppText style={s.draftSavedText}>Saved</AppText>}
          <TouchableOpacity
            style={[s.postBtn, loading && { opacity: 0.5 }]}
            onPress={handlePost}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <AppText style={s.postBtnText}>{scheduledDate ? 'Schedule' : t('share')}</AppText>}
          </TouchableOpacity>
        </View>
      </View>

      {/* Draft restore banner */}
      {showDraftBanner && (
        <View style={[s.draftBanner, { backgroundColor: 'rgba(245,158,11,0.15)', borderColor: 'rgba(245,158,11,0.3)' }]}>
          <Ionicons name="document-text-outline" size={16} color="#f59e0b" />
          <AppText style={s.draftBannerText}>You have an unsaved draft</AppText>
          <TouchableOpacity onPress={loadDraft}>
            <AppText style={s.draftBannerAction}>Restore</AppText>
          </TouchableOpacity>
          <TouchableOpacity onPress={discardDraft}>
            <AppText style={[s.draftBannerAction, { color: theme.muted }]}>Discard</AppText>
          </TouchableOpacity>
        </View>
      )}

      {/* Mode selector */}
      <View style={s.modeRow}>
        {MODES.map(m => (
          <TouchableOpacity
            key={m.key}
            style={[s.modeBtn, { backgroundColor: 'rgba(30,41,59,0.6)', borderColor: theme.border2 }, mode === m.key && s.modeBtnActive]}
            onPress={() => setMode(m.key)}
          >
            <Ionicons name={m.icon} size={16} color={mode === m.key ? '#fff' : theme.muted} />
            <AppText style={[s.modeBtnText, { color: theme.muted }, mode === m.key && { color: '#fff' }]}>{m.label}</AppText>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ══════════ POST MODE ══════════ */}
        {mode === 'post' && (
          <>
            {/* Media preview */}
            {mediaFiles.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.mediaPreviewRow}>
                {mediaFiles.map((f, i) => (
                  <View key={i} style={s.mediaThumb}>
                    <Image source={{ uri: f.uri }} style={s.mediaThumbImg} resizeMode="cover" />
                    {i === 0 && mediaFiles.length > 1 && (
                      <View style={s.coverBadge}><AppText style={s.coverBadgeText}>Cover</AppText></View>
                    )}
                    {mediaFiles.length > 1 && (
                      <View style={s.mediaCounter}><AppText style={s.mediaCounterText}>{i + 1}/{mediaFiles.length}</AppText></View>
                    )}
                    <View style={s.mediaActions}>
                      {i > 0 && (
                        <TouchableOpacity style={s.mediaActionBtn} onPress={() => moveMediaLeft(i)}>
                          <Ionicons name="chevron-back" size={12} color="#fff" />
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity style={s.mediaActionBtn} onPress={() => cropMedia(i)}>
                        <Ionicons name="crop" size={12} color="#fff" />
                      </TouchableOpacity>
                      <TouchableOpacity style={[s.mediaActionBtn, { backgroundColor: 'rgba(239,68,68,0.7)' }]} onPress={() => removeMedia(i)}>
                        <Ionicons name="trash-outline" size={12} color="#fff" />
                      </TouchableOpacity>
                      {i < mediaFiles.length - 1 && (
                        <TouchableOpacity style={s.mediaActionBtn} onPress={() => moveMediaRight(i)}>
                          <Ionicons name="chevron-forward" size={12} color="#fff" />
                        </TouchableOpacity>
                      )}
                    </View>
                    {f.type === 'video' && (
                      <View style={s.videoIcon}><Ionicons name="play" size={14} color="#fff" /></View>
                    )}
                  </View>
                ))}
                {mediaFiles.length < 10 && (
                  <TouchableOpacity
                    style={[s.addMoreBtn, { backgroundColor: theme.bgSecondary, borderColor: theme.border2 }]}
                    onPress={() => pickMedia(true)}
                  >
                    <Ionicons name="add" size={28} color={theme.muted} />
                    <AppText style={[s.addMoreText, { color: theme.muted }]}>Add</AppText>
                  </TouchableOpacity>
                )}
              </ScrollView>
            ) : (
              <View style={s.mediaButtons}>
                <TouchableOpacity style={s.mediaBtn} onPress={takePhoto} activeOpacity={0.85}>
                  <LinearGradient colors={['#7c3aed', '#3b82f6']} style={s.mediaBtnGrad}>
                    <Ionicons name="camera" size={26} color="#fff" />
                    <AppText style={s.mediaBtnLabel}>{t('camera')}</AppText>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity style={s.mediaBtn} onPress={() => pickMedia(true)} activeOpacity={0.85}>
                  <LinearGradient colors={['#3b82f6', '#06b6d4']} style={s.mediaBtnGrad}>
                    <Ionicons name="images" size={26} color="#fff" />
                    <AppText style={s.mediaBtnLabel}>{t('gallery')}</AppText>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}

            {/* Caption */}
            <View style={[s.captionContainer, { backgroundColor: theme.bgCard, borderColor: theme.border2 }]}>
              <TextInput
                style={[s.captionInput, { color: theme.text }]}
                placeholder="Write a caption..."
                placeholderTextColor={theme.dim}
                multiline
                value={caption}
                onChangeText={handleCaptionChange}
                maxLength={2200}
              />
              <View style={s.captionFooter}>
                <AppText style={[s.charCount, { color: theme.muted }]}>{caption.length}/2200</AppText>
                <TouchableOpacity
                  style={[s.aiCaptionBtn, generatingCaption && { opacity: 0.6 }]}
                  onPress={() => setShowCaptionPanel(p => !p)}
                >
                  <Ionicons name="sparkles" size={14} color="#a78bfa" />
                  <AppText style={s.aiCaptionBtnText}>AI Suggest</AppText>
                </TouchableOpacity>
              </View>
            </View>

            {/* AI Caption Studio Panel */}
            {showCaptionPanel && (
              <View style={[s.cpPanel, { backgroundColor: theme.bgCard, borderColor: theme.border2 }]}>
                <View style={s.cpHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="sparkles" size={15} color="#a78bfa" />
                    <AppText style={s.cpTitle}>AI Caption Studio</AppText>
                  </View>
                  <TouchableOpacity onPress={() => setShowCaptionPanel(false)}>
                    <Ionicons name="close" size={18} color={theme.muted} />
                  </TouchableOpacity>
                </View>

                <AppText style={[s.cpLabel, { color: theme.muted }]}>TONE</AppText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  {[
                    { key: 'warm', label: 'Warm', emoji: '🤗' },
                    { key: 'funny', label: 'Funny', emoji: '😂' },
                    { key: 'deep', label: 'Deep', emoji: '🧠' },
                    { key: 'romantic', label: 'Romantic', emoji: '❤️' },
                    { key: 'savage', label: 'Savage', emoji: '😈' },
                    { key: 'professional', label: 'Pro', emoji: '💼' },
                    { key: 'inspiring', label: 'Inspiring', emoji: '🚀' },
                    { key: 'nostalgic', label: 'Nostalgic', emoji: '🌌' },
                    { key: 'aesthetic', label: 'Aesthetic', emoji: '🧘' },
                    { key: 'humble', label: 'Humble', emoji: '🙏' },
                    { key: 'bold', label: 'Bold', emoji: '🔥' },
                    { key: 'mysterious', label: 'Mysterious', emoji: '🌙' },
                    { key: 'grateful', label: 'Grateful', emoji: '🙌' },
                    { key: 'sarcastic', label: 'Sarcastic', emoji: '🙄' },
                    { key: 'motivational', label: 'Motivational', emoji: '💪' },
                    { key: 'chill', label: 'Chill', emoji: '😎' },
                    { key: 'dramatic', label: 'Dramatic', emoji: '🎭' },
                    { key: 'poetic', label: 'Poetic', emoji: '🌹' },
                    { key: 'family', label: 'Family', emoji: '👨‍👩‍👧' },
                    { key: 'travel', label: 'Travel', emoji: '✈️' },
                    { key: 'foodie', label: 'Foodie', emoji: '🍽️' },
                  ].map(toneOpt => (
                    <TouchableOpacity
                      key={toneOpt.key}
                      style={[s.cpChip, { borderColor: theme.border2 }, selectedTone === toneOpt.key && s.cpChipActive]}
                      onPress={() => setSelectedTone(toneOpt.key)}
                    >
                      <AppText style={s.cpChipEmoji}>{toneOpt.emoji}</AppText>
                      <AppText style={[s.cpChipText, { color: selectedTone === toneOpt.key ? '#a78bfa' : theme.muted }]}>{toneOpt.label}</AppText>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                  <View style={{ flex: 1 }}>
                    <AppText style={[s.cpLabel, { color: theme.muted }]}>LENGTH</AppText>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {[{ k: 'short', l: 'Short' }, { k: 'medium', l: 'Medium' }, { k: 'long', l: 'Long' }].map(o => (
                        <TouchableOpacity
                          key={o.k}
                          style={[s.cpToggle, { borderColor: theme.border2 }, captionLength === o.k && s.cpToggleActive]}
                          onPress={() => setCaptionLength(o.k)}
                        >
                          <AppText style={[s.cpToggleText, { color: captionLength === o.k ? '#a78bfa' : theme.muted }]}>{o.l}</AppText>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText style={[s.cpLabel, { color: theme.muted }]}>EMOJIS</AppText>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {[{ k: 'none', l: 'None' }, { k: 'minimal', l: 'Few' }, { k: 'heavy', l: '🔥🔥' }].map(o => (
                        <TouchableOpacity
                          key={o.k}
                          style={[s.cpToggle, { borderColor: theme.border2 }, emojiLevel === o.k && s.cpToggleActive]}
                          onPress={() => setEmojiLevel(o.k)}
                        >
                          <AppText style={[s.cpToggleText, { color: emojiLevel === o.k ? '#a78bfa' : theme.muted }]}>{o.l}</AppText>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>

                <TouchableOpacity
                  style={[s.cpGenerateBtn, generatingCaption && { opacity: 0.6 }]}
                  onPress={generateCaption}
                  disabled={generatingCaption}
                >
                  <LinearGradient colors={['#7c3aed', '#3b82f6']} style={s.cpGenerateGrad}>
                    {generatingCaption
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Ionicons name="sparkles" size={16} color="#fff" />}
                    <AppText style={s.cpGenerateText}>
                      {generatingCaption ? 'Writing 6 captions...' : 'Generate 6 Captions'}
                    </AppText>
                  </LinearGradient>
                </TouchableOpacity>

                {generatingCaption && captionOptions.length === 0 && (
                  <View style={{ gap: 8, marginTop: 12 }}>
                    {[180, 220, 160].map((w, i) => (
                      <View key={i} style={[s.cpSkeleton, { width: w, backgroundColor: theme.bgSecondary }]} />
                    ))}
                  </View>
                )}

                {captionOptions.length > 0 && (
                  <>
                    <AppText style={[s.cpLabel, { color: theme.muted, marginTop: 12 }]}>TAP TO USE · SWIPE FOR MORE</AppText>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {captionOptions.map((opt, i) => (
                        <TouchableOpacity
                          key={i}
                          style={[s.cpCard, { backgroundColor: theme.bgSecondary, borderColor: theme.border2 }]}
                          onPress={() => pickCaption(opt)}
                          activeOpacity={0.8}
                        >
                          <View style={s.cpCardNum}>
                            <AppText style={s.cpCardNumText}>{i + 1}</AppText>
                          </View>
                          <AppText style={[s.cpCardText, { color: theme.text }]}>{opt}</AppText>
                          <View style={s.cpCardFooter}>
                            <AppText style={[s.cpCardLen, { color: theme.muted }]}>{opt.length} chars</AppText>
                            <View style={s.cpUseBtn}>
                              <AppText style={s.cpUseBtnText}>Use →</AppText>
                            </View>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </>
                )}
              </View>
            )}

            {/* Tone result */}
            {(toneResult || checkingTone) && (
              <View style={[s.toneRow, {
                backgroundColor: toneResult?.score >= 7 ? 'rgba(16,185,129,0.1)' : toneResult?.score <= 3 ? 'rgba(248,113,113,0.1)' : 'rgba(245,158,11,0.1)',
                borderColor: toneResult?.score >= 7 ? 'rgba(16,185,129,0.3)' : toneResult?.score <= 3 ? 'rgba(248,113,113,0.3)' : 'rgba(245,158,11,0.3)',
              }]}>
                {checkingTone
                  ? <ActivityIndicator size="small" color={theme.muted} />
                  : <Ionicons
                      name={toneResult?.score >= 7 ? 'happy-outline' : toneResult?.score <= 3 ? 'sad-outline' : 'analytics-outline'}
                      size={16}
                      color={toneResult?.score >= 7 ? '#10b981' : toneResult?.score <= 3 ? '#f87171' : '#f59e0b'}
                    />}
                {toneResult && (
                  <View style={{ flex: 1 }}>
                    <AppText style={[s.toneLabel, { color: toneResult.score >= 7 ? '#10b981' : toneResult.score <= 3 ? '#f87171' : '#f59e0b' }]}>
                      Tone: {toneResult.tone} · {toneResult.score}/10
                    </AppText>
                    {toneResult.suggestion && <AppText style={[s.toneSuggestion, { color: theme.muted }]}>{toneResult.suggestion}</AppText>}
                  </View>
                )}
              </View>
            )}

            {/* Hashtag field + AI panel */}
            <View style={[s.fieldRow, { backgroundColor: theme.bgCard, borderColor: theme.border2 }]}>
              <Ionicons name="pricetag-outline" size={18} color={theme.muted} />
              <TextInput
                style={[s.fieldInput, { color: theme.text }]}
                placeholder="#hashtags"
                placeholderTextColor={theme.dim}
                value={hashtags}
                onChangeText={setHashtags}
                autoCapitalize="none"
              />
              <TouchableOpacity style={s.htSparkleBtn} onPress={suggestHashtags}>
                {loadingHashtags
                  ? <ActivityIndicator size="small" color="#a78bfa" />
                  : <><Ionicons name="sparkles" size={13} color="#a78bfa" /><AppText style={s.htSparkleTxt}>AI</AppText></>}
              </TouchableOpacity>
            </View>

            {/* AI Hashtag Panel */}
            {showHashtagPanel && (
              <View style={[s.htPanel, { backgroundColor: theme.bgCard, borderColor: theme.border2 }]}>
                <View style={s.htPanelHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="pricetag" size={14} color="#a78bfa" />
                    <AppText style={s.htPanelTitle}>AI Hashtag Engine</AppText>
                  </View>
                  <TouchableOpacity onPress={() => setShowHashtagPanel(false)}>
                    <Ionicons name="close" size={18} color={theme.muted} />
                  </TouchableOpacity>
                </View>

                <AppText style={[s.cpLabel, { color: theme.muted }]}>HOW MANY</AppText>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                  {[
                    { k: 'minimal', l: 'Minimal', sub: '5 tags' },
                    { k: 'balanced', l: 'Balanced', sub: '10 tags' },
                    { k: 'maximum', l: 'Maximum', sub: '25 tags' },
                  ].map(o => (
                    <TouchableOpacity
                      key={o.k}
                      style={[s.htCountBtn, { borderColor: theme.border2 }, hashtagCount === o.k && s.htCountBtnActive]}
                      onPress={() => setHashtagCount(o.k)}
                    >
                      <AppText style={[s.htCountLabel, { color: hashtagCount === o.k ? '#a78bfa' : theme.text }]}>{o.l}</AppText>
                      <AppText style={[s.htCountSub, { color: theme.muted }]}>{o.sub}</AppText>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity
                  style={[s.cpGenerateBtn, loadingHashtags && { opacity: 0.6 }]}
                  onPress={suggestHashtags}
                  disabled={loadingHashtags}
                >
                  <LinearGradient colors={['#7c3aed', '#3b82f6']} style={s.cpGenerateGrad}>
                    {loadingHashtags
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Ionicons name="sparkles" size={16} color="#fff" />}
                    <AppText style={s.cpGenerateText}>
                      {loadingHashtags ? 'Generating...' : 'Generate Hashtags'}
                    </AppText>
                  </LinearGradient>
                </TouchableOpacity>

                {loadingHashtags && hashtagSuggestions.length === 0 && (
                  <View style={{ gap: 8, marginTop: 12 }}>
                    {[160, 200, 140, 180].map((w, i) => (
                      <View key={i} style={[s.cpSkeleton, { width: w, backgroundColor: theme.bgSecondary }]} />
                    ))}
                  </View>
                )}

                {hashtagSuggestions.length > 0 && (
                  <>
                    <View style={s.htActionsRow}>
                      <TouchableOpacity style={s.htAddAllBtn} onPress={addAllHashtags}>
                        <Ionicons name="add-circle" size={14} color="#10b981" />
                        <AppText style={s.htAddAllText}>Add All</AppText>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.htRegenBtn} onPress={suggestHashtags}>
                        <Ionicons name="refresh" size={14} color="#a78bfa" />
                        <AppText style={s.htRegenText}>Regenerate</AppText>
                      </TouchableOpacity>
                    </View>

                    {['trending', 'location', 'niche', 'community', 'personal'].map(cat => {
                      const items = hashtagSuggestions.filter(h => h.category === cat);
                      if (!items.length) return null;
                      const catMeta = {
                        trending:  { icon: '🔥', label: 'Trending',  color: '#f59e0b' },
                        location:  { icon: '📍', label: 'Location',  color: '#3b82f6' },
                        niche:     { icon: '🎯', label: 'Niche',     color: '#8b5cf6' },
                        community: { icon: '👥', label: 'Community', color: '#10b981' },
                        personal:  { icon: '🧠', label: 'Personal',  color: '#ec4899' },
                      }[cat];
                      return (
                        <View key={cat} style={{ marginBottom: 10 }}>
                          <View style={s.htCatHeader}>
                            <AppText style={s.htCatIcon}>{catMeta.icon}</AppText>
                            <AppText style={[s.htCatLabel, { color: catMeta.color }]}>{catMeta.label}</AppText>
                          </View>
                          <View style={s.htChipsWrap}>
                            {items.map(h => {
                              const added = hashtags.includes(h.tag);
                              const levelColor = h.level === 'high' ? '#10b981' : h.level === 'medium' ? '#f59e0b' : '#64748b';
                              return (
                                <TouchableOpacity
                                  key={h.tag}
                                  style={[s.htChip, { borderColor: added ? '#10b981' : theme.border2, backgroundColor: added ? 'rgba(16,185,129,0.1)' : 'rgba(124,58,237,0.07)' }]}
                                  onPress={() => addHashtag(h.tag)}
                                  disabled={added}
                                >
                                  <View style={[s.htLevelDot, { backgroundColor: levelColor }]} />
                                  <AppText style={[s.htChipText, { color: added ? '#10b981' : theme.text }]}>{h.tag}</AppText>
                                  {added && <Ionicons name="checkmark" size={11} color="#10b981" />}
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </View>
                      );
                    })}

                    <View style={s.htLegend}>
                      {[{ c: '#10b981', l: 'High reach' }, { c: '#f59e0b', l: 'Medium' }, { c: '#64748b', l: 'Niche' }].map(l => (
                        <View key={l.l} style={s.htLegendItem}>
                          <View style={[s.htLevelDot, { backgroundColor: l.c }]} />
                          <AppText style={[s.htLegendText, { color: theme.muted }]}>{l.l}</AppText>
                        </View>
                      ))}
                    </View>
                  </>
                )}
              </View>
            )}

            {/* Location */}
            {selectedLocation ? (
              <View style={[s.locationSelected, { backgroundColor: theme.bgCard, borderColor: '#10b981' }]}>
                <View style={s.locationSelectedIcon}><Ionicons name="location" size={16} color="#10b981" /></View>
                <View style={{ flex: 1 }}>
                  <AppText style={[s.locationSelectedName, { color: theme.text }]} numberOfLines={1}>{selectedLocation.name}</AppText>
                  <AppText style={[s.locationSelectedFull, { color: theme.muted }]} numberOfLines={1}>{selectedLocation.full}</AppText>
                </View>
                <TouchableOpacity onPress={clearLocation} style={{ padding: 4 }}>
                  <Ionicons name="close-circle" size={18} color={theme.muted} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={[s.fieldRow, { backgroundColor: theme.bgCard, borderColor: theme.border2 }]}>
                <Ionicons name="location-outline" size={18} color={theme.muted} />
                <TextInput
                  style={[s.fieldInput, { color: theme.text }]}
                  placeholder="Search location..."
                  placeholderTextColor={theme.dim}
                  value={locationQuery}
                  onChangeText={searchLocation}
                />
                <TouchableOpacity onPress={detectCurrentLocation} disabled={detectingLocation} style={{ padding: 4 }}>
                  {detectingLocation
                    ? <ActivityIndicator size="small" color="#10b981" />
                    : <Ionicons name="navigate" size={16} color="#10b981" />}
                </TouchableOpacity>
              </View>
            )}

            {locationResults.length > 0 && (
              <View style={[s.locationDropdown, { backgroundColor: theme.bgCard, borderColor: theme.border2 }]}>
                {locationLoading && (
                  <View style={s.locationLoadingRow}>
                    <ActivityIndicator size="small" color="#7c3aed" />
                    <AppText style={[s.locationLoadingText, { color: theme.muted }]}>Searching...</AppText>
                  </View>
                )}
                {locationResults.map((item, i) => (
                  <TouchableOpacity
                    key={item.id || i}
                    style={[s.locationItem, { borderBottomColor: theme.border }, i === locationResults.length - 1 && { borderBottomWidth: 0 }]}
                    onPress={() => selectLocation(item)}
                  >
                    <View style={s.locationItemIcon}><Ionicons name="location-sharp" size={14} color="#7c3aed" /></View>
                    <View style={{ flex: 1 }}>
                      <AppText style={[s.locationItemName, { color: theme.text }]} numberOfLines={1}>{item.name}</AppText>
                      <AppText style={[s.locationItemFull, { color: theme.muted }]} numberOfLines={1}>{item.full}</AppText>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Collaborators */}
            <View style={[s.collabSection, { backgroundColor: theme.bgCard, borderColor: theme.border2 }]}>
              <View style={s.collabHeader}>
                <Ionicons name="people-outline" size={16} color={theme.muted} />
                <AppText style={[s.collabHeaderText, { color: theme.text }]}>Co-Creators</AppText>
                <TouchableOpacity style={s.collabAddBtn} onPress={() => setShowCollabSearch(p => !p)}>
                  <Ionicons name={showCollabSearch ? 'chevron-up' : 'add'} size={16} color="#7c3aed" />
                  {!showCollabSearch && <AppText style={s.collabAddBtnText}>Invite</AppText>}
                </TouchableOpacity>
              </View>

              {collaborators.length > 0 && (
                <View style={s.collabChipsWrap}>
                  {collaborators.map(c => (
                    <View key={c.id} style={[s.collabChip, { borderColor: theme.border2 }]}>
                      {c.avatar
                        ? <Image source={{ uri: c.avatar }} style={s.collabAvatar} />
                        : <View style={[s.collabAvatarFallback, { backgroundColor: '#7c3aed' }]}>
                            <AppText style={s.collabAvatarLetter}>{c.name?.[0]?.toUpperCase()}</AppText>
                          </View>}
                      <View style={{ flex: 1 }}>
                        <AppText style={[s.collabChipName, { color: theme.text }]}>{c.name}</AppText>
                        <AppText style={[s.collabChipRole, { color: theme.muted }]}>{c.role}</AppText>
                      </View>
                      <View style={s.collabRoleRow}>
                        {['creator', 'editor', 'contributor'].map(r => (
                          <TouchableOpacity key={r} style={[s.collabRoleBtn, c.role === r && s.collabRoleBtnActive]} onPress={() => updateCollabRole(c.id, r)}>
                            <AppText style={[s.collabRoleBtnText, { color: c.role === r ? '#a78bfa' : theme.muted }]}>
                              {r === 'creator' ? '👑' : r === 'editor' ? '✏️' : '🤝'}
                            </AppText>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <TouchableOpacity onPress={() => removeCollaborator(c.id)} style={{ padding: 4 }}>
                        <Ionicons name="close-circle" size={16} color={theme.muted} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {collaborators.length === 0 && !showCollabSearch && (
                <AppText style={[s.collabEmptyText, { color: theme.dim }]}>Invite co-creators — post appears on both profiles</AppText>
              )}

              {showCollabSearch && (
                <>
                  <View style={[s.collabSearchRow, { backgroundColor: theme.bgSecondary, borderColor: theme.border2 }]}>
                    <Ionicons name="search" size={15} color={theme.muted} />
                    <TextInput
                      style={[s.collabSearchInput, { color: theme.text }]}
                      placeholder="Search by name or @username..."
                      placeholderTextColor={theme.dim}
                      value={collabSearch}
                      onChangeText={searchCollaborators}
                      autoFocus
                      autoCapitalize="none"
                    />
                    {searchingCollab && <ActivityIndicator size="small" color="#7c3aed" />}
                  </View>

                  {collabResults.length > 0 && (
                    <View style={[s.collabDropdown, { backgroundColor: theme.bgCard, borderColor: theme.border2 }]}>
                      {collabResults.map(u => (
                        <TouchableOpacity
                          key={u.id}
                          style={[s.collabResultRow, { borderBottomColor: theme.border }]}
                          onPress={() => { addCollaborator(u); setShowCollabSearch(false); }}
                        >
                          {u.avatar
                            ? <Image source={{ uri: u.avatar }} style={s.collabResultAvatar} />
                            : <View style={[s.collabResultAvatar, { backgroundColor: '#7c3aed', alignItems: 'center', justifyContent: 'center' }]}>
                                <AppText style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{u.name?.[0]}</AppText>
                              </View>}
                          <View style={{ flex: 1 }}>
                            <AppText style={[s.collabResultName, { color: theme.text }]}>{u.name}</AppText>
                            <AppText style={[s.collabResultUsername, { color: theme.muted }]}>@{u.username}</AppText>
                          </View>
                          <View style={s.collabInviteBtn}>
                            <AppText style={s.collabInviteBtnText}>+ Invite</AppText>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {collabSearch.length >= 2 && !searchingCollab && collabResults.length === 0 && (
                    <AppText style={[s.collabEmptyText, { color: theme.dim, marginTop: 8 }]}>No users found</AppText>
                  )}
                </>
              )}
            </View>

            {/* Alt text */}
            <View style={[s.fieldRow, { backgroundColor: theme.bgCard, borderColor: theme.border2 }]}>
              <Ionicons name="text-outline" size={18} color={theme.muted} />
              <TextInput style={[s.fieldInput, { color: theme.text }]} placeholder="Alt text for accessibility" placeholderTextColor={theme.dim} value={altText} onChangeText={setAltText} />
            </View>

            {/* Music picker */}
            {selectedMusic ? (
              <View style={[s.musicCard, { backgroundColor: theme.bgCard, borderColor: theme.border2 }]}>
                <TouchableOpacity style={s.musicCardPlay} onPress={toggleSelectedMusicPreview}>
                  <LinearGradient colors={['#7c3aed', '#3b82f6']} style={s.musicCardPlayGrad}>
                    <Ionicons
                      name={playingTrackId === selectedMusic.id ? 'pause' : 'play'}
                      size={16} color="#fff"
                      style={playingTrackId !== selectedMusic.id ? { marginLeft: 2 } : {}}
                    />
                  </LinearGradient>
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <AppText style={[s.musicCardTitle, { color: theme.text }]} numberOfLines={1}>{selectedMusic.title}</AppText>
                  <AppText style={[s.musicCardArtist, { color: theme.muted }]} numberOfLines={1}>{selectedMusic.artist}</AppText>
                  {/* Clip info */}
                  <AppText style={{ color: '#7c3aed', fontSize: 10, marginTop: 2 }}>
                    ✂️ Clip from {Math.floor((selectedMusic.start_time || 0) / 60)}:{String((selectedMusic.start_time || 0) % 60).padStart(2, '0')} · 30s
                  </AppText>
                  {playingTrackId === selectedMusic.id && (
                    <View style={s.musicCardWave}>
                      {[...Array(16)].map((_, i) => (
                        <View key={i} style={[s.musicCardBar, { height: 4 + Math.abs(Math.sin(i * 0.8) * 10), backgroundColor: '#7c3aed' }]} />
                      ))}
                    </View>
                  )}
                </View>
                <TouchableOpacity onPress={() => setShowMusicModal(true)} style={{ padding: 6 }}>
                  <Ionicons name="swap-horizontal" size={16} color={theme.muted} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { stopAllAudio(); setSelectedMusic(null); }} style={{ padding: 6 }}>
                  <Ionicons name="close-circle" size={18} color={theme.muted} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[s.fieldRow, { backgroundColor: theme.bgCard, borderColor: theme.border2 }]}
                onPress={() => setShowMusicModal(true)}
              >
                <Ionicons name="musical-notes-outline" size={18} color={theme.muted} />
                <AppText style={[s.fieldInput, { color: theme.dim, paddingVertical: 12 }]}>Add music</AppText>
                <View style={s.musicAddBadge}>
                  <AppText style={s.musicAddBadgeText}>+ Add</AppText>
                </View>
              </TouchableOpacity>
            )}

            {/* Schedule */}
            <TouchableOpacity
              style={[s.fieldRow, { backgroundColor: theme.bgCard, borderColor: theme.border2 }]}
              onPress={() => setShowSchedulePicker(true)}
            >
              <Ionicons name="calendar-outline" size={18} color={theme.muted} />
              <AppText style={[s.fieldInput, { color: scheduledDate ? theme.text : theme.dim, paddingVertical: 12 }]}>
                {scheduledDate ? `Scheduled: ${formatSchedule(scheduledDate)}` : 'Schedule post (optional)'}
              </AppText>
              {scheduledDate && (
                <TouchableOpacity onPress={() => setScheduledDate(null)}>
                  <Ionicons name="close-circle" size={16} color={theme.muted} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>

            {/* Privacy */}
            <AppText style={[s.label, { color: theme.muted }]}>{t('audience')}</AppText>
            <View style={s.privacyRow}>
              {PRIVACY_OPTS.map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  style={[s.privacyBtn, { backgroundColor: theme.bgCard, borderColor: theme.border2 }, privacy === opt.key && { borderColor: opt.color, backgroundColor: `${opt.color}22` }]}
                  onPress={() => setPrivacy(opt.key)}
                >
                  <Ionicons name={opt.icon} size={14} color={privacy === opt.key ? opt.color : theme.muted} />
                  <AppText style={[s.privacyText, { color: privacy === opt.key ? opt.color : theme.muted }]}>{opt.label}</AppText>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* ══════════ STORY MODE ══════════ */}
        {mode === 'story' && (
          <>
            {/* ── CANVAS ── */}
            <View style={s.storyStudio}>
              {mediaFiles[0] ? (
                <View style={s.storyCanvas}>
                  <Image source={{ uri: mediaFiles[0].uri }} style={s.storyCanvasImg} resizeMode="cover" />
                  {/* Dark gradient overlays */}
                  <LinearGradient colors={['rgba(0,0,0,0.35)', 'transparent']} style={s.storyGradTop} />
                  <LinearGradient colors={['transparent', 'rgba(0,0,0,0.5)']} style={s.storyGradBottom} />
                  {/* Text overlay on media */}
                  {textContent ? (
                    <View style={s.storyTextOverlay}>
                      <AppText style={s.storyOverlayText}>{textContent}</AppText>
                    </View>
                  ) : null}
                  {/* Music sticker on canvas */}
                  {selectedMusic && (
                    <View style={s.storyMusicSticker}>
                      <Ionicons name="musical-notes" size={11} color="#fff" />
                      <AppText style={s.storyMusicStickerText} numberOfLines={1}>
                        {selectedMusic.title} · {selectedMusic.artist}
                      </AppText>
                      <TouchableOpacity onPress={() => { stopAllAudio(); setSelectedMusic(null); }}>
                        <Ionicons name="close" size={11} color="rgba(255,255,255,0.7)" />
                      </TouchableOpacity>
                    </View>
                  )}
                  {/* Remove media */}
                  <TouchableOpacity style={s.storyRemove} onPress={() => setMediaFiles([])}>
                    <View style={s.storyRemoveBtn}>
                      <Ionicons name="close" size={16} color="#fff" />
                    </View>
                  </TouchableOpacity>
                </View>
              ) : (
                /* Text-only canvas */
                <LinearGradient
                  colors={[bgColor, bgColor + 'cc']}
                  style={s.storyCanvas}
                >
                  <View style={s.storyCanvasInner}>
                    <TextInput
                      style={s.storyTextInput}
                      placeholder="Tap to write..."
                      placeholderTextColor="rgba(255,255,255,0.45)"
                      multiline
                      textAlign="center"
                      value={textContent}
                      onChangeText={setTextContent}
                    />
                    {!textContent && (
                      <View style={s.storyCanvasHint}>
                        <Ionicons name="create-outline" size={28} color="rgba(255,255,255,0.3)" />
                        <AppText style={s.storyCanvasHintText}>Tap to add text</AppText>
                      </View>
                    )}
                  </View>
                  {/* Music sticker on text canvas */}
                  {selectedMusic && (
                    <View style={s.storyMusicSticker}>
                      <Ionicons name="musical-notes" size={11} color="#fff" />
                      <AppText style={s.storyMusicStickerText} numberOfLines={1}>
                        {selectedMusic.title} · {selectedMusic.artist}
                      </AppText>
                      <TouchableOpacity onPress={() => { stopAllAudio(); setSelectedMusic(null); }}>
                        <Ionicons name="close" size={11} color="rgba(255,255,255,0.7)" />
                      </TouchableOpacity>
                    </View>
                  )}
                </LinearGradient>
              )}
            </View>

            {/* ── TOOL STRIP ── */}
            <View style={s.storyToolStrip}>
              {/* Camera */}
              <TouchableOpacity style={s.storyTool} onPress={() => navigation.navigate('StoryCamera', { selectedMusic })}>
                <View style={s.storyToolIcon}>
                  <Ionicons name="camera" size={20} color="#fff" />
                </View>
                <AppText style={s.storyToolLabel}>Camera</AppText>
              </TouchableOpacity>

              {/* Gallery */}
              <TouchableOpacity style={s.storyTool} onPress={() => pickMedia(false)}>
                <View style={s.storyToolIcon}>
                  <Ionicons name="images" size={20} color="#fff" />
                </View>
                <AppText style={s.storyToolLabel}>Gallery</AppText>
              </TouchableOpacity>

              {/* Text */}
              <TouchableOpacity style={s.storyTool} onPress={() => {}}>
                <View style={[s.storyToolIcon, textContent && { backgroundColor: 'rgba(74,124,63,0.6)', borderColor: '#3B82F6' }]}>
                  <Ionicons name="text" size={20} color="#fff" />
                </View>
                <AppText style={s.storyToolLabel}>Text</AppText>
              </TouchableOpacity>

              {/* Music */}
              <TouchableOpacity style={s.storyTool} onPress={() => setShowMusicModal(true)}>
                <View style={[s.storyToolIcon, selectedMusic && { backgroundColor: 'rgba(74,124,63,0.6)', borderColor: '#3B82F6' }]}>
                  <Ionicons name="musical-notes" size={20} color={selectedMusic ? '#8B5CF6' : '#fff'} />
                </View>
                <AppText style={[s.storyToolLabel, selectedMusic && { color: '#8B5CF6' }]}>
                  {selectedMusic ? 'Music ✓' : 'Music'}
                </AppText>
              </TouchableOpacity>

              {/* Location */}
              <TouchableOpacity style={s.storyTool} onPress={detectCurrentLocation}>
                <View style={[s.storyToolIcon, selectedLocation && { backgroundColor: 'rgba(74,124,63,0.6)', borderColor: '#3B82F6' }]}>
                  <Ionicons name="location" size={20} color={selectedLocation ? '#8B5CF6' : '#fff'} />
                </View>
                <AppText style={[s.storyToolLabel, selectedLocation && { color: '#8B5CF6' }]}>
                  {selectedLocation ? 'Added' : 'Location'}
                </AppText>
              </TouchableOpacity>
            </View>

            {/* ── TEXT INPUT (when media present) ── */}
            {mediaFiles[0] && (
              <View style={[s.storyTextField, { backgroundColor: theme.bgCard, borderColor: theme.border2 }]}>
                <Ionicons name="text-outline" size={16} color={theme.muted} />
                <TextInput
                  style={[s.storyTextFieldInput, { color: theme.text }]}
                  placeholder="Add text overlay..."
                  placeholderTextColor={theme.dim}
                  value={textContent}
                  onChangeText={setTextContent}
                />
                {textContent ? (
                  <TouchableOpacity onPress={() => setTextContent('')}>
                    <Ionicons name="close-circle" size={16} color={theme.dim} />
                  </TouchableOpacity>
                ) : null}
              </View>
            )}

            {/* ── BG COLORS (text-only canvas) ── */}
            {!mediaFiles[0] && (
              <View style={s.storyBgSection}>
                <AppText style={[s.storyBgLabel, { color: theme.muted }]}>Background</AppText>
                <View style={s.bgColorRow}>
                  {BG_COLORS.map(c => (
                    <TouchableOpacity
                      key={c}
                      onPress={() => setBgColor(c)}
                      style={[
                        s.bgColorDot,
                        { backgroundColor: c },
                        bgColor === c && s.bgColorDotActive,
                      ]}
                    >
                      {bgColor === c && (
                        <Ionicons name="checkmark" size={14} color="#fff" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* ── AUDIENCE ── */}
            <View style={s.storyAudienceRow}>
              <Ionicons name="people-outline" size={14} color={theme.muted} />
              <AppText style={[s.storyAudienceLabel, { color: theme.muted }]}>Audience:</AppText>
              {PRIVACY_OPTS.slice(0, 2).map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    s.storyAudienceBtn,
                    { borderColor: theme.border2 },
                    privacy === opt.key && { borderColor: opt.color, backgroundColor: `${opt.color}22` },
                  ]}
                  onPress={() => setPrivacy(opt.key)}
                >
                  <AppText style={[
                    s.storyAudienceBtnText,
                    { color: privacy === opt.key ? opt.color : theme.muted },
                  ]}>
                    {opt.label}
                  </AppText>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* ══════════ FAMILY STORY MODE ══════════ */}
        {mode === 'family' && (
          <>
            {mediaFiles[0] ? (
              <View style={s.mediaThumbLarge}>
                <Image source={{ uri: mediaFiles[0].uri }} style={s.mediaThumbLargeImg} resizeMode="cover" />
                <TouchableOpacity style={s.removeMedia} onPress={() => setMediaFiles([])}>
                  <Ionicons name="close-circle" size={22} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={s.mediaButtons}>
                <TouchableOpacity style={s.mediaBtn} onPress={takePhoto} activeOpacity={0.85}>
                  <LinearGradient colors={['#10b981', '#059669']} style={s.mediaBtnGrad}>
                    <Ionicons name="camera" size={26} color="#fff" />
                    <AppText style={s.mediaBtnLabel}>{t('camera')}</AppText>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity style={s.mediaBtn} onPress={() => pickMedia(false)} activeOpacity={0.85}>
                  <LinearGradient colors={['#7c3aed', '#3b82f6']} style={s.mediaBtnGrad}>
                    <Ionicons name="images" size={26} color="#fff" />
                    <AppText style={s.mediaBtnLabel}>{t('gallery')}</AppText>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}

            <AppText style={[s.label, { color: theme.muted }]}>Title *</AppText>
            <TextInput
              style={[s.input, { backgroundColor: theme.bgCard, color: theme.text, borderColor: theme.border2 }]}
              placeholder="Give your story a title..."
              placeholderTextColor={theme.dim}
              value={familyTitle}
              onChangeText={setFamilyTitle}
            />

            <AppText style={[s.label, { color: theme.muted }]}>Story</AppText>
            <TextInput
              style={[s.input, s.textarea, { backgroundColor: theme.bgCard, color: theme.text, borderColor: theme.border2 }]}
              multiline
              placeholder="Tell your family story..."
              placeholderTextColor={theme.dim}
              value={familyContent}
              onChangeText={setFamilyContent}
            />

            <AppText style={[s.label, { color: theme.muted }]}>When did this happen?</AppText>
            <TouchableOpacity
              style={[s.input, { backgroundColor: theme.bgCard, borderColor: theme.border2, justifyContent: 'center' }]}
              onPress={() => setShowSchedulePicker(true)}
            >
              <AppText style={{ color: storyDate ? theme.text : theme.dim, fontSize: 14 }}>
                {storyDate || 'Pick a date...'}
              </AppText>
            </TouchableOpacity>

            <AppText style={[s.label, { color: theme.muted }]}>Privacy</AppText>
            <View style={s.privacyRow}>
              {[
                { key: 'family', label: 'Family', color: '#10b981' },
                { key: 'private', label: 'Private', color: '#6b7280' },
                { key: 'public', label: 'Public', color: '#3b82f6' },
              ].map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  style={[s.privacyBtn, { backgroundColor: theme.bgCard, borderColor: theme.border2 }, familyPrivacy === opt.key && { borderColor: opt.color, backgroundColor: `${opt.color}22` }]}
                  onPress={() => setFamilyPrivacy(opt.key)}
                >
                  <AppText style={[s.privacyText, { color: familyPrivacy === opt.key ? opt.color : theme.muted }]}>{opt.label}</AppText>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ════════════════════════════════════════════════════════════════
// STYLES
// ════════════════════════════════════════════════════════════════
const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 0.5 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  draftSavedText: { fontSize: 12, color: '#10b981' },
  postBtn: { backgroundColor: colors.primary, paddingHorizontal: 18, paddingVertical: 8, borderRadius: radius.full },
  postBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  draftBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 0.5 },
  draftBannerText: { flex: 1, fontSize: 13, color: '#f59e0b' },
  draftBannerAction: { fontSize: 13, fontWeight: '600', color: '#f59e0b' },

  modeRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  modeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1 },
  modeBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  modeBtnText: { fontSize: 12, fontWeight: '600' },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 100 },

  // Media
  mediaPreviewRow: { marginBottom: 16 },
  mediaThumb: { width: 110, height: 110, borderRadius: 10, marginRight: 8, position: 'relative', overflow: 'hidden' },
  mediaThumbImg: { width: '100%', height: '100%', borderRadius: 10 },
  coverBadge: { position: 'absolute', top: 6, left: 6, backgroundColor: 'rgba(124,58,237,0.85)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  coverBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  mediaCounter: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  mediaCounterText: { color: '#fff', fontSize: 9, fontWeight: '600' },
  mediaActions: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 4, padding: 6, backgroundColor: 'rgba(0,0,0,0.45)' },
  mediaActionBtn: { backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 4, padding: 4 },
  videoIcon: { position: 'absolute', bottom: 28, left: 4, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 4, padding: 3 },
  addMoreBtn: { width: 110, height: 110, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderStyle: 'dashed' },
  addMoreText: { fontSize: 11, marginTop: 4 },
  removeMedia: { position: 'absolute', top: -6, right: -6 },

  mediaButtons: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  mediaBtn: { flex: 1, borderRadius: radius.lg, overflow: 'hidden' },
  mediaBtnGrad: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 28 },
  mediaBtnLabel: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Caption
  captionContainer: { borderRadius: radius.md, padding: 14, marginBottom: 10, borderWidth: 1 },
  captionInput: { fontSize: 15, minHeight: 70, textAlignVertical: 'top' },
  captionFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  charCount: { fontSize: 11 },
  aiCaptionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(124,58,237,0.15)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full },
  aiCaptionBtnText: { color: '#a78bfa', fontSize: 12, fontWeight: '600' },

  // Caption AI panel
  cpPanel: { borderRadius: radius.md, borderWidth: 1, padding: 14, marginBottom: 12 },
  cpHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  cpTitle: { fontSize: 14, fontWeight: '700', color: '#a78bfa' },
  cpLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 6, textTransform: 'uppercase' },
  cpChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full, borderWidth: 1, marginRight: 8, backgroundColor: 'rgba(124,58,237,0.06)' },
  cpChipActive: { backgroundColor: 'rgba(124,58,237,0.2)', borderColor: '#7c3aed' },
  cpChipEmoji: { fontSize: 14 },
  cpChipText: { fontSize: 12, fontWeight: '600' },
  cpToggle: { flex: 1, paddingVertical: 7, borderRadius: radius.md, borderWidth: 1, alignItems: 'center' },
  cpToggleActive: { backgroundColor: 'rgba(124,58,237,0.15)', borderColor: '#7c3aed' },
  cpToggleText: { fontSize: 11, fontWeight: '600' },
  cpGenerateBtn: { borderRadius: radius.md, overflow: 'hidden', marginBottom: 4 },
  cpGenerateGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12 },
  cpGenerateText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  cpSkeleton: { height: 14, borderRadius: 7 },
  cpCard: { width: 220, borderRadius: radius.md, borderWidth: 1, marginRight: 10, padding: 12, justifyContent: 'space-between' },
  cpCardNum: { width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(124,58,237,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  cpCardNumText: { fontSize: 10, fontWeight: '800', color: '#a78bfa' },
  cpCardText: { fontSize: 13, lineHeight: 19, flex: 1 },
  cpCardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  cpCardLen: { fontSize: 10 },
  cpUseBtn: { backgroundColor: 'rgba(124,58,237,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  cpUseBtnText: { fontSize: 11, fontWeight: '700', color: '#a78bfa' },

  // Tone
  toneRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: radius.md, borderWidth: 1, padding: 10, marginBottom: 12 },
  toneLabel: { fontSize: 12, fontWeight: '700' },
  toneSuggestion: { fontSize: 11, marginTop: 2, lineHeight: 16 },

  // Fields
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: radius.md, paddingHorizontal: 14, marginBottom: 10, borderWidth: 1 },
  fieldInput: { flex: 1, paddingVertical: 12, fontSize: 14 },

  // Hashtag panel
  htSparkleBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(124,58,237,0.15)', paddingHorizontal: 9, paddingVertical: 5, borderRadius: radius.full },
  htSparkleTxt: { color: '#a78bfa', fontSize: 11, fontWeight: '700' },
  htPanel: { borderRadius: radius.md, borderWidth: 1, padding: 14, marginBottom: 12 },
  htPanelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  htPanelTitle: { fontSize: 14, fontWeight: '700', color: '#a78bfa' },
  htCountBtn: { flex: 1, borderWidth: 1, borderRadius: radius.md, paddingVertical: 8, alignItems: 'center' },
  htCountBtnActive: { backgroundColor: 'rgba(124,58,237,0.15)', borderColor: '#7c3aed' },
  htCountLabel: { fontSize: 12, fontWeight: '700' },
  htCountSub: { fontSize: 10, marginTop: 2 },
  htActionsRow: { flexDirection: 'row', gap: 8, marginBottom: 12, marginTop: 4 },
  htAddAllBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: radius.md, backgroundColor: 'rgba(16,185,129,0.12)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)' },
  htAddAllText: { color: '#10b981', fontSize: 13, fontWeight: '700' },
  htRegenBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: radius.md, backgroundColor: 'rgba(124,58,237,0.1)', borderWidth: 1, borderColor: 'rgba(124,58,237,0.25)' },
  htRegenText: { color: '#a78bfa', fontSize: 13, fontWeight: '700' },
  htCatHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  htCatIcon: { fontSize: 13 },
  htCatLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  htChipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  htChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.full, borderWidth: 1 },
  htLevelDot: { width: 6, height: 6, borderRadius: 3 },
  htChipText: { fontSize: 12, fontWeight: '600' },
  htLegend: { flexDirection: 'row', gap: 12, marginTop: 8, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: 'rgba(100,116,139,0.2)' },
  htLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  htLegendText: { fontSize: 10 },

  // Music card (selected)
  musicCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: radius.md, borderWidth: 1, padding: 10, marginBottom: 10 },
  musicCardPlay: { width: 38, height: 38, borderRadius: 19, overflow: 'hidden' },
  musicCardPlayGrad: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  musicCardTitle: { fontSize: 14, fontWeight: '700' },
  musicCardArtist: { fontSize: 12, marginTop: 1 },
  musicCardWave: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 4, height: 14 },
  musicCardBar: { width: 2.5, borderRadius: 2 },
  musicAddBadge: { backgroundColor: 'rgba(124,58,237,0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.full },
  musicAddBadgeText: { color: '#7c3aed', fontSize: 11, fontWeight: '700' },

  // Music modal
  musicSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingBottom: 36, height: '88%' },
  musicSheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 12 },
  musicAiBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(124,58,237,0.15)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full },
  musicAiBtnText: { color: '#a78bfa', fontSize: 12, fontWeight: '700' },
  musicSearchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: radius.md, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 10, marginHorizontal: 16, marginBottom: 8 },
  musicSearchInput: { flex: 1, fontSize: 14 },
  // Quick chips
  musicQuickRow: { marginBottom: 8 },
  musicQuickChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full, borderWidth: 1 },
  musicQuickIcon: { fontSize: 13 },
  musicQuickLabel: { fontSize: 12, fontWeight: '600' },
  // Track row
  musicRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 0.5 },
  musicCover: { width: 44, height: 44, borderRadius: 8 },
  musicTitle: { fontSize: 14, fontWeight: '600' },
  musicArtist: { fontSize: 12, marginTop: 2 },
  musicPlayBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  musicUseBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full, marginLeft: 4 },
  musicUseBtnText: { fontSize: 12, fontWeight: '700' },
  modalClose: { margin: 16, padding: 14, borderRadius: radius.md, borderWidth: 1, alignItems: 'center' },

  // Snippet selector
  snippetTrackRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, marginBottom: 12 },
  snippetArt: { width: 48, height: 48, borderRadius: 10 },
  snippetTitle: { fontSize: 15, fontWeight: '700' },
  snippetArtist: { fontSize: 13, marginTop: 2 },
  snippetPlayBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  waveBar: { width: 5, borderRadius: 3 },
  snippetTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, marginBottom: 10 },
  snippetTimeText: { fontSize: 12 },
  seekBtn: { flex: 1, paddingVertical: 8, borderRadius: radius.md, borderWidth: 1, alignItems: 'center' },

  // Privacy
  label: { fontSize: 11, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8 },
  privacyRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  privacyBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1 },
  privacyText: { fontSize: 11, fontWeight: '600' },

  // Story
  storyStudio: { width: '100%', marginBottom: 12 },
  storyCanvas: { width: '100%', height: 420, borderRadius: 20, overflow: 'hidden', position: 'relative', alignItems: 'center', justifyContent: 'center' },
  storyCanvasImg: { position: 'absolute', width: '100%', height: '100%' },
  storyGradTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 100 },
  storyGradBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 140 },
  storyCanvasInner: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', padding: 28 },
  storyTextInput: { color: '#fff', fontSize: 24, fontWeight: '700', textAlign: 'center', width: '100%', textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  storyCanvasHint: { position: 'absolute', alignItems: 'center', gap: 6 },
  storyCanvasHintText: { color: 'rgba(255,255,255,0.3)', fontSize: 13 },
  storyTextOverlay: { position: 'absolute', bottom: 60, left: 16, right: 16, alignItems: 'center' },
  storyOverlayText: { color: '#fff', fontSize: 20, fontWeight: '700', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
  storyMusicSticker: { position: 'absolute', bottom: 16, left: 16, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, maxWidth: '70%' },
  storyMusicStickerText: { color: '#fff', fontSize: 11, flex: 1 },
  storyRemove: { position: 'absolute', top: 12, right: 12 },
  storyRemoveBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  storyToolStrip: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 14, paddingHorizontal: 8, marginBottom: 4 },
  storyTool: { alignItems: 'center', gap: 5 },
  storyToolIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  storyToolLabel: { fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  storyTextField: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 14 },
  storyTextFieldInput: { flex: 1, fontSize: 14 },
  storyBgSection: { marginBottom: 14 },
  storyBgLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  bgColorRow: { flexDirection: 'row', gap: 10 },
  bgColorDot: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  bgColorDotActive: { borderWidth: 3, borderColor: '#fff' },
  storyAudienceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  storyAudienceLabel: { fontSize: 12, fontWeight: '600' },
  storyAudienceBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  storyAudienceBtnText: { fontSize: 12, fontWeight: '600' },

  // Family
  mediaThumbLarge: { width: '100%', height: 200, borderRadius: radius.lg, overflow: 'hidden', marginBottom: 16, position: 'relative' },
  mediaThumbLargeImg: { width: '100%', height: '100%' },
  input: { borderWidth: 1, borderRadius: radius.md, padding: 14, fontSize: 14, marginBottom: 14 },
  textarea: { height: 120, textAlignVertical: 'top' },

  // Location
  locationSelected: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: radius.md, borderWidth: 1.5, padding: 10, marginBottom: 10 },
  locationSelectedIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(16,185,129,0.15)', alignItems: 'center', justifyContent: 'center' },
  locationSelectedName: { fontSize: 14, fontWeight: '700' },
  locationSelectedFull: { fontSize: 11, marginTop: 1 },
  locationDropdown: { borderRadius: radius.md, borderWidth: 1, marginBottom: 10, overflow: 'hidden' },
  locationLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  locationLoadingText: { fontSize: 13 },
  locationItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: 0.5 },
  locationItemIcon: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(124,58,237,0.12)', alignItems: 'center', justifyContent: 'center' },
  locationItemName: { fontSize: 13, fontWeight: '600' },
  locationItemFull: { fontSize: 11, marginTop: 1 },

  // Collaborators
  collabSection: { borderRadius: radius.md, borderWidth: 1, padding: 14, marginBottom: 10 },
  collabHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  collabHeaderText: { flex: 1, fontSize: 14, fontWeight: '600' },
  collabAddBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(124,58,237,0.12)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full },
  collabAddBtnText: { color: '#7c3aed', fontSize: 12, fontWeight: '700' },
  collabEmptyText: { fontSize: 12, fontStyle: 'italic' },
  collabChipsWrap: { gap: 8, marginBottom: 8 },
  collabChip: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: radius.md, padding: 8 },
  collabAvatar: { width: 32, height: 32, borderRadius: 16 },
  collabAvatarFallback: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  collabAvatarLetter: { color: '#fff', fontWeight: '700', fontSize: 13 },
  collabChipName: { fontSize: 13, fontWeight: '600' },
  collabChipRole: { fontSize: 11, marginTop: 1 },
  collabRoleRow: { flexDirection: 'row', gap: 4 },
  collabRoleBtn: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(100,116,139,0.1)' },
  collabRoleBtnActive: { backgroundColor: 'rgba(124,58,237,0.2)' },
  collabRoleBtnText: { fontSize: 13 },
  collabSearchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 4 },
  collabSearchInput: { flex: 1, fontSize: 14 },
  collabDropdown: { borderRadius: radius.md, borderWidth: 1, overflow: 'hidden', marginTop: 4 },
  collabResultRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderBottomWidth: 0.5 },
  collabResultAvatar: { width: 36, height: 36, borderRadius: 18 },
  collabResultName: { fontSize: 14, fontWeight: '600' },
  collabResultUsername: { fontSize: 12, marginTop: 1 },
  collabInviteBtn: { backgroundColor: 'rgba(124,58,237,0.15)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full },
  collabInviteBtnText: { color: '#7c3aed', fontSize: 12, fontWeight: '700' },

  // Modals
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingBottom: 36, maxHeight: '70%' },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(100,116,139,0.4)', alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', paddingHorizontal: 20, marginBottom: 12 },

  // Schedule picker
  pickerRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 6, marginBottom: 20 },
  pickerCol: { flex: 1, alignItems: 'center' },
  pickerColLabel: { fontSize: 9, fontWeight: '700', color: '#7c3aed', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 },
  pickerScroll: { height: 160 },
  pickerItem: { paddingVertical: 8, paddingHorizontal: 4, borderRadius: 8, marginBottom: 2, alignItems: 'center' },
  pickerItemActive: { backgroundColor: '#7c3aed' },
  pickerItemText: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  pickerItemTextActive: { color: '#fff', fontWeight: '700' },
  pickerActions: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingBottom: 8 },
  pickerCancelBtn: { flex: 1, padding: 14, borderRadius: radius.md, borderWidth: 1, alignItems: 'center' },
  pickerConfirmBtn: { flex: 1, padding: 14, borderRadius: radius.md, alignItems: 'center', backgroundColor: '#7c3aed' },
});