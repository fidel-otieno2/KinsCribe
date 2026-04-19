import React, { useState, useRef } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, 
  StyleSheet, ActivityIndicator, Alert, Image
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';
import api from '../api/axios';
import GradientButton from './GradientButton';
import PhoneInput from './PhoneInput';

// Phone Number Modal
export function PhoneModal({ visible, onClose, onSuccess }) {
  const [step, setStep] = useState('phone'); // phone | otp
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
    if (cooldownRef.current) {
      clearInterval(cooldownRef.current);
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const formatPhoneNumber = (value) => {
    const cleaned = value.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);
    if (match) {
      return !match[2] ? match[1] : `(${match[1]}) ${match[2]}${match[3] ? `-${match[3]}` : ''}`;
    }
    return value;
  };

  const sendOTP = async () => {
    if (!phone.trim()) {
      setError('Please enter your phone number');
      return;
    }

    if (!phone.startsWith('+')) {
      setError('Please select a country and enter a valid phone number');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const { data } = await api.post('/auth/phone/send-add-otp', { phone });
      setStep('otp');
      startCooldown();
      
      // Show OTP in development
      if (data.otp) {
        console.log('📱 Development OTP:', data.otp);
        Alert.alert(
          'Development Mode', 
          `Your OTP code is: ${data.otp}\n\n(This will be sent via SMS in production)`, 
          [{ text: 'OK' }]
        );
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const startCooldown = () => {
    setResendCooldown(60);
    cooldownRef.current = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current);
          return 0;
        }
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
    if (code.length < 6) {
      setError('Please enter the complete 6-digit code');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await api.post('/auth/phone/add', {
        phone,
        otp: code
      });

      onSuccess?.();
      handleClose();
      Alert.alert('Success', 'Phone number added successfully!');
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
              <LinearGradient colors={['#10b981', '#059669']} style={s.iconGrad}>
                <Ionicons name="phone-portrait-outline" size={26} color="#fff" />
              </LinearGradient>
            </View>

            <Text style={s.title}>
              {step === 'phone' ? 'Add Phone Number' : 'Verify Phone Number'}
            </Text>
            <Text style={s.sub}>
              {step === 'phone'
                ? "Add your phone number for enhanced security and login options."
                : `We sent a 6-digit code to ${phone}`}
            </Text>

            {error ? (
              <View style={s.errorBox}>
                <Ionicons name="alert-circle" size={14} color="#f87171" />
                <Text style={s.errorText}>{error}</Text>
              </View>
            ) : null}

            {step === 'phone' ? (
              <>
                <Text style={s.label}>Phone Number</Text>
                <PhoneInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Enter phone number"
                  error={error}
                  style={{ marginBottom: 16 }}
                />
                <GradientButton
                  label={loading ? 'Sending...' : 'Send Code'}
                  onPress={sendOTP}
                  loading={loading}
                  style={{ marginTop: 4 }}
                />
              </>
            ) : (
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

                <GradientButton
                  label={loading ? 'Verifying...' : 'Verify Code'}
                  onPress={verifyOTP}
                  loading={loading}
                  style={{ marginTop: 8 }}
                />

                <TouchableOpacity 
                  style={s.resendBtn} 
                  onPress={sendOTP} 
                  disabled={resendCooldown > 0}
                >
                  <Text style={[s.resendText, { color: resendCooldown > 0 ? colors.dim : '#10b981' }]}>
                    {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Didn't get it? Resend code"}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </BlurView>
      </View>
    </Modal>
  );
}

// 2FA Setup Modal
export function TwoFactorModal({ visible, onClose, onSuccess }) {
  const [step, setStep] = useState('setup'); // setup | verify | backup
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const setup2FA = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/2fa/setup');
      setQrCode(data.qr_code);
      setSecret(data.secret);
      setStep('verify');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to setup 2FA');
    } finally {
      setLoading(false);
    }
  };

  const verify2FA = async () => {
    if (!code.trim() || code.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/2fa/verify', { code });
      setBackupCodes(data.backup_codes);
      setStep('backup');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep('setup');
    setQrCode('');
    setSecret('');
    setCode('');
    setBackupCodes([]);
    setError('');
    onClose();
  };

  const handleComplete = () => {
    onSuccess?.();
    handleClose();
    Alert.alert('Success', '2FA has been enabled for your account!');
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
              <LinearGradient colors={['#7c3aed', '#3b82f6']} style={s.iconGrad}>
                <Ionicons name="shield-checkmark-outline" size={26} color="#fff" />
              </LinearGradient>
            </View>

            {step === 'setup' && (
              <>
                <Text style={s.title}>Enable Two-Factor Authentication</Text>
                <Text style={s.sub}>
                  Add an extra layer of security to your account with 2FA.
                </Text>
                <GradientButton
                  label={loading ? 'Setting up...' : 'Setup 2FA'}
                  onPress={setup2FA}
                  loading={loading}
                  style={{ marginTop: 20 }}
                />
              </>
            )}

            {step === 'verify' && (
              <>
                <Text style={s.title}>Scan QR Code</Text>
                <Text style={s.sub}>
                  Use your authenticator app to scan this QR code, then enter the 6-digit code.
                </Text>

                {qrCode && (
                  <View style={s.qrContainer}>
                    <Image source={{ uri: qrCode }} style={s.qrImage} />
                  </View>
                )}

                <Text style={s.secretLabel}>Manual Entry Key:</Text>
                <Text style={s.secretText}>{secret}</Text>

                {error ? (
                  <View style={s.errorBox}>
                    <Ionicons name="alert-circle" size={14} color="#f87171" />
                    <Text style={s.errorText}>{error}</Text>
                  </View>
                ) : null}

                <Text style={s.label}>Verification Code</Text>
                <View style={s.inputWrap}>
                  <Ionicons name="keypad-outline" size={17} color={colors.muted} />
                  <TextInput
                    style={s.input}
                    placeholder="123456"
                    placeholderTextColor={colors.dim}
                    keyboardType="number-pad"
                    value={code}
                    onChangeText={setCode}
                    maxLength={6}
                  />
                </View>

                <GradientButton
                  label={loading ? 'Verifying...' : 'Verify & Enable'}
                  onPress={verify2FA}
                  loading={loading}
                  style={{ marginTop: 4 }}
                />
              </>
            )}

            {step === 'backup' && (
              <>
                <Text style={s.title}>Save Backup Codes</Text>
                <Text style={s.sub}>
                  Store these backup codes in a safe place. You can use them to access your account if you lose your authenticator device.
                </Text>

                <View style={s.backupContainer}>
                  {backupCodes.map((code, index) => (
                    <Text key={index} style={s.backupCode}>{code}</Text>
                  ))}
                </View>

                <GradientButton
                  label="I've Saved My Codes"
                  onPress={handleComplete}
                  style={{ marginTop: 20 }}
                />
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
  qrContainer: { alignItems: 'center', marginVertical: 20 },
  qrImage: { width: 200, height: 200, borderRadius: 12 },
  secretLabel: { fontSize: 12, color: colors.muted, fontWeight: '600', marginTop: 10, marginBottom: 4 },
  secretText: { fontSize: 11, color: colors.text, backgroundColor: 'rgba(30,41,59,0.9)', padding: 10, borderRadius: 8, fontFamily: 'monospace', marginBottom: 20 },
  backupContainer: { backgroundColor: 'rgba(30,41,59,0.9)', borderRadius: 12, padding: 16, marginVertical: 20 },
  backupCode: { fontSize: 14, color: colors.text, fontFamily: 'monospace', textAlign: 'center', paddingVertical: 4 },
});