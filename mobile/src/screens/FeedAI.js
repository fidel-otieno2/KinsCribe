import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, TextInput, FlatList, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  Animated, ScrollView, Dimensions, Image,
} from 'react-native';
import AppText from '../components/AppText';
import MarkdownView from '../components/MarkdownView';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, radius } from '../theme';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

const { width, height } = Dimensions.get('window');
const HISTORY_KEY = '@kinscribe_ai_history';

const QUICK_PROMPTS = [
  { icon: '💡', label: 'Post Idea',  message: 'Give me a creative post idea for today' },
  { icon: '✍️', label: 'Caption',    message: 'Write me a catchy caption for a photo post' },
  { icon: '🔥', label: 'Hashtags',   message: 'Suggest trending hashtags for a lifestyle post' },
  { icon: '🎙️', label: 'Interview',  message: 'Give me 5 questions to ask an elderly family member' },
  { icon: '📅', label: 'Timeline',   message: 'Help me create a family timeline structure' },
  { icon: '🌍', label: 'Story Idea', message: 'Give me a family story idea I can record today' },
];

const WELCOME = "Hi! I'm KinsCribe AI ✨\n\nI can help you with anything:\n• Post & caption ideas\n• Hashtag suggestions\n• Family stories & timelines\n• General knowledge\n• Creative writing\n• And much more...\n\nWhat would you like to explore?";

const newSession = () => ({
  id: `sess_${Date.now()}`,
  title: 'New Chat',
  messages: [{ id: `welcome_${Date.now()}`, role: 'ai', text: WELCOME }],
  createdAt: Date.now(),
});

// ── Typing dots ───────────────────────────────────────────────
function TypingDots() {
  const d1 = useRef(new Animated.Value(0)).current;
  const d2 = useRef(new Animated.Value(0)).current;
  const d3 = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    [d1, d2, d3].forEach((d, i) => {
      Animated.loop(Animated.sequence([
        Animated.delay(i * 150),
        Animated.timing(d, { toValue: -6, duration: 300, useNativeDriver: true }),
        Animated.timing(d, { toValue: 0,  duration: 300, useNativeDriver: true }),
        Animated.delay(600),
      ])).start();
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

// ── Glow orb ─────────────────────────────────────────────────
function GlowOrb() {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.3, duration: 1500, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1,   duration: 1500, useNativeDriver: true }),
    ])).start();
  }, []);
  return <Animated.View style={[s.glowOrb, { transform: [{ scale: pulse }] }]} />;
}

