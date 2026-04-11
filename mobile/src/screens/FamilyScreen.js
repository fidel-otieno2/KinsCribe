import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, ScrollView,
  Image, Clipboard, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { colors, radius } from '../theme';

export default function FamilyScreen({ navigation }) {
  const { user } = useAuth();
  const [family, setFamily] = useState(null);
  const [members, setMembers] = useState([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchFamily = useCallback(async () => {
    try {
      const { data } = await api.get('/family/my-family');
      setFamily(data.family);
      setMembers(data.members || []);
    } catch (err) {
      if (err.response?.status === 404) navigation.replace('FamilyGate');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [navigation]);

  useEffect(() => { fetchFamily(); }, [fetchFamily]);
  useFocusEffect(useCallback(() => { fetchFamily(); }, [fetchFamily]));

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
      Alert.alert('✅ Invite Sent', `Invite sent to ${inviteEmail}`);
      setInviteEmail('');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to send invite');
    } finally {
      setSending(false);
    }
  };

  if (loading) return (
    <View style={[s.container, { alignItems: 'center', justifyContent: 'center' }]}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );

  return (
    <View style={s.container}>
      <LinearGradient colors={['#0f172a', '#1a0f2e', '#0f172a']} style={StyleSheet.absoluteFill} />

      <View style={s.header}>
        <Text style={s.headerTitle}>{family?.name || 'My Family'}</Text>
        <View style={s.memberCount}>
          <Ionicons name="people-circle-outline" size={16} color={colors.primary} />
          <Text style={s.memberCountText}>{members.length} members</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchFamily(); }} tintColor={colors.primary} />}
      >
        {/* Invite Code Card */}
        <BlurView intensity={20} tint="dark" style={s.codeCard}>
          <LinearGradient colors={['rgba(124,58,237,0.2)', 'rgba(59,130,246,0.1)']} style={StyleSheet.absoluteFill} />
          <Text style={s.codeLabel}>Family Invite Code</Text>
          <Text style={s.code}>{family?.invite_code}</Text>
          <Text style={s.codeSub}>Share this code with family members to join</Text>
          <TouchableOpacity style={[s.copyBtn, copied && s.copyBtnDone]} onPress={copyCode}>
            <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color="#fff" />
            <Text style={s.copyBtnText}>{copied ? 'Copied!' : 'Copy Code'}</Text>
          </TouchableOpacity>
        </BlurView>

        {/* Invite by email (admin only) */}
        {user?.role === 'admin' && (
          <View style={s.inviteSection}>
            <View style={s.sectionTitleRow}>
              <Ionicons name="mail-outline" size={18} color={colors.primary} />
              <Text style={s.sectionTitle}>Invite by Email</Text>
            </View>
            <View style={s.inviteRow}>
              <TextInput
                style={s.inviteInput}
                placeholder="Enter email address..."
                placeholderTextColor={colors.dim}
                keyboardType="email-address"
                autoCapitalize="none"
                value={inviteEmail}
                onChangeText={setInviteEmail}
              />
              <TouchableOpacity style={s.sendBtn} onPress={sendInvite} disabled={sending}>
                {sending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.sendBtnText}>Send</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Members */}
        <View style={s.sectionTitleRow}>
          <Ionicons name="people-outline" size={18} color={colors.primary} />
          <Text style={s.sectionTitle}>Members ({members.length})</Text>
        </View>
        {members.map(m => (
          <BlurView key={m.id} intensity={15} tint="dark" style={s.memberCard}>
            <View style={s.memberCardInner}>
              <View style={s.memberAvatar}>
                {m.avatar_url
                  ? <Image source={{ uri: m.avatar_url }} style={s.memberAvatarImg} />
                  : <Text style={s.memberAvatarText}>{m.name?.[0]?.toUpperCase()}</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <View style={s.memberNameRow}>
                  <Text style={s.memberName}>{m.name}</Text>
                  {m.id === user?.id && <Text style={s.youBadge}>You</Text>}
                </View>
                <Text style={s.memberEmail}>{m.email}</Text>
              </View>
              <View style={[s.roleBadge, m.role === 'admin' && s.roleBadgeAdmin]}>
                <Text style={[s.roleText, m.role === 'admin' && { color: '#f59e0b' }]}>
                  {m.role === 'admin' ? '👑 Admin' : m.role}
                </Text>
              </View>
            </View>
          </BlurView>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingTop: 52, paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  headerTitle: { fontSize: 24, fontWeight: '800', color: colors.text },
  memberCount: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  memberCountText: { fontSize: 13, color: colors.muted },
  scroll: { padding: 16, gap: 12, paddingBottom: 100 },
  codeCard: { borderRadius: radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)', padding: 24, alignItems: 'center', gap: 8 },
  codeLabel: { fontSize: 12, color: colors.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  code: { fontSize: 32, fontWeight: '800', color: colors.primary, letterSpacing: 8 },
  codeSub: { fontSize: 12, color: colors.dim, textAlign: 'center' },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, marginTop: 4 },
  copyBtnDone: { backgroundColor: '#10b981' },
  copyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  inviteSection: { gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 4 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  inviteRow: { flexDirection: 'row', gap: 10 },
  inviteInput: { flex: 1, backgroundColor: 'rgba(30,41,59,0.8)', borderWidth: 1, borderColor: colors.border2, borderRadius: radius.md, padding: 12, color: colors.text, fontSize: 14 },
  sendBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: 20, justifyContent: 'center' },
  sendBtnText: { color: '#fff', fontWeight: '700' },
  memberCard: { borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border2 },
  memberCardInner: { backgroundColor: 'rgba(15,23,42,0.6)', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  memberAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  memberAvatarImg: { width: 46, height: 46, borderRadius: 23 },
  memberAvatarText: { color: '#fff', fontWeight: '700', fontSize: 18 },
  memberNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  memberName: { fontSize: 15, fontWeight: '700', color: colors.text },
  youBadge: { fontSize: 10, color: colors.primary, fontWeight: '700', backgroundColor: 'rgba(124,58,237,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  memberEmail: { fontSize: 12, color: colors.muted, marginTop: 2 },
  roleBadge: { backgroundColor: 'rgba(30,41,59,0.8)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  roleBadgeAdmin: { backgroundColor: 'rgba(245,158,11,0.15)' },
  roleText: { color: colors.muted, fontSize: 11, fontWeight: '600' },
});
