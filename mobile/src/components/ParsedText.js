import { Text, TouchableOpacity } from 'react-native';
import AppText from '../components/AppText';
import { colors } from '../theme';
import { useNavigation } from '@react-navigation/native';

/**
 * ParsedText - Renders text with clickable @mentions and #hashtags
 * 
 * Usage:
 * <ParsedText style={styles.text}>
 *   Hey @john check out #family photos!
 * </ParsedText>
 */
export default function ParsedText({ children, style, onMentionPress, onHashtagPress }) {
  const navigation = useNavigation();

  if (!children || typeof children !== 'string') {
    return <AppText style={style}>{children}</AppText>;
  }

  // Regex to match @mentions and #hashtags
  const mentionRegex = /@(\w+)/g;
  const hashtagRegex = /#(\w+)/g;
  
  // Find all matches
  const parts = [];
  let lastIndex = 0;
  
  // Combined regex to find both mentions and hashtags
  const combinedRegex = /(@\w+)|(#\w+)/g;
  let match;
  
  while ((match = combinedRegex.exec(children)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: children.substring(lastIndex, match.index),
      });
    }
    
    // Add the match
    if (match[0].startsWith('@')) {
      parts.push({
        type: 'mention',
        content: match[0],
        username: match[0].substring(1),
      });
    } else if (match[0].startsWith('#')) {
      parts.push({
        type: 'hashtag',
        content: match[0],
        tag: match[0].substring(1),
      });
    }
    
    lastIndex = match.index + match[0].length;
  }
  
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

  const handleMentionPress = (username) => {
    if (onMentionPress) {
      onMentionPress(username);
    } else {
      // Default: navigate to user profile
      navigation.navigate('UserProfile', { username });
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
              style={{ color: colors.primary, fontWeight: '600' }}
              onPress={() => handleMentionPress(part.username)}
            >
              {part.content}
            </Text>
          );
        } else if (part.type === 'hashtag') {
          return (
            <Text
              key={index}
              style={{ color: colors.gold, fontWeight: '600' }}
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
