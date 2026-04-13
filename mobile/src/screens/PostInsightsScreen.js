import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import api from '../api/axios';
import { colors, radius } from '../theme';

const { width } = Dimensions.get('window');

function StatCard({ label, value, icon, color, sub }) {
  return (
    <View style={[s.statCard, { borderColor: `${color}33` }]}>
      <LinearGradient colors={[`${color}22`, `${color}11`]} style={StyleSheet.absoluteFill} />
      <View style={[s.statIcon, { backgroundColor: `${color}33` }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={s.statValue}>{typeof value === 'number' ? value.toLocaleString() : value}</Text>
      <Text style={s.statLabel}>{label}</Text>
      {sub && <Text style={s.statSub}>{sub}</Text>}
    </View>
  );
}

function Bar({ label, value, max, color }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <View style={s.barRow}>
      <Text style={s.barLabel}>{label}</Text>
      <View style={s.barTrack}>
        <LinearGradient colors={[color, `${color}88`]} style={[s.barFill, { width: `${pct}%` }]} />
      </View>
      <Text style={s.barValue}>{value}</Text>
    </View>
  );
}

export default function PostInsightsScreen({ navigation }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/extras/insights/profile').then(({ data }) => {
      setProfile(data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <View style={[s.container, { alignItems: 'center', justifyContent: 'center' }]}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );

  const maxVal = profile ? Math.max(profile.total_likes, profile.total_comments, profile.total_saves, 1) : 1;

  return (
    <View style={s.container}>
      <LinearGradient colors={['#0f172a', '#1a0f2e', '#0f172a']} style={StyleSheet.absoluteFill} />

      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Insights</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>

        <Text style={s.sectionTitle}>Profile Overview</Text>
        <View style={s.statsGrid}>
          <StatCard label="Posts" value={profile?.total_posts || 0} icon="grid-outline" color="#7c3aed" />
          <StatCard label="Connections" value={profile?.connections || 0} icon="people-outline" color="#3b82f6" />
          <StatCard label="Interests" value={profile?.interests || 0} icon="heart-outline" color="#ec4899" />
          <StatCard label="Total Likes" value={profile?.total_likes || 0} icon="heart" color="#e11d48" />
          <StatCard label="Comments" value={profile?.total_comments || 0} icon="chatbubble" color="#f59e0b" />
          <StatCard label="Saves" value={profile?.total_saves || 0} icon="bookmark" color="#10b981" />
        </View>

        <Text style={s.sectionTitle}>Engagement Breakdown</Text>
        <View style={s.barCard}>
          <LinearGradient colors={['rgba(124,58,237,0.1)', 'rgba(15,23,42,0.8)']} style={StyleSheet.absoluteFill} />
          <Bar label="Likes" value={profile?.total_likes || 0} max={maxVal} color="#e11d48" />
          <Bar label="Comments" value={profile?.total_comments || 0} max={maxVal} color="#f59e0b" />
          <Bar label="Saves" value={profile?.total_saves || 0} max={maxVal} color="#10b981" />
        </View>

        <Text style={s.sectionTitle}>Growth Tips</Text>
        {[
          { icon: '📸', tip: 'Post consistently — aim for 3-5 posts per week', color: '#7c3aed' },
          { icon: '🕐', tip: 'Post when your connections are most active (evenings)', color: '#3b82f6' },
          { icon: '#️⃣', tip: 'Use relevant hashtags to reach more people', color: '#10b981' },
          { icon: '💬', tip: 'Reply to comments to boost engagement', color: '#f59e0b' },
          { icon: '📖', tip: 'Share family stories to connect with your family space', color: '#ec4899' },
        ].map((item, i) => (
          <View key={i} style={s.tipRow}>
            <View style={[s.tipIcon, { backgroundColor: `${item.color}22` }]}>
              <Text style={{ fontSize: 18 }}>{item.icon}</Text>
            </View>
            <Text style={s.tipText}>{item.tip}</Text>
          </View>
        ))}

        <Text style={s.sectionTitle}>Best Time to Post</Text>
        <View style={s.timeCard}>
          <LinearGradient colors={['rgba(124,58,237,0.15)', 'rgba(59,130,246,0.1)']} style={StyleSheet.absoluteFill} />
          {[
            { time: '7am - 9am', label: 'Morning', score: 60 },
            { time: '12pm - 2pm', label: 'Lunch', score: 75 },
            { time: '6pm - 9pm', label: 'Evening', score: 95 },
            { time: '9pm - 11pm', label: 'Night', score: 80 },
          ].map(t => (
            <View key={t.time} style={s.timeRow}>
              <Text style={s.timeLabel}>{t.time}</Text>
              <Text style={s.timePeriod}>{t.label}</Text>
              <View style={s.timeBarTrack}>
                <LinearGradient colors={['#7c3aed', '#3b82f6']} style={[s.timeBarFill, { width: `${t.score}%` }]} />
              </View>
              <Text style={s.timeScore}>{t.score}%</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 52, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 22, fontWeight: '800', color: colors.text, marginLeft: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12, marginTop: 20 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { width: (width - 42) / 3, borderRadius: radius.lg, padding: 14, overflow: 'hidden', borderWidth: 1, gap: 6 },
  statIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 11, color: colors.muted, fontWeight: '600' },
  statSub: { fontSize: 10, color: colors.dim },
  barCard: { borderRadius: radius.lg, overflow: 'hidden', padding: 16, borderWidth: 1, borderColor: colors.border, gap: 14 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barLabel: { width: 70, fontSize: 13, color: colors.muted },
  barTrack: { flex: 1, height: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  barValue: { width: 40, fontSize: 13, color: colors.text, fontWeight: '600', textAlign: 'right' },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  tipIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tipText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 18 },
  timeCard: { borderRadius: radius.lg, overflow: 'hidden', padding: 16, borderWidth: 1, borderColor: colors.border, gap: 12 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timeLabel: { width: 80, fontSize: 12, color: colors.muted },
  timePeriod: { width: 55, fontSize: 12, color: colors.text, fontWeight: '600' },
  timeBarTrack: { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' },
  timeBarFill: { height: '100%', borderRadius: 3 },
  timeScore: { width: 36, fontSize: 12, color: colors.primary, fontWeight: '700', textAlign: 'right' },
});
