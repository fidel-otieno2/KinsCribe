import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Video } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../theme";

export default function StoryCard({ story, isVisible }) {
  const [liked, setLiked] = useState(false);
  const [muted, setMuted] = useState(false);

  const isVideo = story.media_type === "video";
  const isAudio = story.media_type === "audio";
  const isImage = story.media_type === "image";

  return (
    <View style={s.card}>
      
      {/* HEADER */}
      <View style={s.header}>
        <View style={s.avatarRing}>
          <Image source={{ uri: story.author_avatar }} style={s.avatar} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={s.username}>{story.author_name}</Text>
          <Text style={s.meta}>
            {story.location || "Family Memory"} • {story.story_date || ""}
          </Text>
        </View>

        <Ionicons name="ellipsis-horizontal" size={20} color="#fff" />
      </View>

      {/* MEDIA */}
      <View style={s.mediaWrap}>
        {isImage && (
          <Image source={{ uri: story.media_url }} style={s.media} />
        )}

        {isVideo && (
          <Video
            source={{ uri: story.media_url }}
            style={s.media}
            shouldPlay={isVisible}
            isLooping
            isMuted={muted}
          />
        )}

        {/* Gradient Overlay */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.7)"]}
          style={s.overlay}
        />

        {/* MUTE BUTTON */}
        {isVideo && (
          <TouchableOpacity
            style={s.muteBtn}
            onPress={() => setMuted(!muted)}
          >
            <Ionicons
              name={muted ? "volume-mute" : "volume-high"}
              size={20}
              color="#fff"
            />
          </TouchableOpacity>
        )}

        {/* 🎵 MUSIC PILL */}
        {story.music_name && (
          <View style={s.musicPill}>
            <Ionicons name="musical-notes" size={14} color="#fff" />
            <Text style={s.musicText}>{story.music_name}</Text>
          </View>
        )}
      </View>

      {/* ACTIONS */}
      <View style={s.actions}>
        <TouchableOpacity onPress={() => setLiked(!liked)}>
          <Ionicons
            name={liked ? "heart" : "heart-outline"}
            size={26}
            color={liked ? "#ff2d55" : "#fff"}
          />
        </TouchableOpacity>

        <Ionicons name="chatbubble-outline" size={24} color="#fff" />
        <Ionicons name="paper-plane-outline" size={24} color="#fff" />
        <View style={{ flex: 1 }} />
        <Ionicons name="bookmark-outline" size={24} color="#fff" />
      </View>

      {/* TEXT CONTENT */}
      <View style={s.textWrap}>
        <Text style={s.likes}>128 likes</Text>

        <Text style={s.caption}>
          <Text style={s.bold}>{story.author_name} </Text>
          {story.title}
        </Text>

        {/* AI SUMMARY */}
        {story.summary && (
          <View style={s.aiBox}>
            <Ionicons name="sparkles" size={12} color="#a78bfa" />
            <Text style={s.aiText}>{story.summary}</Text>
          </View>
        )}

        {/* TAGS */}
        <Text style={s.tags}>
          {story.tags?.map((t) => `#${t}`).join(" ")}
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    marginBottom: 20,
    backgroundColor: "#000",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
  },

  avatarRing: {
    borderWidth: 2,
    borderColor: "#7c3aed",
    borderRadius: 25,
    padding: 2,
    marginRight: 10,
  },

  avatar: {
    width: 35,
    height: 35,
    borderRadius: 20,
  },

  username: {
    color: "#fff",
    fontWeight: "bold",
  },

  meta: {
    color: "#aaa",
    fontSize: 11,
  },

  mediaWrap: {
    width: "100%",
    height: 420,
    position: "relative",
  },

  media: {
    width: "100%",
    height: "100%",
  },

  overlay: {
    position: "absolute",
    bottom: 0,
    height: 120,
    width: "100%",
  },

  muteBtn: {
    position: "absolute",
    bottom: 15,
    right: 15,
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 8,
    borderRadius: 20,
  },

  musicPill: {
    position: "absolute",
    bottom: 15,
    left: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },

  musicText: {
    color: "#fff",
    fontSize: 12,
  },

  actions: {
    flexDirection: "row",
    padding: 10,
    gap: 15,
  },

  textWrap: {
    paddingHorizontal: 12,
  },

  likes: {
    color: "#fff",
    fontWeight: "bold",
  },

  caption: {
    color: "#fff",
    marginTop: 4,
  },

  bold: {
    fontWeight: "bold",
  },

  aiBox: {
    flexDirection: "row",
    gap: 6,
    marginTop: 6,
    backgroundColor: "#1a0a2e",
    padding: 6,
    borderRadius: 8,
  },

  aiText: {
    color: "#ccc",
    fontSize: 12,
  },

  tags: {
    color: "#60a5fa",
    marginTop: 4,
  },
});