import { useState, useEffect, useRef } from 'react';
import {
  View, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Image, ActivityIndicator, Platform,
  KeyboardAvoidingView, Alert, Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AppText from '../components/AppText';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { colors, radius } from '../theme';
import Toast from '../components/Toast';
import useToast from '../hooks/useToast';

export default function FamilyProfileScreen({ navigation }) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { toast, hide, success, error } = useToast();

  const [family, setFamily] = useState(null);
  const [myRole, setMyRole] = useState('member');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [motto, setMotto] = useState('');
  const [avatarUri, setAvatarUri] = useState(null);
  const [coverUri, setCoverUri] = useState(null);

  // Admin permission toggles (owner controls what admins can edit)
  const [adminPerms, setAdminPerms] = useState({
    name: false,
    username: false,
    bio: true,
    motto: true,
    avatar: false,
    cover: false,
  });

  const isOwner = myRole === 'owner' || myRole === 'admin'; // treat admin as owner for editing
  const isAdmin = myRole === 'admin';
  const canEdit = isOwner || isAdmin;

  // Admins can edit everything
  const canEditField = (field) => {
    if (myRole === 'owner' || myRole === 'admin') return true;
    return false;
  };

  // ── Section 2 state ──────────────────────────────────────────
  const [members, setMembers] = useState([]);
  const [rolePerms, setRolePerms] = useState({
    admin:     { post_stories: true,  delete_stories: true,  invite_members: true,  edit_profile: true,  pin_messages: true  },
    moderator: { post_stories: true,  delete_stories: true,  invite_members: false, edit_profile: false, pin_messages: true  },
    member:    { post_stories: true,  delete_stories: false, invite_members: false, edit_profile: false, pin_messages: false },
  });
  const [selectedMember, setSelectedMember] = useState(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [roleActionLoading, setRoleActionLoading] = useState(false);
  const [activeRoleTab, setActiveRoleTab] = useState('admin');

  // ── Section 3 state ──────────────────────────────────────────
  const [memberSearch, setMemberSearch] = useState('');
  const [insights, setInsights] = useState(null);
  const [showInviteLinkModal, setShowInviteLinkModal] = useState(false);
  const [inviteLink, setInviteLink] = useState('');

  // ── Section 4 state ──────────────────────────────────────────
  const [privacy, setPrivacy] = useState('private');
  const [privacyPerms, setPrivacyPerms] = useState({
    see_members:    'members',   // members | connections | public
    see_stories:    'members',
    allow_requests: false,
  });
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  // ── Invite state ──────────────────────────────────────────
  const [inviteQuery, setInviteQuery] = useState('');
  const [inviteResults, setInviteResults] = useState([]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteSending, setInviteSending] = useState(null);
  const [inviteSent, setInviteSent] = useState(new Set());
  const inviteTimer = useRef(null);

  useEffect(() => {
    fetchFamily();
  }, []);

  const fetchFamily = async () => {
    try {
      const { data } = await api.get('/family/my-family');
      const f = data.family;
      const me = data.members?.find(m => m.id === user?.id);
      setFamily(f);
      setMyRole(me?.role || 'member');
      setName(f.name || '');
      setUsername(f.username || '');
      setBio(f.description || '');
      setMotto(f.motto || '');
      setMembers(data.members || []);
      // Load insights for smart labels
      try {
        const ins = await api.get(`/family/${data.family.id}/insights`);
        setInsights(ins.data);
        const link = `kinscribe://join?code=${data.family.invite_code}`;
        setInviteLink(link);
      } catch {}
      // Load privacy settings
      setPrivacy(f.privacy || 'private');
      if (f.permissions) {
        try {
          const p = typeof f.permissions === 'string' ? JSON.parse(f.permissions) : f.permissions;
          if (p.adminCanEdit) setAdminPerms(prev => ({ ...prev, ...p.adminCanEdit }));
          if (p.rolePerms) setRolePerms(prev => ({ ...prev, ...p.rolePerms }));
          if (p.privacyPerms) setPrivacyPerms(prev => ({ ...prev, ...p.privacyPerms }));
        } catch {}
      }
    } catch { error('Could not load family'); }
    finally { setLoading(false); }
  };

  const pickImage = async (type) => {
    if (!canEditField(type)) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: type === 'avatar' ? [1, 1] : [16, 9],
      quality: 0.85,
    });
    if (!result.canceled) {
      if (type === 'avatar') setAvatarUri(result.assets[0].uri);
      else setCoverUri(result.assets[0].uri);
    }
  };

  const savePrivacy = async () => {
    if (!isOwner) return;
    setSavingPrivacy(true);
    try {
      await api.patch(`/family/${family.id}/update`, {
        privacy,
        permissions: JSON.stringify({ adminCanEdit: adminPerms, rolePerms, privacyPerms }),
      });
      success('Privacy settings saved!');
    } catch (e) {
      error(e.response?.data?.error || 'Failed to save');
    } finally { setSavingPrivacy(false); }
  };

  const handleRemoveMember = (memberId, memberName) => {
    Alert.alert(
      'Remove Member',
      `Remove ${memberName} from the family?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: async () => {
          try {
            await api.delete(`/family/members/${memberId}`);
            setMembers(prev => prev.filter(m => m.id !== memberId));
            setShowRoleModal(false);
            success(`${memberName} removed`);
          } catch (e) { error(e.response?.data?.error || 'Failed'); }
        }},
      ]
    );
  };

  const handleBlockMember = (memberId, memberName) => {
    Alert.alert(
      'Block from Family',
      `Block ${memberName}? They will be removed and cannot rejoin.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Block', style: 'destructive', onPress: async () => {
          try {
            await api.delete(`/family/members/${memberId}`);
            setMembers(prev => prev.filter(m => m.id !== memberId));
            setShowRoleModal(false);
            success(`${memberName} blocked from family`);
          } catch (e) { error(e.response?.data?.error || 'Failed'); }
        }},
      ]
    );
  };

  const searchInviteUsers = (text) => {
    setInviteQuery(text);
    clearTimeout(inviteTimer.current);
    if (!text.trim() || text.length < 2) { setInviteResults([]); return; }
    inviteTimer.current = setTimeout(async () => {
      setInviteLoading(true);
      try {
        const { data } = await api.get(`/connections/search?q=${encodeURIComponent(text)}`);
        // Filter out existing members
        const memberIds = new Set(members.map(m => m.id));
        setInviteResults((data.users || []).filter(u => !memberIds.has(u.id)));
      } catch {} finally { setInviteLoading(false); }
    }, 350);
  };

  const sendInvite = async (targetUser) => {
    setInviteSending(targetUser.id);
    try {
      await api.post('/family/invite/send', { user_id: targetUser.id });
      setInviteSent(prev => new Set([...prev, targetUser.id]));
      success(`Invite sent to ${targetUser.name}`);
    } catch (e) {
      error(e.response?.data?.error || 'Failed to send invite');
    } finally { setInviteSending(null); }
  };

  const handleRoleAction = async (memberId, newRole) => {
    setRoleActionLoading(true);
    try {
      await api.patch(`/family/members/${memberId}/role`, { role: newRole });
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m));
      setShowRoleModal(false);
      success(`Role updated to ${newRole}`);
    } catch (e) {
      error(e.response?.data?.error || 'Failed to update role');
    } finally { setRoleActionLoading(false); }
  };

  const handleTransferOwnership = (memberId, memberName) => {
    Alert.alert(
      'Transfer Ownership',
      `Are you sure you want to make ${memberName} the new owner? You will become an admin.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Transfer', style: 'destructive', onPress: async () => {
          setRoleActionLoading(true);
          try {
            await api.post(`/family/${family.id}/transfer`, { user_id: memberId });
            setMyRole('admin');
            setMembers(prev => prev.map(m => {
              if (m.id === memberId) return { ...m, role: 'owner' };
              if (m.id === user?.id) return { ...m, role: 'admin' };
              return m;
            }));
            setShowRoleModal(false);
            success('Ownership transferred');
          } catch (e) {
            error(e.response?.data?.error || 'Failed to transfer');
          } finally { setRoleActionLoading(false); }
        }},
      ]
    );
  };

  const handleSave = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      const formData = new FormData();
      if (canEditField('name')) formData.append('name', name);
      if (canEditField('username')) formData.append('username', username);
      if (canEditField('bio')) formData.append('description', bio);
      if (canEditField('motto')) formData.append('motto', motto);
      if (avatarUri && canEditField('avatar')) formData.append('avatar', { uri: avatarUri, type: 'image/jpeg', name: 'avatar.jpg' });
      if (coverUri && canEditField('cover')) formData.append('cover', { uri: coverUri, type: 'image/jpeg', name: 'cover.jpg' });
      // Owner saves the admin permission toggles too
      if (isOwner) {
        formData.append('permissions', JSON.stringify({ adminCanEdit: adminPerms, rolePerms }));
      }
      const { data } = await api.patch(
        `/family/${family.id}/update`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      setFamily(data.family);
      setAvatarUri(null);
      setCoverUri(null);
      success('Family profile updated!');
    } catch (e) {
      error(e.response?.data?.error || 'Failed to save');
    } finally { setSaving(false); }
  };

  if (loading) {
    return (
      <View style={[s.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const avatarSrc = avatarUri || family?.avatar_url;
  const coverSrc = coverUri || family?.cover_url;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Toast visible={toast.visible} type={toast.type} message={toast.message} onHide={hide} />
      <LinearGradient colors={['#0f172a', '#1a0f2e', '#0f172a']} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <AppText style={s.headerTitle}>Family Profile</AppText>
        {canEdit ? (
          <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.5 }]} onPress={handleSave} disabled={saving}>
            {saving
              ? <ActivityIndicator size="small" color="#fff" />
              : <AppText style={s.saveBtnText}>Save</AppText>}
          </TouchableOpacity>
        ) : <View style={{ width: 60 }} />}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>

        {/* ── COVER PHOTO ── */}
        <TouchableOpacity
          activeOpacity={canEdit ? 0.8 : 1}
          onPress={() => pickImage('cover')}
          style={s.coverWrap}
        >
          {coverSrc
            ? <Image source={{ uri: coverSrc }} style={s.cover} resizeMode="cover" />
            : <LinearGradient colors={[family?.theme_color || '#7c3aed', '#3b82f6']} style={s.cover} />}
          {canEdit && (
            <View style={s.coverEditBadge}>
              <Ionicons name="camera" size={14} color="#fff" />
              <AppText style={s.coverEditText}>Edit Cover</AppText>
            </View>
          )}
        </TouchableOpacity>

        {/* ── AVATAR ── */}
        <View style={s.avatarSection}>
          <TouchableOpacity
            activeOpacity={canEdit ? 0.8 : 1}
            onPress={() => pickImage('avatar')}
            style={s.avatarWrap}
          >
            {avatarSrc
              ? <Image source={{ uri: avatarSrc }} style={s.avatar} />
              : <LinearGradient colors={['#7c3aed', '#3b82f6']} style={s.avatar}>
                  <Ionicons name="people" size={36} color="#fff" />
                </LinearGradient>}
            {canEdit && (
              <View style={s.avatarEditBadge}>
                <Ionicons name="camera" size={12} color="#fff" />
              </View>
            )}
          </TouchableOpacity>

          <View style={s.roleBadge}>
            <AppText style={s.roleBadgeText}>{myRole.toUpperCase()}</AppText>
          </View>
        </View>

        {/* ── IDENTITY FIELDS ── */}
        <View style={s.section}>
          <AppText style={s.sectionTitle}>Family Identity</AppText>

          <AppText style={[s.label, { color: theme.muted }]}>Family Name</AppText>
          <TextInput
            style={[s.input, { color: canEditField('name') ? '#fff' : theme.muted, borderColor: theme.border2, opacity: canEditField('name') ? 1 : 0.5 }]}
            value={name}
            onChangeText={setName}
            placeholder="e.g. The Martins"
            placeholderTextColor={theme.dim}
            editable={canEditField('name')}
          />

          <AppText style={[s.label, { color: theme.muted }]}>Username / Handle</AppText>
          <View style={[s.inputRow, { opacity: canEditField('username') ? 1 : 0.5 }]}>
            <AppText style={s.atSign}>@</AppText>
            <TextInput
              style={[s.inputInner, { color: canEditField('username') ? '#fff' : theme.muted }]}
              value={username}
              onChangeText={v => setUsername(v.toLowerCase().replace(/\s/g, ''))}
              placeholder="themartins"
              placeholderTextColor={theme.dim}
              autoCapitalize="none"
              editable={canEditField('username')}
            />
          </View>

          <AppText style={[s.label, { color: theme.muted }]}>Bio / Description</AppText>
          <TextInput
            style={[s.input, s.textarea, { color: canEditField('bio') ? '#fff' : theme.muted, borderColor: theme.border2, opacity: canEditField('bio') ? 1 : 0.5 }]}
            value={bio}
            onChangeText={setBio}
            placeholder="Tell the world about your family..."
            placeholderTextColor={theme.dim}
            multiline
            editable={canEditField('bio')}
            maxLength={300}
          />
          <AppText style={[s.charCount, { color: theme.dim }]}>{bio.length}/300</AppText>

          <AppText style={[s.label, { color: theme.muted }]}>Family Motto</AppText>
          <TextInput
            style={[s.input, { color: canEditField('motto') ? '#fff' : theme.muted, borderColor: theme.border2, opacity: canEditField('motto') ? 1 : 0.5 }]}
            value={motto}
            onChangeText={setMotto}
            placeholder="e.g. Together we rise"
            placeholderTextColor={theme.dim}
            editable={canEditField('motto')}
            maxLength={100}
          />
        </View>

        {/* ── OWNER: ADMIN PERMISSION TOGGLES ── */}
        {isOwner && (
          <View style={s.section}>
            <View style={s.sectionHeaderRow}>
              <Ionicons name="shield-checkmark-outline" size={16} color="#a78bfa" />
              <AppText style={s.sectionTitle}>What Admins Can Edit</AppText>
            </View>
            <AppText style={[s.sectionSub, { color: theme.muted }]}>Toggle which fields admins are allowed to change</AppText>
            {[
              { key: 'name', label: 'Family Name', icon: 'text-outline' },
              { key: 'username', label: 'Username / Handle', icon: 'at-outline' },
              { key: 'bio', label: 'Bio / Description', icon: 'document-text-outline' },
              { key: 'motto', label: 'Family Motto', icon: 'chatbubble-ellipses-outline' },
              { key: 'avatar', label: 'Profile Picture', icon: 'image-outline' },
              { key: 'cover', label: 'Cover Photo', icon: 'albums-outline' },
            ].map(item => (
              <TouchableOpacity
                key={item.key}
                style={s.permRow}
                onPress={() => setAdminPerms(p => ({ ...p, [item.key]: !p[item.key] }))}
                activeOpacity={0.8}
              >
                <View style={s.permLeft}>
                  <View style={[s.permIcon, { backgroundColor: adminPerms[item.key] ? 'rgba(124,58,237,0.2)' : 'rgba(100,116,139,0.1)' }]}>
                    <Ionicons name={item.icon} size={16} color={adminPerms[item.key] ? '#a78bfa' : theme.muted} />
                  </View>
                  <AppText style={[s.permLabel, { color: adminPerms[item.key] ? '#fff' : theme.muted }]}>{item.label}</AppText>
                </View>
                <View style={[s.toggle, { backgroundColor: adminPerms[item.key] ? '#7c3aed' : 'rgba(100,116,139,0.3)' }]}>
                  <View style={[s.toggleThumb, { transform: [{ translateX: adminPerms[item.key] ? 18 : 2 }] }]} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {!canEdit && (
          <View style={s.readOnlyBanner}>
            <Ionicons name="lock-closed-outline" size={14} color={theme.muted} />
            <AppText style={[s.readOnlyText, { color: theme.muted }]}>Only admins and the owner can edit the family profile</AppText>
          </View>
        )}

        {/* ── SECTION 2: ROLES & PERMISSIONS ── */}
        {isOwner && (
          <View style={s.section}>
            <View style={s.sectionHeaderRow}>
              <Ionicons name="key-outline" size={16} color="#a78bfa" />
              <AppText style={s.sectionTitle}>Role Permissions</AppText>
            </View>
            <AppText style={[s.sectionSub, { color: theme.muted }]}>Control what each role can do inside the family</AppText>

            {/* Role tabs */}
            <View style={s.roleTabs}>
              {['admin', 'moderator', 'member'].map(r => (
                <TouchableOpacity
                  key={r}
                  style={[s.roleTab, activeRoleTab === r && s.roleTabActive]}
                  onPress={() => setActiveRoleTab(r)}
                >
                  <AppText style={[s.roleTabText, { color: activeRoleTab === r ? '#fff' : theme.muted }]}>
                    {r === 'admin' ? '⚙️ Admin' : r === 'moderator' ? '🛡️ Mod' : '👤 Member'}
                  </AppText>
                </TouchableOpacity>
              ))}
            </View>

            {/* Permission toggles for selected role */}
            {[
              { key: 'post_stories',   label: 'Post Family Stories',  icon: 'time-outline' },
              { key: 'delete_stories', label: 'Delete Stories',        icon: 'trash-outline' },
              { key: 'invite_members', label: 'Invite Members',        icon: 'person-add-outline' },
              { key: 'edit_profile',   label: 'Edit Family Profile',   icon: 'create-outline' },
              { key: 'pin_messages',   label: 'Pin Messages',          icon: 'pin-outline' },
            ].map(perm => {
              const val = rolePerms[activeRoleTab]?.[perm.key] ?? false;
              return (
                <TouchableOpacity
                  key={perm.key}
                  style={s.permRow}
                  onPress={() => setRolePerms(prev => ({
                    ...prev,
                    [activeRoleTab]: { ...prev[activeRoleTab], [perm.key]: !val },
                  }))}
                  activeOpacity={0.8}
                >
                  <View style={s.permLeft}>
                    <View style={[s.permIcon, { backgroundColor: val ? 'rgba(124,58,237,0.2)' : 'rgba(100,116,139,0.1)' }]}>
                      <Ionicons name={perm.icon} size={16} color={val ? '#a78bfa' : theme.muted} />
                    </View>
                    <AppText style={[s.permLabel, { color: val ? '#fff' : theme.muted }]}>{perm.label}</AppText>
                  </View>
                  <View style={[s.toggle, { backgroundColor: val ? '#7c3aed' : 'rgba(100,116,139,0.3)' }]}>
                    <View style={[s.toggleThumb, { transform: [{ translateX: val ? 18 : 2 }] }]} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ── SECTION 3: MEMBERS MANAGEMENT ── */}
        {(isOwner || isAdmin) && (
          <View style={s.section}>
            <View style={s.sectionHeaderRow}>
              <Ionicons name="people-outline" size={16} color="#a78bfa" />
              <AppText style={s.sectionTitle}>Members ({members.length})</AppText>
            </View>

            {/* Search members */}
            <View style={[s.inviteSearchRow, { borderColor: memberSearch ? '#7c3aed' : 'rgba(100,116,139,0.3)', marginBottom: 12 }]}>
              <Ionicons name="search" size={16} color={memberSearch ? '#7c3aed' : theme.muted} />
              <TextInput
                style={[s.inviteSearchInput, { color: '#fff' }]}
                placeholder="Search members..."
                placeholderTextColor={theme.dim}
                value={memberSearch}
                onChangeText={setMemberSearch}
              />
              {memberSearch.length > 0 && (
                <TouchableOpacity onPress={() => setMemberSearch('')}>
                  <Ionicons name="close-circle" size={16} color={theme.muted} />
                </TouchableOpacity>
              )}
            </View>

            {/* Members list */}
            {members
              .filter(m => !memberSearch || m.name?.toLowerCase().includes(memberSearch.toLowerCase()) || m.username?.toLowerCase().includes(memberSearch.toLowerCase()))
              .map(m => {
                const isMe = m.id === user?.id;
                const roleColor = m.role === 'owner' ? '#f59e0b' : m.role === 'admin' ? '#7c3aed' : m.role === 'moderator' ? '#3b82f6' : theme.muted;

                // Smart labels
                const isTopContributor = insights?.leaderboard?.[0]?.id === m.id;
                const isRecentlyJoined = m.joined_at && (Date.now() - new Date(m.joined_at)) < 7 * 24 * 60 * 60 * 1000;

                return (
                  <View key={m.id} style={s.memberRow}>
                    {/* Avatar */}
                    <View style={s.memberAvatar}>
                      {m.avatar_url
                        ? <Image source={{ uri: m.avatar_url }} style={{ width: 44, height: 44, borderRadius: 22 }} />
                        : <AppText style={s.memberAvatarLetter}>{m.name?.[0]?.toUpperCase()}</AppText>}
                    </View>

                    {/* Info */}
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <AppText style={s.memberName}>{m.name}{isMe ? ' (You)' : ''}</AppText>
                        {isTopContributor && (
                          <View style={s.smartLabel}>
                            <AppText style={[s.smartLabelText, { color: '#f59e0b' }]}>🔥 Most Active</AppText>
                          </View>
                        )}
                        {isRecentlyJoined && (
                          <View style={[s.smartLabel, { backgroundColor: 'rgba(16,185,129,0.15)', borderColor: 'rgba(16,185,129,0.3)' }]}>
                            <AppText style={[s.smartLabelText, { color: '#10b981' }]}>✨ New</AppText>
                          </View>
                        )}
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                        {m.username && <AppText style={[s.memberUsername, { color: theme.muted }]}>@{m.username}</AppText>}
                        <View style={[s.memberRoleBadge, { backgroundColor: `${roleColor}22`, borderColor: `${roleColor}55` }]}>
                          <AppText style={[s.memberRoleText, { color: roleColor }]}>
                            {m.role === 'owner' ? '👑 Owner' : m.role === 'admin' ? '⚙️ Admin' : m.role === 'moderator' ? '🛡️ Mod' : '👤 Member'}
                          </AppText>
                        </View>
                      </View>
                    </View>

                    {/* Action button */}
                    {!isMe && (isOwner || (isAdmin && m.role === 'member')) && (
                      <TouchableOpacity
                        style={s.memberActionBtn}
                        onPress={() => { setSelectedMember(m); setShowRoleModal(true); }}
                      >
                        <Ionicons name="ellipsis-vertical" size={18} color={theme.muted} />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
          </View>
        )}

        {/* ── INVITE MEMBERS SECTION ── */}
        {(isOwner || isAdmin) && (
          <View style={s.section}>
            <View style={s.sectionHeaderRow}>
              <Ionicons name="person-add-outline" size={16} color="#a78bfa" />
              <AppText style={s.sectionTitle}>Invite Members</AppText>
            </View>
            <AppText style={[s.sectionSub, { color: theme.muted }]}>Search and invite people to join your family</AppText>

            {/* Search input */}
            <View style={[s.inviteSearchRow, { borderColor: inviteQuery ? '#7c3aed' : theme.border2 }]}>
              <Ionicons name="search" size={16} color={inviteQuery ? '#7c3aed' : theme.muted} />
              <TextInput
                style={[s.inviteSearchInput, { color: '#fff' }]}
                placeholder="Search by name or @username..."
                placeholderTextColor={theme.dim}
                value={inviteQuery}
                onChangeText={searchInviteUsers}
                autoCapitalize="none"
              />
              {inviteLoading && <ActivityIndicator size="small" color="#7c3aed" />}
              {inviteQuery.length > 0 && !inviteLoading && (
                <TouchableOpacity onPress={() => { setInviteQuery(''); setInviteResults([]); }}>
                  <Ionicons name="close-circle" size={16} color={theme.muted} />
                </TouchableOpacity>
              )}
            </View>

            {/* Results */}
            {inviteResults.map(u => {
              const sent = inviteSent.has(u.id);
              const sending = inviteSending === u.id;
              return (
                <View key={u.id} style={s.inviteRow}>
                  <View style={s.memberAvatar}>
                    {u.avatar_url
                      ? <Image source={{ uri: u.avatar_url }} style={{ width: 42, height: 42, borderRadius: 21 }} />
                      : <AppText style={s.memberAvatarLetter}>{u.name?.[0]?.toUpperCase()}</AppText>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText style={s.memberName}>{u.name}</AppText>
                    <AppText style={[s.sectionSub, { color: theme.muted, marginBottom: 0 }]}>@{u.username}</AppText>
                  </View>
                  <TouchableOpacity
                    style={[s.inviteBtn, sent && s.inviteBtnSent]}
                    onPress={() => !sent && sendInvite(u)}
                    disabled={sending || sent}
                  >
                    {sending
                      ? <ActivityIndicator size="small" color="#fff" />
                      : sent
                        ? <><Ionicons name="checkmark" size={14} color="#fff" /><AppText style={s.inviteBtnText}>Sent</AppText></>
                        : <><Ionicons name="paper-plane-outline" size={14} color="#fff" /><AppText style={s.inviteBtnText}>Invite</AppText></>}
                  </TouchableOpacity>
                </View>
              );
            })}

            {inviteQuery.length >= 2 && !inviteLoading && inviteResults.length === 0 && (
              <View style={s.inviteEmpty}>
                <AppText style={{ color: theme.muted, fontSize: 13 }}>No users found</AppText>
              </View>
            )}
          </View>
        )}

        {/* ── INVITE VIA LINK & QR ── */}
        {(isOwner || isAdmin) && (
          <View style={s.section}>
            <View style={s.sectionHeaderRow}>
              <Ionicons name="link-outline" size={16} color="#a78bfa" />
              <AppText style={s.sectionTitle}>Invite via Link</AppText>
            </View>
            <AppText style={[s.sectionSub, { color: theme.muted }]}>Share your family invite code or link</AppText>

            {/* Invite code pill */}
            <View style={s.inviteCodeRow}>
              <View style={s.inviteCodeBox}>
                <AppText style={s.inviteCodeLabel}>Invite Code</AppText>
                <AppText style={s.inviteCodeValue}>{family?.invite_code}</AppText>
              </View>
              <TouchableOpacity
                style={s.inviteCodeCopy}
                onPress={() => {
                  // Clipboard.setString(family?.invite_code);
                  success('Code copied!');
                }}
              >
                <Ionicons name="copy-outline" size={18} color="#a78bfa" />
                <AppText style={{ color: '#a78bfa', fontSize: 12, fontWeight: '700' }}>Copy</AppText>
              </TouchableOpacity>
            </View>

            {/* Share link button */}
            <TouchableOpacity
              style={s.shareLinkBtn}
              onPress={() => setShowInviteLinkModal(true)}
            >
              <LinearGradient colors={['#7c3aed', '#3b82f6']} style={s.shareLinkGrad}>
                <Ionicons name="share-social-outline" size={18} color="#fff" />
                <AppText style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Share Invite Link</AppText>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* Invite link modal */}
        <Modal visible={showInviteLinkModal} transparent animationType="slide" onRequestClose={() => setShowInviteLinkModal(false)}>
          <View style={s.modalOverlay}>
            <View style={[s.modalSheet, { backgroundColor: theme.bgCard }]}>
              <View style={s.modalHandle} />
              <AppText style={[s.sectionTitle, { paddingHorizontal: 20, marginBottom: 16 }]}>Share Family Invite</AppText>

              {/* Link row */}
              <View style={[s.inviteLinkBox, { backgroundColor: 'rgba(30,41,59,0.8)', borderColor: theme.border2 }]}>
                <AppText style={[s.inviteLinkText, { color: theme.muted }]} numberOfLines={1}>{inviteLink}</AppText>
                <TouchableOpacity onPress={() => success('Link copied!')}>
                  <Ionicons name="copy-outline" size={18} color="#a78bfa" />
                </TouchableOpacity>
              </View>

              {/* QR Code placeholder */}
              <View style={s.qrBox}>
                <View style={s.qrPlaceholder}>
                  <Ionicons name="qr-code-outline" size={80} color="#a78bfa" />
                  <AppText style={[s.sectionSub, { color: theme.muted, textAlign: 'center', marginTop: 8 }]}>
                    Code: {family?.invite_code}
                  </AppText>
                  <AppText style={{ color: theme.dim, fontSize: 11, textAlign: 'center', marginTop: 4 }}>
                    Screenshot and share this code
                  </AppText>
                </View>
              </View>

              <TouchableOpacity
                style={[s.modalCancelBtn, { borderColor: theme.border2, margin: 16 }]}
                onPress={() => setShowInviteLinkModal(false)}
              >
                <AppText style={{ color: theme.muted, fontWeight: '600' }}>Close</AppText>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* ── SECTION 4: FAMILY PRIVACY SETTINGS ── */}
        {isOwner && (
          <View style={s.section}>
            <View style={s.sectionHeaderRow}>
              <Ionicons name="lock-closed-outline" size={16} color="#a78bfa" />
              <AppText style={s.sectionTitle}>Privacy Settings</AppText>
            </View>
            <AppText style={[s.sectionSub, { color: theme.muted }]}>Control who can see and join your family</AppText>

            {/* Privacy mode selector */}
            {[
              { key: 'private',     icon: 'lock-closed',   color: '#f59e0b', label: 'Private',          sub: 'Invite only — no one can find or request to join' },
              { key: 'connections', icon: 'people',        color: '#7c3aed', label: 'Connections Only', sub: 'Only your connections can discover this family' },
              { key: 'public',      icon: 'globe-outline', color: '#3b82f6', label: 'Public',           sub: 'Anyone can discover and request to join' },
            ].map(opt => (
              <TouchableOpacity
                key={opt.key}
                style={[s.privacyOption, privacy === opt.key && { borderColor: opt.color, backgroundColor: `${opt.color}15` }]}
                onPress={() => setPrivacy(opt.key)}
                activeOpacity={0.8}
              >
                <View style={[s.privacyOptionIcon, { backgroundColor: `${opt.color}22` }]}>
                  <Ionicons name={opt.icon} size={20} color={opt.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText style={[s.privacyOptionLabel, { color: privacy === opt.key ? opt.color : '#fff' }]}>{opt.label}</AppText>
                  <AppText style={[s.privacyOptionSub, { color: theme.muted }]}>{opt.sub}</AppText>
                </View>
                <View style={[s.radioOuter, { borderColor: privacy === opt.key ? opt.color : theme.muted }]}>
                  {privacy === opt.key && <View style={[s.radioInner, { backgroundColor: opt.color }]} />}
                </View>
              </TouchableOpacity>
            ))}

            {/* Extra controls */}
            <AppText style={[s.label, { color: theme.muted, marginTop: 20 }]}>Who can see the members list</AppText>
            <View style={s.segmentRow}>
              {['members', 'connections', 'public'].map(v => (
                <TouchableOpacity
                  key={v}
                  style={[s.segment, privacyPerms.see_members === v && s.segmentActive]}
                  onPress={() => setPrivacyPerms(p => ({ ...p, see_members: v }))}
                >
                  <AppText style={[s.segmentText, { color: privacyPerms.see_members === v ? '#fff' : theme.muted }]}>
                    {v === 'members' ? 'Members only' : v === 'connections' ? 'Connections' : 'Everyone'}
                  </AppText>
                </TouchableOpacity>
              ))}
            </View>

            <AppText style={[s.label, { color: theme.muted }]}>Who can see family stories</AppText>
            <View style={s.segmentRow}>
              {['members', 'connections', 'public'].map(v => (
                <TouchableOpacity
                  key={v}
                  style={[s.segment, privacyPerms.see_stories === v && s.segmentActive]}
                  onPress={() => setPrivacyPerms(p => ({ ...p, see_stories: v }))}
                >
                  <AppText style={[s.segmentText, { color: privacyPerms.see_stories === v ? '#fff' : theme.muted }]}>
                    {v === 'members' ? 'Members only' : v === 'connections' ? 'Connections' : 'Everyone'}
                  </AppText>
                </TouchableOpacity>
              ))}
            </View>

            {/* Allow join requests toggle */}
            <TouchableOpacity
              style={[s.permRow, { alignItems: 'center' }]}
              onPress={() => setPrivacyPerms(p => ({ ...p, allow_requests: !p.allow_requests }))}
              activeOpacity={0.8}
            >
              <View style={s.permLeft}>
                <View style={[s.permIcon, { backgroundColor: privacyPerms.allow_requests ? 'rgba(16,185,129,0.2)' : 'rgba(100,116,139,0.1)' }]}>
                  <Ionicons name="person-add-outline" size={16} color={privacyPerms.allow_requests ? '#10b981' : theme.muted} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText style={[s.permLabel, { color: privacyPerms.allow_requests ? '#fff' : theme.muted }]}>Allow Join Requests</AppText>
                  <AppText style={{ color: theme.dim, fontSize: 11, marginTop: 2 }}>Outsiders can request to join this family</AppText>
                </View>
              </View>
              <View style={[s.toggle, { backgroundColor: privacyPerms.allow_requests ? '#10b981' : 'rgba(100,116,139,0.3)', alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }]}>
                {privacyPerms.allow_requests
                  ? <Ionicons name="checkmark" size={14} color="#fff" style={{ position: 'absolute', right: 4 }} />
                  : null}
                <View style={[s.toggleThumb, { transform: [{ translateX: privacyPerms.allow_requests ? 18 : 2 }] }]} />
              </View>
            </TouchableOpacity>

            {/* Save button */}
            <TouchableOpacity
              style={[s.savePrivacyBtn, savingPrivacy && { opacity: 0.5 }]}
              onPress={savePrivacy}
              disabled={savingPrivacy}
            >
              <LinearGradient colors={['#7c3aed', '#3b82f6']} style={s.savePrivacyGrad}>
                {savingPrivacy
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <><Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
                    <AppText style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Save Privacy Settings</AppText></>}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* ── ROLE ACTION MODAL ── */}
        <Modal visible={showRoleModal} transparent animationType="slide" onRequestClose={() => setShowRoleModal(false)}>
          <View style={s.modalOverlay}>
            <View style={[s.modalSheet, { backgroundColor: theme.bgCard }]}>
              <View style={s.modalHandle} />
              {selectedMember && (
                <>
                  <View style={s.modalMemberHeader}>
                    <View style={s.memberAvatar}>
                      {selectedMember.avatar_url
                        ? <Image source={{ uri: selectedMember.avatar_url }} style={{ width: 42, height: 42, borderRadius: 21 }} />
                        : <AppText style={s.memberAvatarLetter}>{selectedMember.name?.[0]?.toUpperCase()}</AppText>}
                    </View>
                    <View>
                      <AppText style={[s.memberName, { color: theme.text }]}>{selectedMember.name}</AppText>
                      <AppText style={[s.sectionSub, { color: theme.muted, marginBottom: 0 }]}>Current role: {selectedMember.role}</AppText>
                    </View>
                  </View>

                  {/* Promote / Demote / Moderator */}
                  {[
                    selectedMember.role !== 'admin'     && { label: 'Promote to Admin',    icon: 'arrow-up-circle-outline',   color: '#7c3aed', role: 'admin' },
                    selectedMember.role !== 'moderator' && { label: 'Make Moderator',      icon: 'shield-outline',            color: '#3b82f6', role: 'moderator' },
                    selectedMember.role !== 'member'    && { label: 'Demote to Member',    icon: 'arrow-down-circle-outline', color: '#f59e0b', role: 'member' },
                  ].filter(Boolean).map(action => (
                    <TouchableOpacity
                      key={action.role}
                      style={s.modalAction}
                      onPress={() => handleRoleAction(selectedMember.id, action.role)}
                      disabled={roleActionLoading}
                    >
                      <Ionicons name={action.icon} size={20} color={action.color} />
                      <AppText style={[s.modalActionText, { color: action.color }]}>{action.label}</AppText>
                      {roleActionLoading && <ActivityIndicator size="small" color={action.color} />}
                    </TouchableOpacity>
                  ))}

                  {/* Transfer ownership — owner only */}
                  {isOwner && (
                    <TouchableOpacity
                      style={[s.modalAction, { borderTopWidth: 0.5, borderTopColor: theme.border, marginTop: 8, paddingTop: 16 }]}
                      onPress={() => handleTransferOwnership(selectedMember.id, selectedMember.name)}
                    >
                      <Ionicons name="swap-horizontal-outline" size={20} color="#f59e0b" />
                      <AppText style={[s.modalActionText, { color: '#f59e0b' }]}>Transfer Ownership</AppText>
                    </TouchableOpacity>
                  )}

                  {/* Remove & Block — owner/admin */}
                  <View style={{ borderTopWidth: 0.5, borderTopColor: theme.border, marginTop: 8, paddingTop: 8 }}>
                    <TouchableOpacity
                      style={s.modalAction}
                      onPress={() => handleRemoveMember(selectedMember.id, selectedMember.name)}
                    >
                      <Ionicons name="person-remove-outline" size={20} color="#f87171" />
                      <AppText style={[s.modalActionText, { color: '#f87171' }]}>Remove from Family</AppText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={s.modalAction}
                      onPress={() => handleBlockMember(selectedMember.id, selectedMember.name)}
                    >
                      <Ionicons name="ban-outline" size={20} color="#ef4444" />
                      <AppText style={[s.modalActionText, { color: '#ef4444' }]}>Block from Family</AppText>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity style={[s.modalCancelBtn, { borderColor: theme.border2 }]} onPress={() => setShowRoleModal(false)}>
                    <AppText style={{ color: theme.muted, fontWeight: '600' }}>Cancel</AppText>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </Modal>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 12 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  saveBtn: { backgroundColor: colors.primary, paddingHorizontal: 18, paddingVertical: 8, borderRadius: radius.full },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  coverWrap: { width: '100%', height: 180, position: 'relative' },
  cover: { width: '100%', height: '100%' },
  coverEditBadge: { position: 'absolute', bottom: 10, right: 12, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  coverEditText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  avatarSection: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: -40, marginBottom: 12 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: '#0f172a', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarEditBadge: { position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#0f172a' },
  roleBadge: { backgroundColor: 'rgba(124,58,237,0.2)', borderWidth: 1, borderColor: 'rgba(124,58,237,0.4)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: radius.full },
  roleBadgeText: { color: '#a78bfa', fontSize: 11, fontWeight: '800', letterSpacing: 1 },

  section: { paddingHorizontal: 16, paddingTop: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: '#a78bfa', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4, marginTop: 8 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4, marginTop: 8 },
  sectionSub: { fontSize: 12, marginBottom: 14 },
  label: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: 'rgba(30,41,59,0.8)', borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#fff' },
  textarea: { height: 90, textAlignVertical: 'top' },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(30,41,59,0.8)', borderWidth: 1, borderColor: 'rgba(100,116,139,0.3)', borderRadius: radius.md, paddingHorizontal: 14 },
  atSign: { color: '#a78bfa', fontSize: 16, fontWeight: '800', marginRight: 4 },
  inputInner: { flex: 1, paddingVertical: 12, fontSize: 15 },
  charCount: { fontSize: 11, textAlign: 'right', marginTop: 4 },

  readOnlyBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 16, padding: 12, backgroundColor: 'rgba(100,116,139,0.1)', borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(100,116,139,0.2)' },
  readOnlyText: { fontSize: 12, flex: 1 },

  // Permission toggles
  permRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: 'rgba(100,116,139,0.15)' },
  permLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  permIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  permLabel: { fontSize: 14, fontWeight: '600' },
  toggle: { width: 42, height: 24, borderRadius: 12, justifyContent: 'center' },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },

  // Role tabs
  roleTabs: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  roleTab: { flex: 1, paddingVertical: 8, borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(100,116,139,0.3)', alignItems: 'center' },
  roleTabActive: { backgroundColor: 'rgba(124,58,237,0.2)', borderColor: '#7c3aed' },
  roleTabText: { fontSize: 12, fontWeight: '700' },

  // Members list
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: 'rgba(100,116,139,0.12)' },
  memberAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#7c3aed', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  memberAvatarLetter: { color: '#fff', fontWeight: '800', fontSize: 16 },
  memberName: { fontSize: 14, fontWeight: '700', color: '#fff', marginBottom: 3 },
  memberRoleBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full, borderWidth: 1 },
  memberRoleText: { fontSize: 10, fontWeight: '700' },
  memberActionBtn: { padding: 8 },

  // Role action modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 36, paddingTop: 12 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(100,116,139,0.4)', alignSelf: 'center', marginBottom: 16 },
  modalMemberHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 0.5, borderBottomColor: 'rgba(100,116,139,0.2)', marginBottom: 8 },
  modalAction: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 14 },
  modalActionText: { fontSize: 15, fontWeight: '700', flex: 1 },
  modalCancelBtn: { margin: 16, padding: 14, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', marginTop: 8 },

  // Invite
  inviteSearchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(30,41,59,0.8)', borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12 },
  inviteSearchInput: { flex: 1, fontSize: 14 },
  inviteRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: 'rgba(100,116,139,0.12)' },
  inviteBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full },
  inviteBtnSent: { backgroundColor: '#10b981' },
  inviteBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  inviteEmpty: { alignItems: 'center', paddingVertical: 16 },

  // Smart labels
  smartLabel: { backgroundColor: 'rgba(245,158,11,0.15)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20 },
  smartLabelText: { fontSize: 10, fontWeight: '700' },
  memberUsername: { fontSize: 11 },

  // Invite via link
  inviteCodeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  inviteCodeBox: { flex: 1, backgroundColor: 'rgba(124,58,237,0.1)', borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)', borderRadius: radius.md, padding: 12 },
  inviteCodeLabel: { color: '#a78bfa', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  inviteCodeValue: { color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: 4 },
  inviteCodeCopy: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(124,58,237,0.1)', borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)', paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.md },
  shareLinkBtn: { borderRadius: radius.md, overflow: 'hidden' },
  shareLinkGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13 },
  inviteLinkBox: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, marginHorizontal: 16, marginBottom: 16 },
  inviteLinkText: { flex: 1, fontSize: 12 },
  qrBox: { alignItems: 'center', paddingVertical: 8 },
  qrPlaceholder: { alignItems: 'center', backgroundColor: 'rgba(124,58,237,0.08)', borderWidth: 1, borderColor: 'rgba(124,58,237,0.2)', borderRadius: 16, padding: 24, width: 200 },

  // Section 4 — Privacy
  privacyOption: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.md, borderWidth: 1.5, borderColor: 'rgba(100,116,139,0.2)', marginBottom: 10, backgroundColor: 'rgba(30,41,59,0.5)' },
  privacyOptionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  privacyOptionLabel: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  privacyOptionSub: { fontSize: 11, lineHeight: 15 },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  segmentRow: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  segment: { flex: 1, paddingVertical: 8, borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(100,116,139,0.3)', alignItems: 'center', backgroundColor: 'rgba(30,41,59,0.5)' },
  segmentActive: { backgroundColor: 'rgba(124,58,237,0.2)', borderColor: '#7c3aed' },
  segmentText: { fontSize: 11, fontWeight: '600' },
  savePrivacyBtn: { borderRadius: radius.md, overflow: 'hidden', marginTop: 16 },
  savePrivacyGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13 },
});
