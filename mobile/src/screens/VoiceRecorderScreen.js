import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  Alert, TextInput, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator
} from 'react-native';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';
import { multipartPost } from '../api/upload';
import { Platform } from 'react-native';

const BAR_COUNT = 32;

export default function VoiceRecorderScreen({ navigation }) {
  const [recording, setRecording] = useState(null);
  const [recordedUri, setRecordedUri] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [playbackPos, setPlaybackPos] = useState(0);
  const [step, setStep] = useState('record'); // record | details | posting
  const [form, setForm] = useState({ title: '', content: '', privacy: 'family', story_date: '' });
  const [posting, setPosting] = useState(false);
  const soundRef = useRef(null);
  const timerRef = useRef(null);
  const bars = useRef(Array.from({ length: BAR_COUNT }, () => new Animated.Value(0.15))).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Audio.requestPermissionsAsync();
    Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    return () => {
      stopTimer();
      soundRef.current?.unloadAsync();
    };
  }, []);

  const startTimer = () => {
    timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
  };
  const stopTimer = () => { clearInterval(timerRef.current); };

  const animateBars = useCallback(() => {
    bars.forEach(bar => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(bar, { toValue: Math.random() * 0.85 + 0.15, duration: 150 + Math.random() * 200, useNativeDriver: true }),
          Animated.timing(bar, { toValue: Math.random() * 0.4 + 0.1, duration: 150 + Math.random() * 200, useNativeDriver: true }),
        ])
      ).start();
    });
  }, [bars]);

  const stopBarAnimation = useCallback(() => {
    bars.forEach(bar => { bar.stopAnimation(); Animated.timing(bar, { toValue: 0.15, duration: 300, useNativeDriver: true }).start(); });
  }, [bars]);

  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    ).start();
  };

  const startRecording = async () => {
    try {
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await rec.startAsync();
      setRecording(rec);
      setIsRecording(true);
      setDuration(0);
      setRecordedUri(null);
      startTimer();
      animateBars();
      startPulse();
    } catch (e) {
      Alert.alert('Error', 'Could not start recording. Check microphone permissions.');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecordedUri(uri);
      setRecording(null);
      setIsRecording(false);
      stopTimer();
      stopBarAnimation();
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    } catch {}
  };

  const playRecording = async () => {
    if (!recordedUri) return;
    if (isPlaying) {
      await soundRef.current?.pauseAsync();
      setIsPlaying(false);
      return;
    }
    try {
      if (soundRef.current) await soundRef.current.unloadAsync();
      const { sound } = await Audio.Sound.createAsync(
        { uri: recordedUri },
        { shouldPlay: true },
        (status) => {
          if (status.isLoaded) {
            setPlaybackPos(status.positionMillis / 1000);
            if (status.didJustFinish) { setIsPlaying(false); setPlaybackPos(0); }
          }
        }
      );
      soundRef.current = sound;
      setIsPlaying(true);
    } catch {}
  };

  const handlePost = async () => {
    if (!form.title.trim()) return Alert.alert('Title Required', 'Give your voice story a title');
    if (!recordedUri) return Alert.alert('No Recording', 'Record your voice first');
    setPosting(true);
    setStep('posting');
    try {
      const fd = new FormData();
      fd.append('title', form.title);
      fd.append('content', form.content || '');
      fd.append('privacy', form.privacy);
      if (form.story_date) fd.append('story_date', form.story_date);
      if (Platform.OS === 'web') {
        const response = await fetch(recordedUri);
        const blob = await response.blob();
        fd.append('file', new File([blob], 'voice.m4a', { type: 'audio/m4a' }));
      } else {
        fd.append('file', { uri: recordedUri, name: 'voice.m4a', type: 'audio/m4a' });
      }
      const data = await multipartPost('/stories/', fd);
      navigation.replace('AIProcessing', { storyId: data.story?.id });
    } catch (err) {
      Alert.alert('Post Failed', err.message || 'Network error');
      setStep('details');
    } finally {
      setPosting(false);
    }
  };

  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <LinearGradient colors={['#0f172a', '#1a0a2e', '#0f172a']} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Voice Story</Text>
        {step === 'record' && recordedUri && (
          <TouchableOpacity style={s.nextBtn} onPress={() => setStep('details')}>
            <Text style={s.nextBtnText}>Next</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {step === 'record' && (
        <View style={s.recorderWrap}>
          {/* Waveform */}
          <View style={s.waveformContainer}>
            {bars.map((bar, i) => (
              <Animated.View
                key={i}
                style={[s.bar, {
                  transform: [{ scaleY: bar }],
                  backgroundColor: isRecording
                    ? i % 3 === 0 ? '#7c3aed' : i % 3 === 1 ? '#3b82f6' : '#a78bfa'
                    : recordedUri ? '#10b981' : colors.dim,
                }]}
              />
            ))}
          </View>

          {/* Timer */}
          <Text style={s.timer}>{formatTime(isRecording ? duration : duration)}</Text>
          {isRecording && <Text style={s.recLabel}>● REC</Text>}

          {/* Controls */}
          <View style={s.controls}>
            {recordedUri && !isRecording && (
              <TouchableOpacity style={s.playBtn} onPress={playRecording}>
                <LinearGradient colors={['#10b981', '#059669']} style={s.playBtnGrad}>
                  <Ionicons name={isPlaying ? 'pause' : 'play'} size={26} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
            )}

            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <TouchableOpacity
                style={[s.recordBtn, isRecording && s.recordBtnActive]}
                onPress={isRecording ? stopRecording : startRecording}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={isRecording ? ['#e0245e', '#be123c'] : ['#7c3aed', '#3b82f6']}
                  style={s.recordBtnGrad}
                >
                  <Ionicons name={isRecording ? 'stop' : 'mic'} size={36} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            {recordedUri && !isRecording && (
              <TouchableOpacity style={s.retryBtn} onPress={() => { setRecordedUri(null); setDuration(0); }}>
                <LinearGradient colors={['rgba(30,41,59,0.8)', 'rgba(30,41,59,0.8)']} style={s.retryBtnGrad}>
                  <Ionicons name="refresh" size={22} color={colors.muted} />
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>

          <Text style={s.hint}>
            {isRecording ? 'Tap to stop recording' : recordedUri ? 'Preview or tap Next to continue' : 'Tap the mic to start recording'}
          </Text>
        </View>
      )}

      {(step === 'details' || step === 'posting') && (
        <ScrollView style={s.detailsScroll} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          {/* Audio preview card */}
          <View style={s.audioPreviewCard}>
            <LinearGradient colors={['rgba(124,58,237,0.2)', 'rgba(59,130,246,0.1)']} style={StyleSheet.absoluteFill} />
            <View style={s.audioPreviewInner}>
              <TouchableOpacity onPress={playRecording} style={s.playIconBtn}>
                <LinearGradient colors={['#7c3aed', '#3b82f6']} style={s.playIconGrad}>
                  <Ionicons name={isPlaying ? 'pause' : 'play'} size={22} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
              <View style={s.audioMiniWave}>
                {Array.from({ length: 20 }).map((_, i) => (
                  <View key={i} style={[s.miniBar, { height: 4 + Math.sin(i * 0.8) * 12 + 8 }]} />
                ))}
              </View>
              <Text style={s.audioDuration}>{formatTime(duration)}</Text>
            </View>
          </View>

          <Text style={s.label}>Title *</Text>
          <TextInput style={s.input} placeholder="Give your voice story a title..."
            placeholderTextColor={colors.dim} value={form.title}
            onChangeText={v => setForm(f => ({ ...f, title: v }))} />

          <Text style={s.label}>Description (optional)</Text>
          <TextInput style={[s.input, s.textarea]} multiline placeholder="What is this voice story about?"
            placeholderTextColor={colors.dim} value={form.content}
            onChangeText={v => setForm(f => ({ ...f, content: v }))} />

          <Text style={s.label}>When did this happen? (optional)</Text>
          <TextInput style={s.input} placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.dim} value={form.story_date}
            onChangeText={v => setForm(f => ({ ...f, story_date: v }))} />

          <Text style={s.label}>Privacy</Text>
          <View style={s.privacyRow}>
            {['family', 'private', 'public'].map(p => (
              <TouchableOpacity key={p} style={[s.privacyTab, form.privacy === p && s.privacyTabActive]}
                onPress={() => setForm(f => ({ ...f, privacy: p }))}>
                <Text style={[s.privacyText, form.privacy === p && { color: '#fff' }]}>
                  {p === 'family' ? '👨‍👩‍👧 Family' : p === 'private' ? '🔒 Private' : '🌍 Public'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={s.postBtn} onPress={handlePost} disabled={posting} activeOpacity={0.85}>
            <LinearGradient colors={['#7c3aed', '#3b82f6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.postBtnGrad}>
              {posting
                ? <ActivityIndicator color="#fff" />
                : <><Ionicons name="sparkles" size={18} color="#fff" /><Text style={s.postBtnText}>Post & Enhance with AI</Text></>}
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 52, paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '800', color: colors.text },
  nextBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#7c3aed', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  nextBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  recorderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  waveformContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 100, gap: 3, marginBottom: 24 },
  bar: { width: 4, height: 60, borderRadius: 2 },
  timer: { fontSize: 52, fontWeight: '200', color: colors.text, letterSpacing: 2, marginBottom: 4 },
  recLabel: { fontSize: 13, color: '#e0245e', fontWeight: '700', letterSpacing: 2, marginBottom: 32 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 24, marginBottom: 24 },
  playBtn: { width: 56, height: 56, borderRadius: 28, overflow: 'hidden' },
  playBtnGrad: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  recordBtn: { width: 88, height: 88, borderRadius: 44, overflow: 'hidden' },
  recordBtnActive: { shadowColor: '#e0245e', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 20, elevation: 12 },
  recordBtnGrad: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  retryBtn: { width: 56, height: 56, borderRadius: 28, overflow: 'hidden' },
  retryBtnGrad: { flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border2, borderRadius: 28 },
  hint: { fontSize: 13, color: colors.muted, textAlign: 'center' },
  detailsScroll: { flex: 1 },
  audioPreviewCard: { borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)', marginBottom: 24 },
  audioPreviewInner: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  playIconBtn: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden' },
  playIconGrad: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  audioMiniWave: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2 },
  miniBar: { width: 3, backgroundColor: '#7c3aed', borderRadius: 2, opacity: 0.7 },
  audioDuration: { fontSize: 13, color: colors.muted, fontWeight: '600' },
  label: { fontSize: 13, color: colors.muted, marginBottom: 8, fontWeight: '500' },
  input: { backgroundColor: 'rgba(30,41,59,0.8)', borderWidth: 1, borderColor: colors.border2, borderRadius: radius.md, padding: 14, color: colors.text, fontSize: 14, marginBottom: 16 },
  textarea: { height: 100, textAlignVertical: 'top' },
  privacyRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  privacyTab: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: radius.md, backgroundColor: 'rgba(30,41,59,0.6)', borderWidth: 1, borderColor: colors.border2 },
  privacyTabActive: { backgroundColor: '#10b981', borderColor: '#10b981' },
  privacyText: { fontSize: 12, fontWeight: '600', color: colors.muted },
  postBtn: { borderRadius: radius.md, overflow: 'hidden' },
  postBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 },
  postBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
