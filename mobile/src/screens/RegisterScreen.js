import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, Image, Dimensions, StatusBar, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../api/axios';
import { colors, radius, shadows } from '../theme';
import GradientButton from '../components/GradientButton';

WebBrowser.maybeCompleteAuthSession();

const { width, height } = Dimensions.get('window');
const HERO_HEIGHT = height * 0.28;

export default function RegisterScreen({ navigation }) {
  const { login, loginWithGoogle } = useAuth();
  const { theme, isDark } = useTheme();
  const [form, setForm] = useState({ name: '', username: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState(null); // null | 'checking' | 'available' | 'taken' | 'invalid'

  const set = key => val => {
    setForm(f => ({ ...f, [key]: val }));
    if (key === 'username') checkUsername(val);
  };

  const checkUsername = useCallback(
    debounce(async (val) => {
      const clean = val.toLowerCase().replace(/\s/g, '');
      if (clean.length < 3) { setUsernameStatus(null); return; }
      setUsernameStatus('checking');
      try {
        const { data } = await api.get(`/auth/username/check?username=${clean}`);
        setUsernameStatus(data.available ? 'available' : 'taken');
      } catch { setUsernameStatus(null); }
    }, 600),
    []
  );

  function debounce(fn, delay) {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
  }

  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: '474767363654-6knta78fh5ibd8q0a6894o8euqrs90js.apps.googleusercontent.com',
    webClientId: '474767363654-i0sdd1v140399n0mfhf0qreqn9lj30u5.apps.googleusercontent.com',
    scopes: ['profile', 'email'],
    redirectUri: 'https://auth.expo.io/@martinsfidel/kinscribe',
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const token =
        response.authentication?.accessToken ||
        response.params?.access_token ||
        response.authentication?.idToken ||
        response.params?.id_token;
      if (token) handleGoogleToken(token);
      else setError('Google sign-in failed: no token received.');
    } else if (response?.type === 'error') {
      setError('Google sign-in was cancelled or failed.');
    }
  }, [response]);

  const handleGoogleToken = async (accessToken) => {
    setGoogleLoading(true);
    setError('');
    try {
      const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!userInfoRes.ok) throw new Error('Failed to fetch Google user info');
      const userInfo = await userInfoRes.json();
      if (!userInfo.email) throw new Error('No email from Google');
      const { data } = await api.post('/auth/google', { id_token: accessToken, user_info: userInfo });
      await AsyncStorage.setItem('access_token', data.access_token);
      await AsyncStorage.setItem('refresh_token', data.refresh_token);
      loginWithGoogle(data);
      if (data.is_new_user) navigation.navigate('SetupProfile');
    } catch (err) {
      console.log('Google register error:', err.message, err.response?.data);
      setError(err.response?.data?.error || err.message || 'Google sign-in failed. Try again.');
    } finally { setGoogleLoading(false); }
  };

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
    <KeyboardAvoidingView style={[s.container, { backgroundColor: theme.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
      <LinearGradient colors={isDark ? ['#0f172a', '#1a0a2e', '#0f172a'] : [theme.bg, theme.bgSecondary, theme.bg]} style={StyleSheet.absoluteFill} />

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
            <Text style={[s.cardTitle, { color: theme.text }]}>Create Account</Text>
            <Text style={[s.cardSub, { color: theme.muted }]}>Start preserving your family memories</Text>

            {error ? (
              <View style={s.errorBox}>
                <Ionicons name="alert-circle" size={16} color="#f87171" />
                <Text style={s.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Full Name */}
            <Text style={[s.label, { color: theme.muted }]}>Full Name</Text>
            <View style={[s.inputWrap, { backgroundColor: theme.bgCard, borderColor: theme.border2 }]}>
              <Ionicons name="person-outline" size={18} color={theme.muted} />
              <TextInput
                style={[s.input, { color: theme.text }]}
                placeholder="e.g. Fidel Otieno"
                placeholderTextColor={theme.dim}
                autoCapitalize="words"
                value={form.name}
                onChangeText={set('name')}
              />
            </View>

            {/* Username */}
            <Text style={[s.label, { color: theme.muted }]}>Username</Text>
            <View style={[s.inputWrap, { backgroundColor: theme.bgCard, borderColor: theme.border2 }]}>
              <Text style={[s.atSign, { color: theme.muted }]}>@</Text>
              <TextInput
                style={[s.input, { flex: 1, color: theme.text }]}
                placeholder="yourname"
                placeholderTextColor={theme.dim}
                autoCapitalize="none"
                value={form.username}
                onChangeText={v => set('username')(v.toLowerCase().replace(/\s/g, ''))}
              />
            </View>

            {/* Email */}
            <Text style={[s.label, { color: theme.muted }]}>Email</Text>
            <View style={[s.inputWrap, { backgroundColor: theme.bgCard, borderColor: theme.border2 }]}>
              <Ionicons name="mail-outline" size={18} color={theme.muted} />
              <TextInput
                style={[s.input, { color: theme.text }]}
                placeholder="you@example.com"
                placeholderTextColor={theme.dim}
                keyboardType="email-address"
                autoCapitalize="none"
                value={form.email}
                onChangeText={set('email')}
              />
            </View>

            {/* Password */}
            <Text style={[s.label, { color: theme.muted }]}>Password</Text>
            <View style={[s.inputWrap, { backgroundColor: theme.bgCard, borderColor: theme.border2 }]}>
              <Ionicons name="lock-closed-outline" size={18} color={theme.muted} />
              <TextInput
                style={[s.input, { flex: 1, color: theme.text }]}
                placeholder="Min. 6 characters"
                placeholderTextColor={theme.dim}
                secureTextEntry={!showPass}
                value={form.password}
                onChangeText={set('password')}
              />
              <TouchableOpacity onPress={() => setShowPass(!showPass)} style={{ padding: 4 }}>
                <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={theme.muted} />
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
                          : theme.border,
                    }]}
                  />
                ))}
                <Text style={[s.strengthText, { color: theme.muted }]}>
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
              <View style={[s.dividerLine, { backgroundColor: theme.border }]} />
              <Text style={[s.dividerText, { color: theme.dim }]}>OR</Text>
              <View style={[s.dividerLine, { backgroundColor: theme.border }]} />
            </View>

            <TouchableOpacity
              style={s.googleBtn}
              activeOpacity={0.8}
              onPress={() => promptAsync()}
              disabled={!request || googleLoading}
            >
              {googleLoading ? (
                <ActivityIndicator size="small" color="#1f1f1f" />
              ) : (
                <>
                  <Svg width={20} height={20} viewBox="0 0 48 48">
                    <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                    <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                    <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                  </Svg>
                  <Text style={s.googleText}>Continue with Google</Text>
                </>
              )}
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
          <Text style={[s.footerText, { color: theme.muted }]}>Already have an account? </Text>
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
    backgroundColor: '#fff',
    borderRadius: radius.md, padding: 13, minHeight: 48,
  },
  googleText: { color: '#1f1f1f', fontSize: 15, fontWeight: '600' },
  terms: { fontSize: 11, color: colors.dim, textAlign: 'center', marginTop: 16, lineHeight: 16 },
  termsLink: { color: '#7c3aed', fontWeight: '600' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  footerText: { color: colors.muted, fontSize: 14 },
  footerLink: { color: '#7c3aed', fontSize: 14, fontWeight: '700' },
});
