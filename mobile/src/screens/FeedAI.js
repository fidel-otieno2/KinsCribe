import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import GlassCard from '../components/GlassCard';
import { colors } from '../theme';
import api from '../api/axios';

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    backgroundColor: 'linear-gradient(135deg, #7c3aed 0%, #3b82f6 50%, #10b981 100%)',
    backgroundClip: 'text',
    color: 'transparent',
  },
  subtitle: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 4,
  },
  messages: {
    flex: 1,
    paddingHorizontal: 16,
  },
  message: {
    marginBottom: 16,
    maxWidth: '80%',
  },
  userMessage: {
    alignSelf: 'flex-end',
  },
  aiMessage: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    padding: 14,
    borderRadius: 20,
    maxWidth: '90%',
  },
  userBubble: {
    backgroundColor: '#7c3aed',
    color: '#fff',
  },
  aiBubble: {
    backgroundColor: 'rgba(30,41,59,0.8)',
    color: colors.text,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(30,41,59,0.6)',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border2,
  },
  sendBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendGradient: {
    flex: 1,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typing: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(30,41,59,0.8)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 16,
  },
});

export default function FeedAI({ navigation }) {
  const [messages, setMessages] = useState([
    {
      id: '1',
      role: 'ai',
      text: "Hi! I'm KinsCribe AI 👋\n\nI can:\n• Summarize family stories\n• Generate story ideas\n• Answer family questions\n• Create timelines\n• Suggest family activities\n\nWhat family moment would you like to explore?",
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const flatListRef = useRef(null);

  const scrollToEnd = () => {
    flatListRef.current?.scrollToEnd({ animated: true });
  };

  const sendMessage = async () => {
    if (!input.trim() || isTyping) return;

    const userMsg = { id: Date.now().toString(), role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    scrollToEnd();

    try {
      const res = await api.post('/ai/chat', { message: input });
      const aiMsg = { 
        id: (Date.now() + 1).toString(), 
        role: 'ai', 
        text: res.data.response 
      };
      setTimeout(() => {
        setMessages(prev => [...prev, aiMsg]);
        setIsTyping(false);
        scrollToEnd();
      }, 1500);
    } catch (error) {
      const errorMsg = { 
        id: (Date.now() + 1).toString(), 
        role: 'ai', 
        text: "Sorry, I'm having trouble connecting. Try again?" 
      };
      setTimeout(() => {
        setMessages(prev => [...prev, errorMsg]);
        setIsTyping(false);
        scrollToEnd();
      }, 1000);
    }
  };

  const renderMessage = ({ item }) => (
    <View style={[s.message, item.role === 'user' ? s.userMessage : s.aiMessage]}>
      <View style={[s.messageBubble, item.role === 'user' ? s.userBubble : s.aiBubble]}>
        <Text style={{ lineHeight: 22, fontSize: 15 }}>
          {item.text.split('\n').map((line, i) => (
            <Text key={i}>
              {line}
              {'\n'}
            </Text>
          ))}
        </Text>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView 
      style={s.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={s.header}>
        <Text style={s.title}>Feed AI</Text>
        <Text style={s.subtitle}>Meta AI for your family memories ✨</Text>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        style={s.messages}
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={scrollToEnd}
      />

      {isTyping && (
        <View style={s.typing}>
          <Text style={{ color: colors.muted, fontStyle: 'italic' }}>
            KinsCribe AI is typing...
          </Text>
        </View>
      )}

      <View style={s.inputContainer}>
        <TextInput
          style={s.input}
          placeholder="Ask about family stories..."
          placeholderTextColor={colors.muted}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={1000}
        />
        <LinearGradient colors={['#7c3aed', '#3b82f6']} style={s.sendGradient}>
          <TouchableOpacity 
            style={s.sendBtn}
            onPress={sendMessage}
            disabled={!input.trim() || isTyping}
          >
            <Ionicons name="send" size={24} color="#fff" />
          </TouchableOpacity>
        </LinearGradient>
      </View>
    </KeyboardAvoidingView>
  );
}

