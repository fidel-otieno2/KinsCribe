import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, ScrollView, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, Alert, TextInput,
  Dimensions, Share, FlatList, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AppText from '../components/AppText';
import Toast from '../components/Toast';
import useToast from '../hooks/useToast';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../api/axios';
import { radius, colors } from '../theme';
import { formatDistanceToNow } from '../utils/time';

const { width, height } = Dimensions.get('window');

export default function PostDetailScreen({ route, navigation }) {
  const { postId } = route.params;
  const { user } = useAuth();
  const { theme } = useTheme();
  const { toast, hide, success, error } = useToast();
  const videoRef = useRef(null);

  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [saved, setSaved] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [videoStatus, setVideoStatus] = useState({});
  const [replyTo, setReplyTo] = useState(null);
  const inputRef = useRef(null);

  const fetchPost = useCallback(async () => {
    try {
      const [postRes, commentsRes] = await Promise.all([
        api.get(`/posts/${postId}`),
        api.get(`/posts/${postId}/comments`),
      ]);
      const p = postRes.data.post;
      setPost(p);
      setLiked(p.liked_by_me);
      setLikeCount(p.like_count);
      setSaved(p.saved_by_me);
      setComments(commentsRes.data.comments || []);
      // Record view (fire-and-forget, skip own posts)
      if (p.user_id !== user?.id) {
        api.post(`/posts/${postId}/view`).catch(() => {});
      }
    } catch { error('Failed to load post'); }
    finally { setLoading(false); }
  }, [postId]);

  useEffect(() => { fetchPost(); }, [fetchPost]);

  const handleLike = async () => {
    setLiked(prev => !prev);
    setLikeCount(prev => liked ? prev - 1 : prev + 1);
    try { await api.post(`/posts/${postId}/like`); }
    catch { setLiked(prev => !prev); setLikeCount(prev => liked ? prev + 1 : prev - 1); }
  };

  const handleSave = async () => {
    setSaved(prev => !prev);
    try { await api.post(`/posts/${postId}/save`); }
    catch { setSaved(prev => !prev); }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `${post?.caption || ''}\n\nShared from KinsCribe`,
        url: post?.media_url || '',
      });
      await api.post(`/posts/${postId}/share`).catch(() => {});
    } catch {}
  };

  const handleComment = async () => {
    if (!commentText.trim()) return;
    setSubmitting(true);
    try {
      const res = await api.post(`/posts/${postId}/comments`, {
        text: commentText.trim(),
        parent_id: replyTo?.id || null,
      });
      setComments(prev => [...prev, res.data.comment]);
      setCommentText('');
      setReplyTo(null);
    } catch { error('Failed to post comment'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = () => {
    if (post?.user_id !== user?.id) return;
    Alert.alert('Delete Post', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/posts/${postId}`);
          success('Post deleted');
          setTimeout(() => navigation.goBack(), 600);
        } catch { error('Failed to delete'); }
      }},
    ]);
  };

  const allMedia = post
    ? post.media_urls?.length > 0
      ? post.media_urls
      : post.media_url
        ? [{ url: post.media_url, type: post.media_type }]
        : []
    : [];

  const currentMedia = allMedia[carouselIndex];

  if (loading) return (
    <View style={[s.container, { backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }]}>
      <ActivityIndicator color={theme.primary} size="large" />
    </View>
  );

  if (!post) return (
    <View style={[s.container, { backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }]}>
      <Ionicons name="alert-circle-outline" size={48} color={theme.dim} />
      <AppText style={{ color: theme.muted, marginTop: 12 }}>Post not found</AppText>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={[s.container, { backgroundColor: theme.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <Toast visible={toast.visible} type={toast.type} message={toast.message} onHide={hide} />

      {/* Header */}
      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBtn}>
          <Ionicons name="chevron-back" size={26} color={theme.text} />
        </TouchableOpacity>
        <AppText style={[s.headerTitle, { color: theme.text }]}>Post</AppText>
        <TouchableOpacity style={s.headerBtn} onPress={post.user_id === user?.id ? handleDelete : handleShare}>
          <Ionicons
            name={post.user_id === user?.id ? 'trash-outline' : 'share-outline'}
            size={22}
            color={post.user_id === user?.id ? theme.red : theme.text}
          />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
        {/* Author row */}
        <TouchableOpacity
          style={s.authorRow}
          activeOpacity={0.8}
          onPress={() => post.user_id !== user?.id && navigation.navigate('UserProfile', { userId: post.user_id })}
        >
          <View style={[s.authorAvatar, { backgroundColor: theme.primary }]}>
            {post.author_avatar
              ? <Image source={{ uri: post.author_avatar }} style={s.authorAvatarImg} />
              : <AppText style={s.authorAvatarLetter}>{post.author_name?.[0]?.toUpperCase()}</AppText>}
          </View>
          <View style={s.authorInfo}>
            <View style={s.authorNameRow}>
              <AppText style={[s.authorName, { color: theme.text }]}>{post.author_name}</AppText>
              {post.author_verified_badge && <Ionicons name="checkmark-circle" size={14} color="#3b82f6" />}
            </View>
            <AppText style={[s.authorMeta, { color: theme.muted }]}>
              {post.location ? `📍 ${post.location}  ·  ` : ''}{formatDistanceToNow(post.created_at)}
            </AppText>
          </View>
          {post.is_sponsored && (
            <View style={[s.sponsoredBadge, { backgroundColor: theme.bgCard }]}>
              <AppText style={[s.sponsoredText, { color: theme.muted }]}>Sponsored</AppText>
            </View>
          )}
        </TouchableOpacity>

        {/* Media */}
        {allMedia.length > 0 && (
          <View style={s.mediaWrap}>
            {currentMedia?.type === 'video' ? (
              <Video
                ref={videoRef}
                source={{ uri: currentMedia.url }}
                style={s.mediaVideo}
                resizeMode={ResizeMode.CONTAIN}
                useNativeControls
                shouldPlay
                isLooping={false}
                onPlaybackStatusUpdate={setVideoStatus}
              />
            ) : (
              <Image
                source={{ uri: currentMedia?.url }}
                style={s.mediaImage}
                resizeMode="contain"
              />
            )}
            {/* Carousel dots */}
            {allMedia.length > 1 && (
              <View style={s.dotsRow}>
                {allMedia.map((_, i) => (
                  <TouchableOpacity key={i} onPress={() => setCarouselIndex(i)}>
                    <View style={[s.dot, { backgroundColor: i === carouselIndex ? theme.primary : theme.dim }]} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {/* Carousel arrows */}
            {allMedia.length > 1 && (
              <>
                {carouselIndex > 0 && (
                  <TouchableOpacity style={[s.carouselArrow, s.carouselLeft]} onPress={() => setCarouselIndex(i => i - 1)}>
                    <Ionicons name="chevron-back" size={22} color="#fff" />
                  </TouchableOpacity>
                )}
                {carouselIndex < allMedia.length - 1 && (
                  <TouchableOpacity style={[s.carouselArrow, s.carouselRight]} onPress={() => setCarouselIndex(i => i + 1)}>
                    <Ionicons name="chevron-forward" size={22} color="#fff" />
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        )}

        {/* Actions */}
        <View style={s.actionsRow}>
          <TouchableOpacity style={s.actionBtn} onPress={handleLike} activeOpacity={0.7}>
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={26} color={liked ? '#e11d48' : theme.text} />
            <AppText style={[s.actionCount, { color: theme.muted }]}>{likeCount}</AppText>
          </TouchableOpacity>
          <TouchableOpacity style={s.actionBtn} onPress={() => inputRef.current?.focus()} activeOpacity={0.7}>
            <Ionicons name="chatbubble-outline" size={24} color={theme.text} />
            <AppText style={[s.actionCount, { color: theme.muted }]}>{comments.length}</AppText>
          </TouchableOpacity>
          <TouchableOpacity style={s.actionBtn} onPress={handleShare} activeOpacity={0.7}>
            <Ionicons name="share-outline" size={24} color={theme.text} />
            {post.share_count > 0 && <AppText style={[s.actionCount, { color: theme.muted }]}>{post.share_count}</AppText>}
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={s.actionBtn} onPress={handleSave} activeOpacity={0.7}>
            <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={24} color={saved ? theme.primary : theme.text} />
          </TouchableOpacity>
        </View>

        {/* Caption */}
        {post.caption ? (
          <View style={s.captionWrap}>
            <AppText style={[s.captionAuthor, { color: theme.text }]}>{post.author_name} </AppText>
            <AppText style={[s.captionText, { color: theme.textSecondary }]}>{post.caption}</AppText>
          </View>
        ) : null}

        {/* Hashtags */}
        {post.hashtags ? (
          <View style={s.hashtagsWrap}>
            {post.hashtags.split(' ').filter(h => h.startsWith('#')).map((h, i) => (
              <AppText key={i} style={[s.hashtag, { color: theme.primary }]}>{h} </AppText>
            ))}
          </View>
        ) : null}

        {/* Stats row */}
        <View style={[s.statsRow, { borderTopColor: theme.border, borderBottomColor: theme.border }]}>
          {post.view_count > 0 && (
            <AppText style={[s.statText, { color: theme.muted }]}>
              <Ionicons name="eye-outline" size={13} /> {post.view_count} views
            </AppText>
          )}
        </View>

        {/* Comments */}
        <View style={s.commentsSection}>
          <AppText style={[s.commentsTitle, { color: theme.text }]}>
            Comments {comments.length > 0 ? `(${comments.length})` : ''}
          </AppText>
          {comments.length === 0 ? (
            <AppText style={[s.noComments, { color: theme.dim }]}>No comments yet. Be the first!</AppText>
          ) : (
            comments.map(c => (
              <View key={c.id} style={s.commentRow}>
                <View style={[s.commentAvatar, { backgroundColor: theme.primary }]}>
                  {c.author_avatar
                    ? <Image source={{ uri: c.author_avatar }} style={s.commentAvatarImg} />
                    : <AppText style={s.commentAvatarLetter}>{c.author_name?.[0]?.toUpperCase()}</AppText>}
                </View>
                <View style={s.commentBody}>
                  <View style={s.commentNameRow}>
                    <AppText style={[s.commentAuthor, { color: theme.text }]}>{c.author_name}</AppText>
                    <AppText style={[s.commentTime, { color: theme.dim }]}>{formatDistanceToNow(c.created_at)}</AppText>
                  </View>
                  <AppText style={[s.commentText, { color: theme.textSecondary }]}>{c.text}</AppText>
                  <TouchableOpacity onPress={() => { setReplyTo(c); inputRef.current?.focus(); }}>
                    <AppText style={[s.replyBtn, { color: theme.muted }]}>Reply</AppText>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Comment input */}
      <View style={[s.inputBar, { backgroundColor: theme.bgCard, borderTopColor: theme.border }]}>
        {replyTo && (
          <View style={[s.replyBanner, { backgroundColor: theme.bgSecondary }]}>
            <AppText style={[s.replyBannerText, { color: theme.muted }]}>
              Replying to {replyTo.author_name}
            </AppText>
            <TouchableOpacity onPress={() => setReplyTo(null)}>
              <Ionicons name="close" size={16} color={theme.muted} />
            </TouchableOpacity>
          </View>
        )}
        <View style={s.inputRow}>
          <View style={[s.commentInputWrap, { backgroundColor: theme.bgSecondary, borderColor: theme.border2 }]}>
            <TextInput
              ref={inputRef}
              value={commentText}
              onChangeText={setCommentText}
              placeholder="Add a comment..."
              placeholderTextColor={theme.dim}
              style={[s.commentInput, { color: theme.text }]}
              multiline
              maxLength={500}
            />
          </View>
          <TouchableOpacity
            style={[s.sendBtn, { backgroundColor: commentText.trim() ? theme.primary : theme.bgElevated }]}
            onPress={handleComment}
            disabled={submitting || !commentText.trim()}
            activeOpacity={0.8}
          >
            {submitting
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="send" size={18} color="#fff" />}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 52, paddingHorizontal: 8, paddingBottom: 12, borderBottomWidth: 0.5 },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  authorRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  authorAvatar: { width: 42, height: 42, borderRadius: 21, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  authorAvatarImg: { width: '100%', height: '100%' },
  authorAvatarLetter: { color: '#fff', fontWeight: '800', fontSize: 16 },
  authorInfo: { flex: 1 },
  authorNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  authorName: { fontSize: 14, fontWeight: '700' },
  authorMeta: { fontSize: 12, marginTop: 1 },
  sponsoredBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  sponsoredText: { fontSize: 11 },
  mediaWrap: { width, backgroundColor: '#000', position: 'relative' },
  mediaImage: { width, height: width, backgroundColor: '#000' },
  mediaVideo: { width, height: width * 1.1, backgroundColor: '#000' },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 5, paddingVertical: 8, backgroundColor: '#000' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  carouselArrow: { position: 'absolute', top: '45%', backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 20, padding: 6 },
  carouselLeft: { left: 10 },
  carouselRight: { right: 10 },
  actionsRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 4 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 6, paddingVertical: 4 },
  actionCount: { fontSize: 14, fontWeight: '600' },
  captionWrap: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 14, paddingBottom: 6 },
  captionAuthor: { fontSize: 14, fontWeight: '700' },
  captionText: { fontSize: 14, lineHeight: 20, flex: 1 },
  hashtagsWrap: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 14, paddingBottom: 8 },
  hashtag: { fontSize: 13, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 16, paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: 0.5, borderBottomWidth: 0.5, marginVertical: 4 },
  statText: { fontSize: 12 },
  commentsSection: { paddingHorizontal: 14, paddingTop: 8 },
  commentsTitle: { fontSize: 15, fontWeight: '800', marginBottom: 12 },
  noComments: { fontSize: 13, textAlign: 'center', paddingVertical: 20 },
  commentRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  commentAvatar: { width: 34, height: 34, borderRadius: 17, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  commentAvatarImg: { width: '100%', height: '100%' },
  commentAvatarLetter: { color: '#fff', fontWeight: '700', fontSize: 13 },
  commentBody: { flex: 1 },
  commentNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  commentAuthor: { fontSize: 13, fontWeight: '700' },
  commentTime: { fontSize: 11 },
  commentText: { fontSize: 13, lineHeight: 18 },
  replyBtn: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  inputBar: { borderTopWidth: 0.5, paddingBottom: Platform.OS === 'ios' ? 28 : 12 },
  replyBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 6 },
  replyBannerText: { fontSize: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingTop: 10, gap: 8 },
  commentInputWrap: { flex: 1, borderRadius: radius.xl, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8, maxHeight: 100 },
  commentInput: { fontSize: 14, paddingVertical: 0 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
