import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import GlassCard from "../components/GlassCard";
import { colors } from "../theme";

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    padding: 24,
    paddingTop: 70,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#7c3aed",
    backgroundColor: "rgba(124,58,237,0.1)",
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 20,
  },
  typeTabs: {
    flexDirection: "row",
    gap: 8,
    marginTop: 24,
    paddingHorizontal: 20,
  },
  typeTab: {
    flex: 1,
    backgroundColor: "rgba(30,41,59,0.6)",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border2,
  },
  typeTabActive: {
    backgroundColor: "#7c3aed",
    borderColor: "#7c3aed",
  },
  typeTabText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.muted,
  },
  typeTabTextActive: {
    color: "#fff",
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  glassContent: {
    marginTop: 20,
    paddingBottom: 20,
  },
  textarea: {
    minHeight: 220,
    borderRadius: 16,
    padding: 20,
    fontSize: 16,
    lineHeight: 24,
    textAlignVertical: "top",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    color: colors.text,
  },
  previewContainer: {
    alignItems: "center",
    marginTop: 16,
  },
  mediaPreview: {
    width: 280,
    height: 200,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  recordBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#7c3aed",
    borderRadius: 50,
    paddingHorizontal: 24,
    paddingVertical: 16,
    marginTop: 16,
  },
  privacySection: {
    marginTop: 24,
    paddingBottom: 24,
  },
  privacyTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.muted,
    marginBottom: 12,
  },
  privacyTabs: {
    flexDirection: "row",
    gap: 8,
  },
  privacyTab: {
    flex: 1,
    backgroundColor: "rgba(30,41,59,0.6)",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border2,
  },
  privacyTabActive: {
    backgroundColor: "#10b981",
    borderColor: "#10b981",
  },
  postBtn: {
    marginTop: 24,
    marginBottom: 40,
  },
});

