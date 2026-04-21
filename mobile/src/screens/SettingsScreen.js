import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, Alert, TextInput, Image, ActivityIndicator,
  Modal, FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../api/axios';
import { colors, radius } from '../theme';
import Toast from '../components/Toast';
import useToast from '../hooks/useToast';
import { PhoneModal, TwoFactorModal, ChangePasswordModal } from '../components/SecurityModals';

const th = StyleSheet.create({
  themeRow: { flexDirection: 'row', gap: 6 },
  themeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: radius.full, borderWidth: 1,
    borderColor: 'rgba(196,163,90,0.2)',
    backgroundColor: 'rgba(42,39,32,0.6)',
  },
  themeBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  themeBtnText: { fontSize: 11, color: colors.muted, fontWeight: '600' },
  themeBtnTextActive: { color: '#F5F0E8' },
});

function Row({ icon, iconColor = '#7c3aed', label, value, onPress, toggle, toggled, danger, chevron = true }) {
  return (
    <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={toggle ? 1 : 0.7}>
      <View style={[s.rowIcon, { backgroundColor: `${iconColor}22` }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <Text style={[s.rowLabel, danger && { color: '#f87171' }]}>{label}</Text>
      {toggle ? (
        <Switch value={toggled} onValueChange={onPress} trackColor={{ true: '#7c3aed', false: colors.border2 }} thumbColor="#fff" />
      ) : value ? (
        <Text style={s.rowValue}>{value}</Text>
      ) : chevron ? (
        <Ionicons name="chevron-forward" size={16} color={colors.dim} />
      ) : null}
    </TouchableOpacity>
  );
}

function Section({ title, children }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      <BlurView intensity={15} tint="dark" style={s.card}>
        <View style={s.cardInner}>{children}</View>
      </BlurView>
    </View>
  );
}

function Divider() {
  return <View style={s.divider} />;
}

export default function SettingsScreen({ navigation }) {
  const { user, refreshUser, logout } = useAuth();
  const { theme, mode, setThemeMode, isDark } = useTheme();
  const { toast, hide, success, error } = useToast();
  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [username, setUsername] = useState(user?.username || '');
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricType, setBiometricType] = useState('biometric'); // face | fingerprint | biometric
  const [availableTypes, setAvailableTypes] = useState([]);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [showRemovePhoneModal, setShowRemovePhoneModal] = useState(false);
  const [removingPhone, setRemovingPhone] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);

  // Notification toggles — persisted in AsyncStorage
  const [notifLikes, setNotifLikes] = useState(true);
  const [notifComments, setNotifComments] = useState(true);
  const [notifMessages, setNotifMessages] = useState(true);
  const [notifStories, setNotifStories] = useState(true);
  const [notifFollows, setNotifFollows] = useState(true);
  const [savingNotif, setSavingNotif] = useState(null); // which key is saving

  // Quiet hours / DND
  const [quietHours, setQuietHours] = useState(false);
  const [quietFrom, setQuietFrom] = useState({ h: 22, m: 0 });
  const [quietTo, setQuietTo] = useState({ h: 8, m: 0 });
  const [showQuietPicker, setShowQuietPicker] = useState(false);
  const [editingQuiet, setEditingQuiet] = useState('from'); // 'from' | 'to'
  const [pickerH, setPickerH] = useState(22);
  const [pickerM, setPickerM] = useState(0);

  // Active sessions
  const [showSessionsModal, setShowSessionsModal] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [revokingId, setRevokingId] = useState(null);
  const [revokingAll, setRevokingAll] = useState(false);

  // Privacy toggles
  const [privateAccount, setPrivateAccount] = useState(user?.is_private || false);
  const [showActivity, setShowActivity] = useState(user?.show_activity !== false);
  const [allowDMs, setAllowDMs] = useState(user?.allow_dms !== false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [pendingPrivate, setPendingPrivate] = useState(false);
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  // Activity status modal
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [pendingActivity, setPendingActivity] = useState(true);
  const [savingActivity, setSavingActivity] = useState(false);
  // Allow DMs modal
  const [showDMsModal, setShowDMsModal] = useState(false);
  const [pendingDMs, setPendingDMs] = useState(true);
  const [savingDMs, setSavingDMs] = useState(false);
  // Blocked accounts modal
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);
  const [unblocking, setUnblocking] = useState(null);

  useEffect(() => {
    checkBiometricStatus();
    loadNotifSettings();
  }, []);

  const loadNotifSettings = async () => {
    try {
      const keys = ['notif_likes','notif_comments','notif_messages','notif_stories','notif_follows','notif_quiet','notif_quiet_from_h','notif_quiet_from_m','notif_quiet_to_h','notif_quiet_to_m'];
      const pairs = await AsyncStorage.multiGet(keys);
      const map = Object.fromEntries(pairs.map(([k, v]) => [k, v]));
      if (map.notif_likes !== null)     setNotifLikes(map.notif_likes !== 'false');
      if (map.notif_comments !== null)  setNotifComments(map.notif_comments !== 'false');
      if (map.notif_messages !== null)  setNotifMessages(map.notif_messages !== 'false');
      if (map.notif_stories !== null)   setNotifStories(map.notif_stories !== 'false');
      if (map.notif_follows !== null)   setNotifFollows(map.notif_follows !== 'false');
      if (map.notif_quiet !== null)     setQuietHours(map.notif_quiet === 'true');
      if (map.notif_quiet_from_h !== null) setQuietFrom(prev => ({ ...prev, h: parseInt(map.notif_quiet_from_h) }));
      if (map.notif_quiet_from_m !== null) setQuietFrom(prev => ({ ...prev, m: parseInt(map.notif_quiet_from_m) }));
      if (map.notif_quiet_to_h !== null)   setQuietTo(prev => ({ ...prev, h: parseInt(map.notif_quiet_to_h) }));
      if (map.notif_quiet_to_m !== null)   setQuietTo(prev => ({ ...prev, m: parseInt(map.notif_quiet_to_m) }));
    } catch {}
  };

  const toggleNotif = async (key, setter, currentVal) => {
    const newVal = !currentVal;
    setter(newVal);
    setSavingNotif(key);
    try {
      await AsyncStorage.setItem(`notif_${key}`, String(newVal));
      // Update the notification channel permission
      if (newVal) {
        await Notifications.requestPermissionsAsync();
      }
      success(newVal ? 'Notifications enabled' : 'Notifications disabled');
    } catch {
      setter(currentVal); // revert on failure
      error('Failed to update notification setting');
    } finally {
      setSavingNotif(null);
    }
  };

  const toggleQuietHours = async (newVal) => {
    setQuietHours(newVal);
    try {
      await AsyncStorage.setItem('notif_quiet', String(newVal));
      if (newVal) {
        success(`DND enabled: ${fmtTime(quietFrom)} – ${fmtTime(quietTo)}`);
      } else {
        success('Quiet hours disabled');
      }
    } catch {
      setQuietHours(!newVal);
    }
  };

  const openQuietPicker = (which) => {
    setEditingQuiet(which);
    const t = which === 'from' ? quietFrom : quietTo;
    setPickerH(t.h);
    setPickerM(t.m);
    setShowQuietPicker(true);
  };

  const saveQuietTime = async () => {
    const updated = { h: pickerH, m: pickerM };
    if (editingQuiet === 'from') {
      setQuietFrom(updated);
      await AsyncStorage.multiSet([['notif_quiet_from_h', String(pickerH)], ['notif_quiet_from_m', String(pickerM)]]);
    } else {
      setQuietTo(updated);
      await AsyncStorage.multiSet([['notif_quiet_to_h', String(pickerH)], ['notif_quiet_to_m', String(pickerM)]]);
    }
    setShowQuietPicker(false);
    success('Quiet hours updated');
  };

  const fmtTime = (t) => {
    const h = t.h % 12 || 12;
    const ampm = t.h < 12 ? 'AM' : 'PM';
    return `${h}:${String(t.m).padStart(2,'0')} ${ampm}`;
  };

  const _sessionTimeAgo = (dateStr) => {
    if (!dateStr) return 'Unknown';
    const diff = (Date.now() - new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z')) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const checkBiometricStatus = async () => {
    try {
      const enabled = await AsyncStorage.getItem('biometric_enabled');
      setBiometricEnabled(enabled === 'true');
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      setAvailableTypes(types);
      const hasFace = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
      const hasFingerprint = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
      if (hasFace && hasFingerprint) setBiometricType('both');
      else if (hasFace) setBiometricType('face');
      else if (hasFingerprint) setBiometricType('fingerprint');
      else setBiometricType('biometric');
    } catch {}
  };

  const toggleBiometric = async () => {
    try {
      const available = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();

      if (!available) {
        Alert.alert(
          'Not Supported',
          'Your device does not support biometric authentication.',
          [{ text: 'OK' }]
        );
        return;
      }

      if (!enrolled) {
        const hasFace = availableTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
        const hasFingerprint = availableTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
        let message = 'Please set up biometrics in your device settings first.\n\n';
        if (hasFingerprint) message += '• Go to Settings → Security → Fingerprint\n';
        if (hasFace) message += '• Go to Settings → Security → Face Recognition\n';
        message += '\nThen come back and enable biometric login.';
        Alert.alert('Biometric Not Set Up', message, [{ text: 'OK' }]);
        return;
      }

      if (biometricEnabled) {
        Alert.alert(
          'Disable Biometric Login?',
          'You will need to enter your password to sign in.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Disable',
              style: 'destructive',
              onPress: async () => {
                await AsyncStorage.removeItem('biometric_enabled');
                await AsyncStorage.removeItem('biometric_credentials');
                setBiometricEnabled(false);
                success('Biometric login disabled');
              }
            }
          ]
        );
      } else {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Authenticate to enable biometric login',
          fallbackLabel: 'Use password',
          disableDeviceFallback: false,
        });
        if (result.success) {
          const existingCredentials = await AsyncStorage.getItem('biometric_credentials');
          if (existingCredentials) {
            await AsyncStorage.setItem('biometric_enabled', 'true');
            setBiometricEnabled(true);
            success('Biometric login enabled');
          } else {
            // Mark as enabled - credentials will be saved on next password login
            await AsyncStorage.setItem('biometric_enabled', 'true');
            setBiometricEnabled(true);
            success('Biometric enabled! Sign out and back in with your password to fully activate it.');
          }
        }
      }
    } catch (err) {
      error('Failed to toggle biometric login');
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      await api.put('/auth/profile', { name, bio, username });
      await refreshUser();
      setEditMode(false);
      success('Profile updated successfully');
    } catch (err) {
      error(err.response?.data?.error || 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleAvatarUpload = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.7, base64: true,
    });
    if (!result.canceled && result.assets?.[0]) {
      setUploading(true);
      try {
        const token = await AsyncStorage.getItem('access_token');
        const res = await fetch('https://kinscribe-1.onrender.com/api/auth/avatar', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: result.assets[0].base64 }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
        await refreshUser();
        success('Profile photo updated');
      } catch (err) {
        error(err.message);
      } finally { setUploading(false); }
    }
  };

  const handleLogout = () => setShowLogoutModal(true);

  const handleDeactivate = () => Alert.alert(
    'Deactivate Account',
    'Your account will be hidden temporarily. You can reactivate anytime by logging back in.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Deactivate', style: 'destructive', onPress: async () => {
        try {
          await api.post('/auth/deactivate');
          logout();
        } catch { error('Could not deactivate. Try again.'); }
      }},
    ]
  );

  const openSessions = async () => {
    setShowSessionsModal(true);
    setLoadingSessions(true);
    try {
      const { data } = await api.get('/auth/sessions');
      setSessions(data.sessions || []);
    } catch {
      setSessions([]);
    } finally {
      setLoadingSessions(false);
    }
  };

  const revokeSession = async (sessionId) => {
    setRevokingId(sessionId);
    try {
      await api.delete(`/auth/sessions/${sessionId}`);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      success('Device signed out');
    } catch {
      error('Failed to revoke session');
    } finally {
      setRevokingId(null);
    }
  };

  const revokeAllOther = async () => {
    Alert.alert(
      'Sign Out All Other Devices?',
      'This will sign out all devices except this one.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out All', style: 'destructive', onPress: async () => {
          setRevokingAll(true);
          try {
            await api.delete('/auth/sessions/all');
            setSessions(prev => prev.filter(s => s.is_current));
            success('All other devices signed out');
          } catch {
            error('Failed to sign out other devices');
          } finally {
            setRevokingAll(false);
          }
        }},
      ]
    );
  };

  const handleDeleteAccount = () => setShowDeleteModal(true);

  const handlePrivacyToggle = (newVal) => {
    setPendingPrivate(newVal);
    setShowPrivacyModal(true);
  };

  const confirmPrivacyChange = async () => {
    setSavingPrivacy(true);
    try {
      await api.put('/auth/profile', { is_private: pendingPrivate });
      await refreshUser();
      setPrivateAccount(pendingPrivate);
      setShowPrivacyModal(false);
      success(pendingPrivate ? 'Account set to Private' : 'Account set to Public');
    } catch {
      error('Failed to update privacy setting');
    } finally {
      setSavingPrivacy(false);
    }
  };

  const handleActivityToggle = (newVal) => {
    setPendingActivity(newVal);
    setShowActivityModal(true);
  };

  const confirmActivityChange = async () => {
    setSavingActivity(true);
    try {
      await api.put('/auth/profile', { show_activity: pendingActivity });
      await refreshUser();
      setShowActivity(pendingActivity);
      setShowActivityModal(false);
      success(pendingActivity ? 'Activity status visible' : 'Activity status hidden');
    } catch {
      error('Failed to update activity setting');
    } finally {
      setSavingActivity(false);
    }
  };

  const handleDMsToggle = (newVal) => {
    setPendingDMs(newVal);
    setShowDMsModal(true);
  };

  const confirmDMsChange = async () => {
    setSavingDMs(true);
    try {
      await api.put('/auth/profile', { allow_dms: pendingDMs });
      await refreshUser();
      setAllowDMs(pendingDMs);
      setShowDMsModal(false);
      success(pendingDMs ? 'Direct messages enabled' : 'Direct messages restricted');
    } catch {
      error('Failed to update DM setting');
    } finally {
      setSavingDMs(false);
    }
  };

  const openBlockedAccounts = async () => {
    setShowBlockedModal(true);
    setLoadingBlocked(true);
    try {
      const { data } = await api.get('/connections/blocked');
      setBlockedUsers(data.blocked || []);
    } catch {
      // Table may not exist yet on first load — just show empty state
      setBlockedUsers([]);
    } finally {
      setLoadingBlocked(false);
    }
  };

  const handleUnblock = async (blockedId, name) => {
    Alert.alert(
      `Unblock ${name}?`,
      'They will be able to see your posts and follow you again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            setUnblocking(blockedId);
            try {
              await api.post(`/connections/${blockedId}/unblock`);
              setBlockedUsers(prev => prev.filter(b => b.blocked_id !== blockedId));
              success(`${name} unblocked`);
            } catch {
              error('Failed to unblock');
            } finally {
              setUnblocking(null);
            }
          },
        },
      ]
    );
  };

  const confirmDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      await api.delete('/auth/account');
      logout();
    } catch { error('Could not delete account. Contact support.'); }
    finally { setDeletingAccount(false); }
  };

  const handleRemovePhone = async () => {
    setRemovingPhone(true);
    try {
      const { data } = await api.post('/auth/phone/remove');
      await refreshUser();
      setShowRemovePhoneModal(false);
      success('Phone number removed');
    } catch { error('Failed to remove phone number'); }
    finally { setRemovingPhone(false); }
  };

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <Toast visible={toast.visible} type={toast.type} message={toast.message} onHide={hide} />
      <LinearGradient colors={isDark ? ['#1C1A14', '#2A2720', '#1C1A14'] : ['#F5F0E8', '#EDE6D6', '#F5F0E8']} style={StyleSheet.absoluteFill} />

      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Settings</Text>
        {editMode && (
          <TouchableOpacity onPress={saveProfile} disabled={saving}>
            {saving ? <ActivityIndicator color={colors.primary} size="small" /> : <Text style={s.saveBtn}>Save</Text>}
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Profile card */}
        <View style={s.profileCard}>
          <TouchableOpacity onPress={handleAvatarUpload} style={s.avatarWrap} disabled={uploading}>
            <LinearGradient colors={['#7c3aed', '#3b82f6', '#ec4899']} style={s.avatarRing}>
              <View style={s.avatarInner}>
                {uploading ? <ActivityIndicator color="#fff" /> :
                  user?.avatar_url ? <Image source={{ uri: user.avatar_url }} style={s.avatarImg} /> :
                  <Text style={s.avatarLetter}>{user?.name?.[0]?.toUpperCase()}</Text>}
              </View>
            </LinearGradient>
            <View style={s.cameraBtn}>
              <Ionicons name="camera" size={11} color="#fff" />
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setEditMode(!editMode)}>
            <Text style={s.editProfileBtn}>{editMode ? 'Cancel' : 'Edit Profile'}</Text>
          </TouchableOpacity>
        </View>

        {/* Edit fields */}
        {editMode && (
          <Section title="Edit Profile">
            <View style={s.editField}>
              <Text style={s.editLabel}>Display Name</Text>
              <TextInput style={s.editInput} value={name} onChangeText={setName} placeholderTextColor={colors.dim} />
            </View>
            <Divider />
            <View style={s.editField}>
              <Text style={s.editLabel}>Username</Text>
              <TextInput style={s.editInput} value={username} onChangeText={v => setUsername(v.toLowerCase().replace(/\s/g, ''))} autoCapitalize="none" placeholderTextColor={colors.dim} />
            </View>
            <Divider />
            <View style={s.editField}>
              <Text style={s.editLabel}>Bio</Text>
              <TextInput style={[s.editInput, { minHeight: 60 }]} value={bio} onChangeText={setBio} multiline placeholderTextColor={colors.dim} placeholder="Tell people about yourself..." />
            </View>
          </Section>
        )}

        {/* Account */}
        <Section title="Account">
          <Row icon="mail-outline" label="Email" value={user?.email} chevron={false} />
          <Divider />
          <Row 
            icon="phone-portrait-outline" 
            iconColor="#10b981"
            label="Phone Number" 
            value={user?.phone ? `••••${user.phone.slice(-4)}` : 'Not added'}
            onPress={() => setShowPhoneModal(true)} 
          />
          {user?.phone && (
            <>
              <Divider />
              <Row
                icon="trash-outline"
                iconColor="#f87171"
                label="Remove Phone Number"
                onPress={() => setShowRemovePhoneModal(true)}
              />
            </>
          )}
          <Divider />
          <Row icon="key-outline" label="Change Password" onPress={() => setShowChangePasswordModal(true)} />
          <Divider />
          <Row icon="shield-checkmark-outline" iconColor={user?.two_factor_enabled ? '#10b981' : '#94a3b8'} label="Two-Factor Authentication" value={user?.two_factor_enabled ? 'Enabled' : 'Disabled'} onPress={() => setShow2FAModal(true)} />
          <Divider />
          <Row
            icon={biometricType === 'face' ? 'scan-outline' : 'finger-print'}
            iconColor="#7c3aed"
            label={
              biometricType === 'both' ? 'Face ID & Fingerprint Login' :
              biometricType === 'face' ? 'Face ID Login' :
              biometricType === 'fingerprint' ? 'Fingerprint Login' :
              'Biometric Login'
            }
            toggle
            toggled={biometricEnabled}
            onPress={toggleBiometric}
          />
          <Divider />
          <Row icon="people-outline" iconColor="#3b82f6" label="My Family" onPress={() => { navigation.goBack(); navigation.navigate('Family'); }} />
          <Divider />
          <Row icon="swap-horizontal-outline" iconColor="#7c3aed" label="Switch Account" onPress={() => navigation.navigate('AccountSwitcher')} />
        </Section>

        {/* Privacy */}
        <Section title="Privacy">
          <View style={s.row}>
            <View style={[s.rowIcon, { backgroundColor: 'rgba(124,58,237,0.15)' }]}>
              <Ionicons name="lock-closed-outline" size={18} color="#7c3aed" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.rowLabel}>Private Account</Text>
              <Text style={s.rowSubLabel}>
                {privateAccount
                  ? 'Only approved followers see your posts'
                  : 'Anyone can see your posts and follow you'}
              </Text>
            </View>
            <Switch
              value={privateAccount}
              onValueChange={handlePrivacyToggle}
              trackColor={{ true: '#7c3aed', false: colors.border2 }}
              thumbColor="#fff"
            />
          </View>
          <Divider />
          <View style={s.row}>
            <View style={[s.rowIcon, { backgroundColor: 'rgba(16,185,129,0.15)' }]}>
              <Ionicons name="eye-outline" size={18} color="#10b981" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.rowLabel}>Show Activity Status</Text>
              <Text style={s.rowSubLabel}>
                {showActivity
                  ? 'Others can see when you were last active'
                  : 'Your activity status is hidden from everyone'}
              </Text>
            </View>
            <Switch
              value={showActivity}
              onValueChange={handleActivityToggle}
              trackColor={{ true: '#10b981', false: colors.border2 }}
              thumbColor="#fff"
            />
          </View>
          <Divider />
          <View style={s.row}>
            <View style={[s.rowIcon, { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
              <Ionicons name="chatbubble-outline" size={18} color="#3b82f6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.rowLabel}>Allow Direct Messages</Text>
              <Text style={s.rowSubLabel}>
                {allowDMs
                  ? 'Anyone can send you a message'
                  : 'Only people you follow can message you'}
              </Text>
            </View>
            <Switch
              value={allowDMs}
              onValueChange={handleDMsToggle}
              trackColor={{ true: '#3b82f6', false: colors.border2 }}
              thumbColor="#fff"
            />
          </View>
          <Divider />
          <TouchableOpacity style={s.row} onPress={openBlockedAccounts} activeOpacity={0.7}>
            <View style={[s.rowIcon, { backgroundColor: 'rgba(248,113,113,0.15)' }]}>
              <Ionicons name="ban-outline" size={18} color="#f87171" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.rowLabel, { color: '#f87171' }]}>Blocked Accounts</Text>
              <Text style={s.rowSubLabel}>Manage people you have blocked</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.dim} />
          </TouchableOpacity>
        </Section>

        {/* Notifications */}
        <Section title="Notifications">
          {[
            { key: 'likes',    setter: setNotifLikes,    val: notifLikes,    icon: 'heart-outline',       color: '#e11d48', label: 'Likes',           sub: 'When someone likes your post or story' },
            { key: 'comments', setter: setNotifComments, val: notifComments, icon: 'chatbubble-outline',  color: '#3b82f6', label: 'Comments',         sub: 'When someone comments on your post' },
            { key: 'messages', setter: setNotifMessages, val: notifMessages, icon: 'chatbubbles-outline', color: '#7c3aed', label: 'Messages',          sub: 'When you receive a new direct message' },
            { key: 'stories',  setter: setNotifStories,  val: notifStories,  icon: 'time-outline',        color: '#f59e0b', label: 'Stories',           sub: 'When someone you follow posts a story' },
            { key: 'follows',  setter: setNotifFollows,  val: notifFollows,  icon: 'person-add-outline',  color: '#10b981', label: 'New Connections',   sub: 'When someone follows or requests to follow you' },
          ].map(({ key, setter, val, icon, color, label, sub }, i, arr) => (
            <View key={key}>
              <View style={s.row}>
                <View style={[s.rowIcon, { backgroundColor: `${color}22` }]}>
                  {savingNotif === key
                    ? <ActivityIndicator size="small" color={color} />
                    : <Ionicons name={icon} size={18} color={color} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowLabel}>{label}</Text>
                  <Text style={s.rowSubLabel}>{sub}</Text>
                </View>
                <Switch
                  value={val}
                  onValueChange={() => toggleNotif(key, setter, val)}
                  trackColor={{ true: color, false: colors.border2 }}
                  thumbColor="#fff"
                  disabled={savingNotif === key}
                />
              </View>
              {i < arr.length - 1 && <Divider />}
            </View>
          ))}
          <Divider />
          {/* Quiet Hours DND */}
          <View style={s.row}>
            <View style={[s.rowIcon, { backgroundColor: 'rgba(99,102,241,0.15)' }]}>
              <Ionicons name="moon-outline" size={18} color="#6366f1" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.rowLabel}>Quiet Hours (DND)</Text>
              <Text style={s.rowSubLabel}>
                {quietHours ? `Silent ${fmtTime(quietFrom)} – ${fmtTime(quietTo)}` : 'Silence notifications during set hours'}
              </Text>
            </View>
            <Switch
              value={quietHours}
              onValueChange={toggleQuietHours}
              trackColor={{ true: '#6366f1', false: colors.border2 }}
              thumbColor="#fff"
            />
          </View>
          {quietHours && (
            <View style={s.quietRow}>
              <Ionicons name="time-outline" size={14} color={colors.muted} />
              <Text style={s.quietText}>From</Text>
              <TouchableOpacity style={s.quietTimeBtn} onPress={() => openQuietPicker('from')}>
                <Text style={s.quietTimeBtnText}>{fmtTime(quietFrom)}</Text>
                <Ionicons name="chevron-down" size={12} color="#6366f1" />
              </TouchableOpacity>
              <Text style={s.quietText}>to</Text>
              <TouchableOpacity style={s.quietTimeBtn} onPress={() => openQuietPicker('to')}>
                <Text style={s.quietTimeBtnText}>{fmtTime(quietTo)}</Text>
                <Ionicons name="chevron-down" size={12} color="#6366f1" />
              </TouchableOpacity>
            </View>
          )}
        </Section>

        {/* Active Sessions */}
        <Section title="Active Sessions">
          <TouchableOpacity style={s.row} onPress={openSessions} activeOpacity={0.7}>
            <View style={[s.rowIcon, { backgroundColor: 'rgba(6,182,212,0.15)' }]}>
              <Ionicons name="phone-portrait-outline" size={18} color="#06b6d4" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.rowLabel}>Manage Sessions</Text>
              <Text style={s.rowSubLabel}>See and sign out devices logged into your account</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.dim} />
          </TouchableOpacity>
        </Section>

        {/* Appearance */}
        <Section title="Appearance">
          <View style={s.row}>
            <View style={[s.rowIcon, { backgroundColor: 'rgba(196,163,90,0.15)' }]}>
              <Ionicons name="color-palette-outline" size={18} color={colors.gold} />
            </View>
            <Text style={s.rowLabel}>Theme</Text>
            <View style={th.themeRow}>
              {[
                { key: 'dark', icon: 'moon', label: 'Dark' },
                { key: 'light', icon: 'sunny', label: 'Light' },
                { key: 'system', icon: 'phone-portrait', label: 'Auto' },
              ].map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  style={[th.themeBtn, mode === opt.key && th.themeBtnActive]}
                  onPress={() => setThemeMode(opt.key)}
                >
                  <Ionicons
                    name={opt.icon}
                    size={16}
                    color={mode === opt.key ? '#F5F0E8' : colors.muted}
                  />
                  <Text style={[th.themeBtnText, mode === opt.key && th.themeBtnTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <Divider />
          <Row icon="text-outline" iconColor={colors.muted} label="Font Size" value="Default" onPress={() => Alert.alert('Font Size', 'Coming soon')} />
          <Divider />
          <Row icon="language-outline" iconColor="#06b6d4" label="Language" value="English" onPress={() => Alert.alert('Language', 'Coming soon')} />
        </Section>

        {/* Data & Storage */}
        <Section title="Data & Storage">
          <Row icon="cloud-download-outline" iconColor="#3b82f6" label="Download My Data" onPress={() => Alert.alert('Download Data', 'Your data export will be emailed to you within 24 hours')} />
          <Divider />
          <Row icon="cellular-outline" iconColor="#10b981" label="Data Saver Mode" toggle toggled={false} onPress={() => {}} />
          <Divider />
          <Row icon="videocam-outline" iconColor="#7c3aed" label="Auto-play Videos" toggle toggled={true} onPress={() => {}} />
        </Section>

        {/* About */}
        <Section title="Subscription">
          <View style={s.row}>
            <View style={[s.rowIcon, { backgroundColor: 'rgba(245,158,11,0.15)' }]}>
              <Ionicons name="star" size={18} color="#f59e0b" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.rowLabel}>Current Plan</Text>
              <Text style={[s.rowValue, { fontSize: 12, marginTop: 2 }]}>Free</Text>
            </View>
          </View>
          <Divider />
          <TouchableOpacity style={s.row} onPress={() => Alert.alert('KinsCribe Premium', 'Premium plan coming soon!\n\n✅ Unlimited storage\n✅ AI story generation\n✅ Priority support\n✅ Advanced analytics\n\nStay tuned!')} activeOpacity={0.7}>
            <View style={[s.rowIcon, { backgroundColor: 'rgba(124,58,237,0.15)' }]}>
              <Ionicons name="diamond-outline" size={18} color="#7c3aed" />
            </View>
            <Text style={[s.rowLabel, { color: '#7c3aed' }]}>Upgrade to Premium</Text>
            <Ionicons name="chevron-forward" size={16} color="#7c3aed" />
          </TouchableOpacity>
        </Section>

        {/* About */}
        <Section title="About">
          <Row icon="phone-portrait-outline" iconColor="#94a3b8" label="App Version" value="1.0.0" chevron={false} />
          <Divider />
          <Row icon="document-text-outline" iconColor="#94a3b8" label="Privacy Policy" onPress={() => Alert.alert('Privacy Policy', 'Your stories are private by default')} />
          <Divider />
          <Row icon="help-circle-outline" iconColor="#94a3b8" label="Help & Support" onPress={() => Alert.alert('Support', 'Email: support@kinscribe.com')} />
          <Divider />
          <Row icon="star-outline" iconColor="#f59e0b" label="Rate the App" onPress={() => Alert.alert('Rate KinsCribe', 'Thank you for your support! ⭐')} />
        </Section>

        {/* Danger zone */}
        <Section title="Account Actions">
          <Row icon="pause-circle-outline" iconColor="#f59e0b" label="Deactivate Account" onPress={handleDeactivate} />
          <Divider />
          <Row icon="log-out-outline" iconColor="#f87171" label="Log Out" onPress={handleLogout} danger />
          <Divider />
          <Row icon="trash-outline" iconColor="#f87171" label="Delete Account" onPress={handleDeleteAccount} danger />
        </Section>

        <View style={{ height: 40 }} />
      </ScrollView>

      <PhoneModal 
        visible={showPhoneModal} 
        onClose={() => setShowPhoneModal(false)}
        onSuccess={refreshUser}
      />
      
      <TwoFactorModal
        visible={show2FAModal}
        onClose={() => setShow2FAModal(false)}
        onSuccess={refreshUser}
        isEnabled={user?.two_factor_enabled}
      />

      {/* Remove Phone Confirmation Modal */}
      <Modal visible={showRemovePhoneModal} transparent animationType="fade" onRequestClose={() => setShowRemovePhoneModal(false)}>
        <View style={s.modalOverlay}>
          <BlurView intensity={20} tint="dark" style={s.confirmModal}>
            <LinearGradient colors={['rgba(248,113,113,0.08)', 'rgba(15,23,42,0.98)']} style={StyleSheet.absoluteFill} />
            <View style={s.confirmIconWrap}>
              <LinearGradient colors={['#f87171', '#ef4444']} style={s.confirmIcon}>
                <Ionicons name="trash-outline" size={26} color="#fff" />
              </LinearGradient>
            </View>
            <Text style={s.confirmTitle}>Remove Phone Number</Text>
            <Text style={s.confirmSub}>
              Are you sure you want to remove{`\n`}
              <Text style={{ color: colors.text, fontWeight: '700' }}>{user?.phone}</Text>
              {`\n`}from your account?
            </Text>
            <View style={s.confirmBtns}>
              <TouchableOpacity
                style={s.confirmCancelBtn}
                onPress={() => setShowRemovePhoneModal(false)}
                activeOpacity={0.8}
              >
                <Text style={s.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.confirmRemoveBtn}
                onPress={handleRemovePhone}
                disabled={removingPhone}
                activeOpacity={0.8}
              >
                <LinearGradient colors={['#f87171', '#ef4444']} style={s.confirmRemoveBtnGrad}>
                  {removingPhone
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={s.confirmRemoveText}>Remove</Text>}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>
      </Modal>

      {/* Logout Confirmation Modal */}
      <Modal visible={showLogoutModal} transparent animationType="fade" onRequestClose={() => setShowLogoutModal(false)}>
        <View style={s.modalOverlay}>
          <BlurView intensity={20} tint="dark" style={s.confirmModal}>
            <LinearGradient colors={['rgba(248,113,113,0.06)', 'rgba(15,23,42,0.98)']} style={StyleSheet.absoluteFill} />
            <View style={s.confirmIconWrap}>
              <LinearGradient colors={['#f87171', '#ef4444']} style={s.confirmIcon}>
                <Ionicons name="log-out-outline" size={26} color="#fff" />
              </LinearGradient>
            </View>
            <Text style={s.confirmTitle}>Log Out</Text>
            <Text style={s.confirmSub}>Are you sure you want to log out of your account?</Text>
            <View style={s.confirmBtns}>
              <TouchableOpacity style={s.confirmCancelBtn} onPress={() => setShowLogoutModal(false)} activeOpacity={0.8}>
                <Text style={s.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.confirmRemoveBtn} onPress={logout} activeOpacity={0.8}>
                <LinearGradient colors={['#f87171', '#ef4444']} style={s.confirmRemoveBtnGrad}>
                  <Text style={s.confirmRemoveText}>Log Out</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>
      </Modal>

      {/* Logout Confirmation Modal */}
      <Modal visible={showLogoutModal} transparent animationType="fade" onRequestClose={() => setShowLogoutModal(false)}>
        <View style={s.modalOverlay}>
          <BlurView intensity={20} tint="dark" style={s.confirmModal}>
            <LinearGradient colors={['rgba(248,113,113,0.06)', 'rgba(15,23,42,0.98)']} style={StyleSheet.absoluteFill} />
            <View style={s.confirmIconWrap}>
              <LinearGradient colors={['#f87171', '#ef4444']} style={s.confirmIcon}>
                <Ionicons name="log-out-outline" size={26} color="#fff" />
              </LinearGradient>
            </View>
            <Text style={s.confirmTitle}>Log Out</Text>
            <Text style={s.confirmSub}>Are you sure you want to log out of your account?</Text>
            <View style={s.confirmBtns}>
              <TouchableOpacity style={s.confirmCancelBtn} onPress={() => setShowLogoutModal(false)} activeOpacity={0.8}>
                <Text style={s.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.confirmRemoveBtn} onPress={logout} activeOpacity={0.8}>
                <LinearGradient colors={['#f87171', '#ef4444']} style={s.confirmRemoveBtnGrad}>
                  <Text style={s.confirmRemoveText}>Log Out</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>
      </Modal>

      {/* Delete Account Confirmation Modal */}
      <Modal visible={showDeleteModal} transparent animationType="fade" onRequestClose={() => setShowDeleteModal(false)}>
        <View style={s.modalOverlay}>
          <BlurView intensity={20} tint="dark" style={s.confirmModal}>
            <LinearGradient colors={['rgba(248,113,113,0.08)', 'rgba(15,23,42,0.98)']} style={StyleSheet.absoluteFill} />
            <View style={s.confirmIconWrap}>
              <LinearGradient colors={['#f87171', '#ef4444']} style={s.confirmIcon}>
                <Ionicons name="warning-outline" size={26} color="#fff" />
              </LinearGradient>
            </View>
            <Text style={s.confirmTitle}>Delete Account</Text>
            <Text style={s.confirmSub}>
              This will permanently delete your account and all your data.{`\n\n`}
              <Text style={{ color: '#f87171', fontWeight: '700' }}>This cannot be undone.</Text>
            </Text>
            <View style={s.confirmBtns}>
              <TouchableOpacity style={s.confirmCancelBtn} onPress={() => setShowDeleteModal(false)} activeOpacity={0.8}>
                <Text style={s.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.confirmRemoveBtn} onPress={confirmDeleteAccount} disabled={deletingAccount} activeOpacity={0.8}>
                <LinearGradient colors={['#f87171', '#ef4444']} style={s.confirmRemoveBtnGrad}>
                  {deletingAccount
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={s.confirmRemoveText}>Delete</Text>}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>
      </Modal>

      {/* Change Password Modal */}
      <ChangePasswordModal
        visible={showChangePasswordModal}
        onClose={() => setShowChangePasswordModal(false)}
        userEmail={user?.email}
        hasPassword={user?.has_password}
        onSuccess={() => success('Password changed successfully!')}
      />

      {/* Active Sessions Modal */}
      <Modal visible={showSessionsModal} transparent animationType="slide" onRequestClose={() => setShowSessionsModal(false)}>
        <View style={s.blockedOverlay}>
          <BlurView intensity={20} tint="dark" style={s.sessionsSheet}>
            <LinearGradient colors={['rgba(6,182,212,0.07)', 'rgba(15,23,42,0.98)']} style={StyleSheet.absoluteFill} />
            <View style={s.blockedHandle} />

            {/* Header */}
            <View style={s.sessionsHeader}>
              <View style={s.sessionsHeaderLeft}>
                <View style={[s.rowIcon, { backgroundColor: 'rgba(6,182,212,0.15)' }]}>
                  <Ionicons name="shield-checkmark-outline" size={18} color="#06b6d4" />
                </View>
                <View>
                  <Text style={s.sessionsTitle}>Active Sessions</Text>
                  <Text style={s.sessionsSubtitle}>{sessions.length} device{sessions.length !== 1 ? 's' : ''} logged in</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setShowSessionsModal(false)} style={s.blockedCloseBtn}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>

            {loadingSessions ? (
              <View style={s.blockedLoading}>
                <ActivityIndicator color="#06b6d4" size="large" />
                <Text style={s.blockedLoadingText}>Loading sessions...</Text>
              </View>
            ) : sessions.length === 0 ? (
              <View style={s.blockedEmpty}>
                <LinearGradient colors={['rgba(6,182,212,0.12)', 'rgba(6,182,212,0.04)']} style={s.blockedEmptyIcon}>
                  <Ionicons name="phone-portrait-outline" size={40} color="#06b6d4" />
                </LinearGradient>
                <Text style={s.blockedEmptyTitle}>No sessions found</Text>
                <Text style={s.blockedEmptyText}>Your active login sessions will appear here.</Text>
              </View>
            ) : (
              <ScrollView style={s.blockedList} showsVerticalScrollIndicator={false}>
                {sessions.map((sess, i) => (
                  <View key={sess.id}>
                    {i > 0 && <View style={{ height: 0.5, backgroundColor: 'rgba(255,255,255,0.05)', marginHorizontal: 0 }} />}
                    <View style={s.sessionCard}>
                      {/* Device icon */}
                      <View style={[s.sessionIconWrap, sess.is_current && s.sessionIconWrapCurrent]}>
                        <Ionicons
                          name={
                            sess.platform === 'ios' ? 'logo-apple' :
                            sess.platform === 'android' ? 'logo-android' :
                            sess.platform === 'web' ? 'globe-outline' :
                            'phone-portrait-outline'
                          }
                          size={22}
                          color={sess.is_current ? '#10b981' : '#06b6d4'}
                        />
                      </View>

                      {/* Info */}
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={s.sessionDevice}>{sess.device_name}</Text>
                          {sess.is_current && (
                            <View style={s.currentBadge}>
                              <View style={s.currentDot} />
                              <Text style={s.currentBadgeText}>This device</Text>
                            </View>
                          )}
                        </View>
                        <View style={s.sessionMeta}>
                          {sess.ip_address && (
                            <View style={s.sessionMetaItem}>
                              <Ionicons name="location-outline" size={11} color={colors.dim} />
                              <Text style={s.sessionMetaText}>{sess.ip_address}</Text>
                            </View>
                          )}
                          <View style={s.sessionMetaItem}>
                            <Ionicons name="time-outline" size={11} color={colors.dim} />
                            <Text style={s.sessionMetaText}>{_sessionTimeAgo(sess.last_active)}</Text>
                          </View>
                          <View style={s.sessionMetaItem}>
                            <Ionicons name="calendar-outline" size={11} color={colors.dim} />
                            <Text style={s.sessionMetaText}>Signed in {_sessionTimeAgo(sess.created_at)}</Text>
                          </View>
                        </View>
                      </View>

                      {/* Revoke button */}
                      {!sess.is_current && (
                        <TouchableOpacity
                          style={s.revokeBtn2}
                          onPress={() => revokeSession(sess.id)}
                          disabled={revokingId === sess.id}
                          activeOpacity={0.8}
                        >
                          {revokingId === sess.id
                            ? <ActivityIndicator size="small" color="#f87171" />
                            : <Text style={s.revokeBtnText}>Sign out</Text>}
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))}

                {/* Sign out all other devices */}
                {sessions.filter(s => !s.is_current).length > 0 && (
                  <TouchableOpacity
                    style={s.revokeAllBtn}
                    onPress={revokeAllOther}
                    disabled={revokingAll}
                    activeOpacity={0.8}
                  >
                    {revokingAll
                      ? <ActivityIndicator color="#f87171" size="small" />
                      : <>
                          <Ionicons name="log-out-outline" size={16} color="#f87171" />
                          <Text style={s.revokeAllBtnText}>Sign out all other devices</Text>
                        </>}
                  </TouchableOpacity>
                )}
                <View style={{ height: 40 }} />
              </ScrollView>
            )}
          </BlurView>
        </View>
      </Modal>

      {/* Quiet Hours Time Picker Modal */}
      <Modal visible={showQuietPicker} transparent animationType="slide" onRequestClose={() => setShowQuietPicker(false)}>
        <View style={s.blockedOverlay}>
          <BlurView intensity={20} tint="dark" style={s.quietPickerSheet}>
            <LinearGradient colors={['rgba(99,102,241,0.1)', 'rgba(15,23,42,0.98)']} style={StyleSheet.absoluteFill} />
            <View style={s.blockedHandle} />
            <View style={s.quietPickerHeader}>
              <TouchableOpacity onPress={() => setShowQuietPicker(false)}>
                <Text style={s.quietPickerCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={s.quietPickerTitle}>
                {editingQuiet === 'from' ? 'Start Time' : 'End Time'}
              </Text>
              <TouchableOpacity onPress={saveQuietTime}>
                <Text style={s.quietPickerDone}>Done</Text>
              </TouchableOpacity>
            </View>

            {/* Current selection display */}
            <View style={s.quietPickerDisplay}>
              <LinearGradient colors={['rgba(99,102,241,0.2)', 'rgba(99,102,241,0.05)']} style={s.quietPickerDisplayGrad}>
                <Text style={s.quietPickerDisplayTime}>
                  {(() => { const h = pickerH % 12 || 12; const ampm = pickerH < 12 ? 'AM' : 'PM'; return `${h}:${String(pickerM).padStart(2,'0')} ${ampm}`; })()}
                </Text>
                <Text style={s.quietPickerDisplayLabel}>
                  {editingQuiet === 'from' ? 'Notifications silent from this time' : 'Notifications resume at this time'}
                </Text>
              </LinearGradient>
            </View>

            {/* Scroll wheels */}
            <View style={s.quietWheelsRow}>
              {/* Hour wheel */}
              <View style={s.quietWheelWrap}>
                <Text style={s.quietWheelLabel}>Hour</Text>
                <FlatList
                  data={Array.from({ length: 12 }, (_, i) => i + 1)}
                  keyExtractor={i => String(i)}
                  showsVerticalScrollIndicator={false}
                  style={s.quietWheel}
                  contentContainerStyle={{ paddingVertical: 48 }}
                  snapToInterval={48}
                  decelerationRate="fast"
                  initialScrollIndex={Math.max(0, (pickerH % 12 || 12) - 1)}
                  getItemLayout={(_, index) => ({ length: 48, offset: 48 * index, index })}
                  onMomentumScrollEnd={(e) => {
                    const idx = Math.round(e.nativeEvent.contentOffset.y / 48);
                    const h12 = (idx % 12) + 1;
                    const isAM = pickerH < 12;
                    setPickerH(isAM ? (h12 === 12 ? 0 : h12) : (h12 === 12 ? 12 : h12 + 12));
                  }}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[s.quietWheelItem, (pickerH % 12 || 12) === item && s.quietWheelItemActive]}
                      onPress={() => {
                        const isAM = pickerH < 12;
                        setPickerH(isAM ? (item === 12 ? 0 : item) : (item === 12 ? 12 : item + 12));
                      }}
                    >
                      <Text style={[(pickerH % 12 || 12) === item ? s.quietWheelTextActive : s.quietWheelText]}>
                        {String(item).padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  )}
                />
              </View>

              <Text style={s.quietWheelColon}>:</Text>

              {/* Minute wheel */}
              <View style={s.quietWheelWrap}>
                <Text style={s.quietWheelLabel}>Min</Text>
                <FlatList
                  data={[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]}
                  keyExtractor={i => String(i)}
                  showsVerticalScrollIndicator={false}
                  style={s.quietWheel}
                  contentContainerStyle={{ paddingVertical: 48 }}
                  snapToInterval={48}
                  decelerationRate="fast"
                  initialScrollIndex={Math.max(0, [0,5,10,15,20,25,30,35,40,45,50,55].indexOf(Math.round(pickerM / 5) * 5))}
                  getItemLayout={(_, index) => ({ length: 48, offset: 48 * index, index })}
                  onMomentumScrollEnd={(e) => {
                    const idx = Math.round(e.nativeEvent.contentOffset.y / 48);
                    setPickerM([0,5,10,15,20,25,30,35,40,45,50,55][idx % 12]);
                  }}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[s.quietWheelItem, pickerM === item && s.quietWheelItemActive]}
                      onPress={() => setPickerM(item)}
                    >
                      <Text style={[pickerM === item ? s.quietWheelTextActive : s.quietWheelText]}>
                        {String(item).padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  )}
                />
              </View>

              {/* AM/PM wheel */}
              <View style={s.quietWheelWrap}>
                <Text style={s.quietWheelLabel}>AM/PM</Text>
                <View style={s.quietAmPmWrap}>
                  {['AM', 'PM'].map(period => (
                    <TouchableOpacity
                      key={period}
                      style={[s.quietAmPmBtn, ((period === 'AM') === (pickerH < 12)) && s.quietAmPmBtnActive]}
                      onPress={() => {
                        if (period === 'AM' && pickerH >= 12) setPickerH(pickerH - 12);
                        if (period === 'PM' && pickerH < 12) setPickerH(pickerH + 12);
                      }}
                    >
                      <Text style={[s.quietAmPmText, ((period === 'AM') === (pickerH < 12)) && s.quietAmPmTextActive]}>
                        {period}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <View style={{ height: 24 }} />
          </BlurView>
        </View>
      </Modal>

      {/* Activity Status Modal */}
      <Modal visible={showActivityModal} transparent animationType="fade" onRequestClose={() => setShowActivityModal(false)}>
        <View style={s.modalOverlay}>
          <BlurView intensity={20} tint="dark" style={s.confirmModal}>
            <LinearGradient
              colors={pendingActivity ? ['rgba(16,185,129,0.1)', 'rgba(15,23,42,0.98)'] : ['rgba(100,116,139,0.1)', 'rgba(15,23,42,0.98)']}
              style={StyleSheet.absoluteFill}
            />
            <View style={s.confirmIconWrap}>
              <LinearGradient
                colors={pendingActivity ? ['#10b981', '#059669'] : ['#475569', '#334155']}
                style={s.confirmIcon}
              >
                <Ionicons name={pendingActivity ? 'eye' : 'eye-off'} size={26} color="#fff" />
              </LinearGradient>
            </View>
            <Text style={s.confirmTitle}>
              {pendingActivity ? 'Show Activity Status?' : 'Hide Activity Status?'}
            </Text>
            <View style={s.privacyInfoBox}>
              {pendingActivity ? (
                <>
                  <View style={s.privacyInfoRow}>
                    <Ionicons name="checkmark-circle" size={16} color="#34d399" />
                    <Text style={s.privacyInfoText}>People you chat with can see when you were last active</Text>
                  </View>
                  <View style={s.privacyInfoRow}>
                    <Ionicons name="checkmark-circle" size={16} color="#34d399" />
                    <Text style={s.privacyInfoText}>Shows "Active now" or "Active X mins ago" in messages</Text>
                  </View>
                  <View style={s.privacyInfoRow}>
                    <Ionicons name="information-circle" size={16} color="#94a3b8" />
                    <Text style={s.privacyInfoText}>You will also be able to see others' activity status</Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={s.privacyInfoRow}>
                    <Ionicons name="checkmark-circle" size={16} color="#a78bfa" />
                    <Text style={s.privacyInfoText}>No one can see when you were last active</Text>
                  </View>
                  <View style={s.privacyInfoRow}>
                    <Ionicons name="checkmark-circle" size={16} color="#a78bfa" />
                    <Text style={s.privacyInfoText}>"Active" indicator will be hidden in messages</Text>
                  </View>
                  <View style={s.privacyInfoRow}>
                    <Ionicons name="information-circle" size={16} color="#94a3b8" />
                    <Text style={s.privacyInfoText}>You will also not be able to see others' activity status</Text>
                  </View>
                </>
              )}
            </View>
            <View style={[s.confirmBtns, { marginTop: 8 }]}>
              <TouchableOpacity style={s.confirmCancelBtn} onPress={() => setShowActivityModal(false)} activeOpacity={0.8}>
                <Text style={s.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.confirmRemoveBtn} onPress={confirmActivityChange} disabled={savingActivity} activeOpacity={0.8}>
                <LinearGradient
                  colors={pendingActivity ? ['#10b981', '#059669'] : ['#475569', '#334155']}
                  style={s.confirmRemoveBtnGrad}
                >
                  {savingActivity
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={s.confirmRemoveText}>{pendingActivity ? 'Show Status' : 'Hide Status'}</Text>}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>
      </Modal>

      {/* Allow DMs Modal */}
      <Modal visible={showDMsModal} transparent animationType="fade" onRequestClose={() => setShowDMsModal(false)}>
        <View style={s.modalOverlay}>
          <BlurView intensity={20} tint="dark" style={s.confirmModal}>
            <LinearGradient
              colors={pendingDMs ? ['rgba(59,130,246,0.1)', 'rgba(15,23,42,0.98)'] : ['rgba(100,116,139,0.1)', 'rgba(15,23,42,0.98)']}
              style={StyleSheet.absoluteFill}
            />
            <View style={s.confirmIconWrap}>
              <LinearGradient
                colors={pendingDMs ? ['#3b82f6', '#2563eb'] : ['#475569', '#334155']}
                style={s.confirmIcon}
              >
                <Ionicons name={pendingDMs ? 'chatbubble' : 'chatbubble-outline'} size={26} color="#fff" />
              </LinearGradient>
            </View>
            <Text style={s.confirmTitle}>
              {pendingDMs ? 'Allow Direct Messages?' : 'Restrict Direct Messages?'}
            </Text>
            <View style={s.privacyInfoBox}>
              {pendingDMs ? (
                <>
                  <View style={s.privacyInfoRow}>
                    <Ionicons name="checkmark-circle" size={16} color="#60a5fa" />
                    <Text style={s.privacyInfoText}>Anyone on KinsCribe can send you a message</Text>
                  </View>
                  <View style={s.privacyInfoRow}>
                    <Ionicons name="checkmark-circle" size={16} color="#60a5fa" />
                    <Text style={s.privacyInfoText}>Messages from strangers go to your inbox directly</Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={s.privacyInfoRow}>
                    <Ionicons name="checkmark-circle" size={16} color="#a78bfa" />
                    <Text style={s.privacyInfoText}>Only people you follow can send you messages</Text>
                  </View>
                  <View style={s.privacyInfoRow}>
                    <Ionicons name="checkmark-circle" size={16} color="#a78bfa" />
                    <Text style={s.privacyInfoText}>Others will see a "Can't send message" notice</Text>
                  </View>
                  <View style={s.privacyInfoRow}>
                    <Ionicons name="information-circle" size={16} color="#94a3b8" />
                    <Text style={s.privacyInfoText}>Existing conversations are not affected</Text>
                  </View>
                </>
              )}
            </View>
            <View style={[s.confirmBtns, { marginTop: 8 }]}>
              <TouchableOpacity style={s.confirmCancelBtn} onPress={() => setShowDMsModal(false)} activeOpacity={0.8}>
                <Text style={s.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.confirmRemoveBtn} onPress={confirmDMsChange} disabled={savingDMs} activeOpacity={0.8}>
                <LinearGradient
                  colors={pendingDMs ? ['#3b82f6', '#2563eb'] : ['#475569', '#334155']}
                  style={s.confirmRemoveBtnGrad}
                >
                  {savingDMs
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={s.confirmRemoveText}>{pendingDMs ? 'Allow DMs' : 'Restrict DMs'}</Text>}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>
      </Modal>

      {/* Blocked Accounts Modal */}
      <Modal visible={showBlockedModal} transparent animationType="slide" onRequestClose={() => setShowBlockedModal(false)}>
        <View style={s.blockedOverlay}>
          <BlurView intensity={20} tint="dark" style={s.blockedSheet}>
            <LinearGradient colors={['rgba(248,113,113,0.06)', 'rgba(15,23,42,0.98)']} style={StyleSheet.absoluteFill} />
            <View style={s.blockedHandle} />
            <View style={s.blockedHeader}>
              <View style={s.blockedHeaderLeft}>
                <View style={[s.rowIcon, { backgroundColor: 'rgba(248,113,113,0.15)' }]}>
                  <Ionicons name="ban" size={18} color="#f87171" />
                </View>
                <View>
                  <Text style={s.blockedTitle}>Blocked Accounts</Text>
                  <Text style={s.blockedSubtitle}>{blockedUsers.length} {blockedUsers.length === 1 ? 'account' : 'accounts'} blocked</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setShowBlockedModal(false)} style={s.blockedCloseBtn}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>

            {loadingBlocked ? (
              <View style={s.blockedLoading}>
                <ActivityIndicator color="#f87171" size="large" />
                <Text style={s.blockedLoadingText}>Loading blocked accounts...</Text>
              </View>
            ) : blockedUsers.length === 0 ? (
              <View style={s.blockedEmpty}>
                <LinearGradient colors={['rgba(248,113,113,0.12)', 'rgba(248,113,113,0.04)']} style={s.blockedEmptyIcon}>
                  <Ionicons name="shield-checkmark-outline" size={40} color="#f87171" />
                </LinearGradient>
                <Text style={s.blockedEmptyTitle}>No blocked accounts</Text>
                <Text style={s.blockedEmptyText}>People you block won't be able to see your posts or contact you.</Text>
              </View>
            ) : (
              <ScrollView style={s.blockedList} showsVerticalScrollIndicator={false}>
                {blockedUsers.map((b) => (
                  <View key={b.id} style={s.blockedRow}>
                    <View style={s.blockedAvatar}>
                      {b.blocked_avatar
                        ? <Image source={{ uri: b.blocked_avatar }} style={{ width: '100%', height: '100%' }} />
                        : <Text style={s.blockedAvatarLetter}>{b.blocked_name?.[0]?.toUpperCase() || '?'}</Text>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.blockedName}>{b.blocked_name}</Text>
                      {b.blocked_username && (
                        <Text style={s.blockedUsername}>@{b.blocked_username}</Text>
                      )}
                    </View>
                    <TouchableOpacity
                      style={s.unblockBtn}
                      onPress={() => handleUnblock(b.blocked_id, b.blocked_name)}
                      disabled={unblocking === b.blocked_id}
                      activeOpacity={0.8}
                    >
                      {unblocking === b.blocked_id
                        ? <ActivityIndicator size="small" color="#f87171" />
                        : <Text style={s.unblockBtnText}>Unblock</Text>}
                    </TouchableOpacity>
                  </View>
                ))}
                <View style={{ height: 40 }} />
              </ScrollView>
            )}
          </BlurView>
        </View>
      </Modal>

      {/* Privacy Change Confirmation Modal */}
      <Modal visible={showPrivacyModal} transparent animationType="fade" onRequestClose={() => setShowPrivacyModal(false)}>
        <View style={s.modalOverlay}>
          <BlurView intensity={20} tint="dark" style={s.confirmModal}>
            <LinearGradient
              colors={pendingPrivate ? ['rgba(124,58,237,0.1)', 'rgba(15,23,42,0.98)'] : ['rgba(16,185,129,0.1)', 'rgba(15,23,42,0.98)']}
              style={StyleSheet.absoluteFill}
            />
            <View style={s.confirmIconWrap}>
              <LinearGradient
                colors={pendingPrivate ? ['#7c3aed', '#3b82f6'] : ['#10b981', '#059669']}
                style={s.confirmIcon}
              >
                <Ionicons name={pendingPrivate ? 'lock-closed' : 'globe-outline'} size={26} color="#fff" />
              </LinearGradient>
            </View>

            <Text style={s.confirmTitle}>
              {pendingPrivate ? 'Switch to Private?' : 'Switch to Public?'}
            </Text>

            {pendingPrivate ? (
              <View style={s.privacyInfoBox}>
                <View style={s.privacyInfoRow}>
                  <Ionicons name="checkmark-circle" size={16} color="#a78bfa" />
                  <Text style={s.privacyInfoText}>Only approved followers can see your posts and stories</Text>
                </View>
                <View style={s.privacyInfoRow}>
                  <Ionicons name="checkmark-circle" size={16} color="#a78bfa" />
                  <Text style={s.privacyInfoText}>New followers must send a request — you approve or decline</Text>
                </View>
                <View style={s.privacyInfoRow}>
                  <Ionicons name="checkmark-circle" size={16} color="#a78bfa" />
                  <Text style={s.privacyInfoText}>Your profile won't appear in public search results</Text>
                </View>
                <View style={s.privacyInfoRow}>
                  <Ionicons name="checkmark-circle" size={16} color="#a78bfa" />
                  <Text style={s.privacyInfoText}>Existing followers keep access</Text>
                </View>
              </View>
            ) : (
              <View style={s.privacyInfoBox}>
                <View style={s.privacyInfoRow}>
                  <Ionicons name="checkmark-circle" size={16} color="#34d399" />
                  <Text style={s.privacyInfoText}>Anyone can see your posts and stories</Text>
                </View>
                <View style={s.privacyInfoRow}>
                  <Ionicons name="checkmark-circle" size={16} color="#34d399" />
                  <Text style={s.privacyInfoText}>Anyone can follow you without approval</Text>
                </View>
                <View style={s.privacyInfoRow}>
                  <Ionicons name="checkmark-circle" size={16} color="#34d399" />
                  <Text style={s.privacyInfoText}>Your profile appears in search and explore</Text>
                </View>
                <View style={s.privacyInfoRow}>
                  <Ionicons name="checkmark-circle" size={16} color="#34d399" />
                  <Text style={s.privacyInfoText}>Pending follow requests will be auto-approved</Text>
                </View>
              </View>
            )}

            <View style={[s.confirmBtns, { marginTop: 8 }]}>
              <TouchableOpacity
                style={s.confirmCancelBtn}
                onPress={() => setShowPrivacyModal(false)}
                activeOpacity={0.8}
              >
                <Text style={s.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.confirmRemoveBtn}
                onPress={confirmPrivacyChange}
                disabled={savingPrivacy}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={pendingPrivate ? ['#7c3aed', '#3b82f6'] : ['#10b981', '#059669']}
                  style={s.confirmRemoveBtnGrad}
                >
                  {savingPrivacy
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={s.confirmRemoveText}>
                        {pendingPrivate ? 'Set Private' : 'Set Public'}
                      </Text>}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>
      </Modal>

    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 52, paddingHorizontal: 16, paddingBottom: 14, gap: 12, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 22, fontWeight: '800', color: colors.text },
  saveBtn: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  scroll: { paddingBottom: 40 },
  profileCard: { alignItems: 'center', paddingVertical: 24, gap: 12 },
  avatarWrap: { position: 'relative' },
  avatarRing: { width: 90, height: 90, borderRadius: 45, padding: 3, alignItems: 'center', justifyContent: 'center' },
  avatarInner: { width: 82, height: 82, borderRadius: 41, overflow: 'hidden', backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.bg },
  avatarImg: { width: '100%', height: '100%' },
  avatarLetter: { color: '#fff', fontWeight: '800', fontSize: 32 },
  cameraBtn: { position: 'absolute', bottom: 2, right: 2, width: 24, height: 24, borderRadius: 12, backgroundColor: '#7c3aed', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.bg },
  editProfileBtn: { color: colors.primary, fontWeight: '700', fontSize: 14, borderWidth: 1, borderColor: 'rgba(124,58,237,0.4)', paddingHorizontal: 20, paddingVertical: 8, borderRadius: radius.full },
  section: { marginBottom: 6 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: colors.muted, paddingHorizontal: 20, paddingVertical: 8, letterSpacing: 1, textTransform: 'uppercase' },
  card: { marginHorizontal: 16, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border2 },
  cardInner: { backgroundColor: 'rgba(15,23,42,0.6)' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 15, gap: 12 },
  rowIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, fontSize: 14, color: colors.text, fontWeight: '500' },
  rowValue: { fontSize: 13, color: colors.muted },
  rowSubLabel: { fontSize: 11, color: colors.muted, marginTop: 2, lineHeight: 15 },
  divider: { height: 0.5, backgroundColor: colors.border, marginLeft: 61 },
  editField: { padding: 14 },
  editLabel: { fontSize: 11, color: colors.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  editInput: { color: colors.text, fontSize: 15, borderBottomWidth: 1, borderBottomColor: colors.border2, paddingBottom: 6 },
  quietRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 15, paddingBottom: 14, paddingTop: 4 },
  quietText: { fontSize: 12, color: colors.muted },
  quietTime: { color: colors.primary, fontWeight: '700' },
  quietEdit: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  quietTimeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(99,102,241,0.15)', borderWidth: 1, borderColor: 'rgba(99,102,241,0.35)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full },
  quietTimeBtnText: { color: '#818cf8', fontWeight: '700', fontSize: 13 },
  // Quiet hours time picker modal
  quietPickerSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', paddingBottom: 32 },
  quietPickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  quietPickerTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  quietPickerCancel: { fontSize: 15, color: colors.muted, fontWeight: '500' },
  quietPickerDone: { fontSize: 15, color: '#818cf8', fontWeight: '700' },
  quietPickerDisplay: { marginHorizontal: 20, marginBottom: 20, borderRadius: 16, overflow: 'hidden' },
  quietPickerDisplayGrad: { paddingVertical: 16, paddingHorizontal: 20, alignItems: 'center', gap: 4 },
  quietPickerDisplayTime: { fontSize: 36, fontWeight: '800', color: '#818cf8', letterSpacing: 2 },
  quietPickerDisplayLabel: { fontSize: 12, color: colors.muted, textAlign: 'center' },
  quietWheelsRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', paddingHorizontal: 20, gap: 8 },
  quietWheelWrap: { alignItems: 'center', flex: 1 },
  quietWheelLabel: { fontSize: 11, color: colors.dim, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  quietWheel: { height: 144, width: '100%' },
  quietWheelItem: { height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  quietWheelItemActive: { backgroundColor: 'rgba(99,102,241,0.2)', borderWidth: 1, borderColor: 'rgba(99,102,241,0.4)' },
  quietWheelText: { fontSize: 22, color: colors.dim, fontWeight: '500' },
  quietWheelTextActive: { fontSize: 24, color: '#818cf8', fontWeight: '800' },
  quietWheelColon: { fontSize: 28, color: colors.muted, fontWeight: '700', marginTop: 44, alignSelf: 'center' },
  quietAmPmWrap: { gap: 8, marginTop: 0 },
  quietAmPmBtn: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border2, alignItems: 'center' },
  quietAmPmBtnActive: { backgroundColor: 'rgba(99,102,241,0.2)', borderColor: 'rgba(99,102,241,0.5)' },
  quietAmPmText: { fontSize: 14, color: colors.muted, fontWeight: '600' },
  quietAmPmTextActive: { color: '#818cf8', fontWeight: '800' },
  sessionRow: { flexDirection: 'row', alignItems: 'center', padding: 15, gap: 12 },
  revokeBtn: { color: '#f87171', fontSize: 12, fontWeight: '700' },
  // Sessions modal
  sessionsSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', maxHeight: '85%', minHeight: 300 },
  sessionsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: 'rgba(6,182,212,0.15)' },
  sessionsHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sessionsTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  sessionsSubtitle: { fontSize: 12, color: colors.muted, marginTop: 1 },
  sessionCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 14, paddingHorizontal: 20 },
  sessionIconWrap: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(6,182,212,0.12)', borderWidth: 1, borderColor: 'rgba(6,182,212,0.25)', alignItems: 'center', justifyContent: 'center' },
  sessionIconWrapCurrent: { backgroundColor: 'rgba(16,185,129,0.12)', borderColor: 'rgba(16,185,129,0.3)' },
  sessionDevice: { fontSize: 14, fontWeight: '700', color: colors.text },
  currentBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(16,185,129,0.15)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)' },
  currentDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' },
  currentBadgeText: { fontSize: 10, color: '#34d399', fontWeight: '700' },
  sessionMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 5 },
  sessionMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  sessionMetaText: { fontSize: 11, color: colors.dim },
  revokeBtn2: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full, borderWidth: 1.5, borderColor: 'rgba(248,113,113,0.5)', alignSelf: 'flex-start', marginTop: 2 },
  revokeBtnText: { color: '#f87171', fontWeight: '700', fontSize: 12 },
  revokeAllBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 20, marginTop: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(248,113,113,0.3)', backgroundColor: 'rgba(248,113,113,0.06)' },
  revokeAllBtnText: { color: '#f87171', fontWeight: '700', fontSize: 14 },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 32 },
  confirmModal: { width: '100%', borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(248,113,113,0.2)', paddingBottom: 24 },
  confirmIconWrap: { alignItems: 'center', marginTop: 28, marginBottom: 16 },
  confirmIcon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  confirmTitle: { fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: 10 },
  confirmSub: { fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 20, paddingHorizontal: 24, marginBottom: 28 },
  confirmBtns: { flexDirection: 'row', gap: 12, paddingHorizontal: 20 },
  confirmCancelBtn: { flex: 1, paddingVertical: 13, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border2, alignItems: 'center', backgroundColor: 'rgba(30,41,59,0.8)' },
  confirmCancelText: { color: colors.text, fontWeight: '600', fontSize: 15 },
  confirmRemoveBtn: { flex: 1, borderRadius: radius.md, overflow: 'hidden' },
  confirmRemoveBtnGrad: { paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  confirmRemoveText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  privacyInfoBox: { marginHorizontal: 20, marginBottom: 20, gap: 10 },
  privacyInfoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  privacyInfoText: { flex: 1, fontSize: 13, color: colors.muted, lineHeight: 19 },
  // Blocked accounts modal
  blockedOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  blockedSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', maxHeight: '80%', minHeight: 300 },
  blockedHandle: { width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  blockedHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: 'rgba(248,113,113,0.15)' },
  blockedHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  blockedTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  blockedSubtitle: { fontSize: 12, color: colors.muted, marginTop: 1 },
  blockedCloseBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  blockedLoading: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  blockedLoadingText: { color: colors.muted, fontSize: 14 },
  blockedEmpty: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 32, gap: 14 },
  blockedEmptyIcon: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  blockedEmptyTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  blockedEmptyText: { fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 19 },
  blockedList: { paddingHorizontal: 20, paddingTop: 8 },
  blockedRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.05)' },
  blockedAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.primary, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  blockedAvatarLetter: { color: '#fff', fontWeight: '700', fontSize: 18 },
  blockedName: { fontSize: 15, fontWeight: '700', color: colors.text },
  blockedUsername: { fontSize: 12, color: colors.muted, marginTop: 1 },
  unblockBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.full, borderWidth: 1.5, borderColor: '#f87171', minWidth: 80, alignItems: 'center' },
  unblockBtnText: { color: '#f87171', fontWeight: '700', fontSize: 13 },
});
