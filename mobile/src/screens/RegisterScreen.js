import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { colors, radius, shadows } from '../theme';
import GradientButton from '../components/GradientButton';

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

  const fields = [
    { key: 'name', label: 'Full Name', icon: 'person-outline', placeholder: 'Fidel Otieno', secure: false, kb: 'default' },
    { key: 'email', label: 'Email', icon: 'mail-outline', placeholder: 'you@example.com', secure: false, kb: 'email-address' },
    { key: 'password', label: 'Password', icon: 'lock-closed-outline', placeholder: 'Min. 6 characters', secure: true, kb: 'default' },
  ];

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <LinearGradient colors={['#0f172a', '#1e1040', '#0f172a']} style={StyleSheet.absoluteFill} />
      <View style={s.orb1} />
      <View style={s.orb2} />

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.logoWrap}>
          <LinearGradient colors={['#7c3aed', '#3b82f6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.logoIcon}>
            <Ionicons name="book" size={28} color="#fff" />
          </LinearGradient>
          <Text style={s.logo}>KinsCribe</Text>
          <Text style={s.tagline}>Create your account</Text>
        </View>

        <BlurView intensity={25} tint="dark" style={s.card}>
          <View style={s.cardInner}>
            {error ? (
              <View style={s.errorBox}>
                <Ionicons name="alert-circle" size={16} color="#f87171" />
                <Text style={s.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Username field with @ */}
            <Text style={s.inputLabel}>Username</Text>
            <View style={s.inputWrap}>
              <Text style={s.atSign}>@</Text>
              <TextInput style={[s.input, { flex: 1 }]} placeholder="yourname" placeholderTextColor={colors.dim}
                autoCapitalize="none" value={form.username}
                onChangeText={v => set('username')(v.toLowerCase().replace(/\s/g, ''))} />
            </View>

            {fields.map(({ key, label, icon, placeholder, secure, kb }) => (
              <View key={key}>
                <Text style={s.inputLabel}>{label}</Text>
                <View style={s.inputWrap}>
                  <Ionicons name={icon} size={18} color={colors.muted} style={s.inputIcon} />
                  <TextInput
                    style={[s.input, { flex: 1 }]}
                    placeholder={placeholder}
                    placeholderTextColor={colors.dim}
                    secureTextEntry={secure && !showPass}
                    keyboardType={kb}
                    autoCapitalize={kb === 'email-address' ? 'none' : key === 'name' ? 'words' : 'none'}
                    value={form[key]}
                    onChangeText={set(key)}
                  />
                  {secure && (
                    <TouchableOpacity onPress={() => setShowPass(!showPass)} style={{ padding: 4 }}>
                      <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.muted} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}

            <GradientButton label="Create Account" onPress={handleRegister} loading={loading} style={{ marginTop: 8 }} />

            <View style={s.dividerRow}>
              <View style={s.dividerLine} />
              <Text style={s.dividerText}>OR</Text>
              <View style={s.dividerLine} />
            </View>

            <TouchableOpacity style={s.googleBtn} activeOpacity={0.8} onPress={() => alert('Google Sign-In coming soon')}>
              <Text style={s.googleG}>G</Text>
              <Text style={s.googleText}>Continue with Google</Text>
            </TouchableOpacity>
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
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, padding: 24, paddingTop: 60, paddingBottom: 40 },
  orb1: { position: 'absolute', width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(124,58,237,0.15)', top: -80, right: -80 },
  orb2: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(59,130,246,0.1)', bottom: 100, left: -60 },
  logoWrap: { alignItems: 'center', marginBottom: 32 },
  logoIcon: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 12, ...shadows.lg },
  logo: { fontSize: 32, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  tagline: { fontSize: 13, color: colors.muted, marginTop: 4 },
  card: { borderRadius: radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: colors.border2, ...shadows.lg },
  cardInner: { backgroundColor: 'rgba(15,23,42,0.6)', padding: 24 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(248,113,113,0.1)', borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)', borderRadius: radius.sm, padding: 12, marginBottom: 16 },
  errorText: { color: '#f87171', fontSize: 13, flex: 1 },
  inputLabel: { fontSize: 13, color: colors.muted, marginBottom: 8, fontWeight: '500' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(30,41,59,0.8)', borderWidth: 1, borderColor: colors.border2, borderRadius: radius.md, paddingHorizontal: 14, marginBottom: 16 },
  inputIcon: { marginRight: 10 },
  atSign: { color: colors.muted, fontSize: 16, marginRight: 4, fontWeight: '600' },
  input: { paddingVertical: 14, color: colors.text, fontSize: 14 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 20, gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.dim, fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: 'rgba(30,41,59,0.8)', borderWidth: 1, borderColor: colors.border2, borderRadius: radius.md, padding: 14 },
  googleG: { fontSize: 18, fontWeight: '800', color: '#4285F4' },
  googleText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  footerText: { color: colors.muted, fontSize: 14 },
  footerLink: { color: '#7c3aed', fontSize: 14, fontWeight: '700' },
});
