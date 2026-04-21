import { useState } from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import AppText from '../components/AppText';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../i18n';
import { colors, radius, shadows } from '../theme';
import GradientButton from '../components/GradientButton';

export default function JoinFamilyScreen({ navigation }) {
  const { refreshUser } = useAuth();
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleJoin = async () => {
    if (!code.trim()) return setError('Enter an invite code');
    setError(''); setLoading(true);
    try {
      await api.post('/family/join', { invite_code: code });
      await refreshUser();
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid invite code');
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <LinearGradient colors={['#0f172a', '#1e1040', '#0f172a']} style={StyleSheet.absoluteFill} />
      <View style={s.orb1} />

      <View style={s.content}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>

        <LinearGradient colors={['#7c3aed', '#3b82f6']} style={s.iconWrap}>
          <Ionicons name="key" size={32} color="#fff" />
        </LinearGradient>

        <AppText style={s.title}>{t('join_family')}</AppText>
        <AppText style={s.sub}>Enter the invite code sent by your family admin</AppText>

        <BlurView intensity={20} tint="dark" style={s.card}>
          <View style={s.cardInner}>
            {error ? (
              <View style={s.errorBox}>
                <Ionicons name="alert-circle" size={16} color="#f87171" />
                <AppText style={s.errorText}>{error}</AppText>
              </View>
            ) : null}

            <AppText style={s.inputLabel}>Invite Code</AppText>
            <TextInput
              style={s.codeInput}
              placeholder="AB12CD34"
              placeholderTextColor={colors.dim}
              autoCapitalize="characters"
              value={code}
              onChangeText={v => setCode(v.toUpperCase())}
              maxLength={8}
            />
            <AppText style={s.hint}>Code is 8 characters long</AppText>
            <GradientButton label={t('join_family')} onPress={handleJoin} loading={loading} style={{ marginTop: 8 }} />
          </View>
        </BlurView>

        <TouchableOpacity onPress={() => navigation.navigate('Login')} style={{ marginTop: 24, alignItems: 'center' }}>
          <AppText style={{ color: colors.muted, fontSize: 14 }}>Already have an account? <AppText style={{ color: '#7c3aed', fontWeight: '700' }}>Sign in</AppText></AppText>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  orb1: { position: 'absolute', width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(124,58,237,0.15)', top: -60, right: -80 },
  content: { flex: 1, padding: 24, justifyContent: 'center' },
  backBtn: { position: 'absolute', top: 52, left: 24, padding: 8 },
  iconWrap: { width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 20, alignSelf: 'center', ...shadows.lg },
  title: { fontSize: 28, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: 8 },
  sub: { fontSize: 14, color: colors.muted, textAlign: 'center', marginBottom: 32, lineHeight: 20 },
  card: { borderRadius: radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: colors.border2 },
  cardInner: { backgroundColor: 'rgba(15,23,42,0.6)', padding: 24 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(248,113,113,0.1)', borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)', borderRadius: radius.sm, padding: 12, marginBottom: 16 },
  errorText: { color: '#f87171', fontSize: 13, flex: 1 },
  inputLabel: { fontSize: 13, color: colors.muted, marginBottom: 10, fontWeight: '500' },
  codeInput: { backgroundColor: 'rgba(30,41,59,0.8)', borderWidth: 1, borderColor: 'rgba(124,58,237,0.4)', borderRadius: radius.md, padding: 18, color: '#a78bfa', fontSize: 28, fontWeight: '800', letterSpacing: 10, textAlign: 'center', marginBottom: 8 },
  hint: { fontSize: 12, color: colors.dim, textAlign: 'center', marginBottom: 16 },
});
