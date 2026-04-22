import { useState, useCallback } from 'react';
import {
  View, FlatList, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, Alert, StatusBar,
} from 'react-native';
import AppText from '../components/AppText';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import api from '../api/axios';
import { colors, radius } from '../theme';
import { useTheme } from '../context/ThemeContext';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function Avatar({ uri, name, size = 52 }) {
  return uri ? (
    <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
  ) : (
    <View style={[s.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <AppText style={{ color: '#fff', fontWeight: '700', fontSize: size * 0.38 }}>
        {name?.[0]?.toUpperCase() || '?'}
      </AppText>
    </View>
  );
}

export default function MessageRequestsScreen({ navigation }) {
  const { theme } = useTheme();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(null); // req id being processed

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/messages/requests');
      setRequests(data.requests || []);
    } catch {} finally { setLoading(false); }
  };

  useFocusEffect(useCallback(() => { fetchRequests(); }, []));

  const respond = async (reqId, action, req) => {
    setResponding(reqId);
    try {
      await api.patch(`/messages/requests/${reqId}`, { action });
      setRequests(prev => prev.filter(r => r.id !== reqId));
      if (action === 'accept') {
        navigation.replace('Chat', {
          conversationId: req.conversation_id,
          title: req.sender_name,
          avatar: req.sender_avatar,
          type: 'private',
          otherUserId: req.sender_id,
        });
      }
    } catch {
      Alert.alert('Error', 'Could not process request. Try again.');
    } finally { setResponding(null); }
  };

  const confirmDecline = (req) => {
    Alert.alert(
      'Decline Request',
      `Decline message request from ${req.sender_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Decline', style: 'destructive', onPress: () => respond(req.id, 'decline', req) },
      ]
    );
  };

  const renderItem = ({ item }) => {
    const isProcessing = responding === item.id;
    return (
      <View style={[s.card, { backgroundColor: theme.bgCard || theme.bgSecondary, borderColor: theme.border }]}>
        {/* Top row: avatar + name + time */}
        <View style={s.cardTop}>
          <TouchableOpacity
            onPress={() => navigation.navigate('UserProfile', { userId: item.sender_id, userName: item.sender_name })}
            activeOpacity={0.8}
          >
            <Avatar uri={item.sender_avatar} name={item.sender_name} size={52} />
          </TouchableOpacity>

          <View style={s.cardInfo}>
            <TouchableOpacity
              onPress={() => navigation.navigate('UserProfile', { userId: item.sender_id, userName: item.sender_name })}
              activeOpacity={0.8}
            >
              <AppText style={[s.name, { color: theme.text }]}>{item.sender_name}</AppText>
              <AppText style={[s.username, { color: theme.muted }]}>@{item.sender_username}</AppText>
            </TouchableOpacity>
          </View>

          <AppText style={[s.time, { color: theme.dim }]}>{timeAgo(item.created_at)}</AppText>
        </View>

        {/* Message preview bubble */}
        <View style={[s.previewBubble, { backgroundColor: theme.bg }]}>
          <Ionicons name="chatbubble-outline" size={13} color={theme.dim} style={{ marginTop: 1 }} />
          <AppText style={[s.previewText, { color: theme.muted }]} numberOfLines={2}>
            {item.preview_text || 'Wants to send you a message'}
          </AppText>
        </View>

        {/* Action buttons */}
        <View style={s.btnRow}>
          <TouchableOpacity
            style={[s.declineBtn, { borderColor: theme.border }]}
            onPress={() => confirmDecline(item)}
            disabled={isProcessing}
            activeOpacity={0.7}
          >
            <AppText style={[s.declineBtnText, { color: theme.muted }]}>Decline</AppText>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.acceptBtn}
            onPress={() => respond(item.id, 'accept', item)}
            disabled={isProcessing}
            activeOpacity={0.8}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <LinearGradient colors={['#7c3aed', '#3b82f6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.acceptGrad}>
                <Ionicons name="checkmark" size={16} color="#fff" />
                <AppText style={s.acceptBtnText}>Accept</AppText>
              </LinearGradient>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <LinearGradient colors={['#0f172a', '#1a0a2e']} style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <AppText style={s.headerTitle}>Message Requests</AppText>
          {!loading && requests.length > 0 && (
            <View style={s.countBadge}>
              <AppText style={s.countBadgeText}>{requests.length}</AppText>
            </View>
          )}
        </View>
      </LinearGradient>

      {/* Info banner */}
      {!loading && requests.length > 0 && (
        <View style={[s.infoBanner, { backgroundColor: 'rgba(124,58,237,0.08)', borderBottomColor: theme.border }]}>
          <Ionicons name="information-circle-outline" size={15} color={colors.primary} />
          <AppText style={[s.infoText, { color: theme.muted }]}>
            These people aren't connected with you yet. Accept to start chatting.
          </AppText>
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />
      ) : requests.length === 0 ? (
        <View style={s.empty}>
          <View style={[s.emptyIcon, { backgroundColor: 'rgba(124,58,237,0.1)' }]}>
            <Ionicons name="mail-open-outline" size={40} color={colors.primary} />
          </View>
          <AppText style={[s.emptyTitle, { color: theme.text }]}>No pending requests</AppText>
          <AppText style={[s.emptySubtitle, { color: theme.muted }]}>
            When someone who isn't connected with you sends a message, it will appear here.
          </AppText>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={i => String(i.id)}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.list}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingTop: 56, paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: 0.5, borderBottomColor: colors.border,
  },
  backBtn: { padding: 4 },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  countBadge: {
    backgroundColor: colors.primary, borderRadius: 10,
    minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5,
  },
  countBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 0.5,
  },
  infoText: { flex: 1, fontSize: 12, lineHeight: 17 },
  list: { padding: 16, gap: 12, paddingBottom: 40 },
  card: {
    borderRadius: radius.lg, borderWidth: 0.5,
    padding: 14, gap: 12,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarFallback: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700' },
  username: { fontSize: 12, marginTop: 1 },
  time: { fontSize: 11 },
  previewBubble: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 7,
    borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 9,
  },
  previewText: { flex: 1, fontSize: 13, lineHeight: 18 },
  btnRow: { flexDirection: 'row', gap: 10 },
  declineBtn: {
    flex: 1, borderWidth: 1, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center', paddingVertical: 10,
  },
  declineBtnText: { fontSize: 14, fontWeight: '600' },
  acceptBtn: { flex: 2, borderRadius: radius.full, overflow: 'hidden' },
  acceptGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10,
  },
  acceptBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  empty: { alignItems: 'center', marginTop: 80, paddingHorizontal: 40, gap: 12 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptySubtitle: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
});
