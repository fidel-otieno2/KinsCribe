import { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import AppText from '../components/AppText';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../i18n';
import { colors, radius, shadows } from '../theme';
import GradientButton from '../components/GradientButton';

export default function FamilyGateScreen({ navigation }) {
  const { user, refreshUser } = useAuth();
  const { t } = useTranslation();
  const [view, setView] = useState(null);
  const [loading, setLoading] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', description: '' });
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleCreate = async () => {
    if (!createForm.name.trim()) return setError('Please enter a family name');
    setError(''); setSuccess(''); setLoading(true);
    try {
      const { data } = await api.post('/family/create', createForm);
      await refreshUser();
      setSuccess(`"${data.family.name}" created! Taking you in...`);
      setTimeout(() => navigation.replace('Main'), 1200);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create family. Please try again.');
    } finally { setLoading(false); }
  };

  const handleJoin = async () => {
    if (!inviteCode.trim()) return setError('Please enter an invite code');
    setError(''); setSuccess(''); setLoading(true);
    try {
      const { data } = await api.post('/family/join', { invite_code: inviteCode });
      await refreshUser();
      setSuccess(`Joined "${data.family.name}"! Taking you in...`);
      setTimeout(() => navigation.replace('Main'), 1200);
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid code. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <LinearGradient colors={['#0f172a', '#1e1040', '#0f172a']} style={StyleSheet.absoluteFill} />
      <View style={s.orb1} /><View style={s.orb2} />

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.logoWrap}>
          <LinearGradient colors={['#7c3aed', '#3b82f6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.logoIcon}>
            <Ionicons name="people" size={28} color="#fff" />
          </LinearGradient>
          <AppText style={s.logo}>KinsCribe</AppText>
        </View>

        {!view ? (
          <BlurView intensity={25} tint="dark" style={s.card}>
            <View style={s.cardInner}>
              <AppText style={s.title}>Welcome, {user?.name?.split(' ')[0]}! 👋</AppText>
              <AppText style={s.sub}>Join or create a family group to get started</AppText>

              <TouchableOpacity style={s.option} onPress={() => setView('create')} activeOpacity={0.8}>
                <LinearGradient colors={['rgba(124,58,237,0.2)', 'rgba(59,130,246,0.1)']} style={s.optGradient}>
                  <View style={s.optIcon}>
                    <Ionicons name="add-circle" size={28} color="#7c3aed" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText style={s.optTitle}>Create a Family</AppText>
                    <AppText style={s.optSub}>Start a new group and invite members</AppText>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.muted} />
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity style={s.option} onPress={() => setView('join')} activeOpacity={0.8}>
                <LinearGradient colors={['rgba(59,130,246,0.2)', 'rgba(124,58,237,0.1)']} style={s.optGradient}>
                  <View style={s.optIcon}>
                    <Ionicons name="key" size={28} color="#3b82f6" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText style={s.optTitle}>Join with Invite Code</AppText>
                    <AppText style={s.optSub}>Enter a code from your family admin</AppText>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.muted} />
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity 
                style={s.skipButton} 
                onPress={() => navigation.replace('Main')} 
                activeOpacity={0.7}
              >
                <AppText style={s.skipText}>Skip for now</AppText>
                <AppText style={s.skipSubtext}>You can join or create a family later</AppText>
              </TouchableOpacity>
            </View>
          </BlurView>
        ) : (
          <BlurView intensity={25} tint="dark" style={s.card}>
            <View style={s.cardInner}>
              <AppText style={s.title}>{view === 'create' ? 'Create Your Family' : 'Join a Family'}</AppText>

              {error ? (
                <View style={s.errorBox}>
                  <Ionicons name="alert-circle" size={16} color="#f87171" />
                  <AppText style={s.errorText}>{error}</AppText>
                </View>
              ) : null}

              {success ? (
                <View style={s.successBox}>
                  <Ionicons name="checkmark-circle" size={16} color="#34d399" />
                  <AppText style={s.successText}>{success}</AppText>
                </View>
              ) : null}

              {view === 'create' ? (
                <>
                  <AppText style={s.inputLabel}>Family Name</AppText>
                  <View style={s.inputWrap}>
                    <Ionicons name="home-outline" size={18} color={colors.muted} style={{ marginRight: 10 }} />
                    <TextInput style={[s.input, { flex: 1 }]} placeholder="e.g. The Otieno Family"
                      placeholderTextColor={colors.dim} value={createForm.name}
                      onChangeText={v => setCreateForm({ ...createForm, name: v })} />
                  </View>
                  <AppText style={s.inputLabel}>Description (optional)</AppText>
                  <View style={s.inputWrap}>
                    <Ionicons name="text-outline" size={18} color={colors.muted} style={{ marginRight: 10 }} />
                    <TextInput style={[s.input, { flex: 1 }]} placeholder="A brief description..."
                      placeholderTextColor={colors.dim} value={createForm.description}
                      onChangeText={v => setCreateForm({ ...createForm, description: v })} />
                  </View>
                  <GradientButton label="Create Family" onPress={handleCreate} loading={loading} />
                </>
              ) : (
                <>
                  <AppText style={s.inputLabel}>Invite Code</AppText>
                  <TextInput style={s.codeInput} placeholder="AB12CD34" placeholderTextColor={colors.dim}
                    autoCapitalize="characters" value={inviteCode}
                    onChangeText={v => setInviteCode(v.toUpperCase())} />
                  <GradientButton label="Join Family" onPress={handleJoin} loading={loading} />
                </>
              )}

              <TouchableOpacity onPress={() => { setView(null); setError(''); }} style={{ marginTop: 16, alignItems: 'center' }}>
                <AppText style={{ color: colors.muted, fontSize: 14 }}>← Back</AppText>
              </TouchableOpacity>
            </View>
          </BlurView>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, padding: 24, justifyContent: 'center', paddingBottom: 40 },
  orb1: { position: 'absolute', width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(124,58,237,0.15)', top: -60, left: -80 },
  orb2: { position: 'absolute', width: 250, height: 250, borderRadius: 125, backgroundColor: 'rgba(59,130,246,0.1)', bottom: 60, right: -60 },
  logoWrap: { alignItems: 'center', marginBottom: 32 },
  logoIcon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 12, ...shadows.lg },
  logo: { fontSize: 32, fontWeight: '800', color: colors.text },
  card: { borderRadius: radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: colors.border2, ...shadows.lg },
  cardInner: { backgroundColor: 'rgba(15,23,42,0.6)', padding: 24 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 6 },
  sub: { fontSize: 13, color: colors.muted, marginBottom: 24 },
  option: { borderRadius: radius.lg, overflow: 'hidden', marginBottom: 12, borderWidth: 1, borderColor: colors.border2 },
  optGradient: { flexDirection: 'row', alignItems: 'center', padding: 18, gap: 14 },
  optIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(30,41,59,0.8)', alignItems: 'center', justifyContent: 'center' },
  optTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 3 },
  optSub: { fontSize: 12, color: colors.muted },
  skipButton: { marginTop: 24, padding: 16, alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border2 },
  skipText: { fontSize: 15, fontWeight: '600', color: colors.muted, marginBottom: 4 },
  skipSubtext: { fontSize: 12, color: colors.dim },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(248,113,113,0.1)', borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)', borderRadius: radius.sm, padding: 12, marginBottom: 16 },
  errorText: { color: '#f87171', fontSize: 13, flex: 1 },
  successBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(52,211,153,0.1)', borderWidth: 1, borderColor: 'rgba(52,211,153,0.3)', borderRadius: radius.sm, padding: 12, marginBottom: 16 },
  successText: { color: '#34d399', fontSize: 13, flex: 1, fontWeight: '600' },
  inputLabel: { fontSize: 13, color: colors.muted, marginBottom: 8, fontWeight: '500' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(30,41,59,0.8)', borderWidth: 1, borderColor: colors.border2, borderRadius: radius.md, paddingHorizontal: 14, marginBottom: 16 },
  input: { paddingVertical: 14, color: colors.text, fontSize: 14 },
  codeInput: { backgroundColor: 'rgba(30,41,59,0.8)', borderWidth: 1, borderColor: colors.border2, borderRadius: radius.md, padding: 16, color: colors.text, fontSize: 24, fontWeight: '800', letterSpacing: 8, textAlign: 'center', marginBottom: 20 },
});