export default function CreateScreen({ navigation }) {
  const { user } = useAuth();
  const [type, setType] = useState("text");
  const [form, setForm] = useState({
    text: "",
    story_date: new Date().toISOString().split("T")[0],
    privacy: "family",
  });
  const [mediaUri, setMediaUri] = useState(null);
  const [loading, setLoading] = useState(false);

  const pickMedia = useCallback(async (mediaType) => {
    console.log("=== pickMedia START ===", mediaType);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    console.log("Permission result:", permission);

    if (!permission.granted) {
      Alert.alert(
        "Permission Required",
        "Please enable gallery access in settings",
      );
      return;
    }

    console.log("Opening gallery...");
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes:
        mediaType === "video"
          ? ImagePicker.MediaType.Video
          : ImagePicker.MediaType.Image,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    console.log("Picker result:", result);

    if (!result.canceled) {
      console.log("Selected media:", result.assets[0].uri);
      setMediaUri(result.assets[0].uri);
    } else {
      console.log("Picker canceled");
    }
    console.log("=== pickMedia END ===");
  }, []);

  const handlePost = async () => {
    if (!form.text.trim() && !mediaUri) {
      Alert.alert("No Content", "Add text or media to your story");
      return;
    }

    console.log("Posting story...");
    setLoading(true);
    try {
      const data = new FormData();
      data.append("text", form.text);
      data.append("story_date", form.story_date);
      data.append("privacy", form.privacy);
      if (mediaUri) {
        data.append("media", {
          uri: mediaUri,
          type: type === "video" ? "video/mp4" : "image/jpeg",
          name: "story_media",
        });
      }

      const res = await api.post("/api/stories", data, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      console.log("Post response:", res.data);

      navigation.navigate("AIProcessing", { storyId: res.data.story_id });
      setMediaUri(null);
      setForm({ ...form, text: "" });
    } catch (err) {
      console.error("Post error:", err.response?.data || err.message);
      Alert.alert("Post Failed", err.response?.data?.error || "Network error");
    } finally {
      setLoading(false);
    }
  };

  const typeConfig = {
    image: {
      icon: "📸",
      title: "Photo",
      render: () => (
        <View>
          <TouchableOpacity
            style={[s.recordBtn, { elevation: 5 }]}
            onPress={() => {
              console.log("*** PHOTO BUTTON PRESSED ***");
              pickMedia("image");
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="image-outline" size={24} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "700", marginLeft: 8 }}>
              Pick Photo
            </Text>
          </TouchableOpacity>
          {mediaUri && (
            <View style={s.previewContainer}>
              <Image source={{ uri: mediaUri }} style={s.mediaPreview} />
            </View>
          )}
        </View>
      ),
    },
    text: {
      icon: "✍️",
      title: "Text",
      render: () => (
        <TextInput
          style={s.textarea}
          placeholder="Tell your family story..."
          placeholderTextColor={colors.muted}
          multiline
          value={form.text}
          onChangeText={(text) => setForm({ ...form, text })}
        />
      ),
    },
    audio: {
      icon: "🎙️",
      title: "Voice",
      render: () => (
        <View>
          <TouchableOpacity
            style={[s.recordBtn, { elevation: 5 }]}
            onPress={() => pickMedia("audio")}
            activeOpacity={0.7}
          >
            <Ionicons name="mic-outline" size={24} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "700", marginLeft: 8 }}>
              Record Voice
            </Text>
          </TouchableOpacity>
          {mediaUri && (
            <View style={s.previewContainer}>
              <View style={s.mediaPreview}>
                <Ionicons name="musical-notes" size={48} color={colors.muted} />
                <Text style={{ color: colors.muted, marginTop: 8 }}>
                  Audio Ready
                </Text>
              </View>
            </View>
          )}
        </View>
      ),
    },
    video: {
      icon: "🎬",
      title: "Video",
      render: () => (
        <View>
          <TouchableOpacity
            style={[s.recordBtn, { elevation: 5 }]}
            onPress={() => pickMedia("video")}
            activeOpacity={0.7}
          >
            <Ionicons name="videocam-outline" size={24} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "700", marginLeft: 8 }}>
              Record Video
            </Text>
          </TouchableOpacity>
          {mediaUri && (
            <View style={s.previewContainer}>
              <View style={s.mediaPreview}>
                <Ionicons name="play-circle" size={48} color={colors.muted} />
                <Text style={{ color: colors.muted, marginTop: 8 }}>
                  Video Ready
                </Text>
              </View>
            </View>
          )}
        </View>
      ),
    },
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Create Story</Text>
      </View>

      <ScrollView style={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.typeTabs}>
          {Object.entries(typeConfig).map(([t, config]) => (
            <TouchableOpacity
              key={t}
              style={[s.typeTab, t === type && s.typeTabActive]}
              onPress={() => {
                setType(t);
                setMediaUri(null);
              }}
            >
              <Text style={[s.typeTabText, t === type && s.typeTabTextActive]}>
                {config.icon} {config.title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <GlassCard style={s.glassContent}>
          {typeConfig[type].render()}
        </GlassCard>

        <View style={s.privacySection}>
          <Text style={s.privacyTitle}>Privacy</Text>
          <View style={s.privacyTabs}>
            {["private", "family", "public"].map((p) => (
              <TouchableOpacity
                key={p}
                style={[s.privacyTab, form.privacy === p && s.privacyTabActive]}
                onPress={() => setForm({ ...form, privacy: p })}
              >
                <Text
                  style={{
                    fontWeight: "600",
                    color: form.privacy === p ? "#fff" : colors.muted,
                  }}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <LinearGradient colors={["#7c3aed", "#3b82f6"]} style={s.postBtn}>
          <TouchableOpacity
            style={{
              paddingVertical: 18,
              alignItems: "center",
              borderRadius: 16,
            }}
            onPress={handlePost}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>
                Post Story
              </Text>
            )}
          </TouchableOpacity>
        </LinearGradient>
      </ScrollView>
    </View>
  );
}
