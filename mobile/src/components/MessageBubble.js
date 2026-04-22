import { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, StyleSheet, Image, TouchableOpacity, Animated,
  Modal, Pressable, Dimensions, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Video, ResizeMode } from 'expo-av';
import { Audio } from 'expo-av';
import AppText from './AppText';
import { colors, gradients } from '../theme';
import api from '../api/axios';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const SPEEDS = [1, 1.5, 2];
const BARS = 28;

function timeStr(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function MentionText({ text, isMe }) {
  if (!text) return null;
  const parts = String(text).split(/(@\w+)/g);
  return (
    <AppText style={[s.text, isMe ? s.textMe : s.textThem]}>
      {parts.map((p, idx) => (
        /^@\w+/.test(p)
          ? <AppText key={idx} style={[s.text, isMe ? s.textMe : s.textThem, s.mention]}>{p}</AppText>
          : p
      ))}
    </AppText>
  );
}

// ── Fullscreen Image Viewer ───────────────────────────────────────────────────
function ImageViewer({ uri, onClose }) {
  return (
    <Modal visible animationType="fade" transparent statusBarTranslucent>
      <View style={s.imgViewerBg}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Image source={{ uri }} style={s.imgViewerImg} resizeMode="contain" />
        <TouchableOpacity style={s.imgViewerClose} onPress={onClose}>
          <Ionicons name="close" size={26} color="#fff" />
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ── Inline Video Player ───────────────────────────────────────────────────────
function VideoPlayer({ uri }) {
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(false);

  const toggle = () => {
    if (playing) {
      videoRef.current?.pauseAsync();
    } else {
      videoRef.current?.playAsync();
    }
    setPlaying(p => !p);
  };

  return (
    <TouchableOpacity activeOpacity={1} onPress={toggle} style={s.videoWrap}>
      <Video
        ref={videoRef}
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        resizeMode={ResizeMode.COVER}
        isLooping
        onPlaybackStatusUpdate={st => {
          if (st.isLoaded) setPlaying(st.isPlaying);
        }}
      />
      {!playing && (
        <View style={s.videoOverlay}>
          <View style={s.videoPlayBtn}>
            <LinearGradient colors={gradients.primary} style={s.videoPlayGrad}>
              <Ionicons name="play" size={18} color="#fff" style={{ marginLeft: 2 }} />
            </LinearGradient>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── Voice Player — entire row is tappable ─────────────────────────────────────
function VoicePlayer({ uri, isMe }) {
  const [sound, setSound] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speedIdx, setSpeedIdx] = useState(0);
  const barAnims = useRef([...Array(BARS)].map(() => new Animated.Value(0.35))).current;
  const animRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => () => { sound?.unloadAsync(); }, [sound]);

  const startAnim = () => {
    animRef.current = Animated.loop(
      Animated.stagger(30, barAnims.map(a =>
        Animated.sequence([
          Animated.timing(a, { toValue: 0.5 + Math.random() * 0.5, duration: 160 + Math.random() * 200, useNativeDriver: true }),
          Animated.timing(a, { toValue: 0.2 + Math.random() * 0.2, duration: 160 + Math.random() * 200, useNativeDriver: true }),
        ])
      ))
    );
    animRef.current.start();
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.1, duration: 500, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
    ])).start();
  };

  const stopAnim = () => {
    animRef.current?.stop();
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
          st => {
            if (st.isLoaded) {
              setPosition(st.positionMillis || 0);
              setDuration(st.durationMillis || 0);
              if (st.didJustFinish) { setPlaying(false); setPosition(0); stopAnim(); }
            }
          }
        );
        setSound(s);
        setPlaying(true);
        startAnim();
        if (status.durationMillis) setDuration(status.durationMillis);
      } catch {}
    } else if (playing) {
      await sound.pauseAsync(); setPlaying(false); stopAnim();
    } else {
      await sound.playAsync(); setPlaying(true); startAnim();
    }
  };

  const cycleSpeed = async (e) => {
    e.stopPropagation?.();
    const next = (speedIdx + 1) % SPEEDS.length;
    setSpeedIdx(next);
    if (sound) await sound.setRateAsync(SPEEDS[next], true);
  };

  const progress = duration > 0 ? position / duration : 0;
  const fmtMs = ms => {
    const sec = Math.floor((ms || 0) / 1000);
    return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
  };
  const activeColor = isMe ? 'rgba(255,255,255,0.95)' : colors.primary;
  const inactiveColor = isMe ? 'rgba(255,255,255,0.25)' : 'rgba(124,58,237,0.25)';

  // Entire row is one big tap target
  return (
    <TouchableOpacity activeOpacity={0.8} onPress={toggle} style={s.voiceRow}>
      <Animated.View style={{ transform: [{ scale: playing ? pulseAnim : 1 }] }}>
        <View style={[s.playBtn, isMe ? s.playBtnMe : s.playBtnThem]}>
          {isMe ? (
            <Ionicons name={playing ? 'pause' : 'play'} size={16} color={colors.primary} style={!playing && { marginLeft: 2 }} />
          ) : (
            <LinearGradient colors={gradients.primary} style={s.playGrad}>
              <Ionicons name={playing ? 'pause' : 'play'} size={16} color="#fff" style={!playing && { marginLeft: 2 }} />
            </LinearGradient>
          )}
        </View>
      </Animated.View>

      <View style={s.waveWrap}>
        <View style={s.waveform}>
          {barAnims.map((anim, i) => {
            const h = 3 + Math.abs(Math.sin(i * 0.75) * 10 + Math.cos(i * 0.45) * 6);
            return (
              <Animated.View
                key={i}
                style={[s.bar, {
                  height: h,
                  backgroundColor: i / BARS <= progress ? activeColor : inactiveColor,
                  transform: [{ scaleY: playing ? anim : 1 }],
                }]}
              />
            );
          })}
        </View>
        <View style={s.voiceFooter}>
          <AppText style={[s.voiceTime, { color: isMe ? 'rgba(255,255,255,0.6)' : colors.muted }]}>
            {fmtMs(position > 0 ? position : duration)}
          </AppText>
          <TouchableOpacity
            onPress={cycleSpeed}
            style={[s.speedBtn, { backgroundColor: isMe ? 'rgba(255,255,255,0.15)' : 'rgba(124,58,237,0.12)' }]}
          >
            <AppText style={[s.speedText, { color: isMe ? 'rgba(255,255,255,0.85)' : colors.primary }]}>
              {SPEEDS[speedIdx]}×
            </AppText>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Main MessageBubble ────────────────────────────────────────────────────────
export default function MessageBubble({ item, isMe, showName, onLongPress, onPress }) {
  const [viewingImage, setViewingImage] = useState(false);
  const [pollState, setPollState] = useState(item.poll || null);

  const hasMedia = !!item.media_url;
  const isImage = hasMedia && item.media_type === 'image';
  const isGif = hasMedia && item.media_type === 'gif';
  const isVideo = hasMedia && item.media_type === 'video';
  const isAudio = hasMedia && item.media_type === 'audio';
  // Sticker = single emoji character (no media, no long text)
  const isSticker = !hasMedia && !!item.text && /^(\p{Emoji_Presentation}|\p{Extended_Pictographic})(\uFE0F|\u20E3|[\uD800-\uDFFF])*$/u.test(item.text.trim());
  const isMediaOnly = hasMedia && !item.text;
  const isSending = !!item.sending;

  const { bubbleMaxW, mediaW } = useMemo(() => {
    const max = Math.min(340, Math.floor(SCREEN_W * 0.78));
    const mw = Math.min(max, Math.floor(SCREEN_W * 0.72));
    return { bubbleMaxW: max, mediaW: mw };
  }, []);

  return (
    <View style={[s.wrapper, isMe ? s.wrapperMe : s.wrapperThem]}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={250}
        style={[
          s.bubble,
          isMe ? s.bubbleMe : s.bubbleThem,
          isAudio && s.bubbleAudio,
          (isMediaOnly || isGif) && s.bubbleMedia,
          isSticker && s.bubbleSticker,
          { maxWidth: bubbleMaxW },
        ]}
      >
        {/* Bubble background skin */}
        {!isSticker && (
          isMe ? (
            <LinearGradient
              colors={['#3797F0', '#6366f1']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.bgFill}
            />
          ) : (
            <View style={s.bgFillThem} />
          )
        )}

        {/* Sender name — family group only */}
        {showName && (
          <AppText style={s.senderName}>{item.sender_name}</AppText>
        )}

        {/* Reply preview */}
        {item.reply_to_id && (
          <View style={[s.replyPreview, isMe && s.replyPreviewMe]}>
            <View style={[s.replyBar, isMe && { backgroundColor: 'rgba(255,255,255,0.6)' }]} />
            <View style={{ flex: 1 }}>
              <AppText style={[s.replyName, isMe && { color: 'rgba(255,255,255,0.7)' }]}>
                {item.reply_to_sender}
              </AppText>
              <AppText style={[s.replyText, isMe && { color: 'rgba(255,255,255,0.55)' }]} numberOfLines={1}>
                {item.reply_to_text || '📎 Media'}
              </AppText>
            </View>
          </View>
        )}

        {/* Image — tap to fullscreen */}
        {isImage && (
          <>
            <TouchableOpacity activeOpacity={0.92} onPress={() => setViewingImage(true)}>
              <Image source={{ uri: item.media_url }} style={[s.mediaImage, { width: mediaW }]} resizeMode="cover" />
            </TouchableOpacity>
            {viewingImage && (
              <ImageViewer uri={item.media_url} onClose={() => setViewingImage(false)} />
            )}
          </>
        )}

        {/* GIF — plays inline as animated image */}
        {isGif && (
          <Image
            source={{ uri: item.media_url }}
            style={[s.gifImage, { width: mediaW }]}
            resizeMode="cover"
          />
        )}

        {/* Video — tap to play/pause inline */}
        {isVideo && <VideoPlayer uri={item.media_url} />}

        {/* Voice — tap anywhere on the row to play */}
        {isAudio && <VoicePlayer uri={item.media_url} isMe={isMe} />}

        {/* Sticker — big emoji, no bubble background */}
        {isSticker ? (
          <AppText style={s.stickerText}>{item.text}</AppText>
        ) : pollState ? (
          <View style={s.pollWrap}>
            <AppText style={[s.pollQuestion, isMe && { color: '#fff' }]}>{pollState.question}</AppText>
            <View style={{ gap: 8 }}>
              {pollState.options.map((opt, idx) => {
                const total = pollState.total_votes || 0;
                const count = pollState.vote_counts?.[idx] || 0;
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                const selected = pollState.user_vote === idx;
                return (
                  <TouchableOpacity
                    key={idx}
                    activeOpacity={0.85}
                    style={[s.pollOption, selected && s.pollOptionSelected]}
                    onPress={async () => {
                      try {
                        const { data } = await api.post(`/messages/polls/${pollState.id}/vote`, { option_index: idx });
                        setPollState(data.poll);
                      } catch {}
                    }}
                  >
                    <View style={[s.pollFill, { width: `${pct}%`, opacity: isMe ? 0.35 : 0.25 }]} />
                    <AppText style={[s.pollOptionText, isMe && { color: '#fff' }]}>{opt}</AppText>
                    <AppText style={[s.pollPct, isMe && { color: 'rgba(255,255,255,0.8)' }]}>{pct}%</AppText>
                  </TouchableOpacity>
                );
              })}
            </View>
            <AppText style={[s.pollMeta, isMe && { color: 'rgba(255,255,255,0.7)' }]}>
              {pollState.total_votes || 0} vote{(pollState.total_votes || 0) === 1 ? '' : 's'}
            </AppText>
          </View>
        ) : !!item.text ? (
          <MentionText text={item.text} isMe={isMe} />
        ) : null}

        {/* Sending overlay */}
        {isSending && (
          <View style={s.sendingOverlay}>
            <ActivityIndicator color="#fff" size="small" />
          </View>
        )}

        {/* Footer: time + read ticks */}
        <View style={[s.footer, isMediaOnly && s.footerOverlay]}>
          <AppText style={[s.time, isMe ? s.timeMe : s.timeThem]}>
            {timeStr(item.created_at)}
          </AppText>
          {isMe && (
            <Ionicons
              name={item.is_read ? 'checkmark-done' : 'checkmark'}
              size={13}
              color={item.is_read ? '#a5f3fc' : 'rgba(255,255,255,0.5)'}
              style={{ marginLeft: 3 }}
            />
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: {
    marginVertical: 2,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  wrapperMe: { justifyContent: 'flex-end' },
  wrapperThem: { justifyContent: 'flex-start' },

  bubble: {
    borderRadius: 22,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bubbleMe: {
    backgroundColor: 'transparent',
    borderBottomRightRadius: 6,
  },
  bubbleThem: {
    backgroundColor: 'transparent',
    borderBottomLeftRadius: 6,
  },
  bgFill: { ...StyleSheet.absoluteFillObject },
  bgFillThem: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  bubbleAudio: {
    minWidth: 220,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bubbleMedia: { paddingHorizontal: 0, paddingVertical: 0 },
  bubbleSticker: {
    backgroundColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  stickerText: {
    fontSize: 72,
    lineHeight: 80,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },

  senderName: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.gold,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 2,
  },

  replyPreview: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.12)',
    margin: 8,
    marginBottom: 4,
    borderRadius: 10,
    padding: 8,
  },
  replyPreviewMe: { backgroundColor: 'rgba(0,0,0,0.18)' },
  replyBar: { width: 3, backgroundColor: colors.gold, borderRadius: 2 },
  replyName: { fontSize: 11, fontWeight: '700', color: colors.gold },
  replyText: { fontSize: 11, color: colors.muted },

  // Image
  mediaImage: { aspectRatio: 4 / 5, backgroundColor: '#0b0b0f' },
  gifImage: { aspectRatio: 16 / 9, backgroundColor: '#0b0b0f' },

  // Video
  videoWrap: { width: 240, aspectRatio: 4 / 5, backgroundColor: '#0b0b0f' },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  videoPlayBtn: { width: 52, height: 52, borderRadius: 26, overflow: 'hidden' },
  videoPlayGrad: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Text
  text: { fontSize: 15, lineHeight: 20, letterSpacing: 0.1 },
  textMe: { color: '#fff' },
  textThem: { color: '#111827' },
  mention: { fontWeight: '800', color: '#93c5fd' },

  // Poll
  pollWrap: { paddingVertical: 4, gap: 10 },
  pollQuestion: { fontSize: 15, fontWeight: '800', color: '#111827' },
  pollOption: {
    borderRadius: 14,
    overflow: 'hidden',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pollOptionSelected: {
    borderColor: 'rgba(255,255,255,0.38)',
  },
  pollFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  pollOptionText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#111827' },
  pollPct: { fontSize: 12, fontWeight: '800', color: 'rgba(17,24,39,0.65)' },
  pollMeta: { fontSize: 11, fontWeight: '700', color: 'rgba(17,24,39,0.55)' },

  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingTop: 4,
    gap: 2,
  },
  footerOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 10,
    margin: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  time: { fontSize: 10 },
  timeMe: { color: 'rgba(255,255,255,0.55)' },
  timeThem: { color: 'rgba(17,24,39,0.55)' },

  sendingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },

  // Image viewer modal
  imgViewerBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imgViewerImg: {
    width: SCREEN_W,
    height: SCREEN_H * 0.8,
  },
  imgViewerClose: {
    position: 'absolute',
    top: 52,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 6,
  },

  // Voice
  voiceRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  playBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  playBtnMe: { backgroundColor: 'rgba(255,255,255,0.9)' },
  playBtnThem: { overflow: 'hidden' },
  playGrad: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  waveWrap: { flex: 1, gap: 4 },
  waveform: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 28 },
  bar: { width: 2.5, borderRadius: 2, minHeight: 3 },
  voiceFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  voiceTime: { fontSize: 10, fontWeight: '600' },
  speedBtn: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  speedText: { fontSize: 10, fontWeight: '800' },
});
