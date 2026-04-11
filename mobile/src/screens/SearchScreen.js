import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import api from '../api/axios';
import { colors, radius } from '../theme';

export default function SearchScreen({ navigation }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ stories: [], members: [] });
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('stories');

  const handleSearch = async (text) => {
    setQuery(text);
    if (!text.trim()) return setResults({ stories: [], members: [] });
    setLoading(true);
    try {
      const [feedRes, familyRes] = await Promise.all([
        api.get('/stories/feed'),
        api.get('/family/my-family'),
      ]);
      const q = text.toLowerCase();
      const stories = feedRes.data.stories.filter(s =>
        s.title?.toLowerCase().includes(q) ||
        s.content?.toLowerCase().includes(q) ||
        s.tags?.some(t => t.toLowerCase().includes(q))
      );
      const members = familyRes.data.members.filter(m =>
        m.name?.toLowerCase().includes(q) ||
        m.username?.toLowerCase().includes(q)
      );
      setResults({ stories, members });
    } catch {} finally { setLoading(false); }
  };

  return (
    <View style={s.container}>
      <LinearGradient colors={['#0f172a', '#1a0f2e', '#0f172a']} style={StyleSheet.absoluteFill} />

      <View style={s.header}>
        <Text style={s.headerTitle}>Search</Text>
        <BlurView intensity={20} tint="dark" style={s.searchBar}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput style={s.searchInput} placeholder="Search stories, tags, members..."
            placeholderTextColor={colors.dim} value={query} onChangeText={handleSearch}
            autoFocus />
          {query ? (
            <TouchableOpacity onPress={() => { setQuery(''); setResults({ stories: [], members: [] }); }}>
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </TouchableOpacity>
          ) : null}
        </BlurView>

        {/* Tabs */}
        <View style={s.tabs}>
          {[
            { key: 'stories', icon: 'library-outline', label: 'Stories' },
            { key: 'members', icon: 'people-outline', label: 'Members' },
          ].map(t => (
            <TouchableOpacity key={t.key} style={[s.tab, tab === t.key && s.tabActive]} onPress={() => setTab(t.key)}>
              <Ionicons name={tab === t.key ? t.icon.replace('-outline', '') : t.icon} size={16} color={tab === t.key ? '#a78bfa' : colors.muted} />
              <Text style={[s.tabText, tab === t.key && s.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? <ActivityIndicator color="#7c3aed" style={{ marginTop: 40 }} /> : (
        <FlatList
          data={tab === 'stories' ? results.stories : results.members}
          keyExtractor={i => String(i.id)}
          contentContainerStyle={s.list}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="search-outline" size={48} color={colors.dim} />
              <Text style={s.emptyText}>{query ? 'No results found' : 'Start typing to search'}</Text>
            </View>
          }
          renderItem={({ item }) => tab === 'stories' ? (
            <BlurView intensity={15} tint="dark" style={s.storyCard}>
              <View style={s.storyCardInner}>
                <View style={s.storyAvatar}>
                  <Text style={s.storyAvatarText}>{item.author_name?.[0] || 'U'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.storyTitle}>{item.title}</Text>
                  <Text style={s.storyMeta}>{item.author_name} · {new Date(item.created_at).toLocaleDateString()}</Text>
                  {item.tags?.length > 0 && (
                    <View style={s.tagsRow}>
                      {item.tags.slice(0, 3).map((t, i) => <Text key={i} style={s.tag}>#{t} </Text>)}
                    </View>
                  )}
                </View>
              </View>
            </BlurView>
          ) : (
            <BlurView intensity={15} tint="dark" style={s.memberCard}>
              <View style={s.memberCardInner}>
                <View style={s.memberAvatar}>
                  {item.avatar_url
                    ? <Image source={{ uri: item.avatar_url }} style={s.memberAvatarImg} />
                    : <Text style={s.memberAvatarText}>{item.name?.[0]}</Text>}
                </View>
                <View>
                  <Text style={s.memberName}>{item.name}</Text>
                  <Text style={s.memberRole}>{item.role}</Text>
                </View>
              </View>
            </BlurView>
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingTop: 52, paddingHorizontal: 16, paddingBottom: 8 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 14 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border2, paddingHorizontal: 14, paddingVertical: 2, marginBottom: 14 },
  searchInput: { flex: 1, color: colors.text, fontSize: 15, paddingVertical: 12 },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 10, borderRadius: radius.md, backgroundColor: 'rgba(30,41,59,0.5)', borderWidth: 1, borderColor: colors.border },
  tabActive: { backgroundColor: 'rgba(124,58,237,0.2)', borderColor: 'rgba(124,58,237,0.4)' },
  tabText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#a78bfa' },
  list: { padding: 16, gap: 10, paddingBottom: 40 },
  empty: { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyText: { color: colors.muted, fontSize: 15 },
  storyCard: { borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border2 },
  storyCardInner: { backgroundColor: 'rgba(15,23,42,0.6)', padding: 14, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  storyAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#7c3aed', alignItems: 'center', justifyContent: 'center' },
  storyAvatarText: { color: '#fff', fontWeight: '700' },
  storyTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 3 },
  storyMeta: { fontSize: 12, color: colors.muted },
  tagsRow: { flexDirection: 'row', marginTop: 6 },
  tag: { color: '#60a5fa', fontSize: 12 },
  memberCard: { borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border2 },
  memberCardInner: { backgroundColor: 'rgba(15,23,42,0.6)', padding: 14, flexDirection: 'row', gap: 12, alignItems: 'center' },
  memberAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#7c3aed', alignItems: 'center', justifyContent: 'center' },
  memberAvatarImg: { width: 44, height: 44, borderRadius: 22 },
  memberAvatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  memberName: { fontSize: 15, fontWeight: '700', color: colors.text },
  memberRole: { fontSize: 12, color: colors.muted, marginTop: 2 },
});
