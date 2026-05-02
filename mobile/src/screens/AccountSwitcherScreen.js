import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, StyleSheet, TouchableOpacity, ScrollView,
  Image, Alert, ActivityIndicator, Modal, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import AppText from '../components/AppText';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from '../i18n';
import { colors, radius } from '../theme';
import GradientButton from '../components/GradientButton';
import api from '../api/axios';

export default function AccountSwitcherScreen({ navigation }) {
  const { user, savedAccounts, switchAccount, addAccount, removeAccount, registerNewAccount } = useAuth();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [switching, setSwitching] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ email: '', password: '' });
  const [addLoading, setAddLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createStep, setCreateStep] = useState(1); // 1: form, 2: otp
  const [createForm, setCreateForm] = useState({ name: '', username: '', email: '', password: '' });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState(null);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpRefs = useRef([]);
  const cooldownRef = useRef(null);

  const handleSwitch = async (account) => {
    if (account.isCurrent) return;
    
    setSwitching(account.id);
    try {
      await switchAccount(account.id);
      navigation.reset({ index: 0, routes: [{ name: 'Main', params: { screen: 'Profile' } }] });
    } catch (error) {
      Alert.alert('Switch Failed', error.message || 'Could not switch to that account.');
    } finally {
      setSwitching(null);
    }
  };

  const handleAddAccount = async () => {
    if (!addForm.email.trim() || !addForm.password.trim()) {
      Alert.alert('Error', 'Please enter both email and password.');
      return;
    }

    setAddLoading(true);
    try {
      await addAccount(addForm.email.trim(), addForm.password);
      setShowAddModal(false);
      setAddForm({ email: '', password: '' });
      navigation.reset({ index: 0, routes: [{ name: 'Main', params: { screen: 'Profile' } }] });
    } catch (error) {
      const msg = error.response?.data?.error
        || error.response?.data?.message
        || error.message
        || 'Wrong email or password. Please try again.';
      Alert.alert('Login Failed', msg);
    } finally {
      setAddLoading(false);
    }
  };

  const handleRemove = async (accountId) => {
    Alert.alert(
      'Remove Account',
      'Are you sure you want to remove this account? You\'ll need to log in again to add it back.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeAccount(accountId);
            } catch (error) {
              Alert.alert('Error', 'Could not remove account.');
            }
          },
        },
      ]
    );
  };

  const checkUsername = useCallback(
    debounce(async (val) => {
      const clean = val.toLowerCase().replace(/\s/g, '');
      if (clean.length < 3) { setUsernameStatus(null); return; }
      setUsernameStatus('checking');
      try {
        const email = createForm.email.trim().toLowerCase();
        const { data } = await api.get(`/auth/username/check?username=${clean}&email=${encodeURIComponent(email)}`);
        setUsernameStatus(data.available ? 'available' : 'taken');
      } catch { setUsernameStatus(null); }
    }, 600),
    [createForm.email]
  );

  function debounce(fn, delay) {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
  }

  const startCooldown = () => {
    setResendCooldown(60);
    cooldownRef.current = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) { clearInterval(cooldownRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleCreateAccount = async () => {
    setCreateError('');
    if (!createForm.name || !createForm.username || !createForm.email || !createForm.password)
      return setCreateError('All fields are required');
    if (createForm.password.length < 6)
      return setCreateError('Password must be at least 6 characters');
    if (usernameStatus === 'taken')
      return setCreateError('Username is already taken');
    
    setCreateLoading(true);
    try {
      const { data } = await api.post('/auth/register', createForm);
      if (data.requires_otp) {
        // OTP verification required
        setCreateStep(2);
        startCooldown();
      } else {
        // No OTP required - account created and logged in
        await registerNewAccount(data.user, data.access_token, data.refresh_token);
        setShowCreateModal(false);
        resetCreateForm();
        // Navigate to SetupProfile to complete profile
        navigation.navigate('SetupProfile');
      }
    } catch (err) {
      setCreateError(err.response?.data?.error || 'Registration failed');
    } finally { setCreateLoading(false); }
  };

  const handleOtpChange = (val, idx) => {
    if (!/^[0-9]?$/.test(val)) return;
    const next = [...otp];
    next[idx] = val;
    setOtp(next);
    setOtpError('');
    if (val && idx < 5) otpRefs.current[idx + 1]?.focus();
  };

  const handleOtpKeyPress = (e, idx) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    }
  };

  const handleVerifyOtp = async () => {
    const code = otp.join('');
    if (code.length < 6) return setOtpError('Enter the full 6-digit code.');
    setOtpLoading(true);
    setOtpError('');
    try {
      const { data } = await api.post('/auth/verify-otp', { email: createForm.email, otp: code });
      // Register the new account in multi-account system
      await registerNewAccount(data.user, data.access_token, data.refresh_token);
      setShowCreateModal(false);
      resetCreateForm();
      // Navigate to SetupProfile to complete profile
      navigation.navigate('SetupProfile');
    } catch (err) {
      setOtpError(err.response?.data?.error || 'Invalid code. Try again.');
    } finally { setOtpLoading(false); }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    try {
      await api.post('/auth/resend-otp', { email: createForm.email });
      startCooldown();
      setOtpError('');
      setOtp(['', '', '', '', '', '']);
    } catch (err) {
      setOtpError(err.response?.data?.error || 'Failed to resend. Try again.');
    }
  };

  const resetCreateForm = () => {
    setCreateStep(1);
    setCreateForm({ name: '', username: '', email: '', password: '' });
    setCreateError('');
    setShowPass(false);
    setUsernameStatus(null);
    setOtp(['', '', '', '', '', '']);
    setOtpError('');
    setResendCooldown(0);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
  };

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <LinearGradient colors={['#0F172A', '#1E1040', '#0F172A']} style={StyleSheet.absoluteFill} />

      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <AppText style={s.headerTitle}>Switch Account</AppText>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        {savedAccounts.map(account => (
          <TouchableOpacity
            key={account.id}
            style={[s.accountRow, account.isCurrent && s.accountRowActive, { borderColor: theme.border2 }]}
            onPress={() => handleSwitch(account)}
            activeOpacity={account.isCurrent ? 1 : 0.7}
          >
            <View style={s.avatarWrap}>
              {account.isCurrent && (
                <LinearGradient colors={['#7c3aed', '#3b82f6']} style={s.avatarRing}>
                  <View style={s.avatarInner}>
                    {account.avatar
                      ? <Image source={{ uri: account.avatar }} style={s.avatarImg} />
                      : <AppText style={s.avatarLetter}>{account.name?.[0]?.toUpperCase()}</AppText>}
                  </View>
                </LinearGradient>
              )}
              {!account.isCurrent && (
                <View style={[s.avatarInner, { backgroundColor: colors.bgSecondary }]}>
                  {account.avatar
                    ? <Image source={{ uri: account.avatar }} style={s.avatarImg} />
                    : <AppText style={s.avatarLetter}>{account.name?.[0]?.toUpperCase()}</AppText>}
                </View>
              )}
            </View>

            <View style={{ flex: 1 }}>
              <AppText style={[s.accountName, { color: theme.text }]}>{account.name}</AppText>
              <AppText style={[s.accountUsername, { color: theme.muted }]}>@{account.username || account.email}</AppText>
            </View>

            {account.isCurrent ? (
              <View style={s.activeBadge}>
                <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                <AppText style={s.activeText}>Active</AppText>
              </View>
            ) : switching === account.id ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <TouchableOpacity onPress={() => handleRemove(account.id)} style={s.removeBtn}>
                <Ionicons name="close-circle-outline" size={20} color={colors.muted} />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        ))}

        <TouchableOpacity 
          style={[s.addBtn, { borderColor: theme.border2 }]} 
          onPress={() => setShowAddModal(true)}
        >
          <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
          <AppText style={s.addBtnText}>Add Existing Account</AppText>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[s.createBtn, { borderColor: 'rgba(124,58,237,0.4)' }]} 
          onPress={() => setShowCreateModal(true)}
        >
          <LinearGradient colors={['rgba(124,58,237,0.15)', 'rgba(59,130,246,0.1)']} style={StyleSheet.absoluteFill} />
          <Ionicons name="person-add-outline" size={22} color={colors.primary} />
          <AppText style={s.createBtnText}>Create New Account</AppText>
        </TouchableOpacity>
      </ScrollView>

      {/* Create New Account Modal */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowCreateModal(false);
          resetCreateForm();
        }}
      >
        <View style={s.modalOverlay}>
          <TouchableOpacity 
            style={{ flex: 1 }} 
            activeOpacity={1} 
            onPress={() => {
              setShowCreateModal(false);
              resetCreateForm();
            }} 
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <BlurView intensity={20} tint="dark" style={[s.modalContent, { backgroundColor: 'rgba(15,23,42,0.95)' }]}>
              <LinearGradient 
                colors={createStep === 1 ? ['rgba(59,130,246,0.08)', 'rgba(15,23,42,0.7)'] : ['rgba(124,58,237,0.08)', 'rgba(15,23,42,0.7)']} 
                style={StyleSheet.absoluteFill} 
              />
              
              <View style={s.modalHeader}>
                <View style={{ flex: 1 }}>
                  <AppText style={[s.modalTitle, { color: theme.text }]}>
                    {createStep === 1 ? 'Create New Account' : 'Verify Email'}
                  </AppText>
                  <AppText style={[s.modalSubtitle, { color: theme.muted }]}>
                    {createStep === 1 ? 'Join the KinsCribe family' : 'Check your inbox'}
                  </AppText>
                </View>
                <TouchableOpacity 
                  onPress={() => {
                    if (createStep === 2) setCreateStep(1);
                    else { setShowCreateModal(false); resetCreateForm(); }
                  }} 
                  style={s.modalClose}
                >
                  <Ionicons name={createStep === 2 ? 'arrow-back' : 'close'} size={24} color={colors.muted} />
                </TouchableOpacity>
              </View>

              <ScrollView 
                style={s.modalBody} 
                contentContainerStyle={{ paddingBottom: 20 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {createStep === 1 ? (
                  /* Registration Form */
                  <>
                    {createError ? (
                      <View style={s.errorBox}>
                        <Ionicons name="alert-circle" size={16} color="#f87171" />
                        <AppText style={s.errorText}>{createError}</AppText>
                      </View>
                    ) : null}

                    <AppText style={[s.inputLabel, { color: theme.muted }]}>Full Name</AppText>
                    <View style={[s.inputWrap, { backgroundColor: theme.bgCard, borderColor: theme.border2 }]}>
                      <Ionicons name="person-outline" size={18} color={theme.muted} />
                      <TextInput 
                        style={[s.inputField, { color: theme.text }]} 
                        placeholder="e.g. John Smith" 
                        placeholderTextColor={theme.dim} 
                        autoCapitalize="words" 
                        value={createForm.name} 
                        onChangeText={(v) => setCreateForm(prev => ({ ...prev, name: v }))} 
                      />
                    </View>

                    <AppText style={[s.inputLabel, { color: theme.muted }]}>Username</AppText>
                    <View style={[s.inputWrap, { 
                      backgroundColor: theme.bgCard, 
                      borderColor: usernameStatus === 'taken' ? '#f87171' : usernameStatus === 'available' ? '#10b981' : theme.border2 
                    }]}>
                      <AppText style={[s.atSign, { color: theme.muted }]}>@</AppText>
                      <TextInput 
                        style={[s.inputField, { flex: 1, color: theme.text }]} 
                        placeholder="yourname" 
                        placeholderTextColor={theme.dim} 
                        autoCapitalize="none" 
                        value={createForm.username} 
                        onChangeText={(v) => {
                          const clean = v.toLowerCase().replace(/\s/g, '');
                          setCreateForm(prev => ({ ...prev, username: clean }));
                          checkUsername(clean);
                        }} 
                      />
                      {usernameStatus === 'checking' && <ActivityIndicator size="small" color={theme.muted} />}
                      {usernameStatus === 'available' && <Ionicons name="checkmark-circle" size={18} color="#10b981" />}
                      {usernameStatus === 'taken' && <Ionicons name="close-circle" size={18} color="#f87171" />}
                    </View>
                    {usernameStatus === 'taken' && <AppText style={s.usernameErr}>Username is already taken</AppText>}
                    {usernameStatus === 'available' && <AppText style={s.usernameOk}>Username is available</AppText>}

                    <AppText style={[s.inputLabel, { color: theme.muted }]}>Email</AppText>
                    <View style={[s.inputWrap, { backgroundColor: theme.bgCard, borderColor: theme.border2 }]}>
                      <Ionicons name="mail-outline" size={18} color={theme.muted} />
                      <TextInput 
                        style={[s.inputField, { color: theme.text }]} 
                        placeholder="you@example.com" 
                        placeholderTextColor={theme.dim} 
                        keyboardType="email-address" 
                        autoCapitalize="none" 
                        value={createForm.email} 
                        onChangeText={(v) => setCreateForm(prev => ({ ...prev, email: v }))} 
                      />
                    </View>

                    <AppText style={[s.inputLabel, { color: theme.muted }]}>Password</AppText>
                    <View style={[s.inputWrap, { backgroundColor: theme.bgCard, borderColor: theme.border2 }]}>
                      <Ionicons name="lock-closed-outline" size={18} color={theme.muted} />
                      <TextInput 
                        style={[s.inputField, { flex: 1, color: theme.text }]} 
                        placeholder="Min. 6 characters" 
                        placeholderTextColor={theme.dim} 
                        secureTextEntry={!showPass} 
                        value={createForm.password} 
                        onChangeText={(v) => setCreateForm(prev => ({ ...prev, password: v }))} 
                      />
                      <TouchableOpacity onPress={() => setShowPass(!showPass)} style={{ padding: 4 }}>
                        <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={theme.muted} />
                      </TouchableOpacity>
                    </View>

                    {createForm.password.length > 0 && (
                      <View style={s.strengthRow}>
                        {[1, 2, 3, 4].map(i => (
                          <View 
                            key={i} 
                            style={[s.strengthBar, { 
                              backgroundColor: createForm.password.length >= i * 3 
                                ? (createForm.password.length >= 10 ? '#10b981' : createForm.password.length >= 6 ? '#f59e0b' : '#e11d48') 
                                : theme.border 
                            }]} 
                          />
                        ))}
                        <AppText style={[s.strengthText, { color: theme.muted }]}>
                          {createForm.password.length < 6 ? 'Too short' : createForm.password.length < 10 ? 'Good' : 'Strong'}
                        </AppText>
                      </View>
                    )}

                    <GradientButton
                      label="Create Account"
                      onPress={handleCreateAccount}
                      loading={createLoading}
                      style={{ marginTop: 12 }}
                    />

                    <AppText style={s.terms}>
                      By signing up you agree to our <AppText style={s.termsLink}>Terms of Service</AppText> and <AppText style={s.termsLink}>Privacy Policy</AppText>
                    </AppText>
                  </>
                ) : (
                  /* OTP Verification */
                  <>
                    <View style={s.otpIconWrap}>
                      <LinearGradient colors={['#7c3aed', '#3b82f6']} style={s.otpIconGrad}>
                        <Ionicons name="mail-open-outline" size={28} color="#fff" />
                      </LinearGradient>
                    </View>
                    
                    <AppText style={[s.otpTitle, { color: theme.text }]}>Check your email</AppText>
                    <AppText style={[s.otpSub, { color: theme.muted }]}>
                      We sent a 6-digit code to{' '}
                      <AppText style={{ color: theme.text, fontWeight: '700' }}>{createForm.email}</AppText>
                    </AppText>

                    {otpError ? (
                      <View style={s.errorBox}>
                        <Ionicons name="alert-circle" size={16} color="#f87171" />
                        <AppText style={s.errorText}>{otpError}</AppText>
                      </View>
                    ) : null}

                    <View style={s.otpRow}>
                      {otp.map((digit, idx) => (
                        <TextInput
                          key={idx}
                          ref={r => otpRefs.current[idx] = r}
                          style={[s.otpBox, { 
                            borderColor: digit ? '#7c3aed' : theme.border2, 
                            backgroundColor: digit ? 'rgba(124,58,237,0.1)' : theme.bgCard, 
                            color: theme.text 
                          }]}
                          value={digit}
                          onChangeText={v => handleOtpChange(v, idx)}
                          onKeyPress={e => handleOtpKeyPress(e, idx)}
                          keyboardType="number-pad"
                          maxLength={1}
                          selectTextOnFocus
                        />
                      ))}
                    </View>

                    <GradientButton
                      label="Verify Email"
                      onPress={handleVerifyOtp}
                      loading={otpLoading}
                      style={{ marginTop: 8 }}
                    />

                    <TouchableOpacity
                      style={s.resendBtn}
                      onPress={handleResendOtp}
                      disabled={resendCooldown > 0}
                    >
                      <AppText style={[s.resendText, { color: resendCooldown > 0 ? theme.dim : '#7c3aed' }]}>
                        {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Didn't get it? Resend code"}
                      </AppText>
                    </TouchableOpacity>
                  </>
                )}
              </ScrollView>
            </BlurView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Add Account Modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={s.modalOverlay}>
          <TouchableOpacity 
            style={{ flex: 1 }} 
            activeOpacity={1} 
            onPress={() => setShowAddModal(false)} 
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
          <View style={[s.modalContent, { backgroundColor: theme.bgCard || theme.bg }]}>
            <View style={s.modalHeader}>
              <AppText style={[s.modalTitle, { color: theme.text }]}>Add Account</AppText>
              <TouchableOpacity onPress={() => setShowAddModal(false)} style={s.modalClose}>
                <Ionicons name="close" size={24} color={colors.muted} />
              </TouchableOpacity>
            </View>

            <View style={s.modalBody}>
              <AppText style={[s.inputLabel, { color: theme.text }]}>Email</AppText>
              <TextInput
                style={[s.input, { backgroundColor: theme.bgSecondary, color: theme.text, borderColor: theme.border2 }]}
                value={addForm.email}
                onChangeText={(text) => setAddForm(prev => ({ ...prev, email: text }))}
                placeholder="Enter email address"
                placeholderTextColor={colors.muted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <AppText style={[s.inputLabel, { color: theme.text }]}>Password</AppText>
              <TextInput
                style={[s.input, { backgroundColor: theme.bgSecondary, color: theme.text, borderColor: theme.border2 }]}
                value={addForm.password}
                onChangeText={(text) => setAddForm(prev => ({ ...prev, password: text }))}
                placeholder="Enter password"
                placeholderTextColor={colors.muted}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />

              <GradientButton
                label={addLoading ? 'Adding Account...' : 'Add Account'}
                onPress={handleAddAccount}
                disabled={addLoading}
                loading={addLoading}
                style={s.addButton}
              />
            </View>
          </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
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
    borderBottomColor: colors.border 
  },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 22, fontWeight: '800', color: colors.text },
  scroll: { padding: 16, gap: 10 },
  accountRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 14, 
    padding: 14, 
    borderRadius: radius.lg, 
    borderWidth: 1, 
    backgroundColor: 'rgba(30,41,59,0.6)', 
  },
  accountRowActive: { borderColor: '#7c3aed', backgroundColor: 'rgba(124,58,237,0.08)' },
  avatarWrap: { width: 52, height: 52 },
  avatarRing: { width: 52, height: 52, borderRadius: 26, padding: 2.5, alignItems: 'center', justifyContent: 'center' },
  avatarInner: { 
    width: 46, 
    height: 46, 
    borderRadius: 23, 
    overflow: 'hidden', 
    backgroundColor: colors.primary, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarLetter: { color: '#fff', fontWeight: '800', fontSize: 18 },
  accountName: { fontSize: 15, fontWeight: '700' },
  accountUsername: { fontSize: 12, marginTop: 2 },
  activeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  activeText: { color: '#10b981', fontSize: 12, fontWeight: '700' },
  removeBtn: { padding: 4 },
  addBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 10, 
    padding: 14, 
    borderRadius: radius.lg, 
    borderWidth: 1, 
    borderStyle: 'dashed', 
    marginTop: 6 
  },
  addBtnText: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    marginTop: 10,
    overflow: 'hidden',
  },
  createBtnText: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  atSign: { fontSize: 16, fontWeight: '600' },
  inputField: { flex: 1, paddingVertical: 13, fontSize: 14 },
  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: -8, marginBottom: 14 },
  strengthBar: { flex: 1, height: 3, borderRadius: 2 },
  strengthText: { fontSize: 11, marginLeft: 4, fontWeight: '600' },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(248,113,113,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.3)',
    borderRadius: radius.sm,
    padding: 12,
    marginBottom: 16,
  },
  errorText: { color: '#f87171', fontSize: 13, flex: 1 },
  usernameErr: { fontSize: 11, color: '#f87171', marginTop: -10, marginBottom: 10, marginLeft: 4 },
  usernameOk: { fontSize: 11, color: '#10b981', marginTop: -10, marginBottom: 10, marginLeft: 4 },
  terms: { fontSize: 11, color: colors.dim, textAlign: 'center', marginTop: 16, lineHeight: 16 },
  termsLink: { color: '#7c3aed', fontWeight: '600' },
  otpIconWrap: { alignSelf: 'center', marginBottom: 16 },
  otpIconGrad: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  otpTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  otpSub: { fontSize: 13, textAlign: 'center', marginBottom: 20, lineHeight: 19 },
  otpRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 24, gap: 8 },
  otpBox: { flex: 1, height: 58, borderRadius: 12, borderWidth: 1.5, textAlign: 'center', fontSize: 24, fontWeight: '800' },
  resendBtn: { alignSelf: 'center', marginTop: 16, padding: 8 },
  resendText: { fontSize: 13, fontWeight: '600' },
  modalSubtitle: { fontSize: 12, marginTop: 2 },
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  modalClose: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
    gap: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 14,
    fontSize: 16,
    marginBottom: 4,
  },
  addButton: {
    marginTop: 10,
  },
});
