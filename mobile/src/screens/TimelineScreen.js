import { useEffect, useState } from 'react';
import {
  View, FlatList, StyleSheet,
  ActivityIndicator, Image, TouchableOpacity
} from 'react-native';
import AppText from '../components/AppText';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import api from '../api/axios';
import { useTranslation } from '../i18n';
import { colors, radius, shadows } from '../theme';

function TimelineStoryCard({ story }) {
  const date = story.story_date
    ? new Date(story.story_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : new Date(story.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <BlurView intensity={18} tint="dark" style={s.card}>
      <LinearGradient
        colors={['rgba(124,58,237,0.08)', 'rgba(15,23,42,0.6)']}
        style={StyleSheet.absoluteFill}
      />
      <View style={s.cardInner}>
        {/* Author row */}
        <View style={s.authorRow}>
          <View style={s.avatar}>
            {story.author_avatar
              ? <Image source={{ uri: story.author_avatar }} style={s.avatarImg} />
              : <AppText style={s.avatarText}>{story.author_name?.[0] || 'U'}</AppText>}
          </View>
          <View style={{ flex: 1 }}>
            <AppText style={s.authorName}>{story.author_name || 'Unknown'}</AppText>
            <AppText style={s.dateText}>{date}</AppText>
          </View>
          <View style={[s.privacyBadge, story.privacy === 'family' ? s.badgeFamily : story.privacy === 'public' ? s.badgePublic : s.badgePrivate]}>
            <AppText style={[s.privacyText, { color: story.privacy === 'family' ? colors.green : story.privacy === 'public' ? '#60a5fa' : colors.muted }]}>
              {story.privacy}
            </AppText>
          </View>
        </View>

        {/* Media thumbnail */}
        {story.media_url && story.media_type === 'image' && (
          <Image source={{ uri: story.media_url }} style={s.thumbnail} resizeMode="cover" />
        )}
        {story.media_url && story.media_type === 'video' && (
          <View style={s.videoThumb}>
            <LinearGradient colors={['rgba(124,58,237,0.3)', 'rgba(59,130,246,0.2)']} style={StyleSheet.absoluteFill} />
            <Ionicons name="play-circle" size={40} color="#fff" />
            <AppText style={s.videoLabel}>Video Story</AppText>
          </View>
        )}
        {story.media_url && story.media_type === 'audio' && (
          <View style={s.audioThumb}>
            <Ionicons name="musical-notes" size={24} color="#7c3aed" />
            <AppText style={s.audioLabel}>Audio Story</AppText>
          </View>
        )}

        {/* Title & content */}
        <AppText style={s.storyTitle}>{story.title}</AppText>
        {(story.summary || story.content) ? (
          <AppText style={s.storyContent} numberOfLines={2}>
            {story.summary || story.content}
          </AppText>
        ) : null}

        {/* Tags */}
        {story.tags?.length > 0 && (
          <View style={s.tagsRow}>
            {story.tags.slice(0, 4).map((tag, i) => (
              <View key={i} style={s.tag}>
                <AppText style={s.tagText}>#{tag}</AppText>
              </View>
            ))}
          </View>
        )}

        {/* Footer counts */}
        <View style={s.cardFooter}>
          <View style={s.countRow}>
            <Ionicons name="heart" size={14} color="#e0245e" />
            <AppText style={s.countText}>{story.like_count || 0}</AppText>
          </View>
          <View style={s.countRow}>
            <Ionicons name="chatbubble" size={14} color="#3b82f6" />
            <AppText style={s.countText}>{story.comment_count || 0}</AppText>
          </View>
          {story.ai_processed && (
            <View style={s.aiBadge}>
              <Ionicons name="sparkles" size={11} color="#7c3aed" />
              <AppText style={s.aiText}> AI Enhanced</AppText>
            </View>
          )}
        </View>
      </View>
    </BlurView>
  );
}

export default function TimelineScreen() {
  const { t } = useTranslation();
  const [grouped, setGrouped] = useState([]);
  const [stats, setStats] = useState({ total: 0, earliest: null, latest: null });
  const [loading, setLoading] = useState(true);
  const [onThisDay, setOnThisDay] = useState([]);

  useEffect(() => {
    api.get('/stories/feed').then(({ data }) => {
      const all = data.stories;
      const map = {};

      all.forEach(s => {
        const year = s.story_date
          ? new Date(s.story_date).getFullYear()
          : 'Recent';
        if (!map[year]) map[year] = [];
        map[year].push(s);
      });

      // Sort years descending, keep 'Recent' at top
      const sorted = Object.entries(map).sort((a, b) => {
        if (a[0] === 'Recent') return -1;
        if (b[0] === 'Recent') return 1;
        return Number(b[0]) - Number(a[0]);
      });

      const years = sorted.map(([y]) => y).filter(y => y !== 'Recent').map(Number);
      setStats({
        total: all.length,
        earliest: years.length ? Math.min(...years) : null,
        latest: years.length ? Math.max(...years) : null,
      });
      setGrouped(sorted);

      // On This Day — stories with story_date matching today's month/day in past years
      const today = new Date();
      const todayMD = `${String(today.getMonth() + 1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
      const memories = all.filter(s => {
        if (!s.story_date) return false;
        const d = new Date(s.story_date);
        const md = `${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        return md === todayMD && d.getFullYear() < today.getFullYear();
      });
      setOnThisDay(memories);
    }).finally(() => setLoading(false));
  }, []);

  const renderYear = ({ item: [year, stories] }) => (
    <View style={s.yearSection}>
      {/* Year marker */}
      <View style={s.yearMarker}>
        <View style={s.timelineLine} />
        <LinearGradient colors={['#7c3aed', '#3b82f6']} style={s.yearDot} />
        <BlurView intensity={20} tint="dark" style={s.yearLabelWrap}>
          <LinearGradient colors={['rgba(124,58,237,0.3)', 'rgba(59,130,246,0.2)']} style={StyleSheet.absoluteFill} />
          <AppText style={s.yearLabel}>{year}</AppText>
        </BlurView>
      </View>

      {/* Stories for this year */}
      <View style={s.storiesWrap}>
        {stories.map(story => (
          <TimelineStoryCard key={story.id} story={story} />
        ))}
      </View>
    </View>
  );

  return (
    <View style={s.container}>
      <LinearGradient colors={['#0f172a', '#1a0f2e', '#0f172a']} style={StyleSheet.absoluteFill} />
      <View style={s.orb1} /><View style={s.orb2} />

      {/* Header */}
      <BlurView intensity={20} tint="dark" style={s.header}>
        <LinearGradient colors={['rgba(15,23,42,0.9)', 'rgba(15,23,42,0.7)']} style={StyleSheet.absoluteFill} />
        <View style={s.headerContent}>
          <AppText style={s.headerTitle}>Family Timeline</AppText>
          {!loading && stats.total > 0 && (
            <View style={s.statsBar}>
              <View style={s.statItem}>
                <Ionicons name="library-outline" size={14} color="#7c3aed" />
                <AppText style={s.statText}>{stats.total} stories</AppText>
              </View>
              {stats.earliest && (
                <>
                  <View style={s.statDivider} />
                  <AppText style={s.statText}>{stats.earliest}</AppText>
                  <Ionicons name="arrow-forward-circle-outline" size={14} color={colors.muted} />
                  <AppText style={s.statText}>{stats.latest}</AppText>
                </>
              )}
            </View>
          )}
        </View>
      </BlurView>

      {loading ? (
        <ActivityIndicator color="#7c3aed" style={{ marginTop: 80 }} />
      ) : (
        <>
          {/* On This Day banner */}
          {onThisDay.length > 0 && (
            <View style={s.onThisDayBanner}>
              <LinearGradient colors={['rgba(124,58,237,0.3)', 'rgba(59,130,246,0.2)']} style={StyleSheet.absoluteFill} />
              <View style={s.onThisDayHeader}>
                <Ionicons name="calendar" size={18} color="#a78bfa" />
                <AppText style={s.onThisDayTitle}>On This Day</AppText>
              </View>
              {onThisDay.map(story => (
                <View key={story.id} style={s.onThisDayItem}>
                  <AppText style={s.onThisDayYear}>{new Date(story.story_date).getFullYear()}</AppText>
                  <AppText style={s.onThisDayStory} numberOfLines={1}>{story.title}</AppText>
                </View>
              ))}
            </View>
          )}

          {grouped.length === 0 ? (
        <View style={s.emptyState}>
          <LinearGradient colors={['rgba(124,58,237,0.2)', 'rgba(59,130,246,0.1)']} style={s.emptyIcon}>
            <Ionicons name="time-outline" size={40} color="#7c3aed" />
          </LinearGradient>
          <AppText style={s.emptyTitle}>No stories yet</AppText>
          <AppText style={s.emptySub}>
            Stories appear here when posted.{'\n'}
            Add a date when posting to place them{'\n'}on the timeline by year.
          </AppText>
        </View>
      ) : (
        <FlatList
          data={grouped}
          keyExtractor={([year]) => String(year)}
          renderItem={renderYear}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
        />
      )}
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  orb1: { position: 'absolute', width: 250, height: 250, borderRadius: 125, backgroundColor: 'rgba(124,58,237,0.1)', top: 60, right: -80 },
  orb2: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(59,130,246,0.08)', bottom: 100, left: -60 },

  // Header
  header: { overflow: 'hidden', borderBottomWidth: 1, borderBottomColor: colors.border, paddingTop: 52 },
  headerContent: { padding: 16, paddingTop: 4 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  statsBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 12, color: colors.muted, fontWeight: '500' },
  statDivider: { width: 1, height: 12, backgroundColor: colors.border2 },

  list: { padding: 16, paddingBottom: 40 },

  // Year section
  yearSection: { marginBottom: 8 },
  yearMarker: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 12 },
  timelineLine: { position: 'absolute', left: 10, top: 0, bottom: -14, width: 2, backgroundColor: 'rgba(124,58,237,0.3)' },
  yearDot: { width: 22, height: 22, borderRadius: 11, zIndex: 1 },
  yearLabelWrap: { borderRadius: radius.full, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(124,58,237,0.4)' },
  yearLabel: { fontSize: 13, fontWeight: '800', color: '#a78bfa', paddingHorizontal: 14, paddingVertical: 5, letterSpacing: 0.5 },

  storiesWrap: { paddingLeft: 34, gap: 12 },

  // Story card
  card: { borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border2, marginBottom: 4, ...shadows.md },
  cardInner: { padding: 14 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#7c3aed', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(124,58,237,0.5)' },
  avatarImg: { width: 34, height: 34, borderRadius: 17 },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  authorName: { fontSize: 13, fontWeight: '700', color: colors.text },
  dateText: { fontSize: 11, color: colors.muted, marginTop: 1 },
  privacyBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full },
  badgeFamily: { backgroundColor: 'rgba(16,185,129,0.15)' },
  badgePublic: { backgroundColor: 'rgba(96,165,250,0.15)' },
  badgePrivate: { backgroundColor: 'rgba(71,85,105,0.3)' },
  privacyText: { fontSize: 10, fontWeight: '600' },

  thumbnail: { width: '100%', height: 160, borderRadius: radius.md, marginBottom: 10 },
  videoThumb: { width: '100%', height: 120, borderRadius: radius.md, marginBottom: 10, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: 'rgba(30,41,59,0.8)', gap: 6 },
  videoLabel: { color: colors.muted, fontSize: 12 },
  audioThumb: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(124,58,237,0.1)', borderRadius: radius.sm, padding: 10, marginBottom: 10 },
  audioLabel: { color: colors.muted, fontSize: 13 },

  storyTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 4 },
  storyContent: { fontSize: 13, color: colors.muted, lineHeight: 18, marginBottom: 8 },

  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  tag: { backgroundColor: 'rgba(124,58,237,0.15)', borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full },
  tagText: { color: '#a78bfa', fontSize: 11, fontWeight: '500' },

  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 14, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  countText: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  aiBadge: { flexDirection: 'row', alignItems: 'center', marginLeft: 'auto', backgroundColor: 'rgba(124,58,237,0.1)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full },
  aiText: { fontSize: 11, color: '#7c3aed', fontWeight: '600' },

  // Empty state
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon: { width: 90, height: 90, borderRadius: 45, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 10 },
  emptySub: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 22 },
  onThisDayBanner: { margin: 16, borderRadius: radius.lg, overflow: 'hidden', padding: 16, borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)', gap: 8 },
  onThisDayHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  onThisDayTitle: { fontSize: 15, fontWeight: '800', color: '#a78bfa' },
  onThisDayItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  onThisDayYear: { fontSize: 13, fontWeight: '700', color: colors.primary, width: 40 },
  onThisDayStory: { fontSize: 13, color: colors.text, flex: 1 },
});
