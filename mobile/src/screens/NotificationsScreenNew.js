import { useState, useEffect, useCallback } from 'react';
import {
  View, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert, Image,
} from 'react-native';
import AppText from '../components/AppText';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import api from '../api/axios';
import { colors, radius } from '../theme';

const NOTIFICATION_ICONS = {
  like: { name: 'heart', color: '#e11d48' },
  comment: { name: 'chatbubble', color: '#3b82f6' },
  follow: { name: 'person-add', color: '#10b981' },
  mention: { name: 'at', color: '#7c3aed' },
  story_view: { name: 'eye', color: '#f59e0b' },
  birthday: { name: 'gift', color: '#ec4899' },
  test: { name: 'notifications', color: '#6b7280' },
};

function formatTimeAgo(dateString) {
  const now = new Date();
  const date = new Date(dateString);
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

export default function NotificationsScreen({ navigation }) {
  const { theme } = useTheme();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchNotifications = useCallback(async (pageNum = 1, refresh = false) => {
    try {
      if (refresh) {
        setRefreshing(true);
      } else if (pageNum === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const { data } = await api.get(`/notifications?page=${pageNum}&limit=20`);
      
      if (refresh || pageNum === 1) {
        setNotifications(data.notifications);
      } else {
        setNotifications(prev => [...prev, ...data.notifications]);
      }
      
      setUnreadCount(data.unread_count);
      setHasMore(data.has_more);
      setPage(pageNum);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useFocusEffect(
    useCallback(() => {
      fetchNotifications(1, true);
    }, [])
  );

  const handleMarkAllRead = async () => {
    try {
      await api.post('/notifications/mark-read', { mark_all: true });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      Alert.alert('Error', 'Failed to mark notifications as read');
    }
  };

  const handleNotificationPress = async (notification) => {
    // Mark as read if unread
    if (!notification.is_read) {
      try {
        await api.post('/notifications/mark-read', { 
          notification_ids: [notification.id] 
        });
        setNotifications(prev => 
          prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    }

    // Navigate based on notification type
    const { type, data } = notification;
    
    if (type === 'follow' && notification.from_user_id) {
      navigation.navigate('UserProfile', { userId: notification.from_user_id });
    } else if ((type === 'like' || type === 'comment') && data?.post_id) {
      // Navigate to post detail (you'll need to create this screen)
      navigation.navigate('PostDetail', { postId: data.post_id });
    } else if (type === 'story_view' && data?.story_id) {
      navigation.navigate('StoryViewer', { storyId: data.story_id });
    }
  };

  const loadMore = () => {
    if (hasMore && !loadingMore) {
      fetchNotifications(page + 1);
    }
  };

  const renderNotification = ({ item }) => {
    const icon = NOTIFICATION_ICONS[item.type] || NOTIFICATION_ICONS.test;
    const timeAgo = formatTimeAgo(item.created_at);

    return (
      <TouchableOpacity
        style={[
          s.notificationItem,
          { 
            backgroundColor: item.is_read ? 'transparent' : 'rgba(124,58,237,0.05)',
            borderColor: theme.border
          }
        ]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        <View style={s.notificationContent}>
          <View style={s.avatarSection}>
            {item.from_user_avatar ? (
              <Image 
                source={{ uri: item.from_user_avatar }} 
                style={s.avatar} 
              />
            ) : (
              <View style={[s.avatarPlaceholder, { backgroundColor: colors.primary }]}>
                <AppText style={s.avatarLetter}>
                  {item.from_user_name?.[0]?.toUpperCase() || '?'}
                </AppText>
              </View>
            )}
            
            <View style={[s.iconBadge, { backgroundColor: icon.color }]}>
              <Ionicons name={icon.name} size={12} color="#fff" />
            </View>
          </View>

          <View style={s.textSection}>
            <AppText style={[s.notificationTitle, { color: theme.text }]}>
              {item.title}
            </AppText>
            {item.message && (
              <AppText style={[s.notificationMessage, { color: theme.muted }]}>
                {item.message}
              </AppText>
            )}
            <AppText style={[s.timeAgo, { color: theme.dim }]}>
              {timeAgo}
            </AppText>
          </View>

          {!item.is_read && (
            <View style={s.unreadDot} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={s.emptyState}>
      <Ionicons name="notifications-outline" size={64} color={theme.dim} />
      <AppText style={[s.emptyTitle, { color: theme.text }]}>No notifications yet</AppText>
      <AppText style={[s.emptyMessage, { color: theme.muted }]}>
        When people interact with your posts, you'll see it here
      </AppText>
    </View>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={s.loadingFooter}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  };

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <LinearGradient 
        colors={['#1C1A14', '#2A2720', '#1C1A14']} 
        style={StyleSheet.absoluteFill} 
      />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={s.backBtn}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        
        <AppText style={s.headerTitle}>Notifications</AppText>
        
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllRead} style={s.markAllBtn}>
            <AppText style={s.markAllText}>Mark all read</AppText>
          </TouchableOpacity>
        )}
      </View>

      {/* Unread count badge */}
      {unreadCount > 0 && (
        <View style={s.unreadBanner}>
          <Ionicons name="notifications" size={16} color={colors.primary} />
          <AppText style={[s.unreadBannerText, { color: theme.text }]}>
            {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
          </AppText>
        </View>
      )}

      {/* Notifications list */}
      <FlatList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchNotifications(1, true)}
            tintColor={colors.primary}
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={!loading ? renderEmpty : null}
        ListFooterComponent={renderFooter}
      />

      {loading && (
        <View style={s.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  backBtn: { padding: 4 },
  headerTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
  },
  markAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.md,
    backgroundColor: 'rgba(124,58,237,0.1)',
  },
  markAllText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  unreadBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(124,58,237,0.08)',
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  unreadBannerText: {
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 20,
  },
  notificationItem: {
    borderBottomWidth: 0.5,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  avatarSection: {
    position: 'relative',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  iconBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bg,
  },
  textSection: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  notificationMessage: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  timeAgo: {
    fontSize: 12,
    marginTop: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 6,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  emptyMessage: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  loadingFooter: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});