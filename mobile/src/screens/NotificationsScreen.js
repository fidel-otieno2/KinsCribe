import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Image, RefreshControl, Animated,
  SectionList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { colors, radius } from '../theme';

// ── helpers ───────────────────────────────────────────────────────────────────
function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const TYPE_CONFIG = {
  like: {
    icon: 'heart',
    color: '#e11d48',
    bg: 'rgba(225,29,72,0.15)',
    label: (n) => `liked your story`,
  },
  comment: {
    icon: 'chatbubble',
    color: '#3b82f6',
    bg: 'rgba(59,130,246,0.15)',
    label: (n) => `commented on your story`,
  },
  new_story: {
    icon: 'library',
    color: '#7c3aed',
    bg: 'rgba(124,58,237,0.15)',
    label: (n) => `shared a new story`,
  },
};

// ── Avatar component ──────────────────────────────────────────────────────────
function Avatar({ url, name, size = 46 }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
      {url
        ? <Image source={{ uri: url }} style={{ width: size, height: size }} />
        : <Text style={{ color: '#fff', fontWeight: '700', fontSize: size * 0.38 }}>{name?.[0]?.toUpperCase() || '?'}</Text>}
    </View>
  );
}

// ── Media thumbnail ───────────────────────────────────────────────────────────
function MediaThumb({ url, type }) {
  if (!url) return null;
  if (type === 'image') {
    return <Image source={{ uri: url }} style={s.thumb} />;
  }
  if (type === 'video') {
    return (
      <View style={[s.thumb, s.thumbVideo]}>
        <Ionicons name="play-circle" size={20} color="#fff" />
      </View>
    );
  }
  if (type === 'audio') {
    return (
      <View style={[s.thumb, s.thumbAudio]}>
        <Ionicons name="musical-notes" size={16} color="#7c3aed" />
      </View>
    );
  }
  return (
    <View style={[s.thumb, s.thumbText]}>
      <Ionicons name="document-text" size={16} color={colors.muted} />
    </View>
  );
}

