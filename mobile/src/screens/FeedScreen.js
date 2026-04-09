import { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  ScrollView,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import api from "../api/axios";
import StoryCard from "../components/StoryCard";
import { colors, radius } from "../theme";
import { Ionicons } from "@expo/vector-icons";

export default function FeedScreen({ navigation }) {
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [visibleIndex, setVisibleIndex] = useState(0);

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) setVisibleIndex(viewableItems[0].index ?? 0);
  }).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;
  const [type, setType] = useState("text");
  const [form, setForm] = useState({
    title: "",
    content: "",
    privacy: "family",
    story_date: "",
  });
  const [file, setFile] = useState(null);
  const [posting, setPosting] = useState(false);

  const fetchFeed = useCallback(async () => {
    try {
      const { data } = await api.get("/stories/feed");
      setStories(data.stories);
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  const pickMedia = async () => {
    const result = await (type === "video"
      ? ImagePicker.launchImageLibraryAsync({ mediaTypes: ["videos"] })
      : DocumentPicker.getDocumentAsync({ type: "audio/*" }));
    if (!result.canceled) setFile(result.assets?.[0] || result);
  };

  const handlePost = async () => {
    if (!form.title) return;
    setPosting(true);
    try {
      const fd = new FormData();
      fd.append("title", form.title);
      fd.append("content", form.content);
      fd.append("privacy", form.privacy);
      fd.append("story_date", form.story_date);
      if (file) {
        fd.append("file", {
          uri: file.uri,
          name: file.name || "media",
          type: file.mimeType || "video/mp4",
        });
      }
      const { data } = await api.post("/stories/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const storyId = data.story?.id;
      setShowModal(false);
      setForm({ title: "", content: "", privacy: "family", story_date: "" });
      setFile(null);
      fetchFeed();
      if (storyId) navigation.navigate("AIProcessing", { storyId });
    } catch (err) {
      console.log("Post error:", err);
    } finally {
      setPosting(false);
    }
  };

  return (
    <View style={s.container}>
        <View style={s.header}>
        <Text style={s.headerTitle}>Family Feed</Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <TouchableOpacity
            style={s.iconBtn}
            onPress={() => navigation.navigate("Notifications")}
          >
            <Ionicons
              name="notifications-outline"
              size={22}
              color={colors.text}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={s.iconBtn}
            onPress={() => navigation.navigate("FeedAI")}
          >
            <Ionicons name="sparkles" size={22} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={s.addBtn} onPress={() => setShowModal(true)}>
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={s.addBtnText}>Story</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={stories}
          keyExtractor={(i) => String(i.id)}
          renderItem={({ item, index }) => (
            <StoryCard
              story={item}
              onUpdate={fetchFeed}
              isVisible={index === visibleIndex}
            />
          )}
          contentContainerStyle={{ paddingBottom: 16 }}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          ListEmptyComponent={
            <Text style={s.empty}>📖 No stories yet. Be the first!</Text>
          }
        />
      )}

      <Modal visible={showModal} animationType="slide" transparent>
        <View style={s.overlay}>
          <ScrollView style={s.modal} contentContainerStyle={{ padding: 24 }}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Share a Story</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Text style={{ color: colors.muted, fontSize: 20 }}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={s.typeTabs}>
              {["text", "audio", "video"].map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[s.typeTab, type === t && s.typeTabActive]}
                  onPress={() => setType(t)}
                >
                  <Text
                    style={[s.typeTabText, type === t && { color: "#fff" }]}
                  >
                    {t === "text"
                      ? "✍️ Text"
                      : t === "audio"
                        ? "🎙️ Audio"
                        : "🎬 Video"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.label}>Title</Text>
            <TextInput
              style={s.input}
              placeholder="Give your story a title..."
              placeholderTextColor={colors.dim}
              value={form.title}
              onChangeText={(v) => setForm({ ...form, title: v })}
            />

            {type === "text" && (
              <>
                <Text style={s.label}>Story</Text>
                <TextInput
                  style={[s.input, { height: 120, textAlignVertical: "top" }]}
                  multiline
                  placeholder="Write your story here..."
                  placeholderTextColor={colors.dim}
                  value={form.content}
                  onChangeText={(v) => setForm({ ...form, content: v })}
                />
              </>
            )}

            {(type === "audio" || type === "video") && (
              <TouchableOpacity style={s.uploadZone} onPress={pickMedia}>
                <Text style={{ color: colors.muted, fontSize: 13 }}>
                  {file
                    ? file.name || "File selected ✓"
                    : `Tap to pick ${type} file`}
                </Text>
              </TouchableOpacity>
            )}

            <Text style={s.label}>Privacy</Text>
            <View style={s.typeTabs}>
              {["family", "private", "public"].map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[s.typeTab, form.privacy === p && s.typeTabActive]}
                  onPress={() => setForm({ ...form, privacy: p })}
                >
                  <Text
                    style={[
                      s.typeTabText,
                      form.privacy === p && { color: "#fff" },
                    ]}
                  >
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={s.btn}
              onPress={handlePost}
              disabled={posting}
            >
              {posting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.btnText}>Post Story</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    paddingTop: 52,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 24, fontWeight: "800", color: colors.text },
  iconBtn: {
    padding: 8,
    backgroundColor: "rgba(30,41,59,0.6)",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border2,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#7c3aed",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  empty: {
    textAlign: "center",
    color: colors.dim,
    marginTop: 60,
    fontSize: 15,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "flex-end",
  },
  modal: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  typeTabs: { flexDirection: "row", gap: 8, marginBottom: 16 },
  typeTab: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border2,
  },
  typeTabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  typeTabText: { fontSize: 12, color: colors.muted, fontWeight: "600" },
  label: { fontSize: 13, color: colors.muted, marginBottom: 6 },
  input: {
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: colors.border2,
    borderRadius: 10,
    padding: 13,
    color: colors.text,
    fontSize: 14,
    marginBottom: 16,
  },
  uploadZone: {
    borderWidth: 2,
    borderColor: colors.border2,
    borderStyle: "dashed",
    borderRadius: 12,
    padding: 32,
    alignItems: "center",
    marginBottom: 16,
  },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginTop: 8,
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
