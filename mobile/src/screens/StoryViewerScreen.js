import { useState, useEffect, useRef } from 'react';
import {
  View, StyleSheet, Image, TouchableOpacity,
  Dimensions, StatusBar, Animated, TextInput,
  KeyboardAvoidingView, Platform, PanResponder,
  Modal, ScrollView, ActivityIndicator, Easing,
} from 'react-native';
import { Video } from 'expo-av';
import Svg, { Defs, ClipPath, Polygon, Image as SvgImage } from 'react-native-svg';
import AppText from '../components/AppText';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme';

const { width, height } = Dimensions.get('window');
const IMAGE_DURATION = 5000;
const QUICK_REACTIONS = ['❤️', '🔥', '😂', '😮', '😢', '👏'];

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const utc = dateStr.endsWith('Z') ? dateStr : dateStr + 'Z';
  const diff = (Date.now() - new Date(utc)) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function StoryViewerScreen({ route, navigation }) {
  const { storyGroups, initialGroupIndex = 0 } = route.params;
  const { user } = useAuth();

  const [groupIndex, setGroupIndex] = useState(initialGroupIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showViews, setShowViews] = useState(false);
  const [views, setViews] = useState([]);
  const [sending, setSending] = useState(false);
  const [replySent, setReplySent] = useState(false);
  const [reactionSent, setReactionSent] = useState(null);
  const replyInputRef = useRef(null);

  const progress = useRef(new Animated.Value(0)).current;
  const animRef = useRef(null);
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const discSpin = useRef(new Animated.Value(0)).current;
  const discSpinAnim = useRef(null);

  // Spin the music disc continuously while story is playing
  useEffect(() => {
    if (story?.music_name && !paused) {
      discSpinAnim.current = Animated.loop(
        Animated.timing(discSpin, {
          toValue: 1,
          duration: 4000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      discSpinAnim.current.start();
    } else {
      discSpinAnim.current?.stop();
    }
    return () => discSpinAnim.current?.stop();
  }, [story?.id, paused]);

  const group = storyGroups[groupIndex];
  const story = group?.stories[storyIndex];
  const isOwn = story?.user_id === user?.id;
  const isVideo = story?.media_type === 'video' && !!story?.media_url;

  // ── Swipe-down to close ──────────────────────────────────────
  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 8 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderMove: (_, g) => {
      if (g.dy > 0) {
        translateY.setValue(g.dy);
        opacity.setValue(Math.max(0.3, 1 - g.dy / 300));
      }
    },
    onPanResponderRelease: (_, g) => {
      if (g.dy > 80) {
        Animated.parallel([
          Animated.timing(translateY, { toValue: height, duration: 250, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
        ]).start(() => navigation.goBack());
      } else {
        Animated.parallel([
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
          Animated.spring(opacity, { toValue: 1, useNativeDriver: true }),
        ]).start();
      }
    },
  })).current;

  // ── Progress bar ─────────────────────────────────────────────
  useEffect(() => {
    if (!story) return;
    api.post(`/pstories/${story.id}/view`).catch(() => {});
    if (!isVideo) startProgress();
    return () => animRef.current?.stop();
  }, [groupIndex, storyIndex]);

  const startProgress = (duration = IMAGE_DURATION) => {
    progress.setValue(0);
    animRef.current?.stop();
    animRef.current = Animated.timing(progress, {
      toValue: 1,
      duration,
      useNativeDriver: false,
    });
    animRef.current.start(({ finished }) => { if (finished) goNext(); });
  };

  const pauseProgress = () => {
    animRef.current?.stop();
    setPaused(true);
  };

  const resumeProgress = () => {
    setPaused(false);
    // Resume from current position
    const remaining = IMAGE_DURATION * (1 - (progress._value || 0));
    animRef.current = Animated.timing(progress, {
      toValue: 1,
      duration: remaining,
      useNativeDriver: false,
    });
    animRef.current.start(({ finished }) => { if (finished) goNext(); });
  };

  const goNext = () => {
    const g = storyGroups[groupIndex];
    if (storyIndex < g.stories.length - 1) {
      setStoryIndex(i => i + 1);
    } else if (groupIndex < storyGroups.length - 1) {
      setGroupIndex(gi => gi + 1);
      setStoryIndex(0);
    } else {
      navigation.goBack();
    }
  };

  const goPrev = () => {
    if (storyIndex > 0) {
      setStoryIndex(i => i - 1);
    } else if (groupIndex > 0) {
      setGroupIndex(gi => gi - 1);
      setStoryIndex(0);
    }
  };

  const handleDelete = async () => {
    try { await api.delete(`/pstories/${story.id}`); goNext(); } catch {}
  };

  const loadViews = async () => {
    try {
      const { data } = await api.get(`/pstories/${story.id}/views`);
      setViews(data.views || []);
    } catch {}
    setShowViews(true);
  };

  const sendReply = async (text) => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await api.post('/messages/send', {
        to_user_id: story.user_id,
        text: `💬 Replied to your story: ${text}`,
      });
      setReplyText('');
      setReplySent(true);
      replyInputRef.current?.blur();
      setTimeout(() => setReplySent(false), 2500);
      resumeProgress();
    } catch {}
    finally { setSending(false); }
  };

  const sendReaction = async (emoji) => {
    if (sending) return;
    setReactionSent(emoji);
    setSending(true);
    try {
      await api.post('/messages/send', {
        to_user_id: story.user_id,
        text: `${emoji} Reacted to your story`,
      });
    } catch {}
    finally {
      setSending(false);
      setTimeout(() => setReactionSent(null), 1500);
    }
  };

  if (!story) return null;

  return (
    <Animated.View
      style={[s.container, { transform: [{ translateY }], opacity }]}
      {...panResponder.panHandlers}
    >
      <StatusBar hidden />

      {/* ── BACKGROUND ── */}
      {story.media_url && story.media_type === 'image' && (
        <Image
          source={{ uri: story.media_url }}
          style={s.bg}
          resizeMode="cover"
        />
      )}
      {isVideo && (
        <Video
          source={{ uri: story.media_url }}
          style={s.bg}
          resizeMode="cover"
          shouldPlay={!paused}
          isLooping={false}
          useNativeControls={false}
          onPlaybackStatusUpdate={status => {
            if (status.isLoaded && status.durationMillis && !paused) {
              const pct = status.positionMillis / status.durationMillis;
              progress.setValue(pct);
              if (status.didJustFinish) goNext();
            }
          }}
        />
      )}
      {story.media_type === 'text' && (
        <LinearGradient
          colors={[story.bg_color || '#7c3aed', '#0f172a']}
          style={s.bg}
        />
      )}
      {!story.media_url && story.media_type !== 'text' && (
        <View style={[s.bg, { backgroundColor: '#0f172a' }]} />
      )}

      {/* ── GRADIENTS ── */}
      <LinearGradient colors={['rgba(0,0,0,0.55)', 'transparent']} style={s.topGrad} />
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} style={s.bottomGrad} />

      {/* ── TEXT OVERLAY ── */}
      {story.text_content ? (
        <View style={s.textOverlay} pointerEvents="none">
          <View style={s.textOverlayBubble}>
            <AppText style={s.storyText}>{story.text_content}</AppText>
          </View>
        </View>
      ) : null}

      {/* ── LOCATION STICKER ── */}
      {story.location ? (
        <View style={s.locationSticker} pointerEvents="none">
          <Ionicons name="location-sharp" size={13} color="#fff" />
          <AppText style={s.locationStickerText} numberOfLines={1}>{story.location}</AppText>
        </View>
      ) : null}

      {/* ── MUSIC DISC ── */}
      {story.music_name ? (
        <View style={s.musicSticker} pointerEvents="none">
          <Animated.View style={[s.musicDisc, {
            transform: [{ rotate: discSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }]
          }]}>
            {story.music_artwork
              ? <Image source={{ uri: story.music_artwork }} style={s.musicDiscImg} />
              : <LinearGradient colors={['#7c3aed', '#3b82f6']} style={s.musicDiscImg}>
                  <Ionicons name="musical-notes" size={14} color="#fff" />
                </LinearGradient>}
            <View style={s.musicDiscHole} />
          </Animated.View>
          <View style={s.musicStickerInfo}>
            <AppText style={s.musicStickerTitle} numberOfLines={1}>{story.music_name}</AppText>
            {story.music_artist ? (
              <AppText style={s.musicStickerArtist} numberOfLines={1}>{story.music_artist}</AppText>
            ) : null}
          </View>
        </View>
      ) : null}
      <View style={s.progressRow}>
        {group.stories.map((_, i) => (
          <View key={i} style={s.progressTrack}>
            <Animated.View style={[s.progressFill, {
              width: i < storyIndex ? '100%'
                : i === storyIndex
                  ? progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
                  : '0%'
            }]} />
          </View>
        ))}
      </View>

      {/* ── HEADER ── */}
      <View style={s.header}>
        <View style={s.authorRow}>
          <TouchableOpacity
            onPress={() => !isOwn && navigation.navigate('UserProfile', {
              userId: group.user_id,
              userName: group.author_name,
              userAvatar: group.author_avatar,
            })}
            activeOpacity={isOwn ? 1 : 0.8}
          >
            <HexAvatar uri={group.author_avatar} name={group.author_name} size={38} />
          </TouchableOpacity>
          <View style={{ gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <AppText style={s.authorName}>{group.author_name}</AppText>
              {/* Privacy badge — creator only */}
              {isOwn && story.privacy && (
                <View style={[
                  s.privacyBadge,
                  story.privacy === 'public'      && s.privacyPublic,
                  story.privacy === 'connections' && s.privacyConnections,
                  story.privacy === 'family'      && s.privacyFamily,
                ]}>
                  <Ionicons
                    name={
                      story.privacy === 'public'      ? 'globe-outline' :
                      story.privacy === 'connections' ? 'people-outline' :
                      'home-outline'
                    }
                    size={10}
                    color="#fff"
                  />
                  <AppText style={s.privacyBadgeText}>
                    {story.privacy === 'public'      ? 'Public' :
                     story.privacy === 'connections' ? 'Connections' :
                     'Family'}
                  </AppText>
                </View>
              )}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <AppText style={s.storyTime}>{timeAgo(story.created_at)}</AppText>
              <AppText style={s.storyDot}>·</AppText>
              <AppText style={s.storyTime}>{storyIndex + 1}/{group.stories.length}</AppText>
            </View>
          </View>
        </View>

        <View style={s.headerRight}>
          {/* Follow button — viewer only, not already connected */}
          {!isOwn && !group.is_connected && (
            <TouchableOpacity
              style={s.followBtn}
              onPress={() => navigation.navigate('UserProfile', {
                userId: group.user_id,
                userName: group.author_name,
                userAvatar: group.author_avatar,
              })}
              activeOpacity={0.85}
            >
              <AppText style={s.followBtnText}>Follow</AppText>
            </TouchableOpacity>
          )}
          {/* More options — creator only */}
          {isOwn && (
            <TouchableOpacity
              style={s.headerBtn}
              onPress={() => {
                pauseProgress();
                setShowViews(true);
                loadViews();
              }}
            >
              <Ionicons name="ellipsis-horizontal" size={22} color="#fff" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBtn}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── TAP ZONES (hold to pause) ── */}
      <View style={s.tapZones} pointerEvents="box-none">
        <TouchableOpacity
          style={s.tapLeft}
          onPress={goPrev}
          onLongPress={pauseProgress}
          onPressOut={() => { if (paused) resumeProgress(); }}
          delayLongPress={150}
          activeOpacity={1}
        />
        <TouchableOpacity
          style={s.tapRight}
          onPress={goNext}
          onLongPress={pauseProgress}
          onPressOut={() => { if (paused) resumeProgress(); }}
          delayLongPress={150}
          activeOpacity={1}
        />
      </View>

      {/* ── VIEW COUNT (own) ── */}
      {isOwn && (
        <TouchableOpacity style={s.viewCount} onPress={loadViews}>
          <Ionicons name="eye-outline" size={14} color="rgba(255,255,255,0.85)" />
          <AppText style={s.viewCountText}>{story.view_count || 0} views</AppText>
        </TouchableOpacity>
      )}

      {/* ── REACTION BURST ── */}
      {reactionSent && (
        <View style={s.reactionBurst} pointerEvents="none">
          <AppText style={s.reactionBurstEmoji}>{reactionSent}</AppText>
        </View>
      )}

      {/* ── REPLY BAR (others' stories) ── */}
      {!isOwn && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={s.replyWrap}
        >
          <BlurView intensity={25} tint="dark" style={s.replyBar}>
            {replySent ? (
              // ── Sent confirmation ──
              <View style={s.replySentRow}>
                <Ionicons name="checkmark-circle" size={18} color="#10b981" />
                <AppText style={s.replySentText}>Message sent!</AppText>
              </View>
            ) : (
              <>
                <TextInput
                  ref={replyInputRef}
                  style={s.replyInput}
                  placeholder={`Reply to ${group.author_name}...`}
                  placeholderTextColor="rgba(255,255,255,0.45)"
                  value={replyText}
                  onChangeText={setReplyText}
                  onFocus={pauseProgress}
                  onBlur={() => { if (!replyText.trim()) resumeProgress(); }}
                  returnKeyType="send"
                  onSubmitEditing={() => sendReply(replyText)}
                  editable={!sending}
                />
                {replyText.trim() ? (
                  // ── Send button ──
                  <TouchableOpacity
                    onPress={() => sendReply(replyText)}
                    disabled={sending}
                    style={s.sendBtn}
                  >
                    {sending
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Ionicons name="send" size={18} color="#fff" />}
                  </TouchableOpacity>
                ) : (
                  // ── Quick reactions ──
                  <View style={s.replyEmojis}>
                    {QUICK_REACTIONS.map(e => (
                      <TouchableOpacity
                        key={e}
                        onPress={() => sendReaction(e)}
                        disabled={sending}
                        style={s.reactionBtn}
                      >
                        <AppText style={s.reactionEmoji}>{e}</AppText>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}
          </BlurView>
        </KeyboardAvoidingView>
      )}

      {/* ── VIEWS MODAL ── */}
      <Modal visible={showViews} transparent animationType="slide" onRequestClose={() => setShowViews(false)}>
        <View style={s.viewsOverlay}>
          <View style={s.viewsSheet}>
            <View style={s.viewsHandle} />
            <View style={s.viewsHeader}>
              <AppText style={s.viewsTitle}>Viewed by {views.length}</AppText>
              <TouchableOpacity onPress={() => setShowViews(false)}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>
            {views.length === 0 ? (
              <View style={{ alignItems: 'center', padding: 40 }}>
                <Ionicons name="eye-off-outline" size={40} color={colors.dim} />
                <AppText style={{ color: colors.muted, marginTop: 10 }}>No views yet</AppText>
              </View>
            ) : (
              <ScrollView>
                {views.map((v, i) => (
                  <View key={i} style={s.viewRow}>
                    <View style={s.viewAvatar}>
                      {v.avatar_url
                        ? <Image source={{ uri: v.avatar_url }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                        : <AppText style={s.viewAvatarLetter}>{v.name?.[0]?.toUpperCase()}</AppText>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <AppText style={s.viewName}>{v.name}</AppText>
                      <AppText style={s.viewTime}>
                        {v.viewed_at ? new Date(v.viewed_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </AppText>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </Animated.View>
  );
}

// ── Hexagon points calculator ────────────────────────────────
function hexPoints(cx, cy, r) {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i - 30);
    return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
  }).join(' ');
}

// ── Hexagon Avatar (SVG-based) ────────────────────────────────
export function HexAvatar({ uri, name, size = 54, hasStory = false, hasSeen = false }) {
  const pad = 4;
  const total = size + pad * 2;
  const cx = total / 2;
  const cy = total / 2;
  const outerR = total / 2 - 1;
  const innerR = size / 2 - 1;

  const borderColor = hasStory
    ? hasSeen ? '#666666' : '#7c3aed'
    : '#333333';

  const outerPts = hexPoints(cx, cy, outerR);
  const innerPts = hexPoints(cx, cy, innerR);

  return (
    <View style={{ width: total, height: total }}>
      <Svg width={total} height={total}>
        <Defs>
          <ClipPath id={`hex-outer-${size}`}>
            <Polygon points={outerPts} />
          </ClipPath>
          <ClipPath id={`hex-inner-${size}`}>
            <Polygon points={innerPts} />
          </ClipPath>
        </Defs>

        <Polygon points={outerPts} fill={borderColor} />
        <Polygon points={innerPts} fill={uri ? '#111' : '#7c3aed'} />

        {uri && (
          <SvgImage
            href={{ uri }}
            x={cx - innerR}
            y={cy - innerR}
            width={innerR * 2}
            height={innerR * 2}
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#hex-inner-${size})`}
          />
        )}
      </Svg>

      {!uri && (
        <View style={{
          position: 'absolute', width: total, height: total,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <AppText style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.36 }}>
            {name?.[0]?.toUpperCase()}
          </AppText>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', width, height },
  bg: { position: 'absolute', top: 0, left: 0, width, height },
  topGrad: { position: 'absolute', top: 0, left: 0, right: 0, height: 160 },
  bottomGrad: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 260 },

  textOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', padding: 32,
  },
  textOverlayBubble: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 12,
    maxWidth: '85%',
  },
  storyText: {
    color: '#fff', fontSize: 22, fontWeight: '700', textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
    lineHeight: 30,
  },

  // Location sticker
  locationSticker: {
    position: 'absolute',
    bottom: 160,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    maxWidth: width * 0.7,
  },
  locationStickerText: {
    color: '#fff', fontSize: 13, fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },

  // Music disc sticker
  musicSticker: {
    position: 'absolute',
    bottom: 120,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    maxWidth: width * 0.65,
  },
  musicDisc: {
    width: 36, height: 36, borderRadius: 18,
    overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
  },
  musicDiscImg: {
    width: '100%', height: '100%',
    alignItems: 'center', justifyContent: 'center',
  },
  musicDiscHole: {
    position: 'absolute',
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#000',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
  },
  musicStickerInfo: { flex: 1 },
  musicStickerTitle: {
    color: '#fff', fontSize: 12, fontWeight: '700',
  },
  musicStickerArtist: {
    color: 'rgba(255,255,255,0.65)', fontSize: 10, marginTop: 1,
  },

  progressRow: { position: 'absolute', top: 54, left: 10, right: 10, flexDirection: 'row', gap: 3 },
  progressTrack: { flex: 1, height: 2.5, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#fff', borderRadius: 2 },

  header: {
    position: 'absolute', top: 66, left: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  authorName: { color: '#fff', fontWeight: '700', fontSize: 14 },
  storyTime: { color: 'rgba(255,255,255,0.65)', fontSize: 11 },
  storyDot: { color: 'rgba(255,255,255,0.4)', fontSize: 11 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerBtn: { padding: 6 },

  // Privacy badge
  privacyBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 20,
  },
  privacyPublic:      { backgroundColor: 'rgba(59,130,246,0.75)' },
  privacyConnections: { backgroundColor: 'rgba(124,58,237,0.75)' },
  privacyFamily:      { backgroundColor: 'rgba(16,185,129,0.75)' },
  privacyBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700', letterSpacing: 0.3 },

  // Follow button (viewer)
  followBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 5,
  },
  followBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  tapZones: { position: 'absolute', top: 110, left: 0, right: 0, bottom: 100, flexDirection: 'row' },
  tapLeft: { flex: 1 },
  tapRight: { flex: 2 },

  viewCount: {
    position: 'absolute', bottom: 115, right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  viewCountText: { color: 'rgba(255,255,255,0.85)', fontSize: 13 },

  reactionBurst: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
    pointerEvents: 'none',
  },
  reactionBurstEmoji: { fontSize: 72 },

  replyWrap: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  replyBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 30 : 14,
    minHeight: 64,
  },
  replyInput: {
    flex: 1, color: '#fff', fontSize: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10,
  },
  sendBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  replyEmojis: { flexDirection: 'row', gap: 6 },
  reactionBtn: { padding: 2 },
  reactionEmoji: { fontSize: 22 },
  replySentRow: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8, paddingVertical: 6,
  },
  replySentText: { color: '#10b981', fontSize: 14, fontWeight: '600' },

  viewsOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  viewsSheet: {
    backgroundColor: colors.bgSecondary || '#1e293b',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingBottom: 40, maxHeight: '60%',
  },
  viewsHandle: {
    width: 40, height: 4, backgroundColor: colors.border,
    borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4,
  },
  viewsHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 0.5, borderBottomColor: colors.border,
  },
  viewsTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  viewRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 0.5, borderBottomColor: colors.border,
  },
  viewAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  viewAvatarLetter: { color: '#fff', fontWeight: '700', fontSize: 16 },
  viewName: { fontSize: 14, fontWeight: '600', color: colors.text },
  viewTime: { fontSize: 11, color: colors.muted, marginTop: 2 },
});
