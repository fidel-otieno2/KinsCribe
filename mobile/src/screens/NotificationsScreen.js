import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Image, RefreshControl, Animated,
  Modal, ScrollView,
} from 'react-native';
import AppText from '../components/AppText';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../i18n';
import { colors, radius } from '../theme';

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr + (dateStr.endsWith('Z') ? '' : 'Z'))) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const TYPE_CONFIG = {
  story_like:       { icon: 'heart',           color: '#e11d48', bg: 'rgba(225,29,72,0.18)',    label: 'liked your family story',        source: 'Family Story', sourceBg: '#3b0764', sourceColor: '#a78bfa' },
  story_comment:    { icon: 'chatbubble',       color: '#3b82f6', bg: 'rgba(59,130,246,0.18)',   label: 'commented on your family story', source: 'Family Story', sourceBg: '#3b0764', sourceColor: '#a78bfa' },
  new_family_story: { icon: 'library',          color: '#a78bfa', bg: 'rgba(167,139,250,0.18)',  label: 'shared a family story',          source: 'Family Story', sourceBg: '#3b0764', sourceColor: '#a78bfa' },
  post_like:        { icon: 'heart',            color: '#e11d48', bg: 'rgba(225,29,72,0.18)',    label: 'liked your post',                source: 'Post',         sourceBg: '#1e3a8a', sourceColor: '#60a5fa' },
  post_comment:     { icon: 'chatbubble',       color: '#3b82f6', bg: 'rgba(59,130,246,0.18)',   label: 'commented on your post',         source: 'Post',         sourceBg: '#1e3a8a', sourceColor: '#60a5fa' },
  post_share:       { icon: 'paper-plane',      color: '#06b6d4', bg: 'rgba(6,182,212,0.18)',    label: 'shared your post',               source: 'Post',         sourceBg: '#1e3a8a', sourceColor: '#60a5fa' },
  connection:       { icon: 'person-add',       color: '#10b981', bg: 'rgba(16,185,129,0.18)',   label: 'connected with you',             source: 'Connection',   sourceBg: '#064e3b', sourceColor: '#34d399' },
  follow_request:   { icon: 'person-add',       color: '#f59e0b', bg: 'rgba(245,158,11,0.18)',   label: 'wants to follow you',            source: 'Follow Request', sourceBg: '#78350f', sourceColor: '#fbbf24' },
  message:          { icon: 'chatbubbles',      color: '#f59e0b', bg: 'rgba(245,158,11,0.18)',   label: 'sent you a message',             source: 'Message',      sourceBg: '#78350f', sourceColor: '#fbbf24' },
  birthday:         { icon: 'gift',             color: '#f59e0b', bg: 'rgba(245,158,11,0.18)',   label: '',                               source: 'Birthday',     sourceBg: '#78350f', sourceColor: '#fbbf24' },
  collab_invite:    { icon: 'people',           color: '#a78bfa', bg: 'rgba(124,58,237,0.18)',   label: 'invited you to co-create',       source: 'Collab',       sourceBg: '#3b0764', sourceColor: '#a78bfa' },
  family_invite:    { icon: 'home',             color: '#10b981', bg: 'rgba(16,185,129,0.18)',   label: 'invited you to join their family', source: 'Family',     sourceBg: '#064e3b', sourceColor: '#34d399' },
  family_invite_accepted: { icon: 'checkmark-circle', color: '#10b981', bg: 'rgba(16,185,129,0.18)', label: 'accepted your family invitation', source: 'Family', sourceBg: '#064e3b', sourceColor: '#34d399' },
  story_mention:    { icon: 'at',               color: '#7c3aed', bg: 'rgba(124,58,237,0.18)',   label: 'mentioned you in a story',       source: 'Story',        sourceBg: '#3b0764', sourceColor: '#a78bfa' },
};

