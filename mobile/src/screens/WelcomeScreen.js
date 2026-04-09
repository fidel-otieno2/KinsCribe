import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadows } from '../theme';
import GradientButton from '../components/GradientButton';

export default function WelcomeScreen({ navigation }) {
  return (
    <View style={s.container}>
      <LinearGradient colors={['#0f172a', '#1e1040', '#0a0f1e']} style={StyleSheet.absoluteFill} />
      <View style={s.orb1} /><View style={s.orb2} /><View style={s.orb3} />

      <View style={s.content}>
        {/* Logo */}
        <View style={s.logoWrap}>
          <LinearGradient colors={['#7c3aed', '#3b82f6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.logoIcon}>
            <Ionicons name="book" size={40} color="#fff" />
          </LinearGradient>
          <Text style={s.appName}>KinsCribe</Text>
          <Text style={s.tagline}>Preserve your family's voice{'\n'}across generations</Text>
        </View>

        {/* Feature pills */}
        <View style={s.pills}>
          {['🎙️ Voice Stories', '🤖 AI Enhanced', '🔒 Private & Secure', '📖 Storybooks'].map((f, i) => (
            <BlurView key={i} intensity={15} tint="dark" style={s.pill}>
              <Text style={s.pillText}>{f}</Text>
            </BlurView>
          ))}
        </View>

        {/* Buttons */}
        <View style={s.buttons}>
          <GradientButton label="Get Started" onPress={() => navigation.navigate('Register')} style={{ marginBottom: 12 }} />

          <TouchableOpacity style={s.outlineBtn} onPress={() => navigation.navigate('Login')} activeOpacity={0.8}>
            <Text style={s.outlineBtnText}>Sign In</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.inviteBtn} onPress={() => navigation.navigate('JoinFamily')} activeOpacity={0.8}>
            <Ionicons name="key-outline" size={16} color="#7c3aed" />
            <Text style={s.inviteBtnText}>Enter Invite Code</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.footer}>Your stories. Your family. Forever.</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  orb1: { position: 'absolute', width: 350, height: 350, borderRadius: 175, backgroundColor: 'rgba(124,58,237,0.18)', top: -100, left: -100 },
  orb2: { position: 'absolute', width: 280, height: 280, borderRadius: 140, backgroundColor: 'rgba(59,130,246,0.12)', bottom: 0, right: -80 },
  orb3: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(124,58,237,0.08)', bottom: 200, left: 50 },
  content: { flex: 1, padding: 28, justifyContent: 'center' },
  logoWrap: { alignItems: 'center', marginBottom: 40 },
  logoIcon: { width: 90, height: 90, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 20, ...shadows.lg },
  appName: { fontSize: 42, fontWeight: '800', color: colors.text, letterSpacing: -1 },
  tagline: { fontSize: 15, color: colors.muted, textAlign: 'center', marginTop: 10, lineHeight: 22 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 40 },
  pill: { borderRadius: radius.full, overflow: 'hidden', borderWidth: 1, borderColor: colors.border2 },
  pillText: { fontSize: 12, color: colors.muted, paddingHorizontal: 12, paddingVertical: 6, fontWeight: '500' },
  buttons: { gap: 0 },
  outlineBtn: { borderWidth: 1, borderColor: colors.border2, borderRadius: radius.md, padding: 15, alignItems: 'center', marginBottom: 12, backgroundColor: 'rgba(30,41,59,0.5)' },
  outlineBtnText: { color: colors.text, fontWeight: '700', fontSize: 15 },
  inviteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14 },
  inviteBtnText: { color: '#7c3aed', fontWeight: '600', fontSize: 14 },
  footer: { textAlign: 'center', color: colors.dim, fontSize: 12, marginTop: 32 },
});
