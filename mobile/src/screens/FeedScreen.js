import { useEffect, useState, useCallback, useRef, memo } from "react";
import { Audio } from 'expo-av';
import {
  View, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image, RefreshControl,
  Modal, TextInput, Alert, Dimensions, ScrollView,
} from "react-native";
import { HexAvatar } from './StoryViewerScreen';
import AppText from '../components/AppText';
import { StatusBar } from "expo-status-bar";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";
import api from "../api/axios";
import { colors, radius } from "../theme";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import VideoPlayer from "../components/VideoPlayer";
import { useTranslation } from "../i18n";

const { width } = Dimensions.get("window");

function timeAgo(dateStr) {
  // Fix: Server returns UTC without 'Z', so append it to force UTC parsing
  const utcDate = dateStr.endsWith('Z') ? dateStr : dateStr + 'Z';
  const diff = (Date.now() - new Date(utcDate)) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(utcDate).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Join Family Modal ──────────────────────────────────────────
function JoinFamilyModal({ visible, onClose, onJoined }) {
  const { refreshUser } = useAuth();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleJoin = async () => {
    if (!code.trim()) return setError("Enter an invite code");
    setError(""); setLoading(true);
    try {
      await api.post("/family/join", { invite_code: code.trim().toUpperCase() });
      await refreshUser();
      onJoined?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || "Invalid invite code");
    } finally { setLoading(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <BlurView intensity={20} tint="dark" style={jf.overlay}>
        <View style={jf.sheet}>
          <LinearGradient colors={["rgba(124,58,237,0.15)", "#0f172a"]} style={StyleSheet.absoluteFill} />
          <View style={jf.handle} />
          <TouchableOpacity style={jf.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={22} color={theme.muted} />
          </TouchableOpacity>

          <LinearGradient colors={["#7c3aed", "#3b82f6"]} style={jf.iconWrap}>
            <Ionicons name="key" size={28} color="#fff" />
          </LinearGradient>
          <AppText style={jf.title}>Join a Family</AppText>
          <AppText style={jf.sub}>Enter the 8-character invite code from your family admin</AppText>

          {error ? (
            <View style={jf.errorBox}>
              <Ionicons name="alert-circle" size={14} color="#f87171" />
              <AppText style={jf.errorText}>{error}</AppText>
            </View>
          ) : null}

          <TextInput
            style={jf.codeInput}
            placeholder="AB12CD34"
            placeholderTextColor={colors.dim}
            autoCapitalize="characters"
            value={code}
            onChangeText={v => { setCode(v.toUpperCase()); setError(""); }}
            maxLength={8}
          />

          <TouchableOpacity style={jf.joinBtn} onPress={handleJoin} disabled={loading} activeOpacity={0.85}>
            <LinearGradient colors={["#7c3aed", "#3b82f6"]} style={jf.joinBtnGrad}>
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : <AppText style={jf.joinBtnText}>Join Family</AppText>}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </BlurView>
    </Modal>
  );
}

const jf = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: "hidden", padding: 24, paddingBottom: 48 },
  handle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  closeBtn: { position: "absolute", top: 20, right: 20, padding: 4 },
  iconWrap: { width: 60, height: 60, borderRadius: 20, alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 16 },
  title: { fontSize: 22, fontWeight: "800", color: colors.text, textAlign: "center", marginBottom: 6 },
  sub: { fontSize: 13, color: colors.muted, textAlign: "center", marginBottom: 20, lineHeight: 19 },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(248,113,113,0.1)", borderWidth: 1, borderColor: "rgba(248,113,113,0.3)", borderRadius: radius.sm, padding: 10, marginBottom: 14 },
  errorText: { color: "#f87171", fontSize: 12, flex: 1 },
  codeInput: { backgroundColor: "rgba(30,41,59,0.9)", borderWidth: 1.5, borderColor: "rgba(124,58,237,0.4)", borderRadius: radius.md, padding: 16, color: "#a78bfa", fontSize: 26, fontWeight: "800", letterSpacing: 10, textAlign: "center", marginBottom: 16 },
  joinBtn: { borderRadius: radius.md, overflow: "hidden" },
  joinBtnGrad: { paddingVertical: 15, alignItems: "center" },
  joinBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});

// ── Share Post Modal ──────────────────────────────────────────
function SharePostModal({ visible, postId, onClose }) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [sending, setSending] = useState(null);
  const [sent, setSent] = useState(new Set());

  useEffect(() => {
    if (!visible) { setQuery(""); setUsers([]); setSent(new Set()); return; }
    api.get("/connections/suggestions").then(({ data }) => setUsers(data.suggestions || [])).catch(() => {});
  }, [visible]);

  const handleSearch = async (q) => {
    setQuery(q);
    if (!q.trim()) {
      api.get("/connections/suggestions").then(({ data }) => setUsers(data.suggestions || [])).catch(() => {});
      return;
    }
    try {
      const { data } = await api.get(`/connections/search?q=${q}`);
      setUsers(data.users || []);
    } catch {}
  };

  const shareToUser = async (userId) => {
    setSending(userId);
    try {
      await api.post(`/posts/${postId}/share`, { to_user_id: userId });
      setSent(prev => new Set([...prev, userId]));
    } catch {} finally { setSending(null); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <BlurView intensity={20} tint="dark" style={{ flex: 1, justifyContent: "flex-end" }}>
        <View style={[sp.sheet, { backgroundColor: theme.surface }]}>
          <View style={[sp.handle, { backgroundColor: theme.border }]} />
          <View style={[sp.header, { borderBottomColor: theme.border }]}>
            <AppText style={[sp.title, { color: theme.text }]}>Share Post</AppText>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={theme.muted} /></TouchableOpacity>
          </View>
          <View style={[sp.searchWrap, { backgroundColor: theme.bgSecondary }]}>
            <Ionicons name="search" size={15} color={theme.dim} />
            <TextInput style={[sp.searchInput, { color: theme.text }]} placeholder={t('search_people')} placeholderTextColor={theme.dim} value={query} onChangeText={handleSearch} />
          </View>
          <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}>
            {users.map(u => (
              <View key={u.id} style={sp.userRow}>
                <View style={[sp.avatar, { backgroundColor: colors.primary }]}>
                  {u.avatar_url ? <Image source={{ uri: u.avatar_url }} style={{ width: 40, height: 40, borderRadius: 20 }} /> : <AppText style={sp.avatarLetter}>{u.name?.[0]?.toUpperCase()}</AppText>}
                </View>
                <View style={{ flex: 1 }}>
                  <AppText style={[sp.userName, { color: theme.text }]}>{u.name}</AppText>
                  <AppText style={[sp.userHandle, { color: theme.muted }]}>@{u.username || "user"}</AppText>
                </View>
                <TouchableOpacity
                  style={[sp.sendBtn, sent.has(u.id) && sp.sentBtn]}
                  onPress={() => shareToUser(u.id)}
                  disabled={sending === u.id || sent.has(u.id)}
                >
                  {sending === u.id ? <ActivityIndicator size="small" color="#fff" /> :
                    sent.has(u.id) ? <Ionicons name="checkmark" size={16} color="#fff" /> :
                    <AppText style={sp.sendBtnText}>{t('send')}</AppText>}
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      </BlurView>
    </Modal>
  );
}

const sp = StyleSheet.create({
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 40 },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginTop: 10, marginBottom: 8 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5 },
  title: { fontSize: 16, fontWeight: "700" },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginVertical: 10, paddingHorizontal: 12, paddingVertical: 9, borderRadius: radius.md },
  searchInput: { flex: 1, fontSize: 14 },
  userRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  avatarLetter: { color: "#fff", fontWeight: "700", fontSize: 16 },
  userName: { fontSize: 14, fontWeight: "600" },
  userHandle: { fontSize: 12 },
  sendBtn: { backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 7, borderRadius: radius.full, minWidth: 60, alignItems: "center" },
  sentBtn: { backgroundColor: "#10b981" },
  sendBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
});

