import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, Image, Dimensions, StatusBar, Modal,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { colors, radius, shadows } from '../theme';
import GradientButton from '../components/GradientButton';
import api from '../api/axios';

WebBrowser.maybeCompleteAuthSession();

const { width, height } = Dimensions.get('window');
const HERO_HEIGHT = height * 0.32;

// ── Forgot Password Modal ─────────────────────────────────────
function ForgotPasswordModal({ visible, onClose }) {
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [newPass, setNewPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const inputRefs = useRef([]);

  const reset = () => {
    setStep('email'); setEmail(''); setOtp(['', '', '', '', '', '']);
    setNewPass(''); setError(''); setInfo('');
  };

  const handleClose = () => { reset(); onClose(); };

  const handleOtpChange = (val, idx) => {
    if (!/^[0-9]?$/.test(val)) return;
    const next = [...otp];
    next[idx] = val;
    setOtp(next);
    if (val && idx < 5) inputRefs.current[idx + 1]?.focus();
  };

  const handleOtpKeyPress = (e, idx) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
  };

  const sendCode = async () => {
    if (!email.trim()) return setError('Enter your email address.');
    setError(''); setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim().toLowerCase() });
      setInfo(`A 6-digit code was sent to ${email.trim().toLowerCase()}`);
      setStep('code');
    } catch (err) {
      console.log('forgot pw error:', JSON.stringify(err.response?.data), err.message);
      setError(err.response?.data?.error || 'Something went wrong. Try again.');
    } finally { setLoading(false); }
  };

  const resetPassword = async () => {
    const code = otp.join('');
    if (code.length < 6) return setError('Enter the full 6-digit code.');
    if (newPass.length < 6) return setError('Password must be at least 6 characters.');
    setError(''); setLoading(true);
    try {
      await api.post('/auth/reset-password', { token: code, password: newPass });
      setStep('done');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid or expired code.');
    } finally { setLoading(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView style={fp.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <BlurView intensity={20} tint="dark" style={fp.sheet}>
          <LinearGradient colors={['rgba(124,58,237,0.1)', 'rgba(15,23,42,0.98)']} style={StyleSheet.absoluteFill} />
          <View style={fp.handle} />
          <View style={fp.inner}>
            <TouchableOpacity style={fp.closeBtn} onPress={handleClose}>
              <Ionicons name="close" size={22} color={colors.muted} />
            </TouchableOpacity>

            {step === 'done' ? (
              <View style={fp.doneWrap}>
                <LinearGradient colors={['#10b981', '#059669']} style={fp.doneIconWrap}>
                  <Ionicons name="checkmark" size={36} color="#fff" />
                </LinearGradient>
                <Text style={fp.title}>Password Updated!</Text>
                <Text style={fp.sub}>You can now sign in with your new password.</Text>
                <TouchableOpacity style={fp.doneBtn} onPress={handleClose}>
                  <LinearGradient colors={['#7c3aed', '#3b82f6']} style={fp.doneBtnGrad}>
                    <Text style={fp.doneBtnText}>Back to Sign In</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={fp.iconWrap}>
                  <LinearGradient colors={['#7c3aed', '#3b82f6']} style={fp.iconGrad}>
                    <Ionicons name={step === 'email' ? 'mail-outline' : 'keypad-outline'} size={26} color="#fff" />
                  </LinearGradient>
                </View>

                <Text style={fp.title}>
                  {step === 'email' ? 'Forgot Password?' : 'Enter Reset Code'}
                </Text>
                <Text style={fp.sub}>
                  {step === 'email'
                    ? "Enter your registered email and we'll send you a 6-digit reset code."
                    : info}
                </Text>

                {error ? (
                  <View style={fp.errorBox}>
                    <Ionicons name="alert-circle" size={14} color="#f87171" />
                    <Text style={fp.errorText}>{error}</Text>
                  </View>
                ) : null}

                {step === 'email' ? (
                  <>
                    <Text style={fp.label}>Email Address</Text>
                    <View style={fp.inputWrap}>
                      <Ionicons name="mail-outline" size={17} color={colors.muted} />
                      <TextInput
                        style={fp.input}
                        placeholder="you@example.com"
                        placeholderTextColor={colors.dim}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        value={email}
                        onChangeText={v => { setEmail(v); setError(''); }}
                      />
                    </View>
                    <TouchableOpacity style={fp.btn} onPress={sendCode} disabled={loading} activeOpacity={0.85}>
                      <LinearGradient colors={['#7c3aed', '#3b82f6']} style={fp.btnGrad}>
                        {loading
                          ? <ActivityIndicator color="#fff" size="small" />
                          : <Text style={fp.btnText}>Send Reset Code</Text>}
                      </LinearGradient>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    {/* OTP boxes */}
                    <View style={fp.otpRow}>
                      {otp.map((digit, idx) => (
                        <TextInput
                          key={idx}
                          ref={r => inputRefs.current[idx] = r}
                          style={[fp.otpBox, digit ? fp.otpBoxFilled : null]}
                          value={digit}
                          onChangeText={v => handleOtpChange(v, idx)}
                          onKeyPress={e => handleOtpKeyPress(e, idx)}
                          keyboardType="number-pad"
                          maxLength={1}
                          selectTextOnFocus
                        />
                      ))}
                    </View>

                    <Text style={fp.label}>New Password</Text>
                    <View style={fp.inputWrap}>
                      <Ionicons name="lock-closed-outline" size={17} color={colors.muted} />
                      <TextInput
                        style={[fp.input, { flex: 1 }]}
                        placeholder="Min. 6 characters"
                        placeholderTextColor={colors.dim}
                        secureTextEntry={!showPass}
                        value={newPass}
                        onChangeText={setNewPass}
                      />
                      <TouchableOpacity onPress={() => setShowPass(p => !p)} style={{ padding: 4 }}>
                        <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={17} color={colors.muted} />
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity style={fp.btn} onPress={resetPassword} disabled={loading} activeOpacity={0.85}>
                      <LinearGradient colors={['#7c3aed', '#3b82f6']} style={fp.btnGrad}>
                        {loading
                          ? <ActivityIndicator color="#fff" size="small" />
                          : <Text style={fp.btnText}>Reset Password</Text>}
                      </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity style={fp.backLink} onPress={() => { setStep('email'); setError(''); setOtp(['','','','','','']); }}>
                      <Text style={fp.backLinkText}>← Use a different email</Text>
                    </TouchableOpacity>
                  </>
                )}
              </>
            )}
          </View>
        </BlurView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const fp = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', paddingBottom: 40 },
  handle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  inner: { padding: 24, paddingTop: 12 },
  closeBtn: { alignSelf: 'flex-end', padding: 4, marginBottom: 8 },
  iconWrap: { alignSelf: 'center', marginBottom: 16 },
  iconGrad: { width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: 6, marginTop: 12 },
  sub: { fontSize: 13, color: colors.muted, textAlign: 'center', marginBottom: 20, lineHeight: 19 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(248,113,113,0.1)', borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)', borderRadius: radius.sm, padding: 10, marginBottom: 14 },
  errorText: { color: '#f87171', fontSize: 12, flex: 1 },
  label: { fontSize: 11, color: colors.muted, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(30,41,59,0.9)', borderWidth: 1, borderColor: colors.border2, borderRadius: radius.md, paddingHorizontal: 14, marginBottom: 16 },
  input: { flex: 1, paddingVertical: 13, color: colors.text, fontSize: 14 },
  otpRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  otpBox: { width: 46, height: 56, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border2, backgroundColor: 'rgba(30,41,59,0.9)', textAlign: 'center', fontSize: 22, fontWeight: '800', color: colors.text },
  otpBoxFilled: { borderColor: '#7c3aed', backgroundColor: 'rgba(124,58,237,0.1)' },
  btn: { borderRadius: radius.md, overflow: 'hidden', marginTop: 4 },
  btnGrad: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  backLink: { alignSelf: 'center', marginTop: 16 },
  backLinkText: { color: colors.muted, fontSize: 13 },
  doneWrap: { alignItems: 'center', paddingVertical: 24, gap: 10 },
  doneIconWrap: { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  doneBtn: { marginTop: 16, borderRadius: radius.full, overflow: 'hidden' },
  doneBtnGrad: { paddingHorizontal: 40, paddingVertical: 14 },
  doneBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

// ── Login Screen ──────────────────────────────────────────────
export default function LoginScreen({ navigation }) {
  const { login, loginWithGoogle } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: '474767363654-6knta78fh5ibd8q0a6894o8euqrs90js.apps.googleusercontent.com',
    webClientId: '474767363654-i0sdd1v140399n0mfhf0qreqn9lj30u5.apps.googleusercontent.com',
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const token = response.authentication?.accessToken || response.params?.access_token;
      if (token) handleGoogleToken(token);
    }
  }, [response]);

  const handleGoogleToken = async (accessToken) => {
    setGoogleLoading(true);
    setError('');
    try {
      const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const userInfo = await userInfoRes.json();
      const { data } = await api.post('/auth/google', { id_token: accessToken, user_info: userInfo });
      await AsyncStorage.setItem('access_token', data.access_token);
      await AsyncStorage.setItem('refresh_token', data.refresh_token);
      loginWithGoogle(data);
      if (data.is_new_user) navigation.navigate('SetupProfile');
    } catch (err) {
      setError('Google sign-in failed. Try again.');
    } finally { setGoogleLoading(false); }
  };

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient colors={['#0f172a', '#1a0a2e', '#0f172a']} style={StyleSheet.absoluteFill} />

      {/* ── HERO BANNER ── */}
      <View style={s.hero}>
        <Image source={require('../../assets/kinscribe-logo.png')} style={s.heroImg} resizeMode="cover" />
        <LinearGradient colors={['rgba(15,23,42,0.1)', 'rgba(15,23,42,0.55)', '#0f172a']} style={StyleSheet.absoluteFill} />
        <View style={s.glowPurple} />
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <BlurView intensity={40} tint="dark" style={s.backBtnBlur}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </BlurView>
        </TouchableOpacity>
        <View style={s.heroText}>
          <Text style={s.appName}>KinsCribe</Text>
          <Text style={s.heroSub}>Welcome back 👋</Text>
        </View>
      </View>

      {/* ── FORM ── */}
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <BlurView intensity={20} tint="dark" style={s.card}>
          <LinearGradient colors={['rgba(124,58,237,0.08)', 'rgba(15,23,42,0.7)']} style={StyleSheet.absoluteFill} />
          <View style={s.cardInner}>
            <Text style={s.cardTitle}>Sign In</Text>
            <Text style={s.cardSub}>Enter your details to continue</Text>

            {error ? (
              <View style={s.errorBox}>
                <Ionicons name="alert-circle" size={16} color="#f87171" />
                <Text style={s.errorText}>{error}</Text>
              </View>
            ) : null}

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
                onChangeText={v => setForm({ ...form, email: v })}
              />
            </View>

            <Text style={s.label}>Password</Text>
            <View style={s.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.muted} />
              <TextInput
                style={[s.input, { flex: 1 }]}
                placeholder="••••••••"
                placeholderTextColor={colors.dim}
                secureTextEntry={!showPass}
                value={form.password}
                onChangeText={v => setForm({ ...form, password: v })}
              />
              <TouchableOpacity onPress={() => setShowPass(p => !p)} style={{ padding: 4 }}>
                <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.muted} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={s.forgotBtn} onPress={() => setShowForgot(true)}>
              <Text style={s.forgotText}>Forgot password?</Text>
            </TouchableOpacity>

            <GradientButton label="Sign In" onPress={handleLogin} loading={loading} style={{ marginTop: 4 }} />

            <View style={s.dividerRow}>
              <View style={s.dividerLine} />
              <Text style={s.dividerText}>OR</Text>
              <View style={s.dividerLine} />
            </View>

            <TouchableOpacity
              style={s.googleBtn}
              onPress={() => promptAsync()}
              disabled={!request || googleLoading}
              activeOpacity={0.8}
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
          </View>
        </BlurView>

        <View style={s.footer}>
          <Text style={s.footerText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={s.footerLink}>Sign up free</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={s.inviteRow} onPress={() => navigation.navigate('JoinFamily')}>
          <Ionicons name="key-outline" size={14} color={colors.dim} />
          <Text style={s.inviteText}>Have an invite code? Join family</Text>
        </TouchableOpacity>
      </ScrollView>

      <ForgotPasswordModal visible={showForgot} onClose={() => setShowForgot(false)} />
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  hero: { width, height: HERO_HEIGHT, position: 'relative', overflow: 'hidden' },
  heroImg: { width: '100%', height: '100%' },
  glowPurple: { position: 'absolute', width: 250, height: 250, borderRadius: 125, backgroundColor: 'rgba(124,58,237,0.2)', top: -60, right: -40 },
  backBtn: { position: 'absolute', top: 52, left: 16 },
  backBtnBlur: { width: 38, height: 38, borderRadius: 19, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  heroText: { position: 'absolute', bottom: 24, left: 24 },
  appName: { fontSize: 38, fontWeight: '900', color: '#fff', letterSpacing: -1.5, textShadowColor: 'rgba(124,58,237,0.9)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 16 },
  heroSub: { fontSize: 15, color: 'rgba(255,255,255,0.65)', marginTop: 4, fontWeight: '400' },
  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  card: { borderRadius: radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(124,58,237,0.2)', ...shadows.lg },
  cardInner: { padding: 24 },
  cardTitle: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 4 },
  cardSub: { fontSize: 13, color: colors.muted, marginBottom: 20 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(248,113,113,0.1)', borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)', borderRadius: radius.sm, padding: 12, marginBottom: 16 },
  errorText: { color: '#f87171', fontSize: 13, flex: 1 },
  label: { fontSize: 12, color: colors.muted, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(30,41,59,0.8)', borderWidth: 1, borderColor: colors.border2, borderRadius: radius.md, paddingHorizontal: 14, marginBottom: 16 },
  input: { flex: 1, paddingVertical: 14, color: colors.text, fontSize: 14 },
  forgotBtn: { alignSelf: 'flex-end', marginBottom: 16, marginTop: -8 },
  forgotText: { color: '#7c3aed', fontSize: 13, fontWeight: '600' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 18, gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.dim, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#fff', borderRadius: radius.md, padding: 13, minHeight: 48 },
  googleText: { color: '#1f1f1f', fontSize: 15, fontWeight: '600' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24, marginBottom: 8 },
  footerText: { color: colors.muted, fontSize: 14 },
  footerLink: { color: '#7c3aed', fontSize: 14, fontWeight: '700' },
  inviteRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  inviteText: { color: colors.dim, fontSize: 13 },
});
