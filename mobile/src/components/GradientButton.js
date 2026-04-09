import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { gradientColors, shadows, radius } from '../theme';

export default function GradientButton({ onPress, label, loading, style, textStyle, disabled }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={loading || disabled} activeOpacity={0.85} style={[s.wrapper, shadows.lg, style]}>
      <LinearGradient colors={gradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.gradient}>
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={[s.label, textStyle]}>{label}</Text>}
      </LinearGradient>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  wrapper: { borderRadius: radius.md, overflow: 'hidden' },
  gradient: { paddingVertical: 15, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' },
  label: { color: '#fff', fontWeight: '700', fontSize: 15, letterSpacing: 0.3 },
});
