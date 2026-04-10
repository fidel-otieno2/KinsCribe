import { useEffect, useState, useRef } from 'react';
import { useVideoPlayer, VideoView } from 'expo-video';
import { StyleSheet, TouchableOpacity, View, Text, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function VideoPlayer({ uri, isVisible }) {
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const iconAnim = useRef(new Animated.Value(0)).current;

  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
  });

  // auto-play / pause based on visibility
  useEffect(() => {
    if (!player) return;
    const t = setTimeout(() => {
      try {
        player.muted = muted;
        if (isVisible && !paused) player.play();
        else player.pause();
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [isVisible, player]);

  // sync mute
  useEffect(() => {
    if (!player) return;
    try { player.muted = muted; } catch {}
  }, [muted, player]);

  // poll progress
  useEffect(() => {
    if (!player) return;
    const id = setInterval(() => {
      try {
        const pos = player.currentTime ?? 0;
        const dur = player.duration ?? 0;
        setProgress(pos);
        setDuration(dur);
      } catch {}
    }, 500);
    return () => clearInterval(id);
  }, [player]);

  const flashIcon = () => {
    iconAnim.setValue(1);
    Animated.timing(iconAnim, { toValue: 0, duration: 600, useNativeDriver: true }).start();
  };

  const togglePlay = () => {
    if (!player) return;
    try {
      if (paused) { player.play(); setPaused(false); }
      else { player.pause(); setPaused(true); }
      flashIcon();
    } catch {}
  };

  const pct = duration > 0 ? (progress / duration) * 100 : 0;
  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  return (
    <View style={s.wrap}>
      <VideoView player={player} style={s.media} contentFit="cover" nativeControls={false} />

      {/* tap overlay */}
      <TouchableOpacity style={StyleSheet.absoluteFill} onPress={togglePlay} activeOpacity={1} />

      {/* flash icon */}
      <Animated.View style={[s.flashIcon, { opacity: iconAnim }]} pointerEvents="none">
        <Ionicons name={paused ? 'play' : 'pause'} size={40} color="#fff" />
      </Animated.View>

      {/* bottom controls */}
      <View style={s.controls}>
        {/* progress bar */}
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
