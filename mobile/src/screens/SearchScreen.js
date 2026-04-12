import { useState, useEffect, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, StatusBar, TextInput, ScrollView,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { colors, radius } from "../theme";

function Avatar({ uri, name, size = 52 }) {
  return uri ? (
    <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
  ) : (
    <View style={[s.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={{ color: "#fff", fontWeight: "700", fontSize: size * 0.36 }}>{name?.[0]?.toUpperCase() || "?"}</Text>
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
        <Text style={s.connectedText}>Connected</Text>
      ) : (
        <LinearGradient colors={["#7c3aed", "#3b82f6"]} style={s.connectGrad}>
          <Text style={s.connectText}>Connect</Text>
        </LinearGradient>
      )}
    </TouchableOpacity>
  );
}

export default function SearchScreen({ navigation }) {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [posts, setPosts] = useState([]);
  const [searching, setSearching] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);

  useFocusEffect(useCallback(() => {
    fetchSuggestions();
    fetchExplorePosts();
  }, []));

  const fetchSuggestions = async () => {
    setLoadingSuggestions(true);
    try {
      const { data } = await api.get("/connections/suggestions");
      setSuggestions(data.suggestions || []);
    } catch {} finally { setLoadingSuggestions(false); }
  };

  const fetchExplorePosts = async () => {
    try {
      const { data } = await api.get("/posts/explore");
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
      style={s.userRow}
      onPress={() => navigation.navigate("UserProfile", { userId: item.id, userName: item.name, userAvatar: item.avatar_url })}
      activeOpacity={0.8}
    >
      <Avatar uri={item.avatar_url} name={item.name} size={48} />
      <View style={s.userInfo}>
        <Text style={s.userName}>{item.name}</Text>
        <Text style={s.userHandle}>@{item.username || "user"}</Text>
        {item.follows_you && <Text style={s.followsYou}>Connects with you</Text>}
      </View>
      {showConnect && (
        <ConnectButton userId={item.id} initialConnected={item.is_connected} />
      )}
    </TouchableOpacity>
  );

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Discover</Text>
      </View>

      {/* Search bar */}
      <View style={s.searchWrap}>
        <Ionicons name="search" size={16} color={colors.dim} />
        <TextInput
          style={s.searchInput}
          placeholder="Search people by name or @username"
          placeholderTextColor={colors.dim}
          value={query}
          onChangeText={handleSearch}
          autoCapitalize="none"
        />
        {query ? (
          <TouchableOpacity onPress={() => { setQuery(""); setResults([]); }}>
            <Ionicons name="close-circle" size={16} color={colors.dim} />
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {query ? (
          // Search results
          <View style={s.section}>
            {searching ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} />
            ) : results.length === 0 ? (
              <View style={s.emptyWrap}>
                <Ionicons name="search-outline" size={40} color={colors.dim} />
                <Text style={s.emptyText}>No users found for "{query}"</Text>
              </View>
            ) : (
              results.map(u => renderUser(u))
            )}
          </View>
        ) : (
          <>
            {/* People you may know */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>People You May Know</Text>
              {loadingSuggestions ? (
                <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
              ) : suggestions.length === 0 ? (
                <Text style={s.emptyText}>No suggestions right now</Text>
              ) : (
                suggestions.map(u => renderUser(u))
              )}
            </View>

            {/* Explore posts */}
            {posts.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Explore Posts</Text>
                <View style={s.postsGrid}>
                  {posts.map(p => (
                    <TouchableOpacity key={p.id} style={s.postThumb} activeOpacity={0.85}>
                      {p.media_url ? (
                        <Image source={{ uri: p.media_url }} style={s.postThumbImg} resizeMode="cover" />
                      ) : (
                        <View style={[s.postThumbImg, s.postThumbText]}>
                          <Text style={s.postThumbCaption} numberOfLines={4}>{p.caption}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const THUMB = 116;
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
  postsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 3 },
  postThumb: { width: THUMB, height: THUMB },
  postThumbImg: { width: "100%", height: "100%", borderRadius: 4 },
  postThumbText: { backgroundColor: colors.bgSecondary, padding: 8, justifyContent: "center" },
  postThumbCaption: { fontSize: 11, color: colors.muted },
  emptyWrap: { alignItems: "center", marginTop: 40, gap: 8 },
  emptyText: { color: colors.muted, fontSize: 14, textAlign: "center" },
});
