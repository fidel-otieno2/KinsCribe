import { useState, useRef } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius } from '../theme';
import api from '../api/axios';

const QUICK_PROMPTS = [
  { label: '💡 Story Idea', message: 'Give me a family story idea I can record today' },
  { label: '📅 Timeline', message: 'Help me create a family timeline structure' },
  { label: '🎙️ Interview', message: 'Give me 5 questions to ask an elderly family member' },
  { label: '✍️ Enhance', message: 'How can I make my family stories more engaging?' },
];

export default function FeedAI({ navigation }) {
  const [messages, setMessages] = useState([
    {
      id: '1', role: 'ai',
      text: "Hi! I'm KinsCribe AI 👋\n\nI can help you:\n• Generate story ideas\n• Enhance your writing\n• Create interview questions\n• Build family timelines\n• Summarize memories\n\nWhat would you like to explore?",
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const flatListRef = useRef(null);

  const sendMessage = async (text) => {
    const msg = text || input.trim();
    if (!msg || isTyping) return;
    setInput('');

    const userMsg = { id: Date.now().toString(), role: 'user', text: msg };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const { data } = await api.post('/ai/chat', { message: msg });
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'ai', text: data.response }]);
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(), role: 'ai',
        text: "Sorry, I'm having trouble connecting right now. Please try again in a moment."
      }]);
    } finally {
      setIsTyping(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const renderMessage = ({ item }) => (
    <View style={[s.msgWrap, item.role === 'user' ? s.userWrap : s.aiWrap]}>
      {item.role === 'ai' && (
        <LinearGradient colors={['#7c3aed', '#3b82f6']} style={s.aiAvatar}>
          <Ionicons name="sparkles" size={14} color="#fff" />
        </LinearGradient>
      )}
      <View style={[s.bubble, item.role === 'user' ? s.userBubble : s.aiBubble]}>
        <Text style={[s.bubbleText, item.role === 'user' ? s.userText : s.aiText]}>
          {item.text}
        </Text>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      <LinearGradient colors={['#0f172a', '#1e1040', '#0f172a']} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <LinearGradient colors={['#7c3aed', '#3b82f6']} style={s.headerIcon}>
            <Ionicons name="sparkles" size={16} color="#fff" />
          </LinearGradient>
          <View>
            <Text style={s.headerTitle}>KinsCribe AI</Text>
            <Text style={s.headerSub}>Family memory assistant</Text>
          </View>
        </View>
      </View>

      {/* Quick prompts */}
      <View style={s.quickRow}>
        {QUICK_PROMPTS.map(q => (
          <TouchableOpacity key={q.label} style={s.quickBtn} onPress={() => sendMessage(q.message)}>
            <Text style={s.quickText}>{q.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Messages */}
      <FlatList ref={flatListRef} data={messages} renderItem={renderMessage}
        keyExtractor={i => i.id} style={s.messages}
        contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })} />

      {/* Typing indicator */}
      {isTyping && (
        <View style={s.typingWrap}>
          <LinearGradient colors={['#7c3aed', '#3b82f6']} style={s.aiAvatar}>
            <Ionicons name="sparkles" size={14} color="#fff" />
          </LinearGradient>
          <View style={[s.bubble, s.aiBubble, { paddingVertical: 12 }]}>
            <ActivityIndicator size="small" color="#7c3aed" />
          </View>
        </View>
      )}

      {/* Input */}
      <View style={s.inputRow}>
        <TextInput style={s.input} placeholder="Ask about family stories..."
          placeholderTextColor={colors.muted} value={input}
          onChangeText={setInput} multiline maxLength={1000}
          onSubmitEditing={() => sendMessage()} />
        <TouchableOpacity onPress={() => sendMessage()} disabled={!input.trim() || isTyping} activeOpacity={0.8}>
          <LinearGradient colors={input.trim() ? ['#7c3aed', '#3b82f6'] : ['#374151', '#374151']} style={s.sendBtn}>
            <Ionicons name="send" size={20} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 12 },
  backBtn: { padding: 4 },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  headerSub: { fontSize: 11, color: colors.muted },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  quickBtn: { backgroundColor: 'rgba(124,58,237,0.15)', borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full },
  quickText: { color: '#a78bfa', fontSize: 12, fontWeight: '600' },
  messages: { flex: 1 },
  msgWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 12 },
  userWrap: { justifyContent: 'flex-end' },
  aiWrap: { justifyContent: 'flex-start' },
  aiAvatar: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  bubble: { maxWidth: '78%', padding: 12, borderRadius: 18 },
  userBubble: { backgroundColor: '#7c3aed', borderBottomRightRadius: 4 },
  aiBubble: { backgroundColor: 'rgba(30,41,59,0.9)', borderWidth: 1, borderColor: colors.border2, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 14, lineHeight: 21 },
  userText: { color: '#fff' },
  aiText: { color: colors.text },
  typingWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: 12, borderTopWidth: 1, borderTopColor: colors.border },
  input: { flex: 1, backgroundColor: 'rgba(30,41,59,0.8)', borderWidth: 1, borderColor: colors.border2, borderRadius: 22, paddingHorizontal: 18, paddingVertical: 12, fontSize: 14, color: colors.text, maxHeight: 100 },
  sendBtn: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
});
