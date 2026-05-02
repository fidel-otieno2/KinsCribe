import React, { useEffect, useState } from "react";
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
} from "react-native";
import AppText from '../components/AppText';
import { useTranslation } from '../i18n';
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";

import { colors } from "../theme";
import Toast from '../components/Toast';
import useToast from '../hooks/useToast';

export default function StorybookGeneratorScreen({ navigation }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast, hide, success, error, info } = useToast();
  const [stories, setStories] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    api
      .get("/stories/family?limit=50")
      .then(({ data }) => setStories(data.stories || []))
      .catch(() => setStories([]))
      .finally(() => setLoading(false));
  }, []);

  const toggleSelect = (storyId) => {
    setSelected((prev) =>
      prev.includes(storyId)
        ? prev.filter((id) => id !== storyId)
        : [...prev, storyId],
    );
  };

  const generateStorybook = async () => {
    if (selected.length < 3) return info('Select at least 3 stories to generate a storybook');
    setGenerating(true);
    try {
      const res = await api.post("/storybooks", {
        story_ids: selected,
        title: `Family Memories ${new Date().getFullYear()}`,
      });
      success('Storybook generated! View it in Storybooks.');
      navigation.goBack();
    } catch (err) {
      error(err.response?.data?.error || 'Failed to generate storybook.');
    } finally {
      setGenerating(false);
    }
  };

  if (loading)
    return (
      <ActivityIndicator
        color={colors.primary}
        style={{ flex: 1, justifyContent: "center" }}
      />
    );

  return (
    <View style={s.container}>
      <Toast visible={toast.visible} type={toast.type} message={toast.message} onHide={hide} />
      <View style={s.header}>
        <AppText style={s.title}>Create Storybook</AppText>
        <AppText style={s.subtitle}>Select stories for your family book</AppText>
        <AppText style={s.count}>{selected.length} selected</AppText>
      </View>

      <FlatList
        data={stories}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={s.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={s.storyItem}
            onPress={() => toggleSelect(item.id)}
            activeOpacity={0.95}
          >
            <View style={s.card}>
              {/* Selection Checkbox */}
              <View style={s.selectCheckbox}>
                <View
                  style={[
                    s.checkbox,
                    selected.includes(item.id) && s.checkboxActive,
                  ]}
                >
                  {selected.includes(item.id) && (
                    <Ionicons name="checkmark" size={16} color="#fff" />
                  )}
                </View>
              </View>

              {/* Header */}
              <View style={s.header}>
                <View style={s.avatarRing}>
                  <View style={s.avatarInner}>
                    {item.author_avatar ? (
                      <Image
                        source={{ uri: item.author_avatar }}
                        style={s.avatarImg}
                      />
                    ) : (
                      <AppText style={s.avatarLetter}>
                        {item.author_name?.[0]?.toUpperCase() || "?"}
                      </AppText>
                    )}
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <AppText style={s.authorName}>{item.author_name}</AppText>
                  <View style={s.metaRow}>
                    {item.location && (
                      <>
                        <Ionicons name="location-outline" size={11} color={colors.muted} />
                        <AppText style={s.metaText}>{item.location}</AppText>
                        <AppText style={s.dot}>·</AppText>
                      </>
                    )}
                    <AppText style={s.metaText}>
                      {new Date(item.created_at).toLocaleDateString()}
                    </AppText>
                  </View>
                </View>
              </View>

              {/* Media */}
              {item.media_url && (
                <Image
                  source={{ uri: item.media_url }}
                  style={s.media}
                  resizeMode="cover"
                />
              )}

              {/* Caption */}
              {item.caption && (
                <View style={s.captionWrap}>
                  <AppText style={s.caption} numberOfLines={2}>
                    <AppText style={s.captionName}>{item.author_name} </AppText>
                    {item.caption}
                  </AppText>
                </View>
              )}

              {/* Stats */}
              <View style={s.stats}>
                {item.like_count > 0 && (
                  <View style={s.statItem}>
                    <Ionicons name="heart" size={14} color="#e11d48" />
                    <AppText style={s.statText}>{item.like_count}</AppText>
                  </View>
                )}
                {item.comment_count > 0 && (
                  <View style={s.statItem}>
                    <Ionicons name="chatbubble" size={14} color={colors.muted} />
                    <AppText style={s.statText}>{item.comment_count}</AppText>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
        )}
      />

      <LinearGradient colors={["#7c3aed", "#3b82f6"]} style={s.generateBtn}>
        <TouchableOpacity
          style={s.btnContent}
          onPress={generateStorybook}
          disabled={generating || selected.length < 3}
        >
          {generating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <AppText style={s.btnText}>
                Generate Storybook ({selected.length}/10)
              </AppText>
              <Ionicons name="book" size={20} color="#fff" />
            </>
          )}
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    padding: 20,
    alignItems: "center",
    backgroundColor: "rgba(124,58,237,0.05)",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.primary,
  },
  subtitle: {
    fontSize: 15,
    color: colors.muted,
    marginTop: 4,
  },
  count: {
    fontSize: 14,
    color: colors.text,
    marginTop: 8,
    fontWeight: "600",
  },
  list: {
    padding: 0,
    paddingBottom: 100,
  },
  storyItem: {
    marginBottom: 0,
  },
  card: {
    backgroundColor: colors.bg,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    position: "relative",
  },
  selectCheckbox: {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.5)",
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: {
    backgroundColor: "#10b981",
    borderColor: "#10b981",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  avatarRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    padding: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  avatarInner: {
    width: 34,
    height: 34,
    borderRadius: 17,
    overflow: "hidden",
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.bg,
  },
  avatarImg: {
    width: "100%",
    height: "100%",
  },
  avatarLetter: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
  authorName: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 1,
  },
  metaText: {
    fontSize: 11,
    color: colors.muted,
  },
  dot: {
    fontSize: 11,
    color: colors.dim,
  },
  media: {
    width: "100%",
    height: 400,
    backgroundColor: "#000",
  },
  captionWrap: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  caption: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
  captionName: {
    fontWeight: "700",
  },
  stats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.text,
  },
  generateBtn: {
    position: "absolute",
    bottom: 90,
    left: 16,
    right: 16,
    borderRadius: 16,
    overflow: "hidden",
  },
  btnContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
  },
  btnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
