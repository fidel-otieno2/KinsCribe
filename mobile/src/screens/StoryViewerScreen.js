import { useState, useEffect, useRef } from 'react';
import {
  View, StyleSheet, Image, TouchableOpacity,
  Dimensions, StatusBar, Animated, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  Modal, FlatList,
} from 'react-native';
import AppText from '../components/AppText';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme';

const { width, height } = Dimensions.get('window');
const STORY_DURATION = 5000;

export default function StoryViewerScreen({ route, navigation }) {
  const { storyGroups, initialGroupIndex = 0 } = route.params;
  const { user } = useAuth();
  const [groupIndex, setGroupIndex] = useState(initialGroupIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showReply, setShowReply] = useState(false);
  const [showViews, setShowViews] = useState(false);
  const [views, setViews] = useState([]);
  const progress = useRef(new Animated.Value(0)).current;
  const animRef = useRef(null);

  const group = storyGroups[groupIndex];
  const story = group?.stories[storyIndex];

  useEffect(() => {
    if (!story) return;
    // Mark as viewed
    api.post(`/pstories/${story.id}/view`).catch(() => {});
    startProgress();
    return () => animRef.current?.stop();
  }, [groupIndex, storyIndex]);

  const startProgress = () => {
    progress.setValue(0);
    animRef.current?.stop();
    animRef.current = Animated.timing(progress, {
      toValue: 1,
      duration: STORY_DURATION,
      useNativeDriver: false,
    });
    animRef.current.start(({ finished }) => {
      if (finished) goNext();
    });
  };

  const goNext = () => {
    const group = storyGroups[groupIndex];
    if (storyIndex < group.stories.length - 1) {
      setStoryIndex(i => i + 1);
    } else if (groupIndex < storyGroups.length - 1) {
      setGroupIndex(g => g + 1);
      setStoryIndex(0);
    } else {
      navigation.goBack();
    }
  };

  const goPrev = () => {
    if (storyIndex > 0) {
      setStoryIndex(i => i - 1);
    } else if (groupIndex > 0) {
      setGroupIndex(g => g - 1);
      setStoryIndex(0);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/pstories/${story.id}`);
      goNext();
    } catch {}
  };

  const loadViews = async () => {
    try {
      const { data } = await api.get(`/pstories/${story.id}/views`);
      setViews(data.views || []);
      setShowViews(true);
    } catch { setShowViews(true); }
  };

  if (!story) return null;

  const isOwn = story.user_id === user?.id;

  return (
    <View style={s.container}>
      <StatusBar hidden />

      {/* Background */}
      {story.media_url && story.media_type === 'image' ? (
        <Image source={{ uri: story.media_url }} style={s.bg} resizeMode="cover" />
      ) : story.media_type === 'text' ? (
        <View style={[s.bg, { backgroundColor: story.bg_color || '#7c3aed' }]} />
      ) : (
        <View style={[s.bg, { backgroundColor: '#0f172a' }]} />
      )}

      {/* Gradient overlays */}
      <LinearGradient colors={['rgba(0,0,0,0.5)', 'transparent']} style={s.topGrad} />
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.6)']} style={s.bottomGrad} />

      {/* Text content */}
      {story.text_content ? (
        <View style={s.textOverlay}>
          <AppText style={s.storyText}>{story.text_content}</AppText>
        </View>
      ) : null}

      {/* Progress bars */}
      <View style={s.progressRow}>
        {group.stories.map((_, i) => (
          <View key={i} style={s.progressTrack}>
            <Animated.View
              style={[s.progressFill, {
                width: i < storyIndex ? '100%' : i === storyIndex
                  ? progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
                  : '0%'
              }]}
            />
          </View>
        ))}
      </View>

      {/* Header */}
      <View style={s.header}>
        <View style={s.authorRow}>
          <View style={s.avatar}>
            {group.author_avatar
              ? <Image source={{ uri: group.author_avatar }} style={s.avatarImg} />
              : <AppText style={s.avatarLetter}>{group.author_name?.[0]?.toUpperCase()}</AppText>}
          </View>
          <View>
            <AppText style={s.authorName}>{group.author_name}</AppText>
            <AppText style={s.storyTime}>
              {new Date(story.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </AppText>
          </View>
        </View>
        <View style={s.headerRight}>
          {isOwn && (
            <TouchableOpacity onPress={handleDelete} style={s.headerBtn}>
              <Ionicons name="trash-outline" size={20} color="#fff" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBtn}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tap zones */}
      <View style={s.tapZones}>
        <TouchableOpacity style={s.tapLeft} onPress={goPrev} />
        <TouchableOpacity style={s.tapRight} onPress={goNext} />
      </View>

      {/* Music pill */}
      {story.music_name && (
        <View style={s.musicPill}>
          <Ionicons name="musical-notes" size={12} color="#fff" />
          <AppText style={s.musicText} numberOfLines={1}>{story.music_name}</AppText>
        </View>
      )}

      {/* View count (own stories) */}
      {isOwn && (
        <TouchableOpacity style={s.viewCount} onPress={loadViews}>
          <Ionicons name="eye-outline" size={14} color="rgba(255,255,255,0.8)" />
          <AppText style={s.viewCountText}>{story.view_count || 0} views</AppText>
        </TouchableOpacity>
      )}

      {/* Reply bar */}
      {!isOwn && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.replyWrap}>
          <BlurView intensity={20} tint="dark" style={s.replyBar}>
            <TextInput
              style={s.replyInput}
              placeholder={`Reply to ${group.author_name}...`}
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={replyText}
              onChangeText={setReplyText}
              onFocus={() => { animRef.current?.stop(); }}
              onBlur={() => { if (!paused) startProgress(); }}
            />
            {replyText.trim() ? (
              <TouchableOpacity onPress={() => { setReplyText(''); }}>
                <Ionicons name="send" size={22} color={colors.primary} />
              </TouchableOpacity>
            ) : (
              <View style={s.replyEmojis}>
                {['❤️', '😂', '😮', '😢', '👏'].map(e => (
                  <TouchableOpacity key={e} onPress={() => setReplyText(e)}>
                    <AppText style={{ fontSize: 20 }}>{e}</AppText>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </BlurView>
        </KeyboardAvoidingView>
      )}

      {/* Views Modal */}
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
              views.map((v, i) => (
                <View key={i} style={s.viewRow}>
                  <View style={s.viewAvatar}>
                    {v.avatar_url
                      ? <Image source={{ uri: v.avatar_url }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                      : <AppText style={s.viewAvatarLetter}>{v.name?.[0]?.toUpperCase()}</AppText>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText style={s.viewName}>{v.name}</AppText>
                    <AppText style={s.viewTime}>{v.viewed_at ? new Date(v.viewed_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''}</AppText>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  bg: { position: 'absolute', width, height },
  topGrad: { position: 'absolute', top: 0, left: 0, right: 0, height: 120 },
  bottomGrad: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 200 },
  textOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', padding: 32 },
  storyText: { color: '#fff', fontSize: 24, fontWeight: '700', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  progressRow: { position: 'absolute', top: 52, left: 12, right: 12, flexDirection: 'row', gap: 4 },
  progressTrack: { flex: 1, height: 2.5, backgroundColor: 'rgba(255,255,255,0.35)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#fff', borderRadius: 2 },
  header: { position: 'absolute', top: 64, left: 12, right: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 2, borderColor: '#fff' },
  avatarImg: { width: '100%', height: '100%' },
  avatarLetter: { color: '#fff', fontWeight: '700', fontSize: 14 },
  authorName: { color: '#fff', fontWeight: '700', fontSize: 14 },
  storyTime: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
  headerRight: { flexDirection: 'row', gap: 8 },
  headerBtn: { padding: 6 },
  tapZones: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 100, flexDirection: 'row' },
  tapLeft: { flex: 1 },
  tapRight: { flex: 2 },
  musicPill: { position: 'absolute', bottom: 100, left: 16, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  musicText: { color: '#fff', fontSize: 12, maxWidth: 160 },
  viewCount: { position: 'absolute', bottom: 100, right: 16, flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewCountText: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  replyWrap: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  replyBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 28 },
  replyInput: { flex: 1, color: '#fff', fontSize: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10 },
  replyEmojis: { flexDirection: 'row', gap: 6 },
  viewsOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  viewsSheet: { backgroundColor: colors.bgSecondary, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 40, maxHeight: '60%' },
  viewsHandle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  viewsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  viewsTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  viewRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  viewAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  viewAvatarLetter: { color: '#fff', fontWeight: '700', fontSize: 16 },
  viewName: { fontSize: 14, fontWeight: '600', color: colors.text },
  viewTime: { fontSize: 11, color: colors.muted, marginTop: 2 },
});