// ── Message bubble ────────────────────────────────────────────
function MessageBubble({ item, user }) {
  const fade  = useRef(new Animated.Value(0)).current;
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
        {!isUser && <AppText style={s.aiBubbleLabel}>KinsCribe AI</AppText>}
        {isUser ? (
          <AppText style={[s.bubbleText, s.userText]}>{item.text}</AppText>
        ) : (
          <MarkdownView content={item.text} />
        )}
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

// ── History sidebar ───────────────────────────────────────────
function HistorySidebar({ visible, sessions, currentId, onSelect, onNew, onDelete, onClose }) {
  const slideX = useRef(new Animated.Value(-width * 0.75)).current;
  useEffect(() => {
    Animated.spring(slideX, { toValue: visible ? 0 : -width * 0.75, useNativeDriver: true, tension: 80, friction: 12 }).start();
  }, [visible]);

  const formatDate = (ts) => {
    const d = new Date(ts);
    const now = new Date();
    const diff = (now - d) / 86400000;
    if (diff < 1) return 'Today';
    if (diff < 2) return 'Yesterday';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <>
      {visible && (
        <TouchableOpacity style={s.sidebarOverlay} activeOpacity={1} onPress={onClose} />
      )}
      <Animated.View style={[s.sidebar, { transform: [{ translateX: slideX }] }]}>
        <LinearGradient colors={['#0a0520', '#020817']} style={StyleSheet.absoluteFill} />
        <View style={s.sidebarHeader}>
          <LinearGradient colors={['#7c3aed', '#3b82f6']} style={s.sidebarLogo}>
            <Ionicons name="sparkles" size={16} color="#fff" />
          </LinearGradient>
          <AppText style={s.sidebarTitle}>KinsCribe AI</AppText>
          <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
            <Ionicons name="close" size={20} color="rgba(255,255,255,0.5)" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={s.newChatBtn} onPress={() => { onNew(); onClose(); }}>
          <LinearGradient colors={['rgba(124,58,237,0.3)', 'rgba(59,130,246,0.2)']} style={s.newChatBtnGrad}>
            <Ionicons name="add" size={18} color="#a78bfa" />
            <AppText style={s.newChatBtnText}>New Chat</AppText>
          </LinearGradient>
        </TouchableOpacity>

        <AppText style={s.sidebarSectionLabel}>RECENT CHATS</AppText>

        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
          {sessions.length === 0 && (
            <AppText style={{ color: 'rgba(148,163,184,0.4)', fontSize: 13, textAlign: 'center', marginTop: 20 }}>No history yet</AppText>
          )}
          {sessions.map(sess => (
            <TouchableOpacity
              key={sess.id}
              style={[s.historyItem, sess.id === currentId && s.historyItemActive]}
              onPress={() => { onSelect(sess.id); onClose(); }}
              activeOpacity={0.75}
            >
              <View style={{ flex: 1 }}>
                <AppText style={[s.historyTitle, sess.id === currentId && { color: '#a78bfa' }]} numberOfLines={1}>
                  {sess.title}
                </AppText>
                <AppText style={s.historyDate}>{formatDate(sess.createdAt)}</AppText>
              </View>
              <TouchableOpacity
                onPress={() => onDelete(sess.id)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={{ padding: 4 }}
              >
                <Ionicons name="trash-outline" size={14} color="rgba(248,113,113,0.6)" />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Animated.View>
    </>
  );
}

// ── Main screen ───────────────────────────────────────────────
export default function FeedAI({ navigation }) {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const flatListRef = useRef(null);
  const headerFade = useRef(new Animated.Value(0)).current;

  const currentSession = sessions.find(s => s.id === currentSessionId);
  const messages = currentSession?.messages || [];

  // Load history on mount
  useEffect(() => {
    Animated.timing(headerFade, { toValue: 1, duration: 700, useNativeDriver: true }).start();
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const raw = await AsyncStorage.getItem(HISTORY_KEY);
      const saved = raw ? JSON.parse(raw) : [];
      // Validate: only keep sessions where all message ids are unique and prefixed
      const valid = saved.filter(sess =>
        sess.id?.startsWith('sess_') &&
        sess.messages?.every(m => m.id && (m.id.startsWith('user_') || m.id.startsWith('ai_') || m.id.startsWith('welcome_')))
      );
      if (valid.length > 0) {
        setSessions(valid);
        setCurrentSessionId(valid[0].id);
      } else {
        // Wipe old incompatible data
        await AsyncStorage.removeItem(HISTORY_KEY);
        const fresh = newSession();
        setSessions([fresh]);
        setCurrentSessionId(fresh.id);
      }
    } catch {
      const fresh = newSession();
      setSessions([fresh]);
      setCurrentSessionId(fresh.id);
    }
  };

  const saveHistory = async (updatedSessions) => {
    try {
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updatedSessions));
    } catch {}
  };

  const updateCurrentSession = (updater) => {
    setSessions(prev => {
      const updated = prev.map(s => s.id === currentSessionId ? updater(s) : s);
      saveHistory(updated);
      return updated;
    });
  };

  const startNewChat = () => {
    const fresh = newSession();
    setSessions(prev => {
      const updated = [fresh, ...prev];
      saveHistory(updated);
      return updated;
    });
    setCurrentSessionId(fresh.id);
    setInput('');
  };

  const selectSession = (id) => {
    setCurrentSessionId(id);
    setInput('');
  };

  const deleteSession = (id) => {
    setSessions(prev => {
      const updated = prev.filter(s => s.id !== id);
      saveHistory(updated);
      if (id === currentSessionId) {
        if (updated.length > 0) {
          setCurrentSessionId(updated[0].id);
        } else {
          const fresh = newSession();
          saveHistory([fresh]);
          setSessions([fresh]);
          setCurrentSessionId(fresh.id);
          return [fresh];
        }
      }
      return updated;
    });
  };

  const sendMessage = async (text) => {
    const msg = text || input.trim();
    if (!msg || isTyping) return;
    setInput('');
    setIsTyping(true);

    const userMsg = { id: `user_${Date.now()}`, role: 'user', text: msg };
    const aiMsgId = `ai_${Date.now() + 1}`;

    // Capture current messages snapshot BEFORE any state update
    const prevMessages = currentSession?.messages || [];
    const isFirstUserMsg = prevMessages.filter(m => m.role === 'user').length === 0;
    const sessionTitle = isFirstUserMsg ? msg.slice(0, 40) : (currentSession?.title || 'New Chat');
    const withUser = [...prevMessages, userMsg];

    // Single update: add user message
    setSessions(prev => {
      const next = prev.map(s => s.id === currentSessionId ? { ...s, title: sessionTitle, messages: withUser } : s);
      saveHistory(next);
      return next;
    });

    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const history = prevMessages
        .filter(m => m.role !== 'ai' || prevMessages.indexOf(m) > 0)
        .filter((_, i) => i > 0)
        .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }));
      const { data } = await api.post('/ai/chat', { message: msg, history });
      const aiMsg = { id: aiMsgId, role: 'ai', text: data.response };
      setSessions(prev => {
        const next = prev.map(s => s.id === currentSessionId ? { ...s, messages: [...withUser, aiMsg] } : s);
        saveHistory(next);
        return next;
      });
    } catch {
      const errMsg = { id: aiMsgId, role: 'ai', text: "Sorry, I'm having trouble connecting. Please try again." };
      setSessions(prev => {
        const next = prev.map(s => s.id === currentSessionId ? { ...s, messages: [...withUser, errMsg] } : s);
        saveHistory(next);
        return next;
      });
    } finally {
      setIsTyping(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  return (
    <View style={s.root}>
      <HistorySidebar
        visible={showSidebar}
        sessions={sessions}
        currentId={currentSessionId}
        onSelect={selectSession}
        onNew={startNewChat}
        onDelete={deleteSession}
        onClose={() => setShowSidebar(false)}
      />

      <KeyboardAvoidingView
        style={s.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Background */}
        <LinearGradient colors={['#020817', '#0a0520', '#020817']} style={StyleSheet.absoluteFill} />
        <View style={[s.blob, { top: -60,   left: -60,  backgroundColor: 'rgba(124,58,237,0.18)' }]} />
        <View style={[s.blob, { top: 200,   right: -80, backgroundColor: 'rgba(59,130,246,0.12)', width: 220, height: 220 }]} />
        <View style={[s.blob, { bottom: 100, left: -40, backgroundColor: 'rgba(6,182,212,0.1)',  width: 180, height: 180 }]} />

        {/* Header */}
        <Animated.View style={[s.header, { opacity: headerFade }]}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          <TouchableOpacity onPress={() => setShowSidebar(true)} style={s.headerBtn}>
            <Ionicons name="menu" size={22} color="#fff" />
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
          <TouchableOpacity style={s.headerBtn} onPress={startNewChat}>
            <Ionicons name="create-outline" size={22} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </Animated.View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={i => String(i.id)}
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

        {/* Input */}
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
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#020817' },
  container: { flex: 1 },
  blob: { position: 'absolute', width: 260, height: 260, borderRadius: 130 },

  // Sidebar
  sidebarOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10 },
  sidebar: {
    position: 'absolute', top: 0, left: 0, bottom: 0,
    width: width * 0.75, zIndex: 20,
    borderRightWidth: 1, borderRightColor: 'rgba(124,58,237,0.2)',
    overflow: 'hidden',
  },
  sidebarHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 56, paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(124,58,237,0.15)' },
  sidebarLogo: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sidebarTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: '#fff' },
  newChatBtn: { margin: 12, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)' },
  newChatBtnGrad: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  newChatBtnText: { color: '#a78bfa', fontWeight: '700', fontSize: 14 },
  sidebarSectionLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(148,163,184,0.5)', letterSpacing: 1, paddingHorizontal: 16, marginBottom: 6, textTransform: 'uppercase' },
  historyItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, marginHorizontal: 8, marginBottom: 2 },
  historyItemActive: { backgroundColor: 'rgba(124,58,237,0.15)', borderWidth: 1, borderColor: 'rgba(124,58,237,0.25)' },
  historyTitle: { fontSize: 13, fontWeight: '600', color: 'rgba(226,232,240,0.85)' },
  historyDate: { fontSize: 10, color: 'rgba(148,163,184,0.5)', marginTop: 2 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', paddingTop: 54,
    paddingHorizontal: 12, paddingBottom: 14, gap: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(124,58,237,0.2)', overflow: 'hidden',
  },
  headerBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerOrbWrap: { position: 'relative', width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerOrb: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  headerOrbGlow: { position: 'absolute', width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(124,58,237,0.4)', transform: [{ scale: 1.5 }] },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  onlineBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' },
  onlineText: { fontSize: 10, color: 'rgba(148,163,184,0.8)', fontWeight: '500' },

  // Messages
  messages: { flex: 1 },
  msgWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 16 },
  userWrap: { justifyContent: 'flex-end' },
  aiWrap: { justifyContent: 'flex-start' },
  aiAvatarWrap: { position: 'relative', width: 32, height: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  glowOrb: { position: 'absolute', width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(124,58,237,0.3)' },
  aiAvatar: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  userAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(124,58,237,0.6)', alignItems: 'center', justifyContent: 'center', marginBottom: 2, overflow: 'hidden' },
  bubble: { maxWidth: width * 0.85, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10 },
  userBubble: { backgroundColor: '#7c3aed', borderBottomRightRadius: 4, shadowColor: '#7c3aed', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  aiBubble: { backgroundColor: 'rgba(15,23,42,0.95)', borderWidth: 1, borderColor: 'rgba(124,58,237,0.25)', borderBottomLeftRadius: 4 },
  aiBubbleLabel: { fontSize: 10, fontWeight: '700', color: '#a78bfa', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
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
