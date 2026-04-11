import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity,
  FlatList, ActivityIndicator, ScrollView, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import StoryCard from '../components/StoryCard';
import { colors, radius } from '../theme';

const { width } = Dimensions.get('window');
const GRID = (width - 3) / 3;

export default function UserProfileScreen({ route, navigation }) {
  const { userId, userName, userAvatar } = route.params;
  const { user: me } = useAuth();
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('grid');
  const [stats, setStats] = useState({ stories: 0, likes: 0, comments: 0 });

  // If viewing own profile, redirect to Profile tab
  useEffect(() => {
    if (userId === me?.id) {
      navigation.replace('Main', { screen: 'Profile' });
    }
  }, [userId, me]);

  const fetchStories = useCallback(async () => {
    try {
      const { data } = await api.get('/stories/feed');
      const theirs = data.stories.filter(s => s.user_id === userId);
      setStories(theirs);
      setStats({
        stories: theirs.length,
        likes: theirs.reduce((s, x) => s + (x.like_count || 0), 0),
        comments: theirs.reduce((s, x) => s + (x.comment_count || 0), 0),
      });
    } catch {} finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { fetchStories(); }, [fetchStories]);

  const Header = () => (
    <View>
      {/* Top bar */}
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.topName}>{userName || 'Profile'}</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Profile row */}
      <View style={s.profileRow}>
        <LinearGradient colors={['#7c3aed', '#3b82f6', '#ec4899']} style={s.avatarRing}>
          <View style={s.avatarInner}>
            {userAvatar
              ? <Image source={{ uri: userAvatar }} style={s.avatarImg} />
              : <Text style={s.avatarLetter}>{userName?.[0]?.toUpperCase() || '?'}</Text>}
          </View>
        </LinearGradient>

        <View style={s.statsRow}>
          {[
            { label: 'Stories', value: stats.stories },
            { label: 'Likes', value: stats.likes },
            { label: 'Comments', value: stats.comments },
          ].map(({ label, value }) => (
            <View key={label} style={s.stat}>
              <Text style={s.statNum}>{value}</Text>
              <Text style={s.statLabel}>{label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Name */}
      <View style={s.bioWrap}>
        <Text style={s.name}>{userName}</Text>
        <Text style={s.bio}>Family member · KinsCribe</Text>
      </View>

      {/* View toggle */}
      <View style={s.viewToggle}>
        <TouchableOpacity style={[s.toggleBtn, view === 'grid' && s.toggleBtnActive]} onPress={() => setView('grid')}>
          <Ionicons name="grid-outline" size={20} color={view === 'grid' ? colors.primary : colors.muted} />
        </TouchableOpacity>
        <TouchableOpacity style={[s.toggleBtn, view === 'list' && s.toggleBtnActive]} onPress={() => setView('list')}>
          <Ionicons name="list-outline" size={22} color={view === 'list' ? colors.primary : colors.muted} />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) return (
    <View style={[s.container, { alignItems: 'center', justifyContent: 'center' }]}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );

  if (view === 'grid') {
    return (
      <View style={s.container}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <Header />
          {stories.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="camera-outline" size={48} color={colors.dim} />
              <Text style={s.emptyText}>No stories yet</Text>
            </View>
          ) : (
            <View style={s.grid}>
              {stories.map(story => (
                <TouchableOpacity key={story.id} style={s.gridItem} activeOpacity={0.9}>
                  {story.media_url && story.media_type === 'image'
                    ? <Image source={{ uri: story.media_url }} style={s.gridImg} />
                    : story.media_type === 'video'
                    ? <View style={[s.gridImg, s.gridVideo]}><Ionicons name="play-circle" size={28} color="#fff" /></View>
                    : story.media_type === 'audio'
                    ? <View style={[s.gridImg, s.gridAudio]}><Ionicons name="musical-notes" size={24} color="#7c3aed" /></View>
                    : <View style={[s.gridImg, s.gridText]}><Text style={s.gridTextContent} numberOfLines={3}>{story.title}</Text></View>}
                  {story.like_count > 0 && (
                    <View style={s.gridLikes}>
                      <Ionicons name="heart" size={10} color="#fff" />
                      <Text style={s.gridLikesText}>{story.like_count}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <FlatList
        data={stories}
        keyExtractor={i => String(i.id)}
        ListHeaderComponent={<Header />}
        renderItem={({ item }) => <StoryCard story={item} onUpdate={fetchStories} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="camera-outline" size={48} color={colors.dim} />
            <Text style={s.emptyText}>No stories yet</Text>
          </View>
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 52, paddingHorizontal: 16, paddingBottom: 10 },
  backBtn: { padding: 4 },
  topName: { fontSize: 17, fontWeight: '700', color: colors.text },
  profileRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 14, gap: 20 },
  avatarRing: { width: 86, height: 86, borderRadius: 43, padding: 3, alignItems: 'center', justifyContent: 'center' },
  avatarInner: { width: 78, height: 78, borderRadius: 39, overflow: 'hidden', backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.bg },
  avatarImg: { width: '100%', height: '100%' },
  avatarLetter: { color: '#fff', fontWeight: '800', fontSize: 30 },
  statsRow: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center' },
  statNum: { fontSize: 20, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 12, color: colors.muted, marginTop: 2 },
  bioWrap: { paddingHorizontal: 16, paddingBottom: 14 },
  name: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 3 },
  bio: { fontSize: 13, color: colors.muted },
  viewToggle: { flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: colors.border },
  toggleBtn: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  toggleBtnActive: { borderBottomWidth: 1.5, borderBottomColor: colors.primary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 1.5 },
  gridItem: { width: GRID, height: GRID, position: 'relative' },
  gridImg: { width: '100%', height: '100%' },
  gridVideo: { backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' },
  gridAudio: { backgroundColor: 'rgba(124,58,237,0.15)', alignItems: 'center', justifyContent: 'center' },
  gridText: { backgroundColor: colors.bgSecondary, alignItems: 'center', justifyContent: 'center', padding: 8 },
  gridTextContent: { color: colors.text, fontSize: 11, textAlign: 'center' },
  gridLikes: { position: 'absolute', bottom: 4, left: 4, flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 10 },
  gridLikesText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  empty: { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyText: { fontSize: 16, color: colors.muted },
});
