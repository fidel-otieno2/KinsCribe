import { useState, useRef, useEffect } from 'react';
import {
  View, TextInput, FlatList, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  Animated, ScrollView, Dimensions, Image,
} from 'react-native';
import AppText from '../components/AppText';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { colors, radius } from '../theme';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

const { width } = Dimensions.get('window');

const QUICK_PROMPTS = [
  { icon: '💡', label: 'Post Idea',   message: 'Give me a creative post idea for today' },
  { icon: '✍️', label: 'Caption',     message: 'Write me a catchy caption for a photo post' },
  { icon: '🔥', label: 'Hashtags',    message: 'Suggest trending hashtags for a lifestyle post' },
  { icon: '🎙️', label: 'Interview',   message: 'Give me 5 questions to ask an elderly family member' },
  { icon: '📅', label: 'Timeline',    message: 'Help me create a family timeline structure' },
  { icon: '🌍', label: 'Story Idea',  message: 'Give me a family story idea I can record today' },
];

const WELCOME = "Hi! I'm KinsCribe AI ✨\n\nI can help you with anything:\n• Post & caption ideas\n• Hashtag suggestions\n• Family stories & timelines\n• General knowledge\n• Creative writing\n• And much more...\n\nWhat would you like to explore?";

// ── Animated typing dots ──────────────────────────────────────
function TypingDots() {
  const d1 = useRef(new Animated.Value(0)).current;
  const d2 = useRef(new Animated.Value(0)).current;
  const d3 = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    [d1, d2, d3].forEach((d, i) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(d, { toValue: -6, duration: 300, useNativeDriver: true }),
          Animated.timing(d, { toValue: 0,  duration: 300, useNativeDriver: true }),
          Animated.delay(600),
        ])
      ).start();
    });
  }, []);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4 }}>
      {[d1, d2, d3].map((d, i) => (
        <Animated.View key={i} style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#a78bfa', transform: [{ translateY: d }] }} />
      ))}
    </View>
  );
}

// ── Pulsing glow orb behind AI avatar ────────────────────────
function GlowOrb() {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.3, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,   duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return <Animated.View style={[s.glowOrb, { transform: [{ scale: pulse }] }]} />;
}

