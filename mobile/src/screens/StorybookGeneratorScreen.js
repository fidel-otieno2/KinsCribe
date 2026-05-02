import React, { useEffect, useState } from "react";
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
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

// Import PostCard from FeedScreen
import { PostCard } from './FeedScreen';

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
          <View style={s.postWrapper}>
            {/* Selection Checkbox Overlay */}
            <TouchableOpacity
              style={s.selectOverlay}
              onPress={() => toggleSelect(item.id)}
              activeOpacity={0.9}
            >
              <View
                style={[
                  s.checkbox,
                  selected.includes(item.id) && s.checkboxActive,
                ]}
              >
                {selected.includes(item.id) && (
                  <Ionicons name="checkmark" size={18} color="#fff" />
                )}
              </View>
            </TouchableOpacity>

            {/* Actual Post Card */}
            <PostCard
              post={item}
              navigation={navigation}
              onUpdate={() => {}}
              isVisible={false}
            />
          </View>
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
    paddingBottom: 100,
  },
  postWrapper: {
    position: 'relative',
  },
  selectOverlay: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 100,
    padding: 4,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.8)',
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  checkboxActive: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
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
