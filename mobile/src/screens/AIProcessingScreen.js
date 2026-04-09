import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import api from '../api/axios';
import { colors, radius, shadows } from '../theme';

export default function AIProcessingScreen({ route, navigation }) {
  const { storyId } = route.params || {};
  const [story, setStory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(true);

  useEffect(() => {
    if (!storyId) {
      navigation.replace('Feed');
      return;
    }
    let attempts = 0;
    const interval = setInterval(async () => {
      try {
        const { data } = await api.get(`/stories/${storyId}`);
        setStory(data.story);
        if (data.story.ai_processed || attempts >= 20) {
          setPolling(false);
          clearInterval(interval);
        }
        attempts++;
      } catch {
        attempts++;
        if (attempts >= 5) { setPolling(false); clearInterval(interval); }
      } finally { setLoading(false); }
    }, 3000);
    return () => clearInterval(interval);
  }, [storyId]);

  return (
    <View style={s.container}>
      <LinearGradient colors={['#0f172a', '#1e1040', '#0f172a']} style={StyleSheet.absoluteFill} />
      <View style={s.orb1} />

      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>AI Processing</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        {/* Status */}
        <BlurView intensity={20} tint="dark" style={s.statusCard}>
          <LinearGradient colors={['rgba(124,58,237,0.2)', 'rgba(59,130,246,0.1)']} style={StyleSheet.absoluteFill} />
          <View style={s.statusInner}>
            {polling ? (
              <>
                <ActivityIndicator color="#7c3aed" size="large" />
                <Text style={s.statusTitle}>AI is working its magic...</Text>
                <Text style={s.statusSub}>Transcribing, enhancing and tagging your story</Text>
              </>
            ) : (
              <>
                <LinearGradient colors={['#7c3aed', '#3b82f6']} style={s.doneIcon}>
                  <Ionicons name="checkmark" size={28} color="#fff" />
                </LinearGradient>
                <Text style={s.statusTitle}>AI Processing Complete!</Text>
                <Text style={s.statusSub}>Your story has been enhanced</Text>
              </>
            )}
          </View>
        </BlurView>

        {/* Steps */}
        {[
          { icon: 'mic', label: 'Transcription', done: !!story?.transcript, value: story?.transcript },
          { icon: 'sparkles', label: 'Enhancement', done: !!story?.enhanced_text, value: story?.enhanced_text },
          { icon: 'document-text', label: 'Summary', done: !!story?.summary, value: story?.summary },
          { icon: 'pricetags', label: 'Auto Tags', done: story?.tags?.length > 0, value: story?.tags?.join(', ') },
        ].map(({ icon, label, done, value }) => (
          <BlurView key={label} intensity={15} tint="dark" style={s.stepCard}>
            <View style={s.stepCardInner}>
              <View style={s.stepHeader}>
                <View style={[s.stepIcon, done ? s.stepIconDone : s.stepIconPending]}>
                  <Ionicons name={icon} size={18} color={done ? '#fff' : colors.muted} />
                </View>
                <Text style={s.stepLabel}>{label}</Text>
                {polling && !done
                  ? <ActivityIndicator size="small" color="#7c3aed" style={{ marginLeft: 'auto' }} />
                  : done
                    ? <Ionicons name="checkmark-circle" size={20} color="#10b981" style={{ marginLeft: 'auto' }} />
                    : <Ionicons name="ellipse-outline" size={20} color={colors.dim} style={{ marginLeft: 'auto' }} />}
              </View>
              {done && value ? (
                <Text style={s.stepValue} numberOfLines={3}>{value}</Text>
              ) : null}
            </View>
          </BlurView>
        ))}

        {/* Tags display */}
        {story?.tags?.length > 0 && (
          <View style={s.tagsWrap}>
            {story.tags.map((tag, i) => (
              <View key={i} style={s.tag}>
                <Text style={s.tagText}>#{tag}</Text>
              </View>
            ))}
          </View>
        )}

        {!polling && (
          <TouchableOpacity style={s.doneBtn} onPress={() => navigation.navigate('Feed')} activeOpacity={0.85}>
            <LinearGradient colors={['#7c3aed', '#3b82f6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.doneBtnGrad}>
              <Text style={s.doneBtnText}>View in Feed</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  orb1: { position: 'absolute', width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(124,58,237,0.12)', top: 0, right: -80 },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12, gap: 12 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  scroll: { padding: 16, gap: 12, paddingBottom: 40 },
  statusCard: { borderRadius: radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)', marginBottom: 4, ...shadows.lg },
  statusInner: { padding: 28, alignItems: 'center', gap: 10 },
  doneIcon: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  statusTitle: { fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center' },
  statusSub: { fontSize: 13, color: colors.muted, textAlign: 'center' },
  stepCard: { borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border2 },
  stepCardInner: { backgroundColor: 'rgba(15,23,42,0.6)', padding: 16 },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  stepIconDone: { backgroundColor: 'rgba(124,58,237,0.3)' },
  stepIconPending: { backgroundColor: 'rgba(71,85,105,0.3)' },
  stepLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
  stepValue: { fontSize: 13, color: colors.muted, marginTop: 10, lineHeight: 18 },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 4 },
  tag: { backgroundColor: 'rgba(124,58,237,0.15)', borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.full },
  tagText: { color: '#a78bfa', fontSize: 12, fontWeight: '600' },
  doneBtn: { borderRadius: radius.md, overflow: 'hidden', marginTop: 8, ...shadows.lg },
  doneBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 },
  doneBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