// ── Single message bubble (proper component so hooks are valid) ──
function MessageBubble({ item, user }) {
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(10)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade,  { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  const isUser = item.role === 'user';
  return (
    <Animated.View style={[s.msgWrap, isUser ? s.userWrap : s.aiWrap, { opacity: fade, transform: [{ translateY: slide }] }]}>
      {!isUser && (
        <View style={s.aiAvatarWrap}>
          <GlowOrb />
          <LinearGradient colors={['#7c3aed', '#3b82f6', '#06b6d4']} style={s.aiAvatar}>
            <Ionicons name="sparkles" size={14} color="#fff" />
          </LinearGradient>
        </View>
      )}
      <View style={[s.bubble, isUser ? s.userBubble : s.aiBubble]}>
        {!isUser && (
          <View style={s.aiBubbleHeader}>
            <AppText style={s.aiBubbleLabel}>KinsCribe AI</AppText>
          </View>
        )}
        <AppText style={[s.bubbleText, isUser ? s.userText : s.aiText]}>{item.text}</AppText>
      </View>
      {isUser && (
        <View style={s.userAvatar}>
          {user?.avatar_url
            ? <Image source={{ uri: user.avatar_url }} style={{ width: 32, height: 32, borderRadius: 16 }} />
            : <AppText style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{user?.name?.[0]?.toUpperCase() || 'U'}</AppText>}
        </View>
      )}
    </Animated.View>
  );
}

// ── Main screen ───────────────────────────────────────────────
export default function FeedAI({ navigation }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([{ id: '1', role: 'ai', text: WELCOME }]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const flatListRef = useRef(null);
  const headerFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerFade, { toValue: 1, duration: 700, useNativeDriver: true }).start();
  }, []);

  const sendMessage = async (text) => {
    const msg = text || input.trim();
    if (!msg || isTyping) return;
    setInput('');
    const userMsg = { id: Date.now().toString(), role: 'user', text: msg };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    try {
      const history = messages
        .filter(m => m.id !== '1')
        .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }));
      const { data } = await api.post('/ai/chat', { message: msg, history });
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'ai', text: data.response }]);
    } catch {
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'ai', text: "Sorry, I'm having trouble connecting. Please try again." }]);
    } finally {
      setIsTyping(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const resetChat = () => setMessages([{ id: '1', role: 'ai', text: WELCOME }]);

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Deep space background */}
      <LinearGradient colors={['#020817', '#0a0520', '#020817']} style={StyleSheet.absoluteFill} />
      <View style={[s.blob, { top: -60,  left: -60,  backgroundColor: 'rgba(124,58,237,0.18)' }]} />
      <View style={[s.blob, { top: 200,  right: -80, backgroundColor: 'rgba(59,130,246,0.12)', width: 220, height: 220 }]} />
      <View style={[s.blob, { bottom: 100, left: -40, backgroundColor: 'rgba(6,182,212,0.1)',  width: 180, height: 180 }]} />

      {/* Header */}
      <Animated.View style={[s.header, { opacity: headerFade }]}>
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <View style={s.headerOrbWrap}>
            <View style={s.headerOrbGlow} />
            <LinearGradient colors={['#7c3aed', '#3b82f6', '#06b6d4']} style={s.headerOrb}>
              <Ionicons name="sparkles" size={18} color="#fff" />
            </LinearGradient>
          </View>
          <View>
            <AppText style={s.headerTitle}>KinsCribe AI</AppText>
            <View style={s.onlineBadge}>
              <View style={s.onlineDot} />
              <AppText style={s.onlineText}>Online · Llama 3.3 70B</AppText>
            </View>
          </View>
        </View>
        <TouchableOpacity style={s.clearBtn} onPress={resetChat}>
          <Ionicons name="refresh-outline" size={20} color="rgba(255,255,255,0.5)" />
        </TouchableOpacity>
      </Animated.View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={i => i.id}
        renderItem={({ item }) => <MessageBubble item={item} user={user} />}
        style={s.messages}
        contentContainerStyle={{ padding: 16, paddingBottom: 12 }}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      {/* Typing indicator */}
      {isTyping && (
        <View style={s.typingWrap}>
          <View style={s.aiAvatarWrap}>
            <GlowOrb />
            <LinearGradient colors={['#7c3aed', '#3b82f6', '#06b6d4']} style={s.aiAvatar}>
              <Ionicons name="sparkles" size={14} color="#fff" />
            </LinearGradient>
          </View>
          <View style={[s.bubble, s.aiBubble]}>
            <TypingDots />
          </View>
        </View>
      )}

      {/* Quick prompts */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.quickRow} style={s.quickScroll}>
        {QUICK_PROMPTS.map(q => (
          <TouchableOpacity key={q.label} style={s.quickBtn} onPress={() => sendMessage(q.message)} activeOpacity={0.75}>
            <LinearGradient colors={['rgba(124,58,237,0.25)', 'rgba(59,130,246,0.15)']} style={s.quickBtnGrad}>
              <AppText style={s.quickIcon}>{q.icon}</AppText>
              <AppText style={s.quickText}>{q.label}</AppText>
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Input bar */}
      <BlurView intensity={30} tint="dark" style={s.inputBar}>
        <View style={s.inputWrap}>
          <TextInput
            style={s.input}
            placeholder="Ask me anything..."
            placeholderTextColor="rgba(148,163,184,0.5)"
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={2000}
          />
          <TouchableOpacity onPress={() => sendMessage()} disabled={!input.trim() || isTyping} activeOpacity={0.8}>
            <LinearGradient
              colors={input.trim() && !isTyping ? ['#7c3aed', '#3b82f6'] : ['rgba(30,41,59,0.8)', 'rgba(30,41,59,0.8)']}
              style={s.sendBtn}
            >
              <Ionicons name={isTyping ? 'ellipsis-horizontal' : 'arrow-up'} size={18} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
        <AppText style={s.inputHint}>KinsCribe AI can make mistakes. Verify important info.</AppText>
      </BlurView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020817' },
  blob: { position: 'absolute', width: 260, height: 260, borderRadius: 130 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', paddingTop: 54,
    paddingHorizontal: 16, paddingBottom: 14, gap: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(124,58,237,0.2)', overflow: 'hidden',
  },
  backBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerOrbWrap: { position: 'relative', width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerOrb: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  headerOrbGlow: { position: 'absolute', width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(124,58,237,0.4)', transform: [{ scale: 1.5 }] },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  onlineBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' },
  onlineText: { fontSize: 10, color: 'rgba(148,163,184,0.8)', fontWeight: '500' },
  clearBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center' },

  // Messages
  messages: { flex: 1 },
  msgWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 16 },
  userWrap: { justifyContent: 'flex-end' },
  aiWrap: { justifyContent: 'flex-start' },

  // Avatars
  aiAvatarWrap: { position: 'relative', width: 32, height: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  glowOrb: { position: 'absolute', width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(124,58,237,0.3)' },
  aiAvatar: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  userAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(124,58,237,0.6)', alignItems: 'center', justifyContent: 'center', marginBottom: 2 },

  // Bubbles
  bubble: { maxWidth: width * 0.72, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10 },
  userBubble: { backgroundColor: '#7c3aed', borderBottomRightRadius: 4, shadowColor: '#7c3aed', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  aiBubble: { backgroundColor: 'rgba(15,23,42,0.95)', borderWidth: 1, borderColor: 'rgba(124,58,237,0.25)', borderBottomLeftRadius: 4 },
  aiBubbleHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  aiBubbleLabel: { fontSize: 10, fontWeight: '700', color: '#a78bfa', textTransform: 'uppercase', letterSpacing: 0.5 },
  bubbleText: { fontSize: 14, lineHeight: 22 },
  userText: { color: '#fff', fontWeight: '500' },
  aiText: { color: 'rgba(226,232,240,0.95)' },

  // Typing
  typingWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 16, marginBottom: 8 },

  // Quick prompts
  quickScroll: { maxHeight: 56 },
  quickRow: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  quickBtn: { borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)' },
  quickBtnGrad: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8 },
  quickIcon: { fontSize: 13 },
  quickText: { color: '#c4b5fd', fontSize: 12, fontWeight: '600' },

  // Input
  inputBar: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 28 : 12, borderTopWidth: 1, borderTopColor: 'rgba(124,58,237,0.15)', overflow: 'hidden' },
  inputWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, backgroundColor: 'rgba(15,23,42,0.8)', borderWidth: 1.5, borderColor: 'rgba(124,58,237,0.35)', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 8 },
  input: { flex: 1, fontSize: 15, color: '#e2e8f0', maxHeight: 120, paddingVertical: 4 },
  sendBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  inputHint: { fontSize: 10, color: 'rgba(100,116,139,0.6)', textAlign: 'center', marginTop: 6 },
});
