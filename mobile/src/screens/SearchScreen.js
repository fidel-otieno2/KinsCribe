import { useState, useEffect, useCallback, useRef } from "react";
import {
  View, FlatList, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, StatusBar, TextInput, ScrollView, Dimensions,
} from "react-native";
import AppText from '../components/AppText';
import { Video, ResizeMode } from 'expo-av';
import { useTranslation } from '../i18n';
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { colors, radius } from "../theme";

const { width } = Dimensions.get('window');
const GRID_SIZE = (width - 32 - 4) / 3; // 3 cols, 16px side padding, 2px gaps

function Avatar({ uri, name, size = 52 }) {
  return uri ? (
    <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
  ) : (
    <View style={[s.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <AppText style={{ color: "#fff", fontWeight: "700", fontSize: size * 0.36 }}>{name?.[0]?.toUpperCase() || "?"}</AppText>
    </View>
  );
}

function ConnectButton({ userId, initialConnected, onToggle }) {
  const [connected, setConnected] = useState(initialConnected);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    setLoading(true);
    try {
      const { data } = await api.post(`/connections/${userId}/toggle`);
      setConnected(data.connected);
      onToggle?.(data.connected);
    } catch {} finally { setLoading(false); }
  };

  return (
    <TouchableOpacity
      style={[s.connectBtn, connected && s.connectedBtn]}
      onPress={toggle}
      disabled={loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator size="small" color={connected ? colors.muted : "#fff"} />
      ) : connected ? (
        <AppText style={s.connectedText}>Connected</AppText>
      ) : (
        <LinearGradient colors={["#7c3aed", "#3b82f6"]} style={s.connectGrad}>
          <AppText style={s.connectText}>Connect</AppText>
        </LinearGradient>
      )}
    </TouchableOpacity>
  );
}