function Avatar({ url, name, size = 48 }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
      {url
        ? <Image source={{ uri: url }} style={{ width: size, height: size }} />
        : <AppText style={{ color: '#fff', fontWeight: '700', fontSize: size * 0.38 }}>{name?.[0]?.toUpperCase() || '?'}</AppText>}
    </View>
  );
}

// Animated typing dots
function TypingDots() {
  const d1 = useRef(new Animated.Value(0)).current;
  const d2 = useRef(new Animated.Value(0)).current;
  const d3 = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = (dot, delay) => Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(dot, { toValue: -6, duration: 300, useNativeDriver: true }),
        Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.delay(600),
      ])
    ).start();
    anim(d1, 0); anim(d2, 150); anim(d3, 300);
  }, []);
  return (
    <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
      {[d1, d2, d3].map((d, i) => (
        <Animated.View key={i} style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.primary, transform: [{ translateY: d }] }} />
      ))}
    </View>
  );
}

function NotifRow({ item, onPress, index, onAccept, onDecline, refreshUser }) {
  const { t } = useTranslation();
  const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.post_like;
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: 1, delay: index * 40, useNativeDriver: true, tension: 80, friction: 10 }).start();
  }, []);

  return (
    <Animated.View style={{ opacity: anim, transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) }] }}>
      <TouchableOpacity
        style={[s.row, !item.is_read && s.rowUnread]}
        onPress={() => onPress(item)}
        activeOpacity={0.75}
      >
        {!item.is_read && <View style={s.unreadBar} />}

        <View style={s.avatarWrap}>
          <Avatar url={item.actor_avatar} name={item.actor_name} size={48} />
          <View style={[s.typeBadge, { backgroundColor: cfg.bg, borderColor: cfg.color + '44' }]}>
            <Ionicons name={cfg.icon} size={12} color={cfg.color} />
          </View>
        </View>

        <View style={s.textWrap}>
          <AppText style={s.rowText} numberOfLines={2}>
            <AppText style={s.actorName}>{item.actor_name} </AppText>
            <AppText style={s.action}>{item.title?.replace(item.actor_name, '').trim() || cfg.label}</AppText>
          </AppText>
          {item.body ? <AppText style={s.bodyText} numberOfLines={1}>"{item.body}"</AppText> : null}

          {/* Follow request inline actions */}
          {item.type === 'follow_request' ? (
            <View style={s.requestBtns}>
              <TouchableOpacity style={s.acceptBtn} onPress={() => onAccept(item)}>
                <AppText style={s.acceptBtnText}>{t('confirm')}</AppText>
              </TouchableOpacity>
              <TouchableOpacity style={s.declineBtn} onPress={() => onDecline(item)}>
                <AppText style={s.declineBtnText}>{t('delete')}</AppText>
              </TouchableOpacity>
            </View>
          ) : item.type === 'collab_invite' ? (
            <View style={s.requestBtns}>
              <TouchableOpacity
                style={s.acceptBtn}
                onPress={async () => {
                  try {
                    await api.post(`/notifications/collab/${item.collab_id}/respond`, { action: 'accept' });
                    onAccept(item);
                  } catch {}
                }}
              >
                <AppText style={s.acceptBtnText}>Accept 👑</AppText>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.declineBtn}
                onPress={async () => {
                  try {
                    await api.post(`/notifications/collab/${item.collab_id}/respond`, { action: 'reject' });
                    onDecline(item);
                  } catch {}
                }}
              >
                <AppText style={s.declineBtnText}>Decline</AppText>
              </TouchableOpacity>
            </View>
          ) : item.type === 'family_invite' ? (
            <FamilyInviteActions item={item} onAccept={onAccept} onDecline={onDecline} refreshUser={refreshUser} />
          ) : (
            <View style={s.metaRow}>
              <View style={[s.sourcePill, { backgroundColor: cfg.sourceBg + '55', borderColor: cfg.sourceBg + '99' }]}>
                <View style={[s.sourceDot, { backgroundColor: cfg.sourceColor }]} />
                <AppText style={[s.sourceText, { color: cfg.sourceColor }]}>{cfg.source}</AppText>
              </View>
              <AppText style={s.time}>{timeAgo(item.created_at)}</AppText>
            </View>
          )}
        </View>

        {(item.story_media || item.post_media) && (
          <Image source={{ uri: item.story_media || item.post_media }} style={s.thumb} />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const TABS = [
  { key: 'all',         labelKey: 'all',          icon: 'notifications' },
  { key: 'requests',    labelKey: 'requests',      icon: 'person-add' },
  { key: 'family',      labelKey: 'family',        icon: 'people' },
  { key: 'posts',       labelKey: 'posts',         icon: 'grid' },
  { key: 'connections', labelKey: 'people',        icon: 'person' },
  { key: 'messages',    labelKey: 'messages',      icon: 'chatbubbles' },
];

function FamilyInviteActions({ item, onAccept, onDecline, refreshUser }) {
  const [loading, setLoading] = useState(null);
  const [done, setDone] = useState(null);

  const getToken = () => {
    try {
      const d = typeof item.data === 'string' ? JSON.parse(item.data) : item.data;
      return d?.token;
    } catch { return null; }
  };

  const handle = async (action) => {
    const token = getToken();
    if (!token) return;
    setLoading(action);
    try {
      await api.post(`/family/invite/${token}/${action}`);
      if (action === 'accept') {
        await refreshUser(); // auto-adds family to user context
      }
      setDone(action);
      action === 'accept' ? onAccept(item) : onDecline(item);
    } catch {}
    finally { setLoading(null); }
  };

  if (done) {
    return (
      <View style={{ paddingTop: 6 }}>
        <AppText style={{ color: done === 'accept' ? '#10b981' : '#94a3b8', fontSize: 12, fontWeight: '600' }}>
          {done === 'accept' ? '✅ Joined family!' : '❌ Declined'}
        </AppText>
      </View>
    );
  }

  return (
    <View style={s.requestBtns}>
      <TouchableOpacity
        style={s.acceptBtn}
        onPress={() => handle('accept')}
        disabled={!!loading}
      >
        {loading === 'accept'
          ? <ActivityIndicator size="small" color="#fff" />
          : <AppText style={s.acceptBtnText}>🏠 Join Family</AppText>}
      </TouchableOpacity>
      <TouchableOpacity
        style={s.declineBtn}
        onPress={() => handle('decline')}
        disabled={!!loading}
      >
        {loading === 'decline'
          ? <ActivityIndicator size="small" color="#94a3b8" />
          : <AppText style={s.declineBtnText}>Decline</AppText>}
      </TouchableOpacity>
    </View>
  );
}

export default function NotificationsScreen({ navigation }) {
  const { user, refreshUser } = useAuth();
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('all');
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDetail, setShowDetail] = useState(null);

  const fetchAndMarkRead = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await api.get('/notifications/');
      const notifs = data.notifications || [];
      setNotifications(notifs);
      setUnreadCount(data.unread_count || 0);
      // Mark all as read — this resets the badge
      if (notifs.some(n => !n.is_read)) {
        await api.post('/notifications/mark-read', { mark_all: true });
        setNotifications(notifs.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.log('notif error:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    fetchAndMarkRead();
  }, [fetchAndMarkRead]));

  const handlePress = useCallback((item) => {
    setShowDetail(item);
  }, []);

  const navigateFromDetail = (item) => {
    setShowDetail(null);
    if ((item.source === 'post' && item.post_id) || item.type === 'post_comment') {
      const postId = item.post_id || (item.data ? JSON.parse(typeof item.data === 'string' ? item.data : JSON.stringify(item.data))?.post_id : null);
      if (postId) {
        navigation.navigate('PostDetail', { postId, autoOpenComments: item.type === 'post_comment' });
        return;
      }
    }
    if (item.source === 'family_story' && item.story_id) {
      navigation.navigate('Family');
    } else if (item.source === 'connection' && item.actor_id) {
      navigation.navigate('UserProfile', { userId: item.actor_id, userName: item.actor_name, userAvatar: item.actor_avatar });
    } else if (item.type === 'message') {
      navigation.navigate('Main', { screen: 'Messages' });
    }
  };

  const handleAcceptRequest = useCallback(async (item) => {
    try {
      if (item.type === 'collab_invite') {
        setNotifications(prev => prev.filter(n => n.id !== item.id));
        return;
      }
      await api.post(`/connections/requests/${item.connection_id}/accept`);
      setNotifications(prev => prev.filter(n => n.id !== item.id));
    } catch (err) {
      console.log('accept error:', err.message);
    }
  }, []);

  const handleDeclineRequest = useCallback(async (item) => {
    try {
      if (item.type === 'collab_invite') {
        setNotifications(prev => prev.filter(n => n.id !== item.id));
        return;
      }
      await api.post(`/connections/requests/${item.connection_id}/decline`);
      setNotifications(prev => prev.filter(n => n.id !== item.id));
    } catch (err) {
      console.log('decline error:', err.message);
    }
  }, []);

  const filtered = notifications.filter(n => {
    if (tab === 'all') return true;
    if (tab === 'requests') return n.type === 'follow_request' || n.type === 'collab_invite' || n.type === 'family_invite';
    if (tab === 'family') return n.source === 'family_story' || n.source === 'family';
    if (tab === 'posts') return n.source === 'post';
    if (tab === 'connections') return n.type === 'connection';
    if (tab === 'messages') return n.type === 'message';
    return true;
  });

  const tabCounts = {
    all: notifications.filter(n => !n.is_read).length,
    requests: notifications.filter(n => n.type === 'follow_request' || n.type === 'collab_invite' || n.type === 'family_invite').length,
    family: notifications.filter(n => !n.is_read && (n.source === 'family_story' || n.source === 'family')).length,
    posts: notifications.filter(n => !n.is_read && n.source === 'post').length,
    connections: notifications.filter(n => !n.is_read && n.type === 'connection').length,
    messages: notifications.filter(n => !n.is_read && n.type === 'message').length,
  };

  const cfg = showDetail ? (TYPE_CONFIG[showDetail.type] || TYPE_CONFIG.post_like) : null;

  return (
    <View style={s.container}>
      <LinearGradient colors={['#0a0a1a', '#0f172a', '#0a0a1a']} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <AppText style={s.headerTitle}>{t('notifications')}</AppText>
          {unreadCount > 0 && <AppText style={s.headerSub}>{t('unread', { count: unreadCount })}</AppText>}
        </View>
        <TouchableOpacity
          style={s.markAllBtn}
          onPress={async () => {
            await api.post('/notifications/mark-read', { mark_all: true });
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            setUnreadCount(0);
          }}
        >
          <Ionicons name="checkmark-done" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabsRow}>
        {TABS.map(tb => {
          const count = tabCounts[tb.key];
          return (
            <TouchableOpacity
              key={tb.key}
              style={[s.tab, tab === tb.key && s.tabActive]}
              onPress={() => setTab(tb.key)}
            >
              <Ionicons
                name={tab === tb.key ? tb.icon : `${tb.icon}-outline`}
                size={14}
                color={tab === tb.key ? '#fff' : colors.muted}
              />
              <AppText style={[s.tabText, tab === tb.key && s.tabTextActive]}>{t(tb.labelKey)}</AppText>
              {count > 0 && (
                <View style={s.tabBadge}>
                  <AppText style={s.tabBadgeText}>{count > 9 ? '9+' : count}</AppText>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator color={colors.primary} size="large" />
          <AppText style={s.loadingText}>{t('loading_notifications')}</AppText>
        </View>
      ) : filtered.length === 0 ? (
        <View style={s.empty}>
          <LinearGradient colors={['rgba(124,58,237,0.2)', 'rgba(59,130,246,0.08)']} style={s.emptyIconWrap}>
            <Ionicons name="notifications-off-outline" size={44} color={colors.dim} />
          </LinearGradient>
          <AppText style={s.emptyTitle}>{t('all_caught_up')}</AppText>
          <AppText style={s.emptyBody}>{t('notif_empty_sub')}</AppText>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={({ item, index }) => (
            <NotifRow
              item={item}
              onPress={handlePress}
              index={index}
              onAccept={handleAcceptRequest}
              onDecline={handleDeclineRequest}
              refreshUser={refreshUser}
            />
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchAndMarkRead(true); }}
              tintColor={colors.primary}
            />
          }
        />
      )}

      {/* Notification Detail Modal */}
      <Modal visible={!!showDetail} transparent animationType="slide" onRequestClose={() => setShowDetail(null)}>
        <BlurView intensity={30} tint="dark" style={{ flex: 1, justifyContent: 'flex-end' }}>
          <View style={s.detailSheet}>
            <LinearGradient
              colors={['rgba(124,58,237,0.12)', '#0f172a']}
              style={StyleSheet.absoluteFill}
            />
            <View style={s.detailHandle} />
            <TouchableOpacity style={s.detailClose} onPress={() => setShowDetail(null)}>
              <Ionicons name="close" size={22} color={colors.muted} />
            </TouchableOpacity>

            {showDetail && cfg && (
              <>
                <View style={s.detailAvatarRow}>
                  <View style={[s.detailAvatarRing, { borderColor: cfg.color + '66' }]}>
                    <Avatar url={showDetail.actor_avatar} name={showDetail.actor_name} size={72} />
                  </View>
                  <View style={[s.detailTypeBadge, { backgroundColor: cfg.bg }]}>
                    <Ionicons name={cfg.icon} size={18} color={cfg.color} />
                  </View>
                </View>

                <AppText style={s.detailName}>{showDetail.actor_name}</AppText>
                <AppText style={s.detailAction}>{showDetail.title}</AppText>
                {showDetail.body ? (
                  <View style={s.detailBodyWrap}>
                    <AppText style={s.detailBody}>"{showDetail.body}"</AppText>
                  </View>
                ) : null}

                <View style={s.detailMeta}>
                  <View style={[s.sourcePill, { backgroundColor: cfg.sourceBg + '55', borderColor: cfg.sourceBg + '99' }]}>
                    <View style={[s.sourceDot, { backgroundColor: cfg.sourceColor }]} />
                    <AppText style={[s.sourceText, { color: cfg.sourceColor }]}>{cfg.source}</AppText>
                  </View>
                  <AppText style={s.detailTime}>{timeAgo(showDetail.created_at)}</AppText>
                </View>

                {(showDetail.story_media || showDetail.post_media) && (
                  <Image
                    source={{ uri: showDetail.story_media || showDetail.post_media }}
                    style={s.detailMedia}
                    resizeMode="cover"
                  />
                )}

                <View style={s.detailActions}>
                  <TouchableOpacity
                    style={s.detailViewBtn}
                    onPress={() => navigateFromDetail(showDetail)}
                  >
                    <LinearGradient colors={['#7c3aed', '#3b82f6']} style={s.detailViewBtnGrad}>
                      <Ionicons name="arrow-forward" size={16} color="#fff" />
                      <AppText style={s.detailViewBtnText}>{t('view')}</AppText>
                    </LinearGradient>
                  </TouchableOpacity>
                  {showDetail.actor_id && (
                    <TouchableOpacity
                      style={s.detailProfileBtn}
                      onPress={() => {
                        setShowDetail(null);
                        navigation.navigate('UserProfile', { userId: showDetail.actor_id, userName: showDetail.actor_name, userAvatar: showDetail.actor_avatar });
                      }}
                    >
                      <Ionicons name="person-outline" size={16} color={colors.text} />
                      <AppText style={s.detailProfileBtnText}>{t('profile')}</AppText>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}
          </View>
        </BlurView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a1a' },

  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 12, gap: 12 },
  backBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 24, fontWeight: '800', color: colors.text },
  headerSub: { fontSize: 12, color: colors.primary, fontWeight: '600', marginTop: 1 },
  markAllBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(124,58,237,0.12)', alignItems: 'center', justifyContent: 'center' },

  tabsRow: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  tabActive: { backgroundColor: 'rgba(124,58,237,0.3)', borderColor: 'rgba(124,58,237,0.6)' },
  tabText: { fontSize: 12, fontWeight: '600', color: colors.muted },
  tabTextActive: { color: '#fff' },
  tabBadge: { backgroundColor: '#e11d48', borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tabBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },

  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.05)' },
  rowUnread: { backgroundColor: 'rgba(124,58,237,0.07)' },
  unreadBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: '#7c3aed', borderRadius: 2 },

  avatarWrap: { position: 'relative' },
  typeBadge: { position: 'absolute', bottom: -3, right: -3, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#0a0a1a' },

  textWrap: { flex: 1 },
  rowText: { fontSize: 13.5, color: colors.text, lineHeight: 19, marginBottom: 4 },
  actorName: { fontWeight: '800', color: '#fff' },
  action: { color: 'rgba(255,255,255,0.65)', fontWeight: '400' },
  bodyText: { fontSize: 12, color: colors.muted, fontStyle: 'italic', marginBottom: 5 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sourcePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  sourceDot: { width: 5, height: 5, borderRadius: 2.5 },
  sourceText: { fontSize: 10, fontWeight: '700' },
  time: { fontSize: 11, color: colors.dim },
  thumb: { width: 52, height: 52, borderRadius: 10 },

  requestBtns: { flexDirection: 'row', gap: 8, marginTop: 6 },
  acceptBtn: { paddingHorizontal: 18, paddingVertical: 7, borderRadius: 8, backgroundColor: '#7c3aed' },
  acceptBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  declineBtn: { paddingHorizontal: 18, paddingVertical: 7, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  declineBtnText: { color: colors.muted, fontWeight: '600', fontSize: 13 },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: colors.muted, fontSize: 14 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 16 },
  emptyIconWrap: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: colors.text },
  emptyBody: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 22 },

  // Detail modal
  detailSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', paddingBottom: 48, paddingHorizontal: 24 },
  detailHandle: { width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 20 },
  detailClose: { position: 'absolute', top: 16, right: 20, padding: 4 },
  detailAvatarRow: { alignItems: 'center', marginBottom: 16, position: 'relative', alignSelf: 'center' },
  detailAvatarRing: { borderRadius: 44, borderWidth: 2, padding: 3 },
  detailTypeBadge: { position: 'absolute', bottom: 0, right: 0, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#0f172a' },
  detailName: { fontSize: 20, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 6 },
  detailAction: { fontSize: 14, color: 'rgba(255,255,255,0.65)', textAlign: 'center', lineHeight: 20, marginBottom: 12 },
  detailBodyWrap: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 14, marginBottom: 14 },
  detailBody: { fontSize: 14, color: colors.text, fontStyle: 'italic', lineHeight: 20 },
  detailMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 16 },
  detailTime: { fontSize: 12, color: colors.dim },
  detailMedia: { width: '100%', height: 180, borderRadius: 16, marginBottom: 20 },
  detailActions: { flexDirection: 'row', gap: 12 },
  detailViewBtn: { flex: 1, borderRadius: 14, overflow: 'hidden' },
  detailViewBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  detailViewBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  detailProfileBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.05)' },
  detailProfileBtnText: { color: colors.text, fontWeight: '600', fontSize: 15 },
});
