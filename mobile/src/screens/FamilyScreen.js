import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, TouchableOpacity, StyleSheet, ActivityIndicator,
  ScrollView, Image, RefreshControl, Alert, TextInput,
  Clipboard, Dimensions, Modal, FlatList, Animated,
} from 'react-native';
import AppText from '../components/AppText';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../i18n';
import { colors, radius } from '../theme';
import Toast from '../components/Toast';
import useToast from '../hooks/useToast';
import { HexAvatar } from './StoryViewerScreen';
import VideoPlayer from '../components/VideoPlayer';

const { width } = Dimensions.get('window');

const TABS = [
  { key: 'feed', icon: 'home-outline', iconActive: 'home', label: 'Feed' },
  { key: 'chat', icon: 'chatbubbles-outline', iconActive: 'chatbubbles', label: 'Chat' },
  { key: 'members', icon: 'people-outline', iconActive: 'people', label: 'Members' },
  { key: 'timeline', icon: 'git-branch-outline', iconActive: 'git-branch', label: 'Timeline' },
];

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function Avatar({ uri, name, size = 44 }) {
  return uri ? (
    <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
  ) : (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
      <AppText style={{ color: '#fff', fontWeight: '700', fontSize: size * 0.38 }}>{name?.[0]?.toUpperCase() || '?'}</AppText>
    </View>
  );
}

