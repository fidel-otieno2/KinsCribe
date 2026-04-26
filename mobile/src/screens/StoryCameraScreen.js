import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, StyleSheet, TouchableOpacity, Dimensions,
  StatusBar, Animated, ScrollView,
} from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '../components/AppText';

const { width, height } = Dimensions.get('window');

const FLASH_MODES = ['off', 'on', 'auto'];
const FLASH_ICONS = { off: 'flash-off', on: 'flash', auto: 'flash-outline' };
const DURATIONS = [15, 45, 60];
const SPEEDS = [{ label: '0.5x', value: 0.5 }, { label: '1x', value: 1 }, { label: '2x', value: 2 }];

const EFFECTS = [
  { id: null,        label: 'Normal',  color: '#555',    icon: '○' },
  { id: 'vivid',     label: 'Vivid',   color: '#FF6B35', icon: '☀️' },
  { id: 'warm',      label: 'Warm',    color: '#F4A261', icon: '🌅' },
  { id: 'cool',      label: 'Cool',    color: '#457B9D', icon: '💧' },
  { id: 'bw',        label: 'B&W',     color: '#888',    icon: '◑' },
  { id: 'fade',      label: 'Fade',    color: '#A8DADC', icon: '🌫️' },
  { id: 'drama',     label: 'Drama',   color: '#6B2D8B', icon: '⚡' },
  { id: 'golden',    label: 'Golden',  color: '#FFD700', icon: '✨' },
  { id: 'neon',      label: 'Neon',    color: '#39FF14', icon: '🟢' },
  { id: 'vintage',   label: 'Vintage', color: '#C9A96E', icon: '📷' },
  { id: 'cinematic', label: 'Cinema',  color: '#1a1a2e', icon: '🎥' },
  { id: 'sunset',    label: 'Sunset',  color: '#FF4500', icon: '🌄' },
];

