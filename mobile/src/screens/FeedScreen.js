import { useEffect, useState, useCallback, useRef, memo } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image, RefreshControl,
  Modal, TextInput, Alert, Dimensions, ScrollView,
} from "react-native";
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
          <Text style={jf.title}>Join a Family</Text>
          <Text style={jf.sub}>Enter the 8-character invite code from your family admin</Text>

          {error ? (
            <View style={jf.errorBox}>
              <Ionicons name="alert-circle" size={14} color="#f87171" />
              <Text style={jf.errorText}>{error}</Text>
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
                : <Text style={jf.joinBtnText}>Join Family</Text>}
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
            <Text style={[sp.title, { color: theme.text }]}>Share Post</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={theme.muted} /></TouchableOpacity>
          </View>
          <View style={[sp.searchWrap, { backgroundColor: theme.bgSecondary }]}>
            <Ionicons name="search" size={15} color={theme.dim} />
            <TextInput style={[sp.searchInput, { color: theme.text }]} placeholder="Search people..." placeholderTextColor={theme.dim} value={query} onChangeText={handleSearch} />
          </View>
          <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}>
            {users.map(u => (
              <View key={u.id} style={sp.userRow}>
                <View style={[sp.avatar, { backgroundColor: colors.primary }]}>
                  {u.avatar_url ? <Image source={{ uri: u.avatar_url }} style={{ width: 40, height: 40, borderRadius: 20 }} /> : <Text style={sp.avatarLetter}>{u.name?.[0]?.toUpperCase()}</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[sp.userName, { color: theme.text }]}>{u.name}</Text>
                  <Text style={[sp.userHandle, { color: theme.muted }]}>@{u.username || "user"}</Text>
                </View>
                <TouchableOpacity
                  style={[sp.sendBtn, sent.has(u.id) && sp.sentBtn]}
                  onPress={() => shareToUser(u.id)}
                  disabled={sending === u.id || sent.has(u.id)}
                >
                  {sending === u.id ? <ActivityIndicator size="small" color="#fff" /> :
                    sent.has(u.id) ? <Ionicons name="checkmark" size={16} color="#fff" /> :
                    <Text style={sp.sendBtnText}>Send</Text>}
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
  const lastTap = useRef(0);
  const scrollViewRef = useRef(null);

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
      setComments(c => [...c, { ...data.comment, author_name: user?.name }]);
      setCommentText("");
    } catch {} finally { setPosting(false); }
  };

  const isOwner = post.user_id === user?.id;

  const renderHashtags = (text) => {
    if (!text) return null;
    const parts = text.split(/(#\w+)/);
    return parts.map((part, i) => 
      part.startsWith('#') 
        ? <Text key={i} style={{ color: '#3b82f6', fontWeight: '600' }}>{part}</Text>
        : <Text key={i}>{part}</Text>
    );
  };

  const handleScroll = (event) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / width);
    setCurrentMediaIndex(index);
  };

  return (
    <View style={pc.card}>
      {/* Header — hidden for video posts (overlaid inside VideoPlayer) */}
      {!isVideoPost && (
      <TouchableOpacity
        style={pc.header}
        onPress={() => navigation.navigate("UserProfile", { userId: post.user_id, userName: post.author_name, userAvatar: post.author_avatar })}
        activeOpacity={0.8}
      >
        <LinearGradient colors={["#7c3aed", "#3b82f6", "#ec4899"]} style={pc.avatarRing}>
          <View style={[pc.avatarInner, { backgroundColor: theme.primary, borderColor: theme.bg }]}>
            {post.author_avatar
              ? <Image source={{ uri: post.author_avatar }} style={pc.avatarImg} />
              : <Text style={pc.avatarLetter}>{post.author_name?.[0]?.toUpperCase() || "?"}</Text>}
          </View>
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={[pc.authorName, { color: theme.text }]}>{post.author_name}</Text>
            {post.author_verified_badge && (
              <Ionicons name="checkmark-circle" size={14} color="#3b82f6" />
            )}
          </View>
          <View style={pc.metaRow}>
            {post.location ? (
              <>
                <Ionicons name="location-outline" size={11} color={theme.muted} />
                <Text style={[pc.metaText, { color: theme.muted }]}>{post.location}</Text>
                <Text style={[pc.dot, { color: theme.dim }]}>·</Text>
              </>
            ) : null}
            <Text style={[pc.metaText, { color: theme.muted }]}>{timeAgo(post.created_at)}</Text>
            {post.privacy === "connections" && (
              <><Text style={[pc.dot, { color: theme.dim }]}>·</Text><Ionicons name="people-outline" size={11} color={theme.muted} /></>
            )}
            {post.is_sponsored && (
              <><Text style={[pc.dot, { color: theme.dim }]}>·</Text><Text style={pc.sponsoredLabel}>Sponsored</Text></>
            )}
          </View>
        </View>
        {isOwner && (
          <TouchableOpacity onPress={() => Alert.alert("Delete Post", "Remove this post?", [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: async () => {
              try { await api.delete(`/posts/${post.id}`); onUpdate?.(); } catch {}
            }},
          ])}>
            <Ionicons name="ellipsis-horizontal" size={20} color={theme.muted} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
      )}{/* end !isVideoPost header */}

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
                liked={liked}
                likeCount={likeCount}
                onLike={toggleLike}
                onComment={openComments}
                onShare={() => setShowShare(true)}
                saved={saved}
                onSave={toggleSave}
                authorName={post.author_name}
                authorAvatar={post.author_avatar}
                caption={post.caption}
                commentCount={post.comment_count}
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

      {/* Actions / Likes / Caption / Timestamp — hidden for video (overlaid inside VideoPlayer) */}
      {!isVideoPost && (
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
            <Text style={pc.likeCount}>{likeCount.toLocaleString()} {likeCount === 1 ? "like" : "likes"}</Text>
          )}

          {/* Caption */}
          {post.caption ? (
            <View style={pc.captionWrap}>
              <Text style={pc.caption} numberOfLines={showFullCaption ? undefined : 2}>
                <Text style={pc.captionName}>{post.author_name} </Text>
                {renderHashtags(post.caption)}
              </Text>
              {post.caption.length > 100 && (
                <TouchableOpacity onPress={() => setShowFullCaption(!showFullCaption)}>
                  <Text style={pc.moreText}>{showFullCaption ? 'less' : 'more'}</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null}

          {/* View comments */}
          {post.comment_count > 0 && (
            <TouchableOpacity onPress={openComments}>
              <Text style={pc.viewComments}>View all {post.comment_count} comments</Text>
            </TouchableOpacity>
          )}

          <Text style={pc.timestamp}>{timeAgo(post.created_at).toUpperCase()}</Text>
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
              <Text style={[pc.commentsTitle, { color: theme.text }]}>Comments</Text>
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
                ListEmptyComponent={<Text style={{ color: theme.dim, textAlign: "center", marginTop: 20 }}>No comments yet</Text>}
                renderItem={({ item }) => (
                  <View style={pc.commentRow}>
                    <View style={[pc.commentAvatar, { backgroundColor: theme.primary }]}>
                      <Text style={pc.commentAvatarText}>{item.author_name?.[0] || "U"}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[pc.commentText, { color: theme.text }]}>
                        <Text style={[pc.commentName, { color: theme.text }]}>{item.author_name} </Text>
                        {item.text}
                      </Text>
                    </View>
                  </View>
                )}
              />
            )}
            <View style={[pc.commentInputRow, { borderTopColor: theme.border }]}>
              <View style={[pc.commentAvatar, { backgroundColor: theme.primary }]}>
                <Text style={pc.commentAvatarText}>{user?.name?.[0] || "U"}</Text>
              </View>
              <TextInput
                style={[pc.commentInput, { color: theme.text }]}
                placeholder="Add a comment..."
                placeholderTextColor={theme.dim}
                value={commentText}
                onChangeText={setCommentText}
              />
              <TouchableOpacity onPress={postComment} disabled={posting || !commentText.trim()}>
                {posting
                  ? <ActivityIndicator size="small" color={theme.primary} />
                  : <Text style={[pc.postBtn, !commentText.trim() && { opacity: 0.4 }]}>Post</Text>}
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
  viewComments: { paddingHorizontal: 14, color: colors.muted, fontSize: 13, marginBottom: 4 },
  timestamp: { paddingHorizontal: 14, paddingBottom: 10, fontSize: 10, color: colors.dim, letterSpacing: 0.5 },
  commentsOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  commentsSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, height: "75%" },
  sheetHandle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: "center", marginTop: 10, marginBottom: 4 },
  commentsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  commentsTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  commentRow: { flexDirection: "row", gap: 10, marginBottom: 16, alignItems: "flex-start" },
  commentAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
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
      {storyGroups.length > 0 && (
        <View style={s.storiesWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.storiesRow}>
            {/* Add story button */}
            <TouchableOpacity style={s.storyItem} onPress={() => navigation.navigate('Create')} activeOpacity={0.8}>
              <View style={[s.storyAddRing, { borderColor: theme.border2 }]}>
                <View style={[s.storyAddCircle, { backgroundColor: theme.bgSecondary }]}>
                  <Ionicons name="add" size={22} color={theme.text} />
                </View>
              </View>
              <Text style={[s.storyLabel, { color: theme.text }]}>Your Story</Text>
            </TouchableOpacity>
            {storyGroups.map((group, idx) => (
              <TouchableOpacity
                key={group.user_id}
                style={s.storyItem}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('StoryViewer', { storyGroups, initialGroupIndex: idx })}
              >
                <LinearGradient
                  colors={group.has_unseen ? ['#2D5A27', '#7FB069', '#C4A35A'] : ['#4A4035', '#4A4035']}
                  style={s.storyRing}
                >
                  <View style={[s.storyAvatarWrap, { borderColor: theme.bg }]}>
                    {group.author_avatar
                      ? <Image source={{ uri: group.author_avatar }} style={s.storyAvatar} />
                      : <View style={[s.storyAvatarFallback, { backgroundColor: theme.primary }]}>
                          <Text style={s.storyAvatarLetter}>{group.author_name?.[0]?.toUpperCase()}</Text>
                        </View>}
                  </View>
                </LinearGradient>
                <Text style={[s.storyLabel, { color: theme.text }]} numberOfLines={1}>
                  {group.author_name?.split(' ')[0] || 'User'}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Family Banner */}
      <TouchableOpacity
        style={s.familyBanner}
        onPress={() => user?.family_id ? navigation.navigate('Family') : setShowJoinFamily(true)}
        activeOpacity={0.85}
      >
        <LinearGradient colors={["#2D5A27", "#4A7C3F", "#C4A35A"]} style={s.familyBannerGrad}>
          <View style={s.familyBannerLeft}>
            <View style={s.familyIconWrap}>
              <Ionicons name="people" size={22} color="#fff" />
            </View>
            <View>
              <Text style={s.familyBannerTitle}>
                {user?.family_id ? "Your Family" : "Join a Family"}
              </Text>
              <Text style={s.familyBannerSub}>
                {user?.family_id ? "View family stories & chat" : "Enter invite code to join"}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.8)" />
        </LinearGradient>
      </TouchableOpacity>

      {posts.length > 0 && (
        <View style={s.feedLabel}>
          <Text style={s.feedLabelText}>Your Feed</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header */}
      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <View style={s.logoWrap}>
          <Image
            source={require("../../assets/kinscribe-logo.png")}
            style={s.logoIcon}
            resizeMode="cover"
          />
          <Text style={[s.logo, { color: theme.text }]}>KinsCribe</Text>
        </View>
        <View style={s.headerRight}>
          <TouchableOpacity onPress={() => navigation.navigate("Notifications")} style={s.headerBtn}>
            <Ionicons name="notifications-outline" size={25} color={theme.text} />
            {unreadCount > 0 && (
              <View style={s.badge}>
                <Text style={s.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate("FeedAI")} style={s.headerBtn}>
            <Ionicons name="sparkles" size={23} color={theme.primary} />
          </TouchableOpacity>
        </View>
      </View>

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
          contentContainerStyle={{ paddingBottom: 90 }}
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
                <Text style={[s.emptyTitle, { color: theme.text }]}>Your feed is empty</Text>
                <Text style={[s.emptySub, { color: theme.muted }]}>
                  Connect with people on the Discover tab to see their posts here
                </Text>
                <TouchableOpacity
                  style={s.discoverBtn}
                  onPress={() => navigation.navigate("Search")}
                  activeOpacity={0.85}
                >
                  <LinearGradient colors={["#7c3aed", "#3b82f6"]} style={s.discoverBtnGrad}>
                    <Ionicons name="compass-outline" size={18} color="#fff" />
                    <Text style={s.discoverBtnText}>Discover People</Text>
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

      {/* Biometric Enable Prompt */}
      <Modal visible={showBiometricPrompt} transparent animationType="fade">
        <View style={bm.overlay}>
          <BlurView intensity={20} tint="dark" style={bm.card}>
            <LinearGradient colors={['rgba(124,58,237,0.12)', 'rgba(15,23,42,0.98)']} style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['#7c3aed', '#3b82f6']} style={bm.iconWrap}>
              <Ionicons name={biometricType === 'face' ? 'scan-outline' : 'finger-print'} size={36} color="#fff" />
            </LinearGradient>
            <Text style={bm.title}>Enable {biometricType === 'face' ? 'Face ID' : 'Fingerprint'} Login</Text>
            <Text style={bm.sub}>Sign in faster next time using{`\n`}{biometricType === 'face' ? 'Face ID' : 'your fingerprint'}.</Text>
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
                  <Text style={bm.featureText}>{f.text}</Text>
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
                <Text style={bm.enableBtnText}>Enable {biometricType === 'face' ? 'Face ID' : 'Fingerprint'} Login</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={bm.skipBtn} onPress={() => setShowBiometricPrompt(false)}>
              <Text style={bm.skipText}>Not Now</Text>
            </TouchableOpacity>
          </BlurView>
        </View>
      </Modal>

    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16, paddingTop: 52, paddingBottom: 10,
    borderBottomWidth: 0.5, borderBottomColor: colors.border,
  },
  logoWrap: { flexDirection: "row", alignItems: "center", gap: 9 },
  logoIcon: { width: 36, height: 36, borderRadius: 10 },
  logo: { fontSize: 22, fontWeight: "800", color: colors.text },
  headerRight: { flexDirection: "row", gap: 6 },
  headerBtn: { padding: 6 },
  badge: { position: "absolute", top: 2, right: 2, backgroundColor: "#e11d48", borderRadius: 8, minWidth: 16, height: 16, alignItems: "center", justifyContent: "center" },
  badgeText: { color: "#fff", fontSize: 9, fontWeight: "800" },

  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },

  storiesWrap: { borderBottomWidth: 0.5, borderBottomColor: colors.border },
  storiesRow: { paddingHorizontal: 12, paddingVertical: 10, gap: 14 },
  storyItem: { alignItems: 'center', width: 64 },
  storyAddRing: { width: 64, height: 64, borderRadius: 32, borderWidth: 1.5, borderColor: colors.border2, alignItems: 'center', justifyContent: 'center' },
  storyAddCircle: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.bgSecondary, alignItems: 'center', justifyContent: 'center' },
  storyRing: { width: 64, height: 64, borderRadius: 32, padding: 2.5, alignItems: 'center', justifyContent: 'center' },
  storyAvatarWrap: { width: 57, height: 57, borderRadius: 28.5, overflow: 'hidden', borderWidth: 2, borderColor: colors.bg },
  storyAvatar: { width: '100%', height: '100%' },
  storyAvatarFallback: { width: '100%', height: '100%', backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  storyAvatarLetter: { color: '#fff', fontWeight: '700', fontSize: 20 },
  storyLabel: { fontSize: 11, color: colors.text, textAlign: 'center', maxWidth: 64, marginTop: 4 },

  familyBanner: { marginHorizontal: 14, marginTop: 14, marginBottom: 6, borderRadius: 16, overflow: "hidden" },
  familyBannerGrad: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14 },
  familyBannerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  familyIconWrap: { width: 42, height: 42, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  familyBannerTitle: { fontSize: 15, fontWeight: "700", color: "#fff" },
  familyBannerSub: { fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 1 },

  feedLabel: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  feedLabelText: { fontSize: 13, fontWeight: "700", color: colors.dim, textTransform: "uppercase", letterSpacing: 0.8 },

  emptyWrap: { padding: 20, paddingTop: 10 },
  emptyCard: { borderRadius: 20, padding: 32, alignItems: "center", gap: 10 },
  emptyTitle: { fontSize: 20, fontWeight: "800", color: colors.text },
  emptySub: { fontSize: 14, color: colors.muted, textAlign: "center", lineHeight: 20 },
  discoverBtn: { borderRadius: radius.full, overflow: "hidden", marginTop: 8 },
  discoverBtnGrad: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 24, paddingVertical: 12 },
  discoverBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
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
