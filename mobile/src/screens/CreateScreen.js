import { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Image, Alert, KeyboardAvoidingView, Platform
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius } from '../theme';

export default function CreateScreen({ navigation }) {
  const { user } = useAuth();
  const [type, setType] = useState('text');
  const [form, setForm] = useState({ title: '', content: '', privacy: 'family', story_date: '' });
  const [loading, setLoading] = useState(false);

  // ── Photo ──────────────────────────────────────────────────────────────────
  const pickPhoto = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permission Required', 'Enable gallery access in settings');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.9,
    });
    if (!result.canceled) {
      navigation.navigate('MediaEditor', { mediaFile: result.assets[0], mediaType: 'image' });
    }
  }, [navigation]);

  // ── Video ──────────────────────────────────────────────────────────────────
  const uploadVideo = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permission Required', 'Enable gallery access in settings');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 0.9,
    });
    if (!result.canceled) {
      navigation.navigate('MediaEditor', { mediaFile: result.assets[0], mediaType: 'video' });
    }
  }, [navigation]);

  const recordVideo = useCallback(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permission Required', 'Enable camera access in settings');
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      videoMaxDuration: 60,
      quality: 0.9,
    });
    if (!result.canceled) {
      navigation.navigate('MediaEditor', { mediaFile: result.assets[0], mediaType: 'video' });
    }
  }, [navigation]);

  // ── Voice ──────────────────────────────────────────────────────────────────
  const goToVoiceRecorder = useCallback(() => {
    navigation.navigate('VoiceRecorder');
  }, [navigation]);

  // ── Text post ──────────────────────────────────────────────────────────────
  const handleTextPost = async () => {
    if (!form.title.trim()) return Alert.alert('Title Required', 'Give your story a title');
    if (!form.content.trim()) return Alert.alert('Content Required', 'Write your story');
    setLoading(true);
    try {
      const { data } = await api.post('/stories/', {
        title: form.title,
        content: form.content,
        privacy: form.privacy,
        story_date: form.story_date || undefined,
      });
      setForm({ title: '', content: '', privacy: 'family', story_date: '' });
      setType('text');
      navigation.navigate('AIProcessing', { storyId: data.story?.id });
    } catch (err) {
      Alert.alert('Post Failed', err.response?.data?.error || 'Network error. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const types = [
    { key: 'text', icon: 'create-outline', label: 'Text' },
    { key: 'image', icon: 'image-outline', label: 'Photo' },
    { key: 'audio', icon: 'mic-outline', label: 'Voice' },
    { key: 'video', icon: 'videocam-outline', label: 'Video' },
  ];

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <LinearGradient colors={['#0f172a', '#1e1040', '#0f172a']} style={StyleSheet.absoluteFill} />

      <View style={s.header}>
        <Text style={s.headerTitle}>Create Story</Text>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Type tabs */}
        <View style={s.typeTabs}>
          {types.map(({ key, icon, label }) => (
            <TouchableOpacity key={key} style={[s.typeTab, type === key && s.typeTabActive]}
              onPress={() => setType(key)}>
              <Ionicons name={icon} size={18} color={type === key ? '#fff' : colors.muted} />
              <Text style={[s.typeTabText, type === key && { color: '#fff' }]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── PHOTO ── */}
        {type === 'image' && (
          <View style={s.mediaSection}>
            <View style={s.mediaSectionHeader}>
              <Ionicons name="image" size={22} color="#7c3aed" />
              <Text style={s.mediaSectionTitle}>Pick a Photo</Text>
            </View>
            <Text style={s.mediaSectionSub}>Add effects, music & location in the next step</Text>

            <TouchableOpacity style={s.bigMediaBtn} onPress={pickPhoto} activeOpacity={0.85}>
              <LinearGradient colors={['#7c3aed', '#3b82f6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.bigMediaBtnGrad}>
                <Ionicons name="image-outline" size={32} color="#fff" />
                <Text style={s.bigMediaBtnText}>Choose from Gallery</Text>
                <Text style={s.bigMediaBtnSub}>Effects • Music • Location • AI Enhancement</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* ── VIDEO ── */}
        {type === 'video' && (
          <View style={s.mediaSection}>
            <View style={s.mediaSectionHeader}>
              <Ionicons name="videocam" size={22} color="#3b82f6" />
              <Text style={s.mediaSectionTitle}>Add a Video</Text>
            </View>
            <Text style={s.mediaSectionSub}>Add effects, music & location in the next step</Text>

            <View style={s.videoButtons}>
              <TouchableOpacity style={s.videoBtn} onPress={recordVideo} activeOpacity={0.85}>
                <LinearGradient colors={['#e0245e', '#be123c']} style={s.videoBtnGrad}>
                  <View style={s.videoBtnIcon}>
                    <Ionicons name="radio-button-on" size={28} color="#fff" />
                  </View>
                  <Text style={s.videoBtnTitle}>Record Video</Text>
                  <Text style={s.videoBtnSub}>Use your camera</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity style={s.videoBtn} onPress={uploadVideo} activeOpacity={0.85}>
                <LinearGradient colors={['#7c3aed', '#3b82f6']} style={s.videoBtnGrad}>
                  <View style={s.videoBtnIcon}>
                    <Ionicons name="cloud-upload-outline" size={28} color="#fff" />
                  </View>
                  <Text style={s.videoBtnTitle}>Upload Video</Text>
                  <Text style={s.videoBtnSub}>From your gallery</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── VOICE ── */}
        {type === 'audio' && (
          <View style={s.mediaSection}>
            <View style={s.mediaSectionHeader}>
              <Ionicons name="mic" size={22} color="#10b981" />
              <Text style={s.mediaSectionTitle}>Voice Story</Text>
            </View>
            <Text style={s.mediaSectionSub}>Record your voice and share a spoken memory</Text>

            <TouchableOpacity style={s.bigMediaBtn} onPress={goToVoiceRecorder} activeOpacity={0.85}>
              <LinearGradient colors={['#10b981', '#059669']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.bigMediaBtnGrad}>
                <Ionicons name="mic-outline" size={32} color="#fff" />
                <Text style={s.bigMediaBtnText}>Open Voice Recorder</Text>
                <Text style={s.bigMediaBtnSub}>Record • Preview • Post with AI</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* ── TEXT ── */}
        {type === 'text' && (
          <>
            <Text style={s.label}>Title *</Text>
            <TextInput style={s.input} placeholder="Give your story a title..."
              placeholderTextColor={colors.dim} value={form.title}
              onChangeText={v => setForm(f => ({ ...f, title: v }))} />

            <Text style={s.label}>Story *</Text>
            <TextInput style={[s.input, s.textarea]} multiline placeholder="Tell your family story..."
              placeholderTextColor={colors.dim} value={form.content}
              onChangeText={v => setForm(f => ({ ...f, content: v }))} />

            <Text style={s.label}>When did this happen? (optional)</Text>
            <TextInput style={s.input} placeholder="YYYY-MM-DD e.g. 1995-06-15"
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

            <TouchableOpacity style={s.postBtn} onPress={handleTextPost} disabled={loading} activeOpacity={0.85}>
              <LinearGradient colors={['#7c3aed', '#3b82f6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.postBtnGrad}>
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <><Ionicons name="sparkles" size={18} color="#fff" /><Text style={s.postBtnText}>Post & Enhance with AI</Text></>}
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: 24, fontWeight: '800', color: colors.text },
  scroll: { flex: 1 },
  typeTabs: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  typeTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: 'rgba(30,41,59,0.6)', borderRadius: radius.md, paddingVertical: 10, borderWidth: 1, borderColor: colors.border2 },
  typeTabActive: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  typeTabText: { fontSize: 12, fontWeight: '600', color: colors.muted },
  mediaSection: { gap: 12 },
  mediaSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mediaSectionTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  mediaSectionSub: { fontSize: 13, color: colors.muted, marginBottom: 4 },
  bigMediaBtn: { borderRadius: radius.lg, overflow: 'hidden' },
  bigMediaBtnGrad: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 40, paddingHorizontal: 20 },
  bigMediaBtnText: { color: '#fff', fontWeight: '700', fontSize: 18 },
  bigMediaBtnSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, textAlign: 'center' },
  videoButtons: { flexDirection: 'row', gap: 12 },
  videoBtn: { flex: 1, borderRadius: radius.lg, overflow: 'hidden' },
  videoBtnGrad: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 32 },
  videoBtnIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  videoBtnTitle: { color: '#fff', fontWeight: '700', fontSize: 15 },
  videoBtnSub: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
  label: { fontSize: 13, color: colors.muted, marginBottom: 8, fontWeight: '500' },
  input: { backgroundColor: 'rgba(30,41,59,0.8)', borderWidth: 1, borderColor: colors.border2, borderRadius: radius.md, padding: 14, color: colors.text, fontSize: 14, marginBottom: 16 },
  textarea: { height: 140, textAlignVertical: 'top' },
  privacyRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  privacyTab: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: radius.md, backgroundColor: 'rgba(30,41,59,0.6)', borderWidth: 1, borderColor: colors.border2 },
  privacyTabActive: { backgroundColor: '#10b981', borderColor: '#10b981' },
  privacyText: { fontSize: 12, fontWeight: '600', color: colors.muted },
  postBtn: { borderRadius: radius.md, overflow: 'hidden' },
  postBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 },
  postBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
