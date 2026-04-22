import { useState, useEffect, useRef } from 'react';
import { View, Image, StyleSheet, TouchableOpacity, Animated, Pressable } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AppText from './AppText';
import { colors, gradients, radius } from '../theme';

// ── Text Bubble ──────────────────────────────────────────────────────────────
export function TextBubble({ text, isMe }) {
  return (
    <View style={[bs.bubble, isMe ? bs.bubbleMe : bs.bubbleThem]}>
      <AppText style={[bs.text, isMe ? bs.textMe : bs.textThem]}>{text}</AppText>
    </View>
  );
}

// ── Image Bubble ─────────────────────────────────────────────────────────────
export function ImageBubble({ uri, isMe }) {
  const [ratio, setRatio] = useState(1.2);
  const [loaded, setLoaded] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    Image.getSize(uri, (w, h) => setRatio(w / h), () => setRatio(1.2));
  }, [uri]);

  const onLoad = () => {
    setLoaded(true);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 8, useNativeDriver: true }),
    ]).start();
  };

  return (
    <View style={[bs.mediaBubble, isMe ? bs.mediaBubbleMe : bs.mediaBubbleThem]}>
      {!loaded && (
        <View style={[bs.imagePlaceholder, { aspectRatio: ratio }]}>
          <LinearGradient
            colors={['rgba(74,124,63,0.08)', 'rgba(74,124,63,0.02)']}
            style={StyleSheet.absoluteFill}
          />
          <Ionicons name="image-outline" size={30} color={colors.dim} />
        </View>
      )}
      <Animated.Image
        source={{ uri }}
        style={[bs.image, { aspectRatio: ratio, opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}
        resizeMode="cover"
        onLoad={onLoad}
      />
    </View>
  );
}

// ── Video Bubble ─────────────────────────────────────────────────────────────
export function VideoBubble({ uri, isMe }) {
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(false);

  return (
    <View style={[bs.mediaBubble, isMe ? bs.mediaBubbleMe : bs.mediaBubbleThem]}>
      <View style={bs.videoWrap}>
        <Video
          ref={videoRef}
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          resizeMode={ResizeMode.COVER}
          useNativeControls
          onPlaybackStatusUpdate={s => setPlaying(s.isPlaying)}
        />
        {!playing && (
          <View style={bs.videoPlayOverlay}>
            <LinearGradient
              colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.55)']}
              style={StyleSheet.absoluteFill}
            />
            <View style={bs.videoPlayBtn}>
              <LinearGradient colors={gradients.primary} style={bs.videoPlayGrad}>
                <Ionicons name="play" size={20} color="#fff" style={{ marginLeft: 2 }} />
              </LinearGradient>
            </View>
            <View style={bs.videoDurationBadge}>
              <Ionicons name="videocam" size={10} color="rgba(255,255,255,0.8)" />
              <AppText style={bs.videoDurationText}>Video</AppText>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

// ── Voice Bubble ─────────────────────────────────────────────────────────────
const SPEEDS = [1, 1.5, 2];
const BARS = 32;

export function VoiceBubble({ uri, isMe }) {
  const [sound, setSound] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [speedIdx, setSpeedIdx] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const barAnims = useRef([...Array(BARS)].map(() => new Animated.Value(0.35))).current;
  const animLoopRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => () => { sound?.unloadAsync(); }, [sound]);

  const startBarAnim = () => {
    animLoopRef.current = Animated.loop(
      Animated.stagger(35,
        barAnims.map(a =>
          Animated.sequence([
            Animated.timing(a, { toValue: 0.6 + Math.random() * 0.4, duration: 180 + Math.random() * 220, useNativeDriver: true }),
            Animated.timing(a, { toValue: 0.2 + Math.random() * 0.2, duration: 180 + Math.random() * 220, useNativeDriver: true }),
          ])
        )
      )
    );
    animLoopRef.current.start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    ).start();
  };

  const stopBarAnim = () => {
    animLoopRef.current?.stop();
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
    barAnims.forEach(a => a.setValue(0.35));
  };

  const toggle = async () => {
    if (!sound) {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, allowsRecordingIOS: false });
        const { sound: s, status } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: true, rate: SPEEDS[speedIdx], shouldCorrectPitch: true },
          (st) => {
            if (st.isLoaded) {
              setPosition(st.positionMillis || 0);
              setDuration(st.durationMillis || 0);
              setLoaded(true);
              if (st.didJustFinish) {
                setPlaying(false);
                setPosition(0);
                stopBarAnim();
              }
            }
          }
        );
        setSound(s);
        setPlaying(true);
        startBarAnim();
        if (status.durationMillis) setDuration(status.durationMillis);
      } catch {}
    } else if (playing) {
      await sound.pauseAsync();
      setPlaying(false);
      stopBarAnim();
    } else {
      await sound.playAsync();
      setPlaying(true);
      startBarAnim();
    }
  };

  const cycleSpeed = async () => {
    const next = (speedIdx + 1) % SPEEDS.length;
    setSpeedIdx(next);
    if (sound) await sound.setRateAsync(SPEEDS[next], true);
  };

  const fmtMs = (ms) => {
    const s = Math.floor((ms || 0) / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };

  const progress = duration > 0 ? position / duration : 0;
  const activeColor = isMe ? 'rgba(255,255,255,0.95)' : colors.primary;
  const inactiveColor = isMe ? 'rgba(255,255,255,0.22)' : 'rgba(74,124,63,0.22)';

  return (
    <View style={[bs.voiceBubble, isMe ? bs.bubbleMe : bs.bubbleThem]}>
      {/* Play/Pause Button */}
      <Animated.View style={{ transform: [{ scale: playing ? pulseAnim : 1 }] }}>
        <TouchableOpacity
          onPress={toggle}
          style={[bs.voicePlayBtn, isMe ? bs.voicePlayBtnMe : bs.voicePlayBtnThem]}
          activeOpacity={0.8}
        >
          {isMe ? (
            <Ionicons name={playing ? 'pause' : 'play'} size={15} color={colors.primary} style={!playing && { marginLeft: 2 }} />
          ) : (
            <LinearGradient colors={gradients.primary} style={bs.voicePlayGrad}>
              <Ionicons name={playing ? 'pause' : 'play'} size={15} color="#fff" style={!playing && { marginLeft: 2 }} />
            </LinearGradient>
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* Waveform + Footer */}
      <View style={bs.waveformWrap}>
        <View style={bs.waveform}>
          {barAnims.map((anim, i) => {
            const baseH = 3 + Math.abs(Math.sin(i * 0.75) * 11 + Math.cos(i * 0.45) * 7);
            const filled = i / BARS <= progress;
            return (
              <Animated.View
                key={i}
                style={[
                  bs.waveBar,
                  {
                    height: baseH,
                    backgroundColor: filled ? activeColor : inactiveColor,
                    transform: [{ scaleY: playing ? anim : 1 }],
                  },
                ]}
              />
            );
          })}
        </View>

        {/* Progress track */}
        <View style={bs.progressTrack}>
          <View style={[bs.progressFill, {
            width: `${Math.round(progress * 100)}%`,
            backgroundColor: isMe ? 'rgba(255,255,255,0.4)' : colors.primaryLight,
          }]} />
        </View>

        <View style={bs.voiceFooter}>
          <AppText style={[bs.voiceTime, { color: isMe ? 'rgba(255,255,255,0.55)' : colors.muted }]}>
            {fmtMs(position > 0 ? position : duration)}
          </AppText>
          <TouchableOpacity onPress={cycleSpeed} style={[bs.speedBtn, {
            backgroundColor: isMe ? 'rgba(255,255,255,0.15)' : 'rgba(74,124,63,0.15)',
          }]}>
            <AppText style={[bs.speedText, { color: isMe ? 'rgba(255,255,255,0.8)' : colors.primary }]}>
              {SPEEDS[speedIdx]}×
            </AppText>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const bs = StyleSheet.create({
  // Text bubble
  bubble: {
    maxWidth: '75%',
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  bubbleMe: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
    borderTopRightRadius: 18,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
    alignSelf: 'flex-end',
  },
  bubbleThem: {
    backgroundColor: colors.bgCard,
    borderBottomLeftRadius: 4,
    borderTopRightRadius: 18,
    borderTopLeftRadius: 18,
    borderBottomRightRadius: 18,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  textMe: { color: '#fff' },
  textThem: { color: colors.text },

  // Media bubble — fixed 220px wide, aspect-ratio-driven height
  mediaBubble: {
    width: 220,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  mediaBubbleMe: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  mediaBubbleThem: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  imagePlaceholder: {
    width: '100%',
    backgroundColor: colors.bgSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: '100%' },

  // Video
  videoWrap: { width: '100%', aspectRatio: 4 / 5, backgroundColor: '#0a0a0a' },
  videoPlayOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  videoPlayBtn: { width: 56, height: 56, borderRadius: 28, overflow: 'hidden' },
  videoPlayGrad: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  videoDurationBadge: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  videoDurationText: { fontSize: 10, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },

  // Voice — horizontal bar, never taller than needed
  voiceBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    maxWidth: '75%',
    minWidth: 200,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  voicePlayBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  voicePlayBtnMe: { backgroundColor: 'rgba(255,255,255,0.92)' },
  voicePlayBtnThem: { overflow: 'hidden' },
  voicePlayGrad: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  waveformWrap: { flex: 1, gap: 5 },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2.5,
    height: 32,
  },
  waveBar: {
    width: 3,
    borderRadius: 2,
    minHeight: 3,
  },
  progressTrack: {
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 1,
  },
  voiceFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  voiceTime: { fontSize: 10, fontWeight: '600' },
  speedBtn: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  speedText: { fontSize: 10, fontWeight: '800' },
});
