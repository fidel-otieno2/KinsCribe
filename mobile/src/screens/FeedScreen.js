import { useEffect, useState, useCallback, useRef } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import api from "../api/axios";
import StoryCard from "../components/StoryCard";
import { colors, radius } from "../theme";
import { Ionicons } from "@expo/vector-icons";

export default function FeedScreen({ navigation }) {
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [visibleIndex, setVisibleIndex] = useState(0);

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) setVisibleIndex(viewableItems[0].index ?? 0);
  }).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  const fetchFeed = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await api.get("/stories/feed");
      setStories(data.stories || []);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  // Load on mount
  useEffect(() => { fetchFeed(); }, [fetchFeed]);

  // Refresh every time screen comes into focus (e.g. after posting)
  useFocusEffect(useCallback(() => { fetchFeed(true); }, [fetchFeed]));

  const pickMedia = async () => {};
  const handlePost = async () => {};

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Family Feed</Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <TouchableOpacity style={s.iconBtn} onPress={() => navigation.navigate("Notifications")}>
            <Ionicons name="notifications-outline" size={22} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={s.iconBtn} onPress={() => navigation.navigate("FeedAI")}>
            <Ionicons name="sparkles" size={22} color={colors.primary} />
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
            <StoryCard story={item} onUpdate={() => fetchFeed(true)} isVisible={index === visibleIndex} />
          )}
          contentContainerStyle={{ paddingBottom: 80 }}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); fetchFeed(true); }}
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <Ionicons name="images-outline" size={48} color={colors.dim} />
              <Text style={s.empty}>No stories yet. Be the first!</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 16, paddingTop: 52, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 24, fontWeight: "800", color: colors.text },
  iconBtn: {
    padding: 8, backgroundColor: "rgba(30,41,59,0.6)",
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border2,
  },
  emptyWrap: { alignItems: 'center', marginTop: 80, gap: 12 },
  empty: { textAlign: "center", color: colors.dim, fontSize: 15 },
});
