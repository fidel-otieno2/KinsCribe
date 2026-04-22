import { useState, useEffect, useRef, useCallback } from "react";
import {
  View, FlatList, TouchableOpacity, StyleSheet,
  TextInput, KeyboardAvoidingView, Platform, Image,
  ActivityIndicator, StatusBar, Alert, Animated, ScrollView,
} from "react-native";
import AppText from '../components/AppText';
import { useTranslation } from '../i18n';
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
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

export default function ChatScreen({ route, navigation }) {
  const { t } = useTranslation();
  const { conversationId: initialConvId, title, avatar, type, otherUserId } = route.params;
  const { user } = useAuth();
  const [convId, setConvId] = useState(initialConvId);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [showReactions, setShowReactions] = useState(null);
  const [disappearing, setDisappearing] = useState(false);
  const [typingNames, setTypingNames] = useState([]);
  const [otherStatus, setOtherStatus] = useState(null);
  const [smartReplies, setSmartReplies] = useState([]);
  const [forwardMsg, setForwardMsg] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  // Thread view
  const [threadMsg, setThreadMsg] = useState(null);
  // @mention autocomplete
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionSuggestions, setMentionSuggestions] = useState([]);
  const [participants, setParticipants] = useState([]);
  // Double-tap tracking
  const lastTapRef = useRef({});
  // Voice note
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const recordTimerRef = useRef(null);
  const micScaleAnim = useRef(new Animated.Value(1)).current;
  const flatRef = useRef(null);
  const pollRef = useRef(null);
  const typingRef = useRef(null);

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
    pollRef.current = setInterval(() => fetchMessages(true), 3000);
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
    typingRef.current = setInterval(() => { pollTyping(); pollPresence(); }, 4000);
    return () => clearInterval(typingRef.current);
  }, [convId, otherUserId]);

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

  // Double-tap to react ❤️
  const handleBubbleTap = (item) => {
    const now = Date.now();
    const last = lastTapRef.current[item.id] || 0;
    if (now - last < 300) {
      reactToMessage(item.id, '❤️');
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

  const sendImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (result.canceled) return;
    setSending(true);
    try {
      const asset = result.assets[0];
      const formData = new FormData();
      formData.append("file", { uri: asset.uri, type: "image/jpeg", name: "photo.jpg" });
      if (replyTo) formData.append("reply_to_id", replyTo.id);
      const { data } = await api.post(`/messages/conversations/${convId}/messages`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMessages(prev => [...prev, data.message]);
      setReplyTo(null);
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {} finally { setSending(false); }
  };

  // ── Voice notes ──────────────────────────────────────────
  const startVoiceRecording = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) { Alert.alert('Permission needed', 'Microphone access is required'); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await rec.startAsync();
      setRecording(rec);
      setIsRecording(true);
      setRecordDuration(0);
      recordTimerRef.current = setInterval(() => setRecordDuration(d => d + 1), 1000);
      Animated.loop(
        Animated.sequence([
          Animated.timing(micScaleAnim, { toValue: 1.3, duration: 400, useNativeDriver: true }),
          Animated.timing(micScaleAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        ])
      ).start();
    } catch { Alert.alert('Error', 'Could not start recording'); }
  };

  const stopVoiceRecording = async (cancel = false) => {
    if (!recording) return;
    clearInterval(recordTimerRef.current);
    micScaleAnim.stopAnimation();
    micScaleAnim.setValue(1);
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      setIsRecording(false);
      if (cancel || !uri) return;
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

  // ── Forward message ───────────────────────────────────────
  const openForward = async (msg) => {
    setShowReactions(null);
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
    setShowReactions(null);
    try {
      await api.post(`/messages/messages/${msgId}/react`, { emoji });
      fetchMessages(true);
    } catch {}
  };

  const deleteMessage = (msgId, isMe) => {
    const options = isMe
      ? [
          { text: 'Delete for me', style: 'destructive', onPress: async () => {
            try { await api.delete(`/messages/messages/${msgId}`); setMessages(prev => prev.filter(m => m.id !== msgId)); } catch {}
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

  const renderMessage = ({ item, index }) => {
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

        <View style={{ maxWidth: '75%' }}>
          {/* Forwarded label */}
          {item.forwarded_from_id && (
            <View style={[cs.forwardedLabel, isMe && { alignSelf: 'flex-end' }]}>
              <Ionicons name="arrow-redo-outline" size={11} color={colors.dim} />
              <AppText style={cs.forwardedText}>Forwarded</AppText>
            </View>
          )}

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => handleBubbleTap(item)}
            onLongPress={() => {
              setShowReactions(showReactions === item.id ? null : item.id);
            }}
            delayLongPress={250}
          >
            <View style={[cs.bubble, isMe ? cs.bubbleMe : cs.bubbleThem]}>
              {showName && <AppText style={cs.senderName}>{item.sender_name}</AppText>}

              {/* Reply preview */}
              {item.reply_to_id && (
                <TouchableOpacity
                  style={cs.replyPreview}
                  onPress={() => {
                    const idx = messages.findIndex(m => m.id === item.reply_to_id);
                    if (idx >= 0) flatRef.current?.scrollToIndex({ index: idx, animated: true });
                  }}
                >
                  <View style={cs.replyBar} />
                  <View style={{ flex: 1 }}>
                    <AppText style={cs.replyName}>{item.reply_to_sender}</AppText>
                    <AppText style={cs.replyText} numberOfLines={1}>{item.reply_to_text || '📎 Media'}</AppText>
                  </View>
                </TouchableOpacity>
              )}

              {/* Image */}
              {item.media_url && item.media_type === 'image' && (
                <Image source={{ uri: item.media_url }} style={cs.msgImage} resizeMode="cover" />
              )}

              {/* Audio */}
              {item.media_url && item.media_type === 'audio' && (
                <View style={cs.audioBubble}>
                  <Ionicons name="mic" size={14} color={isMe ? '#c4b5fd' : colors.primary} />
                  <AppText style={[cs.audioLabel, isMe && { color: '#c4b5fd' }]}>Voice message</AppText>
                </View>
              )}

              {/* Text with @mention highlighting */}
              {item.text ? (
                <MentionText
                  text={item.text}
                  isMe={isMe}
                  style={[cs.msgText, isMe && cs.msgTextMe]}
                />
              ) : null}

              <View style={cs.msgFooter}>
                <AppText style={[cs.msgTime, isMe && cs.msgTimeMe]}>
                  {timeStr(item.created_at)}
                </AppText>
                {isMe && (
                  <AppText style={cs.msgStatus}>
                    {item.is_read ? '✓✓' : '✓'}
                  </AppText>
                )}
              </View>

              {/* Reactions */}
              {Object.keys(reactionGroups).length > 0 && (
                <View style={cs.reactionsRow}>
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
            </View>
          </TouchableOpacity>

          {/* Thread reply count */}
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

        {/* Reaction picker (long press) */}
        {showReactions === item.id && (
          <BlurView intensity={60} tint="dark" style={[cs.reactionPicker, isMe && cs.reactionPickerMe]}>
            <View style={cs.reactionPickerRow}>
              {REACTIONS.map(e => (
                <TouchableOpacity
                  key={e}
                  onPress={() => reactToMessage(item.id, e)}
                  style={[cs.reactionOption, myReaction === e && cs.reactionOptionActive]}
                >
                  <AppText style={{ fontSize: 24 }}>{e}</AppText>
                </TouchableOpacity>
              ))}
            </View>
            {/* Action row */}
            <View style={cs.reactionActionsRow}>
              <TouchableOpacity style={cs.reactionAction} onPress={() => { setReplyTo(item); setShowReactions(null); }}>
                <Ionicons name="return-down-back-outline" size={18} color={colors.muted} />
                <AppText style={cs.reactionActionText}>Reply</AppText>
              </TouchableOpacity>
              <TouchableOpacity style={cs.reactionAction} onPress={() => { setThreadMsg(item); setShowReactions(null); }}>
                <Ionicons name="chatbubbles-outline" size={18} color={colors.muted} />
                <AppText style={cs.reactionActionText}>Thread</AppText>
              </TouchableOpacity>
              <TouchableOpacity style={cs.reactionAction} onPress={() => { openForward(item); setShowReactions(null); }}>
                <Ionicons name="arrow-redo-outline" size={18} color={colors.muted} />
                <AppText style={cs.reactionActionText}>Forward</AppText>
              </TouchableOpacity>
              {isMe && (
                <TouchableOpacity style={cs.reactionAction} onPress={() => { deleteMessage(item.id, isMe); setShowReactions(null); }}>
                  <Ionicons name="trash-outline" size={18} color="#e0245e" />
                  <AppText style={[cs.reactionActionText, { color: '#e0245e' }]}>Delete</AppText>
                </TouchableOpacity>
              )}
            </View>
          </BlurView>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={cs.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <StatusBar barStyle="light-content" />

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
          <TouchableOpacity onPress={() => navigation.navigate('Family')}>
            <Ionicons name="information-circle-outline" size={24} color={colors.muted} />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => setShowSearch(s => !s)} style={{ padding: 4 }}>
          <Ionicons name="search-outline" size={20} color={colors.muted} />
        </TouchableOpacity>
        {type === "private" && (
          <TouchableOpacity onPress={() => Alert.alert(
            'Chat Options',
            '',
            [
              { text: disappearing ? 'Turn off disappearing messages' : 'Turn on disappearing messages (24h)', onPress: toggleDisappearing },
              { text: 'Mute notifications', onPress: () => Alert.alert('Muted', 'Notifications muted for this chat') },
              { text: 'Cancel', style: 'cancel' },
            ]
          )}>
            <Ionicons name="ellipsis-vertical" size={22} color={colors.muted} />
          </TouchableOpacity>
        )}
      </LinearGradient>

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
          keyExtractor={i => String(i.id)}
          renderItem={renderMessage}
          contentContainerStyle={cs.messagesList}
          showsVerticalScrollIndicator={false}
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
      <View style={cs.inputRow}>
        <TouchableOpacity onPress={sendImage} style={cs.inputAction}>
          <Ionicons name="image-outline" size={24} color={colors.muted} />
        </TouchableOpacity>

        {isRecording ? (
          <View style={cs.voiceRecordingRow}>
            <Animated.View style={{ transform: [{ scale: micScaleAnim }] }}>
              <Ionicons name="mic" size={20} color="#e0245e" />
            </Animated.View>
            <AppText style={cs.voiceTimer}>
              {String(Math.floor(recordDuration / 60)).padStart(2, '0')}:{String(recordDuration % 60).padStart(2, '0')}
            </AppText>
            <AppText style={cs.voiceHint}>Release to send · Slide left to cancel</AppText>
          </View>
        ) : (
          <View style={cs.inputWrap}>
            <TextInput
              style={cs.input}
              placeholder={t('message_placeholder')}
              placeholderTextColor={colors.dim}
              value={text}
              onChangeText={handleTextChange}
              multiline
              maxLength={1000}
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
          <TouchableOpacity
            style={cs.micBtn}
            onPressIn={startVoiceRecording}
            onPressOut={() => stopVoiceRecording(false)}
            delayLongPress={100}
          >
            <Ionicons name={isRecording ? 'stop-circle' : 'mic-outline'} size={26} color={isRecording ? '#e0245e' : colors.muted} />
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const cs = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", paddingTop: 52, paddingBottom: 12, paddingHorizontal: 16, gap: 12, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  backBtn: { padding: 4 },
  headerAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  headerSub: { fontSize: 12, color: colors.muted },
  messagesList: { padding: 16, paddingBottom: 8 },
  msgRow: { flexDirection: "row", marginBottom: 4, alignItems: "flex-end", gap: 6 },
  msgRowMe: { flexDirection: "row-reverse" },
  avatarCol: { width: 32 },
  avatarFallback: { backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  bubble: { maxWidth: "75%", borderRadius: 18, padding: 10, paddingHorizontal: 14 },
  bubbleMe: { backgroundColor: "#7c3aed", borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: colors.bgSecondary, borderBottomLeftRadius: 4 },
  senderName: { fontSize: 12, fontWeight: "700", color: "#a78bfa", marginBottom: 3 },
  replyPreview: { flexDirection: "row", gap: 6, backgroundColor: "rgba(0,0,0,0.2)", borderRadius: 8, padding: 6, marginBottom: 6 },
  replyBar: { width: 3, backgroundColor: "#a78bfa", borderRadius: 2 },
  replyName: { fontSize: 11, fontWeight: "700", color: "#a78bfa" },
  replyText: { fontSize: 11, color: colors.muted },
  msgImage: { width: 200, height: 200, borderRadius: 12, marginBottom: 4 },
  msgText: { fontSize: 15, color: colors.text, lineHeight: 21 },
  msgTextMe: { color: "#fff" },
  msgTime: { fontSize: 10, color: colors.dim, marginTop: 4, textAlign: "right" },
  msgTimeMe: { color: "rgba(255,255,255,0.6)" },
  reactionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 },
  reactionPill: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 12, paddingHorizontal: 6, paddingVertical: 2, gap: 2 },
  reactionEmoji: { fontSize: 14 },
  reactionCount: { fontSize: 11, color: colors.muted },
  msgActions: { padding: 4, alignSelf: "center" },
  reactionPicker: { position: "absolute", bottom: 40, left: 40, borderRadius: 20, overflow: "hidden", zIndex: 10 },
  reactionPickerMe: { left: "auto", right: 40 },
  reactionPickerRow: { flexDirection: "row", padding: 8, gap: 4 },
  reactionOption: { padding: 6 },
  replyBar2: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.bgSecondary, paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 0.5, borderTopColor: colors.border },
  replyBarLine: { width: 3, height: "100%", backgroundColor: colors.primary, borderRadius: 2 },
  replyBarName: { fontSize: 12, fontWeight: "700", color: colors.primary },
  replyBarText: { fontSize: 12, color: colors.muted },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 0.5, borderTopColor: colors.border, backgroundColor: colors.bg },
  inputAction: { padding: 6, paddingBottom: 8 },
  inputWrap: { flex: 1, backgroundColor: colors.bgSecondary, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 8, maxHeight: 100 },
  input: { color: colors.text, fontSize: 15, maxHeight: 80 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, overflow: "hidden" },
  sendBtnDisabled: { opacity: 0.4 },
  sendGrad: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyWrap: { alignItems: "center", marginTop: 80, gap: 10 },
  emptyText: { color: colors.muted, fontSize: 14, textAlign: 'center', marginTop: 20 },
  disappearBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(245,158,11,0.1)', paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 0.5, borderTopColor: 'rgba(245,158,11,0.3)' },
  disappearText: { fontSize: 12, color: '#f59e0b', fontWeight: '600' },
  typingBanner: { paddingHorizontal: 16, paddingVertical: 6, backgroundColor: 'rgba(124,58,237,0.08)' },
  typingText: { fontSize: 12, color: colors.muted, fontStyle: 'italic' },
  smartRepliesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 0.5, borderTopColor: colors.border },
  smartReplyChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(124,58,237,0.15)', borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)' },
  smartReplyText: { fontSize: 13, color: colors.primary, fontWeight: '500' },
  // Voice
  micBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  voiceRecordingRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(224,36,94,0.08)', borderRadius: 22, paddingHorizontal: 14, paddingVertical: 8 },
  voiceTimer: { fontSize: 14, color: '#e0245e', fontWeight: '700', minWidth: 40 },
  voiceHint: { fontSize: 11, color: colors.dim, flex: 1 },
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
  msgFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 4 },
  msgStatus: { fontSize: 11, color: 'rgba(255,255,255,0.6)' },
  // Audio bubble
  audioBubble: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  audioLabel: { fontSize: 13, color: colors.muted, fontStyle: 'italic' },
  // Reactions
  reactionPillMine: { backgroundColor: 'rgba(124,58,237,0.25)', borderWidth: 1, borderColor: 'rgba(124,58,237,0.5)' },
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
});
