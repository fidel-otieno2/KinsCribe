import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  Dimensions, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';
import GradientButton from '../components/GradientButton';

const { width, height } = Dimensions.get('window');
const HERO_HEIGHT = height * 0.52;

export default function WelcomeScreen({ navigation }) {
  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ── HERO SECTION ── */}
      <View style={s.hero}>
        {/* Full-bleed logo image */}
        <Image
          source={require('../../assets/kinscribe-logo.png')}
          style={s.heroImg}
          resizeMode="cover"
        />

        {/* Dark overlay so text is readable */}
        <LinearGradient
          colors={['rgba(15,23,42,0.15)', 'rgba(15,23,42,0.5)', '#0f172a']}
          style={StyleSheet.absoluteFill}
        />

        {/* Subtle purple glow top-left */}
        <View style={s.glowPurple} />
        <View style={s.glowBlue} />

        {/* App name overlaid on hero */}
        <View style={s.heroTextWrap}>
          <View style={s.badgeRow}>
            <BlurView intensity={30} tint="dark" style={s.badge}>
              <Ionicons name="sparkles" size={12} color="#a78bfa" />
              <Text style={s.badgeText}>AI-Powered Family Stories</Text>
            </BlurView>
          </View>

          <Text style={s.appName}>KinsCribe</Text>

          <Text style={s.tagline}>
            Preserve your family's voice{'\n'}across generations
          </Text>
        </View>
      </View>

      {/* ── BOTTOM SECTION ── */}
      <View style={s.bottom}>
        {/* Feature row */}
        <View style={s.featureRow}>
          {[
            { icon: 'mic', label: 'Voice', color: '#10b981' },
            { icon: 'sparkles', label: 'AI', color: '#7c3aed' },
            { icon: 'lock-closed', label: 'Private', color: '#3b82f6' },
            { icon: 'book', label: 'Stories', color: '#f59e0b' },
            { icon: 'people', label: 'Family', color: '#ec4899' },
          ].map(({ icon, label, color }) => (
            <View key={label} style={s.featureItem}>
              <View style={[s.featureIcon, { backgroundColor: `${color}22` }]}>
                <Ionicons name={icon} size={18} color={color} />
              </View>
              <Text style={s.featureLabel}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Divider */}
        <View style={s.divider} />

        {/* Buttons */}
        <View style={s.buttons}>
          <GradientButton
            label="Get Started — It's Free"
            onPress={() => navigation.navigate('Register')}
            style={{ marginBottom: 12 }}
          />

          <TouchableOpacity
            style={s.signInBtn}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.8}
          >
            <Text style={s.signInBtnText}>Already have an account? </Text>
            <Text style={s.signInBtnHighlight}>Sign In</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.inviteBtn}
            onPress={() => navigation.navigate('JoinFamily')}
            activeOpacity={0.8}
          >
            <View style={s.inviteBtnInner}>
              <Ionicons name="key-outline" size={16} color="#7c3aed" />
              <Text style={s.inviteBtnText}>Join with Invite Code</Text>
            </View>
          </TouchableOpacity>
        </View>

        <Text style={s.footer}>Your stories. Your family. Forever. 🌿</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },

  // hero
  hero: { width, height: HERO_HEIGHT, position: 'relative', overflow: 'hidden' },
  heroImg: { width: '100%', height: '100%' },
  glowPurple: {
    position: 'absolute', width: 300, height: 300, borderRadius: 150,
    backgroundColor: 'rgba(124,58,237,0.25)', top: -80, left: -60,
  },
  glowBlue: {
    position: 'absolute', width: 220, height: 220, borderRadius: 110,
    backgroundColor: 'rgba(59,130,246,0.18)', top: 40, right: -40,
  },
  heroTextWrap: {
    position: 'absolute', bottom: 28, left: 0, right: 0,
    paddingHorizontal: 28,
  },
  badgeRow: { marginBottom: 12 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', borderRadius: radius.full,
    overflow: 'hidden', borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.4)',
    paddingHorizontal: 12, paddingVertical: 5,
  },
  badgeText: { color: '#a78bfa', fontSize: 11, fontWeight: '600' },
  appName: {
    fontSize: 52, fontWeight: '900', color: '#fff',
    letterSpacing: -2, lineHeight: 54,
    textShadowColor: 'rgba(124,58,237,0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  tagline: {
    fontSize: 15, color: 'rgba(255,255,255,0.7)',
    marginTop: 8, lineHeight: 22, fontWeight: '400',
  },

  // bottom
  bottom: {
    flex: 1, paddingHorizontal: 24, paddingTop: 20,
    paddingBottom: 24, justifyContent: 'space-between',
  },
  featureRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  featureItem: { alignItems: 'center', gap: 6 },
  featureIcon: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  featureLabel: { fontSize: 11, color: colors.muted, fontWeight: '600' },
  divider: { height: 0.5, backgroundColor: colors.border, marginVertical: 4 },

  // buttons
  buttons: { gap: 0 },
  signInBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, marginBottom: 4,
  },
  signInBtnText: { color: colors.muted, fontSize: 14 },
  signInBtnHighlight: { color: '#7c3aed', fontWeight: '700', fontSize: 14 },
  inviteBtn: {
    alignItems: 'center', paddingVertical: 10,
  },
  inviteBtnInner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: 'rgba(124,58,237,0.35)',
    borderRadius: radius.full, paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: 'rgba(124,58,237,0.08)',
  },
  inviteBtnText: { color: '#7c3aed', fontWeight: '600', fontSize: 13 },
  footer: {
    textAlign: 'center', color: colors.dim,
    fontSize: 12, marginTop: 8,
  },
});
