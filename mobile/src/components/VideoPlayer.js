import { useEffect, useState } from 'react';
import { useVideoPlayer, VideoView } from 'expo-video';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function VideoPlayer({ uri, isVisible }) {
  const [muted, setMuted] = useState(true);

  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
  });

  useEffect(() => {
    if (!player) return;
    const timer = setTimeout(() => {
      try {
        player.muted = muted;
        if (isVisible) player.play();
        else { player.pause(); }
      } catch {}
    }, 300);
    return () => clearTimeout(timer);
  }, [isVisible, player]);

  useEffect(() => {
    if (!player) return;
    try { player.muted = muted; } catch {}
  }, [muted, player]);

  const toggleMute = () => setMuted(m => !m);

  return (
    <View style={s.wrap}>
      <VideoView
        player={player}
        style={s.media}
        contentFit="cover"
        nativeControls={false}
      />
      <TouchableOpacity style={s.muteBtn} onPress={toggleMute} activeOpacity={0.8}>
        <View style={s.muteBtnInner}>
          <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={16} color="#fff" />
        </View>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { width: '100%', height: 400, position: 'relative' },
  media: { width: '100%', height: '100%' },
  muteBtn: { position: 'absolute', bottom: 12, right: 12 },
  muteBtnInner: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
});
