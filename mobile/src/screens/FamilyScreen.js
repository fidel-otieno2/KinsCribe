import { useEffect, useState, useCallback } from 'react';
import {
  View, TouchableOpacity, StyleSheet, ActivityIndicator,
  ScrollView, Image, RefreshControl, Alert, TextInput,
  Clipboard, Dimensions,
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
import Toast from '../components/Toast';
import useToast from '../hooks/useToast';

const { width } = Dimensions.get('window');

const TABS = [
  { key: 'feed', icon: 'home-outline', iconActive: 'home', label: 'Feed' },
  { key: 'chat', icon: 'chatbubbles-outline', iconActive: 'chatbubbles', label: 'Chat' },
  { key: 'members', icon: 'people-outline', iconActive: 'people', label: 'Members' },
  { key: 'timeline', icon: 'git-branch-outline', iconActive: 'git-branch', label: 'Timeline' },
];

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function Avatar({ uri, name, size = 44 }) {
  return uri ? (
    <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
  ) : (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
      <AppText style={{ color: '#fff', fontWeight: '700', fontSize: size * 0.38 }}>{name?.[0]?.toUpperCase() || '?'}</AppText>
    </View>
  );
}

// ── Family Feed Tab ───────────────────────────────────────────
function FamilyFeedTab({ navigation, userRole }) {
  const { t } = useTranslation();
  const [stories, setStories] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/stories/feed').catch(() => ({ data: { stories: [] } })),
      api.get('/family/announcements').catch(() => ({ data: { announcements: [] } })),
    ]).then(([storiesRes, annRes]) => {
      setStories(storiesRes.data.stories || []);
      setAnnouncements(annRes.data.announcements || []);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />;

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
      {/* Admin Announcements */}
      {announcements.length > 0 && (
        <View style={{ marginBottom: 16 }}>
          <AppText style={ft.sectionLabel}>📢 Announcements</AppText>
          {announcements.map(ann => (
            <View key={ann.id} style={ft.announcementCard}>
              <LinearGradient colors={['rgba(245,158,11,0.15)', 'rgba(30,41,59,0.9)']} style={StyleSheet.absoluteFill} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Ionicons name="megaphone" size={16} color="#f59e0b" />
                <AppText style={ft.announcementTitle}>{ann.title}</AppText>
              </View>
              {ann.content ? <AppText style={ft.announcementContent}>{ann.content}</AppText> : null}
              <AppText style={ft.time}>{timeAgo(ann.created_at)}</AppText>
            </View>
          ))}
        </View>
      )}
      {stories.length === 0 ? (
        <View style={ft.empty}>
          <Ionicons name="library-outline" size={48} color={colors.dim} />
          <AppText style={ft.emptyTitle}>{t('no_family_stories')}</AppText>
          <AppText style={ft.emptySub}>{t('share_first_memory')}</AppText>
        </View>
      ) : stories.map(story => (
        <TouchableOpacity
          key={story.id}
          style={ft.card}
          onPress={() => navigation.navigate('UserProfile', { userId: story.user_id, userName: story.author_name })}
          activeOpacity={0.85}
        >
          <View style={ft.cardHeader}>
            <Avatar uri={story.author_avatar} name={story.author_name} size={38} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <AppText style={ft.authorName}>{story.author_name}</AppText>
              <AppText style={ft.time}>{timeAgo(story.created_at)}</AppText>
            </View>
            {story.privacy === 'family' && (
              <View style={ft.privacyBadge}>
                <Ionicons name="people" size={11} color="#10b981" />
                <AppText style={ft.privacyText}>{t('family')}</AppText>
              </View>
            )}
          </View>
          <AppText style={ft.title}>{story.title}</AppText>
          {story.content ? <AppText style={ft.content} numberOfLines={3}>{story.content}</AppText> : null}
          {story.media_url && story.media_type === 'image' && (
            <Image source={{ uri: story.media_url }} style={ft.media} resizeMode="cover" />
          )}
          <View style={ft.actions}>
            <View style={ft.actionItem}>
              <Ionicons name="heart-outline" size={16} color={colors.muted} />
              <AppText style={ft.actionText}>{story.like_count}</AppText>
            </View>
            <View style={ft.actionItem}>
              <Ionicons name="chatbubble-outline" size={16} color={colors.muted} />
              <AppText style={ft.actionText}>{story.comment_count}</AppText>
            </View>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const ft = StyleSheet.create({
  empty: { alignItems: 'center', marginTop: 60, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  emptySub: { fontSize: 14, color: colors.muted },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  announcementCard: { borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)', padding: 14, marginBottom: 10 },
  announcementTitle: { fontSize: 14, fontWeight: '700', color: '#f59e0b', flex: 1 },
  announcementContent: { fontSize: 13, color: colors.text, lineHeight: 18, marginBottom: 6 },
  card: { backgroundColor: colors.bgSecondary, borderRadius: radius.lg, padding: 16, marginBottom: 12, borderWidth: 0.5, borderColor: colors.border },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  authorName: { fontSize: 14, fontWeight: '700', color: colors.text },
  time: { fontSize: 12, color: colors.muted },
  privacyBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(16,185,129,0.1)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  privacyText: { fontSize: 11, color: '#10b981', fontWeight: '600' },
  title: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 6 },
  content: { fontSize: 14, color: colors.muted, lineHeight: 20, marginBottom: 10 },
  media: { width: '100%', height: 200, borderRadius: radius.md, marginBottom: 10 },
  actions: { flexDirection: 'row', gap: 16 },
  actionItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionText: { fontSize: 13, color: colors.muted },
});

// ── Members Tab ───────────────────────────────────────────────
function MembersTab({ members, user, family, navigation, success, error }) {
  const { t } = useTranslation();
  const [inviteEmail, setInviteEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    Clipboard.setString(family?.invite_code || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sendInvite = async () => {
    if (!inviteEmail.trim()) return;
    setSending(true);
    try {
      await api.post('/family/invite/email', { email: inviteEmail.trim() });
      success(`Invite sent to ${inviteEmail.trim()}`);
      setInviteEmail('');
    } catch (err) {
      error(err.response?.data?.error || 'Failed to send invite');
    } finally { setSending(false); }
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
      {/* Invite code */}
      <BlurView intensity={20} tint="dark" style={mt.codeCard}>
        <LinearGradient colors={['rgba(124,58,237,0.2)', 'rgba(59,130,246,0.1)']} style={StyleSheet.absoluteFill} />
        <AppText style={mt.codeLabel}>Family Invite Code</AppText>
        <AppText style={mt.code}>{family?.invite_code}</AppText>
        <TouchableOpacity style={[mt.copyBtn, copied && mt.copyBtnDone]} onPress={copyCode}>
          <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color="#fff" />
          <AppText style={mt.copyBtnText}>{copied ? 'Copied!' : 'Copy Code'}</AppText>
        </TouchableOpacity>
      </BlurView>

      {/* Invite by email */}
      {user?.role === 'admin' && (
        <View style={mt.inviteRow}>
          <TextInput
            style={mt.inviteInput}
            placeholder="Invite by email..."
            placeholderTextColor={colors.dim}
            keyboardType="email-address"
            autoCapitalize="none"
            value={inviteEmail}
            onChangeText={setInviteEmail}
          />
          <TouchableOpacity style={mt.sendBtn} onPress={sendInvite} disabled={sending}>
            {sending ? <ActivityIndicator color="#fff" size="small" /> : <AppText style={mt.sendBtnText}>{t('send')}</AppText>}
          </TouchableOpacity>
        </View>
      )}

      <AppText style={mt.sectionTitle}>Members ({members.length})</AppText>
      {members.map(m => (
        <TouchableOpacity
          key={m.id}
          style={mt.memberRow}
          onPress={() => navigation.navigate('UserProfile', { userId: m.id, userName: m.name, userAvatar: m.avatar_url })}
          onLongPress={() => {
            if (user?.role !== 'admin' || m.id === user?.id) return;
            Alert.alert(
              `Manage ${m.name}`,
              'Change role or remove member',
              [
                { text: 'Make Admin', onPress: async () => { try { await api.patch(`/family/members/${m.id}/role`, { role: 'admin' }); } catch {} } },
                { text: 'Set View-Only', onPress: async () => { try { await api.patch(`/family/members/${m.id}/role`, { role: 'view-only' }); } catch {} } },
                { text: 'Set Member', onPress: async () => { try { await api.patch(`/family/members/${m.id}/role`, { role: 'member' }); } catch {} } },
                { text: 'Remove from Family', style: 'destructive', onPress: async () => { try { await api.delete(`/family/members/${m.id}`); } catch {} } },
                { text: 'Cancel', style: 'cancel' },
              ]
            );
          }}
          activeOpacity={0.8}
        >
          <Avatar uri={m.avatar_url} name={m.name} size={48} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <AppText style={mt.memberName}>{m.name}</AppText>
              {m.id === user?.id && <AppText style={mt.youBadge}>You</AppText>}
            </View>
            <AppText style={mt.memberEmail}>{m.email}</AppText>
          </View>
          <View style={[mt.roleBadge, m.role === 'admin' && mt.adminBadge, m.role === 'view-only' && mt.viewOnlyBadge]}>
            <AppText style={[mt.roleText, m.role === 'admin' && { color: '#f59e0b' }, m.role === 'view-only' && { color: '#94a3b8' }]}>
              {m.role === 'admin' ? '👑 Admin' : m.role === 'view-only' ? '👁 View Only' : m.role}
            </AppText>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const mt = StyleSheet.create({
  codeCard: { borderRadius: radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)', padding: 20, alignItems: 'center', gap: 8, marginBottom: 16 },
  codeLabel: { fontSize: 11, color: colors.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  code: { fontSize: 28, fontWeight: '800', color: colors.primary, letterSpacing: 8 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 9, borderRadius: 20 },
  copyBtnDone: { backgroundColor: '#10b981' },
  copyBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  inviteRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  inviteInput: { flex: 1, backgroundColor: 'rgba(30,41,59,0.8)', borderWidth: 1, borderColor: colors.border2, borderRadius: radius.md, padding: 12, color: colors.text, fontSize: 14 },
  sendBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: 18, justifyContent: 'center' },
  sendBtnText: { color: '#fff', fontWeight: '700' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  memberName: { fontSize: 15, fontWeight: '700', color: colors.text },
  youBadge: { fontSize: 10, color: colors.primary, fontWeight: '700', backgroundColor: 'rgba(124,58,237,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  memberEmail: { fontSize: 12, color: colors.muted, marginTop: 2 },
  roleBadge: { backgroundColor: 'rgba(30,41,59,0.8)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  adminBadge: { backgroundColor: 'rgba(245,158,11,0.15)' },
  viewOnlyBadge: { backgroundColor: 'rgba(148,163,184,0.15)' },
  roleText: { color: colors.muted, fontSize: 11, fontWeight: '600' },
});

// ── Timeline Tab ──────────────────────────────────────────────
function ChatRedirect({ navigation, family, onDone }) {
  useEffect(() => {
    navigation.navigate('Chat', {
      conversationId: null,
      title: `${family?.name || 'Family'} Chat`,
      type: 'family',
    });
    onDone();
  }, []);
  return null;
}

function TimelineTab({ navigation }) {
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/stories/timeline').then(({ data }) => {
      setStories(data.stories || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />;

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
      {stories.map((story, idx) => (
        <View key={story.id} style={tl.item}>
          <View style={tl.lineWrap}>
            <View style={tl.dot} />
            {idx < stories.length - 1 && <View style={tl.line} />}
          </View>
          <View style={tl.content}>
            <AppText style={tl.date}>
              {story.story_date
                ? new Date(story.story_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                : new Date(story.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
            </AppText>
            <TouchableOpacity style={tl.card} activeOpacity={0.85}>
              {story.media_url && story.media_type === 'image' && (
                <Image source={{ uri: story.media_url }} style={tl.media} resizeMode="cover" />
              )}
              <AppText style={tl.title}>{story.title}</AppText>
              {story.content ? <AppText style={tl.body} numberOfLines={2}>{story.content}</AppText> : null}
              <View style={tl.meta}>
                <Avatar uri={story.author_avatar} name={story.author_name} size={20} />
                <AppText style={tl.author}>{story.author_name}</AppText>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      ))}
      {stories.length === 0 && (
        <View style={{ alignItems: 'center', marginTop: 60, gap: 10 }}>
          <Ionicons name="git-branch-outline" size={48} color={colors.dim} />
          <AppText style={{ fontSize: 16, color: colors.muted }}>No timeline entries yet</AppText>
        </View>
      )}
    </ScrollView>
  );
}

const tl = StyleSheet.create({
  item: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  lineWrap: { alignItems: 'center', width: 20 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary, marginTop: 4 },
  line: { width: 2, flex: 1, backgroundColor: colors.border, marginTop: 4 },
  content: { flex: 1, paddingBottom: 20 },
  date: { fontSize: 12, color: colors.primary, fontWeight: '700', marginBottom: 6 },
  card: { backgroundColor: colors.bgSecondary, borderRadius: radius.md, overflow: 'hidden', borderWidth: 0.5, borderColor: colors.border },
  media: { width: '100%', height: 140 },
  title: { fontSize: 15, fontWeight: '700', color: colors.text, padding: 12, paddingBottom: 4 },
  body: { fontSize: 13, color: colors.muted, paddingHorizontal: 12, paddingBottom: 8, lineHeight: 18 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 12, paddingTop: 4, borderTopWidth: 0.5, borderTopColor: colors.border },
  author: { fontSize: 12, color: colors.muted },
});

// ── Main FamilyScreen ─────────────────────────────────────────
export default function FamilyScreen({ navigation }) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { toast, hide, success, error } = useToast();
  const [family, setFamily] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('feed');

  const fetchFamily = useCallback(async () => {
    try {
      const { data } = await api.get('/family/my-family');
      setFamily(data.family);
      setMembers(data.members || []);
    } catch (err) {
      if (err.response?.status === 404) navigation.navigate('JoinFamily');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [navigation]);

  useEffect(() => { fetchFamily(); }, [fetchFamily]);
  useFocusEffect(useCallback(() => { fetchFamily(); }, [fetchFamily]));

  if (loading) return (
    <View style={[s.container, { alignItems: 'center', justifyContent: 'center' }]}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );

  return (
    <View style={s.container}>
      <Toast visible={toast.visible} type={toast.type} message={toast.message} onHide={hide} />
      <LinearGradient colors={['#0f172a', '#1a0f2e', '#0f172a']} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <LinearGradient colors={['#7c3aed', '#3b82f6']} style={s.familyIcon}>
            <Ionicons name="people" size={20} color="#fff" />
          </LinearGradient>
          <View>
            <AppText style={s.familyName}>{family?.name || 'My Family'}</AppText>
            <AppText style={s.memberCount}>{members.length} members</AppText>
          </View>
        </View>
        <View style={s.headerRight}>
          <TouchableOpacity
            style={s.chatBtn}
            onPress={() => navigation.navigate('Chat', {
              conversationId: null,
              title: `${family?.name || 'Family'} Chat`,
              type: 'family',
            })}
          >
            <Ionicons name="chatbubbles-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={s.chatBtn} onPress={() => navigation.navigate('Storybooks')}>
            <Ionicons name="book-outline" size={20} color={colors.muted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Quick access row */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.quickRow}>
        {[
          { icon: 'git-network-outline', label: 'Tree', screen: 'FamilyTree', color: '#7c3aed' },
          { icon: 'calendar-outline', label: 'Calendar', screen: 'FamilyCalendar', color: '#3b82f6' },
          { icon: 'restaurant-outline', label: 'Recipes', screen: 'FamilyRecipes', color: '#f59e0b' },
          { icon: 'wallet-outline', label: 'Budget', screen: 'FamilyBudget', color: '#10b981' },
          { icon: 'book-outline', label: 'Storybooks', screen: 'Storybooks', color: '#ec4899' },
          { icon: 'chatbubbles-outline', label: 'Chat', screen: null, color: colors.primary },
          { icon: 'calendar-number-outline', label: 'On This Day', screen: 'OnThisDay', color: '#f59e0b' },
        ].map(item => (
          <TouchableOpacity
            key={item.label}
            style={s.quickItem}
            onPress={() => {
              if (item.screen === null) {
                navigation.navigate('Chat', { conversationId: null, title: `${family?.name || 'Family'} Chat`, type: 'family' });
              } else {
                navigation.navigate(item.screen);
              }
            }}
          >
            <View style={[s.quickIcon, { backgroundColor: `${item.color}22` }]}>
              <Ionicons name={item.icon} size={22} color={item.color} />
            </View>
            <AppText style={s.quickLabel}>{item.label}</AppText>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Tabs */}
      <View style={s.tabRow}>
        {TABS.map(t => (
          <TouchableOpacity key={t.key} style={[s.tabBtn, tab === t.key && s.tabBtnActive]} onPress={() => setTab(t.key)}>
            <Ionicons name={tab === t.key ? t.iconActive : t.icon} size={18} color={tab === t.key ? colors.primary : colors.muted} />
            <AppText style={[s.tabLabel, tab === t.key && s.tabLabelActive]}>{t.label}</AppText>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab content */}
      {tab === 'feed' && <FamilyFeedTab navigation={navigation} userRole={user?.role} />}
      {tab === 'chat' && <ChatRedirect navigation={navigation} family={family} onDone={() => setTab('feed')} />}
      {tab === 'members' && <MembersTab members={members} user={user} family={family} navigation={navigation} success={success} error={error} />}
      {tab === 'timeline' && <TimelineTab navigation={navigation} />}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 52, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  familyIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  familyName: { fontSize: 18, fontWeight: '800', color: colors.text },
  memberCount: { fontSize: 12, color: colors.muted, marginTop: 1 },
  headerRight: { flexDirection: 'row', gap: 8 },
  chatBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(30,41,59,0.8)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border2 },
  tabRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: colors.border },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 3 },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
  tabLabel: { fontSize: 10, color: colors.muted, fontWeight: '600' },
  tabLabelActive: { color: colors.primary },
  quickRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 16 },
  quickItem: { alignItems: 'center', gap: 6, width: 60 },
  quickIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: 11, color: colors.muted, fontWeight: '600', textAlign: 'center' },
});
