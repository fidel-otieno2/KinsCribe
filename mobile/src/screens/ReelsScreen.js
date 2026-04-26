import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, FlatList, StyleSheet, TouchableOpacity,
  Dimensions, ActivityIndicator, Image, TextInput,
  Modal, FlatList as FL,
} from 'react-native';
import AppText from '../components/AppText';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import VideoPlayer from '../components/VideoPlayer';

const { width, height } = Dimensions.get('window');

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z')) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function ReelCard({ reel, isVisible, navigation, onUpdate }) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [liked, setLiked] = useState(reel.liked_by_me || false);
  const [likeCount, setLikeCount] = useState(reel.like_count || 0);
  const [saved, setSaved] = useState(reel.saved_by_me || false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [posting, setPosting] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [showFullCaption, setShowFullCaption] = useState(false);

  const toggleLike = async () => {
    const next = !liked;
    setLiked(next);
    setLikeCount(c => next ? c + 1 : c - 1);
    try { await api.post(`/posts/${reel.id}/like`); }
    catch { setLiked(!next); setLikeCount(c => next ? c - 1 : c + 1); }
  };

  const toggleSave = async () => {
    const next = !saved;
    setSaved(next);
    try { await api.post(`/posts/${reel.id}/save`); }
    catch { setSaved(!next); }
  };

  const openComments = async () => {
    setShowComments(true);
    setLoadingComments(true);
    try {
      const { data } = await api.get(`/posts/${reel.id}/comments`);
      setComments(data.comments || []);
    } catch {} finally { setLoadingComments(false); }
  };

  const postComment = async () => {
    if (!commentText.trim()) return;
    setPosting(true);
    try {
      const { data } = await api.post(`/posts/${reel.id}/comments`, { text: commentText });
      setComments(c => [...c, { ...data.comment, author_name: user?.name, author_avatar: user?.avatar_url }]);
      setCommentText('');
    } catch {} finally { setPosting(false); }
  };

  return (
    <View style={s.reelCard}>
      {/* Full screen video */}
      <VideoPlayer
        uri={reel.media_url}
        isVisible={isVisible}
        liked={liked}
        likeCount={likeCount}
        onLike={toggleLike}
        onComment={openComments}
        onShare={() => {}}
        saved={saved}
        onSave={toggleSave}
        authorName={reel.author_name}
        authorAvatar={reel.author_avatar}
        caption={reel.caption}
        commentCount={reel.comment_count}
        fullScreen
      />

      {/* Bottom info */}
      <View style={s.bottomInfo}>
        <TouchableOpacity
          onPress={() => navigation.navigate('UserProfile', { userId: reel.user_id, userName: reel.author_name, userAvatar: reel.author_avatar })}
        >
          <AppText style={s.authorName}>@{reel.author_username || reel.author_name}</AppText>
        </TouchableOpacity>
        {reel.caption ? (
          <TouchableOpacity onPress={() => setShowFullCaption(p => !p)}>
            <AppText style={s.caption} numberOfLines={showFullCaption ? undefined : 2}>
              {reel.caption}
            </AppText>
          </TouchableOpacity>
        ) : null}
        {reel.music?.title ? (
          <View style={s.musicRow}>
            <Ionicons name="musical-notes" size={12} color="#fff" />
            <AppText style={s.musicText} numberOfLines={1}>{reel.music.title} · {reel.music.artist}</AppText>
          </View>
        ) : null}
        <AppText style={s.timeText}>{timeAgo(reel.created_at)}</AppText>
      </View>

      {/* Comments modal */}
      <Modal visible={showComments} animationType="slide" transparent onRequestClose={() => setShowComments(false)}>
        <View style={s.commentsOverlay}>
          <BlurView intensity={20} tint="dark" style={s.commentsSheet}>
            <View style={s.commentsHandle} />
            <View style={s.commentsHeader}>
              <AppText style={s.commentsTitle}>Comments</AppText>
              <TouchableOpacity onPress={() => setShowComments(false)}>
                <Ionicons name="close" size={22} color="#94A3B8" />
              </TouchableOpacity>
            </View>
            {loadingComments
              ? <ActivityIndicator color="#7C3AED" style={{ marginTop: 30 }} />
              : <FL
                  data={comments}
                  keyExtractor={(_, i) => String(i)}
                  style={{ flex: 1 }}
                  contentContainerStyle={{ padding: 16 }}
                  ListEmptyComponent={<AppText style={{ color: '#64748B', textAlign: 'center', marginTop: 20 }}>No comments yet</AppText>}
                  renderItem={({ item }) => (
                    <View style={s.commentRow}>
                      <View style={s.commentAvatar}>
                        {item.author_avatar
                          ? <Image source={{ uri: item.author_avatar }} style={s.commentAvatarImg} />
                          : <AppText style={s.commentAvatarText}>{item.author_name?.[0] || 'U'}</AppText>}
                      </View>
                      <View style={{ flex: 1 }}>
                        <AppText style={s.commentText}>
                          <AppText style={s.commentName}>{item.author_name} </AppText>
                          {item.text}
                        </AppText>
                      </View>
                    </View>
                  )}
                />}
            <View style={s.commentInputRow}>
              <View style={s.commentAvatar}>
                {user?.avatar_url
                  ? <Image source={{ uri: user.avatar_url }} style={s.commentAvatarImg} />
                  : <AppText style={s.commentAvatarText}>{user?.name?.[0] || 'U'}</AppText>}
              </View>
              <TextInput
                style={s.commentInput}
                placeholder="Add a comment..."
                placeholderTextColor="#64748B"
                value={commentText}
                onChangeText={setCommentText}
              />
              <TouchableOpacity onPress={postComment} disabled={posting || !commentText.trim()}>
                {posting
                  ? <ActivityIndicator size="small" color="#7C3AED" />
                  : <AppText style={[s.postBtn, !commentText.trim() && { opacity: 0.4 }]}>Post</AppText>}
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>
      </Modal>
    </View>
  );
}

