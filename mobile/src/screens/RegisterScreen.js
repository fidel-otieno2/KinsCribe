import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, Image, Dimensions, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { colors, radius, shadows } from '../theme';
import GradientButton from '../components/GradientButton';

const { width, height } = Dimensions.get('window');
const HERO_HEIGHT = height * 0.28;

export default function RegisterScreen({ navigation }) {
  const { login } = useAuth();
  const [form, setForm] = useState({ name: '', username: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);

  const set = key => val => setForm(f => ({ ...f, [key]: val }));

  const handleRegister = async () => {
    setError('');
    if (!form.name || !form.username || !form.email || !form.password)
      return setError('All fields are required');
    if (form.password.length < 6)
      return setError('Password must be at least 6 characters');
    setLoading(true);
    try {
      await api.post('/auth/register', form);
      await login(form.email, form.password);
      navigation.navigate('SetupProfile');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient colors={['#0f172a', '#1a0a2e', '#0f172a']} style={StyleSheet.absoluteFill} />

      {/* ── HERO BANNER ── */}
      <View style={s.hero}>
        <Image
          source={require('../../assets/kinscribe-logo.png')}
          style={s.heroImg}
          resizeMode="cover"
        />
        <LinearGradient
          colors={['rgba(15,23,42,0.05)', 'rgba(15,23,42,0.5)', '#0f172a']}
          style={StyleSheet.absoluteFill}
        />
        <View style={s.glowBlue} />

        {/* Back button */}
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <BlurView intensity={40} tint="dark" style={s.backBtnBlur}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </BlurView>
        </TouchableOpacity>

        {/* Branding */}
        <View style={s.heroText}>
          <Text style={s.appName}>KinsCribe</Text>
          <Text style={s.heroSub}>Join your family's story ✨</Text>
        </View>
      </View>

      {/* ── FORM ── */}
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <BlurView intensity={20} tint="dark" style={s.card}>
          <LinearGradient
            colors={['rgba(59,130,246,0.08)', 'rgba(15,23,42,0.7)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={s.cardInner}>
            <Text style={s.cardTitle}>Create Account</Text>
            <Text style={s.cardSub}>Start preserving your family memories</Text>

            {error ? (
              <View style={s.errorBox}>
                <Ionicons name="alert-circle" size={16} color="#f87171" />
                <Text style={s.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Full Name */}
            <Text style={s.label}>Full Name</Text>
            <View style={s.inputWrap}>
              <Ionicons name="person-outline" size={18} color={colors.muted} />
              <TextInput
                style={s.input}
                placeholder="e.g. Fidel Otieno"
                placeholderTextColor={colors.dim}
                autoCapitalize="words"
                value={form.name}
                onChangeText={set('name')}
              />
            </View>

            {/* Username */}
            <Text style={s.label}>Username</Text>
            <View style={s.inputWrap}>
              <Text style={s.atSign}>@</Text>
              <TextInput
                style={[s.input, { flex: 1 }]}
                placeholder="yourname"
                placeholderTextColor={colors.dim}
                autoCapitalize="none"
                value={form.username}
                onChangeText={v => set('username')(v.toLowerCase().replace(/\s/g, ''))}
              />
            </View>

            {/* Email */}
            <Text style={s.label}>Email</Text>
            <View style={s.inputWrap}>
              <Ionicons name="mail-outline" size={18} color={colors.muted} />
              <TextInput
                style={s.input}
                placeholder="you@example.com"
                placeholderTextColor={colors.dim}
                keyboardType="email-address"
                autoCapitalize="none"
                value={form.email}
                onChangeText={set('email')}
              />
            </View>

            {/* Password */}
            <Text style={s.label}>Password</Text>
            <View style={s.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.muted} />
              <TextInput
                style={[s.input, { flex: 1 }]}
                placeholder="Min. 6 characters"
                placeholderTextColor={colors.dim}
                secureTextEntry={!showPass}
                value={form.password}
                onChangeText={set('password')}
              />
              <TouchableOpacity onPress={() => setShowPass(!showPass)} style={{ padding: 4 }}>
                <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.muted} />
              </TouchableOpacity>
            </View>

            {/* Password strength hint */}
            {form.password.length > 0 && (
              <View style={s.strengthRow}>
                {[1, 2, 3, 4].map(i => (
                  <View
                    key={i}
                    style={[s.strengthBar, {
                      backgroundColor:
                        form.password.length >= i * 3
                          ? form.password.length >= 10 ? '#10b981'
                          : form.password.length >= 6 ? '#f59e0b' : '#e11d48'
                          : colors.border,
                    }]}
                  />
                ))}
                <Text style={s.strengthText}>
                  {form.password.length < 6 ? 'Too short' : form.password.length < 10 ? 'Good' : 'Strong'}
                </Text>
              </View>
            )}

            <GradientButton
              label="Create Account"
              onPress={handleRegister}
              loading={loading}
              style={{ marginTop: 12 }}
            />

            <View style={s.dividerRow}>
              <View style={s.dividerLine} />
              <Text style={s.dividerText}>OR</Text>
              <View style={s.dividerLine} />
            </View>

            <TouchableOpacity
              style={s.googleBtn}
              activeOpacity={0.8}
              onPress={() => alert('Google Sign-In coming soon')}
            >
              <Text style={s.googleG}>G</Text>
              <Text style={s.googleText}>Continue with Google</Text>
            </TouchableOpacity>

            <Text style={s.terms}>
              By signing up you agree to our{' '}
              <Text style={s.termsLink}>Terms of Service</Text>
              {' '}and{' '}
              <Text style={s.termsLink}>Privacy Policy</Text>
            </Text>
          </View>
        </BlurView>

        <View style={s.footer}>
          <Text style={s.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={s.footerLink}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },

  // hero
  hero: { width, height: HERO_HEIGHT, position: 'relative', overflow: 'hidden' },
  heroImg: { width: '100%', height: '100%' },
  glowBlue: {
    position: 'absolute', width: 220, height: 220, borderRadius: 110,
    backgroundColor: 'rgba(59,130,246,0.2)', top: -50, left: -40,
  },
  backBtn: { position: 'absolute', top: 52, left: 16 },
  backBtnBlur: {
    width: 38, height: 38, borderRadius: 19,
    overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  heroText: { position: 'absolute', bottom: 22, left: 24 },
  appName: {
    fontSize: 36, fontWeight: '900', color: '#fff',
    letterSpacing: -1.5,
    textShadowColor: 'rgba(59,130,246,0.9)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  heroSub: { fontSize: 14, color: 'rgba(255,255,255,0.65)', marginTop: 4 },

  // form
  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  card: {
    borderRadius: radius.xl, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)',
    ...shadows.lg,
  },
  cardInner: { padding: 24 },
  cardTitle: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 4 },
  cardSub: { fontSize: 13, color: colors.muted, marginBottom: 20 },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(248,113,113,0.1)',
    borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)',
    borderRadius: radius.sm, padding: 12, marginBottom: 16,
  },
  errorText: { color: '#f87171', fontSize: 13, flex: 1 },
  label: { fontSize: 12, color: colors.muted, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(30,41,59,0.8)',
    borderWidth: 1, borderColor: colors.border2,
    borderRadius: radius.md, paddingHorizontal: 14, marginBottom: 14,
  },
  atSign: { color: colors.muted, fontSize: 16, fontWeight: '600' },
  input: { flex: 1, paddingVertical: 13, color: colors.text, fontSize: 14 },
  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: -8, marginBottom: 14 },
  strengthBar: { flex: 1, height: 3, borderRadius: 2 },
  strengthText: { fontSize: 11, color: colors.muted, marginLeft: 4, fontWeight: '600' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 16, gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.dim, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: 'rgba(30,41,59,0.8)',
    borderWidth: 1, borderColor: colors.border2,
    borderRadius: radius.md, padding: 14,
  },
  googleG: { fontSize: 18, fontWeight: '800', color: '#4285F4' },
  googleText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  terms: { fontSize: 11, color: colors.dim, textAlign: 'center', marginTop: 16, lineHeight: 16 },
  termsLink: { color: '#7c3aed', fontWeight: '600' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  footerText: { color: colors.muted, fontSize: 14 },
  footerLink: { color: '#7c3aed', fontSize: 14, fontWeight: '700' },
});
