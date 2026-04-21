import {
  View, StyleSheet, TouchableOpacity, Image,
  Dimensions, StatusBar,
} from 'react-native';
import AppText from '../components/AppText';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { colors, gradients, radius, shadows } from '../theme';
import { useTranslation } from '../i18n';
import GradientButton from '../components/GradientButton';

const { width, height } = Dimensions.get('window');
const HERO_HEIGHT = height * 0.55;

export default function WelcomeScreen({ navigation }) {
  const { t } = useTranslation();
  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Hero image */}
      <View style={s.hero}>
        <Image
          source={require('../../assets/kinscribe-logo.png')}
          style={s.heroImg}
          resizeMode="cover"
        />
        <LinearGradient
          colors={['rgba(28,26,20,0.05)', 'rgba(28,26,20,0.4)', '#1C1A14']}
          style={StyleSheet.absoluteFill}
        />
        {/* Green glow */}
        <View style={s.glowGreen} />
        <View style={s.glowGold} />

        {/* Badge */}
        <View style={s.heroTextWrap}>
          <BlurView intensity={30} tint="dark" style={s.badge}>
            <Ionicons name="leaf" size={12} color={colors.primaryLight} />
            <AppText style={s.badgeText}>{t('ai_powered')}</AppText>
          </BlurView>

          <AppText style={s.appName}>KinsCribe</AppText>
          <AppText style={s.tagline}>
            Preserve your family's roots{'\\n'}across generations
          </AppText>
        </View>
      </View>

      {/* Bottom section */}
      <View style={s.bottom}>
        {/* Feature row */}
        <View style={s.featureRow}>
          {[
            { icon: 'mic', label: 'Voice', color: colors.primaryLight },
            { icon: 'sparkles', label: 'AI', color: colors.gold },
            { icon: 'lock-closed', label: 'Private', color: colors.primaryMid },
            { icon: 'book', label: 'Stories', color: colors.gold },
            { icon: 'people', label: 'Family', color: colors.brown },
          ].map(({ icon, label, color }) => (
            <View key={label} style={s.featureItem}>
              <View style={[s.featureIcon, { backgroundColor: `${color}22` }]}>
                <Ionicons name={icon} size={18} color={color} />
              </View>
              <AppText style={s.featureLabel}>{label}</AppText>
            </View>
          ))}
        </View>

        <View style={s.divider} />

        {/* Buttons */}
        <View style={s.buttons}>
          <GradientButton
            label={t('sign_up_free')}
            onPress={() => navigation.navigate('Register')}
            style={{ marginBottom: 12 }}
          />

          <TouchableOpacity
            style={s.signInBtn}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.8}
          >
            <AppText style={s.signInBtnText}>{t('already_have_account')} </AppText>
            <AppText style={s.signInBtnHighlight}>{t('sign_in')}</AppText>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.inviteBtn}
            onPress={() => navigation.navigate('JoinFamily')}
            activeOpacity={0.8}
          >
            <View style={s.inviteBtnInner}>
              <Ionicons name="key-outline" size={16} color={colors.gold} />
              <AppText style={s.inviteBtnText}>{t('join_with_code')}</AppText>
            </View>
          </TouchableOpacity>
        </View>

        <AppText style={s.footer}>{t('app_tagline')}</AppText>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  hero: { width, height: HERO_HEIGHT, position: 'relative', overflow: 'hidden' },
  heroImg: { width: '100%', height: '100%' },
  glowGreen: {
    position: 'absolute', width: 300, height: 300, borderRadius: 150,
    backgroundColor: 'rgba(45,90,39,0.3)', top: -80, left: -60,
  },
  glowGold: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(196,163,90,0.15)', top: 40, right: -40,
  },
  heroTextWrap: {
    position: 'absolute', bottom: 28, left: 0, right: 0, paddingHorizontal: 28,
  },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', borderRadius: radius.full,
    overflow: 'hidden', borderWidth: 1,
    borderColor: 'rgba(196,163,90,0.4)',
    paddingHorizontal: 12, paddingVertical: 5, marginBottom: 12,
  },
  badgeText: { color: colors.gold, fontSize: 11, fontWeight: '600' },
  appName: {
    fontSize: 52, fontWeight: '700', color: colors.text,
    letterSpacing: -2, lineHeight: 54,
    textShadowColor: 'rgba(45,90,39,0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  tagline: {
    fontSize: 15, color: 'rgba(245,240,232,0.7)',
    marginTop: 8, lineHeight: 22, fontWeight: '400',
  },

  bottom: {
    flex: 1, paddingHorizontal: 24, paddingTop: 20,
    paddingBottom: 24, justifyContent: 'space-between',
  },
  featureRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  featureItem: { alignItems: 'center', gap: 6 },
  featureIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  featureLabel: { fontSize: 11, color: colors.muted, fontWeight: '600' },
  divider: { height: 0.5, backgroundColor: colors.border, marginVertical: 4 },

  buttons: { gap: 0 },
  signInBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, marginBottom: 4,
  },
  signInBtnText: { color: colors.muted, fontSize: 14 },
  signInBtnHighlight: { color: colors.primaryLight, fontWeight: '700', fontSize: 14 },
  inviteBtn: { alignItems: 'center', paddingVertical: 10 },
  inviteBtnInner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: 'rgba(196,163,90,0.35)',
    borderRadius: radius.full, paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: 'rgba(196,163,90,0.08)',
  },
  inviteBtnText: { color: colors.gold, fontWeight: '600', fontSize: 13 },
  footer: { textAlign: 'center', color: colors.dim, fontSize: 12, marginTop: 8 },
});
