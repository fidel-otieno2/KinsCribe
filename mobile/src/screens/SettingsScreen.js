import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, Alert, TextInput, Image, ActivityIndicator,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../api/axios';
import { colors, radius } from '../theme';
import Toast from '../components/Toast';
import useToast from '../hooks/useToast';
import { PhoneModal, TwoFactorModal } from '../components/SecurityModals';

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
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [show2FAModal, setShow2FAModal] = useState(false);

  // Notification toggles
  const [notifLikes, setNotifLikes] = useState(true);
  const [notifComments, setNotifComments] = useState(true);
  const [notifMessages, setNotifMessages] = useState(true);
  const [notifStories, setNotifStories] = useState(true);
  const [notifFollows, setNotifFollows] = useState(true);

  // Quiet hours / DND
  const [quietHours, setQuietHours] = useState(false);
  const [quietFrom] = useState('22:00');
  const [quietTo] = useState('08:00');

  // Active sessions (mock — real impl needs backend)
  const [sessions] = useState([
    { id: 1, device: 'This device', location: 'Current session', current: true, last: 'Now' },
    { id: 2, device: 'Chrome on Windows', location: 'Other session', current: false, last: '2 days ago' },
  ]);
  const [showSessions, setShowSessions] = useState(false);

  // Privacy toggles
  const [privateAccount, setPrivateAccount] = useState(false);
  const [showActivity, setShowActivity] = useState(true);
  const [allowDMs, setAllowDMs] = useState(true);

  useEffect(() => {
    checkBiometricStatus();
  }, []);

  const checkBiometricStatus = async () => {
    try {
      const enabled = await AsyncStorage.getItem('biometric_enabled');
      setBiometricEnabled(enabled === 'true');
    } catch {}
  };

  const toggleBiometric = async () => {
    try {
      const available = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      
      if (!available || !enrolled) {
        Alert.alert(
          'Biometric Not Available',
          'Please set up Face ID or Fingerprint in your device settings first.',
          [{ text: 'OK' }]
        );
        return;
      }

      if (biometricEnabled) {
        // Disable biometric
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
        // Enable biometric
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Authenticate to enable biometric login',
          fallbackLabel: 'Use password',
        });
        
        if (result.success) {
          await AsyncStorage.setItem('biometric_enabled', 'true');
          setBiometricEnabled(true);
          success('Biometric login enabled');
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

  const handleLogout = () => Alert.alert('Log Out', 'Are you sure?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Log Out', style: 'destructive', onPress: logout },
  ]);

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

  const handleRevokeSession = (sessionId) => Alert.alert(
    'Revoke Session',
    'This will sign out that device.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Revoke', style: 'destructive', onPress: () => success('Session revoked') },
    ]
  );

  const handleDeleteAccount = () => Alert.alert(
    'Delete Account',
    'This will permanently delete your account and all your data. This cannot be undone.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await api.delete('/auth/account');
          logout();
        } catch { error('Could not delete account. Contact support.'); }
      }},
    ]
  );

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
            value={user?.phone ? `${user.phone.slice(-4).padStart(user.phone.length, '*')}` : 'Not added'}
            onPress={() => setShowPhoneModal(true)} 
          />
          <Divider />
          <Row icon="key-outline" label="Change Password" onPress={() => Alert.alert('Reset Password', 'A reset link will be sent to your email', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Send', onPress: async () => {
              try { await api.post('/auth/forgot-password', { email: user?.email }); success('Reset link sent — check your email'); } catch { error('Failed to send reset link'); }
            }},
          ])} />
          <Divider />
          <Row icon="shield-checkmark-outline" iconColor="#10b981" label="Two-Factor Authentication" onPress={() => setShow2FAModal(true)} />
          <Divider />
          <Row 
            icon="finger-print" 
            iconColor="#7c3aed" 
            label="Biometric Login" 
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
          <Row icon="lock-closed-outline" label="Private Account" toggle toggled={privateAccount} onPress={() => setPrivateAccount(v => !v)} />
          <Divider />
          <Row icon="eye-outline" label="Show Activity Status" toggle toggled={showActivity} onPress={() => setShowActivity(v => !v)} />
          <Divider />
          <Row icon="chatbubble-outline" label="Allow Direct Messages" toggle toggled={allowDMs} onPress={() => setAllowDMs(v => !v)} />
          <Divider />
          <Row icon="ban-outline" iconColor="#f87171" label="Blocked Accounts" onPress={() => Alert.alert('Blocked', 'No blocked accounts')} />
        </Section>

        {/* Notifications */}
        <Section title="Notifications">
          <Row icon="heart-outline" iconColor="#e11d48" label="Likes" toggle toggled={notifLikes} onPress={() => setNotifLikes(v => !v)} />
          <Divider />
          <Row icon="chatbubble-outline" iconColor="#3b82f6" label="Comments" toggle toggled={notifComments} onPress={() => setNotifComments(v => !v)} />
          <Divider />
          <Row icon="paper-plane-outline" iconColor="#7c3aed" label="Messages" toggle toggled={notifMessages} onPress={() => setNotifMessages(v => !v)} />
          <Divider />
          <Row icon="time-outline" iconColor="#f59e0b" label="Stories" toggle toggled={notifStories} onPress={() => setNotifStories(v => !v)} />
          <Divider />
          <Row icon="person-add-outline" iconColor="#10b981" label="New Connections" toggle toggled={notifFollows} onPress={() => setNotifFollows(v => !v)} />
          <Divider />
          <Row icon="moon-outline" iconColor="#6366f1" label="Quiet Hours (DND)" toggle toggled={quietHours} onPress={() => setQuietHours(v => !v)} />
          {quietHours && (
            <View style={s.quietRow}>
              <Ionicons name="time-outline" size={15} color={colors.muted} />
              <Text style={s.quietText}>Silent from <Text style={s.quietTime}>{quietFrom}</Text> to <Text style={s.quietTime}>{quietTo}</Text></Text>
              <TouchableOpacity onPress={() => Alert.alert('Quiet Hours', 'Custom time picker coming soon')}>
                <Text style={s.quietEdit}>Edit</Text>
              </TouchableOpacity>
            </View>
          )}
        </Section>

        {/* Active Sessions */}
        <Section title="Active Sessions">
          <Row icon="phone-portrait-outline" iconColor="#06b6d4" label="Manage Sessions" onPress={() => setShowSessions(v => !v)} />
          {showSessions && sessions.map((sess, i) => (
            <View key={sess.id}>
              <Divider />
              <View style={s.sessionRow}>
                <View style={[s.rowIcon, { backgroundColor: sess.current ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.15)' }]}>
                  <Ionicons name={sess.current ? 'checkmark-circle' : 'phone-portrait-outline'} size={18} color={sess.current ? '#10b981' : colors.muted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.rowLabel, { fontSize: 13 }]}>{sess.device}</Text>
                  <Text style={[s.rowValue, { fontSize: 11 }]}>{sess.location} · {sess.last}</Text>
                </View>
                {!sess.current && (
                  <TouchableOpacity onPress={() => handleRevokeSession(sess.id)}>
                    <Text style={s.revokeBtn}>Revoke</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
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
      />
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
  divider: { height: 0.5, backgroundColor: colors.border, marginLeft: 61 },
  editField: { padding: 14 },
  editLabel: { fontSize: 11, color: colors.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  editInput: { color: colors.text, fontSize: 15, borderBottomWidth: 1, borderBottomColor: colors.border2, paddingBottom: 6 },
  quietRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 15, paddingBottom: 12, paddingTop: 4 },
  quietText: { flex: 1, fontSize: 12, color: colors.muted },
  quietTime: { color: colors.primary, fontWeight: '700' },
  quietEdit: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  sessionRow: { flexDirection: 'row', alignItems: 'center', padding: 15, gap: 12 },
  revokeBtn: { color: '#f87171', fontSize: 12, fontWeight: '700' },
});
