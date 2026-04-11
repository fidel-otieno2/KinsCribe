import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image,
  Modal, Alert, Share, ActivityIndicator, TextInput,
  FlatList, KeyboardAvoidingView, Platform, Animated,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import VideoPlayer from './VideoPlayer';
import { colors } from '../theme';

// ── Time formatter ────────────────────────────────────────────────────────────
function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Audio Player ──────────────────────────────────────────────────────────────
function AudioPlayer({ uri }) {
  const [sound, setSound] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => () => { sound?.unloadAsync(); }, [sound]);

  const toggle = async () => {
    if (!uri) return;
    if (playing) { await sound?.pauseAsync(); setPlaying(false); return; }
    setLoading(true);
    try {
      if (sound) { await sound.playAsync(); }
      else {
        const { sound: s } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true }, (st) => {
          if (st.isLoaded) {
            setProgress(st.positionMillis || 0);
            setDuration(st.durationMillis || 0);
            if (st.didJustFinish) { setPlaying(false); setProgress(0); }
          }
        });
        setSound(s);
      }
      setPlaying(true);
    } catch {} finally { setLoading(false); }
  };

  const pct = duration > 0 ? (progress / duration) * 100 : 0;
  const fmt = (ms) => {
    const s = Math.floor(ms / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };

  return (
    <View style={ap.wrap}>
      <LinearGradient colors={['rgba(124,58,237,0.2)', 'rgba(59,130,246,0.1)']} style={StyleSheet.absoluteFill} />
      <TouchableOpacity style={ap.btn} onPress={toggle} activeOpacity={0.8}>
        <LinearGradient colors={['#7c3aed', '#3b82f6']} style={ap.btnGrad}>
          {loading ? <ActivityIndicator color="#fff" size="small" />
            : <Ionicons name={playing ? 'pause' : 'play'} size={22} color="#fff" />}
        </LinearGradient>
      </TouchableOpacity>
      <View style={ap.right}>
        <View style={ap.track}>
          <View style={[ap.fill, { width: `${pct}%` }]} />
        </View>
        <View style={ap.times}>
          <Text style={ap.time}>{fmt(progress)}</Text>
          <Text style={ap.time}>{fmt(duration)}</Text>
        </View>
      </View>
    </View>
  );
}

const ap = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12, borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: 'rgba(124,58,237,0.2)' },
  btn: { width: 46, height: 46, borderRadius: 23, overflow: 'hidden' },
  btnGrad: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  right: { flex: 1 },
  track: { height: 3, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, overflow: 'hidden', marginBottom: 6 },
  fill: { height: '100%', backgroundColor: '#7c3aed', borderRadius: 2 },
  times: { flexDirection: 'row', justifyContent: 'space-between' },
  time: { fontSize: 10, color: colors.muted },
});

