import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, Alert, RefreshControl,
  ScrollView, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import StoryCard from '../components/StoryCard';
import { colors, radius } from '../theme';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');
const GRID_SIZE = (width - 3) / 3;

export default function ProfileScreen({ navigation }) {
  const { user, refreshUser, logout } = useAuth();
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [view, setView] = useState('grid'); // grid | list
  const [stats, setStats] = useState({ stories: 0, likes: 0, comments: 0 });

  const fetchStories = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await api.get('/stories/feed');
      const mine = data.stories.filter(s => s.user_id === user.id);
      setStories(mine);
      setStats({
        stories: mine.length,
        likes: mine.reduce((sum, s) => sum + (s.like_count || 0), 0),
        comments: mine.reduce((sum, s) => sum + (s.comment_count || 0), 0),
      });
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { fetchStories(); }, [fetchStories]);
  useFocusEffect(useCallback(() => { fetchStories(); }, [fetchStories]));

  const handleAvatarUpload = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permission needed to access gallery.');

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
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
        Alert.alert('✅ Success', 'Profile picture updated!');
      } catch (err) {
        Alert.alert('Error', err.message || 'Upload failed');
      } finally {
        setUploading(false);
      }
    }
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: logout },
    ]);
  };

  const Header = () => (
    <View>
      {/* Top bar */}
      <View style={s.topBar}>
        <Text style={s.username}>@{user?.username || user?.name}</Text>
        <View style={s.topBarRight}>
          <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={s.iconBtn}>
            <Ionicons name="settings-outline" size={22} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={s.iconBtn}>
            <Ionicons name="log-out-outline" size={22} color={colors.muted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Profile info */}
      <View style={s.profileRow}>
        {/* Avatar */}
        <TouchableOpacity onPress={handleAvatarUpload} style={s.avatarWrap} disabled={uploading}>
          <LinearGradient colors={['#7c3aed', '#3b82f6', '#ec4899']} style={s.avatarRing}>
            <View style={s.avatarInner}>
              {uploading ? (
                <ActivityIndicator color="#fff" />
              ) : user?.avatar_url ? (
                <Image source={{ uri: user.avatar_url }} style={s.avatarImg} />
              ) : (
                <Text style={s.avatarLetter}>{user?.name?.[0]?.toUpperCase()}</Text>
              )}
            </View>
          </LinearGradient>
          <View style={s.cameraBtn}>
            <Ionicons name="camera" size={12} color="#fff" />
          </View>
        </TouchableOpacity>

        {/* Stats */}
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

      {/* Name + bio */}
      <View style={s.bioWrap}>
        <Text style={s.name}>{user?.name}</Text>
        {user?.bio ? <Text style={s.bio}>{user.bio}</Text> : null}
        <View style={s.roleBadge}>
          <Ionicons name="shield-checkmark" size={12} color="#7c3aed" />
          <Text style={s.roleText}>{user?.role}</Text>
        </View>
      </View>

      {/* Action buttons */}
      <View style={s.actionRow}>
        <TouchableOpacity style={s.editBtn} onPress={() => navigation.navigate('Settings')}>
          <Text style={s.editBtnText}>Edit Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.shareBtn} onPress={() => Alert.alert('Share Profile', 'Share your KinsCribe profile with family!')}>
          <Ionicons name="share-outline" size={18} color={colors.text} />
        </TouchableOpacity>
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
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchStories(); }} tintColor={colors.primary} />}
        >
          <Header />
          {stories.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="camera-outline" size={48} color={colors.dim} />
              <Text style={s.emptyTitle}>No stories yet</Text>
              <TouchableOpacity style={s.createBtn} onPress={() => navigation.navigate('Create')}>
                <Text style={s.createBtnText}>Share your first story</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.grid}>
              {stories.map(story => (
                <TouchableOpacity key={story.id} style={s.gridItem} activeOpacity={0.9}>
                  {story.media_url && story.media_type === 'image' ? (
                    <Image source={{ uri: story.media_url }} style={s.gridImg} />
                  ) : story.media_type === 'video' ? (
                    <View style={[s.gridImg, s.gridVideo]}>
                      <Ionicons name="play-circle" size={28} color="#fff" />
                    </View>
                  ) : story.media_type === 'audio' ? (
                    <View style={[s.gridImg, s.gridAudio]}>
                      <Ionicons name="musical-notes" size={24} color="#7c3aed" />
                    </View>
                  ) : (
                    <View style={[s.gridImg, s.gridText]}>
                      <Text style={s.gridTextContent} numberOfLines={3}>{story.title}</Text>
                    </View>
                  )}
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
        renderItem={({ item }) => <StoryCard story={item} onUpdate={fetchStories} navigation={navigation} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchStories(); }} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="camera-outline" size={48} color={colors.dim} />
            <Text style={s.emptyTitle}>No stories yet</Text>
            <TouchableOpacity style={s.createBtn} onPress={() => navigation.navigate('Create')}>
              <Text style={s.createBtnText}>Share your first story</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 52, paddingHorizontal: 16, paddingBottom: 10 },
  username: { fontSize: 20, fontWeight: '800', color: colors.text },
  topBarRight: { flexDirection: 'row', gap: 8 },
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
  bioWrap: { paddingHorizontal: 16, paddingBottom: 14 },
  name: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 3 },
  bio: { fontSize: 14, color: colors.muted, lineHeight: 18, marginBottom: 6 },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: 'rgba(124,58,237,0.15)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  roleText: { color: '#a78bfa', fontSize: 11, fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 14 },
  editBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: radius.md, backgroundColor: 'rgba(30,41,59,0.8)', borderWidth: 1, borderColor: colors.border2 },
  editBtnText: { color: colors.text, fontWeight: '600', fontSize: 14 },
  shareBtn: { width: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: 'rgba(30,41,59,0.8)', borderWidth: 1, borderColor: colors.border2 },
  viewToggle: { flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: colors.border },
  toggleBtn: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  toggleBtnActive: { borderBottomWidth: 1.5, borderBottomColor: colors.primary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 1.5 },
  gridItem: { width: GRID_SIZE, height: GRID_SIZE, position: 'relative' },
  gridImg: { width: '100%', height: '100%' },
  gridVideo: { backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' },
  gridAudio: { backgroundColor: 'rgba(124,58,237,0.15)', alignItems: 'center', justifyContent: 'center' },
  gridText: { backgroundColor: colors.bgSecondary, alignItems: 'center', justifyContent: 'center', padding: 8 },
  gridTextContent: { color: colors.text, fontSize: 11, textAlign: 'center' },
  gridLikes: { position: 'absolute', bottom: 4, left: 4, flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 10 },
  gridLikesText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  empty: { alignItems: 'center', marginTop: 60, gap: 12, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 16, color: colors.muted },
  createBtn: { backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: radius.md },
  createBtnText: { color: '#fff', fontWeight: '700' },
});
