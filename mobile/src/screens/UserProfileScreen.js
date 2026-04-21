import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity,
  ActivityIndicator, ScrollView, Dimensions, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { colors, radius } from '../theme';

const { width } = Dimensions.get('window');
const GRID = (width - 3) / 3;

export default function UserProfileScreen({ route, navigation }) {
  const { userId, userName, userAvatar } = route.params;
  const { user: me } = useAuth();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [connStatus, setConnStatus] = useState(null); // null | 'pending' | 'accepted'
  const [followsYou, setFollowsYou] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [tab, setTab] = useState('posts');

  useEffect(() => {
    if (userId === me?.id) {
      navigation.replace('Main', { screen: 'Profile' });
    }
  }, [userId, me]);

  const fetchAll = useCallback(async () => {
    try {
      const [postsRes, statusRes] = await Promise.all([
        api.get(`/posts/user/${userId}`).catch(() => ({ data: { posts: [], is_private: false, locked: false } })),
        api.get(`/connections/${userId}/status`).catch(() => ({ data: { connected: false, status: null, follows_you: false } })),
      ]);
      const searchRes = await api.get(`/connections/search?q=${userName || ''}`).catch(() => null);
      const found = searchRes?.data?.users?.find(u => u.id === userId);
      setProfile(found || { id: userId, name: userName, avatar_url: userAvatar });
      setPosts(postsRes.data.posts || []);
      setIsPrivate(postsRes.data.is_private || false);
      setLocked(postsRes.data.locked || false);
      setConnStatus(statusRes.data.status);
      setFollowsYou(statusRes.data.follows_you);
    } catch {} finally { setLoading(false); }
  }, [userId]);

  useFocusEffect(useCallback(() => { fetchAll(); }, [fetchAll]));

  const toggleConnect = async () => {
    setConnecting(true);
    try {
      const { data } = await api.post(`/connections/${userId}/toggle`);
      // data.status = 'accepted' | 'pending' | null
      setConnStatus(data.status || null);
      if (data.status === null) {
        // unfollowed — re-check if profile is now locked
        setLocked(isPrivate);
        setPosts([]);
      }
    } catch {} finally { setConnecting(false); }
  };

  const handleBlock = () => Alert.alert(
    'Block Account',
    `Block @${profile?.username || profile?.name}? They won't be able to see your posts or contact you.`,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Block', style: 'destructive', onPress: async () => {
        try { await api.post(`/connections/${userId}/block`); navigation.goBack(); } catch {}
      }},
    ]
  );

  const handleMute = () => Alert.alert(
    'Mute Account',
    `Mute @${profile?.username || profile?.name}? Their posts won't appear in your feed.`,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Mute', onPress: async () => {
        try { await api.post(`/connections/${userId}/mute`); Alert.alert('Muted', 'Account muted successfully'); } catch {}
      }},
    ]
  );

  const openDM = async () => {
    try {
      const { data } = await api.post(`/messages/dm/${userId}`);
      navigation.navigate('Chat', {
        conversationId: data.conversation.id,
        title: profile?.name || userName,
        avatar: profile?.avatar_url || userAvatar,
        type: 'private',
        otherUserId: userId,
      });
    } catch {}
  };

  // Button label + style based on connection status
  const connectLabel = () => {
    if (connStatus === 'accepted') return 'Following ✓';
    if (connStatus === 'pending') return 'Requested';
    return isPrivate ? 'Follow' : 'Follow';
  };

  const connectIcon = () => {
    if (connStatus === 'accepted') return null;
    if (connStatus === 'pending') return 'time-outline';
    return 'person-add-outline';
  };

  const Header = () => (
    <View>
      {/* Top bar */}
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.topName}>{profile?.name || userName}</Text>
        <TouchableOpacity onPress={() => Alert.alert(
          profile?.name || userName,
          'Choose an action',
          [
            { text: 'Mute', onPress: handleMute },
            { text: 'Block', style: 'destructive', onPress: handleBlock },
            { text: 'Report', onPress: () => Alert.alert('Reported', 'Thank you for your report.') },
            { text: 'Cancel', style: 'cancel' },
          ]
        )} style={s.backBtn}>
          <Ionicons name="ellipsis-horizontal" size={22} color={colors.muted} />
        </TouchableOpacity>
      </View>

      {/* Avatar + stats */}
      <View style={s.profileRow}>
        <LinearGradient colors={['#7c3aed', '#3b82f6', '#ec4899']} style={s.avatarRing}>
          <View style={s.avatarInner}>
            {(profile?.avatar_url || userAvatar)
              ? <Image source={{ uri: profile?.avatar_url || userAvatar }} style={s.avatarImg} />
              : <Text style={s.avatarLetter}>{(profile?.name || userName)?.[0]?.toUpperCase() || '?'}</Text>}
          </View>
        </LinearGradient>

        <View style={s.statsRow}>
          <View style={s.stat}>
            <Text style={s.statNum}>{locked ? '—' : posts.length}</Text>
            <Text style={s.statLabel}>Posts</Text>
          </View>
          <View style={s.stat}>
            <Text style={s.statNum}>{profile?.connection_count || 0}</Text>
            <Text style={s.statLabel}>Followers</Text>
          </View>
          <View style={s.stat}>
            <Text style={s.statNum}>{profile?.interest_count || 0}</Text>
            <Text style={s.statLabel}>Following</Text>
          </View>
        </View>
      </View>

      {/* Bio */}
      <View style={s.bioWrap}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={s.name}>{profile?.name || userName}</Text>
          {profile?.verified_badge && (
            <Ionicons name="checkmark-circle" size={16} color="#3b82f6" />
          )}
          {isPrivate && (
            <View style={s.privateBadge}>
              <Ionicons name="lock-closed" size={10} color="#a78bfa" />
              <Text style={s.privateBadgeText}>Private</Text>
            </View>
          )}
        </View>
        {profile?.username && <Text style={s.handle}>@{profile.username}</Text>}
        {profile?.bio && <Text style={s.bio}>{profile.bio}</Text>}
        {followsYou && <Text style={s.followsYouBadge}>Follows you</Text>}
      </View>

      {/* Action buttons */}
      <View style={s.actionRow}>
        <TouchableOpacity
          style={[
            s.actionBtn,
            connStatus === 'accepted' && s.actionBtnOutline,
            connStatus === 'pending' && s.actionBtnPending,
          ]}
          onPress={toggleConnect}
          disabled={connecting}
          activeOpacity={0.8}
        >
          {connecting ? (
            <ActivityIndicator size="small" color={connStatus ? colors.muted : '#fff'} />
          ) : connStatus === 'accepted' ? (
            <Text style={s.actionBtnOutlineText}>Following ✓</Text>
          ) : connStatus === 'pending' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="time-outline" size={14} color={colors.muted} />
              <Text style={s.actionBtnOutlineText}>Requested</Text>
            </View>
          ) : (
            <LinearGradient colors={['#7c3aed', '#3b82f6']} style={s.actionBtnGrad}>
              <Ionicons name="person-add-outline" size={14} color="#fff" />
              <Text style={s.actionBtnText}>Follow</Text>
            </LinearGradient>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={s.actionBtnOutline} onPress={openDM} activeOpacity={0.8}>
          <Ionicons name="chatbubble-outline" size={14} color={colors.text} />
          <Text style={s.actionBtnOutlineText}>Message</Text>
        </TouchableOpacity>
      </View>

      {/* Tab toggle — only show if not locked */}
      {!locked && (
        <View style={s.tabRow}>
          <TouchableOpacity style={[s.tabBtn, tab === 'posts' && s.tabBtnActive]} onPress={() => setTab('posts')}>
            <Ionicons name="grid-outline" size={20} color={tab === 'posts' ? colors.primary : colors.muted} />
          </TouchableOpacity>
          <TouchableOpacity style={[s.tabBtn, tab === 'list' && s.tabBtnActive]} onPress={() => setTab('list')}>
            <Ionicons name="list-outline" size={22} color={tab === 'list' ? colors.primary : colors.muted} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  if (loading) return (
    <View style={[s.container, { alignItems: 'center', justifyContent: 'center' }]}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );

  return (
    <View style={s.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        <Header />

        {/* Private / locked state */}
        {locked ? (
          <View style={s.lockedWrap}>
            <BlurView intensity={10} tint="dark" style={s.lockedCard}>
              <LinearGradient colors={['rgba(124,58,237,0.12)', 'rgba(15,23,42,0.9)']} style={StyleSheet.absoluteFill} />
              <View style={s.lockedIconWrap}>
                <LinearGradient colors={['#7c3aed', '#3b82f6']} style={s.lockedIcon}>
                  <Ionicons name="lock-closed" size={28} color="#fff" />
                </LinearGradient>
              </View>
              <Text style={s.lockedTitle}>This account is private</Text>
              <Text style={s.lockedSub}>
                {connStatus === 'pending'
                  ? 'Your follow request is pending approval.'
                  : 'Follow this account to see their photos and videos.'}
              </Text>
              {connStatus !== 'pending' && (
                <TouchableOpacity
                  style={s.lockedFollowBtn}
                  onPress={toggleConnect}
                  disabled={connecting}
                  activeOpacity={0.85}
                >
                  <LinearGradient colors={['#7c3aed', '#3b82f6']} style={s.lockedFollowBtnGrad}>
                    {connecting
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <>
                          <Ionicons name="person-add-outline" size={16} color="#fff" />
                          <Text style={s.lockedFollowBtnText}>Follow</Text>
                        </>}
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </BlurView>

            {/* Blurred placeholder grid */}
            <View style={s.blurGrid}>
              {Array.from({ length: 9 }).map((_, i) => (
                <View key={i} style={[s.gridItem, { backgroundColor: 'rgba(255,255,255,0.04)' }]} />
              ))}
            </View>
          </View>
        ) : posts.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="camera-outline" size={48} color={colors.dim} />
            <Text style={s.emptyText}>No posts yet</Text>
          </View>
        ) : tab === 'posts' ? (
          <View style={s.grid}>
            {posts.map(p => (
              <TouchableOpacity key={p.id} style={s.gridItem} activeOpacity={0.9}>
                {p.media_url
                  ? <Image source={{ uri: p.media_url }} style={s.gridImg} resizeMode="cover" />
                  : <View style={[s.gridImg, s.gridText]}>
                      <Text style={s.gridCaption} numberOfLines={4}>{p.caption}</Text>
                    </View>}
                {p.like_count > 0 && (
                  <View style={s.gridLikes}>
                    <Ionicons name="heart" size={10} color="#fff" />
                    <Text style={s.gridLikesText}>{p.like_count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          posts.map(p => (
            <View key={p.id} style={s.listItem}>
              {p.media_url && <Image source={{ uri: p.media_url }} style={s.listImg} resizeMode="cover" />}
              <View style={s.listInfo}>
                <Text style={s.listCaption} numberOfLines={2}>{p.caption}</Text>
                <View style={s.listMeta}>
                  <Ionicons name="heart" size={13} color={colors.muted} />
                  <Text style={s.listMetaText}>{p.like_count}</Text>
                  <Ionicons name="chatbubble-outline" size={13} color={colors.muted} />
                  <Text style={s.listMetaText}>{p.comment_count}</Text>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>
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
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  handle: { fontSize: 13, color: colors.muted, marginTop: 1 },
  bio: { fontSize: 13, color: colors.text, marginTop: 4, lineHeight: 18 },
  followsYouBadge: { fontSize: 11, color: colors.muted, fontWeight: '600', marginTop: 4, backgroundColor: 'rgba(255,255,255,0.07)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, alignSelf: 'flex-start' },
  privateBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(124,58,237,0.15)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)' },
  privateBadgeText: { fontSize: 10, color: '#a78bfa', fontWeight: '700' },
  actionRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingBottom: 14 },
  actionBtn: { flex: 1, height: 36, borderRadius: radius.md, overflow: 'hidden' },
  actionBtnGrad: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  actionBtnOutline: { flex: 1, height: 36, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border2, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  actionBtnPending: { flex: 1, height: 36, borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(245,158,11,0.4)', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(245,158,11,0.08)' },
  actionBtnOutlineText: { color: colors.text, fontWeight: '600', fontSize: 14 },
  tabRow: { flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: colors.border },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  tabBtnActive: { borderBottomWidth: 1.5, borderBottomColor: colors.primary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 1.5 },
  gridItem: { width: GRID, height: GRID, position: 'relative' },
  gridImg: { width: '100%', height: '100%' },
  gridText: { backgroundColor: colors.bgSecondary, alignItems: 'center', justifyContent: 'center', padding: 8 },
  gridCaption: { color: colors.text, fontSize: 11, textAlign: 'center' },
  gridLikes: { position: 'absolute', bottom: 4, left: 4, flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 10 },
  gridLikesText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  listItem: { flexDirection: 'row', gap: 12, padding: 16, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  listImg: { width: 70, height: 70, borderRadius: 8 },
  listInfo: { flex: 1, justifyContent: 'center' },
  listCaption: { fontSize: 14, color: colors.text, lineHeight: 19 },
  listMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  listMetaText: { fontSize: 12, color: colors.muted },
  empty: { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyText: { fontSize: 16, color: colors.muted },
  // Locked / private state
  lockedWrap: { position: 'relative' },
  lockedCard: { margin: 20, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(124,58,237,0.2)', paddingVertical: 32, paddingHorizontal: 24, alignItems: 'center', gap: 10 },
  lockedIconWrap: { marginBottom: 4 },
  lockedIcon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  lockedTitle: { fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center' },
  lockedSub: { fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 19, paddingHorizontal: 10 },
  lockedFollowBtn: { borderRadius: radius.md, overflow: 'hidden', marginTop: 8, width: '100%' },
  lockedFollowBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13 },
  lockedFollowBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  blurGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 1.5, opacity: 0.3 },
});
