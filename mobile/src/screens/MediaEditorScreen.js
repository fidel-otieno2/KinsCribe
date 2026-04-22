import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, StyleSheet, Image, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, ScrollView,
  Modal, FlatList, KeyboardAvoidingView, Platform,
  Animated,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AppText from '../components/AppText';
import { Video, ResizeMode } from 'expo-av';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius } from '../theme';
import { useTranslation } from '../i18n';
import Toast from '../components/Toast';
import useToast from '../hooks/useToast';
import { multipartPost, buildFileEntry } from '../api/upload';

// ── Curated music library ─────────────────────────────────────────────────────
const MUSIC_LIBRARY = [
  { id: 1, name: 'Family Memories', artist: 'KinsCribe', duration: '2:34', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', genre: '🎵 Soft' },
  { id: 2, name: 'Nostalgic Vibes', artist: 'KinsCribe', duration: '3:12', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', genre: '🎸 Acoustic' },
  { id: 3, name: 'Celebration', artist: 'KinsCribe', duration: '2:58', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', genre: '🎉 Upbeat' },
  { id: 4, name: 'Peaceful Moments', artist: 'KinsCribe', duration: '3:45', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3', genre: '🌿 Calm' },
  { id: 5, name: 'Heritage', artist: 'KinsCribe', duration: '2:20', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3', genre: '🏛️ Classic' },
  { id: 6, name: 'Together Forever', artist: 'KinsCribe', duration: '3:01', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3', genre: '❤️ Romantic' },
  { id: 7, name: 'Childhood Days', artist: 'KinsCribe', duration: '2:47', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3', genre: '🌈 Playful' },
  { id: 8, name: 'Golden Years', artist: 'KinsCribe', duration: '3:30', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3', genre: '✨ Elegant' },
];

// ── Music Picker Modal ────────────────────────────────────────────────────────
function MusicPicker({ visible, onClose, onSelect, selected }) {
  const [playing, setPlaying] = useState(null);
  const [sound, setSound] = useState(null);
  const [loadingId, setLoadingId] = useState(null);

  useEffect(() => {
    return () => { sound?.unloadAsync(); };
  }, [sound]);

  const previewTrack = async (track) => {
    if (playing === track.id) {
      await sound?.pauseAsync();
      setPlaying(null);
      return;
    }
    setLoadingId(track.id);
    try {
      if (sound) await sound.unloadAsync();
      const { sound: s } = await Audio.Sound.createAsync(
        { uri: track.url },
        { shouldPlay: true },
        (st) => { if (st.didJustFinish) setPlaying(null); }
      );
      setSound(s);
      setPlaying(track.id);
    } catch {} finally { setLoadingId(null); }
  };

  const handleSelect = (track) => {
    sound?.unloadAsync();
    setSound(null);
    setPlaying(null);
    onSelect(track);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={mp.overlay}>
        <View style={mp.sheet}>
          <View style={mp.handle} />
          <View style={mp.header}>
            <AppText style={mp.title}>🎵 Choose Music</AppText>
            <TouchableOpacity onPress={() => { sound?.unloadAsync(); setPlaying(null); onClose(); }}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {selected && (
            <TouchableOpacity style={mp.clearBtn} onPress={() => { onSelect(null); onClose(); }}>
              <Ionicons name="close-circle" size={16} color={colors.muted} />
              <AppText style={mp.clearText}>Remove music</AppText>
            </TouchableOpacity>
          )}

          <FlatList
            data={MUSIC_LIBRARY}
            keyExtractor={i => String(i.id)}
            contentContainerStyle={{ padding: 16, gap: 10 }}
            renderItem={({ item }) => {
              const isSelected = selected?.id === item.id;
              const isPlaying = playing === item.id;
              const isLoading = loadingId === item.id;
              return (
                <TouchableOpacity
                  style={[mp.track, isSelected && mp.trackSelected]}
                  onPress={() => handleSelect(item)}
                  activeOpacity={0.8}
                >
                  {isSelected && <LinearGradient colors={['rgba(124,58,237,0.2)', 'rgba(59,130,246,0.1)']} style={StyleSheet.absoluteFill} />}
                  <TouchableOpacity style={mp.playBtn} onPress={() => previewTrack(item)}>
                    <LinearGradient colors={isSelected ? ['#7c3aed', '#3b82f6'] : ['#1e293b', '#1e293b']} style={mp.playBtnGrad}>
                      {isLoading
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Ionicons name={isPlaying ? 'pause' : 'play'} size={16} color="#fff" />}
                    </LinearGradient>
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <AppText style={mp.trackName}>{item.name}</AppText>
                    <AppText style={mp.trackMeta}>{item.genre} · {item.duration}</AppText>
                  </View>
                  {isSelected && <Ionicons name="checkmark-circle" size={22} color="#7c3aed" />}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const mp = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.bgSecondary, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%' },
  handle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingBottom: 8 },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingBottom: 8 },
  clearText: { fontSize: 13, color: colors.muted },
  track: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(30,41,59,0.8)', borderRadius: radius.md, padding: 12, borderWidth: 1, borderColor: colors.border2, overflow: 'hidden' },
  trackSelected: { borderColor: '#7c3aed' },
  playBtn: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden' },
  playBtnGrad: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  trackName: { fontSize: 14, fontWeight: '600', color: colors.text },
  trackMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
});

// ── Location Search Modal ─────────────────────────────────────────────────────
function LocationPicker({ visible, onClose, onSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  const search = useCallback(async (text) => {
    setQuery(text);
    if (!text.trim() || text.length < 3) { setResults([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&limit=8&addressdetails=1`,
          { headers: { 'User-Agent': 'KinsCribeApp/1.0' } }
        );
        const data = await res.json();
        setResults(data.map(r => ({
          id: r.place_id,
          name: r.display_name.split(',').slice(0, 2).join(', '),
          full: r.display_name,
          type: r.type,
        })));
      } catch {} finally { setLoading(false); }
    }, 500);
  }, []);

  const QUICK = [
    '🏠 Home', '🏫 School', '🏥 Hospital', '⛪ Church',
    '🌳 Park', '🏖️ Beach', '🏔️ Mountain', '✈️ Airport',
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={lp.overlay}>
          <View style={lp.sheet}>
            <View style={lp.handle} />
            <View style={lp.header}>
              <AppText style={lp.title}>📍 Add Location</AppText>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={lp.searchRow}>
              <Ionicons name="search" size={18} color={colors.muted} />
              <TextInput
                style={lp.input}
                placeholder="Search for a place..."
                placeholderTextColor={colors.dim}
                value={query}
                onChangeText={search}
                autoFocus
              />
              {loading && <ActivityIndicator size="small" color={colors.primary} />}
              {query ? (
                <TouchableOpacity onPress={() => { setQuery(''); setResults([]); }}>
                  <Ionicons name="close-circle" size={18} color={colors.muted} />
                </TouchableOpacity>
              ) : null}
            </View>

            {results.length === 0 && !query && (
              <View style={lp.quickWrap}>
                <AppText style={lp.quickTitle}>Quick picks</AppText>
                <View style={lp.quickGrid}>
                  {QUICK.map(q => (
                    <TouchableOpacity key={q} style={lp.quickBtn} onPress={() => { onSelect(q); onClose(); }}>
                      <AppText style={lp.quickText}>{q}</AppText>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <FlatList
              data={results}
              keyExtractor={i => String(i.id)}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity style={lp.result} onPress={() => { onSelect(item.name); onClose(); }}>
                  <Ionicons name="location" size={18} color="#7c3aed" />
                  <View style={{ flex: 1 }}>
                    <AppText style={lp.resultName}>{item.name}</AppText>
                    <AppText style={lp.resultFull} numberOfLines={1}>{item.full}</AppText>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                query.length >= 3 && !loading
                  ? <AppText style={lp.noResults}>No places found</AppText>
                  : null
              }
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const lp = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.bgSecondary, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' },
  handle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingBottom: 8 },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginBottom: 12, backgroundColor: 'rgba(30,41,59,0.8)', borderRadius: radius.md, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border2 },
  input: { flex: 1, color: colors.text, fontSize: 15, paddingVertical: 12 },
  quickWrap: { paddingHorizontal: 16, paddingBottom: 16 },
  quickTitle: { fontSize: 12, color: colors.muted, fontWeight: '600', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickBtn: { backgroundColor: 'rgba(30,41,59,0.8)', borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: colors.border2 },
  quickText: { color: colors.text, fontSize: 13 },
  result: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  resultName: { fontSize: 14, fontWeight: '600', color: colors.text },
  resultFull: { fontSize: 12, color: colors.muted, marginTop: 2 },
  noResults: { color: colors.muted, textAlign: 'center', marginTop: 20, fontSize: 14 },
});

// ── Main MediaEditorScreen ────────────────────────────────────────────────────
export default function MediaEditorScreen({ route, navigation }) {
  const { t } = useTranslation();
  const [mediaFile, setMediaFile] = useState(route.params?.mediaFile ?? null);
  const [mediaType, setMediaType] = useState(route.params?.mediaType ?? null);

  useEffect(() => {
    if (!mediaFile) {
      ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        quality: 0.8,
      }).then(result => {
        if (result.canceled) { navigation.goBack(); return; }
        const asset = result.assets[0];
        setMediaFile(asset);
        setMediaType(asset.type === 'video' ? 'video' : 'image');
      }).catch(() => navigation.goBack());
    }
  }, []);
  const { toast, hide, success, error, info } = useToast();

  const videoRef = useRef(null);
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [music, setMusic] = useState(null);
  const [privacy, setPrivacy] = useState('family');
  const [storyDate, setStoryDate] = useState('');
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(false);
  const [showMusic, setShowMusic] = useState(false);
  const [showLocation, setShowLocation] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: uploadProgress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [uploadProgress]);

  const handlePost = async () => {
    if (!title.trim()) return info('Give your story a title');

    setLoading(true);
    setUploadProgress(10);

    try {
      const fd = new FormData();
      const ext = mediaType === 'image' ? 'jpg' : 'mp4';
      const mime = mediaType === 'image' ? 'image/jpeg' : 'video/mp4';
      fd.append('file', await buildFileEntry(mediaFile.uri, `media.${ext}`, mime));
      fd.append('title', title.trim());
      fd.append('content', caption.trim());
      fd.append('location', location);
      fd.append('privacy', privacy);
      fd.append('media_type', mediaType);
      if (storyDate) fd.append('story_date', storyDate);
      if (tags.trim()) fd.append('tags', tags.trim());
      if (music) {
        fd.append('music_url', music.url);
        fd.append('music_name', music.name);
      }

      setUploadProgress(30);
      const data = await multipartPost('/stories/', fd);
      setUploadProgress(100);

      setTimeout(() => {
        navigation.navigate('AIProcessing', { storyId: data.story?.id });
      }, 400);
    } catch (err) {
      error(err.message || 'Something went wrong. Try again.');
      setUploadProgress(0);
    } finally {
      setLoading(false);
    }
  };

  const privacyOptions = [
    { key: 'family', label: '👨‍👩‍👧 Family', color: '#10b981' },
    { key: 'private', label: '🔒 Private', color: '#6b7280' },
    { key: 'public', label: '🌍 Public', color: '#3b82f6' },
  ];

  return (
    <View style={s.container}>
      <Toast visible={toast.visible} type={toast.type} message={toast.message} onHide={hide} />
      <LinearGradient colors={['#0f172a', '#1e1040', '#0f172a']} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <AppText style={s.headerTitle}>New Story</AppText>
        <TouchableOpacity
          style={[s.postHeaderBtn, loading && { opacity: 0.5 }]}
          onPress={handlePost}
          disabled={loading}
        >
          <AppText style={s.postHeaderBtnText}>{loading ? 'Posting...' : 'Share'}</AppText>
        </TouchableOpacity>
      </View>

      {/* Upload progress bar */}
      {loading && (
        <View style={s.progressWrap}>
          <Animated.View style={[s.progressBar, {
            width: progressAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] })
          }]} />
        </View>
      )}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* Media preview */}
          <View style={s.previewWrap}>
            {mediaType === 'image' ? (
              <Image source={{ uri: mediaFile.uri }} style={s.preview} resizeMode="cover" />
            ) : (
              <Video
                ref={videoRef}
                source={{ uri: mediaFile.uri }}
                style={s.preview}
                resizeMode={ResizeMode.COVER}
                useNativeControls
                isLooping
                shouldPlay
              />
            )}

            {/* Music badge on preview */}
            {music && (
              <View style={s.musicBadge}>
                <Ionicons name="musical-notes" size={12} color="#fff" />
                <AppText style={s.musicBadgeText} numberOfLines={1}>{music.name}</AppText>
              </View>
            )}

            {/* Location badge on preview */}
            {location ? (
              <View style={s.locationBadge}>
                <Ionicons name="location" size={12} color="#fff" />
                <AppText style={s.locationBadgeText} numberOfLines={1}>{location}</AppText>
              </View>
            ) : null}
          </View>

          {/* Quick action pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pillsRow}>
            <TouchableOpacity style={[s.pill, music && s.pillActive]} onPress={() => setShowMusic(true)}>
              <Ionicons name="musical-notes" size={16} color={music ? '#fff' : colors.muted} />
              <AppText style={[s.pillText, music && { color: '#fff' }]}>{music ? music.name : 'Add Music'}</AppText>
            </TouchableOpacity>

            <TouchableOpacity style={[s.pill, location && s.pillActive]} onPress={() => setShowLocation(true)}>
              <Ionicons name="location-outline" size={16} color={location ? '#fff' : colors.muted} />
              <AppText style={[s.pillText, location && { color: '#fff' }]}>{location || 'Add Location'}</AppText>
            </TouchableOpacity>

            <TouchableOpacity style={s.pill} onPress={() => info('AI will auto-generate a caption after posting!')}>
              <Ionicons name="sparkles" size={16} color={colors.muted} />
              <AppText style={s.pillText}>AI Enhance</AppText>
            </TouchableOpacity>
          </ScrollView>

          {/* Form */}
          <View style={s.form}>
            <AppText style={s.label}>Title *</AppText>
            <TextInput
              style={s.input}
              placeholder="Give your story a title..."
              placeholderTextColor={colors.dim}
              value={title}
              onChangeText={setTitle}
            />

            <AppText style={s.label}>Caption</AppText>
            <TextInput
              style={[s.input, s.textarea]}
              placeholder="Write something about this memory..."
              placeholderTextColor={colors.dim}
              value={caption}
              onChangeText={setCaption}
              multiline
            />

            <AppText style={s.label}>Tags (comma separated)</AppText>
            <TextInput
              style={s.input}
              placeholder="family, vacation, 1990s..."
              placeholderTextColor={colors.dim}
              value={tags}
              onChangeText={setTags}
            />

            <AppText style={s.label}>When did this happen?</AppText>
            <TextInput
              style={s.input}
              placeholder="YYYY-MM-DD  e.g. 1995-06-15"
              placeholderTextColor={colors.dim}
              value={storyDate}
              onChangeText={setStoryDate}
              keyboardType="numeric"
            />

            <AppText style={s.label}>Privacy</AppText>
            <View style={s.privacyRow}>
              {privacyOptions.map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  style={[s.privacyBtn, privacy === opt.key && { borderColor: opt.color, backgroundColor: `${opt.color}22` }]}
                  onPress={() => setPrivacy(opt.key)}
                >
                  <AppText style={[s.privacyText, privacy === opt.key && { color: opt.color }]}>{opt.label}</AppText>
                </TouchableOpacity>
              ))}
            </View>

            {/* Post button */}
            <TouchableOpacity style={s.postBtn} onPress={handlePost} disabled={loading} activeOpacity={0.85}>
              <LinearGradient colors={['#7c3aed', '#3b82f6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.postBtnGrad}>
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <><Ionicons name="cloud-upload-outline" size={20} color="#fff" /><AppText style={s.postBtnText}>Share Story</AppText></>}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <MusicPicker visible={showMusic} onClose={() => setShowMusic(false)} onSelect={setMusic} selected={music} />
      <LocationPicker visible={showLocation} onClose={() => setShowLocation(false)} onSelect={setLocation} />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  postHeaderBtn: { backgroundColor: '#7c3aed', paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20 },
  postHeaderBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  progressWrap: { height: 3, backgroundColor: colors.border, overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: '#7c3aed' },
  scroll: { paddingBottom: 60 },
  previewWrap: { width: '100%', height: 380, backgroundColor: '#000', position: 'relative' },
  preview: { width: '100%', height: '100%' },
  musicBadge: { position: 'absolute', bottom: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, maxWidth: '55%' },
  musicBadgeText: { color: '#fff', fontSize: 11, fontWeight: '500' },
  locationBadge: { position: 'absolute', bottom: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, maxWidth: '45%' },
  locationBadgeText: { color: '#fff', fontSize: 11, fontWeight: '500' },
  pillsRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(30,41,59,0.8)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: colors.border2 },
  pillActive: { backgroundColor: 'rgba(124,58,237,0.3)', borderColor: '#7c3aed' },
  pillText: { color: colors.muted, fontSize: 13, fontWeight: '500', maxWidth: 120 },
  form: { paddingHorizontal: 16, paddingTop: 4 },
  label: { fontSize: 12, color: colors.muted, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: 'rgba(30,41,59,0.8)', borderWidth: 1, borderColor: colors.border2, borderRadius: radius.md, padding: 14, color: colors.text, fontSize: 14, marginBottom: 16 },
  textarea: { height: 100, textAlignVertical: 'top' },
  privacyRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  privacyBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: radius.md, backgroundColor: 'rgba(30,41,59,0.6)', borderWidth: 1, borderColor: colors.border2 },
  privacyText: { fontSize: 12, fontWeight: '600', color: colors.muted },
  postBtn: { borderRadius: radius.md, overflow: 'hidden', marginBottom: 20 },
  postBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16 },
  postBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
