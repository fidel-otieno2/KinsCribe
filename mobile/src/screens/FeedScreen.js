import { useEffect, useState, useCallback, useRef } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, StatusBar, Image, ScrollView,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import api from "../api/axios";
import StoryCard from "../components/StoryCard";
import { colors } from "../theme";
import { useAuth } from "../context/AuthContext";

// ── Stories bubble row ────────────────────────────────────────────────────────
function StoriesBubbles({ stories, onAddStory }) {
  // dedupe by user, keep latest per user
  const byUser = {};
  stories.forEach(s => {
    if (!byUser[s.user_id]) byUser[s.user_id] = s;
  });
  const unique = Object.values(byUser).slice(0, 12);

  return (
    <View style={sb.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={sb.row}>
        {/* Your story bubble */}
        <TouchableOpacity style={sb.item} onPress={onAddStory} activeOpacity={0.8}>
          <View style={sb.addRing}>
            <View style={sb.addCircle}>
              <Ionicons name="add" size={22} color="#fff" />
            </View>
          </View>
          <Text style={sb.label} numberOfLines={1}>Your Story</Text>
        </TouchableOpacity>

        {unique.map(s => (
          <TouchableOpacity key={s.user_id} style={sb.item} activeOpacity={0.8}>
            <LinearGradient colors={["#7c3aed", "#3b82f6", "#ec4899"]} style={sb.ring}>
              <View style={sb.avatarWrap}>
                {s.author_avatar
                  ? <Image source={{ uri: s.author_avatar }} style={sb.avatar} />
                  : <View style={sb.avatarFallback}>
                      <Text style={sb.avatarLetter}>{s.author_name?.[0]?.toUpperCase() || "?"}</Text>
                    </View>}
              </View>
            </LinearGradient>
            <Text style={sb.label} numberOfLines={1}>{s.author_name?.split(" ")[0] || "User"}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const sb = StyleSheet.create({
  wrap: { borderBottomWidth: 0.5, borderBottomColor: colors.border, backgroundColor: colors.bg },
  row: { paddingHorizontal: 12, paddingVertical: 10, gap: 14 },
  item: { alignItems: "center", gap: 5, width: 64 },
  addRing: { width: 64, height: 64, borderRadius: 32, borderWidth: 1.5, borderColor: colors.border2, alignItems: "center", justifyContent: "center" },
  addCircle: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.bgSecondary, alignItems: "center", justifyContent: "center" },
  ring: { width: 64, height: 64, borderRadius: 32, padding: 2.5, alignItems: "center", justifyContent: "center" },
  avatarWrap: { width: 57, height: 57, borderRadius: 28.5, overflow: "hidden", borderWidth: 2, borderColor: colors.bg },
  avatar: { width: "100%", height: "100%" },
  avatarFallback: { width: "100%", height: "100%", backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  avatarLetter: { color: "#fff", fontWeight: "700", fontSize: 20 },
  label: { fontSize: 11, color: colors.text, textAlign: "center", maxWidth: 64 },
});

// ── Feed Screen ───────────────────────────────────────────────────────────────
export default function FeedScreen({ navigation }) {
  const { user } = useAuth();
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

  useEffect(() => { fetchFeed(); }, [fetchFeed]);
  useFocusEffect(useCallback(() => { fetchFeed(true); }, [fetchFeed]));

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />

      {/* IG-style header */}
      <View style={s.header}>
        <Text style={s.logo}>KinsCribe</Text>
        <View style={s.headerRight}>
          <TouchableOpacity onPress={() => navigation.navigate("Notifications")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="heart-outline" size={26} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate("FeedAI")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="sparkles" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 80 }} />
      ) : (
        <FlatList
          data={stories}
          keyExtractor={i => String(i.id)}
          renderItem={({ item, index }) => (
            <StoryCard
              story={item}
              onUpdate={() => fetchFeed(true)}
              isVisible={index === visibleIndex}
            />
          )}
          ListHeaderComponent={
            stories.length > 0
              ? <StoriesBubbles stories={stories} onAddStory={() => navigation.navigate("Create")} />
              : null
          }
          contentContainerStyle={{ paddingBottom: 90 }}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); fetchFeed(true); }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <View style={s.emptyIcon}>
                <Ionicons name="camera-outline" size={40} color={colors.dim} />
              </View>
              <Text style={s.emptyTitle}>Share your first memory</Text>
              <Text style={s.emptyBody}>Stories from your family will appear here.</Text>
              <TouchableOpacity style={s.emptyBtn} onPress={() => navigation.navigate("Create")}>
                <Text style={s.emptyBtnText}>Share a Story</Text>
              </TouchableOpacity>
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
    paddingHorizontal: 16, paddingTop: 52, paddingBottom: 10,
    backgroundColor: colors.bg,
    borderBottomWidth: 0.5, borderBottomColor: colors.border,
  },
  logo: { fontSize: 26, fontWeight: "800", color: colors.text, fontStyle: "italic", letterSpacing: -0.5 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 18 },
  emptyWrap: { alignItems: "center", marginTop: 80, paddingHorizontal: 40, gap: 10 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, borderWidth: 1.5, borderColor: colors.border2, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  emptyBody: { fontSize: 14, color: colors.muted, textAlign: "center", lineHeight: 20 },
  emptyBtn: { marginTop: 12, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: colors.primary, borderRadius: 8 },
  emptyBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
