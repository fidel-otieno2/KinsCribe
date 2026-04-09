import { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Image, Alert, KeyboardAvoidingView, Platform
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius } from '../theme';

export default function CreateScreen({ navigation }) {
  const { user } = useAuth();
  const [type, setType] = useState('text');
  const [form, setForm] = useState({ title: '', content: '', privacy: 'family', story_date: '' });
  const [mediaFile, setMediaFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const pickImage = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permission Required', 'Enable gallery access in settings');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, quality: 0.8,
    });
    if (!result.canceled) setMediaFile(result.assets[0]);
  }, []);

  const pickVideo = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permission Required', 'Enable gallery access in settings');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
    });
    if (!result.canceled) setMediaFile(result.assets[0]);
  }, []);

  const pickAudio = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
    if (!result.canceled && result.assets?.[0]) setMediaFile(result.assets[0]);
  }, []);

  const handlePost = async () => {
    if (!form.title.trim()) return Alert.alert('Title Required', 'Give your story a title');
    if (type === 'text' && !form.content.trim()) return Alert.alert('Content Required', 'Write your story');
    if (type !== 'text' && !mediaFile) return Alert.alert('Media Required', `Pick a ${type} file`);

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('title', form.title);
      fd.append('content', form.content);
      fd.append('privacy', form.privacy);
      if (form.story_date) fd.append('story_date', form.story_date);
      if (mediaFile) {
        fd.append('file', {
          uri: mediaFile.uri,
          name: mediaFile.fileName || mediaFile.name || 'media',
          type: mediaFile.mimeType || (type === 'video' ? 'video/mp4' : type === 'audio' ? 'audio/mpeg' : 'image/jpeg'),
        });
      }
      const { data } = await api.post('/stories/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setForm({ title: '', content: '', privacy: 'family', story_date: '' });
      setMediaFile(null);
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
              onPress={() => { setType(key); setMediaFile(null); }}>
              <Ionicons name={icon} size={18} color={type === key ? '#fff' : colors.muted} />
              <Text style={[s.typeTabText, type === key && { color: '#fff' }]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Title */}
        <Text style={s.label}>Title *</Text>
        <TextInput style={s.input} placeholder="Give your story a title..."
          placeholderTextColor={colors.dim} value={form.title}
          onChangeText={v => setForm(f => ({ ...f, title: v }))} />

        {/* Content by type */}
        {type === 'text' && (
          <>
            <Text style={s.label}>Story *</Text>
            <TextInput style={[s.input, s.textarea]} multiline placeholder="Tell your family story..."
              placeholderTextColor={colors.dim} value={form.content}
              onChangeText={v => setForm(f => ({ ...f, content: v }))} />
          </>
        )}

        {type === 'image' && (
          <>
            <TouchableOpacity style={s.mediaBtn} onPress={pickImage}>
              <Ionicons name="image-outline" size={22} color="#fff" />
              <Text style={s.mediaBtnText}>{mediaFile ? 'Change Photo' : 'Pick Photo'}</Text>
            </TouchableOpacity>
            {mediaFile && <Image source={{ uri: mediaFile.uri }} style={s.preview} />}
          </>
        )}

        {type === 'audio' && (
          <>
            <TouchableOpacity style={s.mediaBtn} onPress={pickAudio}>
              <Ionicons name="mic-outline" size={22} color="#fff" />
              <Text style={s.mediaBtnText}>{mediaFile ? mediaFile.name || 'Audio Selected ✓' : 'Pick Audio File'}</Text>
            </TouchableOpacity>
            {mediaFile && (
              <View style={s.audioPreview}>
                <Ionicons name="musical-notes" size={32} color="#7c3aed" />
                <Text style={{ color: colors.muted, marginTop: 6 }}>{mediaFile.name || 'Audio Ready'}</Text>
              </View>
            )}
            <Text style={s.label}>Story Description (optional)</Text>
            <TextInput style={s.input} placeholder="Describe what this audio is about..."
              placeholderTextColor={colors.dim} value={form.content}
              onChangeText={v => setForm(f => ({ ...f, content: v }))} />
          </>
        )}

        {type === 'video' && (
          <>
            <TouchableOpacity style={s.mediaBtn} onPress={pickVideo}>
              <Ionicons name="videocam-outline" size={22} color="#fff" />
              <Text style={s.mediaBtnText}>{mediaFile ? 'Change Video' : 'Pick Video'}</Text>
            </TouchableOpacity>
            {mediaFile && (
              <View style={s.audioPreview}>
                <Ionicons name="play-circle" size={40} color="#7c3aed" />
                <Text style={{ color: colors.muted, marginTop: 6 }}>Video Selected ✓</Text>
              </View>
            )}
          </>
        )}

        {/* Story date */}
        <Text style={s.label}>When did this happen? (optional)</Text>
        <TextInput style={s.input} placeholder="YYYY-MM-DD e.g. 1995-06-15"
          placeholderTextColor={colors.dim} value={form.story_date}
          onChangeText={v => setForm(f => ({ ...f, story_date: v }))} />

        {/* Privacy */}
        <Text style={s.label}>Privacy</Text>
        <View style={s.privacyRow}>
          {['family', 'private', 'public'].map(p => (
            <TouchableOpacity key={p} style={[s.privacyTab, form.privacy === p && s.privacyTabActive]}
              onPress={() => setForm(f => ({ ...f, privacy: p }))}>
              <Text style={[s.privacyText, form.privacy === p && { color: '#fff' }]}>
                {p === 'family' ? '👨‍👩‍👧 Family' : p === 'private' ? '🔒 Private' : '🌍 Public'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Post button */}
        <TouchableOpacity style={s.postBtn} onPress={handlePost} disabled={loading} activeOpacity={0.85}>
          <LinearGradient colors={['#7c3aed', '#3b82f6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.postBtnGrad}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <><Ionicons name="sparkles" size={18} color="#fff" /><Text style={s.postBtnText}>Post & Enhance with AI</Text></>}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: 24, fontWeight: '800', color: colors.text },
  scroll: { flex: 1 },
  typeTabs: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  typeTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: 'rgba(30,41,59,0.6)', borderRadius: radius.md, paddingVertical: 10, borderWidth: 1, borderColor: colors.border2 },
  typeTabActive: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  typeTabText: { fontSize: 12, fontWeight: '600', color: colors.muted },
  label: { fontSize: 13, color: colors.muted, marginBottom: 8, fontWeight: '500' },
  input: { backgroundColor: 'rgba(30,41,59,0.8)', borderWidth: 1, borderColor: colors.border2, borderRadius: radius.md, padding: 14, color: colors.text, fontSize: 14, marginBottom: 16 },
  textarea: { height: 140, textAlignVertical: 'top' },
  mediaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#7c3aed', borderRadius: radius.md, padding: 16, marginBottom: 12 },
  mediaBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  preview: { width: '100%', height: 200, borderRadius: radius.md, marginBottom: 16 },
  audioPreview: { alignItems: 'center', padding: 24, backgroundColor: 'rgba(124,58,237,0.1)', borderRadius: radius.md, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)' },
  privacyRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  privacyTab: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: radius.md, backgroundColor: 'rgba(30,41,59,0.6)', borderWidth: 1, borderColor: colors.border2 },
  privacyTabActive: { backgroundColor: '#10b981', borderColor: '#10b981' },
  privacyText: { fontSize: 12, fontWeight: '600', color: colors.muted },
  postBtn: { borderRadius: radius.md, overflow: 'hidden' },
  postBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 },
  postBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
