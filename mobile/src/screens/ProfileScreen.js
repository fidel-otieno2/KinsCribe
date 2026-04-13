import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, Alert, RefreshControl,
  ScrollView, Dimensions, Share,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../api/axios';
import { colors, radius } from '../theme';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');
const GRID = (width - 3) / 3;

const TABS = [
  { key: 'posts', icon: 'grid-outline', iconActive: 'grid' },
  { key: 'reels', icon: 'film-outline', iconActive: 'film' },
  { key: 'saved', icon: 'bookmark-outline', iconActive: 'bookmark' },
];

export default function ProfileScreen({ navigation }) {
  const { user, refreshUser, logout } = useAuth();
  const { theme } = useTheme();
  const [posts, setPosts] = useState([]);
  const [savedPosts, setSavedPosts] = useState([]);
  const [highlights, setHighlights] = useState([]);
  const [tab, setTab] = useState('posts');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [stats, setStats] = useState({ posts: 0, connections: 0, interests: 0 });

  const fetchAll = useCallback(async () => {
    if (!user) return;
    try {
      const [postsRes, savedRes, highlightsRes] = await Promise.all([
        api.get(`/posts/user/${user.id}`).catch(() => ({ data: { posts: [] } })),
        api.get('/pstories/saved').catch(() => ({ data: { posts: [] } })),
        api.get(`/pstories/highlights?user_id=${user.id}`).catch(() => ({ data: { highlights: [] } })),
      ]);
      const allPosts = postsRes.data.posts || [];
      setPosts(allPosts);
      setSavedPosts(savedRes.data.posts || []);
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
    if (!perm.granted) return Alert.alert('Permission needed');
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
        Alert.alert('Error', err.message);
      } finally { setUploading(false); }
    }
  };

  const handleLogout = () => Alert.alert('Log Out', 'Are you sure?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Log Out', style: 'destructive', onPress: logout },
  ]);

  const handleShare = async () => {
    try {
      await Share.share({ message: `Check out ${user?.name}'s profile on KinsCribe!` });
    } catch {}
  };

  const renderGridItem = (item) => (
    <TouchableOpacity key={item.id} style={s.gridItem} activeOpacity={0.85}>
      {item.media_url ? (
        <Image source={{ uri: item.media_url }} style={s.gridImg} resizeMode="cover" />
      ) : (
        <View style={[s.gridImg, s.gridText]}>
          <Text style={s.gridCaption} numberOfLines={4}>{item.caption}</Text>
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
          <Text style={s.gridLikesText}>{item.like_count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const currentData = tab === 'saved' ? savedPosts : posts.filter(p => tab === 'reels' ? p.media_type === 'video' : true);

  const Header = () => (
    <View>
      {/* Top bar */}
      <View style={s.topBar}>
        <Text style={[s.username, { color: theme.text }]}>@{user?.username || user?.name}</Text>
        <View style={s.topBarRight}>
          <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={s.iconBtn}>
            <Ionicons name="settings-outline" size={22} color={theme.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={s.iconBtn}>
            <Ionicons name="log-out-outline" size={22} color={theme.muted} />
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
                <Text style={s.avatarLetter}>{user?.name?.[0]?.toUpperCase()}</Text>}
            </View>
          </LinearGradient>
          <View style={s.cameraBtn}>
            <Ionicons name="camera" size={11} color="#fff" />
          </View>
        </TouchableOpacity>

        <View style={s.statsRow}>
          <View style={s.stat}>
            <Text style={[s.statNum, { color: theme.text }]}>{stats.posts}</Text>
            <Text style={[s.statLabel, { color: theme.muted }]}>Posts</Text>
          </View>
          <TouchableOpacity style={s.stat} onPress={() => {}}>
            <Text style={[s.statNum, { color: theme.text }]}>{stats.connections}</Text>
            <Text style={[s.statLabel, { color: theme.muted }]}>Connections</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.stat} onPress={() => {}}>
            <Text style={[s.statNum, { color: theme.text }]}>{stats.interests}</Text>
            <Text style={[s.statLabel, { color: theme.muted }]}>Interests</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Bio */}
      <View style={s.bioWrap}>
        <View style={s.nameRow}>
          <Text style={[s.name, { color: theme.text }]}>{user?.name}</Text>
          <View style={s.roleBadge}>
            <Ionicons name="shield-checkmark" size={11} color="#7c3aed" />
            <Text style={s.roleText}>{user?.role}</Text>
          </View>
        </View>
        {user?.bio ? <Text style={[s.bio, { color: theme.muted }]}>{user.bio}</Text> : null}
      </View>

      {/* Action buttons */}
      <View style={s.actionRow}>
        <TouchableOpacity style={[s.editBtn, { backgroundColor: theme.bgCard, borderColor: theme.border2 }]} onPress={() => navigation.navigate('Settings')}>
          <Text style={[s.editBtnText, { color: theme.text }]}>Edit Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.shareBtn, { backgroundColor: theme.bgCard, borderColor: theme.border2 }]} onPress={handleShare}>
          <Ionicons name="share-outline" size={18} color={theme.text} />
        </TouchableOpacity>
        <TouchableOpacity style={[s.shareBtn, { backgroundColor: theme.bgCard, borderColor: theme.border2 }]} onPress={() => navigation.navigate('Family')}>
          <Ionicons name="people-outline" size={18} color={theme.text} />
        </TouchableOpacity>
        <TouchableOpacity style={[s.shareBtn, { backgroundColor: theme.bgCard, borderColor: theme.border2 }]} onPress={() => navigation.navigate('PostInsights')}>
          <Ionicons name="bar-chart-outline" size={18} color={theme.text} />
        </TouchableOpacity>
      </View>

      {/* Story Highlights */}
      {highlights.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.highlightsRow}>
          <TouchableOpacity style={s.highlightItem} onPress={() => {}}>
            <View style={[s.highlightCircle, s.highlightAdd, { backgroundColor: theme.bgSecondary, borderColor: theme.border2 }]}>
              <Ionicons name="add" size={22} color={theme.primary} />
            </View>
            <Text style={[s.highlightLabel, { color: theme.text }]}>New</Text>
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
              <Text style={[s.highlightLabel, { color: theme.text }]} numberOfLines={1}>{h.title}</Text>
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
      </View>
    </View>
  );

  if (loading) return (
    <View style={[s.container, { backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }]}>
      <ActivityIndicator color={theme.primary} size="large" />
    </View>
  );

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAll(); }} tintColor={theme.primary} />}
      >
        <Header />
        {currentData.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name={tab === 'saved' ? 'bookmark-outline' : tab === 'reels' ? 'film-outline' : 'camera-outline'} size={48} color={theme.dim} />
            <Text style={[s.emptyTitle, { color: theme.muted }]}>
              {tab === 'saved' ? 'No saved posts' : tab === 'reels' ? 'No reels yet' : 'No posts yet'}
            </Text>
            {tab === 'posts' && (
              <TouchableOpacity style={s.createBtn} onPress={() => navigation.navigate('Create')}>
                <Text style={s.createBtnText}>Create your first post</Text>
              </TouchableOpacity>
            )}
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
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 52, paddingHorizontal: 16, paddingBottom: 10 },
  username: { fontSize: 20, fontWeight: '800', color: colors.text },
  topBarRight: { flexDirection: 'row', gap: 4 },
  iconBtn: { padding: 8 },
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
  bio: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  actionRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 14 },
  editBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: radius.md, backgroundColor: 'rgba(30,41,59,0.8)', borderWidth: 1, borderColor: colors.border2 },
  editBtnText: { color: colors.text, fontWeight: '600', fontSize: 14 },
  shareBtn: { width: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: 'rgba(30,41,59,0.8)', borderWidth: 1, borderColor: colors.border2 },
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
  empty: { alignItems: 'center', marginTop: 60, gap: 12, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 16, color: colors.muted },
  createBtn: { backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: radius.md },
  createBtnText: { color: '#fff', fontWeight: '700' },
});