// ── Family Feed Tab ───────────────────────────────────────────
function FamilyFeedTab({ navigation, myRole, familyId, familyName }) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [stories, setStories] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [highlights, setHighlights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewer, setViewer] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [showComments, setShowComments] = useState(null);
  // Moments/stories bubbles
  const [moments, setMoments] = useState([]);
  const [visibleStoryId, setVisibleStoryId] = useState(null);

  const fetchStories = () => {
    Promise.all([
      api.get('/stories/feed').catch(() => ({ data: { stories: [] } })),
      api.get('/family/announcements').catch(() => ({ data: { announcements: [] } })),
      familyId ? api.get(`/pstories/family/${familyId}/moments`).catch(() => ({ data: { moments: [] } })) : Promise.resolve({ data: { moments: [] } }),
      familyId ? api.get(`/stories/family/${familyId}/highlights`).catch(() => ({ data: { stories: [] } })) : Promise.resolve({ data: { stories: [] } }),
    ]).then(([storiesRes, annRes, momentsRes, highlightsRes]) => {
      setStories(storiesRes.data.stories || []);
      setAnnouncements(annRes.data.announcements || []);
      setMoments(momentsRes.data.moments || []);
      setHighlights(highlightsRes.data.stories || []);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { fetchStories(); }, [familyId]);

  // Group moments by user for story bubbles
  const momentGroups = Object.values(
    moments.reduce((acc, m) => {
      if (!acc[m.user_id]) acc[m.user_id] = { user_id: m.user_id, author_name: m.author_name, author_avatar: m.author_avatar, stories: [] };
      acc[m.user_id].stories.push(m);
      return acc;
    }, {})
  );

  const toggleLike = async (story) => {
    const liked = story.liked_by_me;
    setStories(prev => prev.map(s => s.id === story.id
      ? { ...s, liked_by_me: !liked, like_count: liked ? s.like_count - 1 : s.like_count + 1 }
      : s
    ));
    try { await api.post(`/stories/${story.id}/like`); }
    catch { setStories(prev => prev.map(s => s.id === story.id ? { ...s, liked_by_me: liked, like_count: story.like_count } : s)); }
  };

  const deleteStory = (story) => {
    Alert.alert('Delete Story', 'Remove this family story?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/stories/${story.id}`);
          setStories(prev => prev.filter(s => s.id !== story.id));
        } catch { Alert.alert('Error', 'Could not delete story'); }
      }},
    ]);
  };

  const toggleArchive = async (story) => {
    const wasArchived = story.is_archived;
    // Remove from feed immediately if archiving
    if (!wasArchived) {
      setStories(prev => prev.filter(s => s.id !== story.id));
    }
    try {
      await api.post(`/stories/${story.id}/archive`);
      // Refresh to get updated list
      fetchStories();
    } catch {
      // Revert on error
      if (!wasArchived) {
        setStories(prev => [...prev, story]);
      }
    }
  };

  const toggleHighlight = async (story) => {
    const wasHighlighted = story.is_highlighted;
    setStories(prev => prev.map(s => s.id === story.id ? { ...s, is_highlighted: !wasHighlighted } : s));
    try {
      await api.post(`/stories/${story.id}/highlight`);
    } catch {
      setStories(prev => prev.map(s => s.id === story.id ? { ...s, is_highlighted: wasHighlighted } : s));
    }
  };

  const openComments = async (storyId) => {
    setShowComments(storyId);
    setLoadingComments(true);
    try {
      const { data } = await api.get(`/stories/${storyId}/comments`);
      setComments(data.comments || []);
    } catch {} finally { setLoadingComments(false); }
  };

  const postComment = async (storyId) => {
    if (!commentText.trim()) return;
    setPostingComment(true);
    try {
      const { data } = await api.post(`/stories/${storyId}/comments`, { text: commentText });
      setComments(prev => [...prev, { ...data.comment, author_name: user?.name }]);
      setCommentText('');
      setStories(prev => prev.map(s => s.id === storyId ? { ...s, comment_count: (s.comment_count || 0) + 1 } : s));
    } catch {} finally { setPostingComment(false); }
  };

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      const visibleStory = viewableItems.find(item => item.item?.media_type === 'video');
      setVisibleStoryId(visibleStory?.item?.id || null);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60,
  }).current;

  if (loading) return <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />;

  return (
    <>
    <FlatList
      data={stories}
      keyExtractor={(item) => String(item.id)}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 100 }}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={viewabilityConfig}
      ListHeaderComponent={

      <View>
      {/* ── MOMENTS / STORY BUBBLES ROW ── */}
      <View style={ft.storiesWrap}>
        <View style={ft.storiesHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={ft.storiesHeaderDot} />
            <AppText style={ft.storiesHeaderTitle}>Moments</AppText>
          </View>
          {momentGroups.filter(g => !g.stories.every(s => s.viewed_by_me)).length > 0 && (
            <View style={ft.unseenBadge}>
              <AppText style={ft.unseenBadgeText}>
                {momentGroups.filter(g => g.stories.some(s => !s.viewed_by_me)).length} new
              </AppText>
            </View>
          )}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ft.storiesRow}>
          {/* Add moment button */}
          <TouchableOpacity
            style={ft.storyItem}
            onPress={() => navigation.navigate('Create', {
              initialMode: 'story',
              momentConfig: { family_id: familyId, is_moment: true, expires_hours: 24 },
            })}
          >
            <View style={ft.addMomentWrap}>
              <HexAvatar uri={user?.avatar_url} name={user?.name} size={52} hasStory={false} />
              <View style={[ft.plusBadge, { backgroundColor: colors.primary }]}>
                <Ionicons name="add" size={12} color="#fff" />
              </View>
            </View>
            <AppText style={[ft.storyLabel, { color: colors.muted }]}>Add</AppText>
          </TouchableOpacity>

          {/* Moment bubbles */}
          {momentGroups.map((g, idx) => {
            const hasUnseen = g.stories.some(s => !s.viewed_by_me);
            const isMe = g.user_id === user?.id;
            return (
              <TouchableOpacity
                key={g.user_id}
                style={ft.storyItem}
                onPress={() => {
                  const storyGroups = momentGroups.map(gr => ({
                    user_id: gr.user_id,
                    author_name: gr.author_name,
                    author_avatar: gr.author_avatar,
                    is_self: gr.user_id === user?.id,
                    has_unseen: gr.stories.some(s => !s.viewed_by_me),
                    stories: gr.stories,
                  }));
                  navigation.navigate('StoryViewer', { storyGroups, initialGroupIndex: idx });
                }}
              >
                <View style={ft.hexWrap}>
                  <HexAvatar
                    uri={g.author_avatar}
                    name={g.author_name}
                    size={52}
                    hasStory
                    hasSeen={!hasUnseen}
                  />
                </View>
                <AppText style={[ft.storyLabel, { color: hasUnseen ? colors.text : colors.muted }]} numberOfLines={1}>
                  {isMe ? 'You' : g.author_name?.split(' ')[0]}
                </AppText>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={{ padding: 16 }}>
      {/* Family Highlights */}
      {highlights.length > 0 && (
        <View style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Ionicons name="star" size={16} color="#7c3aed" />
            <AppText style={ft.sectionLabel}>Family Highlights</AppText>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
            {highlights.map(h => (
              <TouchableOpacity
                key={h.id}
                style={ft.highlightCard}
                onPress={() => setViewer(h)}
                activeOpacity={0.85}
              >
                <LinearGradient colors={['rgba(124,58,237,0.2)', 'rgba(59,130,246,0.1)']} style={StyleSheet.absoluteFill} />
                {h.media_url && h.media_type === 'image' && (
                  <Image source={{ uri: h.media_url }} style={ft.highlightThumb} resizeMode="cover" />
                )}
                {h.media_url && h.media_type === 'video' && (
                  <View style={ft.highlightThumb}>
                    <Image 
                      source={{ uri: h.media_url.includes('cloudinary.com') 
                        ? h.media_url.replace('/video/upload/', '/video/upload/so_0,f_jpg/') 
                        : h.media_url 
                      }} 
                      style={StyleSheet.absoluteFill} 
                      resizeMode="cover" 
                    />
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' }]}>
                      <Ionicons name="play-circle" size={32} color="#fff" />
                    </View>
                  </View>
                )}
                {!h.media_url && (
                  <View style={[ft.highlightThumb, { backgroundColor: 'rgba(124,58,237,0.15)', alignItems: 'center', justifyContent: 'center' }]}>
                    <Ionicons name="document-text-outline" size={32} color="#7c3aed" />
                  </View>
                )}
                <View style={ft.highlightInfo}>
                  <AppText style={ft.highlightTitle} numberOfLines={2}>{h.title}</AppText>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    <Avatar uri={h.author_avatar} name={h.author_name} size={16} />
                    <AppText style={ft.highlightAuthor} numberOfLines={1}>{h.author_name}</AppText>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Announcements */}
      {announcements.length > 0 && (
        <View style={{ marginBottom: 16 }}>
          <AppText style={ft.sectionLabel}>📢 Announcements</AppText>
          {announcements.map(ann => (
            <View key={ann.id} style={ft.announcementCard}>
              <LinearGradient colors={['rgba(245,158,11,0.15)', 'rgba(30,41,59,0.9)']} style={StyleSheet.absoluteFill} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Ionicons name="megaphone" size={16} color="#f59e0b" />
                <AppText style={ft.announcementTitle}>{ann.title}</AppText>
              </View>
              {ann.content ? <AppText style={ft.announcementContent}>{ann.content}</AppText> : null}
              <AppText style={ft.time}>{timeAgo(ann.created_at)}</AppText>
            </View>
          ))}
        </View>
      )}

      </View>{/* end padding wrapper */}
      </View>
      }
      ListEmptyComponent={
        <View style={ft.empty}>
          <Ionicons name="library-outline" size={48} color={colors.dim} />
          <AppText style={ft.emptyTitle}>{t('no_family_stories')}</AppText>
          <AppText style={ft.emptySub}>{t('share_first_memory')}</AppText>
        </View>
      }
      renderItem={({ item: story }) => (
        <View key={story.id} style={ft.card}>
          {/* Badges for archived/highlighted */}
          {(story.is_archived || story.is_highlighted) && (
            <View style={ft.badgesRow}>
              {story.is_archived && (
                <View style={ft.archivedBadge}>
                  <Ionicons name="archive" size={11} color="#f59e0b" />
                  <AppText style={ft.archivedBadgeText}>Archived</AppText>
                </View>
              )}
              {story.is_highlighted && (
                <View style={ft.highlightedBadge}>
                  <Ionicons name="star" size={11} color="#7c3aed" />
                  <AppText style={ft.highlightedBadgeText}>Highlighted</AppText>
                </View>
              )}
            </View>
          )}
          {/* Header */}
          <View style={ft.cardHeader}>
            <TouchableOpacity onPress={() => navigation.navigate('UserProfile', { userId: story.user_id, userName: story.author_name })}>
              <Avatar uri={story.author_avatar} name={story.author_name} size={38} />
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <AppText style={ft.authorName}>{story.author_name}</AppText>
              <AppText style={ft.time}>{timeAgo(story.created_at)}</AppText>
            </View>
            {/* Delete — only owner or admin */}
            {(story.user_id === user?.id || myRole === 'admin') && (
              <TouchableOpacity onPress={() => deleteStory(story)} style={{ padding: 6 }}>
                <Ionicons name="trash-outline" size={18} color="#f87171" />
              </TouchableOpacity>
            )}
          </View>

          {/* Title & content */}
          <AppText style={ft.title}>{story.title}</AppText>
          {story.content ? <AppText style={ft.content} numberOfLines={3}>{story.content}</AppText> : null}

          {/* Media — tappable for full screen */}
          {story.media_url && story.media_type === 'video' ? (
            <View style={ft.videoCard}>
              <VideoPlayer
                uri={story.media_url}
                isVisible={visibleStoryId === story.id}
                feedMode
                onPress={() => setViewer(story)}
              />
            </View>
          ) : story.media_url ? (
            <TouchableOpacity onPress={() => setViewer(story)} activeOpacity={0.9}>
              <Image source={{ uri: story.media_url }} style={ft.media} resizeMode="cover" />
            </TouchableOpacity>
          ) : null}

          {/* Actions — like, comment, archive, highlight */}
          <View style={ft.actions}>
            <TouchableOpacity style={ft.actionItem} onPress={() => toggleLike(story)}>
              <Ionicons
                name={story.liked_by_me ? 'heart' : 'heart-outline'}
                size={20}
                color={story.liked_by_me ? '#e11d48' : colors.muted}
              />
              <AppText style={[ft.actionText, story.liked_by_me && { color: '#e11d48' }]}>
                {story.like_count || 0}
              </AppText>
            </TouchableOpacity>
            <TouchableOpacity style={ft.actionItem} onPress={() => openComments(story.id)}>
              <Ionicons name="chatbubble-outline" size={20} color={colors.muted} />
              <AppText style={ft.actionText}>{story.comment_count || 0}</AppText>
            </TouchableOpacity>
            {/* Archive — owner only */}
            {story.user_id === user?.id && (
              <TouchableOpacity style={ft.actionItem} onPress={() => toggleArchive(story)}>
                <Ionicons
                  name={story.is_archived ? 'archive' : 'archive-outline'}
                  size={20}
                  color={story.is_archived ? '#f59e0b' : colors.muted}
                />
              </TouchableOpacity>
            )}
            {/* Highlight — owner or admin */}
            {(story.user_id === user?.id || myRole === 'admin') && (
              <TouchableOpacity style={ft.actionItem} onPress={() => toggleHighlight(story)}>
                <Ionicons
                  name={story.is_highlighted ? 'star' : 'star-outline'}
                  size={20}
                  color={story.is_highlighted ? '#7c3aed' : colors.muted}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    />

    {/* Full-screen media viewer */}
    <MediaViewer visible={!!viewer} story={viewer} onClose={() => setViewer(null)} myRole={myRole} user={user} />

    {/* Comments modal */}
    <Modal visible={!!showComments} animationType="slide" transparent onRequestClose={() => setShowComments(null)}>
        <View style={ft.commentsOverlay}>
          <View style={ft.commentsSheet}>
            <View style={ft.commentsHandle} />
            <View style={ft.commentsHeader}>
              <AppText style={ft.commentsTitle}>Comments</AppText>
              <TouchableOpacity onPress={() => setShowComments(null)}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>
            {loadingComments
              ? <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} />
              : <FlatList
                  data={comments}
                  keyExtractor={(_, i) => String(i)}
                  style={{ flex: 1 }}
                  contentContainerStyle={{ padding: 16 }}
                  ListEmptyComponent={<AppText style={{ color: colors.muted, textAlign: 'center', marginTop: 20 }}>No comments yet</AppText>}
                  renderItem={({ item }) => (
                    <View style={ft.commentRow}>
                      <View style={ft.commentAvatar}>
                        <AppText style={ft.commentAvatarText}>{item.author_name?.[0] || 'U'}</AppText>
                      </View>
                      <View style={{ flex: 1 }}>
                        <AppText style={ft.commentText}>
                          <AppText style={ft.commentName}>{item.author_name} </AppText>
                          {item.text}
                        </AppText>
                      </View>
                    </View>
                  )}
                />
            }
            <View style={ft.commentInputRow}>
              <View style={ft.commentAvatar}>
                <AppText style={ft.commentAvatarText}>{user?.name?.[0] || 'U'}</AppText>
              </View>
              <TextInput
                style={ft.commentInput}
                placeholder="Add a comment..."
                placeholderTextColor={colors.dim}
                value={commentText}
                onChangeText={setCommentText}
              />
              <TouchableOpacity onPress={() => postComment(showComments)} disabled={postingComment || !commentText.trim()}>
                {postingComment
                  ? <ActivityIndicator size="small" color={colors.primary} />
                  : <AppText style={[ft.postBtn, !commentText.trim() && { opacity: 0.4 }]}>Post</AppText>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function MediaViewer({ visible, story, onClose, myRole, user }) {
  const { Video, ResizeMode } = require('expo-av');
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (visible && story?.media_type === 'video') {
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
    }
  }, [visible, story]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={ft.viewerOverlay}>
        <TouchableOpacity style={ft.viewerClose} onPress={onClose}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        
        {story?.media_url && story?.media_type === 'video' ? (
          <Video
            ref={videoRef}
            source={{ uri: story.media_url }}
            style={{ width: '100%', height: '75%' }}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay={isPlaying}
            isLooping
            useNativeControls
          />
        ) : story?.media_url ? (
          <Image source={{ uri: story.media_url }} style={ft.viewerImg} resizeMode="contain" />
        ) : null}
        
        {story?.title ? (
          <View style={ft.viewerCaption}>
            <AppText style={ft.viewerTitle}>{story.title}</AppText>
            {story.content ? <AppText style={ft.viewerContent}>{story.content}</AppText> : null}
            {/* Action buttons in viewer */}
            <View style={ft.viewerActions}>
              {story.is_highlighted && (story.user_id === user?.id || myRole === 'admin') && (
                <TouchableOpacity
                  style={ft.viewerActionBtn}
                  onPress={async () => {
                    try {
                      await api.post(`/stories/${story.id}/highlight`);
                      onClose();
                    } catch {}
                  }}
                >
                  <Ionicons name="star-outline" size={18} color="#fff" />
                  <AppText style={ft.viewerActionText}>Remove Highlight</AppText>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const ft = StyleSheet.create({
  // Story bubbles
  storiesWrap: { borderBottomWidth: 0.5, borderBottomColor: colors.border },
  storiesHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  storiesHeaderDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  storiesHeaderTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: colors.text },
  unseenBadge: { backgroundColor: 'rgba(124,58,237,0.2)', borderWidth: 1, borderColor: 'rgba(124,58,237,0.4)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  unseenBadgeText: { fontSize: 10, fontWeight: '700', color: '#a78bfa' },
  storiesRow: { paddingHorizontal: 12, paddingVertical: 10, paddingBottom: 14, gap: 16 },
  storyItem: { alignItems: 'center', width: 66 },
  addMomentWrap: { position: 'relative', width: 62, height: 62, alignItems: 'center', justifyContent: 'center' },
  hexWrap: { position: 'relative', width: 62, height: 62, alignItems: 'center', justifyContent: 'center' },
  plusBadge: { position: 'absolute', bottom: 0, right: 0, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.bg },
  storyLabel: { fontSize: 11, textAlign: 'center', maxWidth: 66, marginTop: 5, fontWeight: '500' },
  // Highlights
  highlightCard: { width: 180, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)' },
  highlightThumb: { width: '100%', height: 100, backgroundColor: 'rgba(30,41,59,0.8)', alignItems: 'center', justifyContent: 'center' },
  highlightInfo: { padding: 10 },
  highlightTitle: { fontSize: 13, fontWeight: '700', color: colors.text, lineHeight: 17 },
  highlightAuthor: { fontSize: 11, color: colors.muted, flex: 1 },
  // Feed
  empty: { alignItems: 'center', marginTop: 60, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  emptySub: { fontSize: 14, color: colors.muted },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
  announcementCard: { borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)', padding: 14, marginBottom: 10 },
  announcementTitle: { fontSize: 14, fontWeight: '700', color: '#f59e0b', flex: 1 },
  announcementContent: { fontSize: 13, color: colors.text, lineHeight: 18, marginBottom: 6 },
  card: { backgroundColor: colors.bgSecondary, borderRadius: radius.lg, padding: 16, marginBottom: 12, borderWidth: 0.5, borderColor: colors.border },
  badgesRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  archivedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(245,158,11,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)' },
  archivedBadgeText: { fontSize: 10, color: '#f59e0b', fontWeight: '700' },
  highlightedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(124,58,237,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)' },
  highlightedBadgeText: { fontSize: 10, color: '#7c3aed', fontWeight: '700' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  authorName: { fontSize: 14, fontWeight: '700', color: colors.text },
  time: { fontSize: 12, color: colors.muted },
  privacyBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(16,185,129,0.1)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  privacyText: { fontSize: 11, color: '#10b981', fontWeight: '600' },
  groupBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(16,185,129,0.12)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 0.5, borderColor: 'rgba(16,185,129,0.3)' },
  groupBadgeText: { fontSize: 10, color: '#10b981', fontWeight: '700', maxWidth: 80 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 6 },
  content: { fontSize: 14, color: colors.muted, lineHeight: 20, marginBottom: 10 },
  videoCard: { width: '100%', backgroundColor: '#000', marginBottom: 10 },
  media: { width: '100%', height: 200, borderRadius: radius.md, marginBottom: 10 },
  actions: { flexDirection: 'row', gap: 20, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: colors.border, marginTop: 4 },
  actionItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { fontSize: 13, color: colors.muted, fontWeight: '600' },
  // Full-screen viewer
  viewerOverlay: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  viewerClose: { position: 'absolute', top: 52, right: 16, zIndex: 10, padding: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
  viewerImg: { width: '100%', height: '75%' },
  viewerCaption: { padding: 20 },
  viewerTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 6 },
  viewerContent: { fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 20 },
  viewerActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  viewerActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  viewerActionText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  // Comments
  commentsOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  commentsSheet: { backgroundColor: colors.bgCard || colors.bgSecondary, borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '70%' },
  commentsHandle: { width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 8 },
  commentsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  commentsTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  commentRow: { flexDirection: 'row', gap: 10, marginBottom: 16, alignItems: 'flex-start' },
  commentAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  commentAvatarText: { color: '#fff', fontWeight: '700', fontSize: 11 },
  commentText: { fontSize: 13, color: colors.text, lineHeight: 18 },
  commentName: { fontWeight: '700' },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderTopWidth: 0.5, borderTopColor: colors.border },
  commentInput: { flex: 1, color: colors.text, fontSize: 14 },
  postBtn: { color: colors.primary, fontWeight: '700', fontSize: 14 },
});

// ── Members Tab ───────────────────────────────────────────────
function MembersTab({ members, user, myRole, family, navigation, success, error }) {
  const { t } = useTranslation();
  const [inviteEmail, setInviteEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    Clipboard.setString(family?.invite_code || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sendInvite = async () => {
    if (!inviteEmail.trim()) return;
    setSending(true);
    try {
      await api.post('/family/invite/email', { email: inviteEmail.trim() });
      success(`Invite sent to ${inviteEmail.trim()}`);
      setInviteEmail('');
    } catch (err) {
      error(err.response?.data?.error || 'Failed to send invite');
    } finally { setSending(false); }
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
      {/* Invite code */}
      <BlurView intensity={20} tint="dark" style={mt.codeCard}>
        <LinearGradient colors={['rgba(124,58,237,0.2)', 'rgba(59,130,246,0.1)']} style={StyleSheet.absoluteFill} />
        <AppText style={mt.codeLabel}>Family Invite Code</AppText>
        <AppText style={mt.code}>{family?.invite_code}</AppText>
        <TouchableOpacity style={[mt.copyBtn, copied && mt.copyBtnDone]} onPress={copyCode}>
          <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color="#fff" />
          <AppText style={mt.copyBtnText}>{copied ? 'Copied!' : 'Copy Code'}</AppText>
        </TouchableOpacity>
      </BlurView>

      {/* Invite by email */}
      {myRole === 'admin' && (
        <View style={mt.inviteRow}>
          <TextInput
            style={mt.inviteInput}
            placeholder="Invite by email..."
            placeholderTextColor={colors.dim}
            keyboardType="email-address"
            autoCapitalize="none"
            value={inviteEmail}
            onChangeText={setInviteEmail}
          />
          <TouchableOpacity style={mt.sendBtn} onPress={sendInvite} disabled={sending}>
            {sending ? <ActivityIndicator color="#fff" size="small" /> : <AppText style={mt.sendBtnText}>{t('send')}</AppText>}
          </TouchableOpacity>
        </View>
      )}

      <AppText style={mt.sectionTitle}>Members ({members.length})</AppText>
      {members.map(m => (
        <TouchableOpacity
          key={m.id}
          style={mt.memberRow}
          onPress={() => navigation.navigate('UserProfile', { userId: m.id, userName: m.name, userAvatar: m.avatar_url })}
          onLongPress={() => {
            if (myRole !== 'admin' || m.id === user?.id) return;
            Alert.alert(
              `Manage ${m.name}`,
              'Change role or remove member',
              [
                { text: 'Make Admin', onPress: async () => { try { await api.patch(`/family/members/${m.id}/role`, { role: 'admin' }); } catch {} } },
                { text: 'Set View-Only', onPress: async () => { try { await api.patch(`/family/members/${m.id}/role`, { role: 'view-only' }); } catch {} } },
                { text: 'Set Member', onPress: async () => { try { await api.patch(`/family/members/${m.id}/role`, { role: 'member' }); } catch {} } },
                { text: 'Remove from Family', style: 'destructive', onPress: async () => { try { await api.delete(`/family/members/${m.id}`); } catch {} } },
                { text: 'Cancel', style: 'cancel' },
              ]
            );
          }}
          activeOpacity={0.8}
        >
          <Avatar uri={m.avatar_url} name={m.name} size={48} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <AppText style={mt.memberName}>{m.name}</AppText>
              {m.id === user?.id && <AppText style={mt.youBadge}>You</AppText>}
            </View>
            <AppText style={mt.memberEmail}>{m.email}</AppText>
          </View>
          <View style={[mt.roleBadge, m.role === 'admin' && mt.adminBadge, m.role === 'view-only' && mt.viewOnlyBadge]}>
            <AppText style={[mt.roleText, m.role === 'admin' && { color: '#f59e0b' }, m.role === 'view-only' && { color: '#94a3b8' }]}>
              {m.role === 'admin' ? '👑 Admin' : m.role === 'view-only' ? '👁 View Only' : m.role}
            </AppText>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const mt = StyleSheet.create({
  codeCard: { borderRadius: radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)', padding: 20, alignItems: 'center', gap: 8, marginBottom: 16 },
  codeLabel: { fontSize: 11, color: colors.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  code: { fontSize: 28, fontWeight: '800', color: colors.primary, letterSpacing: 8 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 9, borderRadius: 20 },
  copyBtnDone: { backgroundColor: '#10b981' },
  copyBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  inviteRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  inviteInput: { flex: 1, backgroundColor: 'rgba(30,41,59,0.8)', borderWidth: 1, borderColor: colors.border2, borderRadius: radius.md, padding: 12, color: colors.text, fontSize: 14 },
  sendBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: 18, justifyContent: 'center' },
  sendBtnText: { color: '#fff', fontWeight: '700' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  memberName: { fontSize: 15, fontWeight: '700', color: colors.text },
  youBadge: { fontSize: 10, color: colors.primary, fontWeight: '700', backgroundColor: 'rgba(124,58,237,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  memberEmail: { fontSize: 12, color: colors.muted, marginTop: 2 },
  roleBadge: { backgroundColor: 'rgba(30,41,59,0.8)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  adminBadge: { backgroundColor: 'rgba(245,158,11,0.15)' },
  viewOnlyBadge: { backgroundColor: 'rgba(148,163,184,0.15)' },
  roleText: { color: colors.muted, fontSize: 11, fontWeight: '600' },
});

// ── Timeline Tab ──────────────────────────────────────────────
function ChatRedirect({ navigation, family, onDone }) {
  useEffect(() => {
    navigation.navigate('Chat', {
      conversationId: null,
      title: `${family?.name || 'Family'} Chat`,
      type: 'family',
    });
    onDone();
  }, []);
  return null;
}

function TimelineTab({ navigation }) {
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/stories/timeline').then(({ data }) => {
      setStories(data.stories || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />;

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
      {stories.map((story, idx) => (
        <View key={story.id} style={tl.item}>
          <View style={tl.lineWrap}>
            <View style={tl.dot} />
            {idx < stories.length - 1 && <View style={tl.line} />}
          </View>
          <View style={tl.content}>
            <AppText style={tl.date}>
              {story.story_date
                ? new Date(story.story_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                : new Date(story.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
            </AppText>
            <TouchableOpacity style={tl.card} activeOpacity={0.85}>
              {story.media_url && story.media_type === 'image' && (
                <Image source={{ uri: story.media_url }} style={tl.media} resizeMode="cover" />
              )}
              <AppText style={tl.title}>{story.title}</AppText>
              {story.content ? <AppText style={tl.body} numberOfLines={2}>{story.content}</AppText> : null}
              <View style={tl.meta}>
                <Avatar uri={story.author_avatar} name={story.author_name} size={20} />
                <AppText style={tl.author}>{story.author_name}</AppText>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      ))}
      {stories.length === 0 && (
        <View style={{ alignItems: 'center', marginTop: 60, gap: 10 }}>
          <Ionicons name="git-branch-outline" size={48} color={colors.dim} />
          <AppText style={{ fontSize: 16, color: colors.muted }}>No timeline entries yet</AppText>
        </View>
      )}
    </ScrollView>
  );
}

const tl = StyleSheet.create({
  item: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  lineWrap: { alignItems: 'center', width: 20 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary, marginTop: 4 },
  line: { width: 2, flex: 1, backgroundColor: colors.border, marginTop: 4 },
  content: { flex: 1, paddingBottom: 20 },
  date: { fontSize: 12, color: colors.primary, fontWeight: '700', marginBottom: 6 },
  card: { backgroundColor: colors.bgSecondary, borderRadius: radius.md, overflow: 'hidden', borderWidth: 0.5, borderColor: colors.border },
  media: { width: '100%', height: 140 },
  title: { fontSize: 15, fontWeight: '700', color: colors.text, padding: 12, paddingBottom: 4 },
  body: { fontSize: 13, color: colors.muted, paddingHorizontal: 12, paddingBottom: 8, lineHeight: 18 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 12, paddingTop: 4, borderTopWidth: 0.5, borderTopColor: colors.border },
  author: { fontSize: 12, color: colors.muted },
});

// ── Main FamilyScreen ─────────────────────────────────────────
export default function FamilyScreen({ navigation }) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { toast, hide, success, error } = useToast();
  const [family, setFamily] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('feed');
  const [myRole, setMyRole] = useState('member');

  const fetchFamily = useCallback(async () => {
    try {
      const { data } = await api.get('/family/my-family');
      console.log('=== FAMILY DATA DEBUG ===');
      console.log('Full family object:', JSON.stringify(data.family, null, 2));
      console.log('Family name:', data.family?.name);
      console.log('Family avatar_url:', data.family?.avatar_url);
      console.log('Family motto:', data.family?.motto);
      console.log('Family description:', data.family?.description);
      console.log('========================');
      setFamily(data.family);
      const memberList = data.members || [];
      setMembers(memberList);
      // Derive role from members list — most reliable source
      const me = memberList.find(m => m.id === user?.id);
      setMyRole(me?.role || user?.role || 'member');
    } catch (err) {
      if (err.response?.status === 404) navigation.navigate('JoinFamily');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [navigation]);

  useEffect(() => { fetchFamily(); }, [fetchFamily]);
  useFocusEffect(useCallback(() => { fetchFamily(); }, [fetchFamily]));

  if (loading) return (
    <View style={[s.container, { alignItems: 'center', justifyContent: 'center' }]}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );

  return (
    <View style={s.container}>
      <Toast visible={toast.visible} type={toast.type} message={toast.message} onHide={hide} />
      <LinearGradient colors={['#0f172a', '#1a0f2e', '#0f172a']} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity 
          style={s.headerLeft}
          onPress={() => navigation.navigate('FamilyProfile')} 
          activeOpacity={0.75}
        >
          {/* Family Avatar */}
          <View style={s.familyAvatarWrap}>
            {family?.avatar_url ? (
              <Image 
                source={{ uri: family.avatar_url }} 
                style={s.familyAvatar}
                onError={(e) => console.log('Avatar load error:', e.nativeEvent.error)}
                onLoad={() => console.log('Avatar loaded successfully:', family.avatar_url)}
              />
            ) : (
              <LinearGradient colors={['#7c3aed', '#3b82f6']} style={s.familyAvatar}>
                <Ionicons name="people" size={24} color="#fff" />
              </LinearGradient>
            )}
          </View>
          
          {/* Family Info */}
          <View style={s.familyInfo}>
            <View style={s.familyNameRow}>
              <AppText style={s.familyName} numberOfLines={1}>{family?.name || 'My Family'}</AppText>
              {myRole === 'admin' && (
                <Ionicons name="create-outline" size={14} color={colors.primary} />
              )}
            </View>
            
            {family?.motto && (
              <View style={s.mottoContainer}>
                <Ionicons name="sparkles" size={10} color="#a78bfa" />
                <AppText style={s.familyMotto} numberOfLines={1}>"{family.motto}"</AppText>
                <Ionicons name="sparkles" size={10} color="#a78bfa" />
              </View>
            )}
            
            {family?.description && (
              <AppText style={s.familyDescription} numberOfLines={2}>{family.description}</AppText>
            )}
            
            {/* Show member count or placeholder */}
            {!family?.motto && !family?.description ? (
              <AppText style={s.memberCount}>{members.length} members</AppText>
            ) : !family?.description && family?.motto ? (
              <AppText style={s.memberCount}>{members.length} members</AppText>
            ) : null}
          </View>
        </TouchableOpacity>
        
        <View style={s.headerRight}>
          <TouchableOpacity
            style={s.aiBtnWrap}
            onPress={() => navigation.navigate('FamilyAI')}
            activeOpacity={0.8}
          >
            <LinearGradient colors={['#7c3aed', '#3b82f6']} style={s.aiBtn}>
              <Ionicons name="sparkles" size={15} color="#fff" />
              <AppText style={s.aiBtnText}>AI</AppText>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={s.chatBtn} onPress={() => navigation.navigate('Storybooks')}>
            <Ionicons name="book-outline" size={20} color={colors.muted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Quick access row */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.quickRow}>
        {[
          { icon: 'git-network-outline', label: 'Tree', screen: 'FamilyTree', color: '#7c3aed' },
          { icon: 'calendar-outline', label: 'Calendar', screen: 'FamilyCalendar', color: '#3b82f6' },
          { icon: 'sparkles-outline', label: 'Moments', screen: 'FamilyMoments', color: '#ec4899' },
          { icon: 'restaurant-outline', label: 'Recipes', screen: 'FamilyRecipes', color: '#f59e0b' },
          { icon: 'wallet-outline', label: 'Budget', screen: 'FamilyBudget', color: '#10b981' },
          { icon: 'book-outline', label: 'Storybooks', screen: 'Storybooks', color: '#ec4899' },
          { icon: 'chatbubbles-outline', label: 'Chat', screen: null, color: colors.primary },
          { icon: 'calendar-number-outline', label: 'On This Day', screen: 'OnThisDay', color: '#f59e0b' },
        ].map(item => (
          <TouchableOpacity
            key={item.label}
            style={s.quickItem}
            onPress={() => {
              if (item.screen === null) {
                navigation.navigate('Chat', { conversationId: null, title: `${family?.name || 'Family'} Chat`, type: 'family' });
              } else if (item.screen === 'FamilyMoments') {
                navigation.navigate('FamilyMoments', { familyId: family?.id, familyName: family?.name });
              } else {
                navigation.navigate(item.screen);
              }
            }}
          >
            <View style={[s.quickIcon, { backgroundColor: `${item.color}22` }]}>
              <Ionicons name={item.icon} size={22} color={item.color} />
            </View>
            <AppText style={s.quickLabel}>{item.label}</AppText>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Tab content */}
      {tab === 'feed' && <FamilyFeedTab navigation={navigation} myRole={myRole} familyId={family?.id} familyName={family?.name} />}
      {tab === 'chat' && <ChatRedirect navigation={navigation} family={family} onDone={() => setTab('feed')} />}
      {tab === 'members' && <MembersTab members={members} user={user} myRole={myRole} family={family} navigation={navigation} success={success} error={error} />}
      {tab === 'timeline' && <TimelineTab navigation={navigation} />}

      {/* ── BOTTOM TAB BAR ── */}
      <View style={s.bottomBar}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={s.bottomTabBtn}
            onPress={() => setTab(t.key)}
            activeOpacity={0.8}
          >
            <View style={[s.bottomTabIcon, tab === t.key && s.bottomTabIconActive]}>
              <Ionicons
                name={tab === t.key ? t.iconActive : t.icon}
                size={22}
                color={tab === t.key ? '#fff' : colors.muted}
              />
            </View>
            <AppText style={[s.bottomTabLabel, tab === t.key && s.bottomTabLabelActive]}>
              {t.label}
            </AppText>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 52, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, maxWidth: '70%' },
  familyAvatarWrap: { 
    width: 56, 
    height: 56, 
    borderRadius: 16, 
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(124,58,237,0.3)',
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  familyAvatar: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  familyInfo: { flex: 1, gap: 3 },
  familyNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  familyName: { fontSize: 18, fontWeight: '800', color: colors.text, flex: 1 },
  mottoContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 4,
    backgroundColor: 'rgba(124,58,237,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    alignSelf: 'flex-start',
    borderWidth: 0.5,
    borderColor: 'rgba(124,58,237,0.2)',
  },
  familyMotto: { 
    fontSize: 10, 
    color: '#a78bfa', 
    fontStyle: 'italic', 
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  familyDescription: { 
    fontSize: 11, 
    color: '#94a3b8', 
    lineHeight: 15,
    fontWeight: '500',
  },
  memberCount: { fontSize: 11, color: colors.muted },
  headerRight: { flexDirection: 'row', gap: 8 },
  chatBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(30,41,59,0.8)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border2 },
  aiBtnWrap: { borderRadius: 20, overflow: 'hidden' },
  aiBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  aiBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  tabRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: colors.border },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 3 },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
  tabLabel: { fontSize: 10, color: colors.muted, fontWeight: '600' },
  tabLabelActive: { color: colors.primary },
  quickRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 16 },
  quickItem: { alignItems: 'center', gap: 6, width: 60 },
  quickIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: 11, color: colors.muted, fontWeight: '600', textAlign: 'center' },

  // Bottom tab bar
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row',
    backgroundColor: 'rgba(15,23,42,0.97)',
    borderTopWidth: 0.5, borderTopColor: colors.border,
    paddingBottom: 24, paddingTop: 8,
  },
  bottomTabBtn: { flex: 1, alignItems: 'center', gap: 4 },
  bottomTabIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  bottomTabIconActive: { backgroundColor: 'rgba(124,58,237,0.2)' },
  bottomTabLabel: { fontSize: 10, color: colors.muted, fontWeight: '600' },
  bottomTabLabelActive: { color: colors.primary, fontWeight: '700' },
});