// ── Post Card ──────────────────────────────────────────────────
const PostCard = memo(function PostCard({ post, onUpdate, navigation, isVisible }) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [liked, setLiked] = useState(post.liked_by_me || false);
  const [saved, setSaved] = useState(post.saved_by_me || false);
  const [likeCount, setLikeCount] = useState(post.like_count || 0);
  const [showComments, setShowComments] = useState(false);
  const [showFullCaption, setShowFullCaption] = useState(false);
  const isVideoPost = post.media_type === 'video' && !!post.media_url;
  const [showMediaViewer, setShowMediaViewer] = useState(false);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [posting, setPosting] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showCollabs, setShowCollabs] = useState(false);
  const lastTap = useRef(0);
  const scrollViewRef = useRef(null);
  const musicSoundRef = useRef(null);
  const [musicPlaying, setMusicPlaying] = useState(false);

  // Play/stop music when post becomes visible
  useEffect(() => {
    if (!post.music?.stream_url) return;

    let cancelled = false;

    const startMusic = async () => {
      // Always unload previous sound first
      try {
        if (musicSoundRef.current) {
          await musicSoundRef.current.stopAsync();
          await musicSoundRef.current.unloadAsync();
          musicSoundRef.current = null;
        }
      } catch {}

      if (cancelled) return;

      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });
        const { sound } = await Audio.Sound.createAsync(
          { uri: post.music.stream_url },
          {
            shouldPlay: true,
            positionMillis: (post.music.start_time || 0) * 1000,
            isLooping: false,
            volume: 0.7,
          },
          (status) => {
            if (status.isLoaded) {
              setMusicPlaying(status.isPlaying);
              if (status.didJustFinish) {
                setMusicPlaying(false);
              }
            }
          }
        );
        if (!cancelled) {
          musicSoundRef.current = sound;
          setMusicPlaying(true);
        } else {
          await sound.unloadAsync();
        }
      } catch (e) {
        console.log('Music play error:', e?.message);
      }
    };

    const stopMusic = async () => {
      try {
        if (musicSoundRef.current) {
          await musicSoundRef.current.stopAsync();
          await musicSoundRef.current.unloadAsync();
          musicSoundRef.current = null;
        }
      } catch {}
      setMusicPlaying(false);
    };

    if (isVisible) {
      startMusic();
    } else {
      stopMusic();
    }

    return () => {
      cancelled = true;
      stopMusic();
    };
  }, [isVisible, post.music?.stream_url]);

  // Fix: Re-sync liked state when post or user changes (account switch)
  useEffect(() => {
    setLiked(post.liked_by_me || false);
    setSaved(post.saved_by_me || false);
  }, [post.id, post.liked_by_me, post.saved_by_me, user?.id]);

  const mediaList = post.media_type === 'carousel' && post.media_urls?.length > 0
    ? post.media_urls
    : post.media_url
    ? [{ url: post.media_url, type: post.media_type }]
    : [];

  const toggleLike = async () => {
    const next = !liked;
    setLiked(next);
    setLikeCount(c => next ? c + 1 : c - 1);
    try { await api.post(`/posts/${post.id}/like`); }
    catch { setLiked(!next); setLikeCount(c => next ? c - 1 : c + 1); }
  };

  const toggleSave = async () => {
    const next = !saved;
    setSaved(next);
    try { await api.post(`/posts/${post.id}/save`); }
    catch { setSaved(!next); }
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300 && !liked) {
      setLiked(true);
      setLikeCount(c => c + 1);
      api.post(`/posts/${post.id}/like`).catch(() => {
        setLiked(false); setLikeCount(c => c - 1);
      });
    }
    lastTap.current = now;
  };

  const openComments = async () => {
    setShowComments(true);
    setLoadingComments(true);
    try {
      const { data } = await api.get(`/posts/${post.id}/comments`);
      setComments(data.comments || []);
    } catch {} finally { setLoadingComments(false); }
  };

  const postComment = async () => {
    if (!commentText.trim()) return;
    setPosting(true);
    try {
      const { data } = await api.post(`/posts/${post.id}/comments`, { text: commentText });
      setComments(c => [...c, { ...data.comment, author_name: user?.name, author_avatar: user?.avatar_url }]);
      setCommentText("");
    } catch {} finally { setPosting(false); }
  };

  const isOwner = post.user_id === user?.id;

  const renderHashtags = (text) => {
    if (!text) return null;
    const parts = text.split(/(#\w+)/);
    return parts.map((part, i) => 
      part.startsWith('#') 
        ? <AppText key={i} style={{ color: '#3b82f6', fontWeight: '600' }}>{part}</AppText>
        : <AppText key={i}>{part}</AppText>
    );
  };

  const handleScroll = (event) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / width);
    setCurrentMediaIndex(index);
  };

  return (
    <View style={pc.card}>
      {/* Header */}
      <View style={pc.header}>
        <TouchableOpacity
          onPress={() => navigation.navigate("UserProfile", { userId: post.user_id, userName: post.author_name, userAvatar: post.author_avatar })}
          activeOpacity={0.8}
        >
          <LinearGradient colors={["#7c3aed", "#3b82f6", "#ec4899"]} style={pc.avatarRing}>
            <View style={[pc.avatarInner, { backgroundColor: theme.primary, borderColor: theme.bg }]}>
              {post.author_avatar
                ? <Image source={{ uri: post.author_avatar }} style={pc.avatarImg} />
                : <AppText style={pc.avatarLetter}>{post.author_name?.[0]?.toUpperCase() || "?"}</AppText>}
            </View>
          </LinearGradient>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          {/* Author + collaborators line */}
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <TouchableOpacity onPress={() => navigation.navigate("UserProfile", { userId: post.user_id, userName: post.author_name, userAvatar: post.author_avatar })}>
              <AppText style={[pc.authorName, { color: theme.text }]}>{post.author_name}</AppText>
            </TouchableOpacity>
            {post.author_verified_badge && <Ionicons name="checkmark-circle" size={14} color="#3b82f6" />}
            {(() => {
              const collabs = post.collaborators || [];
              if (collabs.length === 0) return null;
              const first = collabs[0];
              const rest = collabs.length - 1;
              return (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                  <AppText style={{ color: theme.muted, fontSize: 12 }}> and </AppText>
                  <TouchableOpacity onPress={() => navigation.navigate("UserProfile", { userId: first.user_id, userName: first.name, userAvatar: first.avatar })}>
                    <AppText style={[pc.authorName, { color: theme.text }]}>{first.name}</AppText>
                  </TouchableOpacity>
                  {rest > 0 && (
                    <TouchableOpacity onPress={() => setShowCollabs(true)}>
                      <AppText style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}> and {rest} other{rest > 1 ? 's' : ''}</AppText>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })()}
          </View>
          <View style={pc.metaRow}>
            {post.location ? (
              <>
                <Ionicons name="location-outline" size={11} color={theme.muted} />
                <AppText style={[pc.metaText, { color: theme.muted }]}>{post.location}</AppText>
                <AppText style={[pc.dot, { color: theme.dim }]}>·</AppText>
              </>
            ) : null}
            <AppText style={[pc.metaText, { color: theme.muted }]}>{timeAgo(post.created_at)}</AppText>
            {post.privacy === "connections" && (
              <><AppText style={[pc.dot, { color: theme.dim }]}>·</AppText><Ionicons name="people-outline" size={11} color={theme.muted} /></>
            )}
            {post.is_sponsored && (
              <><AppText style={[pc.dot, { color: theme.dim }]}>·</AppText><AppText style={pc.sponsoredLabel}>Sponsored</AppText></>
            )}
          </View>
        </View>
        {isOwner && (
          <TouchableOpacity onPress={() => Alert.alert("Delete Post", "Remove this post?", [
            { text: t('cancel'), style: "cancel" },
            { text: t('delete'), style: "destructive", onPress: async () => {
              try { await api.delete(`/posts/${post.id}`); onUpdate?.(); } catch {}
            }},
          ])}>
            <Ionicons name="ellipsis-horizontal" size={20} color={theme.muted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Collaborators bottom sheet */}
      <Modal visible={showCollabs} transparent animationType="slide" onRequestClose={() => setShowCollabs(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={[pc.collabSheet, { backgroundColor: theme.bgCard }]}>
            <View style={pc.collabHandle} />
            <AppText style={[pc.collabSheetTitle, { color: theme.text }]}>Co-Creators</AppText>
            {[{ user_id: post.user_id, name: post.author_name, avatar: post.author_avatar, role: 'creator' }, ...(post.collaborators || [])].map((c, i) => (
              <TouchableOpacity
                key={i}
                style={pc.collabRow}
                onPress={() => { setShowCollabs(false); navigation.navigate("UserProfile", { userId: c.user_id, userName: c.name, userAvatar: c.avatar }); }}
              >
                <View style={[pc.collabAvatar, { backgroundColor: colors.primary }]}>
                  {c.avatar
                    ? <Image source={{ uri: c.avatar }} style={{ width: 44, height: 44, borderRadius: 22 }} />
                    : <AppText style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>{c.name?.[0]?.toUpperCase()}</AppText>}
                </View>
                <View style={{ flex: 1 }}>
                  <AppText style={[{ fontSize: 14, fontWeight: '700' }, { color: theme.text }]}>{c.name}</AppText>
                  {i === 0 && <AppText style={{ fontSize: 11, color: theme.muted }}>Original creator</AppText>}
                  {i > 0 && <AppText style={{ fontSize: 11, color: theme.muted }}>{c.role || 'Co-creator'}</AppText>}
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.muted} />
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[pc.collabCloseBtn, { borderColor: theme.border2 }]} onPress={() => setShowCollabs(false)}>
              <AppText style={{ color: theme.text, fontWeight: '600' }}>Close</AppText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Media - Video gets its own full card layout, images use carousel */}
      {mediaList.length > 0 && (() => {
        const isVideoPost = mediaList.length === 1 &&
          (mediaList[0].type === 'video' || mediaList[0].media_type === 'video');

        if (isVideoPost) {
          return (
            <View style={pc.videoCard}>
              <VideoPlayer
                uri={mediaList[0].url}
                isVisible={isVisible}
                feedMode
                onPress={() => navigation.navigate('Reels', { startPostId: post.id })}
              />
            </View>
          );
        }

        return (
          <View>
            <ScrollView
              ref={scrollViewRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={handleScroll}
              scrollEventThrottle={16}
            >
              {mediaList.map((media, idx) => (
                <TouchableOpacity
                  key={idx}
                  activeOpacity={1}
                  onPress={() => {
                    const now = Date.now();
                    if (now - lastTap.current < 300 && !liked) {
                      setLiked(true);
                      setLikeCount(c => c + 1);
                      api.post(`/posts/${post.id}/like`).catch(() => {
                        setLiked(false); setLikeCount(c => c - 1);
                      });
                    } else {
                      setShowMediaViewer(true);
                      setCurrentMediaIndex(idx);
                    }
                    lastTap.current = now;
                  }}
                >
                  <Image source={{ uri: media.url }} style={pc.media} resizeMode="cover" />
                </TouchableOpacity>
              ))}
            </ScrollView>
            {/* Music sticker overlaid on image */}
            {post.music?.title ? (
              <TouchableOpacity
                style={[
                  pc.musicOverlay,
                  !musicPlaying && { opacity: 0.7 },
                ]}
                onPress={async () => {
                  if (!musicSoundRef.current) return;
                  try {
                    if (musicPlaying) {
                      await musicSoundRef.current.pauseAsync();
                      setMusicPlaying(false);
                    } else {
                      await musicSoundRef.current.playAsync();
                      setMusicPlaying(true);
                    }
                  } catch {}
                }}
                activeOpacity={0.85}
              >
                <Ionicons
                  name={musicPlaying ? 'musical-notes' : 'musical-notes-outline'}
                  size={13}
                  color="#fff"
                />
                <AppText style={pc.musicOverlayText} numberOfLines={1}>
                  {post.music.title} · {post.music.artist}
                </AppText>
                <View style={pc.musicEqualizer}>
                  {[...Array(4)].map((_, i) => (
                    <View
                      key={i}
                      style={[
                        pc.musicBar,
                        {
                          height: musicPlaying ? 4 + (i % 3) * 5 : 3,
                          opacity: musicPlaying ? 1 : 0.4,
                          backgroundColor: musicPlaying ? '#a78bfa' : '#fff',
                        },
                      ]}
                    />
                  ))}
                </View>
              </TouchableOpacity>
            ) : null}
            {mediaList.length > 1 && (
              <View style={pc.carouselDots}>
                {mediaList.map((_, idx) => (
                  <View
                    key={idx}
                    style={[
                      pc.dot,
                      { backgroundColor: idx === currentMediaIndex ? '#3b82f6' : 'rgba(255,255,255,0.4)' }
                    ]}
                  />
                ))}
              </View>
            )}
          </View>
        );
      })()}

      {/* Actions / Likes / Caption / Timestamp */}
      {(
        <>
          {/* Actions */}
          <View style={pc.actions}>
            <View style={pc.actionsLeft}>
              <TouchableOpacity onPress={toggleLike} style={pc.actionBtn}>
                <Ionicons name={liked ? "heart" : "heart-outline"} size={26} color={liked ? "#e11d48" : theme.text} />
              </TouchableOpacity>
              <TouchableOpacity onPress={openComments} style={pc.actionBtn}>
                <Ionicons name="chatbubble-outline" size={24} color={theme.text} />
              </TouchableOpacity>
              <TouchableOpacity style={pc.actionBtn} onPress={() => setShowShare(true)}>
                <Ionicons name="paper-plane-outline" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={toggleSave} style={pc.actionBtn}>
              <Ionicons name={saved ? "bookmark" : "bookmark-outline"} size={24} color={saved ? theme.primary : theme.text} />
            </TouchableOpacity>
          </View>

          {/* Likes */}
          {likeCount > 0 && (
            <AppText style={pc.likeCount}>{likeCount.toLocaleString()} {likeCount === 1 ? "like" : "likes"}</AppText>
          )}

          {/* Caption */}
          {post.caption ? (
            <View style={pc.captionWrap}>
              <AppText style={pc.caption} numberOfLines={showFullCaption ? undefined : 2}>
                <AppText style={pc.captionName}>{post.author_name} </AppText>
                {renderHashtags(post.caption)}
              </AppText>
              {post.caption.length > 100 && (
                <TouchableOpacity onPress={() => setShowFullCaption(!showFullCaption)}>
                  <AppText style={pc.moreText}>{showFullCaption ? 'less' : 'more'}</AppText>
                </TouchableOpacity>
              )}
            </View>
          ) : null}

          {/* Hashtags */}
          {post.hashtags ? (
            <View style={pc.hashtagsWrap}>
              {post.hashtags.split(/\s+/).filter(Boolean).map((tag, i) => (
                <AppText key={i} style={pc.hashtagChip}>{tag.startsWith('#') ? tag : `#${tag}`}</AppText>
              ))}
            </View>
          ) : null}

          {/* View comments */}
          {post.comment_count > 0 && (
            <TouchableOpacity onPress={openComments}>
              <AppText style={pc.viewComments}>View all {post.comment_count} comments</AppText>
            </TouchableOpacity>
          )}

          <AppText style={pc.timestamp}>{timeAgo(post.created_at).toUpperCase()}</AppText>
        </>
      )}

      {/* Full Screen Media Viewer */}
      <Modal visible={showMediaViewer} transparent animationType="fade" onRequestClose={() => setShowMediaViewer(false)}>
        <View style={pc.mediaViewerOverlay}>
          <TouchableOpacity style={pc.mediaViewerClose} onPress={() => setShowMediaViewer(false)}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: currentMediaIndex * width, y: 0 }}
          >
            {mediaList.map((media, idx) => (
              <View key={idx} style={{ width, height: '100%', justifyContent: 'center' }}>
                <Image
                  source={{ uri: media.url }}
                  style={{ width, height: width }}
                  resizeMode="contain"
                />
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>

      <SharePostModal visible={showShare} postId={post.id} onClose={() => setShowShare(false)} />

      {/* Comments Modal */}
      <Modal visible={showComments} animationType="slide" transparent>
        <View style={pc.commentsOverlay}>
          <View style={[pc.commentsSheet, { backgroundColor: theme.surface }]}>
            <View style={[pc.sheetHandle, { backgroundColor: theme.border }]} />
            <View style={[pc.commentsHeader, { borderBottomColor: theme.border }]}>
              <AppText style={[pc.commentsTitle, { color: theme.text }]}>Comments</AppText>
              <TouchableOpacity onPress={() => setShowComments(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            {loadingComments ? (
              <ActivityIndicator color={theme.primary} style={{ marginTop: 30 }} />
            ) : (
              <FlatList
                data={comments}
                keyExtractor={(_, i) => String(i)}
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 16 }}
                ListEmptyComponent={<AppText style={{ color: theme.dim, textAlign: "center", marginTop: 20 }}>No comments yet</AppText>}
                renderItem={({ item }) => (
                  <View style={pc.commentRow}>
                    <View style={[pc.commentAvatar, { backgroundColor: theme.primary }]}>
                      {item.author_avatar
                        ? <Image source={{ uri: item.author_avatar }} style={pc.commentAvatarImg} />
                        : <AppText style={pc.commentAvatarText}>{item.author_name?.[0] || 'U'}</AppText>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <AppText style={[pc.commentText, { color: theme.text }]}>
                        <AppText style={[pc.commentName, { color: theme.text }]}>{item.author_name} </AppText>
                        {item.text}
                      </AppText>
                    </View>
                  </View>
                )}
              />
            )}
            <View style={[pc.commentInputRow, { borderTopColor: theme.border }]}>
              <View style={[pc.commentAvatar, { backgroundColor: theme.primary }]}>
                {user?.avatar_url
                  ? <Image source={{ uri: user.avatar_url }} style={pc.commentAvatarImg} />
                  : <AppText style={pc.commentAvatarText}>{user?.name?.[0] || 'U'}</AppText>}
              </View>
              <TextInput
                style={[pc.commentInput, { color: theme.text }]}
                placeholder={t('add_comment')}
                placeholderTextColor={theme.dim}
                value={commentText}
                onChangeText={setCommentText}
              />
              <TouchableOpacity onPress={postComment} disabled={posting || !commentText.trim()}>
                {posting
                  ? <ActivityIndicator size="small" color={theme.primary} />
                  : <AppText style={[pc.postBtn, !commentText.trim() && { opacity: 0.4 }]}>{t('post')}</AppText>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
});

const pc = StyleSheet.create({
  card: { backgroundColor: colors.bg, marginBottom: 8, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, gap: 10 },
  avatarRing: { width: 40, height: 40, borderRadius: 20, padding: 2, alignItems: "center", justifyContent: "center" },
  avatarInner: { width: 34, height: 34, borderRadius: 17, overflow: "hidden", backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.bg },
  avatarImg: { width: "100%", height: "100%" },
  avatarLetter: { color: "#fff", fontWeight: "700", fontSize: 13 },
  authorName: { fontSize: 13, fontWeight: "700", color: colors.text },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 1 },
  metaText: { fontSize: 11, color: colors.muted },
  sponsoredLabel: { fontSize: 10, color: '#f59e0b', fontWeight: '700', backgroundColor: 'rgba(245,158,11,0.12)', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  dot: { fontSize: 11, color: colors.dim },
  videoCard: { width, backgroundColor: '#000' },
  media: { width, height: width },
  actions: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8 },
  actionsLeft: { flexDirection: "row", gap: 4 },
  actionBtn: { padding: 4 },
  likeCount: { paddingHorizontal: 14, fontSize: 13, fontWeight: "700", color: colors.text, marginBottom: 4 },
  captionWrap: { paddingHorizontal: 14, marginBottom: 4 },
  caption: { fontSize: 13, color: colors.text, lineHeight: 18 },
  captionName: { fontWeight: "700" },
  moreText: { color: colors.muted, fontSize: 13, marginTop: 2 },
  carouselDots: { position: 'absolute', bottom: 12, alignSelf: 'center', flexDirection: 'row', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  mediaViewerOverlay: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  mediaViewerClose: { position: 'absolute', top: 52, right: 16, zIndex: 10, padding: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
  musicOverlay: { position: 'absolute', bottom: 12, left: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 },
  musicOverlayText: { flex: 1, fontSize: 12, color: '#fff', fontWeight: '600' },
  musicEqualizer: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  musicBar: { width: 3, borderRadius: 2, backgroundColor: '#a78bfa' },
  musicSticker: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 5, marginBottom: 4 },
  musicStickerText: { fontSize: 12, color: '#a78bfa', fontWeight: '600', flex: 1 },
  collabSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingBottom: 36 },
  collabHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(100,116,139,0.4)', alignSelf: 'center', marginBottom: 12 },
  collabSheetTitle: { fontSize: 16, fontWeight: '700', paddingHorizontal: 16, marginBottom: 12 },
  collabRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  collabAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  collabCloseBtn: { margin: 16, padding: 14, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  hashtagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 14, marginBottom: 6 },
  hashtagChip: { fontSize: 13, color: '#3b82f6', fontWeight: '600' },
  viewComments: { paddingHorizontal: 14, color: colors.muted, fontSize: 13, marginBottom: 4 },
  timestamp: { paddingHorizontal: 14, paddingBottom: 10, fontSize: 10, color: colors.dim, letterSpacing: 0.5 },
  commentsOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  commentsSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, height: "75%" },
  sheetHandle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: "center", marginTop: 10, marginBottom: 4 },
  commentsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  commentsTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  commentRow: { flexDirection: "row", gap: 10, marginBottom: 16, alignItems: "flex-start" },
  commentAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", overflow: 'hidden' },
  commentAvatarImg: { width: 30, height: 30, borderRadius: 15 },
  commentAvatarText: { color: "#fff", fontWeight: "700", fontSize: 11 },
  commentText: { fontSize: 13, color: colors.text, lineHeight: 18 },
  commentName: { fontWeight: "700" },
  commentInputRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderTopWidth: 0.5, borderTopColor: colors.border },
  commentInput: { flex: 1, color: colors.text, fontSize: 14 },
  postBtn: { color: "#4f9eff", fontWeight: "700", fontSize: 14 },
});

// ── Feed Screen ────────────────────────────────────────────────
export default function FeedScreen({ navigation }) {
  const { user } = useAuth();
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();
  const [posts, setPosts] = useState([]);
  const [storyGroups, setStoryGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showJoinFamily, setShowJoinFamily] = useState(false);
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const [biometricType, setBiometricType] = useState('fingerprint');
  const [visiblePostId, setVisiblePostId] = useState(null);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60,  // post must be 60% visible to count
  }).current;

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setVisiblePostId(viewableItems[0].item.id);
    }
  }).current;

  // Check if we should show biometric prompt after login
  useEffect(() => {
    const checkBiometricPrompt = async () => {
      try {
        const shouldShow = await AsyncStorage.getItem('show_biometric_prompt');
        if (shouldShow === 'true') {
          await AsyncStorage.removeItem('show_biometric_prompt');
          const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
          const hasFace = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
          setBiometricType(hasFace ? 'face' : 'fingerprint');
          setTimeout(() => setShowBiometricPrompt(true), 1500);
        }
      } catch {}
    };
    checkBiometricPrompt();
  }, []);

  const fetchFeed = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [postsRes, storiesRes] = await Promise.all([
        api.get("/posts/feed"),
        api.get("/pstories/feed").catch(() => ({ data: { story_groups: [] } })),
      ]);
      setPosts(postsRes.data?.posts || []);
      setStoryGroups(storiesRes.data?.story_groups || []);
    } catch (err) {
      console.log("Feed error:", err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchUnread = useCallback(async () => {
    try {
      const { data } = await api.get("/notifications/count");
      setUnreadCount(data?.unread_count || 0);
    } catch {}
  }, []);

  useEffect(() => { fetchFeed(); fetchUnread(); }, []);

  useFocusEffect(useCallback(() => {
    fetchFeed(true);
    fetchUnread();
    // Re-enable audio when screen comes back into focus
    import('expo-av').then(({ Audio }) => {
      Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      }).catch(() => {});
    }).catch(() => {});
    // Return cleanup: when screen loses focus, stop all videos by clearing visiblePostId
    // and deactivate the audio session so sound stops immediately
    return () => {
      setVisiblePostId(null);
      import('expo-av').then(({ Audio }) => {
        Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: false,
          staysActiveInBackground: false,
        }).catch(() => {});
      }).catch(() => {});
    };
  }, []));

  // Reset badge immediately when Notifications screen is focused
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchUnread();
    });
    return unsubscribe;
  }, [navigation, fetchUnread]);

  // Also reset badge to 0 immediately when navigating TO Notifications
  // by listening for state changes — when Notifications is in the stack, badge = 0
  useEffect(() => {
    const unsubscribeState = navigation.addListener('state', () => {
      const routes = navigation.getState()?.routes || [];
      const onNotifications = routes.some(r => r.name === 'Notifications');
      if (onNotifications) setUnreadCount(0);
      else fetchUnread();
    });
    return unsubscribeState;
  }, [navigation, fetchUnread]);

  const ListHeader = () => (
    <View>
      {/* Stories Row */}
      {storyGroups.length >= 0 && (
        <View style={s.storiesWrap}>
          <LinearGradient
            colors={['rgba(45,90,39,0.18)', 'rgba(28,26,20,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={s.storiesBgGrad}
          />

          {/* Section header */}
          <View style={s.storiesHeader}>
            <View style={s.storiesHeaderLeft}>
              <View style={s.storiesHeaderDot} />
              <AppText style={[s.storiesHeaderTitle, { color: theme.text }]}>Stories</AppText>
            </View>
            {storyGroups.filter(g => !g.is_self && g.has_unseen).length > 0 && (
              <View style={s.storiesUnseenBadge}>
                <AppText style={s.storiesUnseenText}>
                  {storyGroups.filter(g => !g.is_self && g.has_unseen).length} new
                </AppText>
              </View>
            )}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.storiesRow}>
            {/* ── YOUR STORY (always first) ── */}
            {(() => {
              const myGroup = storyGroups.find(g => g.is_self);
              const hasMyStory = myGroup && myGroup.stories.length > 0;
              return (
                <TouchableOpacity
                  style={s.storyItem}
                  activeOpacity={0.85}
                  onPress={() => {
                    if (hasMyStory) {
                      const idx = storyGroups.indexOf(myGroup);
                      navigation.navigate('StoryViewer', { storyGroups, initialGroupIndex: idx });
                    } else {
                      navigation.navigate('Create', { initialMode: 'story' });
                    }
                  }}
                >
                  <View style={[s.storyGlow, { backgroundColor: hasMyStory ? 'rgba(74,124,63,0.3)' : 'rgba(196,163,90,0.12)' }]} />
                  <View style={s.hexWrap}>
                    <HexAvatar
                      uri={user?.avatar_url}
                      name={user?.name}
                      size={54}
                      hasStory={hasMyStory}
                      hasSeen={false}
                    />
                    {/* Plus badge */}
                    <View style={[s.plusBadge, { backgroundColor: theme.primary }]}>
                      <Ionicons name="add" size={12} color="#fff" />
                    </View>
                  </View>
                  <AppText style={[s.storyLabel, { color: theme.text }]}>Your Story</AppText>
                </TouchableOpacity>
              );
            })()}

            {/* ── CONNECTED USERS' STORIES ── */}
            {storyGroups.filter(g => !g.is_self).map((group, idx) => {
              const realIdx = storyGroups.indexOf(group);
              const unseen = group.has_unseen;
              return (
                <TouchableOpacity
                  key={group.user_id}
                  style={s.storyItem}
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate('StoryViewer', { storyGroups, initialGroupIndex: realIdx })}
                >
                  <View style={[s.storyGlow, { backgroundColor: unseen ? 'rgba(74,124,63,0.3)' : 'transparent' }]} />
                  <View style={s.hexWrap}>
                    <HexAvatar
                      uri={group.author_avatar}
                      name={group.author_name}
                      size={54}
                      hasStory={group.stories.length > 0}
                      hasSeen={!unseen}
                    />
                  </View>
                  <AppText style={[s.storyLabel, { color: unseen ? theme.text : theme.muted }]} numberOfLines={1}>
                    {group.author_name?.split(' ')[0] || 'User'}
                  </AppText>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Family Banner */}
      <TouchableOpacity
        style={s.familyBanner}
        onPress={() => user?.family_id ? navigation.navigate('Family') : setShowJoinFamily(true)}
        activeOpacity={0.88}
      >
        <LinearGradient
          colors={user?.family_id ? ['#3b0764', '#7C3AED', '#3b82f6'] : ['#1e1b4b', '#312e81', '#4338ca']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.familyBannerGrad}
        >
          {/* Decorative circle top-right */}
          <View style={s.familyDecorCircle} />
          <View style={s.familyDecorCircle2} />

          <View style={s.familyBannerLeft}>
            {/* Icon block */}
            <View style={s.familyIconWrap}>
              <LinearGradient
                colors={user?.family_id ? ['#7C3AED', '#3b82f6'] : ['#6366f1', '#8b5cf6']}
                style={s.familyIconGrad}
              >
                <Ionicons
                  name={user?.family_id ? 'people' : 'people-outline'}
                  size={24}
                  color="#fff"
                />
              </LinearGradient>
            </View>

            {/* Text block */}
            <View style={s.familyTextBlock}>
              <View style={s.familyTitleRow}>
                <AppText style={s.familyBannerTitle}>
                  {user?.family_id ? 'Your Family' : 'Join a Family'}
                </AppText>
                {user?.family_id && (
                  <View style={s.familyLiveBadge}>
                    <View style={s.familyLiveDot} />
                    <AppText style={s.familyLiveText}>Active</AppText>
                  </View>
                )}
              </View>
              <AppText style={s.familyBannerSub}>
                {user?.family_id
                  ? 'Stories, memories & moments'
                  : 'Connect with your loved ones'}
              </AppText>
            </View>
          </View>

          {/* Right side */}
          <View style={s.familyBannerRight}>
            <View style={s.familyChevronWrap}>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.9)" />
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {posts.length > 0 && (
        <View style={s.feedLabel}>
          <View style={s.feedLabelLeft}>
            <View style={s.feedLabelAccent} />
            <AppText style={s.feedLabelText}>Your Feed</AppText>
          </View>
          <View style={s.feedLabelLine} />
        </View>
      )}
    </View>
  );

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header */}
      <LinearGradient
        colors={[theme.mode === 'dark' ? '#1C1A14' : '#F5F0E8', 'transparent']}
        style={s.headerGrad}
      >
        <View style={[s.header, { borderBottomColor: theme.border }]}>

          {/* LEFT — Logo */}
          <View style={s.logoWrap}>
            <View style={s.logoImgWrap}>
              <Image
                source={require("../../assets/kinscribe-logo.png")}
                style={s.logoIcon}
                resizeMode="cover"
              />
            </View>
            <View>
              <AppText style={[s.logo, { color: theme.text }]}>KinsCribe</AppText>
              <AppText style={[s.logoSub, { color: theme.muted }]}>Family Network</AppText>
            </View>
          </View>

          {/* RIGHT — Buttons */}
          <View style={s.headerRight}>

            {/* Notifications */}
            <TouchableOpacity
              onPress={() => navigation.navigate("Notifications")}
              style={[s.headerBtn, { backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }]}
            >
              <Ionicons name="notifications-outline" size={20} color={theme.text} />
              {unreadCount > 0 && (
                <View style={s.badge}>
                  <AppText style={s.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</AppText>
                </View>
              )}
            </TouchableOpacity>

            {/* AI Button */}
            <TouchableOpacity
              onPress={() => navigation.navigate("FeedAI")}
              style={s.aiBtn}
            >
              <LinearGradient
                colors={['#7C3AED', '#3b82f6']}
                style={s.aiBtnGrad}
              >
                <Ionicons name="sparkles" size={16} color="#fff" />
                <AppText style={s.aiBtnText}>AI</AppText>
              </LinearGradient>
            </TouchableOpacity>

          </View>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator color={theme.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={i => String(i.id)}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              navigation={navigation}
              onUpdate={() => fetchFeed(true)}
              isVisible={item.id === visiblePostId}
            />
          )}
          ListHeaderComponent={<ListHeader />}
          contentContainerStyle={{ paddingBottom: 110 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchFeed(true); }}
              tintColor={theme.primary}
            />
          }
          showsVerticalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <LinearGradient colors={["rgba(124,58,237,0.15)", "rgba(59,130,246,0.1)"]} style={s.emptyCard}>
                <Ionicons name="people-outline" size={52} color={theme.primary} />
                <AppText style={[s.emptyTitle, { color: theme.text }]}>{t('feed_empty')}</AppText>
                <AppText style={[s.emptySub, { color: theme.muted }]}>
                  {t('feed_empty_sub')}
                </AppText>
                <TouchableOpacity
                  style={s.discoverBtn}
                  onPress={() => navigation.navigate("Search")}
                  activeOpacity={0.85}
                >
                  <LinearGradient colors={["#7c3aed", "#3b82f6"]} style={s.discoverBtnGrad}>
                    <Ionicons name="compass-outline" size={18} color="#fff" />
                    <AppText style={s.discoverBtnText}>{t('discover')}</AppText>
                  </LinearGradient>
                </TouchableOpacity>
              </LinearGradient>
            </View>
          }
        />
      )}

      <JoinFamilyModal
        visible={showJoinFamily}
        onClose={() => setShowJoinFamily(false)}
        onJoined={() => fetchFeed(true)}
      />

      {/* Floating KinsCribe AI button */}
      <TouchableOpacity
        style={fs.aiFloatBtn}
        onPress={() => navigation.navigate('FeedAI')}
        activeOpacity={0.85}
      >
        <LinearGradient colors={['#7c3aed', '#3b82f6', '#06b6d4']} style={fs.aiFloatGrad}>
          <Ionicons name="sparkles" size={22} color="#fff" />
        </LinearGradient>
        <View style={fs.aiFloatGlow} />
      </TouchableOpacity>

      {/* Biometric Enable Prompt */}
      <Modal visible={showBiometricPrompt} transparent animationType="fade">
        <View style={bm.overlay}>
          <BlurView intensity={20} tint="dark" style={bm.card}>
            <LinearGradient colors={['rgba(124,58,237,0.12)', 'rgba(15,23,42,0.98)']} style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['#7c3aed', '#3b82f6']} style={bm.iconWrap}>
              <Ionicons name={biometricType === 'face' ? 'scan-outline' : 'finger-print'} size={36} color="#fff" />
            </LinearGradient>
            <AppText style={bm.title}>Enable {biometricType === 'face' ? 'Face ID' : 'Fingerprint'} Login</AppText>
            <AppText style={bm.sub}>Sign in faster next time using{`\n`}{biometricType === 'face' ? 'Face ID' : 'your fingerprint'}.</AppText>
            <View style={bm.features}>
              {[
                { icon: 'flash-outline', text: 'One tap sign in' },
                { icon: 'shield-checkmark-outline', text: 'Secure & encrypted' },
                { icon: 'eye-off-outline', text: 'No password needed' },
              ].map((f, i) => (
                <View key={i} style={bm.featureRow}>
                  <View style={bm.featureIcon}>
                    <Ionicons name={f.icon} size={16} color="#7c3aed" />
                  </View>
                  <AppText style={bm.featureText}>{f.text}</AppText>
                </View>
              ))}
            </View>
            <TouchableOpacity
              style={bm.enableBtn}
              activeOpacity={0.85}
              onPress={async () => {
                await AsyncStorage.setItem('biometric_enabled', 'true');
                setShowBiometricPrompt(false);
              }}
            >
              <LinearGradient colors={['#7c3aed', '#3b82f6']} style={bm.enableBtnGrad}>
                <Ionicons name={biometricType === 'face' ? 'scan-outline' : 'finger-print'} size={18} color="#fff" />
                <AppText style={bm.enableBtnText}>Enable {biometricType === 'face' ? 'Face ID' : 'Fingerprint'} Login</AppText>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={bm.skipBtn} onPress={() => setShowBiometricPrompt(false)}>
              <AppText style={bm.skipText}>{t('not_now')}</AppText>
            </TouchableOpacity>
          </BlurView>
        </View>
      </Modal>

    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  headerGrad: {
    paddingTop: 0,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
  },
  logoWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logoImgWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(196,163,90,0.3)',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  logoIcon: {
    width: '100%',
    height: '100%',
  },
  logo: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: 0.3,
  },
  logoSub: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.muted,
    letterSpacing: 0.5,
    marginTop: -1,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: 'center',
    gap: 8,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: "absolute",
    top: 2,
    right: 2,
    backgroundColor: "#C0392B",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "800",
  },
  aiBtn: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  aiBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  aiBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },

  storiesWrap: {
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    overflow: 'hidden',
  },
  storiesBgGrad: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
  },
  storiesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  storiesHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  storiesHeaderDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  storiesHeaderTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.text,
  },
  storiesUnseenBadge: {
    backgroundColor: 'rgba(74,124,63,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(74,124,63,0.4)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
  },
  storiesUnseenText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primaryLight || '#8B5CF6',
  },
  storiesRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingBottom: 14,
    gap: 16,
  },
  storyItem: {
    alignItems: 'center',
    width: 66,
  },
  storyGlow: {
    position: 'absolute',
    width: 62,
    height: 62,
    borderRadius: 31,
    top: 0,
    alignSelf: 'center',
    transform: [{ scaleX: 1.1 }, { scaleY: 0.6 }],
    opacity: 0.8,
    marginTop: 8,
  },
  hexWrap: {
    position: 'relative',
    width: 62,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bg,
  },
  storyLabel: {
    fontSize: 11,
    textAlign: 'center',
    maxWidth: 66,
    marginTop: 5,
    fontWeight: '500',
  },

  familyBanner: {
    marginHorizontal: 14,
    marginTop: 14,
    marginBottom: 6,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  familyBannerGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    overflow: 'hidden',
  },
  familyDecorCircle: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.04)',
    top: -30,
    right: 40,
  },
  familyDecorCircle2: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(196,163,90,0.08)',
    bottom: -20,
    right: 10,
  },
  familyBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  familyIconWrap: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  familyIconGrad: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  familyTextBlock: {
    flex: 1,
    gap: 3,
  },
  familyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  familyBannerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.2,
  },
  familyLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(127,176,105,0.25)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(127,176,105,0.4)',
  },
  familyLiveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#8B5CF6',
  },
  familyLiveText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8B5CF6',
  },
  familyBannerSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
  },
  familyBannerRight: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  familyChevronWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  feedLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 10,
    gap: 12,
  },
  feedLabelLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  feedLabelAccent: {
    width: 4,
    height: 18,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  feedLabelText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  feedLabelLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },

  emptyWrap: { padding: 20, paddingTop: 10 },
  emptyCard: { borderRadius: 20, padding: 32, alignItems: "center", gap: 10 },
  emptyTitle: { fontSize: 20, fontWeight: "800", color: colors.text },
  emptySub: { fontSize: 14, color: colors.muted, textAlign: "center", lineHeight: 20 },
  discoverBtn: { borderRadius: radius.full, overflow: "hidden", marginTop: 8 },
  discoverBtnGrad: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 24, paddingVertical: 12 },
  discoverBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});

