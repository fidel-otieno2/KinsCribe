import { useState, useEffect, useCallback } from 'react';
import {
  View, TouchableOpacity, StyleSheet, Image, ActivityIndicator,
  Alert, TextInput, ScrollView, Dimensions, FlatList,
} from 'react-native';
import AppText from '../components/AppText';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { colors, radius, shadows } from '../theme';
import GradientButton from '../components/GradientButton';

const { width } = Dimensions.get('window');

const INTERESTS = [
  { key: 'family', label: 'Family', icon: '👨‍👩‍👧' },
  { key: 'travel', label: 'Travel', icon: '✈️' },
  { key: 'food', label: 'Food', icon: '🍽️' },
  { key: 'fitness', label: 'Fitness', icon: '💪' },
  { key: 'music', label: 'Music', icon: '🎵' },
  { key: 'photography', label: 'Photography', icon: '📸' },
  { key: 'nature', label: 'Nature', icon: '🌿' },
  { key: 'history', label: 'History', icon: '📜' },
  { key: 'cooking', label: 'Cooking', icon: '👨‍🍳' },
  { key: 'art', label: 'Art', icon: '🎨' },
  { key: 'sports', label: 'Sports', icon: '⚽' },
  { key: 'technology', label: 'Tech', icon: '💻' },
  { key: 'books', label: 'Books', icon: '📚' },
  { key: 'movies', label: 'Movies', icon: '🎬' },
  { key: 'gardening', label: 'Gardening', icon: '🌱' },
  { key: 'faith', label: 'Faith', icon: '🙏' },
];

const STEPS = ['Photo', 'Profile', 'Interests', 'Privacy', 'Discover'];

function StepIndicator({ current, total }) {
  return (
    <View style={s.stepWrap}>
      <AppText style={s.stepText}>Step {current} of {total}</AppText>
      <View style={s.stepBar}>
        {Array.from({ length: total }).map((_, i) => (
          <View key={i} style={[s.stepDot, i < current && s.stepDotActive]} />
        ))}
      </View>
    </View>
  );
}

// ── Step 1: Photo ─────────────────────────────────────────────
function PhotoStep({ onNext }) {
  const { refreshUser } = useAuth();
  const [image, setImage] = useState(null);
  const [uploading, setUploading] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permission needed');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (!result.canceled) setImage(result.assets[0]);
  };

  const handleNext = async () => {
    if (!image) return onNext();
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', { uri: image.uri, name: 'avatar.jpg', type: 'image/jpeg' });
      await api.post('/auth/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      await refreshUser();
    } catch {}
    finally { setUploading(false); onNext(); }
  };

  return (
    <View style={s.stepContent}>
      <AppText style={s.stepTitle}>Add a profile photo</AppText>
      <AppText style={s.stepSub}>Help your family and connections recognize you</AppText>

      <TouchableOpacity onPress={pickImage} activeOpacity={0.85} style={s.avatarWrap}>
        {image ? (
          <Image source={{ uri: image.uri }} style={s.avatar} />
        ) : (
          <View style={s.avatarPlaceholder}>
            <LinearGradient colors={['rgba(45,90,39,0.3)', 'rgba(196,163,90,0.2)']} style={StyleSheet.absoluteFill} />
            <Ionicons name="camera" size={40} color={colors.primary} />
            <AppText style={s.addPhotoText}>Tap to add photo</AppText>
          </View>
        )}
        <View style={s.editBadge}>
          <LinearGradient colors={[colors.primary, colors.primaryLight]} style={s.editBadgeInner}>
            <Ionicons name="camera" size={14} color="#fff" />
          </LinearGradient>
        </View>
      </TouchableOpacity>

      {image && (
        <TouchableOpacity onPress={pickImage} style={{ marginBottom: 8 }}>
          <AppText style={s.changeText}>Change Photo</AppText>
        </TouchableOpacity>
      )}

      <GradientButton
        label={image ? 'Save & Continue' : 'Continue'}
        onPress={handleNext}
        loading={uploading}
        style={{ width: '100%', marginTop: 16 }}
      />
      <TouchableOpacity onPress={onNext} style={{ marginTop: 14 }}>
        <AppText style={s.skip}>Skip for now</AppText>
      </TouchableOpacity>
    </View>
  );
}

