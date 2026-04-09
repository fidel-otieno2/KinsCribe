import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, ActivityIndicator, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { colors, radius, shadows } from '../theme';
import GradientButton from '../components/GradientButton';

export default function SetupProfileScreen({ navigation }) {
  const { refreshUser } = useAuth();
  const [image, setImage] = useState(null);
  const [uploading, setUploading] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to your photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) setImage(result.assets[0]);
  };

  const handleUpload = async () => {
    if (!image) return navigation.replace('FamilyGate');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', { uri: image.uri, name: 'avatar.jpg', type: 'image/jpeg' });
      await api.post('/auth/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      await refreshUser();
      navigation.replace('FamilyGate');
    } catch {
      navigation.replace('FamilyGate');
    } finally { setUploading(false); }
  };

  return (
    <View style={s.container}>
      <LinearGradient colors={['#0f172a', '#1e1040', '#0f172a']} style={StyleSheet.absoluteFill} />
      <View style={s.orb1} /><View style={s.orb2} />

      {/* Progress */}
      <View style={s.progressWrap}>
        <Text style={s.stepText}>Step 2 of 2</Text>
        <View style={s.progressBar}>
          <LinearGradient colors={['#7c3aed', '#3b82f6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.progressFill} />
        </View>
      </View>

      <View style={s.content}>
        <Text style={s.title}>Add a profile photo</Text>
        <Text style={s.sub}>Help your family recognize you</Text>

        <TouchableOpacity onPress={pickImage} activeOpacity={0.85} style={s.avatarWrap}>
          {image ? (
            <Image source={{ uri: image.uri }} style={s.avatar} />
          ) : (
            <BlurView intensity={20} tint="dark" style={s.avatarPlaceholder}>
              <LinearGradient colors={['rgba(124,58,237,0.3)', 'rgba(59,130,246,0.2)']} style={StyleSheet.absoluteFill} />
              <Ionicons name="camera" size={40} color="#7c3aed" />
              <Text style={s.addPhotoText}>Tap to add photo</Text>
            </BlurView>
          )}
          {/* Edit badge */}
          <View style={s.editBadge}>
            <LinearGradient colors={['#7c3aed', '#3b82f6']} style={s.editBadgeInner}>
              <Ionicons name="camera" size={14} color="#fff" />
            </LinearGradient>
          </View>
        </TouchableOpacity>

        {image && (
          <TouchableOpacity onPress={pickImage} style={{ marginBottom: 8 }}>
            <Text style={s.changeText}>Change Photo</Text>
          </TouchableOpacity>
        )}

        <GradientButton
          label={image ? 'Save & Continue' : 'Continue'}
          onPress={handleUpload}
          loading={uploading}
          style={{ width: '100%', marginTop: 16 }}
        />

        <TouchableOpacity onPress={() => navigation.replace('FamilyGate')} style={{ marginTop: 16 }}>
          <Text style={s.skip}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  orb1: { position: 'absolute', width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(124,58,237,0.15)', top: -60, right: -80 },
  orb2: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(59,130,246,0.1)', bottom: 80, left: -60 },
  progressWrap: { position: 'absolute', top: 60, left: 24, right: 24 },
  stepText: { fontSize: 12, color: colors.muted, marginBottom: 8 },
  progressBar: { height: 3, backgroundColor: colors.border, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 3, width: '100%', borderRadius: 2 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  title: { fontSize: 28, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: 8 },
  sub: { fontSize: 14, color: colors.muted, textAlign: 'center', marginBottom: 40 },
  avatarWrap: { marginBottom: 20, position: 'relative' },
  avatar: { width: 150, height: 150, borderRadius: 75, borderWidth: 3, borderColor: '#7c3aed' },
  avatarPlaceholder: { width: 150, height: 150, borderRadius: 75, alignItems: 'center', justifyContent: 'center', gap: 8, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(124,58,237,0.4)', borderStyle: 'dashed' },
  addPhotoText: { color: colors.muted, fontSize: 13, fontWeight: '500' },
  editBadge: { position: 'absolute', bottom: 4, right: 4, borderRadius: 20, overflow: 'hidden', ...shadows.sm },
  editBadgeInner: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  changeText: { color: '#7c3aed', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  skip: { color: colors.muted, fontSize: 14 },
});
