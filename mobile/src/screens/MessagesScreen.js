import { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, StatusBar, TextInput,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { colors, radius } from "../theme";

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function Avatar({ uri, name, size = 48 }) {
  return uri ? (
    <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
  ) : (
    <View style={[s.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[s.avatarLetter, { fontSize: size * 0.38 }]}>{name?.[0]?.toUpperCase() || "?"}</Text>
    </View>
  );
}

export default function MessagesScreen({ navigation }) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [familyConv, setFamilyConv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const fetchConversations = async () => {
    try {
      const { data } = await api.get("/messages/conversations");
      const all = data.conversations || [];
      const family = all.find(c => c.type === "family");
      const dms = all.filter(c => c.type === "private");
      setFamilyConv(family || null);
      setConversations(dms);
    } catch (err) {
      console.log("conv error:", err.message);
    } finally { setLoading(false); }
  };

  const ensureFamilyChat = async () => {
    try {
      const { data } = await api.get("/messages/family");
      setFamilyConv(data.conversation);
    } catch {}
  };

  useFocusEffect(useCallback(() => {
    fetchConversations();
    ensureFamilyChat();
  }, []));

  const handleSearch = async (q) => {
    setSearch(q);
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const { data } = await api.get(`/connections/search?q=${q}`);
      setSearchResults(data.users || []);
    } catch {} finally { setSearching(false); }
  };

  const openDM = async (userId, userName, userAvatar) => {
    setSearch(""); setSearchResults([]);
    try {
      const { data } = await api.post(`/messages/dm/${userId}`);
      navigation.navigate("Chat", {
        conversationId: data.conversation.id,
        title: userName,
        avatar: userAvatar,
        type: "private",
      });
    } catch {}
  };

  const openConv = (conv) => {
    const title = conv.type === "family"
      ? `${user?.family_id ? "Family" : "Family"} Chat`
      : conv.other_user?.name || "Chat";
    navigation.navigate("Chat", {
      conversationId: conv.id,
      title,
      avatar: conv.type === "private" ? conv.other_user?.avatar : null,
      type: conv.type,
      otherUserId: conv.other_user?.id,
    });
  };

  const renderDM = ({ item }) => {
    const other = item.other_user;
    const lastMsg = item.last_message;
    const unread = item.unread_count > 0;
    return (
      <TouchableOpacity style={s.row} onPress={() => openConv(item)} activeOpacity={0.7}>
        <Avatar uri={other?.avatar} name={other?.name} size={52} />
        <View style={s.rowInfo}>
          <View style={s.rowTop}>
            <Text style={[s.rowName, unread && s.rowNameUnread]}>{other?.name || "User"}</Text>
            <Text style={s.rowTime}>{timeAgo(lastMsg?.created_at)}</Text>
          </View>
          <View style={s.rowBottom}>
            <Text style={[s.rowLast, unread && s.rowLastUnread]} numberOfLines={1}>
              {lastMsg ? (lastMsg.media_url ? "📎 Media" : lastMsg.text) : "Start a conversation"}
            </Text>
            {unread && <View style={s.unreadDot}><Text style={s.unreadCount}>{item.unread_count}</Text></View>}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Messages</Text>
        <TouchableOpacity onPress={() => navigation.navigate("Search")}>
          <Ionicons name="person-add-outline" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={s.searchWrap}>
        <Ionicons name="search" size={16} color={colors.dim} />
        <TextInput
          style={s.searchInput}
          placeholder="Search people..."
          placeholderTextColor={colors.dim}
          value={search}
          onChangeText={handleSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => { setSearch(""); setSearchResults([]); }}>
            <Ionicons name="close-circle" size={16} color={colors.dim} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Search results */}
      {search ? (
        <View style={s.searchResults}>
          {searching ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
          ) : searchResults.length === 0 ? (
            <Text style={s.emptyText}>No users found</Text>
          ) : (
            searchResults.map(u => (
              <TouchableOpacity
                key={u.id}
                style={s.searchRow}
                onPress={() => openDM(u.id, u.name, u.avatar_url)}
                activeOpacity={0.7}
              >
                <Avatar uri={u.avatar_url} name={u.name} size={40} />
                <View style={{ marginLeft: 12 }}>
                  <Text style={s.rowName}>{u.name}</Text>
                  <Text style={s.rowLast}>@{u.username}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      ) : (
        <>
          {/* Family Chat */}
          {familyConv && (
            <View style={s.section}>
              <Text style={s.sectionLabel}>Family</Text>
              <TouchableOpacity style={s.familyRow} onPress={() => openConv(familyConv)} activeOpacity={0.8}>
                <LinearGradient colors={["#7c3aed", "#3b82f6", "#ec4899"]} style={s.familyIcon}>
                  <Ionicons name="people" size={22} color="#fff" />
                </LinearGradient>
                <View style={s.rowInfo}>
                  <View style={s.rowTop}>
                    <Text style={s.rowName}>Family Chat</Text>
                    <Text style={s.rowTime}>{timeAgo(familyConv.last_message?.created_at)}</Text>
                  </View>
                  <View style={s.rowBottom}>
                    <Text style={s.rowLast} numberOfLines={1}>
                      {familyConv.last_message
                        ? `${familyConv.last_message.sender_name}: ${familyConv.last_message.media_url ? "📎 Media" : familyConv.last_message.text}`
                        : "Family group chat"}
                    </Text>
                    {familyConv.unread_count > 0 && (
                      <View style={s.unreadDot}>
                        <Text style={s.unreadCount}>{familyConv.unread_count}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* DMs */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>Direct Messages</Text>
          </View>

          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
          ) : conversations.length === 0 ? (
            <View style={s.emptyWrap}>
              <Ionicons name="chatbubbles-outline" size={48} color={colors.dim} />
              <Text style={s.emptyTitle}>No messages yet</Text>
              <Text style={s.emptyText}>Search for people above to start a conversation</Text>
            </View>
          ) : (
            <FlatList
              data={conversations}
              keyExtractor={i => String(i.id)}
              renderItem={renderDM}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 100 }}
            />
          )}
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12 },
  title: { fontSize: 24, fontWeight: "800", color: colors.text },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.bgSecondary, borderRadius: radius.md, marginHorizontal: 16, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 8 },
  searchInput: { flex: 1, color: colors.text, fontSize: 14 },
  searchResults: { flex: 1, paddingHorizontal: 16 },
  searchRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  section: { paddingHorizontal: 16, paddingVertical: 6 },
  sectionLabel: { fontSize: 12, fontWeight: "700", color: colors.dim, textTransform: "uppercase", letterSpacing: 0.8 },
  familyRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  familyIcon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  rowInfo: { flex: 1 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  rowName: { fontSize: 15, fontWeight: "600", color: colors.text },
  rowNameUnread: { fontWeight: "800" },
  rowTime: { fontSize: 12, color: colors.dim },
  rowBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowLast: { fontSize: 13, color: colors.muted, flex: 1 },
  rowLastUnread: { color: colors.text, fontWeight: "600" },
  unreadDot: { backgroundColor: colors.primary, borderRadius: 10, minWidth: 20, height: 20, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  unreadCount: { color: "#fff", fontSize: 11, fontWeight: "800" },
  avatarFallback: { backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  avatarLetter: { color: "#fff", fontWeight: "700" },
  emptyWrap: { alignItems: "center", marginTop: 60, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: colors.text },
  emptyText: { fontSize: 13, color: colors.muted, textAlign: "center", paddingHorizontal: 40 },
});