export default function SearchScreen({ navigation }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { theme } = useTheme();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [posts, setPosts] = useState([]);
  const [searching, setSearching] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [exploreFilter, setExploreFilter] = useState('recent'); // recent|trending|popular
  const [trendingHashtags, setTrendingHashtags] = useState([]);
  const [hashtagQuery, setHashtagQuery] = useState('');

  useFocusEffect(useCallback(() => {
    fetchSuggestions();
    fetchExplorePosts();
    fetchTrending();
  }, [exploreFilter]));

  const fetchTrending = async () => {
    try {
      const { data } = await api.get('/search/trending');
      setTrendingHashtags(data.hashtags || []);
    } catch {}
  };

  const fetchSuggestions = async () => {
    setLoadingSuggestions(true);
    try {
      const { data } = await api.get("/connections/suggestions");
      setSuggestions(data.suggestions || []);
    } catch {} finally { setLoadingSuggestions(false); }
  };

  const fetchExplorePosts = async () => {
    try {
      const { data } = await api.get(`/posts/explore?category=${exploreFilter}`);
      setPosts(data.posts || []);
    } catch {}
  };

  const handleSearch = async (q) => {
    setQuery(q);
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    try {
      const { data } = await api.get(`/connections/search?q=${q}`);
      setResults(data.users || []);
    } catch {} finally { setSearching(false); }
  };

  const renderUser = (item, showConnect = true) => (
    <TouchableOpacity
      key={item.id}
      style={[s.userRow, { borderBottomColor: theme.border }]}
      onPress={() => navigation.navigate("UserProfile", { userId: item.id, userName: item.name, userAvatar: item.avatar_url })}
      activeOpacity={0.8}
    >
      <Avatar uri={item.avatar_url} name={item.name} size={48} />
      <View style={s.userInfo}>
        <AppText style={[s.userName, { color: theme.text }]}>{item.name}</AppText>
        <AppText style={[s.userHandle, { color: theme.muted }]}>@{item.username || "user"}</AppText>
        {item.follows_you && <AppText style={[s.followsYou, { color: theme.primary }]}>Connects with you</AppText>}
      </View>
      {showConnect && (
        <ConnectButton userId={item.id} initialConnected={item.is_connected} />
      )}
    </TouchableOpacity>
  );

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={s.header}>
        <AppText style={[s.title, { color: theme.text }]}>{t('discover')}</AppText>
      </View>

      {/* Search bar */}
      <View style={[s.searchWrap, { backgroundColor: theme.bgSecondary }]}>
        <Ionicons name="search" size={16} color={theme.dim} />
        <TextInput
          style={[s.searchInput, { color: theme.text }]}
          placeholder="Search people by name or @username"
          placeholderTextColor={theme.dim}
          value={query}
          onChangeText={handleSearch}
          autoCapitalize="none"
        />
        {query ? (
          <TouchableOpacity onPress={() => { setQuery(""); setResults([]); }}>
            <Ionicons name="close-circle" size={16} color={theme.dim} />
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {query ? (
          // Search results
          <View style={s.section}>
            {searching ? (
              <ActivityIndicator color={theme.primary} style={{ marginTop: 30 }} />
            ) : results.length === 0 ? (
              <View style={s.emptyWrap}>
                <Ionicons name="search-outline" size={40} color={theme.dim} />
                <AppText style={[s.emptyText, { color: theme.muted }]}>No users found for "{query}"</AppText>
              </View>
            ) : (
              results.map(u => renderUser(u))
            )}
          </View>
        ) : (
          <>
            {/* People you may know */}
            <View style={s.section}>
              <AppText style={[s.sectionTitle, { color: theme.text }]}>{t('people_you_may_know')}</AppText>
              {loadingSuggestions ? (
                <ActivityIndicator color={theme.primary} style={{ marginTop: 20 }} />
              ) : suggestions.length === 0 ? (
                <AppText style={[s.emptyText, { color: theme.muted }]}>{t('no_suggestions')}</AppText>
              ) : (
                suggestions.map(u => renderUser(u))
              )}
            </View>

            {/* Explore posts */}
            {posts.length > 0 && (
              <View style={s.section}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <AppText style={[s.sectionTitle, { color: theme.text }]}>{t('explore_posts')}</AppText>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {['recent', 'trending', 'popular'].map(f => (
                      <TouchableOpacity
                        key={f}
                        style={[s.filterBtn, exploreFilter === f && { backgroundColor: 'rgba(124,58,237,0.25)', borderColor: 'rgba(124,58,237,0.5)' }, { borderColor: theme.border2, backgroundColor: theme.bgSecondary }]}
                        onPress={() => { setExploreFilter(f); fetchExplorePosts(); }}
                      >
                        <AppText style={[s.filterBtnText, { color: exploreFilter === f ? theme.primary : theme.muted }]}>
                          {f.charAt(0).toUpperCase() + f.slice(1)}
                        </AppText>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                {trendingHashtags.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                    {trendingHashtags.slice(0, 8).map(h => (
                      <TouchableOpacity
                        key={h.tag}
                        style={[s.hashtagChip, { backgroundColor: theme.bgSecondary, borderColor: theme.border2 }]}
                        onPress={() => { setQuery(`#${h.tag}`); handleSearch(`#${h.tag}`); }}
                      >
                        <AppText style={[s.hashtagText, { color: theme.primary }]}>#{h.tag}</AppText>
                        <AppText style={[s.hashtagCount, { color: theme.dim }]}>{h.count}</AppText>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
                <View style={s.postsGrid}>
                  {posts.map(p => {
                    const isVideo = p.media_type === 'video' && !!p.media_url;
                    return (
                      <TouchableOpacity
                        key={p.id}
                        style={s.postThumb}
                        activeOpacity={0.85}
                        onPress={() => isVideo
                          ? navigation.navigate('Reels', { startPostId: p.id })
                          : navigation.navigate('PostDetail', { postId: p.id })
                        }
                      >
                        {isVideo ? (
                          <>
                            <Video
                              source={{ uri: p.media_url }}
                              style={s.postThumbImg}
                              resizeMode={ResizeMode.COVER}
                              shouldPlay
                              isLooping
                              isMuted
                              useNativeControls={false}
                            />
                            <View style={s.videoOverlay}>
                              <Ionicons name="play" size={18} color="#fff" />
                            </View>
                          </>
                        ) : p.media_url ? (
                          <Image source={{ uri: p.media_url }} style={s.postThumbImg} resizeMode="cover" />
                        ) : (
                          <View style={[s.postThumbImg, { backgroundColor: theme.bgSecondary, padding: 8, justifyContent: 'center' }]}>
                            <AppText style={[s.postThumbCaption, { color: theme.muted }]} numberOfLines={4}>{p.caption}</AppText>
                          </View>
                        )}
                        {p.like_count > 0 && (
                          <View style={s.thumbLikes}>
                            <Ionicons name="heart" size={9} color="#fff" />
                            <AppText style={s.thumbLikesText}>{p.like_count}</AppText>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12 },
  title: { fontSize: 24, fontWeight: "800", color: colors.text },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.bgSecondary, borderRadius: radius.md, marginHorizontal: 16, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 8 },
  searchInput: { flex: 1, color: colors.text, fontSize: 14 },
  section: { paddingHorizontal: 16, paddingTop: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: 12 },
  userRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  avatarFallback: { backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  userInfo: { flex: 1 },
  userName: { fontSize: 15, fontWeight: "600", color: colors.text },
  userHandle: { fontSize: 13, color: colors.muted },
  followsYou: { fontSize: 11, color: colors.primary, fontWeight: "600", marginTop: 2 },
  connectBtn: { borderRadius: radius.full, overflow: "hidden", minWidth: 90, height: 34 },
  connectedBtn: { borderWidth: 1, borderColor: colors.border2, borderRadius: radius.full, alignItems: "center", justifyContent: "center", minWidth: 90, height: 34 },
  connectGrad: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  connectText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  connectedText: { color: colors.muted, fontWeight: "600", fontSize: 13 },
  postsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 2 },
  postThumb: { width: GRID_SIZE, height: GRID_SIZE, position: 'relative', overflow: 'hidden', borderRadius: 4 },
  postThumbImg: { width: "100%", height: "100%", borderRadius: 4 },
  postThumbCaption: { fontSize: 11, color: colors.muted },
  videoOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.2)' },
  thumbLikes: { position: 'absolute', bottom: 4, left: 4, flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 8 },
  thumbLikesText: { color: '#fff', fontSize: 9, fontWeight: '600' },
  emptyWrap: { alignItems: "center", marginTop: 40, gap: 8 },
  emptyText: { color: colors.muted, fontSize: 14, textAlign: "center" },
  filterBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  filterBtnText: { fontSize: 11, fontWeight: '600' },
  hashtagChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, marginRight: 8 },
  hashtagText: { fontSize: 13, fontWeight: '600' },
  hashtagCount: { fontSize: 11 },
});
