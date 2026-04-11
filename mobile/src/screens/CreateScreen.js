import { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { colors, radius } from '../theme';

export default function CreateScreen({ navigation }) {
  const { user } = useAuth();
  const [type, setType] = useState('text');
  const [form, setForm] = useState({ title: '', content: '', privacy: 'family', story_date: '' });
  const [loading, setLoading] = useState(false);

  const pickPhoto = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permission Required', 'Enable gallery access in settings');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.9,
    });
    if (!result.canceled) navigation.navigate('MediaEditor', { mediaFile: result.assets[0], mediaType: 'image' });
  }, [navigation]);

  const takePhoto = useCallback(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permission Required', 'Enable camera access in settings');
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.9,
    });
    if (!result.canceled) navigation.navigate('MediaEditor', { mediaFile: result.assets[0], mediaType: 'image' });
  }, [navigation]);

  const pickVideo = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permission Required', 'Enable gallery access in settings');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 0.9,
    });
    if (!result.canceled) navigation.navigate('MediaEditor', { mediaFile: result.assets[0], mediaType: 'video' });
  }, [navigation]);

  const recordVideo = useCallback(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permission Required', 'Enable camera access in settings');
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      videoMaxDuration: 60,
      quality: 0.9,
    });
    if (!result.canceled) navigation.navigate('MediaEditor', { mediaFile: result.assets[0], mediaType: 'video' });
  }, [navigation]);

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
      navigation.navigate('AIProcessing', { storyId: data.story?.id });
    } catch (err) {
      Alert.alert('Post Failed', err.response?.data?.error || 'Network error. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const TYPES = [
    { key: 'text', icon: 'document-text-outline', label: 'Text', color: '#7c3aed' },
    { key: 'image', icon: 'camera-outline', label: 'Photo', color: '#3b82f6' },
    { key: 'video', icon: 'film-outline', label: 'Video', color: '#e0245e' },
    { key: 'audio', icon: 'mic-circle-outline', label: 'Voice', color: '#10b981' },
  ];

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <LinearGradient colors={['#0f172a', '#1e1040', '#0f172a']} style={StyleSheet.absoluteFill} />

      <View style={s.header}>
        <Text style={s.headerTitle}>Create Story</Text>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Type selector */}
        <View style={s.typeRow}>
          {TYPES.map(({ key, icon, label, color }) => (
            <TouchableOpacity
              key={key}
              style={[s.typeBtn, type === key && { borderColor: color, backgroundColor: `${color}22` }]}
              onPress={() => setType(key)}
            >
              <Ionicons name={icon} size={22} color={type === key ? color : colors.muted} />
              <Text style={[s.typeBtnText, type === key && { color }]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── PHOTO ── */}
        {type === 'image' && (
          <View style={s.mediaSection}>
            <Text style={s.sectionTitle}>📸 Add a Photo</Text>
            <Text style={s.sectionSub}>Add music, location & caption in the next step</Text>
            <View style={s.mediaButtons}>
              <TouchableOpacity style={s.mediaBtn} onPress={takePhoto} activeOpacity={0.85}>
                <LinearGradient colors={['#7c3aed', '#3b82f6']} style={s.mediaBtnGrad}>
                  <Ionicons name="camera" size={28} color="#fff" />
                  <Text style={s.mediaBtnTitle}>Camera</Text>
                  <Text style={s.mediaBtnSub}>Take a photo now</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity style={s.mediaBtn} onPress={pickPhoto} activeOpacity={0.85}>
                <LinearGradient colors={['#3b82f6', '#06b6d4']} style={s.mediaBtnGrad}>
                  <Ionicons name="images" size={28} color="#fff" />
                  <Text style={s.mediaBtnTitle}>Gallery</Text>
                  <Text style={s.mediaBtnSub}>Choose from library</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── VIDEO ── */}
        {type === 'video' && (
          <View style={s.mediaSection}>
            <Text style={s.sectionTitle}>🎬 Add a Video</Text>
            <Text style={s.sectionSub}>Add music, location & caption in the next step</Text>
            <View style={s.mediaButtons}>
              <TouchableOpacity style={s.mediaBtn} onPress={recordVideo} activeOpacity={0.85}>
                <LinearGradient colors={['#e0245e', '#be123c']} style={s.mediaBtnGrad}>
                  <Ionicons name="videocam" size={28} color="#fff" />
                  <Text style={s.mediaBtnTitle}>Record</Text>
                  <Text style={s.mediaBtnSub}>Use your camera</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity style={s.mediaBtn} onPress={pickVideo} activeOpacity={0.85}>
                <LinearGradient colors={['#7c3aed', '#3b82f6']} style={s.mediaBtnGrad}>
                  <Ionicons name="cloud-upload-outline" size={28} color="#fff" />
                  <Text style={s.mediaBtnTitle}>Upload</Text>
                  <Text style={s.mediaBtnSub}>From your gallery</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── VOICE ── */}
        {type === 'audio' && (
          <View style={s.mediaSection}>
            <Text style={s.sectionTitle}>🎙️ Voice Story</Text>
            <Text style={s.sectionSub}>Record your voice and share a spoken memory</Text>
            <TouchableOpacity style={s.bigBtn} onPress={() => navigation.navigate('VoiceRecorder')} activeOpacity={0.85}>
              <LinearGradient colors={['#10b981', '#059669']} style={s.bigBtnGrad}>
                <Ionicons name="mic" size={36} color="#fff" />
                <Text style={s.bigBtnTitle}>Open Voice Recorder</Text>
                <Text style={s.bigBtnSub}>Record · Preview · Post with AI</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* ── TEXT ── */}
        {type === 'text' && (
          <View style={s.textSection}>
            <Text style={s.label}>Title *</Text>
            <TextInput
              style={s.input}
              placeholder="Give your story a title..."
              placeholderTextColor={colors.dim}
              value={form.title}
              onChangeText={v => setForm(f => ({ ...f, title: v }))}
            />

            <Text style={s.label}>Story *</Text>
            <TextInput
              style={[s.input, s.textarea]}
              multiline
              placeholder="Tell your family story..."
              placeholderTextColor={colors.dim}
              value={form.content}
              onChangeText={v => setForm(f => ({ ...f, content: v }))}
            />

            <Text style={s.label}>When did this happen?</Text>
            <TextInput
              style={s.input}
              placeholder="YYYY-MM-DD  e.g. 1995-06-15"
              placeholderTextColor={colors.dim}
              value={form.story_date}
              onChangeText={v => setForm(f => ({ ...f, story_date: v }))}
              keyboardType="numeric"
            />

            <Text style={s.label}>Privacy</Text>
            <View style={s.privacyRow}>
              {[
                { key: 'family', label: '👨👩👧 Family', color: '#10b981' },
                { key: 'private', label: '🔒 Private', color: '#6b7280' },
                { key: 'public', label: '🌍 Public', color: '#3b82f6' },
              ].map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  style={[s.privacyBtn, form.privacy === opt.key && { borderColor: opt.color, backgroundColor: `${opt.color}22` }]}
                  onPress={() => setForm(f => ({ ...f, privacy: opt.key }))}
                >
                  <Text style={[s.privacyText, form.privacy === opt.key && { color: opt.color }]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={s.postBtn} onPress={handleTextPost} disabled={loading} activeOpacity={0.85}>
              <LinearGradient colors={['#7c3aed', '#3b82f6']} style={s.postBtnGrad}>
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <><Ionicons name="sparkles" size={18} color="#fff" /><Text style={s.postBtnText}>Post & Enhance with AI</Text></>}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingTop: 52, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  headerTitle: { fontSize: 24, fontWeight: '800', color: colors.text },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 60 },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  typeBtn: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 14, borderRadius: radius.md, backgroundColor: 'rgba(30,41,59,0.6)', borderWidth: 1, borderColor: colors.border2 },
  typeBtnText: { fontSize: 12, fontWeight: '600', color: colors.muted },
  mediaSection: { gap: 10 },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  sectionSub: { fontSize: 13, color: colors.muted },
  mediaButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  mediaBtn: { flex: 1, borderRadius: radius.lg, overflow: 'hidden' },
  mediaBtnGrad: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 32 },
  mediaBtnTitle: { color: '#fff', fontWeight: '700', fontSize: 16 },
  mediaBtnSub: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
  bigBtn: { borderRadius: radius.lg, overflow: 'hidden', marginTop: 8 },
  bigBtnGrad: { alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 48 },
  bigBtnTitle: { color: '#fff', fontWeight: '700', fontSize: 20 },
  bigBtnSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  textSection: { gap: 0 },
  label: { fontSize: 12, color: colors.muted, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: 'rgba(30,41,59,0.8)', borderWidth: 1, borderColor: colors.border2, borderRadius: radius.md, padding: 14, color: colors.text, fontSize: 14, marginBottom: 16 },
  textarea: { height: 140, textAlignVertical: 'top' },
  privacyRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  privacyBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: radius.md, backgroundColor: 'rgba(30,41,59,0.6)', borderWidth: 1, borderColor: colors.border2 },
  privacyText: { fontSize: 12, fontWeight: '600', color: colors.muted },
  postBtn: { borderRadius: radius.md, overflow: 'hidden' },
  postBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 },
  postBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
