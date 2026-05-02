import { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import AppText from '../components/AppText';
import MentionTextInput from '../components/MentionTextInput';
import ParsedText from '../components/ParsedText';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';

/**
 * MentionTestScreen - Test the @mention system
 * 
 * This screen demonstrates:
 * 1. Typing @ to get user suggestions
 * 2. Auto-filtering as you type
 * 3. Selecting username (inserted without @)
 * 4. Displaying text with tappable mentions
 */
export default function MentionTestScreen({ navigation }) {
  const [text, setText] = useState('');
  const [mentions, setMentions] = useState([]);
  const [posts, setPosts] = useState([
    {
      id: 1,
      author: 'Sarah Johnson',
      text: 'Had a great time with john_smith at the beach!',
      mentions: [{ id: 123, username: 'john_smith', start: 21, end: 31 }],
    },
    {
      id: 2,
      author: 'Mike Davis',
      text: 'Hey emma_wilson check this out!',
      mentions: [{ id: 456, username: 'emma_wilson', start: 4, end: 15 }],
    },
  ]);

  const handlePost = () => {
    if (!text.trim()) return;

    const newPost = {
      id: Date.now(),
      author: 'You',
      text: text,
      mentions: mentions,
    };

    setPosts([newPost, ...posts]);
    setText('');
    setMentions([]);
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1C1A14', '#2A2720', '#1C1A14']}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <AppText style={styles.headerTitle}>@Mention Test</AppText>
      </View>

      {/* Instructions */}
      <View style={styles.instructions}>
        <AppText style={styles.instructionsTitle}>How to use:</AppText>
        <AppText style={styles.instructionsText}>
          1. Type @ to see user suggestions{'\n'}
          2. Type letters to filter (e.g., @j){'\n'}
          3. Select a user - username inserted without @{'\n'}
          4. Post to see tappable mentions
        </AppText>
      </View>

      {/* Input Section */}
      <View style={styles.inputSection}>
        <AppText style={styles.sectionTitle}>Create Post</AppText>
        <View style={styles.inputContainer}>
          <MentionTextInput
            value={text}
            onChangeText={setText}
            onMentionsChange={(m) => {
              setMentions(m);
              console.log('Mentions updated:', m);
            }}
            placeholder="Type @ to mention someone..."
            multiline
            maxLength={500}
            style={styles.mentionInput}
            inputStyle={styles.textInput}
          />
        </View>

        {mentions.length > 0 && (
          <View style={styles.mentionsInfo}>
            <Ionicons name="people" size={16} color={colors.primary} />
            <AppText style={styles.mentionsInfoText}>
              Mentioning: {mentions.map(m => m.username).join(', ')}
            </AppText>
          </View>
        )}

        <TouchableOpacity
          style={[styles.postBtn, !text.trim() && styles.postBtnDisabled]}
          onPress={handlePost}
          disabled={!text.trim()}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={text.trim() ? [colors.primary, '#3b82f6'] : ['#555', '#444']}
            style={styles.postBtnGradient}
          >
            <AppText style={styles.postBtnText}>Post</AppText>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Feed Section */}
      <View style={styles.feedSection}>
        <AppText style={styles.sectionTitle}>Feed (Tap usernames)</AppText>
        <ScrollView
          style={styles.feed}
          contentContainerStyle={styles.feedContent}
          showsVerticalScrollIndicator={false}
        >
          {posts.map((post) => (
            <View key={post.id} style={styles.postCard}>
              <View style={styles.postHeader}>
                <View style={styles.postAvatar}>
                  <AppText style={styles.postAvatarText}>
                    {post.author[0]}
                  </AppText>
                </View>
                <View style={styles.postHeaderInfo}>
                  <AppText style={styles.postAuthor}>{post.author}</AppText>
                  <AppText style={styles.postTime}>Just now</AppText>
                </View>
              </View>

              <ParsedText style={styles.postText} mentions={post.mentions}>
                {post.text}
              </ParsedText>

              {post.mentions.length > 0 && (
                <View style={styles.postMentions}>
                  <Ionicons name="at" size={12} color={colors.muted} />
                  <AppText style={styles.postMentionsText}>
                    {post.mentions.length} {post.mentions.length === 1 ? 'person' : 'people'} mentioned
                  </AppText>
                </View>
              )}
            </View>
          ))}

          {posts.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="chatbubbles-outline" size={48} color={colors.dim} />
              <AppText style={styles.emptyText}>No posts yet</AppText>
              <AppText style={styles.emptySubtext}>
                Create a post with mentions to see them here
              </AppText>
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
  },
  instructions: {
    margin: 16,
    padding: 16,
    backgroundColor: 'rgba(124,58,237,0.1)',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.3)',
  },
  instructionsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 13,
    color: colors.muted,
    lineHeight: 20,
  },
  inputSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  inputContainer: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border2,
    padding: 12,
    minHeight: 100,
  },
  mentionInput: {
    flex: 1,
  },
  textInput: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },
  mentionsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    padding: 8,
    backgroundColor: 'rgba(124,58,237,0.1)',
    borderRadius: radius.sm,
  },
  mentionsInfoText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  postBtn: {
    marginTop: 12,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  postBtnDisabled: {
    opacity: 0.5,
  },
  postBtnGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  feedSection: {
    flex: 1,
    padding: 16,
  },
  feed: {
    flex: 1,
  },
  feedContent: {
    gap: 12,
    paddingBottom: 20,
  },
  postCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border2,
    padding: 14,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  postAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  postHeaderInfo: {
    flex: 1,
  },
  postAuthor: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  postTime: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  postText: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },
  postMentions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
  },
  postMentionsText: {
    fontSize: 11,
    color: colors.muted,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.muted,
  },
  emptySubtext: {
    fontSize: 13,
    color: colors.dim,
    textAlign: 'center',
  },
});
