import { useState, useEffect, useRef } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity,
  Switch, Alert, TextInput, Image, ActivityIndicator,
  Modal, FlatList, Linking,
} from 'react-native';
import AppText from '../components/AppText';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Notifications from 'expo-notifications';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { useTheme, FONT_SIZES, FONT_TYPES, LANGUAGES } from '../context/ThemeContext';
import api from '../api/axios';
import { colors, radius } from '../theme';
import Toast from '../components/Toast';
import useToast from '../hooks/useToast';
import { PhoneModal, TwoFactorModal, ChangePasswordModal } from '../components/SecurityModals';
import { useTranslation } from '../i18n';

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
      <AppText style={[s.rowLabel, danger && { color: '#f87171' }]}>{label}</AppText>
      {toggle ? (
        <Switch value={toggled} onValueChange={onPress} trackColor={{ true: '#7c3aed', false: colors.border2 }} thumbColor="#fff" />
      ) : value ? (
        <AppText style={s.rowValue}>{value}</AppText>
      ) : chevron ? (
        <Ionicons name="chevron-forward" size={16} color={colors.dim} />
      ) : null}
    </TouchableOpacity>
  );
}

function Section({ title, children }) {
  return (
    <View style={s.section}>
      <AppText style={s.sectionTitle}>{title}</AppText>
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
  const { theme, mode, setThemeMode, isDark, fontSize, fontSizeObj, saveFontSize, fontType, fontTypeObj, saveFontType, language, languageObj, saveLanguage, dataSaver, saveDataSaver, autoplayVideo, saveAutoplayVideo } = useTheme();
  const { t } = useTranslation();
  const [showFontSizeModal, setShowFontSizeModal]   = useState(false);
  const [showFontTypeModal, setShowFontTypeModal]   = useState(false);
  const [showLanguageModal, setShowLanguageModal]   = useState(false);
  const [langSearch, setLangSearch]                 = useState('');
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

  // Data & Storage
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadStep, setDownloadStep] = useState('idle');
  const [downloadError, setDownloadError] = useState('');

  // Subscription
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [premiumStatus, setPremiumStatus] = useState(null); // null = not loaded
  const [selectedPlan, setSelectedPlan] = useState('yearly');
  const [upgradingPlan, setUpgradingPlan] = useState(false);
  const [cancellingPlan, setCancellingPlan] = useState(false);
  const [premiumStep, setPremiumStep] = useState('plans'); // plans | confirm | success | cancel_confirm

  // About
  const [showPolicyModal, setShowPolicyModal]   = useState(false);
  const [showTermsModal, setShowTermsModal]     = useState(false);
  const [showHelpModal, setShowHelpModal]       = useState(false);
  const [openFaq, setOpenFaq]                   = useState(null);
  const appVersion = '1.0.0';

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
    loadPremiumStatus();
  }, []);

  const loadPremiumStatus = async () => {
    try {
      const { data } = await api.get('/subscription/status');
      setPremiumStatus(data);
    } catch {
      setPremiumStatus({ is_premium: user?.is_premium || false, plan: user?.premium_plan || null });
    }
  };

  const handleUpgrade = async () => {
    setUpgradingPlan(true);
    try {
      const { data } = await api.post('/subscription/upgrade', { plan: selectedPlan });
      setPremiumStatus(prev => ({ ...prev, is_premium: true, plan: selectedPlan, expires_at: data.expires_at }));
      await refreshUser();
      setPremiumStep('success');
    } catch (e) {
      error(e.response?.data?.error || 'Upgrade failed. Try again.');
    } finally {
      setUpgradingPlan(false);
    }
  };

  const handleCancelPremium = async () => {
    setCancellingPlan(true);
    try {
      await api.post('/subscription/cancel');
      setPremiumStatus(prev => ({ ...prev, is_premium: false, plan: null, expires_at: null }));
      await refreshUser();
      setPremiumStep('plans');
      setShowPremiumModal(false);
      success('Premium subscription cancelled');
    } catch (e) {
      error(e.response?.data?.error || 'Cancellation failed. Try again.');
    } finally {
      setCancellingPlan(false);
    }
  };

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
        <AppText style={s.headerTitle}>{t('settings')}</AppText>
        {editMode && (
          <TouchableOpacity onPress={saveProfile} disabled={saving}>
            {saving ? <ActivityIndicator color={colors.primary} size="small" /> : <AppText style={s.saveBtn}>{t('save')}</AppText>}
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
                  <AppText style={s.avatarLetter}>{user?.name?.[0]?.toUpperCase()}</AppText>}
              </View>
            </LinearGradient>
            <View style={s.cameraBtn}>
              <Ionicons name="camera" size={11} color="#fff" />
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setEditMode(!editMode)}>
            <AppText style={s.editProfileBtn}>{editMode ? 'Cancel' : 'Edit Profile'}</AppText>
          </TouchableOpacity>
        </View>

        {/* Edit fields */}
        {editMode && (
          <Section title="Edit Profile">
            <View style={s.editField}>
              <AppText style={s.editLabel}>Display Name</AppText>
              <TextInput style={s.editInput} value={name} onChangeText={setName} placeholderTextColor={colors.dim} />
            </View>
            <Divider />
            <View style={s.editField}>
              <AppText style={s.editLabel}>Username</AppText>
              <TextInput style={s.editInput} value={username} onChangeText={v => setUsername(v.toLowerCase().replace(/\s/g, ''))} autoCapitalize="none" placeholderTextColor={colors.dim} />
            </View>
            <Divider />
            <View style={s.editField}>
              <AppText style={s.editLabel}>Bio</AppText>
              <TextInput style={[s.editInput, { minHeight: 60 }]} value={bio} onChangeText={setBio} multiline placeholderTextColor={colors.dim} placeholder="Tell people about yourself..." />
            </View>
          </Section>
        )}

        {/* Account */}
        <Section title={t('account')}>
          <Row icon="mail-outline" label={t('email')} value={user?.email} chevron={false} />
          <Divider />
          <Row 
            icon="phone-portrait-outline" 
            iconColor="#10b981"
            label={t('phone_number')}
            value={user?.phone ? `••••${user.phone.slice(-4)}` : 'Not added'}
            onPress={() => setShowPhoneModal(true)} 
          />
          {user?.phone && (
            <>
              <Divider />
              <Row
                icon="trash-outline"
                iconColor="#f87171"
                label={t('remove_phone')}
                onPress={() => setShowRemovePhoneModal(true)}
              />
            </>
          )}
          <Divider />
          <Row icon="key-outline" label={t('change_password')} onPress={() => setShowChangePasswordModal(true)} />
          <Divider />
          <Row icon="shield-checkmark-outline" iconColor={user?.two_factor_enabled ? '#10b981' : '#94a3b8'} label={t('two_fa')} value={user?.two_factor_enabled ? 'Enabled' : 'Disabled'} onPress={() => setShow2FAModal(true)} />
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
          <Row icon="people-outline" iconColor="#3b82f6" label={t('my_family')} onPress={() => { navigation.goBack(); navigation.navigate('Family'); }} />
          <Divider />
          <Row icon="swap-horizontal-outline" iconColor="#7c3aed" label={t('switch_account')} onPress={() => navigation.navigate('AccountSwitcher')} />
        </Section>

        {/* Privacy */}
        <Section title={t('privacy')}>
          <View style={s.row}>
            <View style={[s.rowIcon, { backgroundColor: 'rgba(124,58,237,0.15)' }]}>
              <Ionicons name="lock-closed-outline" size={18} color="#7c3aed" />
            </View>
            <View style={{ flex: 1 }}>
              <AppText style={s.rowLabel}>{t('private_account')}</AppText>
              <AppText style={s.rowSubLabel}>
                {privateAccount
                  ? t('private_account_on')
                  : t('private_account_off')}
              </AppText>
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
              <AppText style={s.rowLabel}>{t('show_activity')}</AppText>
              <AppText style={s.rowSubLabel}>
                {showActivity
                  ? t('show_activity_on')
                  : t('show_activity_off')}
              </AppText>
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
              <AppText style={s.rowLabel}>{t('allow_dms')}</AppText>
              <AppText style={s.rowSubLabel}>
                {allowDMs
                  ? t('allow_dms_on')
                  : 'Only people you follow can message you'}
              </AppText>
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
              <AppText style={[s.rowLabel, { color: '#f87171' }]}>{t('blocked_accounts')}</AppText>
              <AppText style={s.rowSubLabel}>{t('blocked_accounts_sub')}</AppText>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.dim} />
          </TouchableOpacity>
        </Section>

        {/* Notifications */}
        <Section title={t('notifications')}>
          {[
            { key: 'likes',    setter: setNotifLikes,    val: notifLikes,    icon: 'heart-outline',       color: '#e11d48', labelKey: 'notif_likes',    subKey: 'notif_likes_sub' },
            { key: 'comments', setter: setNotifComments, val: notifComments, icon: 'chatbubble-outline',  color: '#3b82f6', labelKey: 'notif_comments', subKey: 'notif_comments_sub' },
            { key: 'messages', setter: setNotifMessages, val: notifMessages, icon: 'chatbubbles-outline', color: '#7c3aed', labelKey: 'notif_messages', subKey: 'notif_messages_sub' },
            { key: 'stories',  setter: setNotifStories,  val: notifStories,  icon: 'time-outline',        color: '#f59e0b', labelKey: 'notif_stories',  subKey: 'notif_stories_sub' },
            { key: 'follows',  setter: setNotifFollows,  val: notifFollows,  icon: 'person-add-outline',  color: '#10b981', labelKey: 'notif_follows',  subKey: 'notif_follows_sub' },
          ].map(({ key, setter, val, icon, color, labelKey, subKey }, i, arr) => (
            <View key={key}>
              <View style={s.row}>
                <View style={[s.rowIcon, { backgroundColor: `${color}22` }]}>
                  {savingNotif === key
                    ? <ActivityIndicator size="small" color={color} />
                    : <Ionicons name={icon} size={18} color={color} />}
                </View>
                <View style={{ flex: 1 }}>
                  <AppText style={s.rowLabel}>{t(labelKey)}</AppText>
                  <AppText style={s.rowSubLabel}>{t(subKey)}</AppText>
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
              <AppText style={s.rowLabel}>{t('quiet_hours')}</AppText>
              <AppText style={s.rowSubLabel}>
                {quietHours ? t('quiet_hours_active', { from: fmtTime(quietFrom), to: fmtTime(quietTo) }) : t('quiet_hours_sub')}
              </AppText>
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
              <AppText style={s.quietText}>From</AppText>
              <TouchableOpacity style={s.quietTimeBtn} onPress={() => openQuietPicker('from')}>
                <AppText style={s.quietTimeBtnText}>{fmtTime(quietFrom)}</AppText>
                <Ionicons name="chevron-down" size={12} color="#6366f1" />
              </TouchableOpacity>
              <AppText style={s.quietText}>to</AppText>
              <TouchableOpacity style={s.quietTimeBtn} onPress={() => openQuietPicker('to')}>
                <AppText style={s.quietTimeBtnText}>{fmtTime(quietTo)}</AppText>
                <Ionicons name="chevron-down" size={12} color="#6366f1" />
              </TouchableOpacity>
            </View>
          )}
        </Section>

        {/* Active Sessions */}
        <Section title={t('active_sessions')}>
          <TouchableOpacity style={s.row} onPress={openSessions} activeOpacity={0.7}>
            <View style={[s.rowIcon, { backgroundColor: 'rgba(6,182,212,0.15)' }]}>
              <Ionicons name="phone-portrait-outline" size={18} color="#06b6d4" />
            </View>
            <View style={{ flex: 1 }}>
              <AppText style={s.rowLabel}>{t('manage_sessions')}</AppText>
              <AppText style={s.rowSubLabel}>{t('active_sessions_sub')}</AppText>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.dim} />
          </TouchableOpacity>
        </Section>

        {/* Appearance */}
        <Section title={t('appearance')}>
          {/* Theme */}
          <View style={s.row}>
            <View style={[s.rowIcon, { backgroundColor: 'rgba(196,163,90,0.15)' }]}>
              <Ionicons name="color-palette-outline" size={18} color={colors.gold} />
            </View>
            <AppText style={s.rowLabel}>Theme</AppText>
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
                  <Ionicons name={opt.icon} size={16} color={mode === opt.key ? '#F5F0E8' : colors.muted} />
                  <AppText style={[th.themeBtnText, mode === opt.key && th.themeBtnTextActive]}>{opt.label}</AppText>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <Divider />
          {/* Font Size */}
          <Row
            icon="text-outline"
            iconColor="#a78bfa"
            label={t('font_size')}
            value={fontSizeObj.label}
            onPress={() => setShowFontSizeModal(true)}
          />
          <Divider />
          {/* Font Type */}
          <Row
            icon="brush-outline"
            iconColor="#f59e0b"
            label={t('font_style')}
            value={fontTypeObj.label}
            onPress={() => setShowFontTypeModal(true)}
          />
          <Divider />
          {/* Language */}
          <Row
            icon="language-outline"
            iconColor="#06b6d4"
            label={t('language')}
            value={`${languageObj.flag} ${languageObj.native}`}
            onPress={() => { setLangSearch(''); setShowLanguageModal(true); }}
          />
        </Section>

        {/* Data & Storage */}
        <Section title={t('data_storage')}>
          <Row
            icon="cloud-download-outline"
            iconColor="#3b82f6"
            label={t('download_data')}
            onPress={() => { setDownloadStep('idle'); setShowDownloadModal(true); }}
          />
          <Divider />
          <View style={s.row}>
            <View style={[s.rowIcon, { backgroundColor: 'rgba(16,185,129,0.15)' }]}>
              <Ionicons name="cellular-outline" size={18} color="#10b981" />
            </View>
            <View style={{ flex: 1 }}>
              <AppText style={s.rowLabel}>{t('data_saver')}</AppText>
              <AppText style={s.rowSubLabel}>
                {dataSaver ? 'Reduces video quality & disables autoplay on mobile data' : 'Full quality video and images'}
              </AppText>
            </View>
            <Switch
              value={dataSaver}
              onValueChange={async (v) => { await saveDataSaver(v); success(v ? 'Data Saver enabled' : 'Data Saver disabled'); }}
              trackColor={{ true: '#10b981', false: colors.border2 }}
              thumbColor="#fff"
            />
          </View>
          <Divider />
          <View style={s.row}>
            <View style={[s.rowIcon, { backgroundColor: 'rgba(124,58,237,0.15)' }]}>
              <Ionicons name="videocam-outline" size={18} color="#7c3aed" />
            </View>
            <View style={{ flex: 1 }}>
              <AppText style={s.rowLabel}>{t('autoplay_video')}</AppText>
              <AppText style={s.rowSubLabel}>
                {autoplayVideo ? 'Videos play automatically in feed' : 'Tap to play videos'}
              </AppText>
            </View>
            <Switch
              value={autoplayVideo}
              onValueChange={async (v) => { await saveAutoplayVideo(v); success(v ? 'Autoplay enabled' : 'Autoplay disabled'); }}
              trackColor={{ true: '#7c3aed', false: colors.border2 }}
              thumbColor="#fff"
            />
          </View>
        </Section>

        {/* Subscription */}
        <Section title={t('subscription')}>
          <TouchableOpacity
            style={s.row}
            onPress={() => { setPremiumStep('plans'); setShowPremiumModal(true); }}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={premiumStatus?.is_premium ? ['#7c3aed', '#3b82f6'] : ['rgba(245,158,11,0.15)', 'rgba(245,158,11,0.15)']}
              style={[s.rowIcon, { borderRadius: 10 }]}
            >
              <Ionicons
                name={premiumStatus?.is_premium ? 'diamond' : 'diamond-outline'}
                size={18}
                color={premiumStatus?.is_premium ? '#fff' : '#f59e0b'}
              />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <AppText style={s.rowLabel}>
                {premiumStatus?.is_premium ? 'KinsCribe Premium' : 'Upgrade to Premium'}
              </AppText>
              <AppText style={s.rowSubLabel}>
                {premiumStatus?.is_premium
                  ? `${premiumStatus.plan === 'yearly' ? 'Yearly' : 'Monthly'} plan · Active`
                  : 'Unlock all features — from $4.99/mo'}
              </AppText>
            </View>
            {premiumStatus?.is_premium
              ? <View style={s.premiumBadge}><AppText style={s.premiumBadgeText}>ACTIVE</AppText></View>
              : <Ionicons name="chevron-forward" size={16} color="#7c3aed" />}
          </TouchableOpacity>
        </Section>

        {/* About */}
        <Section title={t('about')}>
          <View style={s.row}>
            <View style={[s.rowIcon, { backgroundColor: 'rgba(148,163,184,0.12)' }]}>
              <Ionicons name="phone-portrait-outline" size={18} color="#94a3b8" />
            </View>
            <View style={{ flex: 1 }}>
              <AppText style={s.rowLabel}>{t('app_version')}</AppText>
              <AppText style={s.rowSubLabel}>KinsCribe v{appVersion}</AppText>
            </View>
            <View style={s.versionBadge}>
              <AppText style={s.versionBadgeText}>v{appVersion}</AppText>
            </View>
          </View>
          <Divider />
          <Row
            icon="document-text-outline"
            iconColor="#06b6d4"
            label={t('privacy_policy')}
            onPress={() => setShowPolicyModal(true)}
          />
          <Divider />
          <Row
            icon="reader-outline"
            iconColor="#a78bfa"
            label={t('terms_of_service')}
            onPress={() => setShowTermsModal(true)}
          />
          <Divider />
          <Row
            icon="help-circle-outline"
            iconColor="#10b981"
            label={t('help_support')}
            onPress={() => { setOpenFaq(null); setShowHelpModal(true); }}
          />
          <Divider />
          <Row
            icon="star-outline"
            iconColor="#f59e0b"
            label={t('rate_app')}
            onPress={() => {
              Linking.openURL(
                'https://play.google.com/store/apps/details?id=com.kinscribe.app'
              ).catch(() =>
                Alert.alert('Rate KinsCribe', 'Search for KinsCribe on the App Store or Google Play to leave a review. Thank you! ⭐')
              );
            }}
          />
          <Divider />
          <Row
            icon="mail-outline"
            iconColor="#3b82f6"
            label="Contact Us"
            onPress={() => Linking.openURL('mailto:kinscribe3@gmail.com?subject=KinsCribe Support').catch(() => Alert.alert('Contact', 'Email us at kinscribe3@gmail.com'))}
          />
        </Section>

        {/* Danger zone */}
        <Section title={t('account_actions')}>
          <Row icon="pause-circle-outline" iconColor="#f59e0b" label={t('deactivate')} onPress={handleDeactivate} />
          <Divider />
          <Row icon="log-out-outline" iconColor="#f87171" label={t('log_out')} onPress={handleLogout} danger />
          <Divider />
          <Row icon="trash-outline" iconColor="#f87171" label={t('delete_account')} onPress={handleDeleteAccount} danger />
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
            <AppText style={s.confirmTitle}>Remove Phone Number</AppText>
            <AppText style={s.confirmSub}>
              Are you sure you want to remove{`\n`}
              <AppText style={{ color: colors.text, fontWeight: '700' }}>{user?.phone}</AppText>
              {`\n`}from your account?
            </AppText>
            <View style={s.confirmBtns}>
              <TouchableOpacity
                style={s.confirmCancelBtn}
                onPress={() => setShowRemovePhoneModal(false)}
                activeOpacity={0.8}
              >
                <AppText style={s.confirmCancelText}>{t('cancel')}</AppText>
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
                    : <AppText style={s.confirmRemoveText}>Remove</AppText>}
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
            <AppText style={s.confirmTitle}>{t('log_out')}</AppText>
            <AppText style={s.confirmSub}>Are you sure you want to log out of your account?</AppText>
            <View style={s.confirmBtns}>
              <TouchableOpacity style={s.confirmCancelBtn} onPress={() => setShowLogoutModal(false)} activeOpacity={0.8}>
                <AppText style={s.confirmCancelText}>{t('cancel')}</AppText>
              </TouchableOpacity>
              <TouchableOpacity style={s.confirmRemoveBtn} onPress={logout} activeOpacity={0.8}>
                <LinearGradient colors={['#f87171', '#ef4444']} style={s.confirmRemoveBtnGrad}>
                  <AppText style={s.confirmRemoveText}>{t('log_out')}</AppText>
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
            <AppText style={s.confirmTitle}>{t('log_out')}</AppText>
            <AppText style={s.confirmSub}>Are you sure you want to log out of your account?</AppText>
            <View style={s.confirmBtns}>
              <TouchableOpacity style={s.confirmCancelBtn} onPress={() => setShowLogoutModal(false)} activeOpacity={0.8}>
                <AppText style={s.confirmCancelText}>{t('cancel')}</AppText>
              </TouchableOpacity>
              <TouchableOpacity style={s.confirmRemoveBtn} onPress={logout} activeOpacity={0.8}>
                <LinearGradient colors={['#f87171', '#ef4444']} style={s.confirmRemoveBtnGrad}>
                  <AppText style={s.confirmRemoveText}>{t('log_out')}</AppText>
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
            <AppText style={s.confirmTitle}>Delete Account</AppText>
            <AppText style={s.confirmSub}>
              This will permanently delete your account and all your data.{`\n\n`}
              <AppText style={{ color: '#f87171', fontWeight: '700' }}>This cannot be undone.</AppText>
            </AppText>
            <View style={s.confirmBtns}>
              <TouchableOpacity style={s.confirmCancelBtn} onPress={() => setShowDeleteModal(false)} activeOpacity={0.8}>
                <AppText style={s.confirmCancelText}>{t('cancel')}</AppText>
              </TouchableOpacity>
              <TouchableOpacity style={s.confirmRemoveBtn} onPress={confirmDeleteAccount} disabled={deletingAccount} activeOpacity={0.8}>
                <LinearGradient colors={['#f87171', '#ef4444']} style={s.confirmRemoveBtnGrad}>
                  {deletingAccount
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <AppText style={s.confirmRemoveText}>{t('delete')}</AppText>}
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
                  <AppText style={s.sessionsTitle}>Active Sessions</AppText>
                  <AppText style={s.sessionsSubtitle}>{sessions.length} device{sessions.length !== 1 ? 's' : ''} logged in</AppText>
                </View>
              </View>
              <TouchableOpacity onPress={() => setShowSessionsModal(false)} style={s.blockedCloseBtn}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>

            {loadingSessions ? (
              <View style={s.blockedLoading}>
                <ActivityIndicator color="#06b6d4" size="large" />
                <AppText style={s.blockedLoadingText}>Loading sessions...</AppText>
              </View>
            ) : sessions.length === 0 ? (
              <View style={s.blockedEmpty}>
                <LinearGradient colors={['rgba(6,182,212,0.12)', 'rgba(6,182,212,0.04)']} style={s.blockedEmptyIcon}>
                  <Ionicons name="phone-portrait-outline" size={40} color="#06b6d4" />
                </LinearGradient>
                <AppText style={s.blockedEmptyTitle}>No sessions found</AppText>
                <AppText style={s.blockedEmptyText}>Your active login sessions will appear here.</AppText>
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
                          <AppText style={s.sessionDevice}>{sess.device_name}</AppText>
                          {sess.is_current && (
                            <View style={s.currentBadge}>
                              <View style={s.currentDot} />
                              <AppText style={s.currentBadgeText}>This device</AppText>
                            </View>
                          )}
                        </View>
                        <View style={s.sessionMeta}>
                          {sess.ip_address && (
                            <View style={s.sessionMetaItem}>
                              <Ionicons name="location-outline" size={11} color={colors.dim} />
                              <AppText style={s.sessionMetaText}>{sess.ip_address}</AppText>
                            </View>
                          )}
                          <View style={s.sessionMetaItem}>
                            <Ionicons name="time-outline" size={11} color={colors.dim} />
                            <AppText style={s.sessionMetaText}>{_sessionTimeAgo(sess.last_active)}</AppText>
                          </View>
                          <View style={s.sessionMetaItem}>
                            <Ionicons name="calendar-outline" size={11} color={colors.dim} />
                            <AppText style={s.sessionMetaText}>Signed in {_sessionTimeAgo(sess.created_at)}</AppText>
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
                            : <AppText style={s.revokeBtnText}>Sign out</AppText>}
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
                          <AppText style={s.revokeAllBtnText}>Sign out all other devices</AppText>
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
                <AppText style={s.quietPickerCancel}>{t('cancel')}</AppText>
              </TouchableOpacity>
              <AppText style={s.quietPickerTitle}>
                {editingQuiet === 'from' ? 'Start Time' : 'End Time'}
              </AppText>
              <TouchableOpacity onPress={saveQuietTime}>
                <AppText style={s.quietPickerDone}>{t('done')}</AppText>
              </TouchableOpacity>
            </View>

            {/* Current selection display */}
            <View style={s.quietPickerDisplay}>
              <LinearGradient colors={['rgba(99,102,241,0.2)', 'rgba(99,102,241,0.05)']} style={s.quietPickerDisplayGrad}>
                <AppText style={s.quietPickerDisplayTime}>
                  {(() => { const h = pickerH % 12 || 12; const ampm = pickerH < 12 ? 'AM' : 'PM'; return `${h}:${String(pickerM).padStart(2,'0')} ${ampm}`; })()}
                </AppText>
                <AppText style={s.quietPickerDisplayLabel}>
                  {editingQuiet === 'from' ? 'Notifications silent from this time' : 'Notifications resume at this time'}
                </AppText>
              </LinearGradient>
            </View>

            {/* Scroll wheels */}
            <View style={s.quietWheelsRow}>
              {/* Hour wheel */}
              <View style={s.quietWheelWrap}>
                <AppText style={s.quietWheelLabel}>Hour</AppText>
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
                      <AppText style={[(pickerH % 12 || 12) === item ? s.quietWheelTextActive : s.quietWheelText]}>
                        {String(item).padStart(2, '0')}
                      </AppText>
                    </TouchableOpacity>
                  )}
                />
              </View>

              <AppText style={s.quietWheelColon}>:</AppText>

              {/* Minute wheel */}
              <View style={s.quietWheelWrap}>
                <AppText style={s.quietWheelLabel}>Min</AppText>
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
                      <AppText style={[pickerM === item ? s.quietWheelTextActive : s.quietWheelText]}>
                        {String(item).padStart(2, '0')}
                      </AppText>
                    </TouchableOpacity>
                  )}
                />
              </View>

              {/* AM/PM wheel */}
              <View style={s.quietWheelWrap}>
                <AppText style={s.quietWheelLabel}>AM/PM</AppText>
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
                      <AppText style={[s.quietAmPmText, ((period === 'AM') === (pickerH < 12)) && s.quietAmPmTextActive]}>
                        {period}
                      </AppText>
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
            <AppText style={s.confirmTitle}>
              {pendingActivity ? t('show_activity') + '?' : t('show_activity') + '?'}
            </AppText>
            <View style={s.privacyInfoBox}>
              {pendingActivity ? (
                <>
                  <View style={s.privacyInfoRow}>
                    <Ionicons name="checkmark-circle" size={16} color="#34d399" />
                    <AppText style={s.privacyInfoText}>People you chat with can see when you were last active</AppText>
                  </View>
                  <View style={s.privacyInfoRow}>
                    <Ionicons name="checkmark-circle" size={16} color="#34d399" />
                    <AppText style={s.privacyInfoText}>Shows "Active now" or "Active X mins ago" in messages</AppText>
                  </View>
                  <View style={s.privacyInfoRow}>
                    <Ionicons name="information-circle" size={16} color="#94a3b8" />
                    <AppText style={s.privacyInfoText}>You will also be able to see others' activity status</AppText>
                  </View>
                </>
              ) : (
                <>
                  <View style={s.privacyInfoRow}>
                    <Ionicons name="checkmark-circle" size={16} color="#a78bfa" />
                    <AppText style={s.privacyInfoText}>No one can see when you were last active</AppText>
                  </View>
                  <View style={s.privacyInfoRow}>
                    <Ionicons name="checkmark-circle" size={16} color="#a78bfa" />
                    <AppText style={s.privacyInfoText}>"Active" indicator will be hidden in messages</AppText>
                  </View>
                  <View style={s.privacyInfoRow}>
                    <Ionicons name="information-circle" size={16} color="#94a3b8" />
                    <AppText style={s.privacyInfoText}>You will also not be able to see others' activity status</AppText>
                  </View>
                </>
              )}
            </View>
            <View style={[s.confirmBtns, { marginTop: 8 }]}>
              <TouchableOpacity style={s.confirmCancelBtn} onPress={() => setShowActivityModal(false)} activeOpacity={0.8}>
                <AppText style={s.confirmCancelText}>{t('cancel')}</AppText>
              </TouchableOpacity>
              <TouchableOpacity style={s.confirmRemoveBtn} onPress={confirmActivityChange} disabled={savingActivity} activeOpacity={0.8}>
                <LinearGradient
                  colors={pendingActivity ? ['#10b981', '#059669'] : ['#475569', '#334155']}
                  style={s.confirmRemoveBtnGrad}
                >
                  {savingActivity
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <AppText style={s.confirmRemoveText}>{pendingActivity ? 'Show Status' : 'Hide Status'}</AppText>}
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
            <AppText style={s.confirmTitle}>
              {pendingDMs ? t('allow_dms') + '?' : t('allow_dms') + '?'}
            </AppText>
            <View style={s.privacyInfoBox}>
              {pendingDMs ? (
                <>
                  <View style={s.privacyInfoRow}>
                    <Ionicons name="checkmark-circle" size={16} color="#60a5fa" />
                    <AppText style={s.privacyInfoText}>Anyone on KinsCribe can send you a message</AppText>
                  </View>
                  <View style={s.privacyInfoRow}>
                    <Ionicons name="checkmark-circle" size={16} color="#60a5fa" />
                    <AppText style={s.privacyInfoText}>Messages from strangers go to your inbox directly</AppText>
                  </View>
                </>
              ) : (
                <>
                  <View style={s.privacyInfoRow}>
                    <Ionicons name="checkmark-circle" size={16} color="#a78bfa" />
                    <AppText style={s.privacyInfoText}>Only people you follow can send you messages</AppText>
                  </View>
                  <View style={s.privacyInfoRow}>
                    <Ionicons name="checkmark-circle" size={16} color="#a78bfa" />
                    <AppText style={s.privacyInfoText}>Others will see a "Can't send message" notice</AppText>
                  </View>
                  <View style={s.privacyInfoRow}>
                    <Ionicons name="information-circle" size={16} color="#94a3b8" />
                    <AppText style={s.privacyInfoText}>Existing conversations are not affected</AppText>
                  </View>
                </>
              )}
            </View>
            <View style={[s.confirmBtns, { marginTop: 8 }]}>
              <TouchableOpacity style={s.confirmCancelBtn} onPress={() => setShowDMsModal(false)} activeOpacity={0.8}>
                <AppText style={s.confirmCancelText}>{t('cancel')}</AppText>
              </TouchableOpacity>
              <TouchableOpacity style={s.confirmRemoveBtn} onPress={confirmDMsChange} disabled={savingDMs} activeOpacity={0.8}>
                <LinearGradient
                  colors={pendingDMs ? ['#3b82f6', '#2563eb'] : ['#475569', '#334155']}
                  style={s.confirmRemoveBtnGrad}
                >
                  {savingDMs
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <AppText style={s.confirmRemoveText}>{pendingDMs ? 'Allow DMs' : 'Restrict DMs'}</AppText>}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>
      </Modal>

      {/* ── Font Size Modal ─────────────────────────────── */}
      <Modal visible={showFontSizeModal} transparent animationType="slide" onRequestClose={() => setShowFontSizeModal(false)}>
        <View style={s.blockedOverlay}>
          <BlurView intensity={20} tint="dark" style={s.appearSheet}>
            <LinearGradient colors={['rgba(167,139,250,0.1)', 'rgba(15,23,42,0.98)']} style={StyleSheet.absoluteFill} />
            <View style={s.blockedHandle} />
            <View style={s.appearHeader}>
              <AppText style={s.appearTitle}>Font Size</AppText>
              <TouchableOpacity onPress={() => setShowFontSizeModal(false)} style={s.blockedCloseBtn}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
              {FONT_SIZES.map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  style={[s.appearOption, fontSize === opt.key && s.appearOptionActive]}
                  onPress={() => { saveFontSize(opt.key); setShowFontSizeModal(false); success(`Font size set to ${opt.label}`); }}
                  activeOpacity={0.8}
                >
                  <View style={{ flex: 1 }}>
                    <AppText style={[s.appearOptionLabel, fontSize === opt.key && s.appearOptionLabelActive, { fontSize: Math.round(14 * opt.scale) }]}>
                      {opt.label}
                    </AppText>
                    <AppText style={[s.appearOptionSub, { fontSize: Math.round(11 * opt.scale) }]}>The quick brown fox jumps over the lazy dog</AppText>
                  </View>
                  {fontSize === opt.key && <Ionicons name="checkmark-circle" size={22} color="#a78bfa" />}
                </TouchableOpacity>
              ))}
              <View style={{ height: 32 }} />
            </ScrollView>
          </BlurView>
        </View>
      </Modal>

      {/* ── Font Type Modal ─────────────────────────────── */}
      <Modal visible={showFontTypeModal} transparent animationType="slide" onRequestClose={() => setShowFontTypeModal(false)}>
        <View style={s.blockedOverlay}>
          <BlurView intensity={20} tint="dark" style={s.appearSheet}>
            <LinearGradient colors={['rgba(245,158,11,0.1)', 'rgba(15,23,42,0.98)']} style={StyleSheet.absoluteFill} />
            <View style={s.blockedHandle} />
            <View style={s.appearHeader}>
              <AppText style={s.appearTitle}>Font Style</AppText>
              <TouchableOpacity onPress={() => setShowFontTypeModal(false)} style={s.blockedCloseBtn}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
              {FONT_TYPES.map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  style={[s.appearOption, fontType === opt.key && s.appearOptionActiveGold]}
                  onPress={() => { saveFontType(opt.key); setShowFontTypeModal(false); success(`Font style set to ${opt.label}`); }}
                  activeOpacity={0.8}
                >
                  <View style={{ flex: 1 }}>
                    <AppText style={[s.appearOptionLabel, fontType === opt.key && s.appearOptionLabelActiveGold, opt.style]}>
                      {opt.label}
                    </AppText>
                    <AppText style={[s.appearOptionSub, opt.style]}>KinsCribe — your family story</AppText>
                  </View>
                  {fontType === opt.key && <Ionicons name="checkmark-circle" size={22} color="#f59e0b" />}
                </TouchableOpacity>
              ))}
              <View style={{ height: 32 }} />
            </ScrollView>
          </BlurView>
        </View>
      </Modal>

      {/* ── Language Modal ──────────────────────────────── */}
      <Modal visible={showLanguageModal} transparent animationType="slide" onRequestClose={() => setShowLanguageModal(false)}>
        <View style={s.blockedOverlay}>
          <BlurView intensity={20} tint="dark" style={[s.appearSheet, { maxHeight: '90%' }]}>
            <LinearGradient colors={['rgba(6,182,212,0.1)', 'rgba(15,23,42,0.98)']} style={StyleSheet.absoluteFill} />
            <View style={s.blockedHandle} />
            <View style={s.appearHeader}>
              <AppText style={s.appearTitle}>Language</AppText>
              <TouchableOpacity onPress={() => setShowLanguageModal(false)} style={s.blockedCloseBtn}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>
            {/* Search */}
            <View style={s.langSearchWrap}>
              <Ionicons name="search-outline" size={16} color={colors.muted} />
              <TextInput
                style={s.langSearchInput}
                placeholder="Search language..."
                placeholderTextColor={colors.dim}
                value={langSearch}
                onChangeText={setLangSearch}
                autoCorrect={false}
              />
              {langSearch.length > 0 && (
                <TouchableOpacity onPress={() => setLangSearch('')}>
                  <Ionicons name="close-circle" size={16} color={colors.muted} />
                </TouchableOpacity>
              )}
            </View>
            <FlatList
              data={LANGUAGES.filter(l =>
                langSearch.length === 0 ||
                l.label.toLowerCase().includes(langSearch.toLowerCase()) ||
                l.native.toLowerCase().includes(langSearch.toLowerCase()) ||
                l.code.toLowerCase().includes(langSearch.toLowerCase())
              )}
              keyExtractor={item => item.code}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[s.langOption, language === item.code && s.langOptionActive]}
                  onPress={() => { saveLanguage(item.code); setShowLanguageModal(false); success(`Language set to ${item.label}`); }}
                  activeOpacity={0.8}
                >
                  <AppText style={s.langFlag}>{item.flag}</AppText>
                  <View style={{ flex: 1 }}>
                    <AppText style={[s.langLabel, language === item.code && s.langLabelActive]}>{item.label}</AppText>
                    <AppText style={s.langNative}>{item.native}</AppText>
                  </View>
                  {language === item.code && <Ionicons name="checkmark-circle" size={20} color="#06b6d4" />}
                </TouchableOpacity>
              )}
            />
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
                  <AppText style={s.blockedTitle}>{t('blocked_accounts')}</AppText>
                  <AppText style={s.blockedSubtitle}>{blockedUsers.length} {blockedUsers.length === 1 ? 'account' : 'accounts'} blocked</AppText>
                </View>
              </View>
              <TouchableOpacity onPress={() => setShowBlockedModal(false)} style={s.blockedCloseBtn}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>

            {loadingBlocked ? (
              <View style={s.blockedLoading}>
                <ActivityIndicator color="#f87171" size="large" />
                <AppText style={s.blockedLoadingText}>Loading blocked accounts...</AppText>
              </View>
            ) : blockedUsers.length === 0 ? (
              <View style={s.blockedEmpty}>
                <LinearGradient colors={['rgba(248,113,113,0.12)', 'rgba(248,113,113,0.04)']} style={s.blockedEmptyIcon}>
                  <Ionicons name="shield-checkmark-outline" size={40} color="#f87171" />
                </LinearGradient>
                <AppText style={s.blockedEmptyTitle}>No blocked accounts</AppText>
                <AppText style={s.blockedEmptyText}>People you block won't be able to see your posts or contact you.</AppText>
              </View>
            ) : (
              <ScrollView style={s.blockedList} showsVerticalScrollIndicator={false}>
                {blockedUsers.map((b) => (
                  <View key={b.id} style={s.blockedRow}>
                    <View style={s.blockedAvatar}>
                      {b.blocked_avatar
                        ? <Image source={{ uri: b.blocked_avatar }} style={{ width: '100%', height: '100%' }} />
                        : <AppText style={s.blockedAvatarLetter}>{b.blocked_name?.[0]?.toUpperCase() || '?'}</AppText>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <AppText style={s.blockedName}>{b.blocked_name}</AppText>
                      {b.blocked_username && (
                        <AppText style={s.blockedUsername}>@{b.blocked_username}</AppText>
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
                        : <AppText style={s.unblockBtnText}>{t('unblock')}</AppText>}
                    </TouchableOpacity>
                  </View>
                ))}
                <View style={{ height: 40 }} />
              </ScrollView>
            )}
          </BlurView>
        </View>
      </Modal>

      {/* ── Privacy Policy Modal ─────────────────────── */}
      <Modal visible={showPolicyModal} transparent animationType="slide" onRequestClose={() => setShowPolicyModal(false)}>
        <View style={s.blockedOverlay}>
          <BlurView intensity={20} tint="dark" style={[s.appearSheet, { maxHeight: '92%' }]}>
            <LinearGradient colors={['rgba(6,182,212,0.1)', 'rgba(15,23,42,0.98)']} style={StyleSheet.absoluteFill} />
            <View style={s.blockedHandle} />
            <View style={s.appearHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <View style={[s.rowIcon, { backgroundColor: 'rgba(6,182,212,0.15)' }]}>
                  <Ionicons name="document-text-outline" size={18} color="#06b6d4" />
                </View>
                <AppText style={s.appearTitle}>Privacy Policy</AppText>
              </View>
              <TouchableOpacity onPress={() => setShowPolicyModal(false)} style={s.blockedCloseBtn}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
              <AppText style={s.legalDate}>Last updated: January 1, 2025</AppText>
              {[
                { title: '1. Information We Collect', body: 'We collect information you provide directly to us, such as your name, email address, phone number, profile photo, and any content you create or share on KinsCribe. We also collect usage data, device information, and log data automatically when you use our services.' },
                { title: '2. How We Use Your Information', body: 'We use your information to provide, maintain, and improve our services; send you notifications and updates; personalise your experience; respond to your comments and questions; and comply with legal obligations. We do not sell your personal data to third parties.' },
                { title: '3. Information Sharing', body: 'We do not share your personal information with third parties except as necessary to provide our services (e.g. cloud storage providers), when required by law, or with your explicit consent. Family Space content is only visible to members of your family group.' },
                { title: '4. Data Storage & Security', body: 'Your data is stored securely on encrypted servers. We use industry-standard security measures including HTTPS, JWT authentication, and bcrypt password hashing. However, no method of transmission over the internet is 100% secure.' },
                { title: '5. Your Rights', body: 'You have the right to access, correct, or delete your personal data at any time. You can download your data from Settings → Data & Storage → Download My Data, or delete your account from Settings → Account Actions → Delete Account.' },
                { title: '6. Cookies & Tracking', body: 'We use minimal tracking technologies to keep you signed in and improve app performance. We do not use third-party advertising trackers. You can opt out of analytics in your device settings.' },
                { title: '7. Children\'s Privacy', body: 'KinsCribe is not directed to children under 13. We do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal information, please contact us immediately.' },
                { title: '8. Changes to This Policy', body: 'We may update this Privacy Policy from time to time. We will notify you of any significant changes by email or through the app. Your continued use of KinsCribe after changes constitutes acceptance of the updated policy.' },
                { title: '9. Contact Us', body: 'If you have any questions about this Privacy Policy, please contact us at kinscribe3@gmail.com.' },
              ].map(({ title, body }) => (
                <View key={title} style={s.legalSection}>
                  <AppText style={s.legalSectionTitle}>{title}</AppText>
                  <AppText style={s.legalSectionBody}>{body}</AppText>
                </View>
              ))}
              <TouchableOpacity
                style={s.legalContactBtn}
                onPress={() => Linking.openURL('mailto:kinscribe3@gmail.com?subject=Privacy Policy Enquiry').catch(() => {})}
                activeOpacity={0.8}
              >
                <Ionicons name="mail-outline" size={16} color="#06b6d4" />
                <AppText style={s.legalContactText}>kinscribe3@gmail.com</AppText>
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </BlurView>
        </View>
      </Modal>

      {/* ── Terms of Service Modal ───────────────────────── */}
      <Modal visible={showTermsModal} transparent animationType="slide" onRequestClose={() => setShowTermsModal(false)}>
        <View style={s.blockedOverlay}>
          <BlurView intensity={20} tint="dark" style={[s.appearSheet, { maxHeight: '92%' }]}>
            <LinearGradient colors={['rgba(167,139,250,0.1)', 'rgba(15,23,42,0.98)']} style={StyleSheet.absoluteFill} />
            <View style={s.blockedHandle} />
            <View style={s.appearHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <View style={[s.rowIcon, { backgroundColor: 'rgba(167,139,250,0.15)' }]}>
                  <Ionicons name="reader-outline" size={18} color="#a78bfa" />
                </View>
                <AppText style={s.appearTitle}>Terms of Service</AppText>
              </View>
              <TouchableOpacity onPress={() => setShowTermsModal(false)} style={s.blockedCloseBtn}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
              <AppText style={s.legalDate}>Last updated: January 1, 2025</AppText>
              {[
                { title: '1. Acceptance of Terms', body: 'By accessing or using KinsCribe, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.' },
                { title: '2. Your Account', body: 'You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must be at least 13 years old to use KinsCribe. You agree to provide accurate and complete information when creating your account.' },
                { title: '3. Acceptable Use', body: 'You agree not to use KinsCribe to post illegal content, harass or bully other users, spread misinformation, infringe on intellectual property rights, attempt to hack or disrupt our services, or impersonate other people or entities.' },
                { title: '4. Content Ownership', body: 'You retain ownership of all content you post on KinsCribe. By posting content, you grant KinsCribe a non-exclusive, royalty-free licence to display and distribute your content within the platform. You are solely responsible for the content you post.' },
                { title: '5. Family Space', body: 'Family Space content is private and only visible to members of your family group. You are responsible for who you invite to your family group. KinsCribe is not responsible for disputes arising within family groups.' },
                { title: '6. Premium Subscription', body: 'Premium subscriptions are billed in advance on a monthly or yearly basis. Cancellations take effect immediately. We do not offer refunds for partial subscription periods. Prices may change with 30 days notice.' },
                { title: '7. Termination', body: 'We reserve the right to suspend or terminate your account if you violate these Terms of Service. You may delete your account at any time from Settings → Account Actions → Delete Account.' },
                { title: '8. Disclaimers', body: 'KinsCribe is provided "as is" without warranties of any kind. We do not guarantee uninterrupted or error-free service. We are not liable for any indirect, incidental, or consequential damages arising from your use of our services.' },
                { title: '9. Governing Law', body: 'These Terms are governed by applicable law. Any disputes shall be resolved through binding arbitration, except where prohibited by law.' },
                { title: '10. Contact', body: 'For questions about these Terms, contact us at kinscribe3@gmail.com.' },
              ].map(({ title, body }) => (
                <View key={title} style={s.legalSection}>
                  <AppText style={s.legalSectionTitle}>{title}</AppText>
                  <AppText style={s.legalSectionBody}>{body}</AppText>
                </View>
              ))}
              <TouchableOpacity
                style={s.legalContactBtn}
                onPress={() => Linking.openURL('mailto:kinscribe3@gmail.com?subject=Terms of Service Enquiry').catch(() => {})}
                activeOpacity={0.8}
              >
                <Ionicons name="mail-outline" size={16} color="#a78bfa" />
                <AppText style={[s.legalContactText, { color: '#a78bfa' }]}>kinscribe3@gmail.com</AppText>
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </BlurView>
        </View>
      </Modal>

      {/* ── Help & Support Modal ─────────────────────────── */}
      <Modal visible={showHelpModal} transparent animationType="slide" onRequestClose={() => setShowHelpModal(false)}>
        <View style={s.blockedOverlay}>
          <BlurView intensity={20} tint="dark" style={[s.appearSheet, { maxHeight: '92%' }]}>
            <LinearGradient colors={['rgba(16,185,129,0.1)', 'rgba(15,23,42,0.98)']} style={StyleSheet.absoluteFill} />
            <View style={s.blockedHandle} />
            <View style={s.appearHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <View style={[s.rowIcon, { backgroundColor: 'rgba(16,185,129,0.15)' }]}>
                  <Ionicons name="help-circle-outline" size={18} color="#10b981" />
                </View>
                <AppText style={s.appearTitle}>Help & Support</AppText>
              </View>
              <TouchableOpacity onPress={() => setShowHelpModal(false)} style={s.blockedCloseBtn}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>

              {/* Contact options */}
              <AppText style={s.helpSectionLabel}>Get in touch</AppText>
              <View style={s.helpContactRow}>
                <TouchableOpacity
                  style={s.helpContactCard}
                  onPress={() => Linking.openURL('mailto:kinscribe3@gmail.com?subject=KinsCribe Support').catch(() => {})}
                  activeOpacity={0.8}
                >
                  <LinearGradient colors={['rgba(59,130,246,0.2)', 'rgba(59,130,246,0.05)']} style={s.helpContactCardGrad}>
                    <Ionicons name="mail-outline" size={26} color="#3b82f6" />
                    <AppText style={s.helpContactCardTitle}>Email</AppText>
                    <AppText style={s.helpContactCardSub}>kinscribe3@gmail.com</AppText>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.helpContactCard}
                  onPress={() => Linking.openURL('mailto:kinscribe3@gmail.com?subject=KinsCribe Help').catch(() => {})}
                  activeOpacity={0.8}
                >
                  <LinearGradient colors={['rgba(16,185,129,0.2)', 'rgba(16,185,129,0.05)']} style={s.helpContactCardGrad}>
                    <Ionicons name="mail-outline" size={26} color="#10b981" />
                    <AppText style={s.helpContactCardTitle}>Help Centre</AppText>
                    <AppText style={s.helpContactCardSub}>kinscribe3@gmail.com</AppText>
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              {/* FAQ */}
              <AppText style={s.helpSectionLabel}>Frequently asked questions</AppText>
              {[
                { q: 'How do I create a Family Space?', a: 'Go to the Family tab at the bottom of the screen and tap "Create Family". You can then invite members by phone number, shareable link, or QR code.' },
                { q: 'How do I reset my password?', a: 'On the login screen, tap "Forgot Password" and enter your email address. You will receive a 6-digit code to reset your password.' },
                { q: 'Can I use KinsCribe on multiple devices?', a: 'Yes! You can sign in on as many devices as you like. Manage your active sessions from Settings → Active Sessions.' },
                { q: 'How do I cancel my Premium subscription?', a: 'Go to Settings → Subscription → tap your plan → Cancel Subscription. Your access will end immediately.' },
                { q: 'Is my Family Space content private?', a: 'Yes. All Family Space content is completely private and only visible to members of your family group. It never appears in public feeds.' },
                { q: 'How do I download my data?', a: 'Go to Settings → Data & Storage → Download My Data. A summary will be emailed to your registered email address.' },
                { q: 'How do I enable two-factor authentication?', a: 'Go to Settings → Account → Two-Factor Authentication and follow the setup steps. You will need an authenticator app like Google Authenticator.' },
                { q: 'Why are my videos not playing?', a: 'Check that Auto-play Videos is enabled in Settings → Data & Storage. If Data Saver mode is on, videos are paused by default — tap to play them.' },
                { q: 'How do I report a user?', a: 'Visit the user\'s profile, tap the three-dot menu in the top right, and select "Report". Our team reviews all reports within 24 hours.' },
                { q: 'How do I delete my account?', a: 'Go to Settings → Account Actions → Delete Account. This is permanent and cannot be undone. All your data will be removed.' },
              ].map(({ q, a }, i) => (
                <TouchableOpacity
                  key={i}
                  style={[s.faqItem, openFaq === i && s.faqItemOpen]}
                  onPress={() => setOpenFaq(openFaq === i ? null : i)}
                  activeOpacity={0.8}
                >
                  <View style={s.faqHeader}>
                    <AppText style={[s.faqQ, openFaq === i && s.faqQOpen]}>{q}</AppText>
                    <Ionicons
                      name={openFaq === i ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={openFaq === i ? '#10b981' : colors.muted}
                    />
                  </View>
                  {openFaq === i && (
                    <AppText style={s.faqA}>{a}</AppText>
                  )}
                </TouchableOpacity>
              ))}
              <View style={{ height: 40 }} />
            </ScrollView>
          </BlurView>
        </View>
      </Modal>

      {/* Premium Subscription Modal */}
      <Modal visible={showPremiumModal} transparent animationType="slide" onRequestClose={() => setShowPremiumModal(false)}>
        <View style={s.blockedOverlay}>
          <BlurView intensity={20} tint="dark" style={[s.appearSheet, { maxHeight: '92%' }]}>
            <LinearGradient colors={['rgba(124,58,237,0.18)', 'rgba(59,130,246,0.10)', 'rgba(15,23,42,0.99)']} style={StyleSheet.absoluteFill} />
            <View style={s.blockedHandle} />

            {/* Header */}
            <View style={s.premiumHeader}>
              <LinearGradient colors={['#7c3aed', '#3b82f6']} style={s.premiumHeaderIcon}>
                <Ionicons name="diamond" size={22} color="#fff" />
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <AppText style={s.premiumHeaderTitle}>KinsCribe Premium</AppText>
                <AppText style={s.premiumHeaderSub}>
                  {premiumStatus?.is_premium
                    ? `${premiumStatus.plan === 'yearly' ? 'Yearly' : 'Monthly'} plan · Active`
                    : 'Unlock everything'}
                </AppText>
              </View>
              <TouchableOpacity onPress={() => setShowPremiumModal(false)} style={s.blockedCloseBtn}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>

              {/* Plans step */}
              {(premiumStep === 'plans' || premiumStep === 'confirm') && !premiumStatus?.is_premium && (
                <>
                  {/* Features list */}
                  <View style={s.premiumFeaturesBox}>
                    {[
                      { icon: 'infinite-outline',        color: '#7c3aed', text: 'Unlimited post & media storage' },
                      { icon: 'sparkles-outline',        color: '#a78bfa', text: 'AI story & caption generation' },
                      { icon: 'bar-chart-outline',       color: '#3b82f6', text: 'Advanced analytics & insights' },
                      { icon: 'headset-outline',         color: '#10b981', text: 'Priority customer support' },
                      { icon: 'shield-checkmark-outline',color: '#f59e0b', text: 'Exclusive verified badge' },
                      { icon: 'eye-off-outline',         color: '#ec4899', text: 'Ad-free experience' },
                      { icon: 'rocket-outline',          color: '#06b6d4', text: 'Early access to new features' },
                    ].map(({ icon, color, text }) => (
                      <View key={text} style={s.premiumFeatureRow}>
                        <View style={[s.premiumFeatureIcon, { backgroundColor: `${color}22` }]}>
                          <Ionicons name={icon} size={16} color={color} />
                        </View>
                        <AppText style={s.premiumFeatureText}>{text}</AppText>
                      </View>
                    ))}
                  </View>

                  {/* Plan selector */}
                  <AppText style={s.premiumSectionLabel}>Choose your plan</AppText>
                  {[
                    { key: 'yearly',  label: 'Yearly',  price: '$39.99', sub: '$3.33 / month · Save 33%', badge: 'BEST VALUE' },
                    { key: 'monthly', label: 'Monthly', price: '$4.99',  sub: 'Billed monthly', badge: null },
                  ].map(plan => (
                    <TouchableOpacity
                      key={plan.key}
                      style={[s.planCard, selectedPlan === plan.key && s.planCardActive]}
                      onPress={() => setSelectedPlan(plan.key)}
                      activeOpacity={0.8}
                    >
                      <View style={[s.planRadio, selectedPlan === plan.key && s.planRadioActive]}>
                        {selectedPlan === plan.key && <View style={s.planRadioDot} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <AppText style={[s.planLabel, selectedPlan === plan.key && s.planLabelActive]}>{plan.label}</AppText>
                          {plan.badge && (
                            <View style={s.planBadge}>
                              <AppText style={s.planBadgeText}>{plan.badge}</AppText>
                            </View>
                          )}
                        </View>
                        <AppText style={s.planSub}>{plan.sub}</AppText>
                      </View>
                      <AppText style={[s.planPrice, selectedPlan === plan.key && s.planPriceActive]}>{plan.price}</AppText>
                    </TouchableOpacity>
                  ))}

                  {/* CTA */}
                  <TouchableOpacity
                    style={s.premiumCTA}
                    onPress={handleUpgrade}
                    disabled={upgradingPlan}
                    activeOpacity={0.85}
                  >
                    <LinearGradient colors={['#7c3aed', '#3b82f6']} style={s.premiumCTAGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                      {upgradingPlan
                        ? <ActivityIndicator color="#fff" />
                        : <>
                            <Ionicons name="diamond" size={18} color="#fff" />
                            <AppText style={s.premiumCTAText}>
                              Get {selectedPlan === 'yearly' ? 'Yearly' : 'Monthly'} Premium
                            </AppText>
                          </>}
                    </LinearGradient>
                  </TouchableOpacity>
                  <AppText style={s.premiumDisclaimer}>Cancel anytime · No hidden fees · Secure payment</AppText>
                </>
              )}

              {/* Already premium — manage plan */}
              {premiumStatus?.is_premium && premiumStep !== 'success' && premiumStep !== 'cancel_confirm' && (
                <>
                  {/* Active plan card */}
                  <LinearGradient colors={['rgba(124,58,237,0.2)', 'rgba(59,130,246,0.12)']} style={s.activePlanCard}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <Ionicons name="diamond" size={28} color="#a78bfa" />
                      <View>
                        <AppText style={s.activePlanTitle}>
                          {premiumStatus.plan === 'yearly' ? 'Yearly' : 'Monthly'} Premium
                        </AppText>
                        {premiumStatus.expires_at && (
                          <AppText style={s.activePlanSub}>
                            Renews {new Date(premiumStatus.expires_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                          </AppText>
                        )}
                      </View>
                    </View>
                  </LinearGradient>

                  {/* Features */}
                  <View style={s.premiumFeaturesBox}>
                    {[
                      { icon: 'infinite-outline',        color: '#7c3aed', text: 'Unlimited post & media storage' },
                      { icon: 'sparkles-outline',        color: '#a78bfa', text: 'AI story & caption generation' },
                      { icon: 'bar-chart-outline',       color: '#3b82f6', text: 'Advanced analytics & insights' },
                      { icon: 'headset-outline',         color: '#10b981', text: 'Priority customer support' },
                      { icon: 'shield-checkmark-outline',color: '#f59e0b', text: 'Exclusive verified badge' },
                      { icon: 'eye-off-outline',         color: '#ec4899', text: 'Ad-free experience' },
                      { icon: 'rocket-outline',          color: '#06b6d4', text: 'Early access to new features' },
                    ].map(({ icon, color, text }) => (
                      <View key={text} style={s.premiumFeatureRow}>
                        <View style={[s.premiumFeatureIcon, { backgroundColor: `${color}22` }]}>
                          <Ionicons name={icon} size={16} color={color} />
                        </View>
                        <AppText style={s.premiumFeatureText}>{text}</AppText>
                        <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                      </View>
                    ))}
                  </View>

                  <TouchableOpacity
                    style={s.cancelPlanBtn}
                    onPress={() => setPremiumStep('cancel_confirm')}
                    activeOpacity={0.8}
                  >
                    <AppText style={s.cancelPlanText}>Cancel Subscription</AppText>
                  </TouchableOpacity>
                </>
              )}

              {/* Cancel confirmation */}
              {premiumStep === 'cancel_confirm' && (
                <View style={{ alignItems: 'center', paddingTop: 12, gap: 16 }}>
                  <LinearGradient colors={['rgba(248,113,113,0.15)', 'rgba(248,113,113,0.05)']} style={s.cancelConfirmIcon}>
                    <Ionicons name="warning-outline" size={40} color="#f87171" />
                  </LinearGradient>
                  <AppText style={[s.premiumHeaderTitle, { textAlign: 'center' }]}>Cancel Premium?</AppText>
                  <AppText style={[s.premiumHeaderSub, { textAlign: 'center', lineHeight: 20 }]}>
                    You'll lose access to all Premium features immediately.
                  </AppText>
                  <View style={{ flexDirection: 'row', gap: 12, width: '100%', marginTop: 8 }}>
                    <TouchableOpacity
                      style={[s.confirmCancelBtn, { flex: 1 }]}
                      onPress={() => setPremiumStep('plans')}
                      activeOpacity={0.8}
                    >
                      <AppText style={s.confirmCancelText}>Keep Premium</AppText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.confirmRemoveBtn, { flex: 1 }]}
                      onPress={handleCancelPremium}
                      disabled={cancellingPlan}
                      activeOpacity={0.8}
                    >
                      <LinearGradient colors={['#f87171', '#ef4444']} style={s.confirmRemoveBtnGrad}>
                        {cancellingPlan
                          ? <ActivityIndicator color="#fff" size="small" />
                          : <AppText style={s.confirmRemoveText}>Yes, Cancel</AppText>}
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Success */}
              {premiumStep === 'success' && (
                <View style={{ alignItems: 'center', paddingTop: 12, gap: 16 }}>
                  <LinearGradient colors={['rgba(124,58,237,0.2)', 'rgba(59,130,246,0.1)']} style={s.cancelConfirmIcon}>
                    <Ionicons name="diamond" size={40} color="#a78bfa" />
                  </LinearGradient>
                  <AppText style={[s.premiumHeaderTitle, { textAlign: 'center', fontSize: 22 }]}>Welcome to Premium! 🎉</AppText>
                  <AppText style={[s.premiumHeaderSub, { textAlign: 'center', lineHeight: 20 }]}>
                    Your {selectedPlan === 'yearly' ? 'Yearly' : 'Monthly'} plan is now active.{`\n`}A confirmation has been sent to your email.
                  </AppText>
                  <TouchableOpacity
                    style={[s.premiumCTA, { width: '100%' }]}
                    onPress={() => { setPremiumStep('plans'); setShowPremiumModal(false); }}
                    activeOpacity={0.85}
                  >
                    <LinearGradient colors={['#7c3aed', '#3b82f6']} style={s.premiumCTAGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                      <AppText style={s.premiumCTAText}>Start Exploring</AppText>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}

            </ScrollView>
          </BlurView>
        </View>
      </Modal>

      {/* Download My Data Modal */}
      <Modal visible={showDownloadModal} transparent animationType="fade" onRequestClose={() => setShowDownloadModal(false)}>
        <View style={s.modalOverlay}>
          <BlurView intensity={20} tint="dark" style={[s.confirmModal, { borderColor: 'rgba(59,130,246,0.25)' }]}>
            <LinearGradient colors={['rgba(59,130,246,0.1)', 'rgba(15,23,42,0.98)']} style={StyleSheet.absoluteFill} />
            <View style={s.confirmIconWrap}>
              <LinearGradient colors={['#3b82f6', '#2563eb']} style={s.confirmIcon}>
                <Ionicons
                  name={downloadStep === 'done' ? 'checkmark-circle' : downloadStep === 'error' ? 'alert-circle' : 'cloud-download-outline'}
                  size={26} color="#fff"
                />
              </LinearGradient>
            </View>

            {downloadStep === 'idle' && (
              <>
                <AppText style={s.confirmTitle}>Download My Data</AppText>
                <View style={[s.privacyInfoBox, { marginBottom: 8 }]}>
                  <View style={s.privacyInfoRow}>
                    <Ionicons name="person-outline" size={15} color="#60a5fa" />
                    <AppText style={s.privacyInfoText}>Profile info, bio, and account details</AppText>
                  </View>
                  <View style={s.privacyInfoRow}>
                    <Ionicons name="images-outline" size={15} color="#60a5fa" />
                    <AppText style={s.privacyInfoText}>Your posts, reels, and media</AppText>
                  </View>
                  <View style={s.privacyInfoRow}>
                    <Ionicons name="chatbubbles-outline" size={15} color="#60a5fa" />
                    <AppText style={s.privacyInfoText}>Messages and comments</AppText>
                  </View>
                  <View style={s.privacyInfoRow}>
                    <Ionicons name="mail-outline" size={15} color="#94a3b8" />
                    <AppText style={s.privacyInfoText}>Export will be emailed to <AppText style={{ color: colors.text, fontWeight: '700' }}>{user?.email}</AppText></AppText>
                  </View>
                </View>
                <View style={s.confirmBtns}>
                  <TouchableOpacity style={s.confirmCancelBtn} onPress={() => setShowDownloadModal(false)} activeOpacity={0.8}>
                    <AppText style={s.confirmCancelText}>{t('cancel')}</AppText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.confirmRemoveBtn}
                    activeOpacity={0.8}
                    onPress={async () => {
                      setDownloadStep('loading');
                      try {
                        await api.post('/auth/export-data');
                        setDownloadStep('done');
                      } catch (e) {
                        setDownloadError(e.response?.data?.error || 'Request failed. Try again.');
                        setDownloadStep('error');
                      }
                    }}
                  >
                    <LinearGradient colors={['#3b82f6', '#2563eb']} style={s.confirmRemoveBtnGrad}>
                      <AppText style={s.confirmRemoveText}>Request Export</AppText>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {downloadStep === 'loading' && (
              <View style={{ alignItems: 'center', paddingVertical: 24, paddingHorizontal: 24, gap: 14 }}>
                <ActivityIndicator color="#3b82f6" size="large" />
                <AppText style={[s.confirmTitle, { fontSize: 16 }]}>Preparing your export...</AppText>
                <AppText style={[s.confirmSub, { marginBottom: 0 }]}>This may take a moment</AppText>
              </View>
            )}

            {downloadStep === 'done' && (
              <>
                <AppText style={s.confirmTitle}>Export Requested!</AppText>
                <AppText style={s.confirmSub}>
                  Your data export has been queued.{`\n`}We'll email it to{`\n`}
                  <AppText style={{ color: '#60a5fa', fontWeight: '700' }}>{user?.email}</AppText>
                  {`\n`}within 24 hours.
                </AppText>
                <View style={[s.confirmBtns, { paddingHorizontal: 20 }]}>
                  <TouchableOpacity
                    style={[s.confirmRemoveBtn, { flex: 1 }]}
                    onPress={() => setShowDownloadModal(false)}
                    activeOpacity={0.8}
                  >
                    <LinearGradient colors={['#3b82f6', '#2563eb']} style={s.confirmRemoveBtnGrad}>
                      <AppText style={s.confirmRemoveText}>Done</AppText>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {downloadStep === 'error' && (
              <>
                <AppText style={s.confirmTitle}>Request Failed</AppText>
                <AppText style={s.confirmSub}>{downloadError}</AppText>
                <View style={s.confirmBtns}>
                  <TouchableOpacity style={s.confirmCancelBtn} onPress={() => setShowDownloadModal(false)} activeOpacity={0.8}>
                    <AppText style={s.confirmCancelText}>Close</AppText>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.confirmRemoveBtn} onPress={() => setDownloadStep('idle')} activeOpacity={0.8}>
                    <LinearGradient colors={['#3b82f6', '#2563eb']} style={s.confirmRemoveBtnGrad}>
                      <AppText style={s.confirmRemoveText}>Try Again</AppText>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </>
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

            <AppText style={s.confirmTitle}>
              {pendingPrivate ? 'Switch to Private?' : 'Switch to Public?'}
            </AppText>

            {pendingPrivate ? (
              <View style={s.privacyInfoBox}>
                <View style={s.privacyInfoRow}>
                  <Ionicons name="checkmark-circle" size={16} color="#a78bfa" />
                  <AppText style={s.privacyInfoText}>Only approved followers can see your posts and stories</AppText>
                </View>
                <View style={s.privacyInfoRow}>
                  <Ionicons name="checkmark-circle" size={16} color="#a78bfa" />
                  <AppText style={s.privacyInfoText}>New followers must send a request — you approve or decline</AppText>
                </View>
                <View style={s.privacyInfoRow}>
                  <Ionicons name="checkmark-circle" size={16} color="#a78bfa" />
                  <AppText style={s.privacyInfoText}>Your profile won't appear in public search results</AppText>
                </View>
                <View style={s.privacyInfoRow}>
                  <Ionicons name="checkmark-circle" size={16} color="#a78bfa" />
                  <AppText style={s.privacyInfoText}>Existing followers keep access</AppText>
                </View>
              </View>
            ) : (
              <View style={s.privacyInfoBox}>
                <View style={s.privacyInfoRow}>
                  <Ionicons name="checkmark-circle" size={16} color="#34d399" />
                  <AppText style={s.privacyInfoText}>Anyone can see your posts and stories</AppText>
                </View>
                <View style={s.privacyInfoRow}>
                  <Ionicons name="checkmark-circle" size={16} color="#34d399" />
                  <AppText style={s.privacyInfoText}>Anyone can follow you without approval</AppText>
                </View>
                <View style={s.privacyInfoRow}>
                  <Ionicons name="checkmark-circle" size={16} color="#34d399" />
                  <AppText style={s.privacyInfoText}>Your profile appears in search and explore</AppText>
                </View>
                <View style={s.privacyInfoRow}>
                  <Ionicons name="checkmark-circle" size={16} color="#34d399" />
                  <AppText style={s.privacyInfoText}>Pending follow requests will be auto-approved</AppText>
                </View>
              </View>
            )}

            <View style={[s.confirmBtns, { marginTop: 8 }]}>
              <TouchableOpacity
                style={s.confirmCancelBtn}
                onPress={() => setShowPrivacyModal(false)}
                activeOpacity={0.8}
              >
                <AppText style={s.confirmCancelText}>{t('cancel')}</AppText>
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
                    : <AppText style={s.confirmRemoveText}>
                        {pendingPrivate ? 'Set Private' : 'Set Public'}
                      </AppText>}
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
  // Appearance modals
  appearSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', maxHeight: '80%', minHeight: 300 },
  appearHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.07)' },
  appearTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  appearOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', backgroundColor: 'rgba(255,255,255,0.03)' },
  appearOptionActive: { borderColor: 'rgba(167,139,250,0.5)', backgroundColor: 'rgba(167,139,250,0.08)' },
  appearOptionActiveGold: { borderColor: 'rgba(245,158,11,0.5)', backgroundColor: 'rgba(245,158,11,0.08)' },
  appearOptionLabel: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 3 },
  appearOptionLabelActive: { color: '#a78bfa' },
  appearOptionLabelActiveGold: { color: '#f59e0b' },
  appearOptionSub: { fontSize: 12, color: colors.muted },
  // Language
  langSearchWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, marginBottom: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  langSearchInput: { flex: 1, color: colors.text, fontSize: 14 },
  langOption: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, marginBottom: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', backgroundColor: 'rgba(255,255,255,0.02)' },
  langOptionActive: { borderColor: 'rgba(6,182,212,0.45)', backgroundColor: 'rgba(6,182,212,0.08)' },
  langFlag: { fontSize: 24 },
  langLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  langLabelActive: { color: '#06b6d4' },
  langNative: { fontSize: 12, color: colors.muted, marginTop: 1 },
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

  // Premium / Subscription
  premiumBadge: { backgroundColor: 'rgba(124,58,237,0.2)', borderWidth: 1, borderColor: 'rgba(124,58,237,0.5)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  premiumBadgeText: { color: '#a78bfa', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  premiumHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: 'rgba(124,58,237,0.2)' },
  premiumHeaderIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  premiumHeaderTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  premiumHeaderSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  premiumFeaturesBox: { gap: 10, marginVertical: 16 },
  premiumFeatureRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  premiumFeatureIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  premiumFeatureText: { flex: 1, fontSize: 14, color: colors.text, fontWeight: '500' },
  premiumSectionLabel: { fontSize: 11, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, marginTop: 4 },
  planCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.03)', marginBottom: 10 },
  planCardActive: { borderColor: 'rgba(124,58,237,0.6)', backgroundColor: 'rgba(124,58,237,0.08)' },
  planRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.border2, alignItems: 'center', justifyContent: 'center' },
  planRadioActive: { borderColor: '#7c3aed' },
  planRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#7c3aed' },
  planLabel: { fontSize: 15, fontWeight: '700', color: colors.text },
  planLabelActive: { color: '#a78bfa' },
  planSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  planPrice: { fontSize: 16, fontWeight: '800', color: colors.muted },
  planPriceActive: { color: '#a78bfa' },
  planBadge: { backgroundColor: 'rgba(124,58,237,0.2)', borderWidth: 1, borderColor: 'rgba(124,58,237,0.4)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20 },
  planBadgeText: { color: '#a78bfa', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  premiumCTA: { borderRadius: 16, overflow: 'hidden', marginTop: 8 },
  premiumCTAGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  premiumCTAText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  premiumDisclaimer: { textAlign: 'center', fontSize: 11, color: colors.dim, marginTop: 12 },
  activePlanCard: { borderRadius: 16, padding: 20, marginVertical: 16, borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)' },
  activePlanTitle: { fontSize: 16, fontWeight: '800', color: '#a78bfa' },
  activePlanSub: { fontSize: 12, color: colors.muted, marginTop: 3 },
  cancelPlanBtn: { marginTop: 16, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(248,113,113,0.4)', alignItems: 'center', backgroundColor: 'rgba(248,113,113,0.06)' },
  cancelPlanText: { color: '#f87171', fontWeight: '700', fontSize: 14 },
  cancelConfirmIcon: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },

  // About — version badge
  versionBadge: { backgroundColor: 'rgba(148,163,184,0.12)', borderWidth: 1, borderColor: 'rgba(148,163,184,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  versionBadgeText: { color: colors.muted, fontSize: 12, fontWeight: '700' },

  // Legal modals (Privacy Policy & Terms)
  legalDate: { fontSize: 11, color: colors.dim, marginTop: 12, marginBottom: 4 },
  legalSection: { marginTop: 20 },
  legalSectionTitle: { fontSize: 14, fontWeight: '800', color: colors.text, marginBottom: 6 },
  legalSectionBody: { fontSize: 13, color: colors.muted, lineHeight: 20 },
  legalContactBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(6,182,212,0.3)', backgroundColor: 'rgba(6,182,212,0.06)', justifyContent: 'center' },
  legalContactText: { color: '#06b6d4', fontWeight: '700', fontSize: 14 },

  // Help & Support modal
  helpSectionLabel: { fontSize: 11, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 1, marginTop: 20, marginBottom: 10 },
  helpContactRow: { flexDirection: 'row', gap: 12 },
  helpContactCard: { flex: 1, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  helpContactCardGrad: { padding: 16, alignItems: 'center', gap: 6 },
  helpContactCardTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  helpContactCardSub: { fontSize: 11, color: colors.muted, textAlign: 'center' },
  faqItem: { borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', backgroundColor: 'rgba(255,255,255,0.02)', marginBottom: 8, padding: 14 },
  faqItemOpen: { borderColor: 'rgba(16,185,129,0.35)', backgroundColor: 'rgba(16,185,129,0.05)' },
  faqHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  faqQ: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text },
  faqQOpen: { color: '#10b981' },
  faqA: { fontSize: 13, color: colors.muted, lineHeight: 20, marginTop: 10 },
});