// ── Single notification row ───────────────────────────────────────────────────
function NotifRow({ item, isRead, onPress, index }) {
  const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.like;
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 300,
      delay: index * 40,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={{
      opacity: anim,
      transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
    }}>
      <TouchableOpacity
        style={[s.row, !isRead && s.rowUnread]}
        onPress={() => onPress(item)}
        activeOpacity={0.75}
      >
        {!isRead && <View style={s.unreadDot} />}

        {/* Actor avatar with type icon badge */}
        <View style={s.avatarWrap}>
          <Avatar url={item.actor_avatar} name={item.actor_name} size={46} />
          <View style={[s.typeBadge, { backgroundColor: cfg.bg }]}>
            <Ionicons name={cfg.icon} size={11} color={cfg.color} />
          </View>
        </View>

        {/* Text */}
        <View style={s.textWrap}>
          <Text style={s.rowText} numberOfLines={2}>
            <Text style={s.actorName}>{item.actor_name} </Text>
            <Text style={s.action}>{cfg.label(item)}</Text>
            {item.story_title ? <Text style={s.storyTitle}> "{item.story_title}"</Text> : null}
          </Text>
          {item.comment_text ? (
            <Text style={s.commentPreview} numberOfLines={1}>"{item.comment_text}"</Text>
          ) : null}
          <Text style={s.time}>{timeAgo(item.created_at)}</Text>
        </View>

        {/* Media thumbnail */}
        <MediaThumb url={item.story_media} type={item.story_media_type} />
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function NotificationsScreen({ navigation }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [readIds, setReadIds] = useState(new Set());
  const [tab, setTab] = useState('all'); // all | likes | comments | stories
  const STORAGE_KEY = `notifs_read_${user?.id}`;

  const loadReadIds = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) setReadIds(new Set(JSON.parse(raw)));
    } catch {}
  }, [STORAGE_KEY]);

  const markAllRead = useCallback(async (notifs) => {
    const ids = notifs.map(n => n.id);
    const newSet = new Set(ids);
    setReadIds(newSet);
    try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ids)); } catch {}
  }, [STORAGE_KEY]);

  const fetchNotifications = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await api.get('/stories/notifications');
      setNotifications(data.notifications || []);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadReadIds();
    fetchNotifications();
  }, []);

  useFocusEffect(useCallback(() => {
    fetchNotifications(true);
  }, [fetchNotifications]));

  const handlePress = useCallback(async (item) => {
    // Mark this one as read
    const newSet = new Set([...readIds, item.id]);
    setReadIds(newSet);
    try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...newSet])); } catch {}
    // Navigate to feed
    navigation.navigate('Main', { screen: 'Feed' });
  }, [readIds, STORAGE_KEY, navigation]);

  const handleMarkAllRead = useCallback(() => {
    markAllRead(notifications);
  }, [notifications, markAllRead]);

  // Filter by tab
  const filtered = notifications.filter(n => {
    if (tab === 'all') return true;
    if (tab === 'likes') return n.type === 'like';
    if (tab === 'comments') return n.type === 'comment';
    if (tab === 'stories') return n.type === 'new_story';
    return true;
  });

  const unreadCount = notifications.filter(n => !readIds.has(n.id)).length;

  // Group into Today / This Week / Earlier
  const grouped = (() => {
    const now = Date.now();
    const today = [], week = [], earlier = [];
    filtered.forEach(n => {
      const diff = (now - new Date(n.created_at)) / 1000;
      if (diff < 86400) today.push(n);
      else if (diff < 604800) week.push(n);
      else earlier.push(n);
    });
    const sections = [];
    if (today.length) sections.push({ title: 'Today', data: today });
    if (week.length) sections.push({ title: 'This Week', data: week });
    if (earlier.length) sections.push({ title: 'Earlier', data: earlier });
    return sections;
  })();

  const TABS = [
    { key: 'all', label: 'All', icon: 'notifications' },
    { key: 'likes', label: 'Likes', icon: 'heart' },
    { key: 'comments', label: 'Comments', icon: 'chatbubble' },
    { key: 'stories', label: 'Stories', icon: 'library' },
  ];

  return (
    <View style={s.container}>
      <LinearGradient colors={['#0f172a', '#1a0f2e', '#0f172a']} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={s.unreadBadge}>
              <Text style={s.unreadBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllRead} style={s.markAllBtn}>
            <Text style={s.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[s.tab, tab === t.key && s.tabActive]}
            onPress={() => setTab(t.key)}
          >
            <Ionicons
              name={tab === t.key ? t.icon : `${t.icon}-outline`}
              size={16}
              color={tab === t.key ? '#fff' : colors.muted}
            />
            <Text style={[s.tabText, tab === t.key && s.tabTextActive]}>{t.label}</Text>
            {t.key !== 'all' && notifications.filter(n => n.type === (t.key === 'stories' ? 'new_story' : t.key.slice(0, -1)) && !readIds.has(n.id)).length > 0 && (
              <View style={s.tabDot} />
            )}
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={s.loadingText}>Loading notifications...</Text>
        </View>
      ) : grouped.length === 0 ? (
        <View style={s.empty}>
          <LinearGradient colors={['rgba(124,58,237,0.2)', 'rgba(59,130,246,0.1)']} style={s.emptyIcon}>
            <Ionicons name="notifications-off-outline" size={40} color={colors.dim} />
          </LinearGradient>
          <Text style={s.emptyTitle}>
            {tab === 'all' ? 'No notifications yet' : `No ${tab} yet`}
          </Text>
          <Text style={s.emptyBody}>
            {tab === 'all'
              ? 'When family members like or comment on your stories, you\'ll see it here.'
              : `${tab === 'likes' ? 'Likes' : tab === 'comments' ? 'Comments' : 'New stories'} will appear here.`}
          </Text>
        </View>
      ) : (
        <SectionList
          sections={grouped}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.list}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchNotifications(true); }}
              tintColor={colors.primary}
            />
          }
          renderSectionHeader={({ section: { title, data } }) => (
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>{title}</Text>
              <Text style={s.sectionCount}>{data.length}</Text>
            </View>
          )}
          renderItem={({ item, index }) => (
            <NotifRow
              item={item}
              isRead={readIds.has(item.id)}
              onPress={handlePress}
              index={index}
            />
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  // header
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 52, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 0.5, borderBottomColor: colors.border, gap: 10 },
  backBtn: { padding: 4 },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: colors.text },
  unreadBadge: { backgroundColor: '#e11d48', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  unreadBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  markAllBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: 'rgba(124,58,237,0.15)', borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)' },
  markAllText: { color: '#a78bfa', fontSize: 12, fontWeight: '600' },

  // tabs
  tabs: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 10, gap: 6, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: radius.full, backgroundColor: 'rgba(30,41,59,0.5)', borderWidth: 1, borderColor: colors.border2, position: 'relative' },
  tabActive: { backgroundColor: 'rgba(124,58,237,0.25)', borderColor: 'rgba(124,58,237,0.5)' },
  tabText: { fontSize: 11, fontWeight: '600', color: colors.muted },
  tabTextActive: { color: '#fff' },
  tabDot: { position: 'absolute', top: 4, right: 4, width: 6, height: 6, borderRadius: 3, backgroundColor: '#e11d48' },

  // list
  list: { paddingBottom: 100 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 18, paddingBottom: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
  sectionCount: { fontSize: 12, color: colors.dim, fontWeight: '600' },

  // row
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  rowUnread: { backgroundColor: 'rgba(124,58,237,0.06)' },
  unreadDot: { position: 'absolute', left: 4, width: 6, height: 6, borderRadius: 3, backgroundColor: '#7c3aed' },
  avatarWrap: { position: 'relative' },
  typeBadge: { position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.bg },
  textWrap: { flex: 1 },
  rowText: { fontSize: 13, color: colors.text, lineHeight: 18, marginBottom: 3 },
  actorName: { fontWeight: '700', color: colors.text },
  action: { color: colors.muted },
  storyTitle: { color: '#a78bfa', fontWeight: '600' },
  commentPreview: { fontSize: 12, color: colors.muted, fontStyle: 'italic', marginBottom: 3 },
  time: { fontSize: 11, color: colors.dim },

  // thumbnail
  thumb: { width: 52, height: 52, borderRadius: 8, overflow: 'hidden' },
  thumbVideo: { backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' },
  thumbAudio: { backgroundColor: 'rgba(124,58,237,0.15)', alignItems: 'center', justifyContent: 'center' },
  thumbText: { backgroundColor: colors.bgSecondary, alignItems: 'center', justifyContent: 'center' },

  // loading
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: colors.muted, fontSize: 14 },

  // empty
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 14 },
  emptyIcon: { width: 90, height: 90, borderRadius: 45, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center' },
  emptyBody: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 22 },
});
