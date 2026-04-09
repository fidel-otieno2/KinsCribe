import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, ImageBackground
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { colors, radius, shadows } from '../theme';
import GradientButton from '../components/GradientButton';

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Background gradient */}
      <LinearGradient colors={['#0f172a', '#1e1040', '#0f172a']} style={StyleSheet.absoluteFill} />

      {/* Glow orbs */}
      <View style={s.orb1} />
      <View style={s.orb2} />

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View style={s.logoWrap}>
          <LinearGradient colors={['#7c3aed', '#3b82f6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.logoIcon}>
            <Ionicons name="book" size={28} color="#fff" />
          </LinearGradient>
          <Text style={s.logo}>KinsCribe</Text>
          <Text style={s.tagline}>Your family's voice, preserved forever</Text>
        </View>

        {/* Glass card */}
        <BlurView intensity={25} tint="dark" style={s.card}>
          <View style={s.cardInner}>
            {error ? (
              <View style={s.errorBox}>
                <Ionicons name="alert-circle" size={16} color="#f87171" />
                <Text style={s.errorText}>{error}</Text>
              </View>
            ) : null}

            <Text style={s.inputLabel}>Email</Text>
            <View style={s.inputWrap}>
              <Ionicons name="mail-outline" size={18} color={colors.muted} style={s.inputIcon} />
              <TextInput style={s.input} placeholder="you@example.com" placeholderTextColor={colors.dim}
                keyboardType="email-address" autoCapitalize="none"
                value={form.email} onChangeText={v => setForm({ ...form, email: v })} />
            </View>

            <Text style={s.inputLabel}>Password</Text>
            <View style={s.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.muted} style={s.inputIcon} />
              <TextInput style={[s.input, { flex: 1 }]} placeholder="••••••••" placeholderTextColor={colors.dim}
                secureTextEntry={!showPass}
                value={form.password} onChangeText={v => setForm({ ...form, password: v })} />
              <TouchableOpacity onPress={() => setShowPass(!showPass)} style={{ padding: 4 }}>
                <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.muted} />
              </TouchableOpacity>
            </View>

            <GradientButton label="Sign In" onPress={handleLogin} loading={loading} style={{ marginTop: 8 }} />

            <View style={s.dividerRow}>
              <View style={s.dividerLine} />
              <Text style={s.dividerText}>OR</Text>
              <View style={s.dividerLine} />
            </View>

            <TouchableOpacity style={s.googleBtn} onPress={() => alert('Google Sign-In coming soon')} activeOpacity={0.8}>
              <Text style={s.googleG}>G</Text>
              <Text style={s.googleText}>Continue with Google</Text>
            </TouchableOpacity>
          </View>
        </BlurView>

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.footerText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={s.footerLink}>Sign up</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, padding: 24, justifyContent: 'center', paddingBottom: 40 },
  orb1: { position: 'absolute', width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(124,58,237,0.15)', top: -80, left: -80 },
  orb2: { position: 'absolute', width: 250, height: 250, borderRadius: 125, backgroundColor: 'rgba(59,130,246,0.1)', bottom: 50, right: -60 },
  logoWrap: { alignItems: 'center', marginBottom: 36 },
  logoIcon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 14, ...shadows.lg },
  logo: { fontSize: 36, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  tagline: { fontSize: 13, color: colors.muted, marginTop: 6, textAlign: 'center' },
  card: { borderRadius: radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: colors.border2, ...shadows.lg },
  cardInner: { backgroundColor: 'rgba(15,23,42,0.6)', padding: 24 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(248,113,113,0.1)', borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)', borderRadius: radius.sm, padding: 12, marginBottom: 16 },
  errorText: { color: '#f87171', fontSize: 13, flex: 1 },
  inputLabel: { fontSize: 13, color: colors.muted, marginBottom: 8, fontWeight: '500' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(30,41,59,0.8)', borderWidth: 1, borderColor: colors.border2, borderRadius: radius.md, paddingHorizontal: 14, marginBottom: 16 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 14, color: colors.text, fontSize: 14 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 20, gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.dim, fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: 'rgba(30,41,59,0.8)', borderWidth: 1, borderColor: colors.border2, borderRadius: radius.md, padding: 14 },
  googleG: { fontSize: 18, fontWeight: '800', color: '#4285F4' },
  googleText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 28 },
  footerText: { color: colors.muted, fontSize: 14 },
  footerLink: { color: '#7c3aed', fontSize: 14, fontWeight: '700' },
});
