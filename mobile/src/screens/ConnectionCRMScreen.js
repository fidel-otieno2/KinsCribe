import { useEffect, useState, useCallback } from 'react';
import {
  View, StyleSheet, FlatList, TouchableOpacity,
  Image, ActivityIndicator, TextInput, Alert,
} from 'react-native';
import AppText from '../components/AppText';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../i18n';
import { colors, radius } from '../theme';

function Avatar({ uri, name, size = 48 }) {
  return uri ? (
    <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
  ) : (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
      <AppText style={{ color: '#fff', fontWeight: '700', fontSize: size * 0.38 }}>{name?.[0]?.toUpperCase() || '?'}</AppText>
    </View>
  );
}

export default function ConnectionCRMScreen({ navigation }) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('followers'); // followers | following
  const [query, setQuery] = useState('');

  const fetchAll = useCallback(async () => {
    if (!user) return;
    try {
      const [followersRes, followingRes] = await Promise.all([
        api.get(`/connections/${user.id}/followers`).catch(() => ({ data: { followers: [] } })),
        api.get(`/connections/${user.id}/following`).catch(() => ({ data: { following: [] } })),
      ]);
      setFollowers(followersRes.data.followers || []);
      setFollowing(followingRes.data.following || []);
    } catch {} finally { setLoading(false); }
  }, [user]);

  useFocusEffect(useCallback(() => { fetchAll(); }, [fetchAll]));

  const handleRemove = (userId, name) => {
    Alert.alert(
      'Unfollow',
      `Unfollow ${name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Unfollow', style: 'destructive', onPress: async () => {
          try {
            await api.post(`/connections/${userId}/toggle`);
            fetchAll();
          } catch {}
        }},
      ]
    );
  };

  const data = (tab === 'followers' ? followers : following)
    .filter(u => !query || u.name?.toLowerCase().includes(query.toLowerCase()) || u.username?.toLowerCase().includes(query.toLowerCase()));

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={s.row}
      onPress={() => navigation.navigate('UserProfile', { userId: item.id, userName: item.name, userAvatar: item.avatar_url })}
      activeOpacity={0.8}
    >
      <Avatar uri={item.avatar_url} name={item.name} size={48} />
      <View style={s.info}>
        <AppText style={s.name}>{item.name}</AppText>
        <AppText style={s.handle}>@{item.username || 'user'}</AppText>
        {item.bio ? <AppText style={s.bio} numberOfLines={1}>{item.bio}</AppText> : null}
      </View>
      <View style={s.actions}>
        <TouchableOpacity
          style={s.msgBtn}
          onPress={async () => {
            try {
              const { data } = await api.post(`/messages/dm/${item.id}`);
              navigation.navigate('Chat', { conversationId: data.conversation.id, title: item.name, avatar: item.avatar_url, type: 'private', otherUserId: item.id });
            } catch {}
          }}
        >
          <Ionicons name="chatbubble-outline" size={18} color={colors.primary} />
        </TouchableOpacity>
        {tab === 'following' && (
          <TouchableOpacity style={s.removeBtn} onPress={() => handleRemove(item.id, item.name)}>
            <Ionicons name="person-remove-outline" size={18} color="#f87171" />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={s.container}>
      <LinearGradient colors={['#0f172a', '#1a0f2e', '#0f172a']} style={StyleSheet.absoluteFill} />

      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <AppText style={s.headerTitle}>My Network</AppText>
      </View>

      {/* Tabs */}
      <View style={s.tabRow}>
        <TouchableOpacity style={[s.tabBtn, tab === 'followers' && s.tabBtnActive]} onPress={() => setTab('followers')}>
          <AppText style={[s.tabText, tab === 'followers' && s.tabTextActive]}>
            Followers ({followers.length})
          </AppText>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tabBtn, tab === 'following' && s.tabBtnActive]} onPress={() => setTab('following')}>
          <AppText style={[s.tabText, tab === 'following' && s.tabTextActive]}>
            Following ({following.length})
          </AppText>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={s.searchWrap}>
        <Ionicons name="search" size={15} color={colors.dim} />
        <TextInput
          style={s.searchInput}
          placeholder="Search..."
          placeholderTextColor={colors.dim}
          value={query}
          onChangeText={setQuery}
        />
        {query ? <TouchableOpacity onPress={() => setQuery('')}><Ionicons name="close-circle" size={15} color={colors.dim} /></TouchableOpacity> : null}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={i => String(i.id)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="people-outline" size={48} color={colors.dim} />
              <AppText style={s.emptyText}>{query ? 'No results' : tab === 'followers' ? 'No followers yet' : 'Not following anyone yet'}</AppText>
            </View>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 52, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 0.5, borderBottomColor: colors.border, gap: 12 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: colors.text },
  tabRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 10 },
  tabBtn: { flex: 1, paddingVertical: 9, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border2, alignItems: 'center', backgroundColor: 'rgba(30,41,59,0.5)' },
  tabBtnActive: { backgroundColor: 'rgba(124,58,237,0.2)', borderColor: 'rgba(124,58,237,0.5)' },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.muted },
  tabTextActive: { color: colors.primary },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 8, backgroundColor: 'rgba(30,41,59,0.8)', borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: colors.border2 },
  searchInput: { flex: 1, color: colors.text, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600', color: colors.text },
  handle: { fontSize: 12, color: colors.muted },
  bio: { fontSize: 12, color: colors.dim, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 8 },
  msgBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(124,58,237,0.15)', alignItems: 'center', justifyContent: 'center' },
  removeBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(248,113,113,0.1)', alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyText: { fontSize: 15, color: colors.muted },
});
