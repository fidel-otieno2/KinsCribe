import { useRef, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Text, Animated } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

export default function VideoPlayer({ uri, isVisible }) {
  const videoRef = useRef(null);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const iconAnim = useRef(new Animated.Value(0)).current;

  const flashIcon = () => {
    iconAnim.setValue(1);
    Animated.timing(iconAnim, { toValue: 0, duration: 600, useNativeDriver: true }).start();
  };

  const togglePlay = async () => {
    if (!videoRef.current) return;
    if (paused) {
      await videoRef.current.playAsync();
      setPaused(false);
    } else {
      await videoRef.current.pauseAsync();
      setPaused(true);
    }
    flashIcon();
  };

  const onPlaybackUpdate = (status) => {
    if (status.isLoaded) {
      setProgress(status.positionMillis || 0);
      setDuration(status.durationMillis || 0);
    }
  };

  const pct = duration > 0 ? (progress / duration) * 100 : 0;
  const fmt = (ms) => {
    const s = Math.floor(ms / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };

  return (
    <View style={s.wrap}>
      <Video
        ref={videoRef}
        source={{ uri }}
        style={s.media}
        resizeMode={ResizeMode.COVER}
        shouldPlay={isVisible && !paused}
        isLooping
        isMuted={muted}
        onPlaybackStatusUpdate={onPlaybackUpdate}
      />

      <TouchableOpacity style={StyleSheet.absoluteFill} onPress={togglePlay} activeOpacity={1} />

      <Animated.View style={[s.flashIcon, { opacity: iconAnim }]} pointerEvents="none">
        <Ionicons name={paused ? 'play' : 'pause'} size={40} color="#fff" />
      </Animated.View>

      <View style={s.controls}>
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: `${pct}%` }]} />
        </View>
        <View style={s.controlsRow}>
          <Text style={s.timeText}>{fmt(progress)} / {fmt(duration)}</Text>
          <TouchableOpacity onPress={() => setMuted(m => !m)} style={s.muteBtn}>
            <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { width: '100%', height: 420, backgroundColor: '#000', position: 'relative' },
  media: { width: '100%', height: '100%' },
  flashIcon: {
    position: 'absolute', top: '50%', left: '50%',
    marginTop: -24, marginLeft: -24,
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  controls: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 12, paddingBottom: 10,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  progressTrack: { height: 2, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 1, marginBottom: 6, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#7c3aed', borderRadius: 1 },
  controlsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timeText: { fontSize: 11, color: 'rgba(255,255,255,0.75)' },
  muteBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
});
