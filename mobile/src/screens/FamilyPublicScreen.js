import { useEffect, useState } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, Dimensions,
} from 'react-native';
import AppText from '../components/AppText';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { colors, radius } from '../theme';

const { width } = Dimensions.get('window');

function Avatar({ uri, name, size = 44 }) {
  return uri ? (
    <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
  ) : (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
      <AppText style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.38 }}>
        {name?.[0]?.toUpperCase() || '?'}
      </AppText>
    </View>
  );
}

function LockRow({ label }) {
  return (
    <View style={s.lockRow}>
      <Ionicons name="lock-closed-outline" size={14} color={colors.dim} />
      <AppText style={s.lockText}>{label}</AppText>
    </View>
  );
}

export default function FamilyPublicScreen({ route, navigation }) {
  // familyId can come from route params (viewing another family)
  // or fall back to the current user's primary family
  const { familyId: paramFamilyId } = route?.params || {};
  const { user } = useAuth();

  const [family, setFamily] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMember, setIsMember] = useState(false);

  const familyId = paramFamilyId || user?.family_id;

  useEffect(() => {
    if (!familyId) { setLoading(false); return; }
    load();
  }, [familyId]);

  const load = async () => {
    try {
      const { data } = await api.get(`/family/public/${familyId}`);
      setFamily(data.family);
      setMembers(data.members || []);
      setIsMember(data.is_member);
    } catch {
      // fallback: try my-family if it's the user's own family
      try {
        const { data } = await api.get(`/family/my-family?family_id=${familyId}`);
        setFamily(data.family);
        setMembers(data.members || []);
        setIsMember(true);
      } catch {}
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <View style={[s.container, { alignItems: 'center', justifyContent: 'center' }]}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );

  if (!family) return (
    <View style={[s.container, { alignItems: 'center', justifyContent: 'center', gap: 12 }]}>
      <Ionicons name="people-outline" size={48} color={colors.dim} />
      <AppText style={{ color: colors.muted, fontSize: 16 }}>Family not found</AppText>
      <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtnCenter}>
        <AppText style={{ color: colors.primary, fontWeight: '700' }}>Go back</AppText>
      </TouchableOpacity>
    </View>
  );

  // Members visible to everyone: just avatars + first name, capped at 6
  const previewMembers = members.slice(0, 6);
  // Full member list only for members
  const fullMembers = members;

  return (
    <View style={s.container}>
      {/* Header */}
      <LinearGradient colors={['#0f172a', '#1a0f2e']} style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <AppText style={s.headerTitle}>Family</AppText>
        {isMember && (
          <TouchableOpacity
            onPress={() => navigation.navigate('Family')}
            style={s.headerAction}
          >
            <AppText style={s.headerActionText}>Open</AppText>
          </TouchableOpacity>
        )}
        {!isMember && <View style={{ width: 52 }} />}
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>

        {/* Family banner */}
        <LinearGradient colors={['#1a0f2e', '#0f172a']} style={s.banner}>
          <LinearGradient colors={['#7c3aed', '#3b82f6']} style={s.familyIconBig}>
            <Ionicons name="people" size={36} color="#fff" />
          </LinearGradient>
          <AppText style={s.familyName}>{family.name}</AppText>
          {family.description ? (
            <AppText style={s.familyDesc}>{family.description}</AppText>
          ) : null}
          <View style={s.familyMeta}>
            <View style={s.metaChip}>
              <Ionicons name="people-outline" size={13} color={colors.muted} />
              <AppText style={s.metaChipText}>{family.member_count} members</AppText>
            </View>
            <View style={s.metaChip}>
              <Ionicons name="calendar-outline" size={13} color={colors.muted} />
              <AppText style={s.metaChipText}>
                Since {new Date(family.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </AppText>
            </View>
          </View>
        </LinearGradient>

        {/* ── PUBLIC SECTION — visible to everyone ── */}
        <View style={s.section}>
          <AppText style={s.sectionTitle}>Members</AppText>
          <View style={s.memberPreviewRow}>
            {previewMembers.map((m, i) => (
              <View key={m.id || i} style={s.previewMember}>
                <Avatar uri={m.avatar_url} name={m.name} size={48} />
                <AppText style={s.previewName} numberOfLines={1}>
                  {m.name?.split(' ')[0]}
                </AppText>
              </View>
            ))}
            {members.length > 6 && (
              <View style={s.previewMember}>
                <View style={s.moreCircle}>
                  <AppText style={s.moreText}>+{members.length - 6}</AppText>
                </View>
                <AppText style={s.previewName}>more</AppText>
              </View>
            )}
          </View>
        </View>

        {/* ── MEMBERS-ONLY SECTION ── */}
        {isMember ? (
          <>
            {/* Full member list with roles */}
            <View style={s.section}>
              <AppText style={s.sectionTitle}>All Members</AppText>
              {fullMembers.map((m, i) => (
                <TouchableOpacity
                  key={m.id || i}
                  style={s.memberRow}
                  onPress={() => navigation.navigate('UserProfile', { userId: m.id, userName: m.name })}
                  activeOpacity={0.8}
                >
                  <Avatar uri={m.avatar_url} name={m.name} size={44} />
                  <View style={s.memberInfo}>
                    <View style={s.memberNameRow}>
                      <AppText style={s.memberName}>{m.name}</AppText>
                      {m.id === user?.id && (
                        <View style={s.youBadge}>
                          <AppText style={s.youBadgeText}>You</AppText>
                        </View>
                      )}
                    </View>
                    <AppText style={s.memberHandle}>@{m.username || m.name}</AppText>
                  </View>
                  <View style={[s.roleBadge, m.role === 'admin' && s.adminBadge]}>
                    <AppText style={[s.roleText, m.role === 'admin' && s.adminRoleText]}>
                      {m.role === 'admin' ? '👑 Admin' : m.role || 'Member'}
                    </AppText>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* Invite code — members only */}
            <View style={s.section}>
              <AppText style={s.sectionTitle}>Invite Code</AppText>
              <View style={s.inviteCodeBox}>
                <AppText style={s.inviteCode}>{family.invite_code}</AppText>
                <AppText style={s.inviteCodeHint}>Share this code to invite people to your family</AppText>
              </View>
            </View>

            {/* Quick actions — members only */}
            <View style={s.section}>
              <AppText style={s.sectionTitle}>Family Space</AppText>
              <View style={s.actionsGrid}>
                {[
                  { icon: 'chatbubbles-outline', label: 'Family Chat', color: '#7c3aed', onPress: () => navigation.navigate('Chat', { conversationId: null, title: `${family.name} Chat`, type: 'family' }) },
                  { icon: 'git-network-outline', label: 'Family Tree', color: '#3b82f6', onPress: () => navigation.navigate('FamilyTree') },
                  { icon: 'calendar-outline', label: 'Calendar', color: '#10b981', onPress: () => navigation.navigate('FamilyCalendar') },
                  { icon: 'restaurant-outline', label: 'Recipes', color: '#f59e0b', onPress: () => navigation.navigate('FamilyRecipes') },
                  { icon: 'wallet-outline', label: 'Budget', color: '#ec4899', onPress: () => navigation.navigate('FamilyBudget') },
                  { icon: 'book-outline', label: 'Storybooks', color: '#8b5cf6', onPress: () => navigation.navigate('Storybooks') },
                ].map(item => (
                  <TouchableOpacity key={item.label} style={s.actionItem} onPress={item.onPress} activeOpacity={0.8}>
                    <View style={[s.actionIcon, { backgroundColor: `${item.color}22` }]}>
                      <Ionicons name={item.icon} size={22} color={item.color} />
                    </View>
                    <AppText style={s.actionLabel}>{item.label}</AppText>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </>
        ) : (
          /* Non-member: show locked sections */
          <View style={s.section}>
            <View style={s.lockedCard}>
              <Ionicons name="lock-closed" size={28} color={colors.dim} style={{ marginBottom: 10 }} />
              <AppText style={s.lockedTitle}>Members Only</AppText>
              <AppText style={s.lockedSub}>
                Join this family to see the full member list, invite code, family chat, tree, calendar, and more.
              </AppText>
              <LockRow label="Full member list & roles" />
              <LockRow label="Family invite code" />
              <LockRow label="Family chat" />
              <LockRow label="Family tree, calendar, recipes & budget" />
              <LockRow label="Storybooks & memories" />
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 52, paddingBottom: 12, paddingHorizontal: 16,
    borderBottomWidth: 0.5, borderBottomColor: colors.border,
  },
  backBtn: { padding: 6, width: 36 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  headerAction: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(124,58,237,0.2)', borderWidth: 1, borderColor: 'rgba(124,58,237,0.4)' },
  headerActionText: { color: '#a78bfa', fontWeight: '700', fontSize: 13 },

  banner: {
    alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24, gap: 8,
  },
  familyIconBig: { width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  familyName: { fontSize: 26, fontWeight: '900', color: colors.text, textAlign: 'center' },
  familyDesc: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20 },
  familyMeta: { flexDirection: 'row', gap: 12, marginTop: 4 },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 0.5, borderColor: colors.border },
  metaChipText: { fontSize: 12, color: colors.muted, fontWeight: '500' },

  section: { paddingHorizontal: 16, paddingTop: 24 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 },

  // Public member preview
  memberPreviewRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  previewMember: { alignItems: 'center', gap: 6, width: 56 },
  previewName: { fontSize: 11, color: colors.text, fontWeight: '600', textAlign: 'center' },
  moreCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  moreText: { fontSize: 13, color: colors.muted, fontWeight: '700' },

  // Full member list (members only)
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  memberInfo: { flex: 1 },
  memberNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  memberName: { fontSize: 15, fontWeight: '700', color: colors.text },
  memberHandle: { fontSize: 12, color: colors.muted, marginTop: 1 },
  youBadge: { backgroundColor: 'rgba(124,58,237,0.15)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  youBadgeText: { fontSize: 10, color: colors.primary, fontWeight: '700' },
  roleBadge: { backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  adminBadge: { backgroundColor: 'rgba(245,158,11,0.12)' },
  roleText: { fontSize: 11, color: colors.muted, fontWeight: '600' },
  adminRoleText: { color: '#f59e0b' },

  // Invite code
  inviteCodeBox: { backgroundColor: 'rgba(124,58,237,0.1)', borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(124,58,237,0.25)', padding: 20, alignItems: 'center', gap: 8 },
  inviteCode: { fontSize: 32, fontWeight: '900', color: colors.primary, letterSpacing: 8 },
  inviteCodeHint: { fontSize: 12, color: colors.muted, textAlign: 'center' },

  // Actions grid
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  actionItem: { width: (width - 56) / 3, alignItems: 'center', gap: 8 },
  actionIcon: { width: 54, height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 11, color: colors.muted, fontWeight: '600', textAlign: 'center' },

  // Locked card
  lockedCard: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 24, alignItems: 'center', gap: 6 },
  lockedTitle: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 4 },
  lockedSub: { fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 19, marginBottom: 8 },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingVertical: 4 },
  lockText: { fontSize: 13, color: colors.dim },

  backBtnCenter: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: 'rgba(124,58,237,0.15)' },
});
