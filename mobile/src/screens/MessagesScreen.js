import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, FlatList, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, StatusBar, TextInput,
  Alert, Animated, Dimensions,
} from 'react-native';
import AppText from '../components/AppText';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { colors, radius, gradients } from '../theme';
import { useTranslation } from '../i18n';

const { width } = Dimensions.get('window');

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function Avatar({ uri, name, size = 52, online = false, showRing = false }) {
  return (
    <View style={{ width: size, height: size }}>
      {showRing ? (
        <LinearGradient
          colors={gradients.primary}
          style={{ width: size, height: size, borderRadius: size / 2, padding: 2, alignItems: 'center', justifyContent: 'center' }}
        >
          {uri
            ? <Image source={{ uri }} style={{ width: size - 6, height: size - 6, borderRadius: (size - 6) / 2, borderWidth: 2, borderColor: colors.bg }} />
            : <View style={[ms.avatarFallback, { width: size - 6, height: size - 6, borderRadius: (size - 6) / 2 }]}>
                <AppText style={{ color: '#fff', fontWeight: '800', fontSize: (size - 6) * 0.38 }}>{name?.[0]?.toUpperCase() || '?'}</AppText>
              </View>}
        </LinearGradient>
      ) : (
        uri
          ? <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
          : <View style={[ms.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
              <AppText style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.38 }}>{name?.[0]?.toUpperCase() || '?'}</AppText>
            </View>
      )}
      {online && (
        <View style={[ms.onlineDot, { width: size * 0.28, height: size * 0.28, borderRadius: size * 0.14, bottom: 1, right: 1 }]} />
      )}
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
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [convSettings, setConvSettings] = useState({});
  const [requestCount, setRequestCount] = useState(0);
  const [openingDM, setOpeningDM] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const searchAnim = useRef(new Animated.Value(0)).current;
  const [searchFocused, setSearchFocused] = useState(false);

  const fetchConversations = async () => {
    try {
      const [convRes, settingsRes, reqRes] = await Promise.all([
        api.get('/messages/conversations'),
        api.get('/messages/conversations/settings/all').catch(() => ({ data: {} })),
        api.get('/messages/requests').catch(() => ({ data: { requests: [] } })),
      ]);
      const all = convRes.data.conversations || [];
      setFamilyConv(all.find(c => c.type === 'family') || null);
      setConversations(all.filter(c => c.type === 'private'));
      setConvSettings(settingsRes.data || {});
      setRequestCount((reqRes.data.requests || []).length);
    } catch {} finally { setLoading(false); }
  };

  const updateSetting = async (convId, key, value) => {
    setConvSettings(prev => ({
      ...prev,
      [String(convId)]: { ...(prev[String(convId)] || {}), [key]: value },
    }));
    try { await api.patch(`/messages/conversations/${convId}/settings`, { [key]: value }); } catch {}
  };

  useFocusEffect(useCallback(() => {
    fetchConversations();
    api.get('/messages/family').then(({ data }) => setFamilyConv(data.conversation)).catch(() => {});
  }, []));

  const handleSearch = async (q) => {
    setSearch(q);
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const { data } = await api.get(`/connections/search?q=${encodeURIComponent(q)}`);
      setSearchResults(data.users || []);
    } catch {} finally { setSearching(false); }
  };

  const openDM = async (userId, userName, userAvatar) => {
    if (openingDM) return;
    setOpeningDM(userId);
    setSearch(''); setSearchResults([]);
    try {
      const { data } = await api.post(`/messages/dm/${userId}`);
      navigation.navigate('Chat', { conversationId: data.conversation.id, title: userName, avatar: userAvatar, type: 'private', otherUserId: userId });
    } catch (err) {
      if (err.response?.data?.conversation) {
        navigation.navigate('Chat', { conversationId: err.response.data.conversation.id, title: userName, avatar: userAvatar, type: 'private', otherUserId: userId });
      } else {
        Alert.alert('Error', err.response?.data?.error || 'Could not open conversation.');
      }
    } finally { setOpeningDM(null); }
  };

  const openConv = (conv) => {
    const title = conv.type === 'family' ? 'Family Chat' : conv.other_user?.name || 'Chat';
    navigation.navigate('Chat', {
      conversationId: conv.id, title,
      avatar: conv.type === 'private' ? conv.other_user?.avatar : null,
      type: conv.type, otherUserId: conv.other_user?.id,
    });
  };

  const getFilteredConvs = () => {
    let list = conversations.filter(c => !convSettings[String(c.id)]?.is_archived);
    if (activeFilter === 'unread') list = list.filter(c => c.unread_count > 0);
    if (activeFilter === 'pinned') list = list.filter(c => convSettings[String(c.id)]?.is_pinned);
    return list.sort((a, b) => (convSettings[String(b.id)]?.is_pinned ? 1 : 0) - (convSettings[String(a.id)]?.is_pinned ? 1 : 0));
  };

  const renderDM = ({ item, index }) => {
    const other = item.other_user;
    const lastMsg = item.last_message;
    const unread = item.unread_count > 0;
    const cfg = convSettings[String(item.id)] || {};
    const isPinned = cfg.is_pinned || false;
    const isMuted = cfg.is_muted || false;
    const isOnline = other?.is_online;

    return (
      <TouchableOpacity
        style={[ms.dmRow, isPinned && ms.dmRowPinned]}
        onPress={() => openConv(item)}
        onLongPress={() => Alert.alert(
          other?.name || 'Chat', '',
          [
            { text: isPinned ? '📌 Unpin' : '📌 Pin to top', onPress: () => updateSetting(item.id, 'is_pinned', !isPinned) },
            { text: isMuted ? '🔔 Unmute' : '🔕 Mute', onPress: () => updateSetting(item.id, 'is_muted', !isMuted) },
            { text: '📁 Archive', onPress: () => updateSetting(item.id, 'is_archived', true) },
            { text: 'Cancel', style: 'cancel' },
          ]
        )}
        activeOpacity={0.75}
      >
        <Avatar uri={other?.avatar} name={other?.name} size={54} online={isOnline} />
        <View style={ms.dmInfo}>
          <View style={ms.dmTop}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 }}>
              {isPinned && <Ionicons name="pin" size={11} color={colors.gold} />}
              <AppText style={[ms.dmName, unread && ms.dmNameUnread]} numberOfLines={1}>{other?.name || 'User'}</AppText>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              {isMuted && <Ionicons name="notifications-off-outline" size={12} color={colors.dim} />}
              <AppText style={ms.dmTime}>{timeAgo(lastMsg?.created_at)}</AppText>
            </View>
          </View>
          <View style={ms.dmBottom}>
            <AppText
              style={[ms.dmPreview, unread && ms.dmPreviewUnread]}
              numberOfLines={1}
            >
              {lastMsg
                ? lastMsg.media_url
                  ? lastMsg.media_type === 'audio' ? '🎤 Voice message' : lastMsg.media_type === 'video' ? '🎥 Video' : '📷 Photo'
                  : lastMsg.text
                : 'Start a conversation'}
            </AppText>
            {unread && !isMuted && (
              <View style={ms.unreadBadge}>
                <AppText style={ms.unreadBadgeText}>{item.unread_count > 9 ? '9+' : item.unread_count}</AppText>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'unread', label: 'Unread' },
    { key: 'pinned', label: 'Pinned' },
  ];

  return (
    <View style={[ms.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <LinearGradient colors={[theme.bg, theme.bg]} style={ms.header}>
        <View style={ms.headerLeft}>
          <AppText style={[ms.headerTitle, { color: theme.text }]}>Messages</AppText>
          {requestCount > 0 && (
            <View style={ms.headerBadge}>
              <AppText style={ms.headerBadgeText}>{requestCount}</AppText>
            </View>
          )}
        </View>
        <View style={ms.headerActions}>
          <TouchableOpacity
            style={[ms.headerBtn, { backgroundColor: theme.bgSecondary }]}
            onPress={() => navigation.navigate('MessageRequests')}
          >
            <Ionicons name="mail-outline" size={20} color={theme.text} />
            {requestCount > 0 && <View style={ms.btnBadge}><AppText style={ms.btnBadgeText}>{requestCount}</AppText></View>}
          </TouchableOpacity>
          <TouchableOpacity
            style={[ms.headerBtn, { backgroundColor: theme.bgSecondary }]}
            onPress={() => navigation.navigate('Search')}
          >
            <Ionicons name="person-add-outline" size={20} color={theme.text} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Search Bar */}
      <View style={ms.searchContainer}>
        <View style={[ms.searchBar, { backgroundColor: theme.bgSecondary }, searchFocused && ms.searchBarFocused]}>
          <Ionicons name="search" size={16} color={searchFocused ? colors.primary : theme.dim} />
          <TextInput
            style={[ms.searchInput, { color: theme.text }]}
            placeholder="Search people, messages..."
            placeholderTextColor={theme.dim}
            value={search}
            onChangeText={handleSearch}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
          {search ? (
            <TouchableOpacity onPress={() => { setSearch(''); setSearchResults([]); }}>
              <View style={ms.searchClear}>
                <Ionicons name="close" size={12} color="#fff" />
              </View>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {search ? (
        /* ── Search Results ── */
        <FlatList
          data={searchResults}
          keyExtractor={i => String(i.id)}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 100 }}
          ListHeaderComponent={
            searching
              ? <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} />
              : searchResults.length === 0
                ? <View style={ms.emptySearch}>
                    <Ionicons name="search-outline" size={40} color={colors.dim} />
                    <AppText style={[ms.emptyTitle, { color: theme.muted }]}>No results for "{search}"</AppText>
                  </View>
                : <AppText style={[ms.sectionLabel, { color: theme.dim, marginBottom: 8 }]}>PEOPLE</AppText>
          }
          renderItem={({ item: u }) => (
            <TouchableOpacity
              style={[ms.searchRow, { borderBottomColor: theme.border }]}
              onPress={() => openDM(u.id, u.name, u.avatar_url)}
              disabled={openingDM === u.id}
              activeOpacity={0.75}
            >
              <Avatar uri={u.avatar_url} name={u.name} size={48} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <AppText style={[ms.dmName, { color: theme.text }]}>{u.name}</AppText>
                <AppText style={[ms.dmPreview, { color: theme.muted }]}>@{u.username || 'user'}</AppText>
              </View>
              {openingDM === u.id
                ? <ActivityIndicator size="small" color={colors.primary} />
                : <TouchableOpacity
                    style={ms.msgBtn}
                    onPress={() => openDM(u.id, u.name, u.avatar_url)}
                  >
                    <LinearGradient colors={gradients.primary} style={ms.msgBtnGrad}>
                      <Ionicons name="chatbubble" size={14} color="#fff" />
                      <AppText style={ms.msgBtnText}>Message</AppText>
                    </LinearGradient>
                  </TouchableOpacity>}
            </TouchableOpacity>
          )}
        />
      ) : (
        <FlatList
          data={getFilteredConvs()}
          keyExtractor={i => String(i.id)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListHeaderComponent={
            <>
              {/* Family Chat Hero Card */}
              {familyConv && (
                <TouchableOpacity
                  style={ms.familyCard}
                  onPress={() => openConv(familyConv)}
                  activeOpacity={0.88}
                >
                  <LinearGradient
                    colors={['#1C3A18', '#2D5A27', '#4A7C3F']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={ms.familyCardGrad}
                  >
                    {/* Decorative circles */}
                    <View style={ms.familyDeco1} />
                    <View style={ms.familyDeco2} />

                    <View style={ms.familyCardLeft}>
                      <View style={ms.familyIconWrap}>
                        <LinearGradient colors={['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.08)']} style={ms.familyIconGrad}>
                          <Ionicons name="people" size={26} color="#fff" />
                        </LinearGradient>
                        {familyConv.unread_count > 0 && (
                          <View style={ms.familyUnread}>
                            <AppText style={ms.familyUnreadText}>{familyConv.unread_count}</AppText>
                          </View>
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <AppText style={ms.familyCardTitle}>Family Chat</AppText>
                          <View style={ms.familyBadge}>
                            <AppText style={ms.familyBadgeText}>FAMILY</AppText>
                          </View>
                        </View>
                        <AppText style={ms.familyCardPreview} numberOfLines={1}>
                          {familyConv.last_message
                            ? `${familyConv.last_message.sender_name}: ${familyConv.last_message.media_url ? '📎 Media' : familyConv.last_message.text}`
                            : 'Your family space 🏡'}
                        </AppText>
                      </View>
                    </View>
                    <View style={ms.familyCardRight}>
                      <AppText style={ms.familyCardTime}>{timeAgo(familyConv.last_message?.created_at)}</AppText>
                      <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.5)" />
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              )}

              {/* Filter Tabs */}
              <View style={ms.filterRow}>
                {FILTERS.map(f => (
                  <TouchableOpacity
                    key={f.key}
                    style={[ms.filterTab, activeFilter === f.key && ms.filterTabActive]}
                    onPress={() => setActiveFilter(f.key)}
                  >
                    {activeFilter === f.key
                      ? <LinearGradient colors={gradients.primary} style={ms.filterTabGrad}>
                          <AppText style={ms.filterTabTextActive}>{f.label}</AppText>
                        </LinearGradient>
                      : <AppText style={[ms.filterTabText, { color: colors.muted }]}>{f.label}</AppText>}
                  </TouchableOpacity>
                ))}
              </View>

              {/* Section label */}
              <View style={ms.sectionRow}>
                <AppText style={ms.sectionLabel}>DIRECT MESSAGES</AppText>
                <AppText style={[ms.sectionCount, { color: colors.dim }]}>{getFilteredConvs().length}</AppText>
              </View>
            </>
          }
          renderItem={renderDM}
          ListEmptyComponent={
            loading
              ? <ActivityIndicator color={colors.primary} style={{ marginTop: 50 }} />
              : <View style={ms.emptyWrap}>
                  <LinearGradient colors={['rgba(74,124,63,0.15)', 'rgba(74,124,63,0.05)']} style={ms.emptyIcon}>
                    <Ionicons name="chatbubbles-outline" size={36} color={colors.primary} />
                  </LinearGradient>
                  <AppText style={[ms.emptyTitle, { color: colors.text }]}>No conversations yet</AppText>
                  <AppText style={[ms.emptySubtitle, { color: colors.muted }]}>Search for people above to start chatting</AppText>
                  <TouchableOpacity style={ms.emptyBtn} onPress={() => navigation.navigate('Search')}>
                    <LinearGradient colors={gradients.primary} style={ms.emptyBtnGrad}>
                      <Ionicons name="person-add" size={16} color="#fff" />
                      <AppText style={ms.emptyBtnText}>Find People</AppText>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
          }
        />
      )}
    </View>
  );
}

const ms = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 56, paddingBottom: 10, paddingHorizontal: 20 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  headerBadge: { backgroundColor: colors.primary, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  headerBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  btnBadge: { position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, borderWidth: 1.5, borderColor: colors.bg },
  btnBadgeText: { display: 'none' },

  // Search
  searchContainer: { paddingHorizontal: 16, paddingBottom: 12 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1.5, borderColor: 'transparent' },
  searchBarFocused: { borderColor: colors.primary },
  searchInput: { flex: 1, fontSize: 15 },
  searchClear: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.dim, alignItems: 'center', justifyContent: 'center' },

  // Family Card
  familyCard: { marginHorizontal: 16, marginBottom: 16, borderRadius: 20, overflow: 'hidden', shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  familyCardGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, overflow: 'hidden' },
  familyDeco1: { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.05)', top: -40, right: -20 },
  familyDeco2: { position: 'absolute', width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(196,163,90,0.1)', bottom: -30, left: 60 },
  familyCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  familyIconWrap: { position: 'relative' },
  familyIconGrad: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  familyUnread: { position: 'absolute', top: -4, right: -4, backgroundColor: colors.gold, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: colors.primaryDark },
  familyUnreadText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  familyCardTitle: { fontSize: 16, fontWeight: '800', color: '#fff' },
  familyBadge: { backgroundColor: 'rgba(196,163,90,0.3)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(196,163,90,0.5)' },
  familyBadgeText: { color: colors.gold, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  familyCardPreview: { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  familyCardRight: { alignItems: 'flex-end', gap: 4 },
  familyCardTime: { fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },

  // Filters
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 12 },
  filterTab: { borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  filterTabActive: { borderColor: 'transparent' },
  filterTabGrad: { paddingHorizontal: 16, paddingVertical: 7 },
  filterTabText: { paddingHorizontal: 16, paddingVertical: 7, fontSize: 13, fontWeight: '600' },
  filterTabTextActive: { fontSize: 13, fontWeight: '700', color: '#fff' },

  // Section
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 4 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: colors.dim, letterSpacing: 1 },
  sectionCount: { fontSize: 11, fontWeight: '600' },

  // DM Row
  dmRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 11 },
  dmRowPinned: { backgroundColor: 'rgba(74,124,63,0.06)' },
  dmInfo: { flex: 1 },
  dmTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 },
  dmName: { fontSize: 15, fontWeight: '600', color: colors.text, flex: 1 },
  dmNameUnread: { fontWeight: '800', color: colors.text },
  dmTime: { fontSize: 11, color: colors.dim, fontWeight: '500' },
  dmBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dmPreview: { fontSize: 13, color: colors.muted, flex: 1 },
  dmPreviewUnread: { color: colors.text, fontWeight: '600' },
  unreadBadge: { backgroundColor: colors.primary, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, marginLeft: 8 },
  unreadBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  // Avatar
  avatarFallback: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  onlineDot: { position: 'absolute', backgroundColor: '#22c55e', borderWidth: 2, borderColor: colors.bg },

  // Search results
  searchRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5 },
  msgBtn: { borderRadius: 20, overflow: 'hidden' },
  msgBtnGrad: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8 },
  msgBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // Empty
  emptySearch: { alignItems: 'center', marginTop: 60, gap: 10 },
  emptyWrap: { alignItems: 'center', marginTop: 50, gap: 12, paddingHorizontal: 40 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  emptySubtitle: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
  emptyBtn: { borderRadius: 24, overflow: 'hidden', marginTop: 4 },
  emptyBtnGrad: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
