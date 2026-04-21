import { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, TouchableOpacity } from 'react-native';
import AppText from './AppText';
import { Ionicons } from '@expo/vector-icons';

const CONFIGS = {
  success: { bg: '#166534', border: '#22c55e', icon: 'checkmark-circle', iconColor: '#4ade80' },
  error:   { bg: '#7f1d1d', border: '#ef4444', icon: 'close-circle',     iconColor: '#f87171' },
  info:    { bg: '#1e3a5f', border: '#3b82f6', icon: 'information-circle', iconColor: '#60a5fa' },
};

export default function Toast({ visible, type = 'success', message, onHide }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 80 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
      const t = setTimeout(() => hide(), 3000);
      return () => clearTimeout(t);
    }
  }, [visible]);

  const hide = () => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: -20, duration: 200, useNativeDriver: true }),
    ]).start(() => onHide?.());
  };

  if (!visible) return null;
  const cfg = CONFIGS[type] || CONFIGS.info;

  return (
    <Animated.View style={[s.wrap, { opacity, transform: [{ translateY }], backgroundColor: cfg.bg, borderColor: cfg.border }]}>
      <Ionicons name={cfg.icon} size={20} color={cfg.iconColor} />
      <AppText style={s.msg} numberOfLines={3}>{message}</AppText>
      <TouchableOpacity onPress={hide} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="close" size={16} color="rgba(255,255,255,0.6)" />
      </TouchableOpacity>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: {
    position: 'absolute', top: 56, left: 16, right: 16, zIndex: 9999,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 14, borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 10,
  },
  msg: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '600', lineHeight: 19 },
});
