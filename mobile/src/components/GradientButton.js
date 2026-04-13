import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { gradients, shadows, radius } from '../theme';

export default function GradientButton({ onPress, label, loading, style, textStyle, disabled }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={loading || disabled} activeOpacity={0.85} style={[s.wrapper, shadows.lg, style]}>
      <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.gradient}>
        {loading
          ? <ActivityIndicator color="#F5F0E8" />
          : <Text style={[s.label, textStyle]}>{label}</Text>}
      </LinearGradient>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  wrapper: { borderRadius: radius.md, overflow: 'hidden' },
  gradient: { paddingVertical: 15, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' },
  label: { color: '#F5F0E8', fontWeight: '700', fontSize: 15, letterSpacing: 0.3 },
});
