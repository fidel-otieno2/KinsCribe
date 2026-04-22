import { useEffect, useState, useCallback } from 'react';
import {
  View, StyleSheet, Image, TouchableOpacity,
  ActivityIndicator, ScrollView, Dimensions, Alert, Modal,
} from 'react-native';
import AppText from '../components/AppText';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../i18n';
import { colors, radius } from '../theme';

const { width } = Dimensions.get('window');
const GRID = (width - 3) / 3;

export default function UserProfileScreen({ route, navigation }) {
  const { userId, userName, userAvatar } = route.params;
  const { user: me } = useAuth();
  const { t } = useTranslation();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [connStatus, setConnStatus] = useState(null); // null | 'pending' | 'accepted'
  const [followsYou, setFollowsYou] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [tab, setTab] = useState('posts');
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blocking, setBlocking] = useState(false);

  useEffect(() => {
    if (userId === me?.id) {
      navigation.goBack();
    }
  }, [userId, me]);

  const fetchAll = useCallback(async () => {
    try {
      const [postsRes, statusRes, blockRes] = await Promise.all([
        api.get(`/posts/user/${userId}`).catch(() => ({ data: { posts: [], is_private: false, locked: false } })),
        api.get(`/connections/${userId}/status`).catch(() => ({ data: { connected: false, status: null, follows_you: false } })),
        api.get(`/connections/${userId}/block-status`).catch(() => ({ data: { blocked: false } })),
      ]);
      const searchRes = await api.get(`/connections/search?q=${userName || ''}`).catch(() => null);
      const found = searchRes?.data?.users?.find(u => u.id === userId);
      setProfile(found || { id: userId, name: userName, avatar_url: userAvatar });
      setPosts(postsRes.data.posts || []);
      setIsPrivate(postsRes.data.is_private || false);
      setLocked(postsRes.data.locked || false);
      setConnStatus(statusRes.data.status);
      setFollowsYou(statusRes.data.follows_you);
      setIsBlocked(blockRes.data.blocked || false);
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

  const handleBlock = () => setShowBlockModal(true);

  const confirmBlock = async () => {
    setBlocking(true);
    try {
      await api.post(`/connections/${userId}/block`);
      setIsBlocked(true);
      setConnStatus(null);
      setShowBlockModal(false);
      navigation.goBack();
    } catch {} finally { setBlocking(false); }
  };

  const handleUnblock = async () => {
    setBlocking(true);
    try {
      await api.post(`/connections/${userId}/unblock`);
      setIsBlocked(false);
      setShowBlockModal(false);
    } catch {} finally { setBlocking(false); }
  };

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
    if (connStatus === 'accepted') return t('following_check');
    if (connStatus === 'pending') return t('requested');
    return t('follow');
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
        <AppText style={s.topName}>{profile?.name || userName}</AppText>
        <TouchableOpacity onPress={() => Alert.alert(
          profile?.name || userName,
          'Choose an action',
          [
            { text: 'Mute', onPress: handleMute },
            { text: isBlocked ? 'Unblock' : 'Block', style: 'destructive', onPress: handleBlock },
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
              : <AppText style={s.avatarLetter}>{(profile?.name || userName)?.[0]?.toUpperCase() || '?'}</AppText>}
          </View>
        </LinearGradient>

        <View style={s.statsRow}>
          <View style={s.stat}>
            <AppText style={s.statNum}>{locked ? '—' : posts.length}</AppText>
            <AppText style={s.statLabel}>{t('posts')}</AppText>
          </View>
          <View style={s.stat}>
            <AppText style={s.statNum}>{profile?.connection_count || 0}</AppText>
            <AppText style={s.statLabel}>{t('followers')}</AppText>
          </View>
          <View style={s.stat}>
            <AppText style={s.statNum}>{profile?.interest_count || 0}</AppText>
            <AppText style={s.statLabel}>{t('following')}</AppText>
          </View>
        </View>
      </View>

      {/* Bio */}
      <View style={s.bioWrap}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <AppText style={s.name}>{profile?.name || userName}</AppText>
          {profile?.verified_badge && (
            <Ionicons name="checkmark-circle" size={16} color="#3b82f6" />
          )}
          {isPrivate && (
            <View style={s.privateBadge}>
              <Ionicons name="lock-closed" size={10} color="#a78bfa" />
              <AppText style={s.privateBadgeText}>Private</AppText>
            </View>
          )}
        </View>
        {profile?.username && <AppText style={s.handle}>@{profile.username}</AppText>}
        {profile?.bio && <AppText style={s.bio}>{profile.bio}</AppText>}
        {followsYou && <AppText style={s.followsYouBadge}>{t('follows_you')}</AppText>}
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
          disabled={connecting || isBlocked}
          activeOpacity={0.8}
        >
          {connecting ? (
            <ActivityIndicator size="small" color={connStatus ? colors.muted : '#fff'} />
          ) : connStatus === 'accepted' ? (
            <AppText style={s.actionBtnOutlineText}>{t('following_check')}</AppText>
          ) : connStatus === 'pending' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="time-outline" size={14} color={colors.muted} />
              <AppText style={s.actionBtnOutlineText}>{t('requested')}</AppText>
            </View>
          ) : (
            <LinearGradient colors={['#7c3aed', '#3b82f6']} style={s.actionBtnGrad}>
              <Ionicons name="person-add-outline" size={14} color="#fff" />
              <AppText style={s.actionBtnText}>{t('follow')}</AppText>
            </LinearGradient>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={s.actionBtnOutline} onPress={openDM} activeOpacity={0.8}>
          <Ionicons name="chatbubble-outline" size={14} color={colors.text} />
          <AppText style={s.actionBtnOutlineText}>{t('message_action')}</AppText>
        </TouchableOpacity>

        {/* Block button */}
        <TouchableOpacity
          style={[s.actionBtnIcon, isBlocked && s.actionBtnIconActive]}
          onPress={handleBlock}
          activeOpacity={0.8}
        >
          <Ionicons name="ban-outline" size={18} color={isBlocked ? '#f87171' : colors.muted} />
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
              <AppText style={s.lockedTitle}>{t('this_account_private')}</AppText>
              <AppText style={s.lockedSub}>
                {connStatus === 'pending'
                  ? t('request_pending')
                  : t('follow_to_see')}
              </AppText>
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
                          <AppText style={s.lockedFollowBtnText}>{t('follow')}</AppText>
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
            <AppText style={s.emptyText}>{t('no_posts')}</AppText>
          </View>
        ) : tab === 'posts' ? (
          <View style={s.grid}>
            {posts.map(p => (
              <TouchableOpacity key={p.id} style={s.gridItem} activeOpacity={0.9}>
                {p.media_url
                  ? <Image source={{ uri: p.media_url }} style={s.gridImg} resizeMode="cover" />
                  : <View style={[s.gridImg, s.gridText]}>
                      <AppText style={s.gridCaption} numberOfLines={4}>{p.caption}</AppText>
                    </View>}
                {p.like_count > 0 && (
                  <View style={s.gridLikes}>
                    <Ionicons name="heart" size={10} color="#fff" />
                    <AppText style={s.gridLikesText}>{p.like_count}</AppText>
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
                <AppText style={s.listCaption} numberOfLines={2}>{p.caption}</AppText>
                <View style={s.listMeta}>
                  <Ionicons name="heart" size={13} color={colors.muted} />
                  <AppText style={s.listMetaText}>{p.like_count}</AppText>
                  <Ionicons name="chatbubble-outline" size={13} color={colors.muted} />
                  <AppText style={s.listMetaText}>{p.comment_count}</AppText>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Block / Unblock Confirmation Modal */}
      <Modal visible={showBlockModal} transparent animationType="fade" onRequestClose={() => setShowBlockModal(false)}>
        <View style={s.modalOverlay}>
          <BlurView intensity={20} tint="dark" style={s.blockModal}>
            <LinearGradient
              colors={isBlocked ? ['rgba(16,185,129,0.08)', 'rgba(15,23,42,0.98)'] : ['rgba(248,113,113,0.08)', 'rgba(15,23,42,0.98)']}
              style={StyleSheet.absoluteFill}
            />
            {/* Avatar */}
            <View style={s.blockAvatarWrap}>
              <LinearGradient colors={isBlocked ? ['#10b981', '#059669'] : ['#f87171', '#ef4444']} style={s.blockAvatarRing}>
                <View style={s.blockAvatarInner}>
                  {(profile?.avatar_url || userAvatar)
                    ? <Image source={{ uri: profile?.avatar_url || userAvatar }} style={{ width: '100%', height: '100%' }} />
                    : <AppText style={s.blockAvatarLetter}>{(profile?.name || userName)?.[0]?.toUpperCase()}</AppText>}
                </View>
              </LinearGradient>
            </View>

            <AppText style={s.blockTitle}>
              {isBlocked ? `Unblock ${profile?.name || userName}?` : `Block ${profile?.name || userName}?`}
            </AppText>

            {isBlocked ? (
              <View style={s.blockInfoBox}>
                <View style={s.blockInfoRow}>
                  <Ionicons name="checkmark-circle" size={16} color="#34d399" />
                  <AppText style={s.blockInfoText}>They will be able to see your posts and follow you again</AppText>
                </View>
                <View style={s.blockInfoRow}>
                  <Ionicons name="checkmark-circle" size={16} color="#34d399" />
                  <AppText style={s.blockInfoText}>They can send you messages again</AppText>
                </View>
              </View>
            ) : (
              <View style={s.blockInfoBox}>
                <View style={s.blockInfoRow}>
                  <Ionicons name="close-circle" size={16} color="#f87171" />
                  <AppText style={s.blockInfoText}>They won't be able to see your posts or stories</AppText>
                </View>
                <View style={s.blockInfoRow}>
                  <Ionicons name="close-circle" size={16} color="#f87171" />
                  <AppText style={s.blockInfoText}>They won't be able to follow you or send messages</AppText>
                </View>
                <View style={s.blockInfoRow}>
                  <Ionicons name="close-circle" size={16} color="#f87171" />
                  <AppText style={s.blockInfoText}>They won't be notified that you blocked them</AppText>
                </View>
                <View style={s.blockInfoRow}>
                  <Ionicons name="information-circle" size={16} color="#94a3b8" />
                  <AppText style={s.blockInfoText}>You can unblock them anytime from Settings → Privacy</AppText>
                </View>
              </View>
            )}

            <View style={s.blockBtns}>
              <TouchableOpacity
                style={s.blockCancelBtn}
                onPress={() => setShowBlockModal(false)}
                activeOpacity={0.8}
              >
                <AppText style={s.blockCancelText}>{t('cancel')}</AppText>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.blockConfirmBtn}
                onPress={isBlocked ? handleUnblock : confirmBlock}
                disabled={blocking}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={isBlocked ? ['#10b981', '#059669'] : ['#f87171', '#ef4444']}
                  style={s.blockConfirmGrad}
                >
                  {blocking
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <AppText style={s.blockConfirmText}>{isBlocked ? 'Unblock' : 'Block'}</AppText>}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>
      </Modal>
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
  // Block modal
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.75)', paddingHorizontal: 28 },
  blockModal: { width: '100%', borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(248,113,113,0.2)', paddingBottom: 24 },
  blockAvatarWrap: { alignItems: 'center', marginTop: 28, marginBottom: 16 },
  blockAvatarRing: { width: 80, height: 80, borderRadius: 40, padding: 3, alignItems: 'center', justifyContent: 'center' },
  blockAvatarInner: { width: 72, height: 72, borderRadius: 36, overflow: 'hidden', backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.bg },
  blockAvatarLetter: { color: '#fff', fontWeight: '800', fontSize: 28 },
  blockTitle: { fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: 16, paddingHorizontal: 20 },
  blockInfoBox: { marginHorizontal: 20, marginBottom: 24, gap: 10 },
  blockInfoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  blockInfoText: { flex: 1, fontSize: 13, color: colors.muted, lineHeight: 19 },
  blockBtns: { flexDirection: 'row', gap: 12, paddingHorizontal: 20 },
  blockCancelBtn: { flex: 1, paddingVertical: 13, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border2, alignItems: 'center', backgroundColor: 'rgba(30,41,59,0.8)' },
  blockCancelText: { color: colors.text, fontWeight: '600', fontSize: 15 },
  blockConfirmBtn: { flex: 1, borderRadius: radius.md, overflow: 'hidden' },
  blockConfirmGrad: { paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  blockConfirmText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  // Block icon button in action row
  actionBtnIcon: { width: 36, height: 36, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border2, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.04)' },
  actionBtnIconActive: { borderColor: 'rgba(248,113,113,0.5)', backgroundColor: 'rgba(248,113,113,0.08)' },
});
