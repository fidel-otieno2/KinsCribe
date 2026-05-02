import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, StyleSheet, TouchableOpacity, FlatList,
  Image, ActivityIndicator, Dimensions, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Video, ResizeMode } from 'expo-av';
import AppText from '../components/AppText';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { colors, radius } from '../theme';
import { HexAvatar } from './StoryViewerScreen';

const { width } = Dimensions.get('window');
const TILE = (width - 48) / 3;
const GRID_ITEM = (width - 6) / 3;

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

  const [tab, setTab] = useState('posts'); // 'posts' or 'moments'
  const [posts, setPosts] = useState([]);
  const [moments, setMoments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [visiblePostId, setVisiblePostId] = useState(null);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60,
  }).current;

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setVisiblePostId(viewableItems[0].item.id);
    }
  }).current;

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [postsRes, momentsRes] = await Promise.all([
        api.get(`/stories/family?family_id=${familyId}`),
        api.get(`/pstories/family/${familyId}/moments`),
      ]);
      setPosts(postsRes.data.stories || []);
      setMoments(momentsRes.data.moments || []);
    } catch (err) {
      console.log('Fetch error:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [familyId]);

  useFocusEffect(useCallback(() => {
    fetchData();
    // Cleanup: stop videos when leaving screen
    return () => {
      setVisiblePostId(null);
    };
  }, [fetchData]));

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
        <View style={{ flex: 1 }}>
          <AppText style={s.headerTitle}>Family Feed</AppText>
          <AppText style={s.headerSub}>{familyName}</AppText>
        </View>
        {/* Create button */}
        <TouchableOpacity
          style={s.createBtn}
          onPress={() => navigation.navigate('Create', {
            initialMode: tab === 'moments' ? 'story' : 'post',
            momentConfig: tab === 'moments' ? { family_id: familyId, is_moment: true, expires_hours: 24 } : undefined,
          })}
        >
          <LinearGradient colors={['#7c3aed', '#3b82f6']} style={s.createBtnGrad}>
            <Ionicons name="add" size={20} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Tab Selector */}
      <View style={s.tabRow}>
        <TouchableOpacity
          style={[s.tab, tab === 'posts' && s.tabActive]}
          onPress={() => setTab('posts')}
          activeOpacity={0.7}
        >
          <Ionicons
            name={tab === 'posts' ? 'grid' : 'grid-outline'}
            size={18}
            color={tab === 'posts' ? '#fff' : 'rgba(255,255,255,0.5)'}
          />
          <AppText style={[s.tabText, tab === 'posts' && s.tabTextActive]}>Posts</AppText>
          {posts.length > 0 && (
            <View style={s.tabBadge}>
              <AppText style={s.tabBadgeText}>{posts.length}</AppText>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tab, tab === 'moments' && s.tabActive]}
          onPress={() => setTab('moments')}
          activeOpacity={0.7}
        >
          <Ionicons
            name={tab === 'moments' ? 'sparkles' : 'sparkles-outline'}
            size={18}
            color={tab === 'moments' ? '#fff' : 'rgba(255,255,255,0.5)'}
          />
          <AppText style={[s.tabText, tab === 'moments' && s.tabTextActive]}>Moments</AppText>
          {moments.length > 0 && (
            <View style={s.tabBadge}>
              <AppText style={s.tabBadgeText}>{moments.length}</AppText>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : tab === 'posts' ? (
        posts.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="images-outline" size={56} color="#7c3aed" />
            <AppText style={s.emptyTitle}>No Family Posts Yet</AppText>
            <AppText style={s.emptySub}>Share memories, photos, and stories with your family.</AppText>
            <TouchableOpacity
              style={s.emptyBtn}
              onPress={() => navigation.navigate('Create', { initialMode: 'post' })}
            >
              <LinearGradient colors={['#7c3aed', '#3b82f6']} style={s.emptyBtnGrad}>
                <Ionicons name="add-circle-outline" size={18} color="#fff" />
                <AppText style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Create Post</AppText>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={posts}
            keyExtractor={p => String(p.id)}
            numColumns={3}
            contentContainerStyle={s.postsGrid}
            showsVerticalScrollIndicator={false}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => { setRefreshing(true); fetchData(true); }}
                tintColor="#7c3aed"
              />
            }
            renderItem={({ item: post }) => {
              const isVisible = visiblePostId === post.id;
              return (
                <TouchableOpacity
                  style={s.gridItem}
                  onPress={() => navigation.navigate('PostDetail', { postId: post.id })}
                  activeOpacity={0.85}
                >
                  {post.media_url && post.media_type === 'image' ? (
                    <Image source={{ uri: post.media_url }} style={s.gridImg} resizeMode="cover" />
                  ) : post.media_url && post.media_type === 'video' ? (
                    <View style={s.gridImg}>
                      <Video
                        source={{ uri: post.media_url }}
                        style={s.gridImg}
                        resizeMode={ResizeMode.COVER}
                        shouldPlay={isVisible}
                        isLooping
                        isMuted
                        useNativeControls={false}
                      />
                      {!isVisible && (
                        <View style={s.videoOverlay}>
                          <Ionicons name="play-circle" size={32} color="#fff" />
                        </View>
                      )}
                    </View>
                  ) : (
                    <LinearGradient colors={['#7c3aed', '#3b82f6']} style={s.gridImg}>
                      <AppText style={s.gridText} numberOfLines={4}>{post.title || post.content}</AppText>
                    </LinearGradient>
                  )}
                  {/* Author badge */}
                  <View style={s.authorBadge}>
                    {post.author_avatar ? (
                      <Image source={{ uri: post.author_avatar }} style={s.authorAvatar} />
                    ) : (
                      <View style={[s.authorAvatar, { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }]}>
                        <AppText style={{ color: '#fff', fontSize: 8, fontWeight: '800' }}>{post.author_name?.[0]}</AppText>
                      </View>
                    )}
                  </View>
                  {/* Like count */}
                  {post.like_count > 0 && (
                    <View style={s.likesBadge}>
                      <Ionicons name="heart" size={10} color="#fff" />
                      <AppText style={s.likesBadgeText}>{post.like_count}</AppText>
                    </View>
                  )}
                </TouchableOpacity>
              );
            }}
          />
        )
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 12 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 1 },
  createBtn: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', shadowColor: '#7c3aed', shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 6 },
  createBtnGrad: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  tabRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, gap: 10, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.1)' },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 12, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.05)' },
  tabActive: { backgroundColor: 'rgba(124,58,237,0.3)', borderWidth: 1, borderColor: 'rgba(124,58,237,0.5)' },
  tabText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },
  tabTextActive: { color: '#fff' },
  tabBadge: { backgroundColor: 'rgba(124,58,237,0.8)', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 10, minWidth: 18, alignItems: 'center' },
  tabBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  postsGrid: { paddingTop: 2, paddingBottom: 40 },
  gridItem: { width: GRID_ITEM, height: GRID_ITEM, margin: 1, position: 'relative', backgroundColor: '#000' },
  gridImg: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  gridText: { color: '#fff', fontSize: 11, fontWeight: '600', textAlign: 'center', padding: 8 },
  videoOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  authorBadge: { position: 'absolute', bottom: 6, left: 6 },
  authorAvatar: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: '#fff' },
  likesBadge: { position: 'absolute', top: 6, right: 6, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 10 },
  likesBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },

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
