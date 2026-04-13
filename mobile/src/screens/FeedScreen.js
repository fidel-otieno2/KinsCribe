import { useEffect, useState, useCallback, useRef, memo } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, StatusBar, Image, RefreshControl,
  Modal, TextInput, Alert, Dimensions, ScrollView,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import api from "../api/axios";
import { colors, radius } from "../theme";
import { useAuth } from "../context/AuthContext";

const { width } = Dimensions.get("window");

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Join Family Modal ──────────────────────────────────────────
function JoinFamilyModal({ visible, onClose, onJoined }) {
  const { refreshUser } = useAuth();
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
            <Ionicons name="close" size={22} color={colors.muted} />
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

// ── Post Card ──────────────────────────────────────────────────
const PostCard = memo(function PostCard({ post, onUpdate, navigation }) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(post.liked_by_me || false);
  const [likeCount, setLikeCount] = useState(post.like_count || 0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [posting, setPosting] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const lastTap = useRef(0);

  const toggleLike = async () => {
    const next = !liked;
    setLiked(next);
    setLikeCount(c => next ? c + 1 : c - 1);
    try { await api.post(`/posts/${post.id}/like`); }
    catch { setLiked(!next); setLikeCount(c => next ? c - 1 : c + 1); }
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

  return (
    <View style={pc.card}>
      {/* Header */}
      <TouchableOpacity
        style={pc.header}
        onPress={() => navigation.navigate("UserProfile", { userId: post.user_id, userName: post.author_name, userAvatar: post.author_avatar })}
        activeOpacity={0.8}
      >
        <LinearGradient colors={["#7c3aed", "#3b82f6", "#ec4899"]} style={pc.avatarRing}>
          <View style={pc.avatarInner}>
            {post.author_avatar
              ? <Image source={{ uri: post.author_avatar }} style={pc.avatarImg} />
              : <Text style={pc.avatarLetter}>{post.author_name?.[0]?.toUpperCase() || "?"}</Text>}
          </View>
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={pc.authorName}>{post.author_name}</Text>
          <View style={pc.metaRow}>
            {post.location ? (
              <>
                <Ionicons name="location-outline" size={11} color={colors.muted} />
                <Text style={pc.metaText}>{post.location}</Text>
                <Text style={pc.dot}>·</Text>
              </>
            ) : null}
            <Text style={pc.metaText}>{timeAgo(post.created_at)}</Text>
            {post.privacy === "connections" && (
              <><Text style={pc.dot}>·</Text><Ionicons name="people-outline" size={11} color={colors.muted} /></>
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
            <Ionicons name="ellipsis-horizontal" size={20} color={colors.muted} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      {/* Media */}
      {post.media_url ? (
        <TouchableOpacity activeOpacity={1} onPress={handleDoubleTap}>
          <Image source={{ uri: post.media_url }} style={pc.media} resizeMode="cover" />
        </TouchableOpacity>
      ) : null}

      {/* Actions */}
      <View style={pc.actions}>
        <View style={pc.actionsLeft}>
          <TouchableOpacity onPress={toggleLike} style={pc.actionBtn}>
            <Ionicons name={liked ? "heart" : "heart-outline"} size={26} color={liked ? "#e11d48" : colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={openComments} style={pc.actionBtn}>
            <Ionicons name="chatbubble-outline" size={24} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={pc.actionBtn}>
            <Ionicons name="paper-plane-outline" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Likes */}
      {likeCount > 0 && (
        <Text style={pc.likeCount}>{likeCount.toLocaleString()} {likeCount === 1 ? "like" : "likes"}</Text>
      )}

      {/* Caption */}
      {post.caption ? (
        <View style={pc.captionWrap}>
          <Text style={pc.caption}>
            <Text style={pc.captionName}>{post.author_name} </Text>
            {post.caption}
          </Text>
        </View>
      ) : null}

      {/* View comments */}
      {post.comment_count > 0 && (
        <TouchableOpacity onPress={openComments}>
          <Text style={pc.viewComments}>View all {post.comment_count} comments</Text>
        </TouchableOpacity>
      )}

      <Text style={pc.timestamp}>{timeAgo(post.created_at).toUpperCase()}</Text>

      {/* Comments Modal */}
      <Modal visible={showComments} animationType="slide" transparent>
        <View style={pc.commentsOverlay}>
          <View style={pc.commentsSheet}>
            <View style={pc.sheetHandle} />
            <View style={pc.commentsHeader}>
              <Text style={pc.commentsTitle}>Comments</Text>
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
                ListEmptyComponent={<Text style={{ color: colors.dim, textAlign: "center", marginTop: 20 }}>No comments yet</Text>}
                renderItem={({ item }) => (
                  <View style={pc.commentRow}>
                    <View style={pc.commentAvatar}>
                      <Text style={pc.commentAvatarText}>{item.author_name?.[0] || "U"}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={pc.commentText}>
                        <Text style={pc.commentName}>{item.author_name} </Text>
                        {item.text}
                      </Text>
                    </View>
                  </View>
                )}
              />
            )}
            <View style={pc.commentInputRow}>
              <View style={pc.commentAvatar}>
                <Text style={pc.commentAvatarText}>{user?.name?.[0] || "U"}</Text>
              </View>
              <TextInput
                style={pc.commentInput}
                placeholder="Add a comment..."
                placeholderTextColor={colors.dim}
                value={commentText}
                onChangeText={setCommentText}
              />
              <TouchableOpacity onPress={postComment} disabled={posting || !commentText.trim()}>
                {posting
                  ? <ActivityIndicator size="small" color={colors.primary} />
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
  dot: { fontSize: 11, color: colors.dim },
  media: { width, height: width },
  actions: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8 },
  actionsLeft: { flexDirection: "row", gap: 4 },
  actionBtn: { padding: 4 },
  likeCount: { paddingHorizontal: 14, fontSize: 13, fontWeight: "700", color: colors.text, marginBottom: 4 },
  captionWrap: { paddingHorizontal: 14, marginBottom: 4 },
  caption: { fontSize: 13, color: colors.text, lineHeight: 18 },
  captionName: { fontWeight: "700" },
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
  const [posts, setPosts] = useState([]);
  const [storyGroups, setStoryGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showJoinFamily, setShowJoinFamily] = useState(false);

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
      const { data } = await api.get("/stories/notifications/count");
      setUnreadCount(data?.count || 0);
    } catch {}
  }, []);

  useEffect(() => { fetchFeed(); fetchUnread(); }, []);

  useFocusEffect(useCallback(() => {
    fetchFeed(true);
    fetchUnread();
  }, []));

  const ListHeader = () => (
    <View>
      {/* Stories Row */}
      {storyGroups.length > 0 && (
        <View style={s.storiesWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.storiesRow}>
            {/* Add story button */}
            <TouchableOpacity style={s.storyItem} onPress={() => navigation.navigate('Create')} activeOpacity={0.8}>
              <View style={s.storyAddRing}>
                <View style={s.storyAddCircle}>
                  <Ionicons name="add" size={22} color="#fff" />
                </View>
              </View>
              <Text style={s.storyLabel}>Your Story</Text>
            </TouchableOpacity>
            {storyGroups.map((group, idx) => (
              <TouchableOpacity
                key={group.user_id}
                style={s.storyItem}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('StoryViewer', { storyGroups, initialGroupIndex: idx })}
              >
                <LinearGradient
                  colors={group.has_unseen ? ['#7c3aed', '#3b82f6', '#ec4899'] : ['#475569', '#475569']}
                  style={s.storyRing}
                >
                  <View style={s.storyAvatarWrap}>
                    {group.author_avatar
                      ? <Image source={{ uri: group.author_avatar }} style={s.storyAvatar} />
                      : <View style={s.storyAvatarFallback}>
                          <Text style={s.storyAvatarLetter}>{group.author_name?.[0]?.toUpperCase()}</Text>
                        </View>}
                  </View>
                </LinearGradient>
                <Text style={s.storyLabel} numberOfLines={1}>
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
        <LinearGradient colors={["#7c3aed", "#3b82f6", "#ec4899"]} style={s.familyBannerGrad}>
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
    <View style={s.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={s.header}>
        <View style={s.logoWrap}>
          <Image
            source={require("../../assets/kinscribe-logo.png")}
            style={s.logoIcon}
            resizeMode="cover"
          />
          <Text style={s.logo}>KinsCribe</Text>
        </View>
        <View style={s.headerRight}>
          <TouchableOpacity onPress={() => navigation.navigate("Notifications")} style={s.headerBtn}>
            <Ionicons name="notifications-outline" size={25} color={colors.text} />
            {unreadCount > 0 && (
              <View style={s.badge}>
                <Text style={s.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate("FeedAI")} style={s.headerBtn}>
            <Ionicons name="sparkles" size={23} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator color={colors.primary} size="large" />
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
            />
          )}
          ListHeaderComponent={<ListHeader />}
          contentContainerStyle={{ paddingBottom: 90 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchFeed(true); }}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <LinearGradient colors={["rgba(124,58,237,0.15)", "rgba(59,130,246,0.1)"]} style={s.emptyCard}>
                <Ionicons name="people-outline" size={52} color={colors.primary} />
                <Text style={s.emptyTitle}>Your feed is empty</Text>
                <Text style={s.emptySub}>
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