export default function ReelsScreen({ navigation, route }) {
  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [visibleIndex, setVisibleIndex] = useState(0);
  const flatListRef = useRef(null);
  const startPostId = route?.params?.startPostId;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) setVisibleIndex(viewableItems[0].index);
  }).current;

  const fetchReels = useCallback(async () => {
    try {
      const { data } = await api.get('/posts/reels');
      setReels(data.reels || []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchReels(); }, []);

  // Jump to the tapped video once reels are loaded
  useEffect(() => {
    if (!startPostId || reels.length === 0) return;
    const idx = reels.findIndex(r => r.id === startPostId);
    if (idx > 0) {
      setVisibleIndex(idx);
      flatListRef.current?.scrollToIndex({ index: idx, animated: false });
    }
  }, [reels, startPostId]);

  useFocusEffect(useCallback(() => {
    fetchReels();
    setVisibleIndex(0);
    return () => setVisibleIndex(-1);
  }, []));

  if (loading) {
    return (
      <View style={s.loader}>
        <LinearGradient colors={['#0F172A', '#1E1040', '#0F172A']} style={StyleSheet.absoluteFill} />
        <ActivityIndicator color="#7C3AED" size="large" />
      </View>
    );
  }

  if (reels.length === 0) {
    return (
      <View style={s.loader}>
        <LinearGradient colors={['#0F172A', '#1E1040', '#0F172A']} style={StyleSheet.absoluteFill} />
        <Ionicons name="film-outline" size={52} color="#7C3AED" />
        <AppText style={{ color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 16 }}>No Reels Yet</AppText>
        <AppText style={{ color: '#94A3B8', fontSize: 14, marginTop: 8, textAlign: 'center', paddingHorizontal: 40 }}>
          Post a public video to see it here
        </AppText>
        <TouchableOpacity
          style={s.createReelBtn}
          onPress={() => navigation.navigate('Create')}
        >
          <LinearGradient colors={['#7C3AED', '#3B82F6']} style={s.createReelBtnGrad}>
            <Ionicons name="add" size={18} color="#fff" />
            <AppText style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Create Reel</AppText>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <StatusBar style="light" />

      {/* Header overlay */}
      <View style={s.header} pointerEvents="none">
        <AppText style={s.headerTitle}>Reels</AppText>
      </View>

      <FlatList
        ref={flatListRef}
        data={reels}
        keyExtractor={i => String(i.id)}
        renderItem={({ item, index }) => (
          <ReelCard
            reel={item}
            isVisible={index === visibleIndex}
            navigation={navigation}
            onUpdate={fetchReels}
          />
        )}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={height}
        snapToAlignment="start"
        decelerationRate="fast"
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
        onScrollToIndexFailed={({ index }) => {
          setTimeout(() => flatListRef.current?.scrollToIndex({ index, animated: false }), 300);
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F172A' },

  header: {
    position: 'absolute', top: 0, left: 0, right: 0,
    paddingTop: 54, paddingHorizontal: 16, paddingBottom: 12,
    zIndex: 10,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },

  reelCard: { width, height, backgroundColor: '#000' },

  // Bottom info
  bottomInfo: {
    position: 'absolute', bottom: 90, left: 16, right: 80,
    gap: 6,
  },
  authorName: { color: '#fff', fontWeight: '800', fontSize: 15 },
  caption: { color: 'rgba(255,255,255,0.9)', fontSize: 13, lineHeight: 18 },
  musicRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, alignSelf: 'flex-start' },
  musicText: { color: '#fff', fontSize: 12, fontWeight: '600', maxWidth: 200 },
  timeText: { color: 'rgba(255,255,255,0.5)', fontSize: 11 },

  // Comments
  commentsOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  commentsSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '70%', overflow: 'hidden' },
  commentsHandle: { width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 8 },
  commentsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.1)' },
  commentsTitle: { fontSize: 15, fontWeight: '700', color: '#fff' },
  commentRow: { flexDirection: 'row', gap: 10, marginBottom: 16, alignItems: 'flex-start' },
  commentAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#7C3AED', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  commentAvatarImg: { width: 30, height: 30, borderRadius: 15 },
  commentAvatarText: { color: '#fff', fontWeight: '700', fontSize: 11 },
  commentText: { fontSize: 13, color: '#E2E8F0', lineHeight: 18 },
  commentName: { fontWeight: '700', color: '#fff' },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.1)' },
  commentInput: { flex: 1, color: '#fff', fontSize: 14 },
  postBtn: { color: '#7C3AED', fontWeight: '700', fontSize: 14 },

  createReelBtn: { marginTop: 24, borderRadius: 12, overflow: 'hidden' },
  createReelBtnGrad: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 14 },
});