export default function StoryCameraScreen({ navigation, route }) {
  const { selectedMusic } = route?.params || {};
  const insets = useSafeAreaInsets();

  const [camPerm, requestCamPerm] = useCameraPermissions();
  const [micPerm, requestMicPerm] = useMicrophonePermissions();

  const cameraRef = useRef(null);
  const isRecordingRef = useRef(false);

  const [facing, setFacing] = useState('back');
  const [flashMode, setFlashMode] = useState('off');
  const [flashIndex, setFlashIndex] = useState(0);
  const [zoom, setZoom] = useState(0);
  const [mode, setMode] = useState('photo');

  const [timerSec, setTimerSec] = useState(0);
  const [timerCountdown, setTimerCountdown] = useState(null);

  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [maxDuration, setMaxDuration] = useState(45);
  const [speed, setSpeed] = useState(1);
  const [showDurationPicker, setShowDurationPicker] = useState(false);
  const [showSpeedPicker, setShowSpeedPicker] = useState(false);
  const [showEffects, setShowEffects] = useState(false);
  const [selectedEffect, setSelectedEffect] = useState(null);

  const elapsedRef = useRef(null);
  const recordBtnScale = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      if (!camPerm?.granted) await requestCamPerm();
      if (!micPerm?.granted) await requestMicPerm();
    })();
  }, [camPerm?.granted, micPerm?.granted]);

  useEffect(() => {
    if (recording && !paused) {
      elapsedRef.current = setInterval(() => {
        setElapsed(e => {
          if (e + 1 >= maxDuration) {
            stopRecording();
            return e;
          }
          return e + 1;
        });
      }, 1000);
    } else {
      clearInterval(elapsedRef.current);
    }
    return () => clearInterval(elapsedRef.current);
  }, [recording, paused]);

  useEffect(() => {
    if (recording && !paused) {
      Animated.timing(progressAnim, {
        toValue: elapsed / maxDuration,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  }, [elapsed, recording, paused]);

  const flipCamera = () => setFacing(f => f === 'back' ? 'front' : 'back');

  const cycleFlash = () => {
    const next = (flashIndex + 1) % FLASH_MODES.length;
    setFlashIndex(next);
    setFlashMode(FLASH_MODES[next]);
  };

  const runTimer = (action) => {
    if (timerSec === 0) { action(); return; }
    let count = timerSec;
    setTimerCountdown(count);
    const interval = setInterval(() => {
      count -= 1;
      if (count <= 0) {
        clearInterval(interval);
        setTimerCountdown(null);
        action();
      } else {
        setTimerCountdown(count);
      }
    }, 1000);
  };

  const takePhoto = useCallback(() => {
    runTimer(async () => {
      try {
        const photo = await cameraRef.current?.takePictureAsync({ quality: 0.92 });
        if (photo?.uri) {
          navigation.navigate('Create', {
            initialMode: 'story',
            capturedMedia: { uri: photo.uri, type: 'image', effect: selectedEffect },
          });
        }
      } catch (e) {
        console.log('Photo error:', e?.message);
      }
    });
  }, [timerSec, selectedEffect]);

  const startRecording = useCallback(async () => {
    if (isRecordingRef.current) return;
    if (!cameraRef.current) return;
    isRecordingRef.current = true;
    setElapsed(0);
    progressAnim.setValue(0);
    setRecording(true);
    setPaused(false);
    Animated.spring(recordBtnScale, { toValue: 0.75, useNativeDriver: true }).start();
    try {
      // wait for CameraView to switch to video mode
      await new Promise(r => setTimeout(r, 400));
      const video = await cameraRef.current.recordAsync({ maxDuration });
      if (video?.uri) {
        navigation.navigate('Create', {
          initialMode: 'story',
          capturedMedia: { uri: video.uri, type: 'video', effect: selectedEffect },
        });
      }
    } catch (e) {
      console.log('Recording error:', e?.message || e);
    } finally {
      isRecordingRef.current = false;
      setRecording(false);
      setPaused(false);
      setElapsed(0);
      progressAnim.setValue(0);
      Animated.spring(recordBtnScale, { toValue: 1, useNativeDriver: true }).start();
    }
  }, [maxDuration, selectedEffect]);

  const stopRecording = useCallback(() => {
    if (!isRecordingRef.current) return;
    cameraRef.current?.stopRecording();
  }, []);

  const togglePause = () => setPaused(p => !p);

  const startRecordingRef = useRef(startRecording);
  const stopRecordingRef = useRef(stopRecording);
  useEffect(() => { startRecordingRef.current = startRecording; }, [startRecording]);
  useEffect(() => { stopRecordingRef.current = stopRecording; }, [stopRecording]);

  const handleRecordPressIn = () => {
    if (mode === 'video' && !isRecordingRef.current) startRecordingRef.current();
  };

  const handleRecordPressOut = () => {
    if (mode === 'video' && isRecordingRef.current) stopRecordingRef.current();
  };

  const handlePhotoPress = () => {
    if (mode === 'photo') takePhoto();
  };

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  if (!camPerm) return <View style={st.container} />;

  if (!camPerm.granted) {
    return (
      <View style={[st.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <Ionicons name="videocam-off-outline" size={48} color="#fff" />
        <AppText style={{ color: '#fff', marginTop: 12, textAlign: 'center', paddingHorizontal: 32 }}>
          Camera permission is required.{'\n'}Enable it in your device settings.
        </AppText>
        <TouchableOpacity style={st.permBtn} onPress={requestCamPerm}>
          <AppText style={{ color: '#fff', fontWeight: '700' }}>Grant Permission</AppText>
        </TouchableOpacity>
      </View>
    );
  }

  if (micPerm && !micPerm.granted) {
    return (
      <View style={[st.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <Ionicons name="mic-off-outline" size={48} color="#fff" />
        <AppText style={{ color: '#fff', marginTop: 12, textAlign: 'center', paddingHorizontal: 32 }}>
          Microphone permission is required for video.{'\n'}Enable it in your device settings.
        </AppText>
        <TouchableOpacity style={st.permBtn} onPress={requestMicPerm}>
          <AppText style={{ color: '#fff', fontWeight: '700' }}>Grant Microphone Access</AppText>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={st.container}>
      <StatusBar hidden />

      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        flash={flashMode}
        zoom={zoom}
        mode={mode}
      />

      {/* TOP BAR */}
      <LinearGradient
        colors={['rgba(0,0,0,0.6)', 'transparent']}
        style={[st.topGrad, { paddingTop: insets.top + 8 }]}
      >
        <TouchableOpacity style={st.iconBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={26} color="#fff" />
        </TouchableOpacity>

        <View style={st.topCenter}>
          {recording && (
            <View style={st.recTimer}>
              <View style={st.recDot} />
              <AppText style={st.recTimerText}>{fmt(elapsed)} / {fmt(maxDuration)}</AppText>
            </View>
          )}
          {selectedMusic && (
            <View style={st.musicPill}>
              <Ionicons name="musical-notes" size={11} color="#fff" />
              <AppText style={st.musicPillText} numberOfLines={1}>{selectedMusic.title}</AppText>
            </View>
          )}
        </View>

        <View style={{ width: 40 }} />
      </LinearGradient>

      {/* PROGRESS BAR */}
      {mode === 'video' && (
        <View style={st.progressTrack}>
          <Animated.View style={[st.progressFill, {
            width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          }]} />
        </View>
      )}

      {/* RIGHT STRIP */}
      <View style={[st.rightStrip, { top: insets.top + 80 }]}>
        <TouchableOpacity style={st.rightBtn} onPress={flipCamera}>
          <Ionicons name="camera-reverse-outline" size={26} color="#fff" />
          <AppText style={st.rightBtnLabel}>Flip</AppText>
        </TouchableOpacity>

        <TouchableOpacity style={st.rightBtn} onPress={cycleFlash}>
          <Ionicons name={FLASH_ICONS[flashMode]} size={26} color={flashMode === 'on' ? '#FFD700' : '#fff'} />
          <AppText style={[st.rightBtnLabel, flashMode === 'on' && { color: '#FFD700' }]}>
            {flashMode === 'off' ? 'Off' : flashMode === 'on' ? 'On' : 'Auto'}
          </AppText>
        </TouchableOpacity>

        <TouchableOpacity
          style={st.rightBtn}
          onPress={() => {
            const opts = [0, 3, 10];
            setTimerSec(opts[(opts.indexOf(timerSec) + 1) % opts.length]);
          }}
        >
          <Ionicons name="timer-outline" size={26} color={timerSec > 0 ? '#FFD700' : '#fff'} />
          <AppText style={[st.rightBtnLabel, timerSec > 0 && { color: '#FFD700' }]}>
            {timerSec === 0 ? 'Off' : `${timerSec}s`}
          </AppText>
        </TouchableOpacity>

        {mode === 'video' && (
          <TouchableOpacity
            style={st.rightBtn}
            onPress={() => {
              const opts = [0.5, 1, 2];
              setSpeed(opts[(opts.indexOf(speed) + 1) % opts.length]);
            }}
          >
            <Ionicons name="speedometer-outline" size={26} color={speed !== 1 ? '#FFD700' : '#fff'} />
            <AppText style={[st.rightBtnLabel, speed !== 1 && { color: '#FFD700' }]}>{speed}x</AppText>
          </TouchableOpacity>
        )}

        {mode === 'video' && (
          <TouchableOpacity
            style={st.rightBtn}
            onPress={() => {
              const idx = DURATIONS.indexOf(maxDuration);
              setMaxDuration(DURATIONS[(idx + 1) % DURATIONS.length]);
            }}
          >
            <Ionicons name="time-outline" size={26} color="#fff" />
            <AppText style={st.rightBtnLabel}>{maxDuration}s</AppText>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={st.rightBtn} onPress={() => setShowEffects(p => !p)}>
          <Ionicons name="color-wand-outline" size={26} color={selectedEffect ? '#FFD700' : '#fff'} />
          <AppText style={[st.rightBtnLabel, selectedEffect && { color: '#FFD700' }]}>
            {selectedEffect ? EFFECTS.find(e => e.id === selectedEffect)?.label : 'Effects'}
          </AppText>
        </TouchableOpacity>
      </View>

      {/* COUNTDOWN */}
      {timerCountdown !== null && (
        <View style={st.countdownOverlay}>
          <AppText style={st.countdownText}>{timerCountdown}</AppText>
        </View>
      )}

      {/* BOTTOM CONTROLS */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.8)']}
        style={[st.bottomGrad, { paddingBottom: insets.bottom + 16 }]}
      >
        {/* Mode toggle */}
        <View style={st.optionsRow}>
          <View style={st.modeToggle}>
            {['photo', 'video'].map(m => (
              <TouchableOpacity
                key={m}
                style={[st.modeBtn, mode === m && st.modeBtnActive]}
                onPress={() => { if (!isRecordingRef.current) setMode(m); }}
              >
                <AppText style={[st.modeBtnText, mode === m && st.modeBtnTextActive]}>
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </AppText>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Effects panel */}
        {showEffects && (
          <View style={st.effectsPanel}>
            <View style={st.effectsHeader}>
              <AppText style={st.effectsTitle}>Effects</AppText>
              <TouchableOpacity onPress={() => setShowEffects(false)}>
                <Ionicons name="close" size={18} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.effectsRow}>
              {EFFECTS.map(effect => (
                <TouchableOpacity
                  key={String(effect.id)}
                  style={[st.effectItem, selectedEffect === effect.id && st.effectItemActive]}
                  onPress={() => { setSelectedEffect(effect.id); setShowEffects(false); }}
                >
                  <View style={[st.effectCircle, { backgroundColor: effect.color },
                    selectedEffect === effect.id && { borderColor: '#FFD700', borderWidth: 2.5 }
                  ]}>
                    <AppText style={st.effectIcon}>{effect.icon}</AppText>
                  </View>
                  <AppText style={[st.effectLabel, selectedEffect === effect.id && { color: '#FFD700', fontWeight: '800' }]}>
                    {effect.label}
                  </AppText>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Active effect pill */}
        {selectedEffect && !showEffects && (
          <TouchableOpacity style={st.activeEffectPill} onPress={() => setShowEffects(true)}>
            <Ionicons name="color-wand" size={12} color="#FFD700" />
            <AppText style={st.activeEffectPillText}>
              {EFFECTS.find(e => e.id === selectedEffect)?.label}
            </AppText>
            <TouchableOpacity onPress={() => setSelectedEffect(null)}>
              <Ionicons name="close" size={12} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </TouchableOpacity>
        )}

        {/* Main controls */}
        <View style={st.controlsRow}>
          {/* Left: effects shortcut */}
          <TouchableOpacity style={st.sideBtn} onPress={() => setShowEffects(p => !p)}>
            <Ionicons name="color-wand-outline" size={24} color={selectedEffect ? '#FFD700' : '#fff'} />
          </TouchableOpacity>

          {/* Centre: shutter / record */}
          <Animated.View style={{ transform: [{ scale: recordBtnScale }] }}>
            <TouchableOpacity
              style={[st.shutterOuter, mode === 'video' && recording && st.shutterOuterRecording]}
              onPress={mode === 'photo' ? handlePhotoPress : undefined}
              onPressIn={mode === 'video' ? handleRecordPressIn : undefined}
              onPressOut={mode === 'video' ? handleRecordPressOut : undefined}
              activeOpacity={0.85}
            >
              {mode === 'video' ? (
                recording
                  ? <View style={st.stopSquare} />
                  : <View style={st.recordCircle} />
              ) : (
                <View style={st.shutterInner} />
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* Right: flip / pause */}
          {recording ? (
            <TouchableOpacity style={st.sideBtn} onPress={togglePause}>
              <Ionicons name={paused ? 'play' : 'pause'} size={24} color="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={st.sideBtn} onPress={flipCamera}>
              <Ionicons name="camera-reverse-outline" size={24} color="#fff" />
            </TouchableOpacity>
          )}
        </View>

        {/* Zoom slider */}
        <View style={st.zoomRow}>
          <AppText style={st.zoomLabel}>1x</AppText>
          <View style={st.zoomTrack}>
            <View style={[st.zoomFill, { width: `${zoom * 100}%` }]} />
          </View>
          <AppText style={st.zoomLabel}>5x</AppText>
        </View>
      </LinearGradient>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  topGrad: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 16, zIndex: 10,
  },
  topCenter: { flex: 1, alignItems: 'center', gap: 6 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  recTimer: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#e11d48' },
  recTimerText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  musicPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  musicPillText: { color: '#fff', fontSize: 11, maxWidth: 140 },

  progressTrack: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: 4, backgroundColor: 'rgba(255,255,255,0.2)', zIndex: 20,
  },
  progressFill: { height: '100%', backgroundColor: '#e11d48' },

  rightStrip: {
    position: 'absolute', right: 12,
    alignItems: 'center', gap: 22, zIndex: 10,
  },
  rightBtn: { alignItems: 'center', gap: 4 },
  rightBtnLabel: {
    color: '#fff', fontSize: 10, fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },

  countdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 30,
  },
  countdownText: {
    fontSize: 96, fontWeight: '900', color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8,
  },

  bottomGrad: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingTop: 40, paddingHorizontal: 20, gap: 14, zIndex: 10,
  },
  optionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20, padding: 3,
  },
  modeBtn: { paddingHorizontal: 18, paddingVertical: 6, borderRadius: 17 },
  modeBtnActive: { backgroundColor: '#fff' },
  modeBtnText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600' },
  modeBtnTextActive: { color: '#000' },

  effectsPanel: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 16, padding: 12,
  },
  effectsHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  effectsTitle: { color: '#fff', fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  effectsRow: { gap: 14, paddingHorizontal: 4 },
  effectItem: { alignItems: 'center', gap: 5 },
  effectItemActive: { transform: [{ scale: 1.1 }] },
  effectCircle: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)',
  },
  effectIcon: { fontSize: 22 },
  effectLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: '600' },

  activeEffectPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.4)',
  },
  activeEffectPillText: { color: '#FFD700', fontSize: 12, fontWeight: '700' },

  controlsRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 20,
  },
  sideBtn: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  shutterOuter: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 4, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  shutterOuterRecording: { borderColor: '#e11d48' },
  shutterInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#fff' },
  recordCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#e11d48' },
  stopSquare: { width: 30, height: 30, borderRadius: 6, backgroundColor: '#e11d48' },

  zoomRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10,
  },
  zoomLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600', width: 22 },
  zoomTrack: {
    flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 2,
  },
  zoomFill: { height: '100%', backgroundColor: '#fff', borderRadius: 2 },

  permBtn: {
    marginTop: 20, backgroundColor: '#2D5A27',
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24,
  },
});
