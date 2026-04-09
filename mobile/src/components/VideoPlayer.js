import { useEffect } from 'react';
import { useVideoPlayer, VideoView } from 'expo-video';
import { StyleSheet } from 'react-native';

export default function VideoPlayer({ uri, isVisible }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
  });

  useEffect(() => {
    if (!player) return;
    const timer = setTimeout(() => {
      try {
        if (isVisible) player.play();
        else player.pause();
      } catch {}
    }, 300);
    return () => clearTimeout(timer);
  }, [isVisible, player]);

  return (
    <VideoView
      player={player}
      style={s.media}
      contentFit="cover"
      nativeControls={false}
    />
  );
}

const s = StyleSheet.create({
  media: { width: '100%', height: 400 },
});
