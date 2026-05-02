import { useState, useEffect, useRef } from 'react';
import {
  View, StyleSheet, TouchableOpacity, ScrollView, Dimensions,
  ActivityIndicator, Image, Share, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import AppText from '../components/AppText';
import { useTheme } from '../context/ThemeContext';
import api from '../api/axios';
import { colors, radius } from '../theme';

const { width, height } = Dimensions.get('window');

export default function StorybookViewerScreen({ route, navigation }) {
  const { storybookId } = route.params;
  const { theme, isDark } = useTheme();
  const [storybook, setStorybook] = useState(null);
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const scrollRef = useRef(null);

  useEffect(() => {
    fetchStorybook();
  }, [storybookId]);

  const fetchStorybook = async () => {
    try {
      const res = await api.get(`/storybooks/${storybookId}`);
      console.log('Storybook response:', res.data);
      setStorybook(res.data.storybook);
      
      // The backend returns stories inside the storybook object
      const storiesData = res.data.storybook?.stories || res.data.stories || [];
      console.log('Stories found:', storiesData.length);
      setStories(storiesData);
    } catch (err) {
      console.error('Fetch storybook error:', err);
      Alert.alert('Error', 'Failed to load storybook');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleScroll = (event) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const page = Math.round(offsetX / width);
    setCurrentPage(page);
  };

  const goToPage = (index) => {
    scrollRef.current?.scrollTo({ x: index * width, animated: true });
    setCurrentPage(index);
  };

  const shareStorybook = async () => {
    try {
      await Share.share({
        message: `Check out this family storybook: "${storybook.title}" with ${stories.length} stories!`,
      });
    } catch (err) {}
  };

  const deleteStorybook = () => {
    Alert.alert(
      'Delete Storybook',
      `Are you sure you want to delete "${storybook.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/storybooks/${storybookId}`);
              navigation.goBack();
            } catch (err) {
              Alert.alert('Error', 'Failed to delete storybook');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[s.container, { backgroundColor: theme.bg }]}>
        <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: 100 }} />
      </View>
    );
  }

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <LinearGradient
        colors={isDark ? ['#0f172a', '#1a0f2e', '#0f172a'] : [theme.bg, theme.bgSecondary, theme.bg]}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <BlurView intensity={20} tint={isDark ? 'dark' : 'light'} style={s.header}>
        <LinearGradient
          colors={['rgba(15,23,42,0.9)', 'rgba(15,23,42,0.7)']}
          style={StyleSheet.absoluteFill}
        />
        <View style={s.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <AppText style={s.headerTitle}>{storybook.title}</AppText>
            <AppText style={s.headerSub}>
              {stories.length} {stories.length === 1 ? 'story' : 'stories'}
            </AppText>
          </View>
          <TouchableOpacity onPress={shareStorybook} style={s.iconBtn}>
            <Ionicons name="share-outline" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={deleteStorybook} style={s.iconBtn}>
            <Ionicons name="trash-outline" size={24} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </BlurView>

      {/* Page Indicator */}
      <View style={s.pageIndicator}>
        <AppText style={s.pageText}>
          {currentPage + 1} / {stories.length}
        </AppText>
      </View>

      {/* Stories Carousel */}
      {stories.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="book-outline" size={64} color={colors.muted} />
          <AppText style={[s.emptyTitle, { color: theme.text }]}>No stories in this book</AppText>
          {storybook?.compiled_content && (
            <ScrollView style={s.compiledScroll} contentContainerStyle={{ padding: 20 }}>
              <AppText style={[s.compiledText, { color: theme.text }]}>{storybook.compiled_content}</AppText>
            </ScrollView>
          )}
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {stories.map((story, index) => (
            <StoryPage key={story.id} story={story} isActive={currentPage === index} theme={theme} />
          ))}
        </ScrollView>
      )}

      {/* Bottom Navigation */}
      {stories.length > 0 && (
        <View style={s.bottomNav}>
          <TouchableOpacity
            onPress={() => currentPage > 0 && goToPage(currentPage - 1)}
            disabled={currentPage === 0}
            style={[s.navBtn, currentPage === 0 && s.navBtnDisabled]}
          >
            <Ionicons
              name="chevron-back"
              size={24}
              color={currentPage === 0 ? colors.dim : '#fff'}
            />
          </TouchableOpacity>

          {/* Dots */}
          <View style={s.dots}>
            {stories.map((_, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => goToPage(index)}
                style={[s.dot, currentPage === index && s.dotActive]}
              />
            ))}
          </View>

          <TouchableOpacity
            onPress={() => currentPage < stories.length - 1 && goToPage(currentPage + 1)}
            disabled={currentPage === stories.length - 1}
            style={[s.navBtn, currentPage === stories.length - 1 && s.navBtnDisabled]}
          >
            <Ionicons
              name="chevron-forward"
              size={24}
              color={currentPage === stories.length - 1 ? colors.dim : '#fff'}
            />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function StoryPage({ story, isActive, theme }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) {
      if (isActive) {
        videoRef.current.playAsync();
      } else {
        videoRef.current.pauseAsync();
      }
    }
  }, [isActive]);

  return (
    <View style={s.page}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.pageContent}>
        {/* Media */}
        {story.media_url && (
          <View style={s.mediaContainer}>
            {story.media_type === 'image' ? (
              <Image source={{ uri: story.media_url }} style={s.media} resizeMode="cover" />
            ) : story.media_type === 'video' ? (
              <Video
                ref={videoRef}
                source={{ uri: story.media_url }}
                style={s.media}
                resizeMode={ResizeMode.COVER}
                shouldPlay={isActive}
                isLooping
                useNativeControls
              />
            ) : null}
          </View>
        )}

        {/* Content Card */}
        <BlurView intensity={20} tint="dark" style={s.contentCard}>
          <LinearGradient
            colors={['rgba(124,58,237,0.1)', 'rgba(15,23,42,0.8)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={s.cardInner}>
            {/* Author */}
            <View style={s.authorRow}>
              {story.author_avatar ? (
                <Image source={{ uri: story.author_avatar }} style={s.avatar} />
              ) : (
                <View style={[s.avatar, { backgroundColor: colors.primary }]}>
                  <AppText style={s.avatarText}>{story.author_name?.[0] || 'U'}</AppText>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <AppText style={s.authorName}>{story.author_name}</AppText>
                <AppText style={s.dateText}>
                  {story.story_date
                    ? new Date(story.story_date).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : new Date(story.created_at).toLocaleDateString()}
                </AppText>
              </View>
            </View>

            {/* Title */}
            {story.title && <AppText style={s.storyTitle}>{story.title}</AppText>}

            {/* Content */}
            {(story.content || story.summary) && (
              <AppText style={s.storyContent}>{story.content || story.summary}</AppText>
            )}

            {/* Tags */}
            {story.tags?.length > 0 && (
              <View style={s.tagsRow}>
                {story.tags.map((tag, i) => (
                  <View key={i} style={s.tag}>
                    <AppText style={s.tagText}>#{tag}</AppText>
                  </View>
                ))}
              </View>
            )}

            {/* Stats */}
            <View style={s.stats}>
              <View style={s.statItem}>
                <Ionicons name="heart" size={16} color="#e11d48" />
                <AppText style={s.statText}>{story.like_count || 0}</AppText>
              </View>
              <View style={s.statItem}>
                <Ionicons name="chatbubble" size={16} color="#3b82f6" />
                <AppText style={s.statText}>{story.comment_count || 0}</AppText>
              </View>
            </View>
          </View>
        </BlurView>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 52,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(124,58,237,0.2)',
    overflow: 'hidden',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  iconBtn: { padding: 8 },
  pageIndicator: {
    position: 'absolute',
    top: 120,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    zIndex: 10,
  },
  pageText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  page: { width, height: height - 200 },
  pageContent: { padding: 20, paddingBottom: 100 },
  mediaContainer: {
    width: width - 40,
    height: 300,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: 20,
    backgroundColor: '#000',
  },
  media: { width: '100%', height: '100%' },
  contentCard: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.3)',
  },
  cardInner: { padding: 20 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  authorName: { fontSize: 15, fontWeight: '700', color: '#fff' },
  dateText: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  storyTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 12,
    lineHeight: 28,
  },
  storyContent: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 22,
    marginBottom: 16,
  },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  tag: {
    backgroundColor: 'rgba(124,58,237,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.4)',
  },
  tagText: { color: '#a78bfa', fontSize: 12, fontWeight: '600' },
  stats: { flexDirection: 'row', gap: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statText: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '600' },
  bottomNav: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: radius.full,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  navBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124,58,237,0.3)',
  },
  navBtnDisabled: { backgroundColor: 'rgba(71,85,105,0.3)' },
  dots: { flexDirection: 'row', gap: 8, flex: 1, justifyContent: 'center' },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dotActive: { backgroundColor: '#7c3aed', width: 24 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  compiledScroll: { flex: 1, width: '100%', marginTop: 20 },
  compiledText: { fontSize: 15, lineHeight: 24, color: colors.text },
});
