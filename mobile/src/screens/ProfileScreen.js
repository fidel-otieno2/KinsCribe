import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, FlatList, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, Alert, RefreshControl,
  ScrollView, Dimensions, Share, Modal, Linking, Text,
} from 'react-native';
import AppText from '../components/AppText';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from '../i18n';
import api from '../api/axios';
import { colors, radius } from '../theme';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from '../components/Toast';
import useToast from '../hooks/useToast';
import QRCode from 'react-native-qrcode-svg';

const { width } = Dimensions.get('window');
const GRID = (width - 3) / 3;

const TABS = [
  { key: 'posts', icon: 'grid-outline', iconActive: 'grid' },
  { key: 'reels', icon: 'film-outline', iconActive: 'film' },
  { key: 'saved', icon: 'bookmark-outline', iconActive: 'bookmark' },
  { key: 'tagged', icon: 'at-outline', iconActive: 'at' },
  { key: 'liked', icon: 'heart-outline', iconActive: 'heart' },
];

export default function ProfileScreen({ navigation }) {
  const { user, refreshUser, logout } = useAuth();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { toast, hide, success, error, info } = useToast();
  const [posts, setPosts] = useState([]);
  const [savedPosts, setSavedPosts] = useState([]);
  const [taggedPosts, setTaggedPosts] = useState([]);
  const [likedPosts, setLikedPosts] = useState([]);
  const [highlights, setHighlights] = useState([]);
  const [tab, setTab] = useState('posts');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [feedLayout, setFeedLayout] = useState('grid'); // 'grid' | 'list'
  const [stats, setStats] = useState({ posts: 0, connections: 0, interests: 0 });
  const [listModal, setListModal] = useState({ visible: false, type: null, data: [], loading: false });

  const fetchAll = useCallback(async () => {
    if (!user) return;
    try {
      const [postsRes, savedRes, highlightsRes, taggedRes, likedRes] = await Promise.all([
        api.get(`/posts/user/${user.id}`).catch(() => ({ data: { posts: [] } })),
        api.get('/pstories/saved').catch(() => ({ data: { posts: [] } })),
        api.get(`/pstories/highlights?user_id=${user.id}`).catch(() => ({ data: { highlights: [] } })),
        api.get(`/posts/tagged/${user.id}`).catch(() => ({ data: { posts: [] } })),
        api.get(`/posts/liked/${user.id}`).catch(() => ({ data: { posts: [] } })),
      ]);
      const allPosts = postsRes.data.posts || [];
      setPosts(allPosts);
      setSavedPosts(savedRes.data.posts || []);
      setTaggedPosts(taggedRes.data.posts || []);
      setLikedPosts(likedRes.data.posts || []);
      setHighlights(highlightsRes.data.highlights || []);
      setStats({
        posts: allPosts.length,
        connections: user.connection_count || 0,
        interests: user.interest_count || 0,
      });
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useFocusEffect(useCallback(() => { fetchAll(); }, [fetchAll]));

  const handleAvatarUpload = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return info('Allow photo access in your device settings');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.7, base64: true,
    });
    if (!result.canceled && result.assets?.[0]) {
      setUploading(true);
      try {
        const token = await AsyncStorage.getItem('access_token');
        const res = await fetch('https://kinscribe-1.onrender.com/api/auth/avatar', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: result.assets[0].base64 }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Upload failed');
        await refreshUser();
      } catch (err) {
        error(err.message);
      } finally { setUploading(false); }
    }
  };

  const handleLogout = () => Alert.alert('Log Out', 'Are you sure?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Log Out', style: 'destructive', onPress: logout },
  ]);

  const openList = async (type) => {
    setListModal({ visible: true, type, data: [], loading: true });
    try {
      const endpoint = type === 'connections'
        ? `/connections/${user.id}/connections`
        : `/connections/${user.id}/interests`;
      const res = await api.get(endpoint);
      const key = type === 'connections' ? 'connections' : 'interests';
      setListModal(prev => ({ ...prev, data: res.data[key] || [], loading: false }));
    } catch {
      setListModal(prev => ({ ...prev, loading: false }));
    }
  };

  const handleShare = async () => {
    try {
      const ref = Math.random().toString(36).slice(2, 12);
      const profileUrl = `https://kinscribe-1.onrender.com/api/auth/u/${user?.username}?ref=${ref}`;
      await Share.share({
        title: `${user?.name} (@${user?.username}) · KinsCribe`,
        message: `${user?.name} is on KinsCribe\n${profileUrl}`,
        url: profileUrl,
      });
    } catch {}
  };

  const renderGridItem = (item) => (
    <TouchableOpacity key={item.id} style={s.gridItem} activeOpacity={0.85}>
      {item.media_url ? (
        <Image source={{ uri: item.media_url }} style={s.gridImg} resizeMode="cover" />
      ) : (
        <View style={[s.gridImg, s.gridText]}>
          <AppText style={s.gridCaption} numberOfLines={4}>{item.caption}</AppText>
        </View>
      )}
      {item.media_type === 'carousel' && (
        <View style={s.carouselBadge}>
          <Ionicons name="copy-outline" size={12} color="#fff" />
        </View>
      )}
      {item.media_type === 'video' && (
        <View style={s.videoBadge}>
          <Ionicons name="play" size={12} color="#fff" />
        </View>
      )}
      {item.like_count > 0 && (
        <View style={s.gridLikes}>
          <Ionicons name="heart" size={10} color="#fff" />
          <AppText style={s.gridLikesText}>{item.like_count}</AppText>
        </View>
      )}
    </TouchableOpacity>
  );

  const currentData =
    tab === 'saved' ? savedPosts :
    tab === 'tagged' ? taggedPosts :
    tab === 'liked' ? likedPosts :
    posts.filter(p => tab === 'reels' ? p.media_type === 'video' : true);

  const Header = () => (
    <View>
      {/* Top bar */}
      <View style={s.topBar}>
        <View style={s.topBarLeft}>
          <AppText style={[s.username, { color: theme.text }]}>@{user?.username || user?.name}</AppText>
          {user?.is_premium && (
            <View style={s.premiumBadge}>
              <Ionicons name="star" size={9} color="#C4A35A" />
              <AppText style={s.premiumText}>PRO</AppText>
            </View>
          )}
        </View>
        <View style={s.topBarRight}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Settings')}
            style={[s.iconBtn, { backgroundColor: theme.bgCard }]}
            activeOpacity={0.7}
          >
            <Ionicons name="settings-outline" size={20} color={theme.text} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleLogout}
            style={[s.iconBtn, { backgroundColor: theme.bgCard }]}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={20} color={theme.red} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Avatar + stats */}
      <View style={s.profileRow}>
        <TouchableOpacity onPress={handleAvatarUpload} style={s.avatarWrap} disabled={uploading}>
          <LinearGradient colors={['#7c3aed', '#3b82f6', '#ec4899']} style={s.avatarRing}>
            <View style={[s.avatarInner, { backgroundColor: theme.primary, borderColor: theme.bg }]}>
              {uploading ? <ActivityIndicator color="#fff" /> :
                user?.avatar_url ? <Image source={{ uri: user.avatar_url }} style={s.avatarImg} /> :
                <AppText style={s.avatarLetter}>{user?.name?.[0]?.toUpperCase()}</AppText>}
            </View>
          </LinearGradient>
          <View style={s.cameraBtn}>
            <Ionicons name="camera" size={11} color="#fff" />
          </View>
        </TouchableOpacity>

        <View style={s.statsRow}>
          <View style={s.stat}>
            <AppText style={[s.statNum, { color: theme.text }]}>{stats.posts}</AppText>
            <AppText style={[s.statLabel, { color: theme.muted }]}>{t('posts')}</AppText>
          </View>
          <TouchableOpacity style={s.stat} onPress={() => openList('connections')}>
            <AppText style={[s.statNum, { color: theme.text }]}>{stats.connections}</AppText>
            <AppText style={[s.statLabel, { color: theme.muted }]}>{t('connections')}</AppText>
          </TouchableOpacity>
          <TouchableOpacity style={s.stat} onPress={() => openList('interests')}>
            <AppText style={[s.statNum, { color: theme.text }]}>{stats.interests}</AppText>
            <AppText style={[s.statLabel, { color: theme.muted }]}>{t('interests')}</AppText>
          </TouchableOpacity>
        </View>
      </View>

      {/* Bio */}
      <View style={s.bioWrap}>
        <View style={s.nameRow}>
          <AppText style={[s.name, { color: theme.text }]}>{user?.name}</AppText>
          {user?.verified_badge && (
            <Ionicons name="checkmark-circle" size={16} color="#3b82f6" />
          )}
          {user?.role ? (
            <View style={s.roleBadge}>
              <Ionicons name="shield-checkmark" size={11} color="#7c3aed" />
              <AppText style={s.roleText}>{user.role}</AppText>
            </View>
          ) : null}
        </View>
        {user?.bio ? <AppText style={[s.bio, { color: theme.muted }]}>{user.bio}</AppText> : null}
        {user?.website ? (
          <TouchableOpacity
            onPress={() => Linking.openURL(user.website.startsWith('http') ? user.website : `https://${user.website}`)}
            style={s.websiteRow}
          >
            <Ionicons name="link-outline" size={13} color={theme.primary} />
            <AppText style={[s.websiteText, { color: theme.primary }]} numberOfLines={1}>
              {user.website.replace(/^https?:\/\//, '')}
            </AppText>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Action buttons */}
      <View style={s.actionRow}>
        <TouchableOpacity style={[s.editBtn, { backgroundColor: theme.bgCard, borderColor: theme.border2 }]} onPress={() => navigation.navigate('EditProfile')}>
          <AppText style={[s.editBtnText, { color: theme.text }]}>{t('edit_profile')}</AppText>
        </TouchableOpacity>
        <TouchableOpacity style={[s.shareBtn, { backgroundColor: theme.bgCard, borderColor: theme.border2 }]} onPress={handleShare}>
          <Ionicons name="share-outline" size={18} color={theme.text} />
        </TouchableOpacity>
        <TouchableOpacity style={[s.shareBtn, { backgroundColor: theme.bgCard, borderColor: theme.border2 }]} onPress={() => setShowQR(true)}>
          <Ionicons name="qr-code-outline" size={18} color={theme.text} />
        </TouchableOpacity>
        <TouchableOpacity style={[s.shareBtn, { backgroundColor: theme.bgCard, borderColor: theme.border2 }]} onPress={() => navigation.navigate('Family')}>
          <Ionicons name="people-outline" size={18} color={theme.text} />
        </TouchableOpacity>
        <TouchableOpacity style={[s.shareBtn, { backgroundColor: theme.bgCard, borderColor: theme.border2 }]} onPress={() => navigation.navigate('PostInsights')}>
          <Ionicons name="bar-chart-outline" size={18} color={theme.text} />
        </TouchableOpacity>
        <TouchableOpacity style={[s.shareBtn, { backgroundColor: theme.bgCard, borderColor: theme.border2 }]} onPress={() => navigation.navigate('ConnectionCRM')}>
          <Ionicons name="people-circle-outline" size={18} color={theme.text} />
        </TouchableOpacity>
      </View>

      {/* Story Highlights */}
      {highlights.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.highlightsRow}>
          <TouchableOpacity style={s.highlightItem} onPress={() => {}}>
            <View style={[s.highlightCircle, s.highlightAdd, { backgroundColor: theme.bgSecondary, borderColor: theme.border2 }]}>
              <Ionicons name="add" size={22} color={theme.primary} />
            </View>
            <AppText style={[s.highlightLabel, { color: theme.text }]}>New</AppText>
          </TouchableOpacity>
          {highlights.map(h => (
            <TouchableOpacity key={h.id} style={s.highlightItem}>
              <LinearGradient colors={['#7c3aed', '#3b82f6']} style={s.highlightRing}>
                <View style={[s.highlightCircle, { backgroundColor: theme.bgSecondary, borderColor: theme.bg }]}>
                  {h.cover_url
                    ? <Image source={{ uri: h.cover_url }} style={s.highlightImg} />
                    : <Ionicons name="star" size={20} color="#fff" />}
                </View>
              </LinearGradient>
              <AppText style={[s.highlightLabel, { color: theme.text }]} numberOfLines={1}>{h.title}</AppText>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Tabs */}
      <View style={[s.tabRow, { borderTopColor: theme.border }]}>
        {TABS.map(t => (
          <TouchableOpacity key={t.key} style={[s.tabBtn, tab === t.key && s.tabBtnActive]} onPress={() => setTab(t.key)}>
            <Ionicons name={tab === t.key ? t.iconActive : t.icon} size={22} color={tab === t.key ? theme.primary : theme.muted} />
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={s.tabBtn} onPress={() => setFeedLayout(l => l === 'grid' ? 'list' : 'grid')}>
          <Ionicons name={feedLayout === 'grid' ? 'list-outline' : 'grid-outline'} size={22} color={theme.muted} />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) return (
    <View style={[s.container, { backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }]}>
      <ActivityIndicator color={theme.primary} size="large" />
    </View>
  );

  const qrValue = `kinscribe://profile/${user?.id}`;

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <Toast visible={toast.visible} type={toast.type} message={toast.message} onHide={hide} />

      {/* Connections / Interests List Modal */}
      <Modal
        visible={listModal.visible}
        transparent
        animationType="slide"
        onRequestClose={() => setListModal(prev => ({ ...prev, visible: false }))}
      >
        <View style={s.modalOverlay}>
          <View style={[s.modalSheet, { backgroundColor: theme.bgCard }]}>
            <View style={[s.modalHeader, { borderBottomColor: theme.border }]}>
              <AppText style={[s.modalTitle, { color: theme.text }]}>
                {listModal.type === 'connections' ? t('connections') : t('interests')}
              </AppText>
              <TouchableOpacity onPress={() => setListModal(prev => ({ ...prev, visible: false }))} style={s.modalClose}>
                <Ionicons name="close" size={22} color={theme.muted} />
              </TouchableOpacity>
            </View>
            {listModal.loading ? (
              <ActivityIndicator color={theme.primary} style={{ marginTop: 40 }} />
            ) : listModal.data.length === 0 ? (
              <View style={s.modalEmpty}>
                <Ionicons name="people-outline" size={40} color={theme.dim} />
                <AppText style={[s.modalEmptyText, { color: theme.muted }]}>No {listModal.type} yet</AppText>
              </View>
            ) : (
              <FlatList
                data={listModal.data}
                keyExtractor={item => String(item.id)}
                contentContainerStyle={{ paddingVertical: 8 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={s.modalUserRow}
                    activeOpacity={0.8}
                    onPress={() => {
                      setListModal(prev => ({ ...prev, visible: false }));
                      navigation.navigate('UserProfile', { userId: item.id });
                    }}
                  >
                    <View style={[s.modalAvatar, { backgroundColor: theme.primary }]}>
                      {item.avatar_url
                        ? <Image source={{ uri: item.avatar_url }} style={s.modalAvatarImg} />
                        : <AppText style={s.modalAvatarLetter}>{item.name?.[0]?.toUpperCase()}</AppText>}
                    </View>
                    <View style={s.modalUserInfo}>
                      <View style={s.modalNameRow}>
                        <AppText style={[s.modalUserName, { color: theme.text }]}>{item.name}</AppText>
                        {item.verified_badge && <Ionicons name="checkmark-circle" size={13} color="#3b82f6" />}
                      </View>
                      <AppText style={[s.modalUserHandle, { color: theme.muted }]}>@{item.username || item.name}</AppText>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={theme.dim} />
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* QR Modal */}
      <Modal visible={showQR} transparent animationType="fade" onRequestClose={() => setShowQR(false)}>
        <TouchableOpacity style={s.qrOverlay} activeOpacity={1} onPress={() => setShowQR(false)}>
          <View style={[s.qrCard, { backgroundColor: theme.bgCard }]}>
            <AppText style={[s.qrTitle, { color: theme.text }]}>{t('scan_profile')}</AppText>
            <AppText style={[s.qrSub, { color: theme.muted }]}>@{user?.username || user?.name}</AppText>
            <View style={s.qrBox}>
              <QRCode value={qrValue} size={200} color="#7c3aed" backgroundColor="#fff" />
            </View>
            <TouchableOpacity style={s.qrClose} onPress={() => setShowQR(false)}>
              <Ionicons name="close-circle" size={32} color={theme.muted} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAll(); }} tintColor={theme.primary} />}
      >
        <Header />
        {currentData.length === 0 ? (
          <View style={s.empty}>
            <Ionicons
              name={tab === 'saved' ? 'bookmark-outline' : tab === 'reels' ? 'film-outline' : tab === 'tagged' ? 'at-outline' : tab === 'liked' ? 'heart-outline' : 'camera-outline'}
              size={48} color={theme.dim}
            />
            <AppText style={[s.emptyTitle, { color: theme.muted }]}>
              {tab === 'saved' ? 'No saved posts' : tab === 'reels' ? 'No reels yet' : tab === 'tagged' ? 'No tagged posts yet' : tab === 'liked' ? 'No liked posts yet' : t('no_posts')}
            </AppText>
            {tab === 'posts' && (
              <TouchableOpacity style={s.createBtn} onPress={() => navigation.navigate('Create')}>
                <AppText style={s.createBtnText}>Create your first post</AppText>
              </TouchableOpacity>
            )}
          </View>
        ) : feedLayout === 'list' ? (
          <View style={{ paddingHorizontal: 1 }}>
            {currentData.map(item => (
              <TouchableOpacity key={item.id} style={[s.listItem, { borderBottomColor: theme.border }]} activeOpacity={0.85}>
                {item.media_url && <Image source={{ uri: item.media_url }} style={s.listImg} resizeMode="cover" />}
                <View style={s.listInfo}>
                  <AppText style={[s.listCaption, { color: theme.text }]} numberOfLines={2}>{item.caption}</AppText>
                  <View style={s.listMeta}>
                    <Ionicons name="heart" size={13} color={colors.muted} />
                    <AppText style={[s.listMetaText, { color: theme.muted }]}>{item.like_count}</AppText>
                    <Ionicons name="chatbubble-outline" size={13} color={colors.muted} />
                    <AppText style={[s.listMetaText, { color: theme.muted }]}>{item.comment_count}</AppText>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={s.grid}>
            {currentData.map(item => renderGridItem(item))}
          </View>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12 },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  username: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5, color: colors.text },
  premiumBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(196,163,90,0.18)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(196,163,90,0.35)' },
  premiumText: { color: '#C4A35A', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  topBarRight: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(196,163,90,0.15)' },
  profileRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 14, gap: 20 },
  avatarWrap: { position: 'relative' },
  avatarRing: { width: 86, height: 86, borderRadius: 43, padding: 3, alignItems: 'center', justifyContent: 'center' },
  avatarInner: { width: 78, height: 78, borderRadius: 39, overflow: 'hidden', backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.bg },
  avatarImg: { width: '100%', height: '100%' },
  avatarLetter: { color: '#fff', fontWeight: '800', fontSize: 30 },
  cameraBtn: { position: 'absolute', bottom: 2, right: 2, width: 22, height: 22, borderRadius: 11, backgroundColor: '#7c3aed', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.bg },
  statsRow: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center' },
  statNum: { fontSize: 20, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 12, color: colors.muted, marginTop: 2 },
  bioWrap: { paddingHorizontal: 16, paddingBottom: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(124,58,237,0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  roleText: { color: '#a78bfa', fontSize: 10, fontWeight: '600' },
  bio: { fontSize: 13, color: colors.muted, lineHeight: 18, marginBottom: 4 },
  websiteRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  websiteText: { fontSize: 13, fontWeight: '600', textDecorationLine: 'underline', flex: 1 },
  actionRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 14 },
  editBtn: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: radius.md, borderWidth: 1 },
  editBtnText: { fontWeight: '700', fontSize: 14 },
  shareBtn: { width: 40, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1 },
  highlightsRow: { paddingHorizontal: 16, paddingBottom: 14, gap: 16 },
  highlightItem: { alignItems: 'center', gap: 4, width: 64 },
  highlightRing: { width: 64, height: 64, borderRadius: 32, padding: 2.5, alignItems: 'center', justifyContent: 'center' },
  highlightCircle: { width: 57, height: 57, borderRadius: 28.5, overflow: 'hidden', backgroundColor: colors.bgSecondary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.bg },
  highlightAdd: { borderWidth: 1.5, borderColor: colors.border2, borderStyle: 'dashed' },
  highlightImg: { width: '100%', height: '100%' },
  highlightLabel: { fontSize: 11, color: colors.text, textAlign: 'center', maxWidth: 64 },
  tabRow: { flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: colors.border },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 11 },
  tabBtnActive: { borderBottomWidth: 1.5, borderBottomColor: colors.primary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 1.5 },
  gridItem: { width: GRID, height: GRID, position: 'relative' },
  gridImg: { width: '100%', height: '100%' },
  gridText: { backgroundColor: colors.bgSecondary, alignItems: 'center', justifyContent: 'center', padding: 8 },
  gridCaption: { color: colors.text, fontSize: 11, textAlign: 'center' },
  carouselBadge: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 4, padding: 3 },
  videoBadge: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 4, padding: 3 },
  gridLikes: { position: 'absolute', bottom: 4, left: 4, flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 10 },
  gridLikesText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '75%', minHeight: 300 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 0.5 },
  modalTitle: { fontSize: 17, fontWeight: '800' },
  modalClose: { padding: 4 },
  modalEmpty: { alignItems: 'center', paddingTop: 50, gap: 12 },
  modalEmptyText: { fontSize: 15 },
  modalUserRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  modalAvatar: { width: 46, height: 46, borderRadius: 23, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  modalAvatarImg: { width: '100%', height: '100%' },
  modalAvatarLetter: { color: '#fff', fontWeight: '800', fontSize: 18 },
  modalUserInfo: { flex: 1 },
  modalNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  modalUserName: { fontSize: 15, fontWeight: '700' },
  modalUserHandle: { fontSize: 13, marginTop: 1 },
  qrOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center' },
  qrCard: { borderRadius: 24, padding: 28, alignItems: 'center', gap: 8, width: 280 },
  qrTitle: { fontSize: 18, fontWeight: '800' },
  qrSub: { fontSize: 13, marginBottom: 8 },
  qrBox: { backgroundColor: '#fff', padding: 16, borderRadius: 16 },
  qrClose: { marginTop: 12 },
  empty: { alignItems: 'center', marginTop: 60, gap: 12, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 16, color: colors.muted },
  createBtn: { backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: radius.md },
  createBtnText: { color: '#fff', fontWeight: '700' },
  listItem: { flexDirection: 'row', gap: 12, padding: 12, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  listImg: { width: 72, height: 72, borderRadius: 8 },
  listInfo: { flex: 1, justifyContent: 'center' },
  listCaption: { fontSize: 14, color: colors.text, lineHeight: 19 },
  listMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  listMetaText: { fontSize: 12, color: colors.muted },
});
