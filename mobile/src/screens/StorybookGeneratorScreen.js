import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import GlassCard from "../components/GlassCard";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import StoryCard from "../components/StoryCard";
import { colors } from "../theme";

export default function StorybookGeneratorScreen({ navigation }) {
  const { user } = useAuth();
  const [stories, setStories] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    api
      .get("/stories/family?limit=50")
      .then(({ data }) => setStories(data.stories))
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
    if (selected.length < 3) return Alert.alert("Select at least 3 stories");
    setGenerating(true);
    try {
      const res = await api.post("/storybooks", {
        story_ids: selected,
        title: `Family Memories ${new Date().getFullYear()}`,
      });
      Alert.alert("Success", "Storybook generated! View in Storybooks.");
      navigation.goBack();
    } catch (err) {
      Alert.alert("Error", err.response?.data?.error || "Failed to generate.");
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
      <View style={s.header}>
        <Text style={s.title}>Create Storybook</Text>
        <Text style={s.subtitle}>Select stories for your family book</Text>
        <Text style={s.count}>{selected.length} selected</Text>
      </View>

      <FlatList
        data={stories}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={s.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={s.storyItem}
            onPress={() => toggleSelect(item.id)}
          >
            <GlassCard style={s.storyCard}>
              <View style={s.storyHeader}>
                <View
                  style={[
                    s.selectIcon,
                    selected.includes(item.id) && s.selectIconActive,
                  ]}
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={
                      selected.includes(item.id) ? "#10b981" : "transparent"
                    }
                  />
                </View>
                <StoryCard story={item} />
              </View>
            </GlassCard>
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
              <Text style={s.btnText}>
                Generate Storybook ({selected.length}/10)
              </Text>
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
    padding: 16,
    paddingBottom: 100,
  },
  storyItem: {
    marginBottom: 12,
  },
  storyCard: {
    padding: 12,
  },
  storyHeader: {
    flexDirection: "row",
  },
  selectIcon: {
    marginRight: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(16,185,129,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  selectIconActive: {
    backgroundColor: "#10b98120",
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
