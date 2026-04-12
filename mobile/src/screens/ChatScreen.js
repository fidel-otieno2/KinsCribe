import { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, KeyboardAvoidingView, Platform, Image,
  ActivityIndicator, StatusBar, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import * as ImagePicker from "expo-image-picker";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { colors, radius } from "../theme";
import { uploadMedia } from "../api/upload";

function timeStr(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function Avatar({ uri, name, size = 32 }) {
  return uri ? (
    <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
  ) : (
    <View style={[cs.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={{ color: "#fff", fontWeight: "700", fontSize: size * 0.38 }}>{name?.[0]?.toUpperCase() || "?"}</Text>
    </View>
  );
}

const REACTIONS = ["❤️", "😂", "😮", "😢", "👏", "🔥"];

export default function ChatScreen({ route, navigation }) {
  const { conversationId, title, avatar, type, otherUserId } = route.params;
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [showReactions, setShowReactions] = useState(null); // message id
  const flatRef = useRef(null);
  const pollRef = useRef(null);

  const fetchMessages = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await api.get(`/messages/conversations/${conversationId}/messages`);
      setMessages(data.messages || []);
    } catch {} finally { setLoading(false); }
  }, [conversationId]);

  useEffect(() => {
    fetchMessages();
    // Poll every 3 seconds for new messages
    pollRef.current = setInterval(() => fetchMessages(true), 3000);
    return () => clearInterval(pollRef.current);
  }, [fetchMessages]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const sendMessage = async () => {
    if (!text.trim() && !sending) return;
    const msgText = text.trim();
    setText("");
    setSending(true);
    try {
      const payload = { text: msgText };
      if (replyTo) payload.reply_to_id = replyTo.id;
      const { data } = await api.post(`/messages/conversations/${conversationId}/messages`, payload);
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
      const { data } = await api.post(`/messages/conversations/${conversationId}/messages`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMessages(prev => [...prev, data.message]);
      setReplyTo(null);
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {} finally { setSending(false); }
  };

  const reactToMessage = async (msgId, emoji) => {
    setShowReactions(null);
    try {
      await api.post(`/messages/messages/${msgId}/react`, { emoji });
      fetchMessages(true);
    } catch {}
  };

  const deleteMessage = (msgId) => {
    Alert.alert("Delete Message", "Delete this message?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try {
          await api.delete(`/messages/messages/${msgId}`);
          setMessages(prev => prev.filter(m => m.id !== msgId));
        } catch {}
      }},
    ]);
  };

  const renderMessage = ({ item, index }) => {
    const isMe = item.sender_id === user?.id;
    const showAvatar = !isMe && (index === 0 || messages[index - 1]?.sender_id !== item.sender_id);
    const showName = type === "family" && !isMe && showAvatar;

    // Group reactions by emoji
    const reactionGroups = {};
    (item.reactions || []).forEach(r => {
      reactionGroups[r.emoji] = (reactionGroups[r.emoji] || 0) + 1;
    });

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

        <View style={[cs.bubble, isMe ? cs.bubbleMe : cs.bubbleThem]}>
          {showName && <Text style={cs.senderName}>{item.sender_name}</Text>}

          {/* Reply preview */}
          {item.reply_to_id && (
            <View style={cs.replyPreview}>
              <View style={cs.replyBar} />
              <View>
                <Text style={cs.replyName}>{item.reply_to_sender}</Text>
                <Text style={cs.replyText} numberOfLines={1}>{item.reply_to_text}</Text>
              </View>
            </View>
          )}

          {/* Media */}
          {item.media_url && item.media_type === "image" && (
            <Image source={{ uri: item.media_url }} style={cs.msgImage} resizeMode="cover" />
          )}

          {/* Text */}
          {item.text ? <Text style={[cs.msgText, isMe && cs.msgTextMe]}>{item.text}</Text> : null}

          <Text style={[cs.msgTime, isMe && cs.msgTimeMe]}>
            {timeStr(item.created_at)}{isMe && (item.is_read ? " ✓✓" : " ✓")}
          </Text>

          {/* Reactions */}
          {Object.keys(reactionGroups).length > 0 && (
            <View style={cs.reactionsRow}>
              {Object.entries(reactionGroups).map(([emoji, count]) => (
                <TouchableOpacity key={emoji} style={cs.reactionPill} onPress={() => reactToMessage(item.id, emoji)}>
                  <Text style={cs.reactionEmoji}>{emoji}</Text>
                  {count > 1 && <Text style={cs.reactionCount}>{count}</Text>}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Long press actions */}
        <TouchableOpacity
          style={cs.msgActions}
          onPress={() => setShowReactions(showReactions === item.id ? null : item.id)}
          onLongPress={() => {
            if (isMe) deleteMessage(item.id);
            else setReplyTo(item);
          }}
        >
          <Ionicons name="ellipsis-horizontal" size={14} color={colors.dim} />
        </TouchableOpacity>

        {/* Reaction picker */}
        {showReactions === item.id && (
          <BlurView intensity={40} tint="dark" style={[cs.reactionPicker, isMe && cs.reactionPickerMe]}>
            <View style={cs.reactionPickerRow}>
              {REACTIONS.map(e => (
                <TouchableOpacity key={e} onPress={() => reactToMessage(item.id, e)} style={cs.reactionOption}>
                  <Text style={{ fontSize: 22 }}>{e}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={() => { setReplyTo(item); setShowReactions(null); }} style={cs.reactionOption}>
                <Ionicons name="return-down-back" size={20} color={colors.muted} />
              </TouchableOpacity>
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
          <Text style={cs.headerTitle}>{title}</Text>
          <Text style={cs.headerSub}>{type === "family" ? "Family Group" : "Active recently"}</Text>
        </TouchableOpacity>

        {type === "family" && (
          <TouchableOpacity onPress={() => navigation.navigate("Family")}>
            <Ionicons name="information-circle-outline" size={24} color={colors.muted} />
          </TouchableOpacity>
        )}
      </LinearGradient>

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
              <Text style={cs.emptyText}>No messages yet. Say hello! 👋</Text>
            </View>
          }
        />
      )}

      {/* Reply preview bar */}
      {replyTo && (
        <View style={cs.replyBar2}>
          <View style={cs.replyBarLine} />
          <View style={{ flex: 1 }}>
            <Text style={cs.replyBarName}>{replyTo.sender_name}</Text>
            <Text style={cs.replyBarText} numberOfLines={1}>{replyTo.text || "Media"}</Text>
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

        <View style={cs.inputWrap}>
          <TextInput
            style={cs.input}
            placeholder="Message..."
            placeholderTextColor={colors.dim}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={1000}
          />
        </View>

        <TouchableOpacity
          style={[cs.sendBtn, (!text.trim() && !sending) && cs.sendBtnDisabled]}
          onPress={sendMessage}
          disabled={!text.trim() || sending}
        >
          {sending
            ? <ActivityIndicator size="small" color="#fff" />
            : <LinearGradient colors={["#7c3aed", "#3b82f6"]} style={cs.sendGrad}>
                <Ionicons name="send" size={18} color="#fff" />
              </LinearGradient>}
        </TouchableOpacity>
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
  emptyText: { color: colors.muted, fontSize: 14 },
});
