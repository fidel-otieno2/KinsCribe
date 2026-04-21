import { useEffect, useState, useCallback } from "react";
import {
  View, FlatList, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, StatusBar, TextInput, Alert,
} from "react-native";
import AppText from '../components/AppText';
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { colors, radius } from "../theme";
import { useTranslation } from "../i18n";

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
      <AppText style={[s.avatarLetter, { fontSize: size * 0.38 }]}>{name?.[0]?.toUpperCase() || "?"}</AppText>
    </View>
  );
}

export default function MessagesScreen({ navigation }) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [conversations, setConversations] = useState([]);
  const [familyConv, setFamilyConv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [pinnedIds, setPinnedIds] = useState(new Set());
  const [mutedIds, setMutedIds] = useState(new Set());
  const [archivedIds, setArchivedIds] = useState(new Set());
  const [openingDM, setOpeningDM] = useState(null);

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
      // Search all users, not just connections
      const { data } = await api.get(`/connections/search?q=${encodeURIComponent(q)}`);
      setSearchResults(data.users || []);
    } catch (err) {
      console.log('search error:', err.message);
    } finally { setSearching(false); }
  };

  const openDM = async (userId, userName, userAvatar) => {
    if (openingDM) return;
    setOpeningDM(userId);
    setSearch('');
    setSearchResults([]);
    try {
      const { data } = await api.post(`/messages/dm/${userId}`);
      navigation.navigate('Chat', {
        conversationId: data.conversation.id,
        title: userName,
        avatar: userAvatar,
        type: 'private',
        otherUserId: userId,
      });
    } catch (err) {
      console.log('openDM error:', err.response?.status, JSON.stringify(err.response?.data), err.message);
      // If we got a conversation back despite the error, still navigate
      if (err.response?.data?.conversation) {
        navigation.navigate('Chat', {
          conversationId: err.response.data.conversation.id,
          title: userName,
          avatar: userAvatar,
          type: 'private',
          otherUserId: userId,
        });
      } else {
        Alert.alert('Error', err.response?.data?.error || err.message || 'Could not open conversation. Try again.');
      }
    } finally {
      setOpeningDM(null);
    }
  };

  const openConv = (conv) => {
    const title = conv.type === "family"
      ? `${t('family')} ${t('messages')}`
      : conv.other_user?.name || t('messages');
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
    const isPinned = pinnedIds.has(item.id);
    const isMuted = mutedIds.has(item.id);
    return (
      <TouchableOpacity
        style={[s.row, { borderBottomColor: theme.border }, isPinned && { backgroundColor: 'rgba(124,58,237,0.06)' }]}
        onPress={() => openConv(item)}
        onLongPress={() => Alert.alert(
          other?.name || 'Chat',
          '',
          [
            { text: isPinned ? 'Unpin' : 'Pin to top', onPress: () => setPinnedIds(prev => { const n = new Set(prev); isPinned ? n.delete(item.id) : n.add(item.id); return n; }) },
            { text: isMuted ? 'Unmute' : 'Mute notifications', onPress: () => setMutedIds(prev => { const n = new Set(prev); isMuted ? n.delete(item.id) : n.add(item.id); return n; }) },
            { text: 'Archive', onPress: () => setArchivedIds(prev => new Set([...prev, item.id])) },
            { text: 'Cancel', style: 'cancel' },
          ]
        )}
        activeOpacity={0.7}
      >
        <Avatar uri={other?.avatar} name={other?.name} size={52} />
        <View style={s.rowInfo}>
          <View style={s.rowTop}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              {isPinned && <Ionicons name="pin" size={12} color={theme.primary} />}
              <AppText style={[s.rowName, { color: theme.text }, unread && s.rowNameUnread]}>{other?.name || "User"}</AppText>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              {isMuted && <Ionicons name="notifications-off-outline" size={12} color={theme.dim} />}
              <AppText style={[s.rowTime, { color: theme.dim }]}>{timeAgo(lastMsg?.created_at)}</AppText>
            </View>
          </View>
          <View style={s.rowBottom}>
            <AppText style={[s.rowLast, { color: theme.muted }, unread && { color: theme.text, fontWeight: '600' }]} numberOfLines={1}>
              {lastMsg ? (lastMsg.media_url ? t('media_attachment') : lastMsg.text) : t('no_messages')}
            </AppText>
            {unread && !isMuted && <View style={[s.unreadDot, { backgroundColor: theme.primary }]}><AppText style={s.unreadCount}>{item.unread_count}</AppText></View>}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={s.header}>
        <AppText style={[s.title, { color: theme.text }]}>{t('messages')}</AppText>
        <TouchableOpacity onPress={() => navigation.navigate("Search")}>
          <Ionicons name="person-add-outline" size={24} color={theme.text} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={[s.searchWrap, { backgroundColor: theme.bgSecondary }]}>
        <Ionicons name="search" size={16} color={theme.dim} />
        <TextInput
          style={[s.searchInput, { color: theme.text }]}
          placeholder={t('search_people')}
          placeholderTextColor={theme.dim}
          value={search}
          onChangeText={handleSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => { setSearch(""); setSearchResults([]); }}>
            <Ionicons name="close-circle" size={16} color={theme.dim} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Search results */}
      {search ? (
        <View style={s.searchResults}>
          {searching ? (
            <ActivityIndicator color={theme.primary} style={{ marginTop: 20 }} />
          ) : searchResults.length === 0 ? (
            <AppText style={[s.emptyText, { color: theme.muted }]}>{t('no_users_found')}</AppText>
          ) : (
            searchResults.map(u => (
              <TouchableOpacity
                key={u.id}
                style={[s.searchRow, { borderBottomColor: theme.border }]}
                onPress={() => openDM(u.id, u.name, u.avatar_url)}
                disabled={openingDM === u.id}
                activeOpacity={0.7}
              >
                <Avatar uri={u.avatar_url} name={u.name} size={46} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <AppText style={[s.rowName, { color: theme.text }]}>{u.name}</AppText>
                  <AppText style={[s.rowLast, { color: theme.muted }]}>@{u.username || 'user'}</AppText>
                </View>
                {openingDM === u.id ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : (
                  <View style={s.dmBtn}>
                    <Ionicons name="chatbubble-outline" size={16} color={theme.primary} />
                    <AppText style={[s.dmBtnText, { color: theme.primary }]}>{t('message_action')}</AppText>
                  </View>
                )}
              </TouchableOpacity>
            ))
          )}
        </View>
      ) : (
        <>
          {/* Family Chat */}
          {familyConv && (
            <View style={s.section}>
              <AppText style={[s.sectionLabel, { color: theme.dim }]}>{t('family')}</AppText>
              <TouchableOpacity style={s.familyRow} onPress={() => openConv(familyConv)} activeOpacity={0.8}>
                <LinearGradient colors={["#2D5A27", "#4A7C3F", "#C4A35A"]} style={s.familyIcon}>
                  <Ionicons name="people" size={22} color="#fff" />
                </LinearGradient>
                <View style={s.rowInfo}>
                  <View style={s.rowTop}>
                    <AppText style={[s.rowName, { color: theme.text }]}>{t('family_chat')}</AppText>
                    <AppText style={[s.rowTime, { color: theme.dim }]}>{timeAgo(familyConv.last_message?.created_at)}</AppText>
                  </View>
                  <View style={s.rowBottom}>
                    <AppText style={[s.rowLast, { color: theme.muted }]} numberOfLines={1}>
                      {familyConv.last_message
                        ? `${familyConv.last_message.sender_name}: ${familyConv.last_message.media_url ? t('media_attachment') : familyConv.last_message.text}`
                        : t('family_chat')}
                    </AppText>
                    {familyConv.unread_count > 0 && (
                      <View style={[s.unreadDot, { backgroundColor: theme.primary }]}>
                        <AppText style={s.unreadCount}>{familyConv.unread_count}</AppText>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* DMs */}
          <View style={s.section}>
            <AppText style={[s.sectionLabel, { color: theme.dim }]}>{t('direct_messages')}</AppText>
          </View>

          {loading ? (
            <ActivityIndicator color={theme.primary} style={{ marginTop: 40 }} />
          ) : conversations.length === 0 ? (
            <View style={s.emptyWrap}>
              <Ionicons name="chatbubbles-outline" size={48} color={theme.dim} />
              <AppText style={[s.emptyTitle, { color: theme.text }]}>{t('no_messages')}</AppText>
              <AppText style={[s.emptyText, { color: theme.muted }]}>{t('no_messages_sub')}</AppText>
            </View>
          ) : (
            <FlatList
              data={[...conversations.filter(c => !archivedIds.has(c.id))].sort((a, b) => (pinnedIds.has(b.id) ? 1 : 0) - (pinnedIds.has(a.id) ? 1 : 0))}
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
  searchRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  dmBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full, borderWidth: 1, borderColor: colors.primary },
  dmBtnText: { fontSize: 12, fontWeight: '700' },
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
