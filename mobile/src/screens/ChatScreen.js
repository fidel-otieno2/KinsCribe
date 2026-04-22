import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View, FlatList, TouchableOpacity, StyleSheet,
  TextInput, KeyboardAvoidingView, Platform, Image,
  ActivityIndicator, StatusBar, Alert, Animated, ScrollView, Clipboard, Modal, Pressable,
} from "react-native";
import AppText from '../components/AppText';
import MessageBubble from '../components/MessageBubble';
import GifPicker from '../components/GifPicker';
import StickerPicker from '../components/StickerPicker';
import AIAssistant from '../components/AIAssistant';
import { useTranslation } from '../i18n';
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { Audio } from "expo-av";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { colors, radius } from "../theme";

function timeStr(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
}


function Avatar({ uri, name, size = 32 }) {
  return uri ? (
    <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
  ) : (
    <View style={[cs.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <AppText style={{ color: "#fff", fontWeight: "700", fontSize: size * 0.38 }}>{name?.[0]?.toUpperCase() || "?"}</AppText>
    </View>
  );
}

const REACTIONS = ["❤️", "😍", "😂", "😮", "😢", "🔥", "👍"];

// Render text with @mentions highlighted
function MentionText({ text, isMe, style }) {
  if (!text) return null;
  const parts = text.split(/(@\w+)/g);
  return (
    <AppText style={style}>
      {parts.map((part, i) =>
        /^@\w+/.test(part)
          ? <AppText key={i} style={[style, { color: isMe ? '#c4b5fd' : '#7c3aed', fontWeight: '700' }]}>{part}</AppText>
          : part
      )}
    </AppText>
  );
}

// ── Floating heart burst on double-tap ─────────────────────────────────
function HeartBurst({ x, y }) {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: -80, duration: 800, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(400),
        Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  return (
    <Animated.Text
      style={[
        {
          position: 'absolute',
          left: x - 24,
          top: y - 24,
          fontSize: 48,
          zIndex: 9999,
          pointerEvents: 'none',
        },
        { transform: [{ scale }, { translateY }], opacity },
      ]}
    >
      ❤️
    </Animated.Text>
  );
}

export default function ChatScreen({ route, navigation }) {
  const { t } = useTranslation();
  const { conversationId: initialConvId, title, avatar, type, otherUserId } = route.params;
  const { user } = useAuth();
  const [convId, setConvId] = useState(initialConvId);
  const [messages, setMessages] = useState([]);
  const [pinnedMsg, setPinnedMsg] = useState(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [msgActionSheet, setMsgActionSheet] = useState(null); // { item, isMe }
  const [disappearing, setDisappearing] = useState(false);
  const [typingNames, setTypingNames] = useState([]);
  const [otherStatus, setOtherStatus] = useState(null);
  const [smartReplies, setSmartReplies] = useState([]);
  const [forwardMsg, setForwardMsg] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showMuteOptions, setMuteOptions] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['Option 1', 'Option 2']);
  const [showPollModal, setShowPollModal] = useState(false);
  const voiceSlideAnim = useRef(new Animated.Value(0)).current;
  // Thread view
  const [voiceSlideOffset, setVoiceSlideOffset] = useState(0);
  // @mention autocomplete
  const [threadMsg, setThreadMsg] = useState(null);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionSuggestions, setMentionSuggestions] = useState([]);
  const [participants, setParticipants] = useState([]);
  // Double-tap tracking
  const lastTapRef = useRef({});
  // Voice note
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [recordLocked, setRecordLocked] = useState(false);
  const [meterLevel, setMeterLevel] = useState(0);
  const recordingRef = useRef(null); // use ref not state to avoid stale closure
  const recordTimerRef = useRef(null);
  const micPulseAnim = useRef(new Animated.Value(1)).current;
  const lockSlideAnim = useRef(new Animated.Value(0)).current;
  const cancelSlideAnim = useRef(new Animated.Value(0)).current;
  const flatRef = useRef(null);
  const pollRef = useRef(null);
  const typingRef = useRef(null);

  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
        recordingRef.current = null;
      }
      clearInterval(recordTimerRef.current);
    };
  }, []);

  const fetchMessages = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      let cid = convId;
      if (!cid && type === "family") {
        const { data } = await api.get("/messages/family");
        cid = data.conversation.id;
        setConvId(cid);
      }
      if (!cid) { setLoading(false); return; }
      const { data } = await api.get(`/messages/conversations/${cid}/messages`);
      const msgs = data.messages || [];
      setMessages(msgs);
      // Load pinned message for family chat
      if (type === 'family' && data.pinned_message_id) {
        const pinned = msgs.find(m => m.id === data.pinned_message_id);
        setPinnedMsg(pinned || null);
      } else {
        setPinnedMsg(null);
      }
      if (!silent && msgs.length > 0) {
        const last = msgs[msgs.length - 1];
        if (last.sender_id !== user?.id && last.text) {
          api.post('/ai/smart-replies', { message: last.text })
            .then(({ data: d }) => setSmartReplies(d.replies || []))
            .catch(() => {});
        } else {
          setSmartReplies([]);
        }
      }
    } catch {} finally { setLoading(false); }
  }, [convId, type]);

  // Load conversation participants for @mention autocomplete
  useEffect(() => {
    if (!convId) return;
    api.get(`/messages/conversations/${convId}/participants`)
      .then(({ data }) => setParticipants(data.participants || []))
      .catch(() => {});
  }, [convId]);

  useEffect(() => {
    fetchMessages();
    // Poll every 3 seconds for new messages
    pollRef.current = setInterval(() => fetchMessages(true), 8000);
    return () => clearInterval(pollRef.current);
  }, [fetchMessages]);

  // Poll typing indicator and presence
  useEffect(() => {
    if (!convId) return;
    const pollTyping = async () => {
      try {
        const { data } = await api.get(`/messages/conversations/${convId}/typing`);
        setTypingNames(data.names || []);
      } catch {}
    };
    const pollPresence = async () => {
      if (!otherUserId) return;
      try {
        const { data } = await api.get(`/messages/presence/${otherUserId}`);
        setOtherStatus(data.status);
      } catch {}
    };
    pollTyping(); pollPresence();
    typingRef.current = setInterval(() => { pollTyping(); pollPresence(); }, 8000);
    return () => clearInterval(typingRef.current);
  }, [convId, otherUserId]);

  // Keep our presence fresh while chat is open
  useEffect(() => {
    let alive = true;
    const ping = async () => {
      try { await api.post('/messages/presence/ping'); } catch {}
    };
    ping();
    const id = setInterval(() => { if (alive) ping(); }, 45000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // Signal typing + handle @mention autocomplete
  const handleTextChange = (val) => {
    setText(val);
    if (convId) {
      api.post(`/messages/conversations/${convId}/typing`, { typing: val.length > 0 }).catch(() => {});
    }
    // Detect @mention trigger
    const match = val.match(/@(\w*)$/);
    if (match) {
      const q = match[1].toLowerCase();
      setMentionQuery(q);
      const filtered = participants.filter(p =>
        p.id !== user?.id &&
        (p.name?.toLowerCase().includes(q) || p.username?.toLowerCase().includes(q))
      );
      setMentionSuggestions(filtered);
    } else {
      setMentionQuery('');
      setMentionSuggestions([]);
    }
  };

  const insertMention = (participant) => {
    const newText = text.replace(/@\w*$/, `@${participant.username || participant.name} `);
    setText(newText);
    setMentionSuggestions([]);
    setMentionQuery('');
  };

  const [heartAnim, setHeartAnim] = useState(null); // { id, x, y }

  // Double-tap to react ❤️ with floating heart animation
  const handleBubbleTap = (item, evt) => {
    const now = Date.now();
    const last = lastTapRef.current[item.id] || 0;
    if (now - last < 300) {
      reactToMessage(item.id, '❤️');
      const { pageX, pageY } = evt?.nativeEvent || {};
      setHeartAnim({ id: Date.now(), x: pageX || 160, y: pageY || 400 });
      setTimeout(() => setHeartAnim(null), 900);
    }
    lastTapRef.current[item.id] = now;
  };

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const sendMessage = async () => {
    if (!text.trim() && !sending) return;
    const msgText = text.trim();
    setText("");
    setMentionSuggestions([]);
    setSending(true);
    try {
      // Extract @mentions from text
      const mentionedUsernames = [...msgText.matchAll(/@(\w+)/g)].map(m => m[1]);
      const mentionedIds = participants
        .filter(p => mentionedUsernames.includes(p.username) || mentionedUsernames.includes(p.name))
        .map(p => p.id);
      const payload = { text: msgText };
      if (replyTo) payload.reply_to_id = replyTo.id;
      if (mentionedIds.length) payload.mentions = mentionedIds;
      const { data } = await api.post(`/messages/conversations/${convId}/messages`, payload);
      setMessages(prev => [...prev, data.message]);
      setReplyTo(null);
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {} finally { setSending(false); }
  };

  const sendPoll = async () => {
    if (!pollQuestion.trim()) return;
    const opts = (pollOptions || []).map(o => (o || '').trim()).filter(Boolean);
    if (opts.length < 2) return;
    setShowPollModal(false);
    setSending(true);
    try {
      const payload = { poll: { question: pollQuestion.trim(), options: opts } };
      const { data } = await api.post(`/messages/conversations/${convId}/messages`, payload);
      setMessages(prev => [...prev, data.message]);
      setPollQuestion('');
      setPollOptions(['Option 1', 'Option 2']);
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {} finally { setSending(false); }
  };

  const sendImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg = {
      id: tempId,
      media_url: asset.uri,
      media_type: 'image',
      sender_id: user?.id,
      sender_name: user?.name,
      created_at: new Date().toISOString(),
      is_read: false,
      sending: true,
    };
    setMessages(prev => [...prev, optimisticMsg]);
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 50);

    try {
      const formData = new FormData();
      formData.append("file", { uri: asset.uri, type: "image/jpeg", name: "photo.jpg" });
      if (replyTo) formData.append("reply_to_id", replyTo.id);
      const { data } = await api.post(`/messages/conversations/${convId}/messages`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMessages(prev => prev.map(m => m.id === tempId ? data.message : m));
      setReplyTo(null);
    } catch {
      setMessages(prev => prev.filter(m => m.id === tempId));
    }
  };

  const sendCamera = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.75,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg = {
      id: tempId,
      media_url: asset.uri,
      media_type: 'image',
      sender_id: user?.id,
      sender_name: user?.name,
      created_at: new Date().toISOString(),
      is_read: false,
      sending: true,
    };
    setMessages(prev => [...prev, optimisticMsg]);
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 50);
    try {
      const formData = new FormData();
      formData.append("file", { uri: asset.uri, type: "image/jpeg", name: "camera.jpg" });
      if (replyTo) formData.append("reply_to_id", replyTo.id);
      const { data } = await api.post(`/messages/conversations/${convId}/messages`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMessages(prev => prev.map(m => m.id === tempId ? data.message : m));
      setReplyTo(null);
    } catch {
      setMessages(prev => prev.filter(m => m.id !== tempId));
    }
  };

  const sendMemory = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.8,
    });
    if (result.canceled) return;
    setSending(true);
    try {
      const asset = result.assets[0];
      const isVideo = asset.type === 'video';
      const formData = new FormData();
      formData.append('file', { uri: asset.uri, type: isVideo ? 'video/mp4' : 'image/jpeg', name: isVideo ? 'memory.mp4' : 'memory.jpg' });
      formData.append('text', '📸 Shared a memory');
      if (replyTo) formData.append('reply_to_id', replyTo.id);
      const { data } = await api.post(`/messages/conversations/${convId}/messages`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setMessages(prev => [...prev, data.message]);
      setReplyTo(null);
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {} finally { setSending(false); }
  };

  // ── Voice notes ──────────────────────────────────────────
  const startVoiceRecording = async () => {
    // Null out ref immediately to prevent double-start
    if (recordingRef.current) {
      try { await recordingRef.current.stopAndUnloadAsync(); } catch {}
      recordingRef.current = null;
      await new Promise(r => setTimeout(r, 200)); // let native session release
    }
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) { Alert.alert('Permission needed', 'Microphone access is required'); return; }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });

      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
        (status) => {
          if (status.isRecording && status.metering != null) {
            setMeterLevel(Math.max(0, (status.metering + 60) / 60));
          }
        },
        100
      );

      recordingRef.current = rec;
      setIsRecording(true);
      setRecordLocked(false);
      setRecordDuration(0);
      setMeterLevel(0);
      recordTimerRef.current = setInterval(() => setRecordDuration(d => d + 1), 1000);

      Animated.loop(Animated.sequence([
        Animated.timing(micPulseAnim, { toValue: 1.2, duration: 700, useNativeDriver: true }),
        Animated.timing(micPulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])).start();
      Animated.parallel([
        Animated.spring(lockSlideAnim, { toValue: 1, friction: 6, useNativeDriver: true }),
        Animated.spring(cancelSlideAnim, { toValue: 1, friction: 6, useNativeDriver: true }),
      ]).start();
    } catch (e) {
      console.error('Recording start error:', e);
      recordingRef.current = null;
      try { await Audio.setAudioModeAsync({ allowsRecordingIOS: false }); } catch {}
    }
  };

  const stopAnimations = () => {
    micPulseAnim.stopAnimation();
    micPulseAnim.setValue(1);
    lockSlideAnim.setValue(0);
    cancelSlideAnim.setValue(0);
    clearInterval(recordTimerRef.current);
  };

  const cancelVoiceRecording = async () => {
    if (!recordingRef.current) return;
    stopAnimations();
    try { await recordingRef.current.stopAndUnloadAsync(); } catch {}
    recordingRef.current = null;
    try { await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: false }); } catch {}
    setIsRecording(false);
    setRecordLocked(false);
    setRecordDuration(0);
    setMeterLevel(0);
  };

  const stopVoiceRecording = async () => {
    if (!recordingRef.current) return;
    stopAnimations();
    const rec = recordingRef.current;
    recordingRef.current = null;
    try {
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      setIsRecording(false);
      setRecordLocked(false);
      setMeterLevel(0);
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: false });
      setSending(true);
      const formData = new FormData();
      formData.append('file', { uri, type: 'audio/m4a', name: 'voice.m4a' });
      if (replyTo) formData.append('reply_to_id', replyTo.id);
      const { data } = await api.post(`/messages/conversations/${convId}/messages`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setMessages(prev => [...prev, data.message]);
      setReplyTo(null);
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {} finally { setSending(false); }
  };

  const sendSticker = async (emoji) => {
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg = {
      id: tempId,
      text: emoji,
      sender_id: user?.id,
      sender_name: user?.name,
      created_at: new Date().toISOString(),
      is_read: false,
      sending: true,
    };
    setShowStickerPicker(false);
    setMessages(prev => [...prev, optimisticMsg]);
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 50);
    try {
      const { data } = await api.post(`/messages/conversations/${convId}/messages`, {
        text: emoji,
      });
      setMessages(prev => prev.map(m => m.id === tempId ? data.message : m));
    } catch {
      setMessages(prev => prev.filter(m => m.id !== tempId));
    }
  };

  const sendGif = async (gif) => {
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg = {
      id: tempId,
      media_url: gif.url,
      media_type: 'gif',
      sender_id: user?.id,
      sender_name: user?.name,
      created_at: new Date().toISOString(),
      is_read: false,
      sending: true,
    };
    setShowGifPicker(false);
    setMessages(prev => [...prev, optimisticMsg]);
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 50);

    try {
      const { data } = await api.post(`/messages/conversations/${convId}/messages`, {
        media_url: gif.url,
        media_type: 'gif',
      });
      setMessages(prev => prev.map(m => m.id === tempId ? data.message : m));
    } catch {
      setMessages(prev => prev.filter(m => m.id !== tempId));
    }
  };

  // ── Forward message ───────────────────────────────────────
  const openForward = async (msg) => {
    setMsgActionSheet(null);
    try {
      const { data } = await api.get('/messages/conversations');
      setConversations(data.conversations || []);
    } catch {}
    setForwardMsg(msg);
  };

  const doForward = async (targetConvId) => {
    if (!forwardMsg) return;
    setForwardMsg(null);
    try {
      await api.post(`/messages/messages/${forwardMsg.id}/forward`, { conversation_ids: [targetConvId] });
    } catch {}
  };

  // ── Message search ────────────────────────────────────────
  const handleSearch = async (q) => {
    setSearchQuery(q);
    if (!q.trim()) { setSearchResults([]); return; }
    try {
      const { data } = await api.get(`/messages/conversations/${convId}/search?q=${encodeURIComponent(q)}`);
      setSearchResults(data.messages || []);
    } catch {}
  };

  const reactToMessage = async (msgId, emoji) => {
    setMsgActionSheet(null);
    try {
      await api.post(`/messages/messages/${msgId}/react`, { emoji });
      fetchMessages(true);
    } catch {}
  };

  const deleteMessage = (msgId, isMe) => {
    const options = isMe
      ? [
          { text: 'Delete for me', style: 'destructive', onPress: async () => {
            try { await api.delete(`/messages/messages/${msgId}?scope=me`); setMessages(prev => prev.filter(m => m.id !== msgId)); } catch {}
          }},
          { text: 'Delete for everyone', style: 'destructive', onPress: async () => {
            try { await api.delete(`/messages/messages/${msgId}?scope=everyone`); setMessages(prev => prev.filter(m => m.id !== msgId)); } catch {}
          }},
          { text: t('cancel'), style: 'cancel' },
        ]
      : [{ text: t('cancel'), style: 'cancel' }];
    Alert.alert('Delete Message', 'Remove this message?', options);
  };

  const toggleDisappearing = async () => {
    const next = !disappearing;
    setDisappearing(next);
    if (next && convId) {
      // Mark future messages with 24h expiry by storing preference
      // Backend will use disappears_at when we send messages
    }
  };

  const renderMessage = useCallback(({ item, index }) => {
    const isMe = item.sender_id === user?.id;
    const showAvatar = !isMe && (index === 0 || messages[index - 1]?.sender_id !== item.sender_id);
    const showName = type === "family" && !isMe && showAvatar;
    const isThreaded = item.reply_to_id;
    const threadReplies = messages.filter(m => m.reply_to_id === item.id);

    const reactionGroups = {};
    (item.reactions || []).forEach(r => {
      reactionGroups[r.emoji] = (reactionGroups[r.emoji] || 0) + 1;
    });
    const myReaction = (item.reactions || []).find(r => r.user_id === user?.id)?.emoji;

    return (
      <View style={[cs.msgRow, isMe && cs.msgRowMe]}>
        {!isMe && (
          <View style={cs.avatarCol}>
            {showAvatar
              ? <TouchableOpacity onPress={() => navigation.navigate("UserProfile", { userId: item.sender_id, userName: item.sender_name })}>
                  <Avatar uri={item.sender_avatar} name={item.sender_name} size={32} />
                </TouchableOpacity>
              : <View style={{ width: 32 }} />}
          </View>
        )}

        <View style={[cs.msgInner, isMe ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' }]}>
          {item.forwarded_from_id && (
            <View style={[cs.forwardedLabel, isMe && { alignSelf: 'flex-end' }]}>
              <Ionicons name="arrow-redo-outline" size={11} color={colors.dim} />
              <AppText style={cs.forwardedText}>Forwarded</AppText>
            </View>
          )}

          <MessageBubble
            item={item}
            isMe={isMe}
            showName={showName}
            onPress={(evt) => handleBubbleTap(item, evt)}
            onLongPress={() => setMsgActionSheet({ item, isMe })}
          />

          {Object.keys(reactionGroups).length > 0 && (
            <View style={[cs.reactionsRow, isMe && { alignSelf: 'flex-end' }]}>
              {Object.entries(reactionGroups).map(([emoji, count]) => (
                <TouchableOpacity
                  key={emoji}
                  style={[cs.reactionPill, myReaction === emoji && cs.reactionPillMine]}
                  onPress={() => reactToMessage(item.id, emoji)}
                >
                  <AppText style={cs.reactionEmoji}>{emoji}</AppText>
                  {count > 1 && <AppText style={cs.reactionCount}>{count}</AppText>}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {threadReplies.length > 0 && (
            <TouchableOpacity
              style={[cs.threadBtn, isMe && { alignSelf: 'flex-end' }]}
              onPress={() => setThreadMsg(item)}
            >
              <Ionicons name="chatbubbles-outline" size={13} color={colors.primary} />
              <AppText style={cs.threadBtnText}>
                {threadReplies.length} {threadReplies.length === 1 ? 'reply' : 'replies'}
              </AppText>
            </TouchableOpacity>
          )}
        </View>

        {/* Reaction picker removed — handled by msgActionSheet modal */}
      </View>
    );
  }, [messages, user, type, pinnedMsg, msgActionSheet, navigation]);

  const messageKeyExtractor = useCallback((i) => String(i.id), []);

  return (
    <KeyboardAvoidingView style={cs.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <StatusBar barStyle="light-content" />

      {/* Floating heart on double-tap */}
      {heartAnim && <HeartBurst x={heartAnim.x} y={heartAnim.y} key={heartAnim.id} />}

      {/* Header */}
      <LinearGradient colors={["#0f172a", "#1a0a2e"]} style={cs.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={cs.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>

        {type === "family" ? (
          <LinearGradient colors={["#7c3aed", "#3b82f6"]} style={cs.headerAvatar}>
            <Ionicons name="people" size={20} color="#fff" />
          </LinearGradient>
        ) : (
          <Avatar uri={avatar} name={title} size={38} />
        )}

        <TouchableOpacity
          style={cs.headerInfo}
          onPress={() => otherUserId && navigation.navigate("UserProfile", { userId: otherUserId, userName: title })}
        >
          <AppText style={cs.headerTitle}>{title}</AppText>
          <AppText style={cs.headerSub}>
            {type === "family" ? t('family_group') :
              otherStatus === "online" ? "🟢 Online" :
              otherStatus === "recently" ? "Recently active" :
              "Active recently"}
          </AppText>
        </TouchableOpacity>

        {type === "family" && (
          <>
            <TouchableOpacity onPress={() => navigation.navigate('Family')} style={{ padding: 4 }}>
              <Ionicons name="information-circle-outline" size={24} color={colors.muted} />
            </TouchableOpacity>
            <TouchableOpacity onPress={async () => {
              try {
                const { data } = await api.post('/ai/family-summary', { messages });
                Alert.alert('💬 Family Chat Summary', data.summary || 'No summary available');
              } catch { Alert.alert('Error', 'Failed to generate summary'); }
            }} style={{ padding: 4 }}>
              <Ionicons name="sparkles-outline" size={22} color="#f59e0b" />
            </TouchableOpacity>
            <TouchableOpacity style={{ padding: 4 }} onPress={() => Alert.alert('Coming soon', 'Video call feature in development')}>
              <Ionicons name="videocam-outline" size={22} color="#10b981" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowPollModal(true)} style={{ padding: 4 }}>
              <Ionicons name="bar-chart-outline" size={22} color="#8b5cf6" />
            </TouchableOpacity>
          </>
        )}
        <TouchableOpacity onPress={() => setShowSearch(s => !s)} style={cs.headerIconBtn}>
          <Ionicons name={showSearch ? 'search' : 'search-outline'} size={20} color={showSearch ? colors.primary : colors.muted} />
        </TouchableOpacity>
        {type === "private" && (
          <TouchableOpacity onPress={() => setShowOptions(true)} style={cs.headerIconBtn}>
            <Ionicons name="ellipsis-vertical" size={20} color={colors.muted} />
          </TouchableOpacity>
        )}
      </LinearGradient>

      {/* Pinned message banner */}
      {type === 'family' && pinnedMsg && (
        <TouchableOpacity
          style={cs.pinnedBanner}
          onPress={() => {
            const idx = messages.findIndex(m => m.id === pinnedMsg.id);
            if (idx >= 0) flatRef.current?.scrollToIndex({ index: idx, animated: true });
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="pin" size={14} color="#f59e0b" />
          <View style={{ flex: 1 }}>
            <AppText style={cs.pinnedLabel}>Pinned Message</AppText>
            <AppText style={cs.pinnedText} numberOfLines={1}>{pinnedMsg.text || '📎 Media'}</AppText>
          </View>
          <TouchableOpacity onPress={async () => {
            await api.post(`/messages/conversations/${convId}/pin`, { message_id: null });
            setPinnedMsg(null);
          }}>
            <Ionicons name="close" size={16} color={colors.muted} />
          </TouchableOpacity>
        </TouchableOpacity>
      )}

      {/* Search bar */}
      {showSearch && (
        <View style={cs.searchBar}>
          <Ionicons name="search" size={16} color={colors.dim} />
          <TextInput
            style={cs.searchInput}
            placeholder="Search messages..."
            placeholderTextColor={colors.dim}
            value={searchQuery}
            onChangeText={handleSearch}
            autoFocus
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
              <Ionicons name="close-circle" size={16} color={colors.dim} />
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      {/* Search results overlay */}
      {showSearch && searchQuery ? (
        <FlatList
          data={searchResults}
          keyExtractor={i => String(i.id)}
          style={cs.searchResultsList}
          ListEmptyComponent={<AppText style={cs.emptyText}>No results</AppText>}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={cs.searchResultRow}
              onPress={() => {
                setShowSearch(false);
                setSearchQuery('');
                setSearchResults([]);
                // Scroll to message
                const idx = messages.findIndex(m => m.id === item.id);
                if (idx >= 0) flatRef.current?.scrollToIndex({ index: idx, animated: true });
              }}
            >
              <AppText style={cs.searchResultName}>{item.sender_name}</AppText>
              <AppText style={cs.searchResultText} numberOfLines={1}>{item.text}</AppText>
            </TouchableOpacity>
          )}
        />
      ) : null}

      {/* Forward modal */}
      {forwardMsg && (
        <View style={cs.forwardOverlay}>
          <View style={cs.forwardSheet}>
            <View style={cs.forwardHeader}>
              <AppText style={cs.forwardTitle}>Forward to...</AppText>
              <TouchableOpacity onPress={() => setForwardMsg(null)}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={conversations}
              keyExtractor={i => String(i.id)}
              renderItem={({ item }) => (
                <TouchableOpacity style={cs.forwardRow} onPress={() => doForward(item.id)}>
                  <AppText style={cs.forwardRowName}>
                    {item.type === 'family' ? '👨‍👩‍👧 Family Chat' : item.other_user?.name || 'Chat'}
                  </AppText>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      )}

      {/* Messages */}
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ flex: 1 }} />
      ) : (
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={messageKeyExtractor}
          renderItem={renderMessage}
          contentContainerStyle={cs.messagesList}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          maxToRenderPerBatch={10}
          windowSize={10}
          initialNumToRender={15}
          ListEmptyComponent={
            <View style={cs.emptyWrap}>
              <Ionicons name="chatbubble-outline" size={40} color={colors.dim} />
              <AppText style={cs.emptyText}>{t('say_hello')}</AppText>
            </View>
          }
        />
      )}

      {disappearing && (
        <View style={cs.disappearBanner}>
          <Ionicons name="timer-outline" size={14} color="#f59e0b" />
          <AppText style={cs.disappearText}>{t('disappearing_on')}</AppText>
        </View>
      )}

      {/* Typing indicator */}
      {typingNames.length > 0 && (
        <View style={cs.typingBanner}>
          <AppText style={cs.typingText}>{typingNames.join(", ")} {typingNames.length === 1 ? "is" : "are"} typing...</AppText>
        </View>
      )}

      {/* Smart reply suggestions */}
      {smartReplies.length > 0 && !text && (
        <View style={cs.smartRepliesRow}>
          {smartReplies.map((r, i) => (
            <TouchableOpacity key={i} style={cs.smartReplyChip} onPress={() => { setText(r); setSmartReplies([]); }}>
              <AppText style={cs.smartReplyText}>{r}</AppText>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* @mention autocomplete */}
      {mentionSuggestions.length > 0 && (
        <ScrollView
          style={[cs.mentionList, { backgroundColor: colors.bgCard }]}
          keyboardShouldPersistTaps="always"
        >
          {mentionSuggestions.map(p => (
            <TouchableOpacity
              key={p.id}
              style={[cs.mentionRow, { borderBottomColor: colors.border }]}
              onPress={() => insertMention(p)}
            >
              {p.avatar ? (
                <Image source={{ uri: p.avatar }} style={cs.mentionAvatar} />
              ) : (
                <View style={[cs.mentionAvatar, { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }]}>
                  <AppText style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{p.name?.[0]}</AppText>
                </View>
              )}
              <View>
                <AppText style={[cs.mentionName, { color: colors.text }]}>{p.name}</AppText>
                <AppText style={[cs.mentionUsername, { color: colors.muted }]}>@{p.username || p.name}</AppText>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Thread panel */}
      {threadMsg && (
        <View style={[cs.threadPanel, { backgroundColor: colors.bgCard }]}>
          <View style={[cs.threadPanelHeader, { borderBottomColor: colors.border }]}>
            <AppText style={[cs.threadPanelTitle, { color: colors.text }]}>Thread</AppText>
            <TouchableOpacity onPress={() => setThreadMsg(null)}>
              <Ionicons name="close" size={22} color={colors.muted} />
            </TouchableOpacity>
          </View>
          {/* Original message */}
          <View style={[cs.threadOriginal, { backgroundColor: colors.bgSecondary }]}>
            <AppText style={[cs.threadOriginalName, { color: colors.primary }]}>{threadMsg.sender_name}</AppText>
            <MentionText text={threadMsg.text} isMe={false} style={[cs.msgText, { color: colors.text }]} />
          </View>
          {/* Thread replies */}
          <FlatList
            data={messages.filter(m => m.reply_to_id === threadMsg.id)}
            keyExtractor={i => String(i.id)}
            style={{ maxHeight: 200 }}
            renderItem={({ item }) => (
              <View style={cs.threadReplyRow}>
                <AppText style={[cs.threadReplyName, { color: colors.primary }]}>{item.sender_name}</AppText>
                <MentionText text={item.text} isMe={false} style={[cs.msgText, { color: colors.text }]} />
                <AppText style={[cs.msgTime, { color: colors.dim }]}>{timeStr(item.created_at)}</AppText>
              </View>
            )}
            ListEmptyComponent={<AppText style={[cs.emptyText, { paddingHorizontal: 16 }]}>No replies yet</AppText>}
          />
          {/* Reply input */}
          <View style={[cs.threadInputRow, { borderTopColor: colors.border }]}>
            <TextInput
              style={[cs.input, { flex: 1, backgroundColor: colors.bgSecondary, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 }]}
              placeholder={`Reply to ${threadMsg.sender_name}...`}
              placeholderTextColor={colors.dim}
              value={text}
              onChangeText={handleTextChange}
              onSubmitEditing={() => {
                setReplyTo(threadMsg);
                sendMessage();
                setThreadMsg(null);
              }}
              returnKeyType="send"
            />
            <TouchableOpacity
              style={cs.sendBtn}
              onPress={() => { setReplyTo(threadMsg); sendMessage(); setThreadMsg(null); }}
              disabled={!text.trim()}
            >
              <LinearGradient colors={['#7c3aed', '#3b82f6']} style={cs.sendGrad}>
                <Ionicons name="send" size={16} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Reply preview bar */}
      {replyTo && (
        <View style={cs.replyBar2}>
          <View style={cs.replyBarLine} />
          <View style={{ flex: 1 }}>
            <AppText style={cs.replyBarName}>{replyTo.sender_name}</AppText>
            <AppText style={cs.replyBarText} numberOfLines={1}>{replyTo.text || "Media"}</AppText>
          </View>
          <TouchableOpacity onPress={() => setReplyTo(null)}>
            <Ionicons name="close" size={18} color={colors.muted} />
          </TouchableOpacity>
        </View>
      )}

      {/* Input */}
      <View style={[cs.inputRow, inputFocused && cs.inputRowFocused]}>

        {/* Action buttons — hidden when focused */}
        {!inputFocused && (
          <View style={cs.inputActions}>
            <TouchableOpacity onPress={sendImage} style={cs.inputAction}>
              <Ionicons name="image-outline" size={22} color={colors.muted} />
            </TouchableOpacity>
            <TouchableOpacity onPress={sendCamera} style={cs.inputAction}>
              <Ionicons name="camera-outline" size={22} color={colors.muted} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowGifPicker(true)} style={cs.inputAction}>
              <AppText style={cs.gifLabel}>GIF</AppText>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowStickerPicker(true)} style={cs.inputAction}>
              <Ionicons name="happy-outline" size={22} color="#f59e0b" />
            </TouchableOpacity>
            {type === 'family' && (
              <TouchableOpacity onPress={sendMemory} style={cs.inputAction}>
                <Ionicons name="time-outline" size={22} color="#f59e0b" />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => setShowPollModal(true)} style={cs.inputAction}>
              <Ionicons name="bar-chart-outline" size={22} color="#8b5cf6" />
            </TouchableOpacity>
            <TouchableOpacity style={cs.inputAction} onPress={() => setShowAI(true)}>
              <Ionicons name="sparkles-outline" size={22} color="#8b5cf6" />
            </TouchableOpacity>
          </View>
        )}

        {/* Collapse button when focused */}
        {inputFocused && (
          <TouchableOpacity
            style={cs.collapseBtn}
            onPress={() => setInputFocused(false)}
          >
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </TouchableOpacity>
        )}

        {isRecording ? (
          <View style={cs.voiceActiveWrap}>
            {/* Cancel */}
            <Animated.View style={{
              opacity: cancelSlideAnim,
              transform: [{ translateX: cancelSlideAnim.interpolate({ inputRange: [0,1], outputRange: [-16, 0] }) }],
            }}>
              <TouchableOpacity style={cs.voiceCancelBtn} onPress={cancelVoiceRecording}>
                <Ionicons name="trash-outline" size={17} color="#e0245e" />
              </TouchableOpacity>
            </Animated.View>

            {/* Live waveform + timer */}
            <View style={cs.voiceMiddle}>
              <View style={cs.voiceWaveRow}>
                {[...Array(22)].map((_, i) => {
                  const base = 3 + Math.abs(Math.sin(i * 0.9) * 8);
                  const live = base + meterLevel * 16 * Math.abs(Math.sin(i * 1.3 + recordDuration));
                  return (
                    <View
                      key={i}
                      style={[cs.voiceBar, { height: Math.min(live, 26) }]}
                    />
                  );
                })}
              </View>
              <AppText style={cs.voiceTimerText}>
                {String(Math.floor(recordDuration / 60)).padStart(2,'0')}:{String(recordDuration % 60).padStart(2,'0')}
              </AppText>
            </View>

            {/* Lock or Send */}
            {recordLocked ? (
              <TouchableOpacity style={cs.voiceSendBtn} onPress={stopVoiceRecording}>
                <LinearGradient colors={['#7c3aed','#3b82f6']} style={cs.voiceSendGrad}>
                  <Ionicons name="send" size={16} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <Animated.View style={{
                opacity: lockSlideAnim,
                transform: [{ translateY: lockSlideAnim.interpolate({ inputRange: [0,1], outputRange: [16, 0] }) }],
              }}>
                <TouchableOpacity style={cs.voiceLockBtn} onPress={() => setRecordLocked(true)}>
                  <Ionicons name="lock-closed" size={15} color="#fff" />
                </TouchableOpacity>
              </Animated.View>
            )}
          </View>
        ) : (
          <View style={[cs.inputWrap, inputFocused && cs.inputWrapFocused]}>
            <TextInput
              style={cs.input}
              placeholder={t('message_placeholder')}
              placeholderTextColor={colors.dim}
              value={text}
              onChangeText={handleTextChange}
              onFocus={() => setInputFocused(true)}
              onBlur={() => { if (!text.trim()) setInputFocused(false); }}
              multiline
              maxLength={2000}
            />
          </View>
        )}

        {text.trim() ? (
          <TouchableOpacity
            style={cs.sendBtn}
            onPress={sendMessage}
            disabled={sending}
          >
            {sending
              ? <ActivityIndicator size="small" color="#fff" />
              : <LinearGradient colors={["#7c3aed", "#3b82f6"]} style={cs.sendGrad}>
                  <Ionicons name="send" size={18} color="#fff" />
                </LinearGradient>}
          </TouchableOpacity>
        ) : (
          <Animated.View style={{ transform: [{ scale: micPulseAnim }] }}>
            <TouchableOpacity
              style={cs.micBtn}
              onPress={isRecording ? stopVoiceRecording : startVoiceRecording}
            >
              <LinearGradient
                colors={isRecording ? ['#e0245e', '#c0185e'] : ['rgba(124,58,237,0.15)', 'rgba(59,130,246,0.1)']}
                style={cs.micBtnGrad}
              >
                <Ionicons
                  name={isRecording ? 'stop' : 'mic-outline'}
                  size={20}
                  color={isRecording ? '#fff' : colors.primary}
                />
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>
      {/* ── Message Action Sheet ─────────────────────────────── */}
      <Modal
        visible={!!msgActionSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setMsgActionSheet(null)}
      >
        <Pressable style={cs.asOverlay} onPress={() => setMsgActionSheet(null)}>
          <Pressable style={cs.asSheet}>
            <View style={cs.asHandle} />

            {/* Message preview */}
            {msgActionSheet?.item?.text ? (
              <View style={cs.asPreview}>
                <AppText style={cs.asPreviewText} numberOfLines={2}>
                  {msgActionSheet.item.text}
                </AppText>
              </View>
            ) : msgActionSheet?.item?.media_url ? (
              <View style={cs.asPreview}>
                <Ionicons name="image-outline" size={18} color={colors.muted} />
                <AppText style={cs.asPreviewText}>Media message</AppText>
              </View>
            ) : null}

            {/* Emoji reactions */}
            <View style={cs.asReactionsRow}>
              {REACTIONS.map(e => {
                const myReaction = (msgActionSheet?.item?.reactions || []).find(r => r.user_id === user?.id)?.emoji;
                const isActive = myReaction === e;
                return (
                  <TouchableOpacity
                    key={e}
                    style={[cs.asReactionBtn, isActive && cs.asReactionBtnActive]}
                    onPress={() => {
                      reactToMessage(msgActionSheet.item.id, e);
                      setMsgActionSheet(null);
                    }}
                  >
                    <AppText style={cs.asReactionEmoji}>{e}</AppText>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Action rows */}
            <TouchableOpacity style={cs.asRow} onPress={() => { setReplyTo(msgActionSheet.item); setMsgActionSheet(null); }}>
              <View style={[cs.asIconWrap, { backgroundColor: 'rgba(59,130,246,0.12)' }]}>
                <Ionicons name="return-down-back-outline" size={20} color="#3b82f6" />
              </View>
              <AppText style={cs.asRowText}>Reply</AppText>
              <Ionicons name="chevron-forward" size={16} color={colors.dim} />
            </TouchableOpacity>

            {msgActionSheet?.item?.text ? (
              <TouchableOpacity style={cs.asRow} onPress={() => { Clipboard.setString(msgActionSheet.item.text); setMsgActionSheet(null); }}>
                <View style={[cs.asIconWrap, { backgroundColor: 'rgba(16,185,129,0.12)' }]}>
                  <Ionicons name="copy-outline" size={20} color="#10b981" />
                </View>
                <AppText style={cs.asRowText}>Copy text</AppText>
                <Ionicons name="chevron-forward" size={16} color={colors.dim} />
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity style={cs.asRow} onPress={() => {
              setForwardMsg(msgActionSheet.item);
              api.get('/messages/conversations').then(({ data }) => setConversations(data.conversations || [])).catch(() => {});
              setMsgActionSheet(null);
            }}>
              <View style={[cs.asIconWrap, { backgroundColor: 'rgba(124,58,237,0.12)' }]}>
                <Ionicons name="arrow-redo-outline" size={20} color={colors.primary} />
              </View>
              <AppText style={cs.asRowText}>Forward</AppText>
              <Ionicons name="chevron-forward" size={16} color={colors.dim} />
            </TouchableOpacity>

            <TouchableOpacity style={cs.asRow} onPress={() => { setThreadMsg(msgActionSheet.item); setMsgActionSheet(null); }}>
              <View style={[cs.asIconWrap, { backgroundColor: 'rgba(245,158,11,0.12)' }]}>
                <Ionicons name="chatbubbles-outline" size={20} color="#f59e0b" />
              </View>
              <AppText style={cs.asRowText}>Reply in thread</AppText>
              <Ionicons name="chevron-forward" size={16} color={colors.dim} />
            </TouchableOpacity>

            {type === 'family' && (
              <TouchableOpacity style={cs.asRow} onPress={async () => {
                const item = msgActionSheet.item;
                const newId = pinnedMsg?.id === item.id ? null : item.id;
                await api.post(`/messages/conversations/${convId}/pin`, { message_id: newId }).catch(() => {});
                setPinnedMsg(newId ? item : null);
                setMsgActionSheet(null);
              }}>
                <View style={[cs.asIconWrap, { backgroundColor: 'rgba(245,158,11,0.12)' }]}>
                  <Ionicons name="pin-outline" size={20} color="#f59e0b" />
                </View>
                <AppText style={cs.asRowText}>
                  {pinnedMsg?.id === msgActionSheet?.item?.id ? 'Unpin message' : 'Pin message'}
                </AppText>
                <Ionicons name="chevron-forward" size={16} color={colors.dim} />
              </TouchableOpacity>
            )}

            {msgActionSheet?.isMe && (
              <TouchableOpacity style={[cs.asRow, { borderBottomWidth: 0 }]} onPress={() => {
                deleteMessage(msgActionSheet.item.id, true);
                setMsgActionSheet(null);
              }}>
                <View style={[cs.asIconWrap, { backgroundColor: 'rgba(224,36,94,0.12)' }]}>
                  <Ionicons name="trash-outline" size={20} color="#e0245e" />
                </View>
                <AppText style={[cs.asRowText, { color: '#e0245e' }]}>Delete message</AppText>
                <Ionicons name="chevron-forward" size={16} color="#e0245e" />
              </TouchableOpacity>
            )}

            <TouchableOpacity style={cs.asCancelBtn} onPress={() => setMsgActionSheet(null)}>
              <AppText style={cs.asCancelText}>Cancel</AppText>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <AIAssistant
        visible={showAI}
        onClose={() => setShowAI(false)}
        currentText={text}
        lastMessage={messages.filter(m => m.sender_id !== user?.id).slice(-1)[0]?.text}
        onUseText={(t) => setText(t)}
      />

      <StickerPicker
        visible={showStickerPicker}
        onClose={() => setShowStickerPicker(false)}
        onSelect={sendSticker}
      />

      <GifPicker
        visible={showGifPicker}
        onClose={() => setShowGifPicker(false)}
        onSelect={sendGif}
      />

      {/* Block User Modal */}
      <Modal visible={showBlockModal} transparent animationType="fade" onRequestClose={() => setShowBlockModal(false)}>
        <Pressable style={cs.optionsOverlay} onPress={() => setShowBlockModal(false)}>
          <Pressable style={cs.optionsSheet}>
            <View style={cs.optionsHandle} />

            <View style={cs.blockHeader}>
              <View style={cs.blockIconCircle}>
                <Ionicons name="ban" size={30} color="#e0245e" />
              </View>
              <AppText style={cs.blockTitle}>Block {title}?</AppText>
              <AppText style={cs.blockSub}>
                {title} won't be able to send you messages, see your profile, or find you in search.
              </AppText>
            </View>

            <View style={cs.blockInfoRow}>
              <View style={cs.blockInfoItem}>
                <Ionicons name="chatbubble-ellipses-outline" size={22} color={colors.muted} />
                <AppText style={cs.blockInfoText}>No messages</AppText>
              </View>
              <View style={cs.blockInfoDivider} />
              <View style={cs.blockInfoItem}>
                <Ionicons name="eye-off-outline" size={22} color={colors.muted} />
                <AppText style={cs.blockInfoText}>Hidden profile</AppText>
              </View>
              <View style={cs.blockInfoDivider} />
              <View style={cs.blockInfoItem}>
                <Ionicons name="search-outline" size={22} color={colors.muted} />
                <AppText style={cs.blockInfoText}>Not searchable</AppText>
              </View>
            </View>

            <TouchableOpacity
              style={cs.blockConfirmBtn}
              onPress={() => {
                setShowBlockModal(false);
                Alert.alert('Blocked', `${title} has been blocked.`);
              }}
            >
              <AppText style={cs.blockConfirmText}>Block {title}</AppText>
            </TouchableOpacity>

            <TouchableOpacity style={cs.optionsCancelBtn} onPress={() => setShowBlockModal(false)}>
              <AppText style={cs.optionsCancelText}>Cancel</AppText>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Mute Notifications Modal */}
      <Modal visible={showMuteOptions} transparent animationType="fade" onRequestClose={() => setMuteOptions(false)}>
        <Pressable style={cs.optionsOverlay} onPress={() => setMuteOptions(false)}>
          <Pressable style={cs.optionsSheet}>
            <View style={cs.optionsHandle} />

            <View style={cs.muteHeader}>
              <View style={cs.muteIconCircle}>
                <Ionicons name="notifications-off" size={26} color={colors.primary} />
              </View>
              <AppText style={cs.muteTitle}>Mute Notifications</AppText>
              <AppText style={cs.muteSub}>Choose how long to mute {title}</AppText>
            </View>

            {[
              { label: '1 hour', sub: 'Until later today', icon: 'time-outline', color: '#3b82f6' },
              { label: '8 hours', sub: 'Until tonight', icon: 'moon-outline', color: '#8b5cf6' },
              { label: '24 hours', sub: 'Until tomorrow', icon: 'sunny-outline', color: '#f59e0b' },
              { label: '7 days', sub: 'For a week', icon: 'calendar-outline', color: '#10b981' },
              { label: 'Always', sub: 'Until you unmute', icon: 'notifications-off-outline', color: '#e0245e' },
            ].map((opt, i, arr) => (
              <TouchableOpacity
                key={opt.label}
                style={[cs.muteRow, i === arr.length - 1 && { borderBottomWidth: 0 }]}
                onPress={async () => {
                  setMuteOptions(false);
                  try { await api.patch(`/messages/conversations/${convId}/settings`, { is_muted: true }); } catch {}
                  Alert.alert('Muted', `${title} muted for ${opt.label}`);
                }}
              >
                <View style={[cs.optionsIconWrap, { backgroundColor: `${opt.color}18` }]}>
                  <Ionicons name={opt.icon} size={20} color={opt.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText style={cs.muteRowLabel}>{opt.label}</AppText>
                  <AppText style={cs.muteRowSub}>{opt.sub}</AppText>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.dim} />
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={cs.optionsCancelBtn} onPress={() => setMuteOptions(false)}>
              <AppText style={cs.optionsCancelText}>Cancel</AppText>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modern Options Sheet — private chat only */}
      <Modal visible={showOptions} transparent animationType="fade" onRequestClose={() => setShowOptions(false)}>
        <Pressable style={cs.optionsOverlay} onPress={() => setShowOptions(false)}>
          <Pressable style={cs.optionsSheet}>
            <View style={cs.optionsHandle} />
            <AppText style={cs.optionsTitle}>Chat Options</AppText>

            <TouchableOpacity
              style={cs.optionsRow}
              onPress={() => { setShowOptions(false); toggleDisappearing(); }}
            >
              <View style={[cs.optionsIconWrap, { backgroundColor: 'rgba(245,158,11,0.12)' }]}>
                <Ionicons name="timer-outline" size={20} color="#f59e0b" />
              </View>
              <View style={{ flex: 1 }}>
                <AppText style={cs.optionsRowTitle}>
                  {disappearing ? 'Turn off disappearing messages' : 'Disappearing messages'}
                </AppText>
                <AppText style={cs.optionsRowSub}>
                  {disappearing ? 'Currently on · 24h' : 'Messages delete after 24 hours'}
                </AppText>
              </View>
              <View style={[cs.optionsBadge, disappearing && cs.optionsBadgeOn]}>
                <AppText style={[cs.optionsBadgeText, disappearing && { color: '#10b981' }]}>
                  {disappearing ? 'ON' : 'OFF'}
                </AppText>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={cs.optionsRow}
              onPress={() => {
                setShowOptions(false);
                setMuteOptions(true);
              }}
            >
              <View style={[cs.optionsIconWrap, { backgroundColor: 'rgba(124,58,237,0.12)' }]}>
                <Ionicons name="notifications-off-outline" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText style={cs.optionsRowTitle}>Mute notifications</AppText>
                <AppText style={cs.optionsRowSub}>Stop alerts from this chat</AppText>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={cs.optionsRow}
              onPress={() => { setShowOptions(false); otherUserId && navigation.navigate('UserProfile', { userId: otherUserId, userName: title }); }}
            >
              <View style={[cs.optionsIconWrap, { backgroundColor: 'rgba(59,130,246,0.12)' }]}>
                <Ionicons name="person-outline" size={20} color="#3b82f6" />
              </View>
              <View style={{ flex: 1 }}>
                <AppText style={cs.optionsRowTitle}>View profile</AppText>
                <AppText style={cs.optionsRowSub}>See {title}'s full profile</AppText>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[cs.optionsRow, { borderBottomWidth: 0 }]}
              onPress={() => { setShowOptions(false); setShowBlockModal(true); }}
            >
              <View style={[cs.optionsIconWrap, { backgroundColor: 'rgba(224,36,94,0.12)' }]}>
                <Ionicons name="ban-outline" size={20} color="#e0245e" />
              </View>
              <View style={{ flex: 1 }}>
                <AppText style={[cs.optionsRowTitle, { color: '#e0245e' }]}>Block {title}</AppText>
                <AppText style={cs.optionsRowSub}>They won't be able to message you</AppText>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={cs.optionsCancelBtn} onPress={() => setShowOptions(false)}>
              <AppText style={cs.optionsCancelText}>Cancel</AppText>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Poll composer */}
      <Modal visible={showPollModal} transparent animationType="fade" onRequestClose={() => setShowPollModal(false)}>
        <Pressable style={cs.optionsOverlay} onPress={() => setShowPollModal(false)}>
          <Pressable style={cs.optionsSheet}>
            <View style={cs.optionsHandle} />
            <AppText style={cs.optionsTitle}>Create poll</AppText>
            <View style={{ paddingHorizontal: 20, paddingBottom: 10, gap: 10 }}>
              <TextInput
                style={[cs.searchInput, { backgroundColor: colors.bgSecondary, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }]}
                placeholder="Question"
                placeholderTextColor={colors.dim}
                value={pollQuestion}
                onChangeText={setPollQuestion}
              />
              {pollOptions.map((opt, idx) => (
                <TextInput
                  key={idx}
                  style={[cs.searchInput, { backgroundColor: colors.bgSecondary, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }]}
                  placeholder={`Option ${idx + 1}`}
                  placeholderTextColor={colors.dim}
                  value={opt}
                  onChangeText={(v) => setPollOptions(prev => prev.map((p, i) => i === idx ? v : p))}
                />
              ))}
              <TouchableOpacity
                style={[cs.optionsCancelBtn, { marginTop: 0 }]}
                onPress={() => setPollOptions(prev => [...prev, `Option ${prev.length + 1}`])}
              >
                <AppText style={cs.optionsCancelText}>Add option</AppText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[cs.blockConfirmBtn, { marginTop: 6, backgroundColor: 'rgba(124,58,237,0.14)', borderColor: 'rgba(124,58,237,0.3)' }]}
                onPress={sendPoll}
                disabled={sending}
              >
                <AppText style={[cs.blockConfirmText, { color: colors.primary }]}>Send poll</AppText>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

    </KeyboardAvoidingView>
  );
}

const cs = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", paddingTop: 52, paddingBottom: 12, paddingHorizontal: 16, gap: 10, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  backBtn: { padding: 6 },
  headerAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  headerSub: { fontSize: 12, color: colors.muted },
  headerIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  messagesList: { padding: 8, paddingBottom: 8 },
  msgRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 2,
    paddingHorizontal: 0,
  },
  msgRowMe: {
    justifyContent: 'flex-end',
  },
  avatarCol: { width: 32, marginHorizontal: 6 },
  msgInner: { flex: 1, maxWidth: '100%' },

  // Bubble layout/styling lives in MessageBubble
  senderName: { fontSize: 11, fontWeight: '700', color: colors.gold, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 2 },
  replyPreview: { flexDirection: "row", gap: 6, backgroundColor: "rgba(0,0,0,0.15)", margin: 8, marginBottom: 4, borderRadius: 10, padding: 8 },
  replyBar: { width: 3, backgroundColor: colors.gold, borderRadius: 2 },
  replyName: { fontSize: 11, fontWeight: "700", color: colors.gold },
  replyText: { fontSize: 11, color: colors.muted },
  msgImage: { width: '100%' },
  audioBubble: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6, width: '80%', alignSelf: 'flex-start' },
  msgText: { fontSize: 15, lineHeight: 21, paddingHorizontal: 12, paddingVertical: 8 },
  msgTextMe: { color: '#fff' },
  msgTextThem: { color: colors.text },
  msgTime: { fontSize: 10, color: colors.dim },
  msgTimeMe: { color: 'rgba(255,255,255,0.5)' },
  reactionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, paddingHorizontal: 10, paddingBottom: 8 },
  reactionPill: { flexDirection: "row", alignItems: "center", backgroundColor: colors.bgElevated, borderRadius: 12, paddingHorizontal: 7, paddingVertical: 3, gap: 3, borderWidth: 0.5, borderColor: colors.border },
  reactionEmoji: { fontSize: 13 },
  reactionCount: { fontSize: 11, color: colors.muted, fontWeight: '600' },
  msgActions: { padding: 4, alignSelf: "center" },
  reactionPicker: { position: "absolute", bottom: 44, left: 34, borderRadius: 20, overflow: "hidden", zIndex: 10 },
  reactionPickerMe: { left: "auto", right: 34 },
  reactionPickerRow: { flexDirection: "row", padding: 8, gap: 4 },
  reactionOption: { padding: 6 },
  replyBar2: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.bgSecondary, paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 0.5, borderTopColor: colors.border },
  replyBarLine: { width: 3, height: "100%", backgroundColor: colors.primary, borderRadius: 2 },
  replyBarName: { fontSize: 12, fontWeight: "700", color: colors.primary },
  replyBarText: { fontSize: 12, color: colors.muted },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  inputRowFocused: {
    paddingVertical: 10,
  },
  inputActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  inputAction: { padding: 6, paddingBottom: 8 },
  gifLabel: { fontSize: 12, fontWeight: '800', color: colors.muted },
  collapseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  inputWrap: {
    flex: 1,
    backgroundColor: colors.bgSecondary,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxHeight: 120,
    borderWidth: 0.5,
    borderColor: 'transparent',
  },
  inputWrapFocused: {
    maxHeight: 160,
    borderColor: 'rgba(124,58,237,0.4)',
    backgroundColor: colors.bgSecondary,
  },
  input: { color: colors.text, fontSize: 15, lineHeight: 22 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, overflow: "hidden" },
  sendBtnDisabled: { opacity: 0.4 },
  sendGrad: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyWrap: { alignItems: "center", marginTop: 80, gap: 10 },
  emptyText: { color: colors.muted, fontSize: 14, textAlign: 'center', marginTop: 20 },
  disappearBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(245,158,11,0.1)', paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 0.5, borderTopColor: 'rgba(245,158,11,0.3)' },
  pinnedBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(245,158,11,0.08)', paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: 'rgba(245,158,11,0.2)' },
  pinnedLabel: { fontSize: 10, fontWeight: '700', color: '#f59e0b', textTransform: 'uppercase', letterSpacing: 0.5 },
  pinnedText: { fontSize: 13, color: colors.text },
  disappearText: { fontSize: 12, color: '#f59e0b', fontWeight: '600' },
  typingBanner: { paddingHorizontal: 16, paddingVertical: 6, backgroundColor: 'rgba(124,58,237,0.08)' },
  typingText: { fontSize: 12, color: colors.muted, fontStyle: 'italic' },
  smartRepliesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 0.5, borderTopColor: colors.border },
  smartReplyChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(124,58,237,0.15)', borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)' },
  smartReplyText: { fontSize: 13, color: colors.primary, fontWeight: '500' },
  micBtn: {
    width: 44, height: 44, borderRadius: 22, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)',
  },
  micBtnGrad: {
    flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 22,
  },

  // Voice recording active UI
  voiceActiveWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(224,36,94,0.08)',
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(224,36,94,0.2)',
  },
  voiceCancelBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(224,36,94,0.12)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(224,36,94,0.25)',
  },
  voiceMiddle: {
    flex: 1, alignItems: 'center', gap: 4,
  },
  voiceWaveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 24,
  },
  voiceBar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: '#e0245e',
    minHeight: 3,
  },
  voiceTimerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#e0245e',
    letterSpacing: 0.5,
  },
  voiceLockBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#7c3aed',
    alignItems: 'center', justifyContent: 'center',
  },
  voiceSendBtn: {
    width: 38, height: 38, borderRadius: 19, overflow: 'hidden',
  },
  voiceSendGrad: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
  },
  // Search
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.bgSecondary, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  searchInput: { flex: 1, color: colors.text, fontSize: 14 },
  searchResultsList: { maxHeight: 200, backgroundColor: colors.bgSecondary, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  searchResultRow: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  searchResultName: { fontSize: 12, color: colors.primary, fontWeight: '700', marginBottom: 2 },
  searchResultText: { fontSize: 13, color: colors.muted },
  // Forward
  forwardOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end', zIndex: 100 },
  forwardSheet: { backgroundColor: colors.bgCard || colors.bgSecondary, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: 360, paddingBottom: 30 },
  forwardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  forwardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  forwardRow: { paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  forwardRowName: { fontSize: 15, color: colors.text, fontWeight: '600' },
  // Forwarded label
  forwardedLabel: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2, alignSelf: 'flex-start' },
  forwardedText: { fontSize: 11, color: colors.dim, fontStyle: 'italic' },
  // Message footer
  msgFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 3, paddingHorizontal: 10, paddingBottom: 6, paddingTop: 2 },
  msgStatus: { fontSize: 11, color: 'rgba(255,255,255,0.45)' },
  msgStatusRead: { color: '#a5f3fc' },
  // Audio bubble (legacy, kept for safety)
  audioLabel: { fontSize: 13, color: colors.muted, fontStyle: 'italic' },
  // Reactions
  reactionPillMine: { backgroundColor: 'rgba(124,58,237,0.2)', borderColor: 'rgba(124,58,237,0.5)' },
  reactionActionsRow: { flexDirection: 'row', gap: 4, paddingHorizontal: 8, paddingBottom: 8, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 6 },
  reactionAction: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 4 },
  reactionActionText: { fontSize: 10, color: colors.muted },
  reactionOptionActive: { backgroundColor: 'rgba(124,58,237,0.3)', borderRadius: 12 },
  // Thread
  threadBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: 'rgba(124,58,237,0.1)' },
  threadBtnText: { fontSize: 11, color: colors.primary, fontWeight: '600' },
  threadPanel: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 0.5, borderTopColor: colors.border, maxHeight: 420 },
  threadPanelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 0.5 },
  threadPanelTitle: { fontSize: 15, fontWeight: '700' },
  threadOriginal: { margin: 12, borderRadius: 12, padding: 12 },
  threadOriginalName: { fontSize: 12, fontWeight: '700', marginBottom: 4 },
  threadReplyRow: { paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  threadReplyName: { fontSize: 11, fontWeight: '700', marginBottom: 2 },
  threadInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderTopWidth: 0.5 },
  // @mention autocomplete
  mentionList: { maxHeight: 180, borderTopWidth: 0.5, borderTopColor: colors.border },
  mentionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 0.5 },
  mentionAvatar: { width: 34, height: 34, borderRadius: 17 },
  mentionName: { fontSize: 14, fontWeight: '600' },
  mentionUsername: { fontSize: 12 },

  // Message action sheet
  asOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  asSheet: {
    backgroundColor: '#13131f',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingBottom: 36,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  asHandle: {
    width: 36, height: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10, marginBottom: 6,
  },
  asPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  asPreviewText: {
    fontSize: 13,
    color: colors.muted,
    flex: 1,
    fontStyle: 'italic',
  },
  asReactionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.07)',
    marginBottom: 6,
  },
  asReactionBtn: {
    width: 44, height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  asReactionBtnActive: {
    backgroundColor: 'rgba(124,58,237,0.25)',
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  asReactionEmoji: { fontSize: 24 },
  asRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  asIconWrap: {
    width: 38, height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  asRowText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
  },
  asCancelBtn: {
    marginHorizontal: 20,
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  asCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },

  // Options modal
  optionsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  optionsSheet: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 34,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  optionsHandle: {
    width: 36,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  optionsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
    textAlign: 'center',
    paddingVertical: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  optionsIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionsRowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  optionsRowSub: {
    fontSize: 12,
    color: colors.muted,
  },
  optionsBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  optionsBadgeOn: {
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderColor: 'rgba(16,185,129,0.3)',
  },
  optionsBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
    letterSpacing: 0.5,
  },
  optionsCancelBtn: {
    marginHorizontal: 20,
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  optionsCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },

  // Mute modal
  muteHeader: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    gap: 6,
  },
  muteIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(124,58,237,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    borderWidth: 0.5,
    borderColor: 'rgba(124,58,237,0.25)',
  },
  muteTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  muteSub: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
  },
  muteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  muteRowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  muteRowSub: {
    fontSize: 12,
    color: colors.muted,
  },

  // Block modal
  blockHeader: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 24,
    gap: 8,
  },
  blockIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(224,36,94,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(224,36,94,0.2)',
  },
  blockTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  blockSub: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 19,
  },
  blockInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 16,
  },
  blockInfoItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  blockInfoDivider: {
    width: 0.5,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  blockInfoText: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: '500',
  },
  blockConfirmBtn: {
    marginHorizontal: 20,
    marginBottom: 10,
    paddingVertical: 15,
    borderRadius: 14,
    backgroundColor: 'rgba(224,36,94,0.12)',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(224,36,94,0.3)',
  },
  blockConfirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#e0245e',
  },
});
