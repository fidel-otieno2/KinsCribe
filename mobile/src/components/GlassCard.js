import { View, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, shadows, radius } from '../theme';

export default function GlassCard({ children, style, intensity = 20 }) {
  return (
    <View style={[s.wrapper, shadows.md, style]}>
      <BlurView intensity={intensity} tint="dark" style={s.blur}>
        <View style={s.inner}>
          {children}
        </View>
      </BlurView>
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border2,
  },
  blur: {
    flex: 1,
  },
  inner: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    flex: 1,
  },
});
