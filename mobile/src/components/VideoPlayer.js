import { useRef, useState, useEffect, useCallback } from 'react';
import {
  View, TouchableOpacity, StyleSheet,
  Animated, Image, Dimensions,
} from 'react-native';
import AppText from './AppText';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');
const VIDEO_HEIGHT = width * (16 / 9);

import { toStreamableUri } from '../utils/cloudinary';

export default function VideoPlayer({
  uri,
  isVisible,
  liked, likeCount, onLike,
  onComment, commentCount,
  onShare,
  saved, onSave,
  authorName, authorAvatar,
  caption,
  feedMode = false,
  onPress,
}) {
  const { dataSaver } = useTheme();
  const videoRef = useRef(null);
  const [muted, setMuted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showCaption, setShowCaption] = useState(false);

  const heartScale = useRef(new Animated.Value(0)).current;
  const heartOpacity = useRef(new Animated.Value(0)).current;
  const iconAnim = useRef(new Animated.Value(0)).current;

  const onLoad = useCallback((status) => {
    if (status.isLoaded && isVisible && !paused && !dataSaver) {
      videoRef.current?.playAsync().catch(() => {});
    }
  }, [isVisible, paused, dataSaver]);

  useEffect(() => {
    if (!videoRef.current) return;
    if (isVisible && !paused && !dataSaver) {
      videoRef.current.playAsync().catch(() => {});
    } else {
      videoRef.current.pauseAsync().catch(() => {});
    }
  }, [isVisible, paused, dataSaver]);

  useEffect(() => {
    return () => {
      videoRef.current?.stopAsync().catch(() => {});
      videoRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  const flashIcon = () => {
    iconAnim.setValue(1);
    Animated.timing(iconAnim, { toValue: 0, duration: 700, useNativeDriver: true }).start();
  };

  const togglePlay = () => {
    setPaused(p => !p);
    flashIcon();
  };

  const handleDoubleTap = useRef(0);
  const onTap = () => {
    if (feedMode) { onPress?.(); return; }
    const now = Date.now();
    if (now - handleDoubleTap.current < 300) {
      if (!liked) { onLike?.(); burstHeart(); }
    } else {
      togglePlay();
    }
    handleDoubleTap.current = now;
  };

  const burstHeart = () => {
    heartScale.setValue(0);
    heartOpacity.setValue(1);
    Animated.parallel([
      Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, tension: 60, friction: 5 }),
      Animated.sequence([
        Animated.delay(400),
        Animated.timing(heartOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
    ]).start();
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
    <View style={s.container}>
      <Video
        ref={videoRef}
        source={{ uri: toStreamableUri(uri) }}
        style={s.video}
        resizeMode={ResizeMode.COVER}
        shouldPlay={false}
        isLooping
        isMuted={muted || dataSaver}
        volume={1.0}
        onPlaybackStatusUpdate={onPlaybackUpdate}
        onLoad={onLoad}
        useNativeControls={false}
      />

      {dataSaver && (
        <View style={s.dataSaverBanner} pointerEvents="none">
          <Ionicons name="cellular-outline" size={12} color="rgba(255,255,255,0.7)" />
          <AppText style={s.dataSaverText}>Data Saver · Tap to play</AppText>
        </View>
      )}

      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.25)', 'rgba(0,0,0,0.75)']}
        style={s.bottomGradient}
        pointerEvents="none"
      />

      <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onTap} activeOpacity={1} />

      <Animated.View
        style={[s.heartBurst, { opacity: heartOpacity, transform: [{ scale: heartScale }] }]}
        pointerEvents="none"
      >
        <Ionicons name="heart" size={90} color="#fff" />
      </Animated.View>

      <Animated.View style={[s.flashIcon, { opacity: iconAnim }]} pointerEvents="none">
        <Ionicons name={paused ? 'play' : 'pause'} size={32} color="#fff" />
      </Animated.View>

      <TouchableOpacity style={s.muteBtn} onPress={() => setMuted(m => !m)}>
        <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={18} color="#fff" />
      </TouchableOpacity>

      {!feedMode && (
        <View style={s.rightActions}>
          <TouchableOpacity style={s.actionItem} onPress={onLike}>
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={30} color={liked ? '#e11d48' : '#fff'} />
            <AppText style={s.actionCount}>{likeCount > 0 ? likeCount : ''}</AppText>
          </TouchableOpacity>
          <TouchableOpacity style={s.actionItem} onPress={onComment}>
            <Ionicons name="chatbubble-ellipses-outline" size={28} color="#fff" />
            <AppText style={s.actionCount}>{commentCount > 0 ? commentCount : ''}</AppText>
          </TouchableOpacity>
          <TouchableOpacity style={s.actionItem} onPress={onShare}>
            <Ionicons name="paper-plane-outline" size={27} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={s.actionItem} onPress={onSave}>
            <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={27} color={saved ? '#7c3aed' : '#fff'} />
          </TouchableOpacity>
        </View>
      )}

      {!feedMode && (
        <View style={s.bottomLeft}>
          <View style={s.authorRow}>
            <View style={s.avatarWrap}>
              {authorAvatar
                ? <Image source={{ uri: authorAvatar }} style={s.avatar} />
                : <View style={[s.avatar, s.avatarFallback]}>
                    <AppText style={s.avatarLetter}>{authorName?.[0]?.toUpperCase()}</AppText>
                  </View>}
            </View>
            <AppText style={s.authorName}>{authorName}</AppText>
          </View>
          {caption ? (
            <TouchableOpacity onPress={() => setShowCaption(v => !v)} activeOpacity={0.9}>
              <AppText style={s.caption} numberOfLines={showCaption ? undefined : 2}>{caption}</AppText>
              {caption.length > 80 && !showCaption && <AppText style={s.moreText}>more</AppText>}
            </TouchableOpacity>
          ) : null}
          <View style={s.progressRow}>
            <AppText style={s.timeText}>{fmt(progress)}</AppText>
            <View style={s.progressTrack}>
              <View style={[s.progressFill, { width: `${pct}%` }]} />
            </View>
            <AppText style={s.timeText}>{fmt(duration)}</AppText>
          </View>
        </View>
      )}

      {feedMode && (
        <View style={s.feedProgressRow} pointerEvents="none">
          <View style={s.progressTrack}>
            <View style={[s.progressFill, { width: `${pct}%` }]} />
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { width, height: VIDEO_HEIGHT, backgroundColor: '#000', position: 'relative', overflow: 'hidden' },
  video: { width: '100%', height: '100%' },
  bottomGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: VIDEO_HEIGHT * 0.55 },
  flashIcon: { position: 'absolute', top: '50%', left: '50%', marginTop: -28, marginLeft: -28, width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  heartBurst: { position: 'absolute', top: '50%', left: '50%', marginTop: -45, marginLeft: -45, alignItems: 'center', justifyContent: 'center' },
  muteBtn: { position: 'absolute', top: 14, right: 14, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  rightActions: { position: 'absolute', right: 12, bottom: 100, alignItems: 'center', gap: 20 },
  actionItem: { alignItems: 'center', gap: 4 },
  actionCount: { color: '#fff', fontSize: 12, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  bottomLeft: { position: 'absolute', bottom: 0, left: 0, right: 70, paddingHorizontal: 14, paddingBottom: 14, gap: 8 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatarWrap: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: '#fff', overflow: 'hidden' },
  avatar: { width: '100%', height: '100%' },
  avatarFallback: { backgroundColor: '#7c3aed', alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: '#fff', fontWeight: '700', fontSize: 13 },
  authorName: { color: '#fff', fontWeight: '700', fontSize: 14, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  caption: { color: 'rgba(255,255,255,0.9)', fontSize: 13, lineHeight: 18, textShadowColor: 'rgba(0,0,0,0.7)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  moreText: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressTrack: { flex: 1, height: 2, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 1, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#fff', borderRadius: 1 },
  timeText: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '600', minWidth: 36, textAlign: 'center' },
  dataSaverBanner: { position: 'absolute', top: 14, left: 14, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  dataSaverText: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '600' },
  feedProgressRow: { position: 'absolute', bottom: 0, left: 0, right: 0 },
});
