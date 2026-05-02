import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, FlatList, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, Alert, RefreshControl,
  ScrollView, Dimensions, Share, Modal, Linking, TextInput,
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
import VideoPlayer from '../components/VideoPlayer';
import ProfileGroupsSection from '../components/ProfileGroupsSection';

const { width } = Dimensions.get('window');
const GRID = (width - 3) / 3;

const TABS = [
  { key: 'posts', icon: 'grid-outline', iconActive: 'grid' },
  { key: 'reels', icon: 'film-outline', iconActive: 'film' },
  { key: 'family', icon: 'people-outline', iconActive: 'people' },
  { key: 'saved', icon: 'bookmark-outline', iconActive: 'bookmark' },
  { key: 'archived', icon: 'archive-outline', iconActive: 'archive' },
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
  const [stats, setStats] = useState({ posts: 0, followers: 0, following: 0 });
  const [listModal, setListModal] = useState({ visible: false, type: null, data: [], loading: false });
  const [myStories, setMyStories] = useState([]);
  const [archivedStories, setArchivedStories] = useState([]);
  const [archivedViewer, setArchivedViewer] = useState(null);
  const [family, setFamily] = useState(null);
  const [myGroups, setMyGroups] = useState({ admin_groups: [], member_groups: [] });
  const [familyPostsGroup, setFamilyPostsGroup] = useState(null); // selected group for family tab
  const [familyPosts, setFamilyPosts] = useState([]); // stories for selected group
  const [familyPostsLoading, setFamilyPostsLoading] = useState(false);
  const [addHighlight, setAddHighlight] = useState({ visible: false, title: '', selected: [], saving: false });
  const [viewHighlight, setViewHighlight] = useState({ visible: false, highlight: null, index: 0 });




  const fetchAll = useCallback(async () => {
    if (!user) return;
    try {
      const [postsRes, savedRes, highlightsRes, taggedRes, likedRes, storiesRes, archivedRes] = await Promise.all([
        api.get(`/posts/user/${user.id}`).catch(() => ({ data: { posts: [] } })),
        api.get('/pstories/saved').catch(() => ({ data: { posts: [] } })),
        api.get(`/pstories/highlights?user_id=${user.id}`).catch(() => ({ data: { highlights: [] } })),
        api.get(`/posts/tagged/${user.id}`).catch(() => ({ data: { posts: [] } })),
        api.get(`/posts/liked/${user.id}`).catch(() => ({ data: { posts: [] } })),
        api.get('/pstories/my').catch(() => ({ data: { stories: [] } })),
        api.get('/stories/archived').catch(() => ({ data: { stories: [] } })),
      ]);
      const allPosts = postsRes.data.posts || [];
      setPosts(allPosts);
      setSavedPosts(savedRes.data.posts || []);
      setTaggedPosts(taggedRes.data.posts || []);
      setLikedPosts(likedRes.data.posts || []);
      setHighlights(highlightsRes.data.highlights || []);
      setMyStories(storiesRes.data.stories || []);
      setArchivedStories(archivedRes.data.stories || []);
      if (user?.family_id) {
        api.get('/family/my-family').then(r => setFamily(r.data.family)).catch(() => {});
      }
      api.get(`/family/user/${user.id}/groups`)
        .then(r => {
          const groups = { admin_groups: r.data.admin_groups || [], member_groups: r.data.member_groups || [] };
          setMyGroups(groups);
          // Auto-select first group for family tab
          const allGroups = [...(r.data.admin_groups || []), ...(r.data.member_groups || [])];
          if (allGroups.length > 0) setFamilyPostsGroup(prev => prev || allGroups[0]);
        })
        .catch(() => {});
      setStats({
        posts: allPosts.length,
        followers: user.follower_count || 0,
        following: user.following_count || 0,
      });
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useFocusEffect(useCallback(() => { 
    fetchAll(); 
  }, [fetchAll]));

  const fetchFamilyPosts = useCallback(async (group) => {
    if (!group || !user) return;
    setFamilyPostsLoading(true);
    try {
      const { data } = await api.get(`/stories/user/${user.id}/family/${group.id}`);
      setFamilyPosts(data.stories || []);
    } catch { setFamilyPosts([]); }
    finally { setFamilyPostsLoading(false); }
  }, [user]);

  useEffect(() => {
    if (tab === 'family' && familyPostsGroup) fetchFamilyPosts(familyPostsGroup);
  }, [tab, familyPostsGroup, fetchFamilyPosts]);

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
      const endpoint = type === 'followers'
        ? `/connections/${user.id}/followers`
        : `/connections/${user.id}/following`;
      const key = type === 'followers' ? 'followers' : 'following';
      const res = await api.get(endpoint);
      setListModal(prev => ({ ...prev, data: res.data[key] || [], loading: false }));
    } catch {
      setListModal(prev => ({ ...prev, loading: false }));
    }
  };

  const openAddHighlight = () => setAddHighlight({ visible: true, title: '', selected: [], saving: false });

  const toggleStorySelect = (story) => {
    setAddHighlight(prev => {
      const exists = prev.selected.find(s => s.id === story.id);
      return {
        ...prev,
        selected: exists ? prev.selected.filter(s => s.id !== story.id) : [...prev.selected, story],
      };
    });
  };

  const saveHighlight = async () => {
    if (!addHighlight.title.trim()) return error('Give your highlight a title');
    if (addHighlight.selected.length === 0) return error('Select at least one story');
    setAddHighlight(prev => ({ ...prev, saving: true }));
    try {
      const items = addHighlight.selected.map(s => ({
        story_id: s.id, media_url: s.media_url, media_type: s.media_type || 'image',
      }));
      const cover_url = addHighlight.selected[0]?.media_url || null;
      await api.post('/pstories/highlights', { title: addHighlight.title.trim(), cover_url, items });
      setAddHighlight({ visible: false, title: '', selected: [], saving: false });
      success('Highlight created');
      fetchAll();
    } catch {
      error('Failed to create highlight');
      setAddHighlight(prev => ({ ...prev, saving: false }));
    }
  };

  const deleteHighlight = (h) => {
    Alert.alert('Delete Highlight', `Delete "${h.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/pstories/highlights/${h.id}`);
          setHighlights(prev => prev.filter(x => x.id !== h.id));
          success('Highlight deleted');
        } catch { error('Failed to delete'); }
      }},
    ]);
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

  const getVideoThumbnail = (videoUrl) => {
    if (!videoUrl) return null;
    // Cloudinary video thumbnail: replace video/upload/ with video/upload/so_0/ to get first frame
    if (videoUrl.includes('cloudinary.com')) {
      return videoUrl.replace('/video/upload/', '/video/upload/so_0,f_jpg/');
    }
    return videoUrl;
  };

  const renderGridItem = (item, isArchived = false) => {
    const isVideo = item.media_type === 'video';
    const thumbnailUrl = isVideo ? getVideoThumbnail(item.media_url) : item.media_url;
    
    return (
      <TouchableOpacity key={item.id} style={s.gridItem} activeOpacity={0.85}
        onPress={() => navigation.navigate('PostDetail', { postId: item.id })}>
        {thumbnailUrl ? (
          <Image source={{ uri: thumbnailUrl }} style={s.gridImg} resizeMode="cover" />
        ) : (
          <View style={[s.gridImg, s.gridText, { backgroundColor: theme.bgSecondary }]}>
            <AppText style={[s.gridCaption, { color: theme.text }]} numberOfLines={4}>{item.caption}</AppText>
          </View>
        )}
        {isVideo && (
          <View style={s.videoBadge}>
            <Ionicons name="play" size={14} color="#fff" />
          </View>
        )}
        {item.media_type === 'carousel' && (
          <View style={s.carouselBadge}>
            <Ionicons name="copy-outline" size={12} color="#fff" />
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
  };

  const currentData =
    tab === 'saved' ? savedPosts :
    tab === 'tagged' ? taggedPosts :
    tab === 'liked' ? likedPosts :
    tab === 'archived' ? [] : // handled separately
    tab === 'family' ? [] : // handled separately
    posts.filter(p => tab === 'reels' ? p.media_type === 'video' : true);

  const Header = () => (
    <View>
      {/* Greenish cover gradient - like stories section */}
      <LinearGradient
        colors={['#1e1040', '#7C3AED', '#3B82F6', '#3b82f6']}
        style={s.coverBg}
      />

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
          <TouchableOpacity style={s.stat} onPress={() => openList('followers')}>
            <AppText style={[s.statNum, { color: theme.text }]}>{stats.followers}</AppText>
            <AppText style={[s.statLabel, { color: theme.muted }]}>Followers</AppText>
          </TouchableOpacity>
          <TouchableOpacity style={s.stat} onPress={() => openList('following')}>
            <AppText style={[s.statNum, { color: theme.text }]}>{stats.following}</AppText>
            <AppText style={[s.statLabel, { color: theme.muted }]}>Following</AppText>
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
        {/* Location / joined */}
        <View style={s.metaRow}>
          {user?.created_at && (
            <View style={s.metaItem}>
              <Ionicons name="calendar-outline" size={12} color={theme.dim} />
              <AppText style={[s.metaText, { color: theme.dim }]}>
                Joined {new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </AppText>
            </View>
          )}
          <View style={s.metaItem}>
            <Ionicons
              name={user?.is_private ? 'lock-closed-outline' : 'earth-outline'}
              size={12} color={theme.dim}
            />
            <AppText style={[s.metaText, { color: theme.dim }]}>
              {user?.is_private ? 'Private' : 'Public'}
            </AppText>
          </View>
          {user?.account_type && user.account_type !== 'personal' && (
            <View style={s.metaItem}>
              <Ionicons name="briefcase-outline" size={12} color={theme.gold} />
              <AppText style={[s.metaText, { color: theme.gold, textTransform: 'capitalize' }]}>{user.account_type}</AppText>
            </View>
          )}
        </View>
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
        <TouchableOpacity
          style={[s.editBtn, { backgroundColor: theme.bgCard, borderColor: theme.border2 }]}
          onPress={() => navigation.navigate('EditProfile')}
          activeOpacity={0.75}
        >
          <Ionicons name="pencil-outline" size={15} color={theme.text} />
          <AppText style={[s.editBtnText, { color: theme.text }]}>{t('edit_profile')}</AppText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.editBtn, { backgroundColor: theme.bgCard, borderColor: theme.border2 }]}
          onPress={handleShare}
          activeOpacity={0.75}
        >
          <Ionicons name="share-outline" size={15} color={theme.text} />
          <AppText style={[s.editBtnText, { color: theme.text }]}>Share</AppText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.editBtn, { backgroundColor: theme.bgCard, borderColor: theme.border2 }]}
          onPress={() => setShowQR(true)}
          activeOpacity={0.75}
        >
          <Ionicons name="qr-code-outline" size={15} color={theme.text} />
          <AppText style={[s.editBtnText, { color: theme.text }]}>QR</AppText>
        </TouchableOpacity>
      </View>
      <View style={[s.actionRow, { marginTop: -6 }]}>
        <TouchableOpacity
          style={[s.editBtn, { backgroundColor: theme.bgCard, borderColor: theme.border2 }]}
          onPress={() => navigation.navigate('FamilyPublic', { familyId: user?.family_id })}
          activeOpacity={0.75}
        >
          <Ionicons name="people-outline" size={15} color={theme.gold} />
          <AppText style={[s.editBtnText, { color: theme.gold }]}>Family</AppText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.editBtn, { backgroundColor: theme.bgCard, borderColor: theme.border2 }]}
          onPress={() => navigation.navigate('PostInsights')}
          activeOpacity={0.75}
        >
          <Ionicons name="bar-chart-outline" size={15} color={theme.primary} />
          <AppText style={[s.editBtnText, { color: theme.primary }]}>Insights</AppText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.editBtn, { backgroundColor: theme.bgCard, borderColor: theme.border2 }]}
          onPress={() => navigation.navigate('ConnectionCRM')}
          activeOpacity={0.75}
        >
          <Ionicons name="people-circle-outline" size={15} color={theme.brown} />
          <AppText style={[s.editBtnText, { color: theme.brown }]}>CRM</AppText>
        </TouchableOpacity>
      </View>

      {/* Family card */}
      {family && (
        <TouchableOpacity
          style={[s.familyCard, { backgroundColor: theme.bgCard, borderColor: theme.borderFamily }]}
          onPress={() => navigation.navigate('FamilyPublic', { familyId: family.id })}
          activeOpacity={0.85}
        >
          <LinearGradient colors={['#7C3AED', '#F59E0B']} style={s.familyIconWrap}>
            <Ionicons name="people" size={18} color="#fff" />
          </LinearGradient>
          <View style={s.familyCardInfo}>
            <AppText style={[s.familyCardName, { color: theme.text }]}>{family.name}</AppText>
            <AppText style={[s.familyCardSub, { color: theme.muted }]}>{family.member_count} members · Family</AppText>
          </View>
          <Ionicons name="chevron-forward" size={16} color={theme.dim} />
        </TouchableOpacity>
      )}

      {/* Story Highlights */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.highlightsRow}>
        {/* Always-visible New button */}
        <TouchableOpacity style={s.highlightItem} onPress={openAddHighlight} activeOpacity={0.8}>
          <View style={[s.highlightCircle, s.highlightAdd, { backgroundColor: theme.bgSecondary, borderColor: theme.border2 }]}>
            <Ionicons name="add" size={24} color={theme.primary} />
          </View>
          <AppText style={[s.highlightLabel, { color: theme.muted }]}>New</AppText>
        </TouchableOpacity>
        {highlights.map(h => (
          <TouchableOpacity
            key={h.id}
            style={s.highlightItem}
            activeOpacity={0.8}
            onPress={() => setViewHighlight({ visible: true, highlight: h, index: 0 })}
            onLongPress={() => deleteHighlight(h)}
          >
            <LinearGradient colors={['#F59E0B', '#3B82F6']} style={s.highlightRing}>
              <View style={[s.highlightCircle, { borderColor: theme.bg }]}>
                {h.cover_url
                  ? <Image source={{ uri: h.cover_url }} style={s.highlightImg} />
                  : <Ionicons name="star" size={20} color="#fff" />}
              </View>
            </LinearGradient>
            <AppText style={[s.highlightLabel, { color: theme.text }]} numberOfLines={1}>{h.title}</AppText>
          </TouchableOpacity>
        ))}
      </ScrollView>

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
                {listModal.type === 'followers' ? 'Followers' : 'Following'}
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

      {/* Add Highlight Modal */}
      <Modal
        visible={addHighlight.visible}
        transparent
        animationType="slide"
        onRequestClose={() => setAddHighlight(prev => ({ ...prev, visible: false }))}
      >
        <View style={s.modalOverlay}>
          <View style={[s.modalSheet, { backgroundColor: theme.bgCard, maxHeight: '85%' }]}>
            <View style={[s.modalHeader, { borderBottomColor: theme.border }]}>
              <AppText style={[s.modalTitle, { color: theme.text }]}>New Highlight</AppText>
              <TouchableOpacity onPress={() => setAddHighlight(prev => ({ ...prev, visible: false }))} style={s.modalClose}>
                <Ionicons name="close" size={22} color={theme.muted} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              {/* Title input */}
              <View style={[s.hlInput, { backgroundColor: theme.bgSecondary, borderColor: theme.border2, marginBottom: 16 }]}>
                <TextInput
                  value={addHighlight.title}
                  onChangeText={t => setAddHighlight(prev => ({ ...prev, title: t }))}
                  placeholder="Highlight name (e.g. Summer 2024)"
                  placeholderTextColor={theme.dim}
                  style={[s.hlInputText, { color: theme.text }]}
                  maxLength={30}
                />
              </View>
              {/* Story picker */}
              <AppText style={[s.hlPickerLabel, { color: theme.muted, marginBottom: 10 }]}>Select stories to include</AppText>
              {myStories.length === 0 ? (
                <View style={s.hlEmpty}>
                  <Ionicons name="images-outline" size={36} color={theme.dim} />
                  <AppText style={[{ color: theme.muted, fontSize: 13, textAlign: 'center' }]}>No active stories. Post a story first.</AppText>
                </View>
              ) : (
                <View style={s.hlGrid}>
                  {myStories.map(story => {
                    const selected = addHighlight.selected.find(s => s.id === story.id);
                    return (
                      <TouchableOpacity
                        key={story.id}
                        style={[s.hlStoryThumb, selected && s.hlStorySelected]}
                        onPress={() => toggleStorySelect(story)}
                        activeOpacity={0.8}
                      >
                        {story.media_url
                          ? <Image source={{ uri: story.media_url }} style={s.hlThumbImg} resizeMode="cover" />
                          : <View style={[s.hlThumbImg, { backgroundColor: theme.bgElevated, alignItems: 'center', justifyContent: 'center' }]}>
                              <Ionicons name="text" size={20} color={theme.muted} />
                            </View>}
                        {selected && (
                          <View style={s.hlCheckOverlay}>
                            <Ionicons name="checkmark-circle" size={22} color="#fff" />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </ScrollView>
            <View style={[s.hlFooter, { borderTopColor: theme.border, backgroundColor: theme.bgCard }]}>
              <TouchableOpacity
                style={[s.hlSaveBtn, { backgroundColor: theme.primary, opacity: addHighlight.saving ? 0.7 : 1 }]}
                onPress={saveHighlight}
                disabled={addHighlight.saving}
                activeOpacity={0.8}
              >
                {addHighlight.saving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <AppText style={s.hlSaveBtnText}>Add Highlight</AppText>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* View Highlight Modal */}
      <Modal
        visible={viewHighlight.visible}
        transparent={false}
        animationType="fade"
        onRequestClose={() => setViewHighlight(prev => ({ ...prev, visible: false }))}
      >
        <View style={[s.hlViewer, { backgroundColor: '#000' }]}>
          {viewHighlight.highlight?.items?.length > 0 ? (
            <>
              {/* Progress bars */}
              <View style={s.hlProgressRow}>
                {viewHighlight.highlight.items.map((_, i) => (
                  <View key={i} style={[s.hlProgressBar, { backgroundColor: i <= viewHighlight.index ? '#fff' : 'rgba(255,255,255,0.3)' }]} />
                ))}
              </View>
              {/* Media */}
              {viewHighlight.highlight.items[viewHighlight.index]?.media_type === 'video' ? (
                <VideoPlayer
                  uri={viewHighlight.highlight.items[viewHighlight.index]?.media_url}
                  isVisible={viewHighlight.visible}
                  feedMode={false}
                  authorName={user?.name}
                  authorAvatar={user?.avatar_url}
                />
              ) : (
                <Image
                  source={{ uri: viewHighlight.highlight.items[viewHighlight.index]?.media_url }}
                  style={s.hlViewerImg}
                  resizeMode="contain"
                />
              )}
              {/* Title */}
              <View style={s.hlViewerHeader}>
                <View style={[s.hlViewerAvatar, { backgroundColor: theme.primary }]}>
                  {user?.avatar_url
                    ? <Image source={{ uri: user.avatar_url }} style={{ width: '100%', height: '100%' }} />
                    : <AppText style={{ color: '#fff', fontWeight: '800' }}>{user?.name?.[0]}</AppText>}
                </View>
                <View>
                  <AppText style={s.hlViewerName}>{user?.name}</AppText>
                  <AppText style={s.hlViewerTitle}>{viewHighlight.highlight.title}</AppText>
                </View>
              </View>
              {/* Tap zones: left = prev, right = next */}
              <View style={s.hlTapRow}>
                <TouchableOpacity
                  style={{ flex: 1 }}
                  onPress={() => setViewHighlight(prev => ({ ...prev, index: Math.max(0, prev.index - 1) }))}
                />
                <TouchableOpacity
                  style={{ flex: 1 }}
                  onPress={() => {
                    const total = viewHighlight.highlight.items.length;
                    if (viewHighlight.index < total - 1) {
                      setViewHighlight(prev => ({ ...prev, index: prev.index + 1 }));
                    } else {
                      setViewHighlight(prev => ({ ...prev, visible: false }));
                    }
                  }}
                />
              </View>
            </>
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <AppText style={{ color: '#fff' }}>No items in this highlight</AppText>
            </View>
          )}
          {/* Close */}
          <TouchableOpacity
            style={s.hlViewerClose}
            onPress={() => setViewHighlight(prev => ({ ...prev, visible: false }))}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          {/* Delete button */}
          <TouchableOpacity
            style={s.hlViewerDelete}
            onPress={() => {
              setViewHighlight(prev => ({ ...prev, visible: false }));
              setTimeout(() => deleteHighlight(viewHighlight.highlight), 300);
            }}
          >
            <Ionicons name="trash-outline" size={22} color="#ff6b6b" />
          </TouchableOpacity>
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
        {/* Groups (admin + member) — rendered outside Header to preserve open/close state */}
        <ProfileGroupsSection
          adminGroups={myGroups.admin_groups}
          memberGroups={myGroups.member_groups}
          onGroupPress={() => navigation.navigate('Family')}
        />

        {/* ── FAMILY TAB: group switcher + stories ── */}
        {tab === 'family' ? (
          <View style={{ flex: 1 }}>
            {/* Group switcher chips */}
            {(() => {
              const allGroups = [...myGroups.admin_groups, ...myGroups.member_groups];
              if (allGroups.length === 0) return (
                <View style={s.empty}>
                  <Ionicons name="people-outline" size={48} color={theme.dim} />
                  <AppText style={[s.emptyTitle, { color: theme.muted }]}>Not in any family group yet</AppText>
                  <TouchableOpacity style={s.createBtn} onPress={() => navigation.navigate('FamilyGate')}>
                    <AppText style={s.createBtnText}>Join or Create a Family</AppText>
                  </TouchableOpacity>
                </View>
              );
              return (
                <>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.groupChipsRow}>
                    {allGroups.map(g => {
                      const active = familyPostsGroup?.id === g.id;
                      return (
                        <TouchableOpacity
                          key={g.id}
                          style={[s.groupChip, { borderColor: active ? '#10b981' : theme.border2, backgroundColor: active ? 'rgba(16,185,129,0.12)' : theme.bgCard }]}
                          onPress={() => setFamilyPostsGroup(g)}
                        >
                          <Ionicons name="people" size={13} color={active ? '#10b981' : theme.muted} />
                          <AppText style={[s.groupChipText, { color: active ? '#10b981' : theme.muted }]}>{g.name}</AppText>
                          {(myGroups.admin_groups.find(ag => ag.id === g.id)) && (
                            <View style={s.groupChipAdminDot} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  {familyPostsLoading ? (
                    <ActivityIndicator color={theme.primary} style={{ marginTop: 40 }} />
                  ) : familyPosts.length === 0 ? (
                    <View style={s.empty}>
                      <Ionicons name="library-outline" size={48} color={theme.dim} />
                      <AppText style={[s.emptyTitle, { color: theme.muted }]}>
                        No posts in {familyPostsGroup?.name || 'this group'} yet
                      </AppText>
                      <TouchableOpacity style={s.createBtn} onPress={() => navigation.navigate('Create', { initialMode: 'family' })}>
                        <AppText style={s.createBtnText}>Post to this group</AppText>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={s.grid}>
                      {familyPosts.map(item => (
                        <TouchableOpacity
                          key={item.id}
                          style={s.gridItem}
                          activeOpacity={0.85}
                          onPress={() => navigation.navigate('Family')}
                        >
                          {item.media_url ? (
                            <Image 
                              source={{ uri: item.media_type === 'video' ? getVideoThumbnail(item.media_url) : item.media_url }} 
                              style={s.gridImg} 
                              resizeMode="cover" 
                            />
                          ) : (
                            <View style={[s.gridImg, s.gridText, { backgroundColor: theme.bgSecondary }]}>
                              <AppText style={[s.gridCaption, { color: theme.text }]} numberOfLines={3}>{item.title}</AppText>
                            </View>
                          )}
                          {item.media_type === 'video' && (
                            <View style={s.videoBadge}>
                              <Ionicons name="play" size={14} color="#fff" />
                            </View>
                          )}
                          <View style={s.familyStoryBadge}>
                            <Ionicons name="people" size={9} color="#10b981" />
                          </View>
                          {item.like_count > 0 && (
                            <View style={s.gridLikes}>
                              <Ionicons name="heart" size={10} color="#fff" />
                              <AppText style={s.gridLikesText}>{item.like_count}</AppText>
                            </View>
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </>
              );
            })()}
          </View>
        ) : tab === 'archived' ? (
          <View style={{ flex: 1 }}>
            {archivedStories.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="archive-outline" size={48} color={theme.dim} />
                <AppText style={[s.emptyTitle, { color: theme.muted }]}>No archived stories</AppText>
                <AppText style={[s.emptySub, { color: theme.dim, fontSize: 13, textAlign: 'center', marginTop: 4 }]}>
                  Archive stories to hide them from your profile{`\n`}while keeping them saved privately.
                </AppText>
              </View>
            ) : (
              <View style={s.grid}>
                {archivedStories.map(item => (
                  <TouchableOpacity
                    key={item.id}
                    style={s.gridItem}
                    activeOpacity={0.85}
                    onPress={() => setArchivedViewer(item)}
                  >
                    {item.media_url ? (
                      <Image 
                        source={{ uri: item.media_type === 'video' ? getVideoThumbnail(item.media_url) : item.media_url }} 
                        style={s.gridImg} 
                        resizeMode="cover" 
                      />
                    ) : (
                      <View style={[s.gridImg, s.gridText, { backgroundColor: theme.bgSecondary }]}>
                        <AppText style={[s.gridCaption, { color: theme.text }]} numberOfLines={3}>{item.title}</AppText>
                      </View>
                    )}
                    {item.media_type === 'video' && (
                      <View style={s.videoBadge}>
                        <Ionicons name="play" size={14} color="#fff" />
                      </View>
                    )}
                    <View style={s.archivedBadge}>
                      <Ionicons name="archive" size={9} color="#f59e0b" />
                    </View>
                    {item.like_count > 0 && (
                      <View style={s.gridLikes}>
                        <Ionicons name="heart" size={10} color="#fff" />
                        <AppText style={s.gridLikesText}>{item.like_count}</AppText>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        ) : currentData.length === 0 ? (
          <View style={s.empty}>
            <Ionicons
              name={tab === 'saved' ? 'bookmark-outline' : tab === 'reels' ? 'film-outline' : tab === 'tagged' ? 'at-outline' : tab === 'liked' ? 'heart-outline' : tab === 'archived' ? 'archive-outline' : 'camera-outline'}
              size={48} color={theme.dim}
            />
            <AppText style={[s.emptyTitle, { color: theme.muted }]}>
              {tab === 'saved' ? 'No saved posts' : tab === 'reels' ? 'No reels yet' : tab === 'tagged' ? 'No tagged posts yet' : tab === 'liked' ? 'No liked posts yet' : tab === 'archived' ? 'No archived stories' : t('no_posts')}
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
              <TouchableOpacity key={item.id} style={[s.listItem, { borderBottomColor: theme.border }]} activeOpacity={0.85}
                onPress={() => navigation.navigate('PostDetail', { postId: item.id })}>
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
            {currentData.map(item => renderGridItem(item, false))}
          </View>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Archived Story Viewer Modal */}
      <Modal visible={!!archivedViewer} transparent animationType="fade" onRequestClose={() => setArchivedViewer(null)}>
        <View style={s.archivedViewerOverlay}>
          <TouchableOpacity style={s.archivedViewerClose} onPress={() => setArchivedViewer(null)}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          {archivedViewer?.media_url && archivedViewer?.media_type === 'video' ? (
            <VideoPlayer
              uri={archivedViewer.media_url}
              isVisible={!!archivedViewer}
              feedMode={false}
              liked={archivedViewer.liked_by_me}
              likeCount={archivedViewer.like_count}
              onComment={() => {}}
              commentCount={archivedViewer.comment_count}
              authorName={user?.name}
              authorAvatar={user?.avatar_url}
              caption={archivedViewer.content}
            />
          ) : archivedViewer?.media_url ? (
            <Image source={{ uri: archivedViewer.media_url }} style={s.archivedViewerImg} resizeMode="contain" />
          ) : null}
          <View style={s.archivedViewerInfo}>
            <AppText style={s.archivedViewerTitle}>{archivedViewer?.title}</AppText>
            {archivedViewer?.content && <AppText style={s.archivedViewerContent}>{archivedViewer.content}</AppText>}
            <TouchableOpacity
              style={[s.unarchiveBtn, { opacity: 0.9 }]}
              onPress={async () => {
                try {
                  await api.post(`/stories/${archivedViewer.id}/archive`);
                  setArchivedStories(prev => prev.filter(s => s.id !== archivedViewer.id));
                  setArchivedViewer(null);
                  success('Story unarchived - check Family feed');
                  // Refresh to update counts
                  setTimeout(() => fetchAll(), 500);
                } catch {
                  error('Failed to unarchive');
                }
              }}
            >
              <Ionicons name="archive-outline" size={18} color="#fff" />
              <AppText style={s.unarchiveBtnText}>Unarchive Story</AppText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  coverBg: { position: 'absolute', top: 0, left: 0, right: 0, height: 180 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12 },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  username: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5, color: colors.text },
  premiumBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(196,163,90,0.18)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(196,163,90,0.35)' },
  premiumText: { color: '#F59E0B', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
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
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 5, marginBottom: 2 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11, fontWeight: '500' },
  familyCard: { marginHorizontal: 16, marginBottom: 10, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12 },
  familyIconWrap: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  familyCardInfo: { flex: 1 },
  familyCardName: { fontSize: 14, fontWeight: '700' },
  familyCardSub: { fontSize: 12, marginTop: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(124,58,237,0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  roleText: { color: '#a78bfa', fontSize: 10, fontWeight: '600' },
  bio: { fontSize: 13, color: colors.muted, lineHeight: 18, marginBottom: 4 },
  websiteRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  websiteText: { fontSize: 13, fontWeight: '600', textDecorationLine: 'underline', flex: 1 },
  actionRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  editBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: radius.md, borderWidth: 1 },
  editBtnText: { fontWeight: '700', fontSize: 13 },
  highlightsRow: { paddingHorizontal: 16, paddingBottom: 14, gap: 16 },
  highlightItem: { alignItems: 'center', gap: 4, width: 68 },
  highlightRing: { width: 68, height: 68, borderRadius: 34, padding: 2.5, alignItems: 'center', justifyContent: 'center' },
  highlightCircle: { width: 61, height: 61, borderRadius: 30.5, overflow: 'hidden', backgroundColor: colors.bgSecondary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.bg },
  highlightAdd: { borderWidth: 1.5, borderColor: colors.border2, borderStyle: 'dashed', width: 68, height: 68, borderRadius: 34 },
  highlightImg: { width: '100%', height: '100%' },
  highlightLabel: { fontSize: 11, color: colors.text, textAlign: 'center', maxWidth: 68 },
  // Add highlight modal
  hlInput: { borderRadius: radius.md, borderWidth: 1, paddingHorizontal: 14, height: 48, justifyContent: 'center' },
  hlInputText: { fontSize: 15 },
  hlPickerLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  hlEmpty: { alignItems: 'center', gap: 10, paddingVertical: 24 },
  hlGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  hlStoryThumb: { width: (width - 56) / 4, height: (width - 56) / 4, borderRadius: 8, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  hlStorySelected: { borderColor: colors.primary },
  hlThumbImg: { width: '100%', height: '100%' },
  hlCheckOverlay: { position: 'absolute', top: 4, right: 4 },
  hlFooter: { padding: 16, borderTopWidth: 0.5 },
  hlSaveBtn: { borderRadius: radius.full, paddingVertical: 14, alignItems: 'center' },
  hlSaveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  // Viewer
  hlViewer: { flex: 1 },
  hlProgressRow: { flexDirection: 'row', gap: 4, position: 'absolute', top: 52, left: 12, right: 12, zIndex: 10 },
  hlProgressBar: { flex: 1, height: 2.5, borderRadius: 2 },
  hlViewerImg: { width, height: '100%' },
  hlViewerHeader: { position: 'absolute', top: 64, left: 16, flexDirection: 'row', alignItems: 'center', gap: 10, zIndex: 10 },
  hlViewerAvatar: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  hlViewerName: { color: '#fff', fontWeight: '700', fontSize: 14 },
  hlViewerTitle: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  hlTapRow: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row', zIndex: 5 },
  hlViewerClose: { position: 'absolute', top: 52, right: 16, zIndex: 20, padding: 4 },
  hlViewerDelete: { position: 'absolute', bottom: 48, right: 20, zIndex: 20, backgroundColor: 'rgba(0,0,0,0.5)', padding: 10, borderRadius: 20 },
  tabRow: { flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: colors.border },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 11 },
  tabBtnActive: { borderBottomWidth: 1.5, borderBottomColor: colors.primary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 1.5 },
  gridItem: { width: GRID, height: GRID, position: 'relative', overflow: 'hidden' },
  gridImg: { width: '100%', height: '100%', backgroundColor: '#000' },
  gridText: { backgroundColor: colors.bgSecondary, alignItems: 'center', justifyContent: 'center', padding: 8 },
  gridCaption: { color: colors.text, fontSize: 11, textAlign: 'center' },
  carouselBadge: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 4, padding: 3 },
  videoBadge: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 12, padding: 5, width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
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
  // Family tab
  groupChipsRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  groupChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5 },
  groupChipText: { fontSize: 13, fontWeight: '700' },
  groupChipAdminDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#f59e0b' },
  familyStoryBadge: { position: 'absolute', top: 5, right: 5, backgroundColor: 'rgba(16,185,129,0.85)', borderRadius: 6, padding: 3 },
  archivedBadge: { position: 'absolute', top: 5, right: 5, backgroundColor: 'rgba(245,158,11,0.85)', borderRadius: 6, padding: 3 },
  emptySub: { fontSize: 13, color: colors.dim, textAlign: 'center', marginTop: 4, lineHeight: 19 },
  archivedViewerOverlay: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  archivedViewerClose: { position: 'absolute', top: 52, right: 16, zIndex: 10, padding: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
  archivedViewerImg: { width: '100%', height: '70%' },
  archivedViewerInfo: { padding: 20 },
  archivedViewerTitle: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 8 },
  archivedViewerContent: { fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 20, marginBottom: 16 },
  unarchiveBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(245,158,11,0.9)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20, alignSelf: 'flex-start' },
  unarchiveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
