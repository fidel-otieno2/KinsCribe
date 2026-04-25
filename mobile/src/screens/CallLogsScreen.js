import { useState, useEffect, useCallback } from 'react';
import {
  View, FlatList, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AppText from '../components/AppText';
import api from '../api/axios';
import { colors } from '../theme';

const FILTERS = [
  { key: 'all',      label: 'All' },
  { key: 'missed',   label: 'Missed' },
  { key: 'received', label: 'Received' },
  { key: 'dialed',   label: 'Dialed' },
];

function fmtDuration(secs) {
  if (!secs) return '';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString();
}

function Avatar({ uri, name, size = 44 }) {
  return uri ? (
    <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
  ) : (
    <LinearGradient colors={['#7c3aed', '#3b82f6']} style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}>
      <AppText style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.38 }}>{(name || 'U')[0].toUpperCase()}</AppText>
    </LinearGradient>
  );
}

export default function CallLogsScreen({ navigation }) {
  const [filter, setFilter] = useState('all');
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = filter !== 'all' ? `?type=${filter}` : '';
      const { data } = await api.get(`/calls/logs${params}`);
      setLogs(data.logs || []);
    } catch {} finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Mark missed calls as seen when screen opens
  useEffect(() => {
    api.post('/calls/logs/mark-seen').catch(() => {});
  }, []);

  const callBack = (log) => {
    navigation.navigate('Call', {
      callType: log.call_type || 'voice',
      callerName: log.other_user_name,
      callerAvatar: log.other_user_avatar,
      isIncoming: false,
      calleeId: log.other_user_id,
      conversationId: log.conversation_id,
    });
  };

  const renderItem = ({ item }) => {
    const isMissed = item.status === 'missed' && !item.is_outgoing;
    const isOutgoing = item.is_outgoing;
    const isVideo = item.call_type === 'video' || item.call_type === 'group';

    let dirIcon = isOutgoing ? 'arrow-up-outline' : 'arrow-down-outline';
    let dirColor = isOutgoing ? '#3b82f6' : isMissed ? '#e11d48' : '#22c55e';

    return (
      <TouchableOpacity style={st.row} onPress={() => callBack(item)} activeOpacity={0.75}>
        <Avatar uri={item.other_user_avatar} name={item.other_user_name} />

        <View style={st.info}>
          <AppText style={[st.name, isMissed && st.nameMissed]}>
            {item.other_user_name || 'Unknown'}
          </AppText>
          <View style={st.meta}>
            <Ionicons name={dirIcon} size={12} color={dirColor} />
            <AppText style={[st.metaText, isMissed && st.metaMissed]}>
              {isMissed ? 'Missed' : isOutgoing ? 'Outgoing' : 'Incoming'}
              {item.duration_secs > 0 ? ` · ${fmtDuration(item.duration_secs)}` : ''}
            </AppText>
            <Ionicons name={isVideo ? 'videocam-outline' : 'call-outline'} size={12} color={colors.dim} />
          </View>
        </View>

        <View style={st.right}>
          <AppText style={st.time}>{fmtDate(item.created_at)}</AppText>
          <TouchableOpacity
            style={st.callBtn}
            onPress={() => callBack(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name={isVideo ? 'videocam' : 'call'} size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={st.root}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <LinearGradient colors={['#0f172a', '#1a0a2e']} style={st.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={st.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <AppText style={st.title}>Call History</AppText>
      </LinearGradient>

      {/* Filter tabs */}
      <View style={st.filterRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[st.filterTab, filter === f.key && st.filterTabActive]}
            onPress={() => setFilter(f.key)}
          >
            <AppText style={[st.filterText, filter === f.key && st.filterTextActive]}>
              {f.label}
            </AppText>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={logs}
          keyExtractor={i => String(i.id)}
          renderItem={renderItem}
          contentContainerStyle={logs.length === 0 && st.emptyWrap}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', gap: 10 }}>
              <Ionicons name="call-outline" size={44} color={colors.dim} />
              <AppText style={st.emptyText}>No {filter === 'all' ? '' : filter} calls yet</AppText>
            </View>
          }
        />
      )}
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 52,
    paddingBottom: 14,
    paddingHorizontal: 16,
    gap: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  backBtn: { padding: 4 },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  filterTabActive: {
    backgroundColor: 'rgba(124,58,237,0.2)',
    borderColor: 'rgba(124,58,237,0.5)',
  },
  filterText: { fontSize: 13, fontWeight: '600', color: colors.muted },
  filterTextActive: { color: colors.primary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 4 },
  nameMissed: { color: '#e11d48' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 12, color: colors.muted },
  metaMissed: { color: '#e11d48' },
  right: { alignItems: 'flex-end', gap: 8 },
  time: { fontSize: 11, color: colors.dim },
  callBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(124,58,237,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(124,58,237,0.3)',
  },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 14, color: colors.muted },
});
