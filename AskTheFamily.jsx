import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { API_URL } from '../config';

const AskTheFamily = ({ navigation }) => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const scrollViewRef = useRef(null);

  useEffect(() => {
    // Add welcome message
    setMessages([
      {
        id: 'welcome',
        type: 'ai',
        text: "Hi! I'm your family historian. Ask me anything about your family stories, and I'll search through all your memories to find the answer. Try asking 'Where did grandma grow up?' or 'Tell me about family vacations'.",
        timestamp: new Date(),
      },
    ]);

    // Fetch suggested questions
    fetchSuggestions();
  }, []);

  const fetchSuggestions = async () => {
    try {
      const response = await axios.get(`${API_URL}/ai/ask-family/suggestions`);
      setSuggestions(response.data.suggestions);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    }
  };

  const handleSend = async (question = inputText) => {
    if (!question.trim()) return;

    const userMessage = {
      id: Date.now().toString(),
      type: 'user',
      text: question,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setLoading(true);

    try {
      const response = await axios.post(`${API_URL}/ai/ask-family`, {
        question: question,
      });

      const aiMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        text: response.data.answer,
        quotes: response.data.quotes,
        confidence: response.data.confidence,
        relevantStories: response.data.relevant_stories,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error asking family:', error);
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        text: "I'm sorry, I couldn't process that question. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const renderMessage = (message) => {
    if (message.type === 'user') {
      return (
        <View key={message.id} style={styles.userMessageContainer}>
          <View style={styles.userMessage}>
            <Text style={styles.userMessageText}>{message.text}</Text>
          </View>
        </View>
      );
    }

    return (
      <View key={message.id} style={styles.aiMessageContainer}>
        <View style={styles.aiAvatar}>
          <Ionicons name="sparkles" size={20} color="#fff" />
        </View>
        <View style={styles.aiMessageContent}>
          <View style={styles.aiMessage}>
            <Text style={styles.aiMessageText}>{message.text}</Text>

            {/* Quotes */}
            {message.quotes && message.quotes.length > 0 && (
              <View style={styles.quotes}>
                {message.quotes.map((quote, index) => (
                  <View key={index} style={styles.quote}>
                    <Ionicons name="quote" size={16} color="#7c3aed" />
                    <Text style={styles.quoteText}>{quote}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Confidence badge */}
            {message.confidence && (
              <View style={styles.confidenceBadge}>
                <Ionicons
                  name={
                    message.confidence === 'high'
                      ? 'checkmark-circle'
                      : message.confidence === 'medium'
                      ? 'information-circle'
                      : 'help-circle'
                  }
                  size={14}
                  color={
                    message.confidence === 'high'
                      ? '#10b981'
                      : message.confidence === 'medium'
                      ? '#f59e0b'
                      : '#999'
                  }
                />
                <Text style={styles.confidenceText}>
                  {message.confidence} confidence
                </Text>
              </View>
            )}
          </View>

          {/* Relevant stories */}
          {message.relevantStories && message.relevantStories.length > 0 && (
            <View style={styles.relevantStories}>
              <Text style={styles.relevantStoriesTitle}>Related Stories:</Text>
              {message.relevantStories.map((story) => (
                <TouchableOpacity
                  key={story.id}
                  style={styles.storyCard}
                  onPress={() =>
                    navigation.navigate('StoryDetail', { storyId: story.id })
                  }
                >
                  {story.media_url && (
                    <Image
                      source={{ uri: story.media_url }}
                      style={styles.storyThumbnail}
                    />
                  )}
                  <View style={styles.storyInfo}>
                    <Text style={styles.storyTitle} numberOfLines={1}>
                      {story.title}
                    </Text>
                    <Text style={styles.storyMeta}>
                      {story.date && new Date(story.date).toLocaleDateString()}
                      {story.author_name && ` • by ${story.author_name}`}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#ccc" />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Ask the Family</Text>
          <Text style={styles.headerSubtitle}>AI Family Historian</Text>
        </View>
        <TouchableOpacity onPress={() => setMessages([messages[0]])}>
          <Ionicons name="refresh" size={24} color="#7c3aed" />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={() =>
          scrollViewRef.current?.scrollToEnd({ animated: true })
        }
      >
        {messages.map(renderMessage)}

        {loading && (
          <View style={styles.loadingContainer}>
            <View style={styles.aiAvatar}>
              <Ionicons name="sparkles" size={20} color="#fff" />
            </View>
            <View style={styles.loadingBubble}>
              <ActivityIndicator size="small" color="#7c3aed" />
              <Text style={styles.loadingText}>Searching stories...</Text>
            </View>
          </View>
        )}

        {/* Suggestions */}
        {messages.length === 1 && suggestions.length > 0 && (
          <View style={styles.suggestionsContainer}>
            <Text style={styles.suggestionsTitle}>Try asking:</Text>
            {suggestions.map((suggestion, index) => (
              <TouchableOpacity
                key={index}
                style={styles.suggestionChip}
                onPress={() => handleSend(suggestion)}
              >
                <Text style={styles.suggestionText}>{suggestion}</Text>
                <Ionicons name="arrow-forward" size={16} color="#7c3aed" />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Ask about your family..."
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
          onPress={() => handleSend()}
          disabled={!inputText.trim() || loading}
        >
          <Ionicons name="send" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F0E8',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#7c3aed',
    marginTop: 2,
  },
  
  // Messages
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
  },
  userMessageContainer: {
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  userMessage: {
    backgroundColor: '#7c3aed',
    borderRadius: 20,
    borderBottomRightRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxWidth: '80%',
  },
  userMessageText: {
    fontSize: 15,
    color: '#fff',
    lineHeight: 20,
  },
  aiMessageContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  aiAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#7c3aed',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  aiMessageContent: {
    flex: 1,
  },
  aiMessage: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxWidth: '90%',
  },
  aiMessageText: {
    fontSize: 15,
    color: '#1a1a1a',
    lineHeight: 22,
  },
  quotes: {
    marginTop: 12,
    gap: 8,
  },
  quote: {
    flexDirection: 'row',
    gap: 8,
    paddingLeft: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#7c3aed',
  },
  quoteText: {
    flex: 1,
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  confidenceText: {
    fontSize: 11,
    color: '#999',
  },
  relevantStories: {
    marginTop: 12,
  },
  relevantStoriesTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  storyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  storyThumbnail: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  storyInfo: {
    flex: 1,
  },
  storyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  storyMeta: {
    fontSize: 11,
    color: '#999',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
  },
  
  // Suggestions
  suggestionsContainer: {
    marginTop: 16,
  },
  suggestionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#7c3aed20',
  },
  suggestionText: {
    flex: 1,
    fontSize: 14,
    color: '#1a1a1a',
  },
  
  // Input
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 12,
  },
  input: {
    flex: 1,
    backgroundColor: '#F5F0E8',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1a1a1a',
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#7c3aed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});

export default AskTheFamily;