const fs = StyleSheet.create({
  aiFloatBtn: { position: 'absolute', bottom: 100, right: 18, width: 56, height: 56, borderRadius: 28, zIndex: 99 },
  aiFloatGrad: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowColor: '#7c3aed', shadowOpacity: 0.6, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 12 },
  aiFloatGlow: { position: 'absolute', width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(124,58,237,0.3)', transform: [{ scale: 1.4 }] },
});

const bm = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.75)', paddingHorizontal: 28 },
  card: { width: '100%', borderRadius: 28, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(124,58,237,0.25)', paddingBottom: 28, alignItems: 'center' },
  iconWrap: { width: 80, height: 80, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginTop: 32, marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: 8 },
  sub: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 21, marginBottom: 24, paddingHorizontal: 16 },
  features: { width: '100%', paddingHorizontal: 24, gap: 12, marginBottom: 28 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(124,58,237,0.15)', alignItems: 'center', justifyContent: 'center' },
  featureText: { fontSize: 14, color: colors.text, fontWeight: '500' },
  enableBtn: { width: '85%', borderRadius: 12, overflow: 'hidden', marginBottom: 12 },
  enableBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  enableBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  skipBtn: { paddingVertical: 10, paddingHorizontal: 24 },
  skipText: { color: colors.muted, fontSize: 14, fontWeight: '500' },
});
