import React, { useState, useRef } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Image, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';
import api from '../api/axios';
import GradientButton from './GradientButton';
import PhoneInput from './PhoneInput';

export function PhoneModal({ visible, onClose, onSuccess }) {
  const [step, setStep] = useState('phone'); // phone | otp | done
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef([]);
  const cooldownRef = useRef(null);

  const reset = () => {
    setStep('phone');
    setPhone('');
    setOtp(['', '', '', '', '', '']);
    setError('');
    setResendCooldown(0);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
  };

  const handleClose = () => { reset(); onClose(); };

  const sendOTP = async () => {
    if (!phone.trim() || !phone.startsWith('+')) {
      setError('Please select a country and enter a valid phone number');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/phone/send-add-otp', { phone });
      setStep('otp');
      startCooldown();
      if (!data.email_sent && data.otp) {
        setError(`Email unavailable. Use this code: ${data.otp}`);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const startCooldown = () => {
    setResendCooldown(60);
    cooldownRef.current = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) { clearInterval(cooldownRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleOtpChange = (val, idx) => {
    if (!/^[0-9]?$/.test(val)) return;
    const next = [...otp];
    next[idx] = val;
    setOtp(next);
    setError('');
    if (val && idx < 5) inputRefs.current[idx + 1]?.focus();
  };

  const handleOtpKeyPress = (e, idx) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
  };

  const verifyOTP = async () => {
    const code = otp.join('');
    if (code.length < 6) { setError('Please enter the complete 6-digit code'); return; }
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/phone/add', { phone, otp: code });
      onSuccess?.();
      setStep('done');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={s.overlay}>
        <BlurView intensity={20} tint="dark" style={s.sheet}>
          <LinearGradient colors={['rgba(124,58,237,0.1)', 'rgba(15,23,42,0.98)']} style={StyleSheet.absoluteFill} />
          <View style={s.handle} />
          <View style={s.inner}>
            <TouchableOpacity style={s.closeBtn} onPress={handleClose}>
              <Ionicons name="close" size={22} color={colors.muted} />
            </TouchableOpacity>

            <View style={s.iconWrap}>
              <LinearGradient colors={step === 'done' ? ['#10b981', '#059669'] : ['#10b981', '#059669']} style={s.iconGrad}>
                <Ionicons name={step === 'done' ? 'checkmark' : 'phone-portrait-outline'} size={26} color="#fff" />
              </LinearGradient>
            </View>

            <Text style={s.title}>
              {step === 'phone' ? 'Add Phone Number' : step === 'otp' ? 'Enter Verification Code' : 'Phone Added!'}
            </Text>
            <Text style={s.sub}>
              {step === 'phone'
                ? "We'll send a verification code to your email."
                : step === 'otp'
                ? 'Enter the 6-digit code sent to your email.'
                : 'Your phone number has been added to your account.'}
            </Text>

            {error ? (
              <View style={s.errorBox}>
                <Ionicons name="alert-circle" size={14} color="#f87171" />
                <Text style={s.errorText}>{error}</Text>
              </View>
            ) : null}

            {step === 'phone' && (
              <>
                <Text style={s.label}>Phone Number</Text>
                <PhoneInput value={phone} onChangeText={setPhone} placeholder="Enter phone number" style={{ marginBottom: 16 }} />
                <GradientButton label="Send Code" onPress={sendOTP} loading={loading} style={{ marginTop: 4 }} />
              </>
            )}

            {step === 'otp' && (
              <>
                <View style={s.otpRow}>
                  {otp.map((digit, idx) => (
                    <TextInput
                      key={idx}
                      ref={r => inputRefs.current[idx] = r}
                      style={[s.otpBox, digit ? s.otpBoxFilled : null]}
                      value={digit}
                      onChangeText={v => handleOtpChange(v, idx)}
                      onKeyPress={e => handleOtpKeyPress(e, idx)}
                      keyboardType="number-pad"
                      maxLength={1}
                      selectTextOnFocus
                    />
                  ))}
                </View>
                <GradientButton label="Verify Code" onPress={verifyOTP} loading={loading} style={{ marginTop: 8 }} />
                <TouchableOpacity style={s.resendBtn} onPress={sendOTP} disabled={resendCooldown > 0}>
                  <Text style={[s.resendText, { color: resendCooldown > 0 ? colors.dim : '#10b981' }]}>
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Didn't get it? Resend"}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {step === 'done' && (
              <TouchableOpacity onPress={handleClose} style={s.doneBtn}>
                <LinearGradient colors={['#10b981', '#059669']} style={s.doneBtnGrad}>
                  <Text style={s.doneBtnText}>Done</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        </BlurView>
      </View>
    </Modal>
  );
}

export function ChangePasswordModal({ visible, onClose, userEmail, hasPassword, onSuccess }) {
  const [step, setStep] = useState('form'); // form | otp | done
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef([]);
  const cooldownRef = useRef(null);

  const reset = () => {
    setStep('form');
    setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    setOtp(['', '', '', '', '', '']);
    setError(''); setShowCurrent(false); setShowNew(false); setShowConfirm(false);
    setResendCooldown(0);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
  };

  const handleClose = () => { reset(); onClose(); };

  const startCooldown = () => {
    setResendCooldown(60);
    cooldownRef.current = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) { clearInterval(cooldownRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleOtpChange = (val, idx) => {
    if (!/^[0-9]?$/.test(val)) return;
    const next = [...otp];
    next[idx] = val;
    setOtp(next);
    setError('');
    if (val && idx < 5) inputRefs.current[idx + 1]?.focus();
  };

  const handleOtpKeyPress = (e, idx) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[idx] && idx > 0)
      inputRefs.current[idx - 1]?.focus();
  };

  const sendOtp = async () => {
    if (newPassword.length < 6) { setError('New password must be at least 6 characters'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }
    setError(''); setLoading(true);
    try {
      await api.post('/auth/change-password', {
        current_password: currentPassword || undefined,
        new_password: newPassword,
      });
      setStep('otp');
      startCooldown();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send verification code.');
    } finally { setLoading(false); }
  };

  const verifyOtp = async () => {
    const code = otp.join('');
    if (code.length < 6) { setError('Please enter the complete 6-digit code'); return; }
    setError(''); setLoading(true);
    try {
      await api.post('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
        otp: code,
      });
      onSuccess?.();
      setStep('done');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid code. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={s.overlay}>
        <BlurView intensity={20} tint="dark" style={s.sheet}>
          <LinearGradient colors={['rgba(124,58,237,0.1)', 'rgba(15,23,42,0.98)']} style={StyleSheet.absoluteFill} />
          <View style={s.handle} />
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={s.inner}>
            <TouchableOpacity style={s.closeBtn} onPress={handleClose}>
              <Ionicons name="close" size={22} color={colors.muted} />
            </TouchableOpacity>

            <View style={s.iconWrap}>
              <LinearGradient colors={step === 'done' ? ['#10b981', '#059669'] : ['#7c3aed', '#3b82f6']} style={s.iconGrad}>
                <Ionicons name={step === 'done' ? 'checkmark' : step === 'otp' ? 'keypad-outline' : 'key-outline'} size={26} color="#fff" />
              </LinearGradient>
            </View>

            <Text style={s.title}>
              {step === 'form' ? 'Change Password' : step === 'otp' ? 'Verify Your Email' : 'Password Changed!'}
            </Text>
            <Text style={s.sub}>
              {step === 'form'
                ? 'Choose a strong password to keep your account secure.'
                : step === 'otp'
                ? `We sent a 6-digit code to ${userEmail}. Enter it to confirm your password change.`
                : 'Your password has been updated successfully.'}
            </Text>

            {error ? (
              <View style={s.errorBox}>
                <Ionicons name="alert-circle" size={14} color="#f87171" />
                <Text style={s.errorText}>{error}</Text>
              </View>
            ) : null}

            {step === 'form' && (
              <>
                <Text style={s.label}>Current Password (if you have one)</Text>
                <View style={s.inputWrap}>
                  <Ionicons name="lock-closed-outline" size={17} color={colors.muted} />
                  <TextInput
                    style={s.input}
                    placeholder="Leave blank if signing in with Google"
                    placeholderTextColor={colors.dim}
                    secureTextEntry={!showCurrent}
                    value={currentPassword}
                    onChangeText={v => { setCurrentPassword(v); setError(''); }}
                  />
                  <TouchableOpacity onPress={() => setShowCurrent(p => !p)} style={{ padding: 4 }}>
                    <Ionicons name={showCurrent ? 'eye-off-outline' : 'eye-outline'} size={17} color={colors.muted} />
                  </TouchableOpacity>
                </View>
                <Text style={s.label}>New Password</Text>
                <View style={s.inputWrap}>
                  <Ionicons name="lock-open-outline" size={17} color={colors.muted} />
                  <TextInput
                    style={s.input}
                    placeholder="Min. 6 characters"
                    placeholderTextColor={colors.dim}
                    secureTextEntry={!showNew}
                    value={newPassword}
                    onChangeText={v => { setNewPassword(v); setError(''); }}
                  />
                  <TouchableOpacity onPress={() => setShowNew(p => !p)} style={{ padding: 4 }}>
                    <Ionicons name={showNew ? 'eye-off-outline' : 'eye-outline'} size={17} color={colors.muted} />
                  </TouchableOpacity>
                </View>
                <Text style={s.label}>Confirm New Password</Text>
                <View style={s.inputWrap}>
                  <Ionicons name="lock-open-outline" size={17} color={colors.muted} />
                  <TextInput
                    style={s.input}
                    placeholder="Repeat new password"
                    placeholderTextColor={colors.dim}
                    secureTextEntry={!showConfirm}
                    value={confirmPassword}
                    onChangeText={v => { setConfirmPassword(v); setError(''); }}
                  />
                  <TouchableOpacity onPress={() => setShowConfirm(p => !p)} style={{ padding: 4 }}>
                    <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={17} color={colors.muted} />
                  </TouchableOpacity>
                </View>
                <GradientButton label="Send Verification Code" onPress={sendOtp} loading={loading} style={{ marginTop: 4 }} />
              </>
            )}

            {step === 'otp' && (
              <>
                <View style={s.otpRow}>
                  {otp.map((digit, idx) => (
                    <TextInput
                      key={idx}
                      ref={r => inputRefs.current[idx] = r}
                      style={[s.otpBox, digit ? s.otpBoxFilled : null]}
                      value={digit}
                      onChangeText={v => handleOtpChange(v, idx)}
                      onKeyPress={e => handleOtpKeyPress(e, idx)}
                      keyboardType="number-pad"
                      maxLength={1}
                      selectTextOnFocus
                    />
                  ))}
                </View>
                <GradientButton label="Confirm Change" onPress={verifyOtp} loading={loading} style={{ marginTop: 8 }} />
                <TouchableOpacity style={s.resendBtn} onPress={sendOtp} disabled={resendCooldown > 0}>
                  <Text style={[s.resendText, { color: resendCooldown > 0 ? colors.dim : '#7c3aed' }]}>
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Didn't get it? Resend"}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {step === 'done' && (
              <TouchableOpacity onPress={handleClose} style={s.doneBtn}>
                <LinearGradient colors={['#10b981', '#059669']} style={s.doneBtnGrad}>
                  <Text style={s.doneBtnText}>Done</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
          </ScrollView>
        </BlurView>
      </View>
    </Modal>
  );
}

export function TwoFactorModal({ visible, onClose, onSuccess, isEnabled }) {
  const [step, setStep] = useState('init'); // init | verify | backup | done | disable
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [backupCodes, setBackupCodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleClose = () => {
    setStep('init'); setQrCode(''); setSecret('');
    setCode(''); setPassword(''); setBackupCodes([]); setError('');
    onClose();
  };

  const setup2FA = async () => {
    setLoading(true); setError('');
    try {
      const { data } = await api.post('/auth/2fa/setup');
      setQrCode(data.qr_code); setSecret(data.secret); setStep('verify');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to setup 2FA');
    } finally { setLoading(false); }
  };

  const verify2FA = async () => {
    if (!code.trim() || code.length !== 6) { setError('Please enter a valid 6-digit code'); return; }
    setLoading(true); setError('');
    try {
      const { data } = await api.post('/auth/2fa/verify', { code });
      setBackupCodes(data.backup_codes); setStep('backup');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid code. Please try again.');
    } finally { setLoading(false); }
  };

  const disable2FA = async () => {
    setLoading(true); setError('');
    try {
      await api.post('/auth/2fa/disable', { password });
      onSuccess?.();
      setStep('done');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to disable 2FA.');
    } finally { setLoading(false); }
  };

  const handleComplete = () => { onSuccess?.(); setStep('done'); };

  // Show disable UI if 2FA already enabled
  const initStep = isEnabled ? 'disable' : 'setup';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={s.overlay}>
        <BlurView intensity={20} tint="dark" style={s.sheet}>
          <LinearGradient colors={['rgba(124,58,237,0.1)', 'rgba(15,23,42,0.98)']} style={StyleSheet.absoluteFill} />
          <View style={s.handle} />
          <View style={s.inner}>
            <TouchableOpacity style={s.closeBtn} onPress={handleClose}>
              <Ionicons name="close" size={22} color={colors.muted} />
            </TouchableOpacity>

            <View style={s.iconWrap}>
              <LinearGradient
                colors={step === 'done' ? ['#10b981', '#059669'] : isEnabled ? ['#f87171', '#ef4444'] : ['#7c3aed', '#3b82f6']}
                style={s.iconGrad}
              >
                <Ionicons
                  name={step === 'done' ? 'checkmark' : isEnabled ? 'shield-off-outline' : 'shield-checkmark-outline'}
                  size={26} color="#fff"
                />
              </LinearGradient>
            </View>

            {/* DISABLE FLOW */}
            {isEnabled && step === 'init' && (
              <>
                <Text style={s.title}>Disable 2FA</Text>
                <Text style={s.sub}>Enter your password to disable two-factor authentication.</Text>
                {error ? <View style={s.errorBox}><Ionicons name="alert-circle" size={14} color="#f87171" /><Text style={s.errorText}>{error}</Text></View> : null}
                <Text style={s.label}>Password</Text>
                <View style={s.inputWrap}>
                  <Ionicons name="lock-closed-outline" size={17} color={colors.muted} />
                  <TextInput
                    style={s.input}
                    placeholder="Enter your password"
                    placeholderTextColor={colors.dim}
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={v => { setPassword(v); setError(''); }}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(p => !p)} style={{ padding: 4 }}>
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={17} color={colors.muted} />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={s.doneBtn} onPress={disable2FA} disabled={loading} activeOpacity={0.85}>
                  <LinearGradient colors={['#f87171', '#ef4444']} style={s.doneBtnGrad}>
                    {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.doneBtnText}>Disable 2FA</Text>}
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}

            {/* SETUP FLOW */}
            {!isEnabled && step === 'init' && (
              <>
                <Text style={s.title}>Two-Factor Authentication</Text>
                <Text style={s.sub}>Add an extra layer of security to your account.</Text>
                <GradientButton label="Setup 2FA" onPress={setup2FA} loading={loading} style={{ marginTop: 20 }} />
              </>
            )}

            {step === 'verify' && (
              <>
                <Text style={s.title}>Scan QR Code</Text>
                <Text style={s.sub}>Scan with your authenticator app, then enter the 6-digit code.</Text>
                {qrCode && <View style={s.qrContainer}><Image source={{ uri: qrCode }} style={s.qrImage} /></View>}
                <Text style={s.secretLabel}>Manual Entry Key:</Text>
                <Text style={s.secretText}>{secret}</Text>
                {error ? <View style={s.errorBox}><Ionicons name="alert-circle" size={14} color="#f87171" /><Text style={s.errorText}>{error}</Text></View> : null}
                <Text style={s.label}>Verification Code</Text>
                <View style={s.inputWrap}>
                  <Ionicons name="keypad-outline" size={17} color={colors.muted} />
                  <TextInput style={s.input} placeholder="123456" placeholderTextColor={colors.dim} keyboardType="number-pad" value={code} onChangeText={setCode} maxLength={6} />
                </View>
                <GradientButton label="Verify & Enable" onPress={verify2FA} loading={loading} style={{ marginTop: 4 }} />
              </>
            )}

            {step === 'backup' && (
              <>
                <Text style={s.title}>Save Backup Codes</Text>
                <Text style={s.sub}>Store these in a safe place. Use them if you lose your authenticator.</Text>
                <View style={s.backupContainer}>
                  {backupCodes.map((c, i) => <Text key={i} style={s.backupCode}>{c}</Text>)}
                </View>
                <GradientButton label="I've Saved My Codes" onPress={handleComplete} style={{ marginTop: 20 }} />
              </>
            )}

            {step === 'done' && (
              <>
                <Text style={s.title}>{isEnabled ? '2FA Disabled' : '2FA Enabled!'}</Text>
                <Text style={s.sub}>
                  {isEnabled
                    ? 'Two-factor authentication has been disabled.'
                    : 'Your account is now protected with two-factor authentication.'}
                </Text>
                <TouchableOpacity onPress={handleClose} style={s.doneBtn}>
                  <LinearGradient colors={['#10b981', '#059669']} style={s.doneBtnGrad}>
                    <Text style={s.doneBtnText}>Done</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}
          </View>
        </BlurView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', paddingBottom: 40, maxHeight: '90%' },
  handle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  inner: { padding: 24, paddingTop: 12 },
  closeBtn: { alignSelf: 'flex-end', padding: 4, marginBottom: 8 },
  iconWrap: { alignSelf: 'center', marginBottom: 16 },
  iconGrad: { width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: 6, marginTop: 12 },
  sub: { fontSize: 13, color: colors.muted, textAlign: 'center', marginBottom: 20, lineHeight: 19 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(248,113,113,0.1)', borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)', borderRadius: radius.sm, padding: 10, marginBottom: 14 },
  errorText: { color: '#f87171', fontSize: 12, flex: 1 },
  label: { fontSize: 11, color: colors.muted, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(30,41,59,0.9)', borderWidth: 1, borderColor: colors.border2, borderRadius: radius.md, paddingHorizontal: 14, marginBottom: 16 },
  input: { flex: 1, paddingVertical: 13, color: colors.text, fontSize: 14 },
  otpRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  otpBox: { width: 46, height: 56, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border2, backgroundColor: 'rgba(30,41,59,0.9)', textAlign: 'center', fontSize: 22, fontWeight: '800', color: colors.text },
  otpBoxFilled: { borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)' },
  resendBtn: { alignSelf: 'center', marginTop: 16, padding: 8 },
  resendText: { fontSize: 13, fontWeight: '600' },
  doneBtn: { borderRadius: radius.md, overflow: 'hidden', marginTop: 20 },
  doneBtnGrad: { paddingVertical: 14, alignItems: 'center' },
  doneBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  qrContainer: { alignItems: 'center', marginVertical: 20 },
  qrImage: { width: 200, height: 200, borderRadius: 12 },
  secretLabel: { fontSize: 12, color: colors.muted, fontWeight: '600', marginTop: 10, marginBottom: 4 },
  secretText: { fontSize: 11, color: colors.text, backgroundColor: 'rgba(30,41,59,0.9)', padding: 10, borderRadius: 8, fontFamily: 'monospace', marginBottom: 20 },
  backupContainer: { backgroundColor: 'rgba(30,41,59,0.9)', borderRadius: 12, padding: 16, marginVertical: 20 },
  backupCode: { fontSize: 14, color: colors.text, fontFamily: 'monospace', textAlign: 'center', paddingVertical: 4 },
});