// ── Main StoryCard ────────────────────────────────────────────────────────────
export default function StoryCard({ story, onUpdate, isVisible = true, navigation }) {
  const { user } = useAuth();

  const [liked, setLiked] = useState(story.liked_by_me || false);
  const [likeCount, setLikeCount] = useState(story.like_count || 0);
  const [saved, setSaved] = useState(story.saved_by_me || false);
  const [commentCount, setCommentCount] = useState(story.comment_count || 0);
  const [showMenu, setShowMenu] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [posting, setPosting] = useState(false);

  // double-tap heart
  const heartAnim = useRef(new Animated.Value(0)).current;
  const lastTap = useRef(0);

  const mediaUrl = story.media_url?.startsWith('http') ? story.media_url : null;
  const isVideo = story.media_type === 'video' && mediaUrl;
  const isAudio = story.media_type === 'audio' && mediaUrl;
  const isImage = story.media_type === 'image' && mediaUrl;
  const isOwner = story.user_id === user?.id;

  const goToProfile = () => {
    if (!navigation) return;
    navigation.navigate('UserProfile', {
      userId: story.user_id,
      userName: story.author_name,
      userAvatar: story.author_avatar,
    });
  };

  const flashHeart = () => {
    heartAnim.setValue(1);
    Animated.sequence([
      Animated.spring(heartAnim, { toValue: 1.3, useNativeDriver: true, speed: 20 }),
      Animated.timing(heartAnim, { toValue: 0, duration: 800, delay: 400, useNativeDriver: true }),
    ]).start();
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      if (!liked) {
        setLiked(true);
        setLikeCount(c => c + 1);
        api.post(`/stories/${story.id}/like`).catch(() => {
          setLiked(false);
          setLikeCount(c => c - 1);
        });
      }
      flashHeart();
    }
    lastTap.current = now;
  };

  const toggleLike = async () => {
    const next = !liked;
    setLiked(next);
    setLikeCount(c => next ? c + 1 : c - 1);
    try {
      await api.post(`/stories/${story.id}/like`);
    } catch {
      setLiked(!next);
      setLikeCount(c => next ? c - 1 : c + 1);
    }
  };

  const toggleSave = async () => {
    const next = !saved;
    setSaved(next);
    try { await api.post(`/stories/${story.id}/save`); }
    catch { setSaved(!next); }
    setShowMenu(false);
  };

  const handleShare = async () => {
    setShowMenu(false);
    try { await Share.share({ message: `${story.title} — shared from KinsCribe` }); } catch {}
  };

  const handleDelete = () => {
    setShowMenu(false);
    Alert.alert('Delete Story', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await api.delete(`/stories/${story.id}`); onUpdate?.(); }
        catch { Alert.alert('Error', 'Could not delete story'); }
      }},
    ]);
  };

  const handleReport = () => {
    setShowMenu(false);
    Alert.alert('Report Story', 'Are you sure you want to report this?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Report', style: 'destructive', onPress: async () => {
        try {
          await api.post(`/stories/${story.id}/report`);
          Alert.alert('Reported', 'Thank you. Our team will review it.');
        } catch { Alert.alert('Error', 'Could not send report'); }
      }},
    ]);
  };

  const openComments = async () => {
    setShowComments(true);
    setLoadingComments(true);
    try {
      const { data } = await api.get(`/stories/${story.id}/comments`);
      setComments(data.comments || []);
    } catch {} finally { setLoadingComments(false); }
  };

  const postComment = async () => {
    if (!commentText.trim()) return;
    setPosting(true);
    try {
      const { data } = await api.post(`/stories/${story.id}/comments`, { text: commentText });
      setComments(c => [...c, { ...data.comment, author_name: user?.name }]);
      setCommentCount(c => c + 1);
      setCommentText('');
      onUpdate?.();
    } catch {} finally { setPosting(false); }
  };

  return (
    <>
      <View style={s.card}>

        {/* ── HEADER ── */}
        <View style={s.header}>
          <TouchableOpacity onPress={goToProfile} style={s.avatarBtn} activeOpacity={0.8}>
            <LinearGradient colors={['#7c3aed', '#3b82f6', '#ec4899']} style={s.avatarRing}>
              <View style={s.avatarInner}>
                {story.author_avatar
                  ? <Image source={{ uri: story.author_avatar }} style={s.avatarImg} />
                  : <Text style={s.avatarLetter}>{story.author_name?.[0]?.toUpperCase() || 'U'}</Text>}
              </View>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={{ flex: 1 }} onPress={goToProfile} activeOpacity={0.8}>
            <Text style={s.username}>{story.author_name || 'Unknown'}</Text>
            <View style={s.metaRow}>
              {story.location ? (
                <>
                  <Ionicons name="location-outline" size={11} color={colors.muted} />
                  <Text style={s.metaText}>{story.location}</Text>
                  <Text style={s.metaDot}>·</Text>
                </>
              ) : null}
              <Text style={s.metaText}>{timeAgo(story.created_at)}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setShowMenu(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="ellipsis-horizontal" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* ── MEDIA ── */}
        <Pressable onPress={handleDoubleTap}>
          <View style={s.mediaWrap}>
            {isVideo && <VideoPlayer uri={mediaUrl} isVisible={isVisible} />}

            {isImage && (
              <Image source={{ uri: mediaUrl }} style={s.media} resizeMode="cover" />
            )}

            {isAudio && <AudioPlayer uri={mediaUrl} />}

            {!mediaUrl && !isAudio && (
              <View style={s.noMedia}>
                <Ionicons name="image-outline" size={36} color={colors.dim} />
                <Text style={{ color: colors.dim, marginTop: 6 }}>No media</Text>
              </View>
            )}

            {/* music pill on image/video */}
            {mediaUrl && !isAudio && story.music_name && (
              <View style={s.musicPill}>
                <Ionicons name="musical-notes" size={12} color="#fff" />
                <Text style={s.musicPillText} numberOfLines={1}>{story.music_name}</Text>
              </View>
            )}

            {/* double-tap heart */}
            <Animated.View pointerEvents="none" style={[s.heartBurst, {
              opacity: heartAnim,
              transform: [{ scale: heartAnim }],
            }]}>
              <Ionicons name="heart" size={80} color="#e11d48" />
            </Animated.View>
          </View>
        </Pressable>

        {/* ── ACTIONS ── */}
        <View style={s.actions}>
          <View style={s.actionsLeft}>
            <TouchableOpacity onPress={toggleLike} style={s.actionBtn}>
              <Ionicons name={liked ? 'heart' : 'heart-outline'} size={27} color={liked ? '#e11d48' : colors.text} />
            </TouchableOpacity>
            <TouchableOpacity onPress={openComments} style={s.actionBtn}>
              <Ionicons name="chatbubble-outline" size={25} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleShare} style={s.actionBtn}>
              <Ionicons name="paper-plane-outline" size={25} color={colors.text} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={toggleSave}>
            <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={25} color={saved ? colors.primary : colors.text} />
          </TouchableOpacity>
        </View>

        {/* ── LIKES ── */}
        {likeCount > 0 && (
          <Text style={s.likeCount}>{likeCount.toLocaleString()} {likeCount === 1 ? 'like' : 'likes'}</Text>
        )}

        {/* ── CAPTION ── */}
        <View style={s.captionWrap}>
          <Text style={s.caption}>
            <Text style={s.captionUser}>{story.author_name} </Text>
            <Text style={s.captionText}>{story.title}</Text>
          </Text>
          {story.content ? <Text style={s.captionBody}>{story.content}</Text> : null}
        </View>

        {/* ── MUSIC ROW (below caption) ── */}
        {story.music_name && (
          <View style={s.musicRow}>
            <LinearGradient colors={['#7c3aed', '#3b82f6']} style={s.musicIcon}>
              <Ionicons name="musical-notes" size={10} color="#fff" />
            </LinearGradient>
            <Text style={s.musicRowText} numberOfLines={1}>{story.music_name}</Text>
          </View>
        )}

        {/* ── AI SUMMARY ── */}
        {story.summary ? (
          <View style={s.aiBox}>
            <Ionicons name="sparkles" size={12} color={colors.primary} />
            <Text style={s.aiText}>{story.summary}</Text>
          </View>
        ) : null}

        {/* ── TAGS ── */}
        {story.tags?.length > 0 && (
          <View style={s.tagsRow}>
            {story.tags.map((t, i) => <Text key={i} style={s.tag}>#{t} </Text>)}
          </View>
        )}

        {/* ── VIEW COMMENTS ── */}
        {commentCount > 0 && (
          <TouchableOpacity onPress={openComments}>
            <Text style={s.viewComments}>View all {commentCount} comments</Text>
          </TouchableOpacity>
        )}

        <Text style={s.timestamp}>{timeAgo(story.created_at).toUpperCase()}</Text>
      </View>

      {/* ── THREE DOTS MENU ── */}
      <Modal visible={showMenu} transparent animationType="slide">
        <TouchableOpacity style={s.menuOverlay} onPress={() => setShowMenu(false)} activeOpacity={1}>
          <View style={s.menuSheet}>
            <View style={s.sheetHandle} />

            {isOwner && (
              <TouchableOpacity style={s.menuItem} onPress={handleDelete}>
                <Ionicons name="trash-outline" size={22} color="#e11d48" />
                <Text style={[s.menuText, { color: '#e11d48' }]}>Delete Story</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={s.menuItem} onPress={handleShare}>
              <Ionicons name="share-outline" size={22} color={colors.text} />
              <Text style={s.menuText}>Share</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.menuItem} onPress={toggleSave}>
              <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={22} color={colors.text} />
              <Text style={s.menuText}>{saved ? 'Remove from Saved' : 'Save'}</Text>
            </TouchableOpacity>

            {!isOwner && (
              <TouchableOpacity style={s.menuItem} onPress={handleReport}>
                <Ionicons name="flag-outline" size={22} color={colors.muted} />
                <Text style={[s.menuText, { color: colors.muted }]}>Report</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={[s.menuItem, { borderTopWidth: 0.5, borderTopColor: colors.border }]} onPress={() => setShowMenu(false)}>
              <Text style={[s.menuText, { textAlign: 'center', flex: 1 }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── COMMENTS MODAL ── */}
      <Modal visible={showComments} animationType="slide" transparent>
        <KeyboardAvoidingView style={s.commentsWrap} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.commentsSheet}>
            <View style={s.sheetHandle} />
            <View style={s.commentsHeader}>
              <Text style={s.commentsTitle}>Comments</Text>
              <TouchableOpacity onPress={() => setShowComments(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {loadingComments ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} />
            ) : (
              <FlatList
                data={comments}
                keyExtractor={(_, i) => String(i)}
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 16 }}
                ListEmptyComponent={
                  <Text style={{ color: colors.dim, textAlign: 'center', marginTop: 20 }}>No comments yet. Be first!</Text>
                }
                renderItem={({ item }) => (
                  <View style={s.commentRow}>
                    <TouchableOpacity onPress={() => navigation?.navigate('UserProfile', { userId: item.user_id, userName: item.author_name })}>
                      <View style={s.commentAvatar}>
                        <Text style={s.commentAvatarText}>{item.author_name?.[0] || 'U'}</Text>
                      </View>
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                      <Text style={s.commentText}>
                        <Text style={s.commentName} onPress={() => navigation?.navigate('UserProfile', { userId: item.user_id, userName: item.author_name })}>{item.author_name} </Text>
                        {item.text}
                      </Text>
                      <Text style={s.commentTime}>{timeAgo(item.created_at)}</Text>
                    </View>
                  </View>
                )}
              />
            )}

            <View style={s.commentInputRow}>
              <View style={s.commentAvatar}>
                <Text style={s.commentAvatarText}>{user?.name?.[0] || 'U'}</Text>
              </View>
              <TextInput
                style={s.commentInput}
                placeholder="Add a comment..."
                placeholderTextColor={colors.dim}
                value={commentText}
                onChangeText={setCommentText}
                multiline
              />
              <TouchableOpacity onPress={postComment} disabled={posting || !commentText.trim()}>
                {posting
                  ? <ActivityIndicator size="small" color={colors.primary} />
                  : <Text style={[s.postBtn, !commentText.trim() && { opacity: 0.4 }]}>Post</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.bg, marginBottom: 8, borderBottomWidth: 0.5, borderBottomColor: colors.border },

  // header
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 10 },
  avatarBtn: { },
  avatarRing: { width: 42, height: 42, borderRadius: 21, padding: 2, alignItems: 'center', justifyContent: 'center' },
  avatarInner: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden', backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.bg },
  avatarImg: { width: '100%', height: '100%' },
  avatarLetter: { color: '#fff', fontWeight: '700', fontSize: 15 },
  username: { fontSize: 13, fontWeight: '700', color: colors.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 },
  metaText: { fontSize: 11, color: colors.muted },
  metaDot: { fontSize: 11, color: colors.dim },

  // media
  mediaWrap: { width: '100%', minHeight: 300, backgroundColor: '#000', position: 'relative', justifyContent: 'center', alignItems: 'center' },
  media: { width: '100%', height: 420 },
  noMedia: { height: 200, alignItems: 'center', justifyContent: 'center' },
  musicPill: { position: 'absolute', bottom: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, maxWidth: '60%' },
  musicPillText: { color: '#fff', fontSize: 11 },
  heartBurst: { position: 'absolute', alignSelf: 'center' },

  // actions
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8 },
  actionsLeft: { flexDirection: 'row', gap: 4 },
  actionBtn: { padding: 4 },

  // text
  likeCount: { paddingHorizontal: 14, fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 4 },
  captionWrap: { paddingHorizontal: 14, marginBottom: 6 },
  caption: { fontSize: 13, color: colors.text, lineHeight: 18 },
  captionUser: { fontWeight: '700' },
  captionText: { fontWeight: '400' },
  captionBody: { fontSize: 13, color: colors.muted, marginTop: 3, lineHeight: 18 },

  // music row
  musicRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, marginBottom: 6 },
  musicIcon: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  musicRowText: { fontSize: 12, color: colors.muted, flex: 1 },

  // ai + tags
  aiBox: { flexDirection: 'row', gap: 6, marginHorizontal: 14, marginBottom: 6, backgroundColor: '#1a0a2e', padding: 8, borderRadius: 8 },
  aiText: { fontSize: 12, color: '#ccc', flex: 1 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 14, marginBottom: 4 },
  tag: { color: '#60a5fa', fontSize: 13 },
  viewComments: { paddingHorizontal: 14, color: colors.muted, fontSize: 13, marginBottom: 4 },
  timestamp: { paddingHorizontal: 14, paddingBottom: 12, fontSize: 10, color: colors.dim, letterSpacing: 0.5 },

  // menu sheet
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  menuSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 34 },
  sheetHandle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18 },
  menuText: { fontSize: 15, color: colors.text, fontWeight: '500' },

  // comments
  commentsWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  commentsSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '75%' },
  commentsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  commentsTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  commentRow: { flexDirection: 'row', gap: 10, marginBottom: 18, alignItems: 'flex-start' },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  commentAvatarText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  commentText: { fontSize: 13, color: colors.text, lineHeight: 18 },
  commentName: { fontWeight: '700' },
  commentTime: { fontSize: 11, color: colors.muted, marginTop: 2 },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderTopWidth: 0.5, borderTopColor: colors.border },
  commentInput: { flex: 1, color: colors.text, fontSize: 14, maxHeight: 80 },
  postBtn: { color: '#4f9eff', fontWeight: '700', fontSize: 14 },
});
