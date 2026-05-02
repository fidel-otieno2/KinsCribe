import { useState, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
} from 'react-native';
import AppText from './AppText';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';
import api from '../api/axios';

/**
 * MentionTextInput - A text input that supports @mentions
 * 
 * Usage:
 * <MentionTextInput
 *   value={text}
 *   onChangeText={setText}
 *   onMentionsChange={(mentions) => console.log(mentions)}
 *   placeholder="Write something..."
 *   multiline
 * />
 */
export default function MentionTextInput({
  value,
  onChangeText,
  onMentionsChange,
  placeholder,
  multiline = false,
  maxLength,
  style,
  inputStyle,
  ...props
}) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [mentions, setMentions] = useState([]); // Array of {id, username, start, end}
  const inputRef = useRef(null);
  const searchTimeout = useRef(null);

  // Extract @mention query from text at cursor position
  const extractMentionQuery = (text, position) => {
    // Find the last @ before cursor
    const textBeforeCursor = text.substring(0, position);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex === -1) return null;
    
    // Check if there's a space or newline after the @
    const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
    if (textAfterAt.includes(' ') || textAfterAt.includes('\n')) return null;
    
    // Check if @ is at start or preceded by space/newline
    if (lastAtIndex > 0) {
      const charBeforeAt = text[lastAtIndex - 1];
      if (charBeforeAt !== ' ' && charBeforeAt !== '\n') return null;
    }
    
    return {
      query: textAfterAt,
      start: lastAtIndex,
    };
  };

  // Search for users when typing @mention
  const searchUsers = async (query) => {
    if (!query || query.length < 1) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.get('/users/search', {
        params: { q: query, limit: 10 },
      });
      setSuggestions(data.users || []);
    } catch (error) {
      console.error('Error searching users:', error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle text change
  const handleTextChange = (text) => {
    onChangeText(text);
    
    const mention = extractMentionQuery(text, cursorPosition);
    
    if (mention) {
      setMentionQuery(mention.query);
      setShowSuggestions(true);
      
      // Debounce search
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
      searchTimeout.current = setTimeout(() => {
        searchUsers(mention.query);
      }, 300);
    } else {
      setShowSuggestions(false);
      setSuggestions([]);
      setMentionQuery('');
    }
  };

  // Handle mention selection
  const handleSelectMention = (user) => {
    const mention = extractMentionQuery(value, cursorPosition);
    if (!mention) return;

    const beforeMention = value.substring(0, mention.start);
    const afterMention = value.substring(cursorPosition);
    const mentionText = `@${user.username}`;
    const newText = beforeMention + mentionText + ' ' + afterMention;
    
    // Track this mention
    const newMention = {
      id: user.id,
      username: user.username,
      start: mention.start,
      end: mention.start + mentionText.length,
    };
    
    const updatedMentions = [...mentions, newMention];
    setMentions(updatedMentions);
    
    if (onMentionsChange) {
      onMentionsChange(updatedMentions);
    }

    onChangeText(newText);
    setShowSuggestions(false);
    setSuggestions([]);
    setMentionQuery('');
    
    // Set cursor after mention
    setTimeout(() => {
      if (inputRef.current) {
        const newPosition = mention.start + mentionText.length + 1;
        inputRef.current.setNativeProps({
          selection: { start: newPosition, end: newPosition },
        });
      }
    }, 10);
  };

  return (
    <View style={[styles.container, style]}>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleTextChange}
        onSelectionChange={(e) => setCursorPosition(e.nativeEvent.selection.start)}
        placeholder={placeholder}
        placeholderTextColor={colors.dim}
        multiline={multiline}
        maxLength={maxLength}
        style={[styles.input, inputStyle]}
        {...props}
      />

      {showSuggestions && (
        <View style={styles.suggestionsContainer}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
              <AppText style={styles.loadingText}>Searching...</AppText>
            </View>
          ) : suggestions.length > 0 ? (
            <FlatList
              data={suggestions}
              keyExtractor={(item) => item.id.toString()}
              keyboardShouldPersistTaps="always"
              style={styles.suggestionsList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.suggestionItem}
                  onPress={() => handleSelectMention(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.suggestionAvatar}>
                    {item.avatar_url ? (
                      <Image
                        source={{ uri: item.avatar_url }}
                        style={styles.avatarImage}
                      />
                    ) : (
                      <View style={styles.avatarPlaceholder}>
                        <AppText style={styles.avatarLetter}>
                          {item.name?.[0]?.toUpperCase() || 'U'}
                        </AppText>
                      </View>
                    )}
                  </View>
                  <View style={styles.suggestionInfo}>
                    <AppText style={styles.suggestionName}>{item.name}</AppText>
                    <AppText style={styles.suggestionUsername}>@{item.username}</AppText>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                </TouchableOpacity>
              )}
            />
          ) : mentionQuery.length > 0 ? (
            <View style={styles.noResults}>
              <Ionicons name="search-outline" size={24} color={colors.dim} />
              <AppText style={styles.noResultsText}>No users found</AppText>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  input: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  suggestionsContainer: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border2,
    marginBottom: 8,
    maxHeight: 240,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  suggestionsList: {
    maxHeight: 240,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  suggestionAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  suggestionInfo: {
    flex: 1,
  },
  suggestionName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  suggestionUsername: {
    fontSize: 12,
    color: colors.muted,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: colors.muted,
  },
  noResults: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 8,
  },
  noResultsText: {
    fontSize: 13,
    color: colors.dim,
  },
});