// ── Step 2: Profile Info ──────────────────────────────────────
function ProfileStep({ onNext, required }) {
  const { user, refreshUser } = useAuth();
  const [bio, setBio] = useState(user?.bio || '');
  const [website, setWebsite] = useState(user?.website || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleNext = async () => {
    if (required && !bio.trim()) { setError('Please add a bio to continue.'); return; }
    setError('');
    setSaving(true);
    try {
      await api.put('/auth/profile', { bio, website });
      await refreshUser();
    } catch {}
    finally { setSaving(false); onNext(); }
  };

  return (
    <View style={s.stepContent}>
      <AppText style={s.stepTitle}>Tell us about yourself</AppText>
      <AppText style={s.stepSub}>Add a bio and website so people know who you are</AppText>

      {error ? <AppText style={s.stepError}>{error}</AppText> : null}

      <AppText style={s.fieldLabel}>Bio {required && <AppText style={{ color: '#e11d48' }}>*</AppText>}</AppText>
      <TextInput
        style={[s.input, { height: 90, textAlignVertical: 'top' }]}
        placeholder="Write a short bio..."
        placeholderTextColor={colors.dim}
        multiline
        maxLength={150}
        value={bio}
        onChangeText={v => { setBio(v); setError(''); }}
      />
      <AppText style={s.charCount}>{bio.length}/150</AppText>

      <AppText style={s.fieldLabel}>Website (optional)</AppText>
      <View style={s.inputRow}>
        <Ionicons name="link-outline" size={18} color={colors.muted} />
        <TextInput
          style={s.inputInner}
          placeholder="https://yourwebsite.com"
          placeholderTextColor={colors.dim}
          autoCapitalize="none"
          keyboardType="url"
          value={website}
          onChangeText={setWebsite}
        />
      </View>

      <GradientButton label="Continue" onPress={handleNext} loading={saving} style={{ width: '100%', marginTop: 20 }} />
      {!required && (
        <TouchableOpacity onPress={onNext} style={{ marginTop: 14 }}>
          <AppText style={s.skip}>Skip for now</AppText>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Step 3: Interests ─────────────────────────────────────────
function InterestsStep({ onNext, required }) {
  const [selected, setSelected] = useState(new Set(['family']));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggle = (key) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handleNext = async () => {
    if (required && selected.size < 3) { setError('Please select at least 3 interests to continue.'); return; }
    setError('');
    setSaving(true);
    try {
      await api.put('/auth/profile', { interests: Array.from(selected).join(',') });
    } catch {}
    finally { setSaving(false); onNext(); }
  };

  return (
    <View style={s.stepContent}>
      <AppText style={s.stepTitle}>What interests you?</AppText>
      <AppText style={s.stepSub}>Pick at least 3 topics to personalise your feed</AppText>

      {error ? <AppText style={s.stepError}>{error}</AppText> : null}

      <View style={s.interestsGrid}>
        {INTERESTS.map(item => (
          <TouchableOpacity
            key={item.key}
            style={[s.interestChip, selected.has(item.key) && s.interestChipActive]}
            onPress={() => toggle(item.key)}
            activeOpacity={0.8}
          >
            <AppText style={s.interestIcon}>{item.icon}</AppText>
            <AppText style={[s.interestLabel, selected.has(item.key) && s.interestLabelActive]}>
              {item.label}
            </AppText>
            {selected.has(item.key) && (
              <View style={s.interestCheck}>
                <Ionicons name="checkmark" size={10} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <AppText style={s.selectedCount}>{selected.size} selected {required && <AppText style={{ color: selected.size >= 3 ? '#10b981' : '#f59e0b' }}>({selected.size < 3 ? `${3 - selected.size} more needed` : '✓'})</AppText>}</AppText>

      <GradientButton
        label="Continue"
        onPress={handleNext}
        loading={saving}
        style={{ width: '100%', marginTop: 16 }}
      />
    </View>
  );
}

// ── Step 4: Privacy ───────────────────────────────────────────
function PrivacyStep({ onNext }) {
  const [isPrivate, setIsPrivate] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleNext = async () => {
    setSaving(true);
    try {
      await api.put('/auth/profile', { is_private: isPrivate });
    } catch {}
    finally { setSaving(false); onNext(); }
  };

  return (
    <View style={s.stepContent}>
      <AppText style={s.stepTitle}>Choose your privacy</AppText>
      <AppText style={s.stepSub}>You can change this anytime in settings</AppText>

      <TouchableOpacity
        style={[s.privacyCard, !isPrivate && s.privacyCardActive]}
        onPress={() => setIsPrivate(false)}
        activeOpacity={0.85}
      >
        <View style={[s.privacyIcon, { backgroundColor: 'rgba(74,124,63,0.2)' }]}>
          <Ionicons name="globe-outline" size={26} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText style={s.privacyTitle}>Public Account</AppText>
          <AppText style={s.privacySub}>Anyone can see your posts and follow you</AppText>
        </View>
        <View style={[s.radioOuter, !isPrivate && s.radioOuterActive]}>
          {!isPrivate && <View style={s.radioInner} />}
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[s.privacyCard, isPrivate && s.privacyCardActive]}
        onPress={() => setIsPrivate(true)}
        activeOpacity={0.85}
      >
        <View style={[s.privacyIcon, { backgroundColor: 'rgba(196,163,90,0.2)' }]}>
          <Ionicons name="lock-closed-outline" size={26} color={colors.gold} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText style={s.privacyTitle}>Private Account</AppText>
          <AppText style={s.privacySub}>Only approved followers can see your posts</AppText>
        </View>
        <View style={[s.radioOuter, isPrivate && s.radioOuterActive]}>
          {isPrivate && <View style={s.radioInner} />}
        </View>
      </TouchableOpacity>

      <GradientButton label="Continue" onPress={handleNext} loading={saving} style={{ width: '100%', marginTop: 24 }} />
    </View>
  );
}

// ── Step 5: Follow Suggestions ────────────────────────────────
function DiscoverStep({ onDone }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [followed, setFollowed] = useState(new Set());

  useEffect(() => {
    api.get('/connections/suggestions').then(({ data }) => {
      setSuggestions((data.suggestions || []).slice(0, 10));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const toggleFollow = async (userId) => {
    try {
      await api.post(`/connections/${userId}/toggle`);
      setFollowed(prev => {
        const next = new Set(prev);
        next.has(userId) ? next.delete(userId) : next.add(userId);
        return next;
      });
    } catch {}
  };

  return (
    <View style={s.stepContent}>
      <AppText style={s.stepTitle}>People you may know</AppText>
      <AppText style={s.stepSub}>Connect with people to build your feed</AppText>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : suggestions.length === 0 ? (
        <View style={s.noSuggestions}>
          <Ionicons name="people-outline" size={48} color={colors.dim} />
          <AppText style={s.noSuggestionsText}>No suggestions yet</AppText>
        </View>
      ) : (
        <ScrollView style={{ width: '100%' }} showsVerticalScrollIndicator={false}>
          {suggestions.map(u => (
            <View key={u.id} style={s.suggestionRow}>
              <View style={s.suggestionAvatar}>
                {u.avatar_url
                  ? <Image source={{ uri: u.avatar_url }} style={{ width: 46, height: 46, borderRadius: 23 }} />
                  : <AppText style={s.suggestionAvatarLetter}>{u.name?.[0]?.toUpperCase()}</AppText>}
              </View>
              <View style={{ flex: 1 }}>
                <AppText style={s.suggestionName}>{u.name}</AppText>
                <AppText style={s.suggestionHandle}>@{u.username || 'user'}</AppText>
              </View>
              <TouchableOpacity
                style={[s.followBtn, followed.has(u.id) && s.followBtnActive]}
                onPress={() => toggleFollow(u.id)}
              >
                <AppText style={[s.followBtnText, followed.has(u.id) && s.followBtnTextActive]}>
                  {followed.has(u.id) ? 'Connected' : 'Connect'}
                </AppText>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      <GradientButton
        label={followed.size > 0 ? `Continue (${followed.size} connected)` : 'Continue'}
        onPress={onDone}
        style={{ width: '100%', marginTop: 20 }}
      />
      <TouchableOpacity onPress={onDone} style={{ marginTop: 14 }}>
        <AppText style={s.skip}>Skip for now</AppText>
      </TouchableOpacity>
    </View>
  );
}

// ── Main Wizard ───────────────────────────────────────────────
export default function SetupProfileScreen({ navigation }) {
  const [step, setStep] = useState(1);
  const { user, refreshUser } = useAuth();

  // Determine which steps are already done so we can skip ahead
  useEffect(() => {
    if (user?.username && user?.bio) setStep(3); // skip to interests
    else if (user?.avatar_url) setStep(2); // skip to profile info
  }, []);

  const isReturning = !!(user?.username || user?.bio || user?.avatar_url);

  const next = () => {
    if (step < STEPS.length) setStep(s => s + 1);
    else done();
  };

  const done = async () => {
    await refreshUser().catch(() => {});
    navigation.replace('FamilyGate');
  };

  return (
    <View style={s.container}>
      <LinearGradient colors={['#1C1A14', '#2A2720', '#1C1A14']} style={StyleSheet.absoluteFill} />
      <View style={s.glow1} />
      <View style={s.glow2} />

      <StepIndicator current={step} total={STEPS.length} />

      {isReturning && (
        <View style={s.returnBanner}>
          <Ionicons name="information-circle" size={16} color="#f59e0b" />
          <AppText style={s.returnBannerText}>Complete your profile to continue using KinsCribe</AppText>
        </View>
      )}

      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {step === 1 && <PhotoStep onNext={next} />}
        {step === 2 && <ProfileStep onNext={next} required={isReturning} />}
        {step === 3 && <InterestsStep onNext={next} required={isReturning} />}
        {step === 4 && <PrivacyStep onNext={next} />}
        {step === 5 && <DiscoverStep onDone={done} />}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  glow1: { position: 'absolute', width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(45,90,39,0.15)', top: -60, right: -80 },
  glow2: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(196,163,90,0.08)', bottom: 80, left: -60 },

  stepWrap: { paddingTop: 56, paddingHorizontal: 24, paddingBottom: 8 },
  stepText: { fontSize: 12, color: colors.muted, marginBottom: 10, fontWeight: '600' },
  stepBar: { flexDirection: 'row', gap: 6 },
  stepDot: { flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.border2 },
  stepDotActive: { backgroundColor: colors.primary },

  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 },
  stepContent: { flex: 1, alignItems: 'center', paddingTop: 24 },
  stepTitle: { fontSize: 26, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: 8 },
  stepSub: { fontSize: 14, color: colors.muted, textAlign: 'center', marginBottom: 32, lineHeight: 20 },

  // Photo step
  avatarWrap: { marginBottom: 20, position: 'relative' },
  avatar: { width: 150, height: 150, borderRadius: 75, borderWidth: 3, borderColor: colors.primary },
  avatarPlaceholder: { width: 150, height: 150, borderRadius: 75, alignItems: 'center', justifyContent: 'center', gap: 8, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(45,90,39,0.4)', borderStyle: 'dashed' },
  addPhotoText: { color: colors.muted, fontSize: 13, fontWeight: '500' },
  editBadge: { position: 'absolute', bottom: 4, right: 4, borderRadius: 20, overflow: 'hidden', ...shadows.sm },
  editBadgeInner: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  changeText: { color: colors.primary, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  skip: { color: colors.muted, fontSize: 14 },

  // Profile step
  fieldLabel: { fontSize: 11, color: colors.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, alignSelf: 'flex-start', width: '100%' },
  input: { width: '100%', backgroundColor: 'rgba(42,39,32,0.9)', borderWidth: 1, borderColor: colors.border2, borderRadius: radius.md, padding: 14, color: colors.text, fontSize: 14, marginBottom: 4 },
  charCount: { alignSelf: 'flex-end', fontSize: 11, color: colors.dim, marginBottom: 16 },
  inputRow: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(42,39,32,0.9)', borderWidth: 1, borderColor: colors.border2, borderRadius: radius.md, paddingHorizontal: 14, marginBottom: 4 },
  inputInner: { flex: 1, paddingVertical: 13, color: colors.text, fontSize: 14 },

  // Interests step
  interestsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', width: '100%' },
  interestChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.full, backgroundColor: 'rgba(42,39,32,0.9)', borderWidth: 1, borderColor: colors.border2, position: 'relative' },
  interestChipActive: { backgroundColor: 'rgba(45,90,39,0.25)', borderColor: colors.primary },
  interestIcon: { fontSize: 16 },
  interestLabel: { fontSize: 13, color: colors.muted, fontWeight: '600' },
  interestLabelActive: { color: colors.text },
  interestCheck: { position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: 8, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  selectedCount: { fontSize: 13, color: colors.muted, marginTop: 12 },

  // Privacy step
  privacyCard: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: radius.lg, backgroundColor: 'rgba(42,39,32,0.8)', borderWidth: 1.5, borderColor: colors.border2, marginBottom: 12 },
  privacyCardActive: { borderColor: colors.primary, backgroundColor: 'rgba(45,90,39,0.15)' },
  privacyIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  privacyTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 3 },
  privacySub: { fontSize: 12, color: colors.muted, lineHeight: 17 },
  radioOuter: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border2, alignItems: 'center', justifyContent: 'center' },
  radioOuterActive: { borderColor: colors.primary },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary },

  // Discover step
  noSuggestions: { alignItems: 'center', marginTop: 40, gap: 10 },
  noSuggestionsText: { color: colors.muted, fontSize: 15 },
  suggestionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: colors.border, width: '100%' },
  suggestionAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  suggestionAvatarLetter: { color: '#fff', fontWeight: '700', fontSize: 18 },
  suggestionName: { fontSize: 14, fontWeight: '700', color: colors.text },
  suggestionHandle: { fontSize: 12, color: colors.muted },
  followBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.primary },
  followBtnActive: { backgroundColor: colors.primary },
  followBtnText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  followBtnTextActive: { color: '#fff' },
  returnBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(245,158,11,0.12)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)', marginHorizontal: 24, marginBottom: 4, borderRadius: 10, padding: 10 },
  returnBannerText: { flex: 1, fontSize: 12, color: '#f59e0b', fontWeight: '600', lineHeight: 17 },
  stepError: { fontSize: 12, color: '#f87171', marginBottom: 10, textAlign: 'center', fontWeight: '600' },
});
