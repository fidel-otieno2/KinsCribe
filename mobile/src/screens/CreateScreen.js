import { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, Image, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { colors, radius } from '../theme';

const { width } = Dimensions.get('window');

const MODES = [
  { key: 'post', label: 'Post', icon: 'grid-outline', desc: 'Share to your public feed' },
  { key: 'story', label: 'Story', icon: 'time-outline', desc: '24-hour disappearing story' },
  { key: 'family', label: 'Family Story', icon: 'people-outline', desc: 'Share inside your family' },
];

const PRIVACY_OPTS = [
  { key: 'public', label: 'Public', icon: 'globe-outline', color: '#3b82f6' },
  { key: 'connections', label: 'Connections', icon: 'people-outline', color: '#7c3aed' },
  { key: 'family', label: 'Family', icon: 'home-outline', color: '#10b981' },
];

export default function CreateScreen({ navigation }) {
  const { user } = useAuth();
  const [mode, setMode] = useState('post');
  const [mediaFiles, setMediaFiles] = useState([]); // [{uri, type}]
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [privacy, setPrivacy] = useState('public');
  const [textContent, setTextContent] = useState('');
  const [bgColor, setBgColor] = useState('#7c3aed');
  const [loading, setLoading] = useState(false);

  // Family story fields
  const [familyTitle, setFamilyTitle] = useState('');
  const [familyContent, setFamilyContent] = useState('');
  const [storyDate, setStoryDate] = useState('');
  const [familyPrivacy, setFamilyPrivacy] = useState('family');

  const BG_COLORS = ['#7c3aed', '#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#e11d48', '#0f172a'];

  const pickMedia = useCallback(async (allowMultiple = false) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permission Required');
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
      setMediaFiles(allowMultiple ? [...mediaFiles, ...files].slice(0, 10) : files);
    }
  }, [mediaFiles]);

  const takePhoto = useCallback(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permission Required');
    const result = await ImagePicker.launchCameraAsync({ quality: 0.9 });
    if (!result.canceled) {
      const a = result.assets?.[0] || result;
      setMediaFiles([{ uri: a.uri, type: 'image', name: 'photo.jpg' }]);
    }
  }, []);

  const removeMedia = (idx) => setMediaFiles(mediaFiles.filter((_, i) => i !== idx));

  const handlePost = async () => {
    if (mode === 'family') {
      if (!familyTitle.trim()) return Alert.alert('Title required');
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
        setFamilyTitle(''); setFamilyContent(''); setMediaFiles([]);
        navigation.navigate('AIProcessing', { storyId: data.story?.id });
      } catch (err) {
        Alert.alert('Failed', err.response?.data?.error || 'Try again');
      } finally { setLoading(false); }
      return;
    }

    if (mode === 'story') {
      setLoading(true);
      try {
        const formData = new FormData();
        formData.append('privacy', privacy);
        formData.append('bg_color', bgColor);
        if (textContent) formData.append('text_content', textContent);
        if (mediaFiles[0]) {
          formData.append('file', { uri: mediaFiles[0].uri, type: mediaFiles[0].type === 'video' ? 'video/mp4' : 'image/jpeg', name: 'story_media.jpg' });
        }
        await api.post('/pstories/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        setMediaFiles([]); setTextContent('');
        Alert.alert('✅ Story posted!', 'Your story will disappear in 24 hours');
        navigation.navigate('Feed');
      } catch (err) {
        Alert.alert('Failed', err.response?.data?.error || 'Try again');
      } finally { setLoading(false); }
      return;
    }

    // Post mode
    if (!caption.trim() && mediaFiles.length === 0) return Alert.alert('Add a caption or media');
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('caption', caption);
      formData.append('privacy', privacy);
      if (location) formData.append('location', location);
      if (hashtags) formData.append('hashtags', hashtags);
      if (mediaFiles.length === 1) {
        formData.append('file', { uri: mediaFiles[0].uri, type: mediaFiles[0].type === 'video' ? 'video/mp4' : 'image/jpeg', name: 'media.jpg' });
      } else if (mediaFiles.length > 1) {
        mediaFiles.forEach((f, i) => {
          formData.append('files', { uri: f.uri, type: f.type === 'video' ? 'video/mp4' : 'image/jpeg', name: `media_${i}.jpg` });
        });
      }
      await api.post('/posts/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setCaption(''); setMediaFiles([]); setLocation(''); setHashtags('');
      navigation.navigate('Feed');
    } catch (err) {
      Alert.alert('Failed', err.response?.data?.error || 'Try again');
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <LinearGradient colors={['#0f172a', '#1e1040', '#0f172a']} style={StyleSheet.absoluteFill} />

      <View style={s.header}>
        <Text style={s.headerTitle}>Create</Text>
        <TouchableOpacity
          style={[s.postBtn, loading && { opacity: 0.5 }]}
          onPress={handlePost}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={s.postBtnText}>Share</Text>}
        </TouchableOpacity>
      </View>

      {/* Mode selector */}
      <View style={s.modeRow}>
        {MODES.map(m => (
          <TouchableOpacity
            key={m.key}
            style={[s.modeBtn, mode === m.key && s.modeBtnActive]}
            onPress={() => setMode(m.key)}
          >
            <Ionicons name={m.icon} size={18} color={mode === m.key ? '#fff' : colors.muted} />
            <Text style={[s.modeBtnText, mode === m.key && { color: '#fff' }]}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ── POST MODE ── */}
        {mode === 'post' && (
          <>
            {/* Media preview */}
            {mediaFiles.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.mediaPreviewRow}>
                {mediaFiles.map((f, i) => (
                  <View key={i} style={s.mediaThumb}>
                    <Image source={{ uri: f.uri }} style={s.mediaThumbImg} resizeMode="cover" />
                    <TouchableOpacity style={s.removeMedia} onPress={() => removeMedia(i)}>
                      <Ionicons name="close-circle" size={20} color="#fff" />
                    </TouchableOpacity>
                    {f.type === 'video' && (
                      <View style={s.videoIcon}><Ionicons name="play" size={14} color="#fff" /></View>
                    )}
                  </View>
                ))}
                {mediaFiles.length < 10 && (
                  <TouchableOpacity style={s.addMoreBtn} onPress={() => pickMedia(true)}>
                    <Ionicons name="add" size={28} color={colors.muted} />
                  </TouchableOpacity>
                )}
              </ScrollView>
            )}

            {/* Media buttons */}
            {mediaFiles.length === 0 && (
              <View style={s.mediaButtons}>
                <TouchableOpacity style={s.mediaBtn} onPress={takePhoto} activeOpacity={0.85}>
                  <LinearGradient colors={['#7c3aed', '#3b82f6']} style={s.mediaBtnGrad}>
                    <Ionicons name="camera" size={26} color="#fff" />
                    <Text style={s.mediaBtnLabel}>Camera</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity style={s.mediaBtn} onPress={() => pickMedia(true)} activeOpacity={0.85}>
                  <LinearGradient colors={['#3b82f6', '#06b6d4']} style={s.mediaBtnGrad}>
                    <Ionicons name="images" size={26} color="#fff" />
                    <Text style={s.mediaBtnLabel}>Gallery</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}

            <TextInput
              style={s.captionInput}
              placeholder="Write a caption..."
              placeholderTextColor={colors.dim}
              multiline
              value={caption}
              onChangeText={setCaption}
              maxLength={2200}
            />

            <View style={s.fieldRow}>
              <Ionicons name="location-outline" size={18} color={colors.muted} />
              <TextInput style={s.fieldInput} placeholder="Add location" placeholderTextColor={colors.dim} value={location} onChangeText={setLocation} />
            </View>

            <View style={s.fieldRow}>
              <Ionicons name="pricetag-outline" size={18} color={colors.muted} />
              <TextInput style={s.fieldInput} placeholder="#hashtags" placeholderTextColor={colors.dim} value={hashtags} onChangeText={setHashtags} autoCapitalize="none" />
            </View>

            <Text style={s.label}>Audience</Text>
            <View style={s.privacyRow}>
              {PRIVACY_OPTS.map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  style={[s.privacyBtn, privacy === opt.key && { borderColor: opt.color, backgroundColor: `${opt.color}22` }]}
                  onPress={() => setPrivacy(opt.key)}
                >
                  <Ionicons name={opt.icon} size={14} color={privacy === opt.key ? opt.color : colors.muted} />
                  <Text style={[s.privacyText, privacy === opt.key && { color: opt.color }]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* ── STORY MODE ── */}
        {mode === 'story' && (
          <>
            {mediaFiles[0] ? (
              <View style={s.storyPreview}>
                <Image source={{ uri: mediaFiles[0].uri }} style={s.storyPreviewImg} resizeMode="cover" />
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

            <View style={s.storyActions}>
              <TouchableOpacity style={s.storyActionBtn} onPress={takePhoto}>
                <Ionicons name="camera-outline" size={22} color={colors.text} />
                <Text style={s.storyActionText}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.storyActionBtn} onPress={() => pickMedia(false)}>
                <Ionicons name="images-outline" size={22} color={colors.text} />
                <Text style={s.storyActionText}>Gallery</Text>
              </TouchableOpacity>
            </View>

            {!mediaFiles[0] && (
              <>
                <Text style={s.label}>Background Color</Text>
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

            <Text style={s.label}>Audience</Text>
            <View style={s.privacyRow}>
              {PRIVACY_OPTS.slice(0, 2).map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  style={[s.privacyBtn, privacy === opt.key && { borderColor: opt.color, backgroundColor: `${opt.color}22` }]}
                  onPress={() => setPrivacy(opt.key)}
                >
                  <Ionicons name={opt.icon} size={14} color={privacy === opt.key ? opt.color : colors.muted} />
                  <Text style={[s.privacyText, privacy === opt.key && { color: opt.color }]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* ── FAMILY STORY MODE ── */}
        {mode === 'family' && (
          <>
            {mediaFiles[0] && (
              <View style={s.mediaThumbLarge}>
                <Image source={{ uri: mediaFiles[0].uri }} style={s.mediaThumbLargeImg} resizeMode="cover" />
                <TouchableOpacity style={s.removeMedia} onPress={() => setMediaFiles([])}>
                  <Ionicons name="close-circle" size={22} color="#fff" />
                </TouchableOpacity>
              </View>
            )}
            {!mediaFiles[0] && (
              <View style={s.mediaButtons}>
                <TouchableOpacity style={s.mediaBtn} onPress={takePhoto} activeOpacity={0.85}>
                  <LinearGradient colors={['#10b981', '#059669']} style={s.mediaBtnGrad}>
                    <Ionicons name="camera" size={26} color="#fff" />
                    <Text style={s.mediaBtnLabel}>Camera</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity style={s.mediaBtn} onPress={() => pickMedia(false)} activeOpacity={0.85}>
                  <LinearGradient colors={['#7c3aed', '#3b82f6']} style={s.mediaBtnGrad}>
                    <Ionicons name="images" size={26} color="#fff" />
                    <Text style={s.mediaBtnLabel}>Gallery</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}

            <Text style={s.label}>Title *</Text>
            <TextInput style={s.input} placeholder="Give your story a title..." placeholderTextColor={colors.dim} value={familyTitle} onChangeText={setFamilyTitle} />

            <Text style={s.label}>Story</Text>
            <TextInput style={[s.input, s.textarea]} multiline placeholder="Tell your family story..." placeholderTextColor={colors.dim} value={familyContent} onChangeText={setFamilyContent} />

            <Text style={s.label}>When did this happen?</Text>
            <TextInput style={s.input} placeholder="YYYY-MM-DD" placeholderTextColor={colors.dim} value={storyDate} onChangeText={setStoryDate} keyboardType="numeric" />

            <Text style={s.label}>Privacy</Text>
            <View style={s.privacyRow}>
              {[
                { key: 'family', label: '👨‍👩‍👧 Family', color: '#10b981' },
                { key: 'private', label: '🔒 Private', color: '#6b7280' },
                { key: 'public', label: '🌍 Public', color: '#3b82f6' },
              ].map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  style={[s.privacyBtn, familyPrivacy === opt.key && { borderColor: opt.color, backgroundColor: `${opt.color}22` }]}
                  onPress={() => setFamilyPrivacy(opt.key)}
                >
                  <Text style={[s.privacyText, familyPrivacy === opt.key && { color: opt.color }]}>{opt.label}</Text>
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
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  headerTitle: { fontSize: 22, fontWeight: '800', color: colors.text },
  postBtn: { backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 8, borderRadius: radius.full },
  postBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  modeRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  modeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: radius.md, backgroundColor: 'rgba(30,41,59,0.6)', borderWidth: 1, borderColor: colors.border2 },
  modeBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  modeBtnText: { fontSize: 12, fontWeight: '600', color: colors.muted },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 80 },
  mediaPreviewRow: { marginBottom: 16 },
  mediaThumb: { width: 100, height: 100, borderRadius: 10, marginRight: 8, position: 'relative' },
  mediaThumbImg: { width: '100%', height: '100%', borderRadius: 10 },
  removeMedia: { position: 'absolute', top: -6, right: -6 },
  videoIcon: { position: 'absolute', bottom: 4, left: 4, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 4, padding: 3 },
  addMoreBtn: { width: 100, height: 100, borderRadius: 10, backgroundColor: colors.bgSecondary, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.border2, borderStyle: 'dashed' },
  mediaButtons: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  mediaBtn: { flex: 1, borderRadius: radius.lg, overflow: 'hidden' },
  mediaBtnGrad: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 28 },
  mediaBtnLabel: { color: '#fff', fontWeight: '700', fontSize: 14 },
  captionInput: { backgroundColor: 'rgba(30,41,59,0.6)', borderRadius: radius.md, padding: 14, color: colors.text, fontSize: 15, minHeight: 80, textAlignVertical: 'top', marginBottom: 12, borderWidth: 1, borderColor: colors.border2 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(30,41,59,0.6)', borderRadius: radius.md, paddingHorizontal: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border2 },
  fieldInput: { flex: 1, paddingVertical: 12, color: colors.text, fontSize: 14 },
  label: { fontSize: 11, color: colors.muted, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8 },
  privacyRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  privacyBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, borderRadius: radius.md, backgroundColor: 'rgba(30,41,59,0.6)', borderWidth: 1, borderColor: colors.border2 },
  privacyText: { fontSize: 12, fontWeight: '600', color: colors.muted },
  storyPreview: { width: '100%', height: 400, borderRadius: radius.lg, overflow: 'hidden', marginBottom: 16, position: 'relative' },
  storyPreviewImg: { width: '100%', height: '100%' },
  storyRemove: { position: 'absolute', top: 12, right: 12 },
  storyCanvas: { width: '100%', height: 300, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', marginBottom: 16, padding: 24 },
  storyText: { color: '#fff', fontSize: 22, fontWeight: '700', textAlign: 'center', width: '100%' },
  storyActions: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  storyActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, backgroundColor: 'rgba(30,41,59,0.6)', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border2 },
  storyActionText: { color: colors.text, fontWeight: '600', fontSize: 13 },
  bgColorRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  bgColorDot: { width: 32, height: 32, borderRadius: 16 },
  bgColorDotActive: { borderWidth: 3, borderColor: '#fff' },
  mediaThumbLarge: { width: '100%', height: 200, borderRadius: radius.lg, overflow: 'hidden', marginBottom: 16, position: 'relative' },
  mediaThumbLargeImg: { width: '100%', height: '100%' },
  input: { backgroundColor: 'rgba(30,41,59,0.8)', borderWidth: 1, borderColor: colors.border2, borderRadius: radius.md, padding: 14, color: colors.text, fontSize: 14, marginBottom: 14 },
  textarea: { height: 120, textAlignVertical: 'top' },
});
