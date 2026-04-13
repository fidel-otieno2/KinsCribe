import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import GlassCard from "../components/GlassCard";
import api from "../api/axios";
import { colors } from "../theme";

export default function StorybooksScreen() {
  const [storybooks, setStorybooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation();

  useEffect(() => {
    api
      .get("/storybooks/family")
      .then(({ data }) => setStorybooks(data.storybooks || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <ActivityIndicator
        color={colors.primary}
        style={{ flex: 1, justifyContent: "center" }}
      />
    );

  const renderStorybook = ({ item }) => (
    <GlassCard style={s.item}>
      <Text style={s.title}>{item.title}</Text>
      <Text style={s.subtitle}>
        {item.story_ids.length} stories •{" "}
        {new Date(item.created_at).toLocaleDateString()}
      </Text>
    </GlassCard>
  );

  return (
    <View style={s.container}>
      <Text style={s.header}>Family Storybooks</Text>
      <FlatList
        data={storybooks}
        renderItem={renderStorybook}
        keyExtractor={(item) => String(item.id)}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="book-outline" size={64} color={colors.muted} />
            <Text style={s.emptyTitle}>No storybooks yet</Text>
            <Text style={s.emptySub}>Create your first family memory book</Text>
            <TouchableOpacity
              style={s.newBtn}
              onPress={() => navigation.navigate("StorybookGenerator")}
            >
              <LinearGradient
                colors={["#7c3aed", "#3b82f6"]}
                style={s.newBtnGrad}
              >
                <Text style={s.newBtnText}>Create Storybook</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        }
        contentContainerStyle={s.list}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
    padding: 20,
    textAlign: "center",
  },
  list: {
    padding: 16,
  },
  item: {
    padding: 20,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.muted,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 15,
    color: colors.muted,
    textAlign: "center",
    marginBottom: 24,
  },
  newBtn: {
    borderRadius: 16,
  },
  newBtnGrad: {
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  newBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
