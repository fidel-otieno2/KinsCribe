import { useState } from 'react';
import {
  View, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Image, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppText from '../components/AppText';
import Toast from '../components/Toast';
import useToast from '../hooks/useToast';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../api/axios';
import { radius } from '../theme';

export default function EditProfileScreen({ navigation }) {
  const { user, refreshUser } = useAuth();
  const { theme } = useTheme();
  const { toast, hide, success, error } = useToast();

  const [name, setName] = useState(user?.name || '');
  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [website, setWebsite] = useState(user?.website || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleAvatarUpload = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return error('Allow photo access in your device settings');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.7, base64: true,
    });
    if (!result.canceled && result.assets?.[0]) {
      setUploading(true);
      try {
        const token = await AsyncStorage.getItem('access_token');
        const res = await fetch('https://kinscribe-1.onrender.com/api/auth/avatar', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: result.assets[0].base64 }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Upload failed');
        await refreshUser();
        success('Profile photo updated');
      } catch (err) {
        error(err.message);
      } finally { setUploading(false); }
    }
  };

  const handleSave = async () => {
    if (!name.trim()) return error('Name is required');
    if (!username.trim()) return error('Username is required');
    setSaving(true);
    try {
      await api.put('/auth/profile', { name: name.trim(), username: username.trim().toLowerCase(), bio, website });
      await refreshUser();
      success('Profile saved');
      setTimeout(() => navigation.goBack(), 800);
    } catch (err) {
      error(err.response?.data?.error || 'Failed to save');
    } finally { setSaving(false); }
  };

  const c = theme;

  return (
    <View style={[s.container, { backgroundColor: c.bg }]}>
      <Toast visible={toast.visible} type={toast.type} message={toast.message} onHide={hide} />

      {/* Header */}
      <View style={[s.header, { borderBottomColor: c.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={c.text} />
        </TouchableOpacity>
        <AppText style={[s.headerTitle, { color: c.text }]}>Edit Profile</AppText>
        <TouchableOpacity
          onPress={handleSave}
          style={[s.saveBtn, { backgroundColor: c.primary }]}
          activeOpacity={0.8}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator size="small" color="#fff" />
            : <AppText style={s.saveBtnText}>Save</AppText>}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* Avatar */}
        <View style={s.avatarSection}>
          <TouchableOpacity onPress={handleAvatarUpload} disabled={uploading} activeOpacity={0.8}>
            <LinearGradient colors={['#7c3aed', '#3b82f6', '#ec4899']} style={s.avatarRing}>
              <View style={[s.avatarInner, { backgroundColor: c.primary, borderColor: c.bg }]}>
                {uploading
                  ? <ActivityIndicator color="#fff" />
                  : user?.avatar_url
                    ? <Image source={{ uri: user.avatar_url }} style={s.avatarImg} />
                    : <AppText style={s.avatarLetter}>{user?.name?.[0]?.toUpperCase()}</AppText>}
              </View>
            </LinearGradient>
            <View style={[s.cameraBtn, { borderColor: c.bg }]}>
              <Ionicons name="camera" size={13} color="#fff" />
            </View>
          </TouchableOpacity>
          <AppText style={[s.changePhotoText, { color: c.primary }]}>Change profile photo</AppText>
        </View>

        {/* Fields */}
        <View style={s.fields}>
          <Field label="Name" value={name} onChangeText={setName} theme={c} placeholder="Your full name" />
          <Field
            label="Username"
            value={username}
            onChangeText={t => setUsername(t.toLowerCase().replace(/[^a-z0-9_.]/g, ''))}
            theme={c}
            placeholder="username"
            prefix="@"
            autoCapitalize="none"
          />
          <Field
            label="Bio"
            value={bio}
            onChangeText={setBio}
            theme={c}
            placeholder="Tell people about yourself..."
            multiline
            maxLength={150}
            showCount
          />
          <Field
            label="Website"
            value={website}
            onChangeText={setWebsite}
            theme={c}
            placeholder="https://yourwebsite.com"
            keyboardType="url"
            autoCapitalize="none"
          />
        </View>
      </ScrollView>
    </View>
  );
}

function Field({ label, value, onChangeText, theme: c, placeholder, prefix, multiline, maxLength, showCount, ...rest }) {
  return (
    <View style={s.fieldWrap}>
      <AppText style={[s.fieldLabel, { color: c.muted }]}>{label}</AppText>
      <View style={[s.inputRow, { backgroundColor: c.bgCard, borderColor: c.border2 }, multiline && s.inputMultiline]}>
        {prefix ? <AppText style={[s.prefix, { color: c.muted }]}>{prefix}</AppText> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={c.dim}
          style={[s.input, { color: c.text }, multiline && s.inputTextMulti]}
          multiline={multiline}
          maxLength={maxLength}
          {...rest}
        />
        {showCount && maxLength ? (
          <AppText style={[s.charCount, { color: c.dim }]}>{value.length}/{maxLength}</AppText>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 52, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 0.5 },
  headerBtn: { width: 40, alignItems: 'flex-start' },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  saveBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: radius.full },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  scroll: { paddingBottom: 60 },
  avatarSection: { alignItems: 'center', paddingVertical: 28, gap: 12 },
  avatarRing: { width: 96, height: 96, borderRadius: 48, padding: 3, alignItems: 'center', justifyContent: 'center' },
  avatarInner: { width: 88, height: 88, borderRadius: 44, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  avatarImg: { width: '100%', height: '100%' },
  avatarLetter: { color: '#fff', fontWeight: '800', fontSize: 34 },
  cameraBtn: { position: 'absolute', bottom: 2, right: 2, width: 26, height: 26, borderRadius: 13, backgroundColor: '#7c3aed', alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  changePhotoText: { fontSize: 14, fontWeight: '600' },
  fields: { paddingHorizontal: 16, gap: 4 },
  fieldWrap: { marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, borderWidth: 1, paddingHorizontal: 14, minHeight: 48 },
  inputMultiline: { alignItems: 'flex-start', paddingVertical: 12 },
  prefix: { fontSize: 15, marginRight: 2 },
  input: { flex: 1, fontSize: 15, paddingVertical: 0 },
  inputTextMulti: { minHeight: 80, textAlignVertical: 'top' },
  charCount: { fontSize: 11, alignSelf: 'flex-end' },
});
