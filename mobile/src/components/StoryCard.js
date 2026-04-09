import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image,
  Modal, TextInput, FlatList, KeyboardAvoidingView,
  Platform, ActivityIndicator, Alert, Share
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import VideoPlayer from './VideoPlayer';

export default function StoryCard({ story, onUpdate, isVisible = true }) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(story.like_count || 0);
  const [saved, setSaved] = useState(false);
  const [commentCount, setCommentCount] = useState(story.comment_count || 0);
  const [showComments, setShowComments] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [posting, setPosting] = useState(false);

  const isVideo = story.media_type === 'video' && !!story.media_url;
  const isOwner = story.user_id === user?.id;

  const toggleLike = async () => {
    const newLiked = !liked;
    setLiked(newLiked);
    setLikeCount(c => newLiked ? c + 1 : c - 1);
    try {
      await api.post(`/stories/${story.id}/like`);
      onUpdate();
    } catch {
      setLiked(!newLiked);
      setLikeCount(c => newLiked ? c - 1 : c + 1);
    }
  };

  const toggleSave = async () => {
    const newSaved = !saved;
    setSaved(newSaved);
    try { await api.post(`/stories/${story.id}/save`); }
    catch { setSaved(!newSaved); }
  };

  const handleShare = async () => {
    try {
      await Share.share({ message: `Check out this story on KinsCribe: "${story.title}"` });
    } catch {}
  };

  const handleDelete = () => {
    setShowMenu(false);
    Alert.alert('Delete Story', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await api.delete(`/stories/${story.id}`); onUpdate(); }
        catch { Alert.alert('Error', 'Could not delete story'); }
      }}
    ]);
  };

  const openComments = async () => {
    setShowComments(true);
    setLoadingComments(true);
    try {
      const { data } = await api.get(`/stories/${story.id}/comments`);
      setComments(data.comments);
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
      onUpdate();
    } catch {} finally { setPosting(false); }
  };

  return (
    <>
      <View style={s.card}>
        {/* Header */}
        <View style={s.header}>
          <View style={s.avatarRing}>
            <View style={s.avatar}>
              {story.author_avatar
                ? <Image source={{ uri: story.author_avatar }} style={s.avatarImg} />
                : <Text style={s.avatarText}>{story.author_name?.[0] || 'U'}</Text>}
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.username}>{story.author_name || 'Unknown'}</Text>
            {story.story_date && (
              <Text style={s.subtext}>{new Date(story.story_date).getFullYear()}</Text>
            )}
          </View>
          <TouchableOpacity onPress={() => setShowMenu(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="ellipsis-horizontal" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Media */}
        {isVideo ? (
          <VideoPlayer uri={story.media_url} isVisible={isVisible} />
        ) : story.media_type === 'image' && story.media_url ? (
          <Image source={{ uri: story.media_url }} style={s.media} resizeMode="cover" />
        ) : story.media_type === 'audio' && story.media_url ? (
          <View style={s.audioBox}>
            <Ionicons name="musical-notes" size={32} color={colors.primary} />
            <Text style={s.audioText}>Audio Story</Text>
          </View>
        ) : null}

        {/* Actions */}
        <View style={s.actions}>
          <View style={s.actionsLeft}>
            <TouchableOpacity onPress={toggleLike} style={s.actionBtn}>
              <Ionicons name={liked ? 'heart' : 'heart-outline'} size={27} color={liked ? '#e0245e' : colors.text} />
              {likeCount > 0 && <Text style={[s.actionCount, liked && { color: '#e0245e' }]}>{likeCount}</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={openComments} style={s.actionBtn}>
              <Ionicons name="chatbubble-outline" size={25} color={colors.text} />
              {commentCount > 0 && <Text style={s.actionCount}>{commentCount}</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={handleShare} style={s.actionBtn}>
              <Ionicons name="paper-plane-outline" size={25} color={colors.text} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={toggleSave}>
            <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={25} color={saved ? colors.primary : colors.text} />
          </TouchableOpacity>
        </View>

        {/* Caption */}
        <View style={s.captionWrap}>
          <Text style={s.caption}>
            <Text style={s.captionUser}>{story.author_name} </Text>
            <Text style={s.captionText}>{story.title}</Text>
          </Text>
          {story.content ? <Text style={s.captionBody}>{story.content}</Text> : null}
        </View>

        {/* AI Summary */}
        {story.summary ? (
          <View style={s.aiBox}>
            <Ionicons name="sparkles" size={12} color={colors.primary} />
            <Text style={s.aiText}> {story.summary}</Text>
          </View>
        ) : null}

        {/* Tags */}
        {story.tags?.length > 0 && (
          <View style={s.tagsRow}>
            {story.tags.map((tag, i) => <Text key={i} style={s.tag}>#{tag} </Text>)}
          </View>
        )}

        {/* View comments */}
        {commentCount > 0 && (
          <TouchableOpacity onPress={openComments}>
            <Text style={s.viewComments}>View all {commentCount} comments</Text>
          </TouchableOpacity>
        )}

        <Text style={s.timestamp}>
          {new Date(story.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }).toUpperCase()}
        </Text>
      </View>

      {/* 3-Dots Menu */}
      <Modal visible={showMenu} transparent animationType="slide">
        <TouchableOpacity style={s.menuOverlay} onPress={() => setShowMenu(false)} activeOpacity={1}>
          <View style={s.menuSheet}>
            <View style={s.sheetHandle} />
            {isOwner && (
              <TouchableOpacity style={s.menuItem} onPress={handleDelete}>
                <Ionicons name="trash-outline" size={22} color="#e0245e" />
                <Text style={[s.menuText, { color: '#e0245e' }]}>Delete Story</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={s.menuItem} onPress={() => { setShowMenu(false); handleShare(); }}>
              <Ionicons name="share-outline" size={22} color={colors.text} />
              <Text style={s.menuText}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.menuItem} onPress={() => { setShowMenu(false); toggleSave(); }}>
              <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={22} color={colors.text} />
              <Text style={s.menuText}>{saved ? 'Remove from Saved' : 'Save'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.menuItem, { borderTopWidth: 0.5, borderTopColor: colors.border }]} onPress={() => setShowMenu(false)}>
              <Text style={[s.menuText, { textAlign: 'center', flex: 1 }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Comments Modal */}
      <Modal visible={showComments} animationType="slide" transparent>
        <KeyboardAvoidingView style={s.modalWrap} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.commentsSheet}>
            <View style={s.sheetHandle} />
            <View style={s.commentsHeader}>
              <Text style={s.sheetTitle}>Comments</Text>
              <TouchableOpacity onPress={() => setShowComments(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            {loadingComments ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
            ) : (
              <FlatList
                data={comments}
                keyExtractor={(_, i) => String(i)}
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 16 }}
                ListEmptyComponent={<Text style={{ color: colors.dim, textAlign: 'center', marginTop: 20 }}>No comments yet.</Text>}
                renderItem={({ item }) => (
                  <View style={s.commentRow}>
                    <View style={s.commentAvatar}>
                      <Text style={s.commentAvatarText}>{item.author_name?.[0] || 'U'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.commentName}>{item.author_name || 'User'} <Text style={s.commentBody}>{item.text}</Text></Text>
                      <Text style={s.commentTime}>{new Date(item.created_at).toLocaleDateString()}</Text>
                    </View>
                    <TouchableOpacity>
                      <Ionicons name="heart-outline" size={14} color={colors.muted} />
                    </TouchableOpacity>
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
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 10 },
  avatarRing: { padding: 2, borderRadius: 20, borderWidth: 2, borderColor: colors.primary },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 34, height: 34, borderRadius: 17 },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  username: { fontSize: 13, fontWeight: '700', color: colors.text },
  subtext: { fontSize: 11, color: colors.muted },
  media: { width: '100%', height: 400 },
  audioBox: { height: 100, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', gap: 6 },
  audioText: { color: colors.muted, fontSize: 13 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8 },
  actionsLeft: { flexDirection: 'row', gap: 2 },
  actionBtn: { padding: 5, flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionCount: { fontSize: 13, color: colors.text, fontWeight: '600' },
  captionWrap: { paddingHorizontal: 14, marginBottom: 4 },
  caption: { fontSize: 13, color: colors.text, lineHeight: 18 },
  captionUser: { fontWeight: '700' },
  captionText: { fontWeight: '400' },
  captionBody: { fontSize: 13, color: '#bbb', marginTop: 3, lineHeight: 18 },
  aiBox: { flexDirection: 'row', marginHorizontal: 14, marginBottom: 6, backgroundColor: '#1a0a2e', padding: 8, borderRadius: 8 },
  aiText: { fontSize: 12, color: '#ccc', flex: 1 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 14, marginBottom: 4 },
  tag: { color: '#60a5fa', fontSize: 13 },
  viewComments: { paddingHorizontal: 14, color: colors.muted, fontSize: 13, marginBottom: 4 },
  timestamp: { paddingHorizontal: 14, paddingBottom: 12, fontSize: 10, color: colors.dim, letterSpacing: 0.5 },
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  menuSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 30 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18 },
  menuText: { fontSize: 15, color: colors.text, fontWeight: '500' },
  modalWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  commentsSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '75%' },
  sheetHandle: { width: 40, height: 4, backgroundColor: colors.border2, borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  commentsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  sheetTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  commentRow: { flexDirection: 'row', gap: 10, marginBottom: 18, alignItems: 'flex-start' },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  commentAvatarText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  commentName: { fontSize: 13, color: colors.text, lineHeight: 18, fontWeight: '700' },
  commentBody: { fontWeight: '400' },
  commentTime: { fontSize: 11, color: colors.muted, marginTop: 2 },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderTopWidth: 0.5, borderTopColor: colors.border },
  commentInput: { flex: 1, color: colors.text, fontSize: 14, maxHeight: 80 },
  postBtn: { color: '#4f9eff', fontWeight: '700', fontSize: 14 },
});
