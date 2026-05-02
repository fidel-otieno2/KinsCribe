import { useState, useRef, useCallback, useEffect } from 'react';
import api from '../api/axios';

/**
 * useMention Hook
 * 
 * Detects @ symbol in text input and manages mention state
 * Watches cursor position and provides search functionality
 * 
 * Usage:
 * const mention = useMention(text, cursorPosition);
 * 
 * Returns:
 * {
 *   isActive: boolean,
 *   query: string,
 *   results: array,
 *   loading: boolean,
 *   position: { start, end },
 *   selectMention: (user) => void,
 *   clearMention: () => void
 * }
 */
export default function useMention(text = '', cursorPosition = 0) {
  const [isActive, setIsActive] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mentionPosition, setMentionPosition] = useState(null);
  const [trackedMentions, setTrackedMentions] = useState([]);
  
  const searchTimeout = useRef(null);
  const abortController = useRef(null);

  // Extract @mention query from text at cursor position
  const extractMentionQuery = useCallback((inputText, position) => {
    if (!inputText || position < 0) return null;

    // Find the last @ before cursor
    const textBeforeCursor = inputText.substring(0, position);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex === -1) return null;
    
    // Check if there's a space or newline after the @
    const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
    if (textAfterAt.includes(' ') || textAfterAt.includes('\n')) return null;
    
    // Check if @ is at start or preceded by space/newline
    if (lastAtIndex > 0) {
      const charBeforeAt = inputText[lastAtIndex - 1];
      if (charBeforeAt !== ' ' && charBeforeAt !== '\n') return null;
    }
    
    return {
      query: textAfterAt,
      start: lastAtIndex,
      end: position,
    };
  }, []);

  // Search users with debounce
  const searchUsers = useCallback(async (searchQuery) => {
    // Cancel previous request
    if (abortController.current) {
      abortController.current.abort();
    }

    abortController.current = new AbortController();
    setLoading(true);

    try {
      const { data } = await api.get('/users/search', {
        params: { q: searchQuery, limit: 10 },
        signal: abortController.current.signal,
      });
      
      setResults(data.users || []);
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error searching users:', error);
        setResults([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Detect mention in text
  useEffect(() => {
    const mention = extractMentionQuery(text, cursorPosition);
    
    if (mention) {
      setIsActive(true);
      setQuery(mention.query);
      setMentionPosition({ start: mention.start, end: mention.end });
      
      // Debounce search
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
      
      searchTimeout.current = setTimeout(() => {
        searchUsers(mention.query);
      }, 300);
    } else {
      setIsActive(false);
      setQuery('');
      setResults([]);
      setMentionPosition(null);
    }

    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, [text, cursorPosition, extractMentionQuery, searchUsers]);

  // Select a mention
  const selectMention = useCallback((user, onTextChange) => {
    if (!mentionPosition || !onTextChange) return null;

    const beforeMention = text.substring(0, mentionPosition.start);
    const afterMention = text.substring(cursorPosition);
    const mentionText = `@${user.username}`;
    const newText = beforeMention + mentionText + ' ' + afterMention;
    
    // Track this mention
    const newMention = {
      id: user.id,
      username: user.username,
      name: user.name,
      avatar_url: user.avatar_url,
      start: mentionPosition.start,
      end: mentionPosition.start + mentionText.length,
    };
    
    setTrackedMentions(prev => [...prev, newMention]);
    
    // Clear mention state
    setIsActive(false);
    setQuery('');
    setResults([]);
    setMentionPosition(null);

    return {
      newText,
      newCursorPosition: mentionPosition.start + mentionText.length + 1,
      mention: newMention,
    };
  }, [text, cursorPosition, mentionPosition]);

  // Clear mention state
  const clearMention = useCallback(() => {
    setIsActive(false);
    setQuery('');
    setResults([]);
    setMentionPosition(null);
  }, []);

  // Get all tracked mentions
  const getMentions = useCallback(() => {
    return trackedMentions;
  }, [trackedMentions]);

  // Reset tracked mentions
  const resetMentions = useCallback(() => {
    setTrackedMentions([]);
  }, []);

  return {
    isActive,
    query,
    results,
    loading,
    position: mentionPosition,
    selectMention,
    clearMention,
    getMentions,
    resetMentions,
    trackedMentions,
  };
}
