import { useState, useEffect, useCallback } from 'react';
import {
  View, StyleSheet, TouchableOpacity, FlatList,
  Image, ActivityIndicator, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AppText from '../components/AppText';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { colors, radius } from '../theme';
import { HexAvatar } from './StoryViewerScreen';

const { width } = Dimensions.get('window');
const TILE = (width - 48) / 3;

function timeLeft(expiresAt) {
  const diff = (new Date(expiresAt.endsWith('Z') ? expiresAt : expiresAt + 'Z') - Date.now()) / 1000;
  if (diff <= 0) return 'Expired';
  if (diff < 3600) return `${Math.floor(diff / 60)}m left`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h left`;
  return `${Math.floor(diff / 86400)}d left`;
}

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z')) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function FamilyMomentsScreen({ route, navigation }) {
  const { familyId, familyName } = route.params;
  const { user } = useAuth();
  const { theme } = useTheme();

  const [moments, setMoments] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchMoments = useCallback(async () => {
    try {
      const { data } = await api.get(`/pstories/family/${familyId}/moments`);
      setMoments(data.moments || []);
    } catch {} finally { setLoading(false); }
  }, [familyId]);

  useFocusEffect(useCallback(() => { fetchMoments(); }, [fetchMoments]));

  // Group moments by user for story-viewer style bubbles at top
  const byUser = moments.reduce((acc, m) => {
    if (!acc[m.user_id]) acc[m.user_id] = { user_id: m.user_id, author_name: m.author_name, author_avatar: m.author_avatar, moments: [] };
    acc[m.user_id].moments.push(m);
    return acc;
  }, {});
  const userGroups = Object.values(byUser);

  const openViewer = (startIndex = 0) => {
    // Build storyGroups format compatible with StoryViewerScreen
    const storyGroups = userGroups.map(g => ({
      user_id: g.user_id,
      author_name: g.author_name,
      author_avatar: g.author_avatar,
      is_self: g.user_id === user?.id,
      has_unseen: g.moments.some(m => !m.viewed_by_me),
      stories: g.moments,
    }));
    navigation.navigate('StoryViewer', { storyGroups, initialGroupIndex: startIndex });
  };

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <LinearGradient colors={['#0f172a', '#1a0f2e', '#0f172a']} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View>
          <AppText style={s.headerTitle}>Moments</AppText>
          <AppText style={s.headerSub}>{familyName}</AppText>
        </View>
        {/* Create moment button */}
        <TouchableOpacity
          style={s.createBtn}
          onPress={() => navigation.navigate('Create', {
            initialMode: 'story',
            momentConfig: { family_id: familyId, is_moment: true, expires_hours: 24 },
          })}
        >
          <LinearGradient colors={['#7c3aed', '#3b82f6']} style={s.createBtnGrad}>
            <Ionicons name="add" size={20} color="#fff" />
            <AppText style={s.createBtnText}>Add</AppText>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : moments.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="sparkles-outline" size={56} color="#7c3aed" />
          <AppText style={s.emptyTitle}>No Moments Yet</AppText>
          <AppText style={s.emptySub}>Be the first to share a moment with the family. It disappears in 24h.</AppText>
          <TouchableOpacity
            style={s.emptyBtn}
            onPress={() => navigation.navigate('Create', {
              initialMode: 'story',
              momentConfig: { family_id: familyId, is_moment: true, expires_hours: 24 },
            })}
          >
            <LinearGradient colors={['#7c3aed', '#3b82f6']} style={s.emptyBtnGrad}>
              <Ionicons name="camera-outline" size={18} color="#fff" />
              <AppText style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Share a Moment</AppText>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Story bubbles row */}
          <FlatList
            horizontal
            data={userGroups}
            keyExtractor={g => String(g.user_id)}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.bubblesRow}
            renderItem={({ item: g, index }) => {
              const hasUnseen = g.moments.some(m => !m.viewed_by_me);
              const isMe = g.user_id === user?.id;
              return (
                <TouchableOpacity style={s.bubble} onPress={() => openViewer(index)} activeOpacity={0.85}>
                  <HexAvatar
                    uri={g.author_avatar}
                    name={g.author_name}
                    size={52}
                    hasStory
                    hasSeen={!hasUnseen}
                  />
                  <AppText style={[s.bubbleName, { color: hasUnseen ? '#fff' : theme.muted }]} numberOfLines={1}>
                    {isMe ? 'You' : g.author_name?.split(' ')[0]}
                  </AppText>
                </TouchableOpacity>
              );
            }}
          />

          {/* Grid of all moments */}
          <FlatList
            data={moments}
            keyExtractor={m => String(m.id)}
            numColumns={3}
            contentContainerStyle={s.grid}
            showsVerticalScrollIndicator={false}
            renderItem={({ item: m }) => (
              <TouchableOpacity
                style={s.tile}
                onPress={() => {
                  const groupIdx = userGroups.findIndex(g => g.user_id === m.user_id);
                  openViewer(Math.max(0, groupIdx));
                }}
                activeOpacity={0.85}
              >
                {m.media_url && m.media_type === 'image' ? (
                  <Image source={{ uri: m.media_url }} style={s.tileImg} resizeMode="cover" />
                ) : m.media_url && m.media_type === 'video' ? (
                  <View style={[s.tileImg, { backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }]}>
                    <Ionicons name="play-circle" size={32} color="#fff" />
                  </View>
                ) : (
                  <LinearGradient colors={[m.bg_color || '#7c3aed', '#0f172a']} style={s.tileImg}>
                    <AppText style={s.tileText} numberOfLines={3}>{m.text_content}</AppText>
                  </LinearGradient>
                )}

                {/* Overlay */}
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} style={s.tileOverlay} />

                {/* Author avatar */}
                <View style={s.tileAvatar}>
                  {m.author_avatar
                    ? <Image source={{ uri: m.author_avatar }} style={{ width: 22, height: 22, borderRadius: 11 }} />
                    : <View style={[s.tileAvatarFallback, { backgroundColor: colors.primary }]}>
                        <AppText style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>{m.author_name?.[0]}</AppText>
                      </View>}
                </View>

                {/* Time left badge */}
                <View style={s.timeBadge}>
                  <AppText style={s.timeBadgeText}>{timeLeft(m.expires_at)}</AppText>
                </View>

                {/* Unseen dot */}
                {!m.viewed_by_me && <View style={s.unseenDot} />}
              </TouchableOpacity>
            )}
          />
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 14 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 1 },
  createBtn: { borderRadius: radius.full, overflow: 'hidden' },
  createBtnGrad: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8 },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  bubblesRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 16 },
  bubble: { alignItems: 'center', width: 64 },
  bubbleName: { fontSize: 11, marginTop: 5, fontWeight: '500', textAlign: 'center' },

  grid: { paddingHorizontal: 12, paddingBottom: 40, gap: 4 },
  tile: { width: TILE, height: TILE * 1.4, margin: 2, borderRadius: 10, overflow: 'hidden', position: 'relative' },
  tileImg: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  tileText: { color: '#fff', fontSize: 11, fontWeight: '600', textAlign: 'center', padding: 6 },
  tileOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%' },
  tileAvatar: { position: 'absolute', bottom: 6, left: 6 },
  tileAvatarFallback: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  timeBadge: { position: 'absolute', top: 5, right: 5, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 8 },
  timeBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  unseenDot: { position: 'absolute', top: 5, left: 5, width: 8, height: 8, borderRadius: 4, backgroundColor: '#7c3aed', borderWidth: 1.5, borderColor: '#fff' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 12 },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  emptySub: { fontSize: 14, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 20 },
  emptyBtn: { borderRadius: radius.full, overflow: 'hidden', marginTop: 8 },
  emptyBtnGrad: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 13 },
});
