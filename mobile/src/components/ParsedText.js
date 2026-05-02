import { Text, TouchableOpacity } from 'react-native';
import AppText from '../components/AppText';
import { colors } from '../theme';
import { useNavigation } from '@react-navigation/native';
import api from '../api/axios';
import { useState, useEffect } from 'react';

/**
 * ParsedText - Renders text with clickable @mentions and #hashtags
 * Also detects usernames from mentions array and makes them tappable
 * 
 * Usage:
 * <ParsedText style={styles.text} mentions={[{id: 1, username: 'john', start: 4, end: 8}]}>
 *   Hey john check out #family photos!
 * </ParsedText>
 */
export default function ParsedText({ children, style, mentions = [], onMentionPress, onHashtagPress }) {
  const navigation = useNavigation();

  if (!children || typeof children !== 'string') {
    return <AppText style={style}>{children}</AppText>;
  }

  // Build parts array with mentions, @mentions, and #hashtags
  const parts = [];
  let lastIndex = 0;
  
  // First, add all tracked mentions (usernames inserted via MentionTextInput)
  const sortedMentions = [...mentions].sort((a, b) => a.start - b.start);
  
  // Combine mentions with @mentions and #hashtags
  const allMatches = [];
  
  // Add tracked mentions
  sortedMentions.forEach(mention => {
    allMatches.push({
      type: 'mention',
      start: mention.start,
      end: mention.end,
      content: children.substring(mention.start, mention.end),
      username: mention.username,
      userId: mention.id,
    });
  });
  
  // Find @mentions in text
  const mentionRegex = /@(\w+)/g;
  let match;
  while ((match = mentionRegex.exec(children)) !== null) {
    // Check if this overlaps with tracked mentions
    const overlaps = sortedMentions.some(m => 
      (match.index >= m.start && match.index < m.end) ||
      (match.index + match[0].length > m.start && match.index + match[0].length <= m.end)
    );
    
    if (!overlaps) {
      allMatches.push({
        type: 'mention',
        start: match.index,
        end: match.index + match[0].length,
        content: match[0],
        username: match[1],
      });
    }
  }
  
  // Find #hashtags
  const hashtagRegex = /#(\w+)/g;
  while ((match = hashtagRegex.exec(children)) !== null) {
    allMatches.push({
      type: 'hashtag',
      start: match.index,
      end: match.index + match[0].length,
      content: match[0],
      tag: match[1],
    });
  }
  
  // Sort all matches by position
  allMatches.sort((a, b) => a.start - b.start);
  
  // Build parts array
  allMatches.forEach(item => {
    // Add text before this match
    if (item.start > lastIndex) {
      parts.push({
        type: 'text',
        content: children.substring(lastIndex, item.start),
      });
    }
    
    // Add the match
    parts.push(item);
    lastIndex = item.end;
  });
  
  // Add remaining text
  if (lastIndex < children.length) {
    parts.push({
      type: 'text',
      content: children.substring(lastIndex),
    });
  }

  // If no special parts found, return plain text
  if (parts.length === 0) {
    return <AppText style={style}>{children}</AppText>;
  }

  const handleMentionPress = (username, userId) => {
    if (onMentionPress) {
      onMentionPress(username, userId);
    } else {
      // Default: navigate to user profile
      if (userId) {
        navigation.navigate('UserProfile', { userId });
      } else {
        navigation.navigate('UserProfile', { username });
      }
    }
  };

  const handleHashtagPress = (tag) => {
    if (onHashtagPress) {
      onHashtagPress(tag);
    } else {
      // Default: navigate to hashtag feed (you can implement this later)
      console.log('Hashtag pressed:', tag);
    }
  };

  return (
    <AppText style={style}>
      {parts.map((part, index) => {
        if (part.type === 'mention') {
          return (
            <Text
              key={index}
              style={{ 
                color: '#8b5cf6', // Purple color for @mentions
                fontWeight: '700',
                backgroundColor: 'rgba(139, 92, 246, 0.15)', // Light purple background
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 6,
              }}
              onPress={() => handleMentionPress(part.username, part.userId)}
            >
              {part.content}
            </Text>
          );
        } else if (part.type === 'hashtag') {
          return (
            <Text
              key={index}
              style={{ 
                color: colors.gold, 
                fontWeight: '600',
                backgroundColor: 'rgba(196, 163, 90, 0.1)', // Light gold background
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 6,
              }}
              onPress={() => handleHashtagPress(part.tag)}
            >
              {part.content}
            </Text>
          );
        } else {
          return <Text key={index}>{part.content}</Text>;
        }
      })}
    </AppText>
  );
}
