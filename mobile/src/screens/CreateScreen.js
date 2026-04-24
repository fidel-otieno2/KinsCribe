import { useState, useCallback, useEffect, useRef } from 'react';
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

const MUSIC_LIBRARY = [
  { id: '1', title: 'Golden Hour', artist: 'JVKE', duration: '3:24' },
  { id: '2', title: 'Sunflower', artist: 'Post Malone', duration: '2:38' },
  { id: '3', title: 'Blinding Lights', artist: 'The Weeknd', duration: '3:20' },
  { id: '4', title: 'Stay', artist: 'The Kid LAROI', duration: '2:21' },
  { id: '5', title: 'Levitating', artist: 'Dua Lipa', duration: '3:23' },
  { id: '6', title: 'Watermelon Sugar', artist: 'Harry Styles', duration: '2:54' },
];

export default function CreateScreen({ navigation }) {
  const { user } = useAuth();
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();
  const { toast, hide, success, error, info } = useToast();

  // Core state
  const [mode, setMode] = useState('post');
  const [mediaFiles, setMediaFiles] = useState([]);
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [privacy, setPrivacy] = useState('public');
  const [loading, setLoading] = useState(false);
  const [altText, setAltText] = useState('');
  const [collabUser, setCollabUser] = useState('');

  // AI state
  const [toneResult, setToneResult] = useState(null);
  const [checkingTone, setCheckingTone] = useState(false);
  const [generatingCaption, setGeneratingCaption] = useState(false);
  const [hashtagSuggestions, setHashtagSuggestions] = useState([]); // [{ tag, category, level }]
  const [loadingHashtags, setLoadingHashtags] = useState(false);
  const [hashtagCount, setHashtagCount] = useState('balanced'); // minimal|balanced|maximum
  const [showHashtagPanel, setShowHashtagPanel] = useState(false);
  // Caption panel
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

  // Music state
  const [showMusicModal, setShowMusicModal] = useState(false);
  const [selectedMusic, setSelectedMusic] = useState(null);

  // Schedule state — custom picker, no native module needed
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

  // Media reorder state
  const [dragging, setDragging] = useState(null);

  // ─── DRAFT SYSTEM ───────────────────────────────────────────────
  useEffect(() => {
    checkExistingDraft();
  }, []);

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
      if (draft.collabUser) setCollabUser(draft.collabUser);
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

  // Auto-save draft on any content change
  useEffect(() => {
    if (!caption && !hashtags && !location) return;
    clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      saveDraft({ caption, hashtags, location, privacy, altText, collabUser, mode });
    }, 2000);
    return () => clearTimeout(draftTimer.current);
  }, [caption, hashtags, location, privacy, altText, collabUser, mode]);

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
        caption: text,
        location,
        tone: selectedTone,
        count: countMap[hashtagCount] || 10,
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
        caption: text || buildContext(),
        location,
        tone: selectedTone,
        count: countMap[hashtagCount] || 10,
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

  const copyHashtags = () => {
    const all = hashtagSuggestions.map(h => h.tag).join(' ');
    // Clipboard not available without native module — insert directly
    setHashtags(prev => prev.trim() ? `${prev.trim()} ${all}` : all);
    setShowHashtagPanel(false);
    info('Hashtags added!');
  };

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
  }, [mediaFiles]);

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

  // ─── CROP / EDIT ────────────────────────────────────────────────
  const cropMedia = async (idx) => {
    try {
      const file = mediaFiles[idx];
      const result = await ImageManipulator.manipulateAsync(
        file.uri,
        [{ resize: { width: 1080 } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
      );
      const updated = [...mediaFiles];
      updated[idx] = { ...file, uri: result.uri };
      setMediaFiles(updated);
      info('Image optimised');
    } catch { info('Could not process image'); }
  };

  // ─── CUSTOM SCHEDULE PICKER ─────────────────────────────────────
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const getDaysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();

  const confirmSchedule = () => {
    const days = getDaysInMonth(pickerMonth, pickerYear);
    const safeDay = Math.min(pickerDay, days);
    const d = new Date(pickerYear, pickerMonth, safeDay, pickerHour, pickerMinute);

    // In family mode, just set the story date string (past dates OK)
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
    // Auto-suggest hashtags after user stops typing for 1.5s
    clearTimeout(captionDebounce.current);
    if (v.length > 15) {
      captionDebounce.current = setTimeout(() => suggestHashtagsForCaption(v), 1500);
    } else {
      setHashtagSuggestions([]);
    }
  };

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
              <PickerColumn
                label="Day"
                values={days}
                selected={pickerDay}
                onSelect={setPickerDay}
              />
              <PickerColumn
                label="Month"
                values={MONTHS}
                selected={MONTHS[pickerMonth]}
                onSelect={(v) => setPickerMonth(MONTHS.indexOf(v))}
              />
              <PickerColumn
                label="Year"
                values={years}
                selected={pickerYear}
                onSelect={setPickerYear}
              />
              <PickerColumn
                label="Hour"
                values={hours}
                selected={pickerHour}
                onSelect={setPickerHour}
              />
              <PickerColumn
                label="Min"
                values={minutes}
                selected={pickerMinute}
                onSelect={setPickerMinute}
              />
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
        if (selectedMusic) formData.append('music_id', selectedMusic.id);
        if (mediaFiles[0]) {
          formData.append('file', { uri: mediaFiles[0].uri, type: mediaFiles[0].type === 'video' ? 'video/mp4' : 'image/jpeg', name: 'story_media.jpg' });
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
      if (hashtags) formData.append('hashtags', hashtags);
      if (altText) formData.append('alt_text', altText);
      if (collabUser) formData.append('collab_user', collabUser);
      if (selectedMusic) formData.append('music_id', selectedMusic.id);
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
      setHashtagSuggestions([]);
      success(scheduledDate ? `Post scheduled for ${formatSchedule(scheduledDate)}` : 'Post shared!');
      navigation.navigate('Feed');
    } catch (err) {
      error(err.response?.data?.error || 'Failed to post. Try again.');
    } finally { setLoading(false); }
  };

  // ─── MUSIC MODAL ────────────────────────────────────────────────
  const MusicModal = () => (
    <Modal visible={showMusicModal} animationType="slide" transparent>
      <View style={[s.modalOverlay]}>
        <View style={[s.modalSheet, { backgroundColor: theme.bgCard }]}>
          <View style={s.modalHandle} />
          <AppText style={[s.modalTitle, { color: theme.text }]}>Add Music</AppText>
          <FlatList
            data={MUSIC_LIBRARY}
            keyExtractor={i => i.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[s.musicRow, { borderBottomColor: theme.border }, selectedMusic?.id === item.id && { backgroundColor: 'rgba(124,58,237,0.1)' }]}
                onPress={() => { setSelectedMusic(item); setShowMusicModal(false); }}
              >
                <View style={[s.musicIcon, { backgroundColor: 'rgba(124,58,237,0.15)' }]}>
                  <Ionicons name="musical-notes" size={18} color="#7c3aed" />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText style={[s.musicTitle, { color: theme.text }]}>{item.title}</AppText>
                  <AppText style={[s.musicArtist, { color: theme.muted }]}>{item.artist}</AppText>
                </View>
                <AppText style={[s.musicDuration, { color: theme.muted }]}>{item.duration}</AppText>
                {selectedMusic?.id === item.id && <Ionicons name="checkmark-circle" size={18} color="#7c3aed" style={{ marginLeft: 8 }} />}
              </TouchableOpacity>
            )}
          />
          <TouchableOpacity style={[s.modalClose, { borderColor: theme.border2 }]} onPress={() => setShowMusicModal(false)}>
            <AppText style={{ color: theme.text, fontWeight: '600' }}>Cancel</AppText>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <KeyboardAvoidingView style={[s.container, { backgroundColor: theme.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Toast visible={toast.visible} type={toast.type} message={toast.message} onHide={hide} />
      <MusicModal />
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
          {draftSaved && (
            <AppText style={s.draftSavedText}>Saved</AppText>
          )}
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
            {/* Media preview with reorder */}
            {mediaFiles.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.mediaPreviewRow}>
                {mediaFiles.map((f, i) => (
                  <View key={i} style={s.mediaThumb}>
                    <Image source={{ uri: f.uri }} style={s.mediaThumbImg} resizeMode="cover" />
                    {/* Cover badge */}
                    {i === 0 && mediaFiles.length > 1 && (
                      <View style={s.coverBadge}>
                        <AppText style={s.coverBadgeText}>Cover</AppText>
                      </View>
                    )}
                    {/* Counter */}
                    {mediaFiles.length > 1 && (
                      <View style={s.mediaCounter}>
                        <AppText style={s.mediaCounterText}>{i + 1}/{mediaFiles.length}</AppText>
                      </View>
                    )}
                    {/* Actions row */}
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
                    { key: 'warm',         label: 'Warm',        emoji: '🤗' },
                    { key: 'funny',        label: 'Funny',       emoji: '😂' },
                    { key: 'deep',         label: 'Deep',        emoji: '🧠' },
                    { key: 'romantic',     label: 'Romantic',    emoji: '❤️' },
                    { key: 'savage',       label: 'Savage',      emoji: '😈' },
                    { key: 'professional', label: 'Pro',         emoji: '💼' },
                    { key: 'inspiring',    label: 'Inspiring',   emoji: '🚀' },
                    { key: 'nostalgic',    label: 'Nostalgic',   emoji: '🌌' },
                    { key: 'aesthetic',    label: 'Aesthetic',   emoji: '🧘' },
                    { key: 'humble',       label: 'Humble',      emoji: '🙏' },
                    { key: 'bold',         label: 'Bold',        emoji: '🔥' },
                    { key: 'mysterious',   label: 'Mysterious',  emoji: '🌙' },
                    { key: 'grateful',     label: 'Grateful',    emoji: '🙌' },
                    { key: 'sarcastic',    label: 'Sarcastic',   emoji: '🙄' },
                    { key: 'motivational', label: 'Motivational',emoji: '💪' },
                    { key: 'chill',        label: 'Chill',       emoji: '😎' },
                    { key: 'dramatic',     label: 'Dramatic',    emoji: '🎭' },
                    { key: 'poetic',       label: 'Poetic',      emoji: '🌹' },
                    { key: 'family',       label: 'Family',      emoji: '👨‍👩‍👧' },
                    { key: 'travel',       label: 'Travel',      emoji: '✈️' },
                    { key: 'foodie',       label: 'Foodie',      emoji: '🍽️' },
                  ].map(t => (
                    <TouchableOpacity
                      key={t.key}
                      style={[s.cpChip, { borderColor: theme.border2 }, selectedTone === t.key && s.cpChipActive]}
                      onPress={() => setSelectedTone(t.key)}
                    >
                      <AppText style={s.cpChipEmoji}>{t.emoji}</AppText>
                      <AppText style={[s.cpChipText, { color: selectedTone === t.key ? '#a78bfa' : theme.muted }]}>{t.label}</AppText>
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
              <TouchableOpacity
                style={s.htSparkleBtn}
                onPress={suggestHashtags}
              >
                {loadingHashtags
                  ? <ActivityIndicator size="small" color="#a78bfa" />
                  : <>
                      <Ionicons name="sparkles" size={13} color="#a78bfa" />
                      <AppText style={s.htSparkleTxt}>AI</AppText>
                    </>}
              </TouchableOpacity>
            </View>

            {/* AI Hashtag Panel */}
            {showHashtagPanel && (
              <View style={[s.htPanel, { backgroundColor: theme.bgCard, borderColor: theme.border2 }]}>
                {/* Header */}
                <View style={s.htPanelHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="pricetag" size={14} color="#a78bfa" />
                    <AppText style={s.htPanelTitle}>AI Hashtag Engine</AppText>
                  </View>
                  <TouchableOpacity onPress={() => setShowHashtagPanel(false)}>
                    <Ionicons name="close" size={18} color={theme.muted} />
                  </TouchableOpacity>
                </View>

                {/* Count selector */}
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

                {/* Generate button */}
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

                {/* Skeleton */}
                {loadingHashtags && hashtagSuggestions.length === 0 && (
                  <View style={{ gap: 8, marginTop: 12 }}>
                    {[160, 200, 140, 180].map((w, i) => (
                      <View key={i} style={[s.cpSkeleton, { width: w, backgroundColor: theme.bgSecondary }]} />
                    ))}
                  </View>
                )}

                {/* Results grouped by category */}
                {hashtagSuggestions.length > 0 && (
                  <>
                    {/* Add all + Regenerate row */}
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

                    {/* Category groups */}
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

                    {/* Legend */}
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

            {/* Other fields */}
            <View style={[s.fieldRow, { backgroundColor: theme.bgCard, borderColor: theme.border2 }]}>
              <Ionicons name="location-outline" size={18} color={theme.muted} />
              <TextInput style={[s.fieldInput, { color: theme.text }]} placeholder="Add location" placeholderTextColor={theme.dim} value={location} onChangeText={setLocation} />
            </View>

            <View style={[s.fieldRow, { backgroundColor: theme.bgCard, borderColor: theme.border2 }]}>
              <Ionicons name="person-add-outline" size={18} color={theme.muted} />
              <TextInput style={[s.fieldInput, { color: theme.text }]} placeholder="Tag a co-creator @username" placeholderTextColor={theme.dim} value={collabUser} onChangeText={setCollabUser} autoCapitalize="none" />
            </View>

            <View style={[s.fieldRow, { backgroundColor: theme.bgCard, borderColor: theme.border2 }]}>
              <Ionicons name="text-outline" size={18} color={theme.muted} />
              <TextInput style={[s.fieldInput, { color: theme.text }]} placeholder="Alt text for accessibility" placeholderTextColor={theme.dim} value={altText} onChangeText={setAltText} />
            </View>

            {/* Music picker */}
            <TouchableOpacity
              style={[s.fieldRow, { backgroundColor: theme.bgCard, borderColor: theme.border2 }]}
              onPress={() => setShowMusicModal(true)}
            >
              <Ionicons name="musical-notes-outline" size={18} color={theme.muted} />
              {selectedMusic ? (
                <View style={s.selectedMusicRow}>
                  <AppText style={[s.selectedMusicTitle, { color: theme.text }]}>{selectedMusic.title}</AppText>
                  <AppText style={[s.selectedMusicArtist, { color: theme.muted }]}> · {selectedMusic.artist}</AppText>
                </View>
              ) : (
                <AppText style={[s.fieldInput, { color: theme.dim, paddingVertical: 12 }]}>Add music</AppText>
              )}
              {selectedMusic && (
                <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); setSelectedMusic(null); }}>
                  <Ionicons name="close-circle" size={16} color={theme.muted} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>

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
            {mediaFiles[0] ? (
              <View style={s.storyPreview}>
                <Image source={{ uri: mediaFiles[0].uri }} style={s.storyPreviewImg} resizeMode="cover" />
                {textContent ? (
                  <View style={s.storyTextOverlay}>
                    <AppText style={s.storyOverlayText}>{textContent}</AppText>
                  </View>
                ) : null}
                <TouchableOpacity style={s.storyRemove} onPress={() => setMediaFiles([])}>
                  <Ionicons name="close-circle" size={28} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={[s.storyCanvas, { backgroundColor: bgColor }]}>
                <TextInput
                  style={s.storyText}
                  placeholder="Type something..."
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  multiline
                  textAlign="center"
                  value={textContent}
                  onChangeText={setTextContent}
                />
              </View>
            )}

            {/* Text overlay input when media is present */}
            {mediaFiles[0] && (
              <View style={[s.fieldRow, { backgroundColor: theme.bgCard, borderColor: theme.border2, marginTop: 10 }]}>
                <Ionicons name="text-outline" size={18} color={theme.muted} />
                <TextInput
                  style={[s.fieldInput, { color: theme.text }]}
                  placeholder="Add text overlay..."
                  placeholderTextColor={theme.dim}
                  value={textContent}
                  onChangeText={setTextContent}
                />
              </View>
            )}

            <View style={s.storyActions}>
              <TouchableOpacity style={[s.storyActionBtn, { backgroundColor: theme.bgCard, borderColor: theme.border2 }]} onPress={takePhoto}>
                <Ionicons name="camera-outline" size={22} color={theme.text} />
                <AppText style={[s.storyActionText, { color: theme.text }]}>{t('camera')}</AppText>
              </TouchableOpacity>
              <TouchableOpacity style={[s.storyActionBtn, { backgroundColor: theme.bgCard, borderColor: theme.border2 }]} onPress={() => pickMedia(false)}>
                <Ionicons name="images-outline" size={22} color={theme.text} />
                <AppText style={[s.storyActionText, { color: theme.text }]}>{t('gallery')}</AppText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.storyActionBtn, { backgroundColor: theme.bgCard, borderColor: theme.border2 }]}
                onPress={() => setShowMusicModal(true)}
              >
                <Ionicons name="musical-notes-outline" size={22} color={selectedMusic ? '#7c3aed' : theme.text} />
                <AppText style={[s.storyActionText, { color: selectedMusic ? '#7c3aed' : theme.text }]}>
                  {selectedMusic ? selectedMusic.title.slice(0, 8) + '…' : 'Music'}
                </AppText>
              </TouchableOpacity>
            </View>

            {!mediaFiles[0] && (
              <>
                <AppText style={[s.label, { color: theme.muted }]}>Background Color</AppText>
                <View style={s.bgColorRow}>
                  {BG_COLORS.map(c => (
                    <TouchableOpacity
                      key={c}
                      style={[s.bgColorDot, { backgroundColor: c }, bgColor === c && s.bgColorDotActive]}
                      onPress={() => setBgColor(c)}
                    />
                  ))}
                </View>
              </>
            )}

            <AppText style={[s.label, { color: theme.muted }]}>{t('audience')}</AppText>
            <View style={s.privacyRow}>
              {PRIVACY_OPTS.slice(0, 2).map(opt => (
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

  // Caption input box
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

  // Music
  selectedMusicRow: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  selectedMusicTitle: { fontSize: 14, fontWeight: '600' },
  selectedMusicArtist: { fontSize: 13 },

  // Privacy
  label: { fontSize: 11, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8 },
  privacyRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  privacyBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1 },
  privacyText: { fontSize: 11, fontWeight: '600' },

  // Story
  storyPreview: { width: '100%', height: 400, borderRadius: radius.lg, overflow: 'hidden', marginBottom: 12, position: 'relative' },
  storyPreviewImg: { width: '100%', height: '100%' },
  storyTextOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.45)', padding: 16 },
  storyOverlayText: { color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  storyRemove: { position: 'absolute', top: 12, right: 12 },
  storyCanvas: { width: '100%', height: 300, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', marginBottom: 16, padding: 24 },
  storyText: { color: '#fff', fontSize: 22, fontWeight: '700', textAlign: 'center', width: '100%' },
  storyActions: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  storyActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: radius.md, borderWidth: 1 },
  storyActionText: { fontWeight: '600', fontSize: 12 },
  bgColorRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  bgColorDot: { width: 32, height: 32, borderRadius: 16 },
  bgColorDotActive: { borderWidth: 3, borderColor: '#fff' },

  // Family
  mediaThumbLarge: { width: '100%', height: 200, borderRadius: radius.lg, overflow: 'hidden', marginBottom: 16, position: 'relative' },
  mediaThumbLargeImg: { width: '100%', height: '100%' },
  input: { borderWidth: 1, borderRadius: radius.md, padding: 14, fontSize: 14, marginBottom: 14 },
  textarea: { height: 120, textAlignVertical: 'top' },

  // Music modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingBottom: 36, maxHeight: '70%' },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(100,116,139,0.4)', alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', paddingHorizontal: 20, marginBottom: 12 },
  musicRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: 0.5 },
  musicIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  musicTitle: { fontSize: 14, fontWeight: '600' },
  musicArtist: { fontSize: 12, marginTop: 2 },
  musicDuration: { fontSize: 12 },
  modalClose: { margin: 16, padding: 14, borderRadius: radius.md, borderWidth: 1, alignItems: 'center' },

  // Custom schedule picker
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