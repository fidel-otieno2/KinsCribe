import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import api from '../api/axios';
import { colors, radius } from '../theme';

export default function OnThisDayScreen({ navigation }) {
  const [stories, setStories] = useState([]);
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/extras/on-this-day')
      .then(({ data }) => {
        setStories(data.stories || []);
        setDate(data.date || '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <View style={s.container}>
      <LinearGradient colors={['#0f172a', '#1a0f2e', '#0f172a']} style={StyleSheet.absoluteFill} />

      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View>
          <Text style={s.headerTitle}>On This Day</Text>
          {date ? <Text style={s.headerSub}>{date}</Text> : null}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />
      ) : stories.length === 0 ? (
        <View style={s.empty}>
          <LinearGradient colors={['rgba(124,58,237,0.2)', 'rgba(59,130,246,0.1)']} style={s.emptyIcon}>
            <Ionicons name="calendar-outline" size={40} color={colors.dim} />
          </LinearGradient>
          <Text style={s.emptyTitle}>No memories yet</Text>
          <Text style={s.emptySub}>Family stories from this day in past years will appear here.</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
          <Text style={s.intro}>Memories from this day in past years 🕰️</Text>
          {stories.map(story => (
            <View key={story.id} style={s.card}>
              <LinearGradient colors={['rgba(124,58,237,0.1)', 'rgba(15,23,42,0.8)']} style={StyleSheet.absoluteFill} />
              {story.media_url && story.media_type === 'image' && (
                <Image source={{ uri: story.media_url }} style={s.media} resizeMode="cover" />
              )}
              <View style={s.cardBody}>
                <Text style={s.year}>
                  {story.story_date
                    ? new Date(story.story_date).getFullYear()
                    : new Date(story.created_at).getFullYear()}
                </Text>
                <Text style={s.title}>{story.title}</Text>
                {story.content ? <Text style={s.content} numberOfLines={3}>{story.content}</Text> : null}
                <View style={s.meta}>
                  <View style={[s.avatar, { backgroundColor: colors.primary }]}>
                    {story.author_avatar
                      ? <Image source={{ uri: story.author_avatar }} style={{ width: 24, height: 24, borderRadius: 12 }} />
                      : <Text style={s.avatarLetter}>{story.author_name?.[0]?.toUpperCase()}</Text>}
                  </View>
                  <Text style={s.author}>{story.author_name}</Text>
                  <View style={s.stats}>
                    <Ionicons name="heart" size={12} color={colors.muted} />
                    <Text style={s.statText}>{story.like_count}</Text>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 52, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 0.5, borderBottomColor: colors.border, gap: 12 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: colors.text },
  headerSub: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  intro: { fontSize: 14, color: colors.muted, marginBottom: 16, textAlign: 'center' },
  card: { borderRadius: radius.lg, overflow: 'hidden', marginBottom: 16, borderWidth: 0.5, borderColor: colors.border },
  media: { width: '100%', height: 180 },
  cardBody: { padding: 16 },
  year: { fontSize: 12, color: colors.primary, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  title: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 6 },
  content: { fontSize: 13, color: colors.muted, lineHeight: 19, marginBottom: 10 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: '#fff', fontWeight: '700', fontSize: 10 },
  author: { flex: 1, fontSize: 12, color: colors.muted },
  stats: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statText: { fontSize: 12, color: colors.muted },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 14 },
  emptyIcon: { width: 90, height: 90, borderRadius: 45, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  emptySub: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 22 },
});
