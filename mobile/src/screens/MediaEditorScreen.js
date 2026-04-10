import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image, ScrollView,
  TextInput, Alert, ActivityIndicator, Dimensions, FlatList,
  KeyboardAvoidingView, Platform
} from 'react-native';
import { Video, Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Location from 'expo-location';
import * as DocumentPicker from 'expo-document-picker';
import { colors, radius } from '../theme';
import api from '../api/axios';
import { multipartPost } from '../api/upload';

const { width: W } = Dimensions.get('window');

// iTunes Search API — free, no key, works globally
const ITUNES_SEARCH = (q) =>
  `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=25`;
const ITUNES_TRENDING = () =>
  `https://itunes.apple.com/search?term=top+hits+2024&media=music&entity=song&limit=25`;

const FILTERS = [
  { id: 'none', label: 'Original', actions: [] },
  { id: 'bright', label: 'Bright', actions: [{ brightness: 0.15 }] },
  { id: 'contrast', label: 'Vivid', actions: [{ contrast: 1.3 }] },
  { id: 'warm', label: 'Warm', actions: [{ saturation: 1.4 }] },
  { id: 'fade', label: 'Fade', actions: [{ brightness: 0.05, contrast: 0.85 }] },
  { id: 'cool', label: 'Cool', actions: [{ saturation: 0.7 }] },
  { id: 'sharp', label: 'Sharp', actions: [{ contrast: 1.5, saturation: 1.2 }] },
  { id: 'mellow', label: 'Mellow', actions: [{ brightness: 0.1, saturation: 0.8 }] },
];

const STEPS = ['effects', 'music', 'location', 'details'];

export default function MediaEditorScreen({ route, navigation }) {
  const { mediaFile, mediaType } = route.params;
  const isVideo = mediaType === 'video';

  const [step, setStep] = useState(0);
  const [selectedFilter, setSelectedFilter] = useState('none');
  const [filteredUri, setFilteredUri] = useState(mediaFile.uri);
  const [applyingFilter, setApplyingFilter] = useState(false);
  const [selectedMusic, setSelectedMusic] = useState(null); // { id, name, artist, uri, artwork }
  const [musicFile, setMusicFile] = useState(null);         // local file picked from library
  const [location, setLocation] = useState('');
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [searchingLocation, setSearchingLocation] = useState(false);
  const locationTimer = useRef(null);
  const [form, setForm] = useState({ title: '', content: '', privacy: 'family', story_date: '' });
  const [posting, setPosting] = useState(false);

  // Music search state
  const [musicQuery, setMusicQuery] = useState('');
  const [musicResults, setMusicResults] = useState([]);
  const [musicLoading, setMusicLoading] = useState(false);
  const [previewSound, setPreviewSound] = useState(null);
  const [previewingId, setPreviewingId] = useState(null);
  const searchTimer = useRef(null);
  const videoRef = useRef(null);

  // Load trending on mount
  useEffect(() => {
    loadTrending();
    return () => { previewSound?.unloadAsync(); };
  }, []);

  const loadTrending = async () => {
    setMusicLoading(true);
    try {
      const res = await fetch(ITUNES_TRENDING());
      const json = await res.json();
      setMusicResults(json.results || []);
    } catch {} finally { setMusicLoading(false); }
  };

  const searchMusic = useCallback(async (q) => {
    if (!q.trim()) { loadTrending(); return; }
    setMusicLoading(true);
    try {
      const res = await fetch(ITUNES_SEARCH(q));
      const json = await res.json();
      setMusicResults(json.results || []);
    } catch {} finally { setMusicLoading(false); }
  }, []);

  const onQueryChange = (text) => {
    setMusicQuery(text);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => searchMusic(text), 500);
  };

  const togglePreview = async (track) => {
    const trackId = String(track.trackId);
    if (previewingId === trackId) {
      await previewSound?.pauseAsync();
      setPreviewingId(null);
      return;
    }
    if (!track.previewUrl) return;
    try {
      await previewSound?.unloadAsync();
      const { sound } = await Audio.Sound.createAsync(
        { uri: track.previewUrl },
        { shouldPlay: true },
        (status) => { if (status.didJustFinish) setPreviewingId(null); }
      );
      setPreviewSound(sound);
      setPreviewingId(trackId);
    } catch {}
  };

  const selectTrack = async (track) => {
    await previewSound?.unloadAsync();
    setPreviewingId(null);
    if (!track) { setSelectedMusic(null); setMusicFile(null); return; }
    setSelectedMusic({
      id: String(track.trackId),
      name: track.trackName,
      artist: track.artistName,
      uri: track.previewUrl,
      artwork: track.artworkUrl100?.replace('100x100', '300x300'),
    });
    setMusicFile(null);
  };

  const pickMusicFile = async () => {
    await previewSound?.unloadAsync();
    setPreviewingId(null);
    const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
    if (!result.canceled && result.assets?.[0]) {
      const f = result.assets[0];
      setMusicFile(f);
      setSelectedMusic({ id: 'local', name: f.name || 'My Music', artist: 'Local file', uri: f.uri, artwork: null });
    }
  };

  const applyFilter = useCallback(async (filter) => {
    if (isVideo || filter.id === 'none') {
      setSelectedFilter(filter.id);
      setFilteredUri(mediaFile.uri);
      return;
    }
    if (filter.actions.length === 0) {
      setSelectedFilter(filter.id);
      setFilteredUri(mediaFile.uri);
      return;
    }
    setApplyingFilter(true);
    setSelectedFilter(filter.id);
    try {
      const result = await ImageManipulator.manipulateAsync(
        mediaFile.uri,
        [],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
      );
      setFilteredUri(result.uri);
    } catch {
      setFilteredUri(mediaFile.uri);
    } finally {
      setApplyingFilter(false);
    }
  }, [isVideo, mediaFile.uri]);

  const fetchLocation = async () => {
    setFetchingLocation(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Enable location access in your device settings.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
        { headers: { 'Accept-Language': 'en', 'User-Agent': 'KinsCribeApp/1.0' } }
      );
      const json = await res.json();
      const a = json.address || {};
      const city = a.city || a.town || a.village || a.county || '';
      const country = a.country || '';
      const built = [city, country].filter(Boolean).join(', ');
      if (built) setLocation(built);
      setLocationSuggestions([]);
    } catch {
      Alert.alert('Location Error', 'Could not get your location. Try typing it manually.');
    } finally {
      setFetchingLocation(false);
    }
  };

  const searchLocationSuggestions = async (query) => {
    if (!query.trim() || query.length < 3) { setLocationSuggestions([]); return; }
    setSearchingLocation(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=6&addressdetails=1`,
        { headers: { 'Accept-Language': 'en', 'User-Agent': 'KinsCribeApp/1.0' } }
      );
      const json = await res.json();
      const suggestions = json
        .map(item => {
          const a = item.address || {};
          const city = a.city || a.town || a.village || a.county || '';
          const region = a.state || a.region || '';
          const country = a.country || '';
          return [city, region, country].filter(Boolean).join(', ');
        })
        .filter((v, i, arr) => v && arr.indexOf(v) === i);
      setLocationSuggestions(suggestions);
    } catch {
      setLocationSuggestions([]);
    } finally {
      setSearchingLocation(false);
    }
  };

  const onLocationChange = (text) => {
    setLocation(text);
    clearTimeout(locationTimer.current);
    locationTimer.current = setTimeout(() => searchLocationSuggestions(text), 600);
  };

  const pickSuggestion = (suggestion) => {
    setLocation(suggestion);
    setLocationSuggestions([]);
  };

  const handlePost = async () => {
    if (!form.title.trim()) return Alert.alert('Title Required', 'Give your story a title');
    await previewSound?.unloadAsync();
    setPosting(true);
    try {
      const fd = new FormData();
      fd.append('title', form.title);
      fd.append('content', form.content || '');
      fd.append('privacy', form.privacy);
      if (form.story_date) fd.append('story_date', form.story_date);
      if (location) fd.append('location', location);
      fd.append('file', {
        uri: filteredUri,
        name: isVideo ? 'video.mp4' : 'photo.jpg',
        type: isVideo ? 'video/mp4' : 'image/jpeg',
      });
      if (musicFile) {
        fd.append('music', {
          uri: musicFile.uri,
          name: musicFile.name || 'music.mp3',
          type: musicFile.mimeType || 'audio/mpeg',
        });
      } else if (selectedMusic && selectedMusic.id !== 'local') {
        fd.append('music_url', selectedMusic.uri);
      }

      // Use native fetch via helper — axios corrupts multipart boundary in React Native
      const data = await multipartPost('/stories/', fd);
      navigation.replace('AIProcessing', { storyId: data.story?.id });
    } catch (err) {
      Alert.alert('Post Failed', err.message || 'Network error. Try again.');
    } finally {
      setPosting(false);
    }
  };

  const currentStep = STEPS[step];

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <LinearGradient colors={['#000', '#0f172a']} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => step === 0 ? navigation.goBack() : setStep(s => s - 1)} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>
          {currentStep === 'effects' ? 'Edit' : currentStep === 'music' ? 'Music' : currentStep === 'location' ? 'Location' : 'Details'}
        </Text>
        {step < STEPS.length - 1 ? (
          <TouchableOpacity style={s.nextBtn} onPress={() => setStep(s => s + 1)}>
            <Text style={s.nextBtnText}>Next</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={s.nextBtn} onPress={handlePost} disabled={posting}>
            {posting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.nextBtnText}>Share</Text>}
          </TouchableOpacity>
        )}
      </View>

      {/* Step indicator */}
      <View style={s.stepIndicator}>
        {STEPS.map((st, i) => (
          <View key={st} style={[s.stepDot, i <= step && s.stepDotActive, i === step && s.stepDotCurrent]} />
        ))}
      </View>

      {/* Media preview */}
      {currentStep === 'effects' && (
        <View style={s.mediaWrap}>
          {isVideo ? (
            <Video
              ref={videoRef}
              source={{ uri: mediaFile.uri }}
              style={s.mediaPreview}
              resizeMode="cover"
              isLooping
              shouldPlay
              isMuted
            />
          ) : (
            <View style={s.mediaPreview}>
              {applyingFilter && (
                <View style={s.filterOverlay}>
                  <ActivityIndicator color="#fff" />
                </View>
              )}
              <Image source={{ uri: filteredUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            </View>
          )}

          {/* Filter strip */}
          <View style={s.filterStrip}>
            <FlatList
              data={FILTERS}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={f => f.id}
              contentContainerStyle={{ paddingHorizontal: 12, gap: 12 }}
              renderItem={({ item }) => (
                <TouchableOpacity style={s.filterItem} onPress={() => applyFilter(item)}>
                  <View style={[s.filterThumb, selectedFilter === item.id && s.filterThumbActive]}>
                    {!isVideo ? (
                      <Image source={{ uri: mediaFile.uri }} style={s.filterThumbImg} />
                    ) : (
                      <View style={[s.filterThumbImg, { backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center' }]}>
                        <Ionicons name="videocam" size={16} color={colors.muted} />
                      </View>
                    )}
                    {selectedFilter === item.id && (
                      <View style={s.filterCheckmark}>
                        <Ionicons name="checkmark" size={10} color="#fff" />
                      </View>
                    )}
                  </View>
                  <Text style={[s.filterLabel, selectedFilter === item.id && s.filterLabelActive]}>{item.label}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      )}

      {currentStep === 'music' && (
        <View style={s.stepContent}>
          {/* Selected music banner */}
          <View style={s.musicBanner}>
            {isVideo
              ? <View style={s.musicBannerThumb}><Ionicons name="videocam" size={22} color={colors.muted} /></View>
              : <Image source={{ uri: filteredUri }} style={s.musicBannerThumb} />}
            <View style={s.musicBannerInfo}>
              <Ionicons name={selectedMusic ? 'musical-notes' : 'musical-notes-outline'} size={14} color={selectedMusic ? '#a78bfa' : colors.dim} />
              <Text style={s.musicBannerText} numberOfLines={1}>
                {selectedMusic ? `${selectedMusic.name} · ${selectedMusic.artist}` : 'No music selected'}
              </Text>
            </View>
            {selectedMusic && (
              <TouchableOpacity onPress={() => selectTrack(null)} style={s.musicClearBtn}>
                <Ionicons name="close-circle" size={18} color={colors.muted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Search bar */}
          <View style={s.musicSearchWrap}>
            <View style={s.musicSearchBar}>
              <Ionicons name="search" size={18} color={colors.muted} />
              <TextInput
                style={s.musicSearchInput}
                placeholder="Search any song, artist, genre..."
                placeholderTextColor={colors.dim}
                value={musicQuery}
                onChangeText={onQueryChange}
                returnKeyType="search"
                onSubmitEditing={() => searchMusic(musicQuery)}
              />
              {musicQuery.length > 0 && (
                <TouchableOpacity onPress={() => { setMusicQuery(''); loadTrending(); }}>
                  <Ionicons name="close-circle" size={16} color={colors.dim} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Pick from device */}
          <TouchableOpacity style={s.pickFromDevice} onPress={pickMusicFile}>
            <View style={s.pickFromDeviceIcon}>
              <Ionicons name="folder-open-outline" size={18} color="#7c3aed" />
            </View>
            <Text style={s.pickFromDeviceText}>Pick from my device</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.dim} />
          </TouchableOpacity>

          {/* Results */}
          {musicLoading ? (
            <View style={s.musicLoadingWrap}>
              <ActivityIndicator color="#7c3aed" />
              <Text style={s.musicLoadingText}>Finding music...</Text>
            </View>
          ) : (
            <FlatList
              data={musicResults}
              keyExtractor={t => String(t.trackId)}
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
              ListHeaderComponent={
                <Text style={s.resultsHeader}>
                  {musicQuery ? `Results for "${musicQuery}"` : '🔥 Trending'}
                </Text>
              }
              ListEmptyComponent={
                <Text style={s.noResults}>No results found. Try a different search.</Text>
              }
              renderItem={({ item }) => {
                const trackId = String(item.trackId);
                const isSelected = selectedMusic?.id === trackId;
                const isPreviewing = previewingId === trackId;
                return (
                  <TouchableOpacity
                    style={[s.trackRow, isSelected && s.trackRowSelected]}
                    onPress={() => selectTrack(item)}
                    activeOpacity={0.75}
                  >
                    {/* Artwork */}
                    <View style={s.trackArtwork}>
                      {item.artworkUrl100
                        ? <Image source={{ uri: item.artworkUrl100 }} style={s.trackArtworkImg} />
                        : <LinearGradient colors={['#7c3aed', '#3b82f6']} style={s.trackArtworkImg}>
                            <Ionicons name="musical-notes" size={18} color="#fff" />
                          </LinearGradient>}
                      {isSelected && (
                        <View style={s.trackSelectedOverlay}>
                          <Ionicons name="checkmark" size={14} color="#fff" />
                        </View>
                      )}
                    </View>

                    {/* Info */}
                    <View style={s.trackInfo}>
                      <Text style={[s.trackName, isSelected && s.trackNameSelected]} numberOfLines={1}>{item.trackName}</Text>
                      <Text style={s.trackArtist} numberOfLines={1}>{item.artistName}</Text>
                      {item.primaryGenreName ? (
                        <Text style={s.trackGenre} numberOfLines={1}>{item.primaryGenreName}</Text>
                      ) : null}
                    </View>

                    {/* Preview button */}
                    <TouchableOpacity
                      style={[s.previewBtn, isPreviewing && s.previewBtnActive]}
                      onPress={() => togglePreview(item)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons
                        name={isPreviewing ? 'pause' : 'play'}
                        size={16}
                        color={isPreviewing ? '#fff' : colors.muted}
                      />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      )}

      {currentStep === 'location' && (
        <ScrollView style={s.stepContent} contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
          <View style={s.locationCard}>
            <LinearGradient colors={['rgba(124,58,237,0.15)', 'rgba(59,130,246,0.1)']} style={StyleSheet.absoluteFill} />
            <Ionicons name="location" size={32} color="#7c3aed" />
            <Text style={s.locationTitle}>Add Location</Text>
            <Text style={s.locationSub}>Let family know where this memory was made</Text>
          </View>

          <TouchableOpacity style={s.autoLocBtn} onPress={fetchLocation} disabled={fetchingLocation}>
            <LinearGradient colors={['#7c3aed', '#3b82f6']} style={s.autoLocGrad}>
              {fetchingLocation
                ? <><ActivityIndicator color="#fff" size="small" /><Text style={s.autoLocText}>Getting location...</Text></>
                : <><Ionicons name="navigate" size={18} color="#fff" /><Text style={s.autoLocText}>Use Current Location</Text></>}
            </LinearGradient>
          </TouchableOpacity>

          <Text style={s.label}>Search a location</Text>
          <View style={s.locationSearchWrap}>
            <View style={s.locationSearchBar}>
              <Ionicons name="search" size={16} color={colors.muted} />
              <TextInput
                style={s.locationSearchInput}
                placeholder="e.g. Nairobi, Paris, New York..."
                placeholderTextColor={colors.dim}
                value={location}
                onChangeText={onLocationChange}
                returnKeyType="search"
              />
              {searchingLocation && <ActivityIndicator size="small" color={colors.muted} />}
              {location.length > 0 && !searchingLocation && (
                <TouchableOpacity onPress={() => { setLocation(''); setLocationSuggestions([]); }}>
                  <Ionicons name="close-circle" size={16} color={colors.dim} />
                </TouchableOpacity>
              )}
            </View>

            {/* Suggestions dropdown */}
            {locationSuggestions.length > 0 && (
              <View style={s.suggestionsBox}>
                {locationSuggestions.map((sug, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[s.suggestionRow, i < locationSuggestions.length - 1 && s.suggestionBorder]}
                    onPress={() => pickSuggestion(sug)}
                  >
                    <Ionicons name="location-outline" size={14} color="#7c3aed" />
                    <Text style={s.suggestionText}>{sug}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {location && locationSuggestions.length === 0 ? (
            <View style={s.locationPreview}>
              <Ionicons name="location" size={16} color="#7c3aed" />
              <Text style={s.locationPreviewText}>{location}</Text>
              <TouchableOpacity onPress={() => setLocation('')}>
                <Ionicons name="close-circle" size={16} color={colors.muted} />
              </TouchableOpacity>
            </View>
          ) : null}
        </ScrollView>
      )}

      {currentStep === 'details' && (
        <ScrollView style={s.stepContent} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          {/* Summary card */}
          <View style={s.summaryCard}>
            {isVideo
              ? <View style={[s.summaryThumb, { alignItems: 'center', justifyContent: 'center' }]}><Ionicons name="videocam" size={28} color={colors.muted} /></View>
              : <Image source={{ uri: filteredUri }} style={s.summaryThumb} />}
            <View style={s.summaryInfo}>
              {selectedFilter !== 'none' && <Text style={s.summaryTag}>✨ {FILTERS.find(f => f.id === selectedFilter)?.label}</Text>}
              {selectedMusic && <Text style={s.summaryTag}>🎵 {selectedMusic.name}</Text>}
              {location ? <Text style={s.summaryTag}>📍 {location}</Text> : null}
            </View>
          </View>

          <Text style={s.label}>Title *</Text>
          <TextInput style={s.input} placeholder="Give your story a title..."
            placeholderTextColor={colors.dim} value={form.title}
            onChangeText={v => setForm(f => ({ ...f, title: v }))} />

          <Text style={s.label}>Caption (optional)</Text>
          <TextInput style={[s.input, s.textarea]} multiline placeholder="Write a caption..."
            placeholderTextColor={colors.dim} value={form.content}
            onChangeText={v => setForm(f => ({ ...f, content: v }))} />

          <Text style={s.label}>When did this happen? (optional)</Text>
          <TextInput style={s.input} placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.dim} value={form.story_date}
            onChangeText={v => setForm(f => ({ ...f, story_date: v }))} />

          <Text style={s.label}>Privacy</Text>
          <View style={s.privacyRow}>
            {['family', 'private', 'public'].map(p => (
              <TouchableOpacity key={p} style={[s.privacyTab, form.privacy === p && s.privacyTabActive]}
                onPress={() => setForm(f => ({ ...f, privacy: p }))}>
                <Text style={[s.privacyText, form.privacy === p && { color: '#fff' }]}>
                  {p === 'family' ? '👨👩👧 Family' : p === 'private' ? '🔒 Private' : '🌍 Public'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={s.postBtn} onPress={handlePost} disabled={posting} activeOpacity={0.85}>
            <LinearGradient colors={['#7c3aed', '#3b82f6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.postBtnGrad}>
              {posting
                ? <ActivityIndicator color="#fff" />
                : <><Ionicons name="sparkles" size={18} color="#fff" /><Text style={s.postBtnText}>Post & Enhance with AI</Text></>}
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12, gap: 12 },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#fff', textAlign: 'center' },
  nextBtn: { backgroundColor: '#7c3aed', paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, minWidth: 60, alignItems: 'center' },
  nextBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  stepIndicator: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingBottom: 8 },
  stepDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.dim },
  stepDotActive: { backgroundColor: 'rgba(124,58,237,0.5)' },
  stepDotCurrent: { backgroundColor: '#7c3aed', width: 20 },
  mediaWrap: { flex: 1 },
  mediaPreview: { width: W, height: W * 1.1, backgroundColor: '#000', overflow: 'hidden' },
  filterOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  filterStrip: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingVertical: 12, backgroundColor: 'rgba(0,0,0,0.7)' },
  filterItem: { alignItems: 'center', gap: 4 },
  filterThumb: { width: 60, height: 60, borderRadius: 8, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  filterThumbActive: { borderColor: '#fff' },
  filterThumbImg: { width: '100%', height: '100%' },
  filterCheckmark: { position: 'absolute', bottom: 2, right: 2, backgroundColor: '#7c3aed', borderRadius: 8, width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  filterLabel: { fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },
  filterLabelActive: { color: '#fff', fontWeight: '700' },
  stepContent: { flex: 1 },
  musicBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  musicBannerThumb: { width: 44, height: 44, borderRadius: 8, backgroundColor: '#1e293b', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  musicBannerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  musicBannerText: { flex: 1, fontSize: 13, color: colors.muted, fontWeight: '500' },
  musicClearBtn: { padding: 4 },
  musicSearchWrap: { paddingHorizontal: 16, paddingVertical: 10 },
  musicSearchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(30,41,59,0.9)', borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: colors.border2 },
  musicSearchInput: { flex: 1, color: colors.text, fontSize: 14 },
  pickFromDevice: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: radius.md, backgroundColor: 'rgba(124,58,237,0.08)', borderWidth: 1, borderColor: 'rgba(124,58,237,0.2)' },
  pickFromDeviceIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(124,58,237,0.15)', alignItems: 'center', justifyContent: 'center' },
  pickFromDeviceText: { flex: 1, fontSize: 14, color: colors.text, fontWeight: '600' },
  musicLoadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 40 },
  musicLoadingText: { color: colors.muted, fontSize: 13 },
  resultsHeader: { fontSize: 13, color: colors.muted, fontWeight: '600', marginBottom: 10, marginTop: 4 },
  noResults: { color: colors.dim, textAlign: 'center', marginTop: 30, fontSize: 13 },
  trackRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  trackRowSelected: { backgroundColor: 'rgba(124,58,237,0.08)', marginHorizontal: -16, paddingHorizontal: 16, borderRadius: 0 },
  trackArtwork: { width: 48, height: 48, borderRadius: 8, overflow: 'hidden', position: 'relative' },
  trackArtworkImg: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  trackSelectedOverlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(124,58,237,0.6)', alignItems: 'center', justifyContent: 'center' },
  trackInfo: { flex: 1 },
  trackName: { fontSize: 14, color: colors.text, fontWeight: '600', marginBottom: 2 },
  trackNameSelected: { color: '#a78bfa' },
  trackArtist: { fontSize: 12, color: colors.muted },
  trackGenre: { fontSize: 11, color: colors.dim, marginTop: 2 },
  previewBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(30,41,59,0.8)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border2 },
  previewBtnActive: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  locationCard: { borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)', padding: 24, alignItems: 'center', gap: 8, marginBottom: 20 },
  locationTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  locationSub: { fontSize: 13, color: colors.muted, textAlign: 'center' },
  autoLocBtn: { borderRadius: radius.md, overflow: 'hidden', marginBottom: 20 },
  autoLocGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14 },
  autoLocText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  locationSearchWrap: { marginBottom: 16 },
  locationSearchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(30,41,59,0.9)', borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: colors.border2 },
  locationSearchInput: { flex: 1, color: colors.text, fontSize: 14 },
  suggestionsBox: { backgroundColor: 'rgba(15,23,42,0.98)', borderWidth: 1, borderTopWidth: 0, borderColor: colors.border2, borderBottomLeftRadius: radius.md, borderBottomRightRadius: radius.md, overflow: 'hidden' },
  suggestionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 13 },
  suggestionBorder: { borderBottomWidth: 0.5, borderBottomColor: colors.border },
  suggestionText: { flex: 1, fontSize: 14, color: colors.text },
  locationPreview: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(124,58,237,0.1)', padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)' },
  locationPreviewText: { flex: 1, color: colors.text, fontSize: 14 },
  summaryCard: { flexDirection: 'row', gap: 12, backgroundColor: 'rgba(30,41,59,0.6)', borderRadius: radius.md, padding: 12, marginBottom: 20, borderWidth: 1, borderColor: colors.border2 },
  summaryThumb: { width: 70, height: 70, borderRadius: 8 },
  summaryInfo: { flex: 1, gap: 4, justifyContent: 'center' },
  summaryTag: { fontSize: 12, color: colors.muted, fontWeight: '500' },
  label: { fontSize: 13, color: colors.muted, marginBottom: 8, fontWeight: '500' },
  input: { backgroundColor: 'rgba(30,41,59,0.8)', borderWidth: 1, borderColor: colors.border2, borderRadius: radius.md, padding: 14, color: colors.text, fontSize: 14, marginBottom: 16 },
  textarea: { height: 100, textAlignVertical: 'top' },
  privacyRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  privacyTab: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: radius.md, backgroundColor: 'rgba(30,41,59,0.6)', borderWidth: 1, borderColor: colors.border2 },
  privacyTabActive: { backgroundColor: '#10b981', borderColor: '#10b981' },
  privacyText: { fontSize: 12, fontWeight: '600', color: colors.muted },
  postBtn: { borderRadius: radius.md, overflow: 'hidden' },
  postBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 },
  postBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
