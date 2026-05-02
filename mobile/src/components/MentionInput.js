import { useState, useRef } from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import useMention from '../hooks/useMention';
import MentionDropdown from './MentionDropdown';
import { colors } from '../theme';

/**
 * MentionInput Component
 * 
 * TextInput with built-in @mention support
 * Automatically shows dropdown when @ is typed
 * 
 * Usage:
 * <MentionInput
 *   value={text}
 *   onChangeText={setText}
 *   onMentionsChange={(mentions) => console.log(mentions)}
 *   placeholder="Write something..."
 *   multiline
 * />
 */
export default function MentionInput({
  value,
  onChangeText,
  onMentionsChange,
  placeholder,
  multiline = false,
  maxLength,
  style,
  inputStyle,
  autoFocus = false,
  ...props
}) {
  const [cursorPosition, setCursorPosition] = useState(0);
  const inputRef = useRef(null);
  
  const mention = useMention(value, cursorPosition);

  const handleTextChange = (text) => {
    onChangeText(text);
  };

  const handleSelectionChange = (event) => {
    setCursorPosition(event.nativeEvent.selection.start);
  };

  const handleSelectMention = (user) => {
    const result = mention.selectMention(user, onChangeText);
    
    if (result) {
      onChangeText(result.newText);
      
      // Update mentions list
      if (onMentionsChange) {
        const allMentions = [...mention.trackedMentions, result.mention];
        onMentionsChange(allMentions);
      }
      
      // Set cursor position after mention
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.setNativeProps({
            selection: { 
              start: result.newCursorPosition, 
              end: result.newCursorPosition 
            },
          });
        }
      }, 10);
    }
  };

  return (
    <View style={[styles.container, style]}>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleTextChange}
        onSelectionChange={handleSelectionChange}
        placeholder={placeholder}
        placeholderTextColor={colors.dim}
        multiline={multiline}
        maxLength={maxLength}
        autoFocus={autoFocus}
        style={[styles.input, inputStyle]}
        {...props}
      />
      
      <MentionDropdown
        visible={mention.isActive}
        results={mention.results}
        loading={mention.loading}
        query={mention.query}
        onSelect={handleSelectMention}
        onClose={mention.clearMention}
      />
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
});
