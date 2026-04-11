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

// ── Stories bubble row ─────────────────────────────────────────
function StoriesBubbles({ stories = [], onAddStory, navigation }) {

  // ✅ keep latest story per user
  const byUser = {};
  stories.forEach(s => {
    if (
      !byUser[s.user_id] ||
      new Date(s.created_at) > new Date(byUser[s.user_id].created_at)
    ) {
      byUser[s.user_id] = s;
    }
  });

  const unique = Object.values(byUser).slice(0, 12);

  return (
    <View style={sb.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={sb.row}>
        
        {/* Add Story */}
        <TouchableOpacity style={sb.item} onPress={onAddStory} activeOpacity={0.8}>
          <View style={sb.addRing}>
            <View style={sb.addCircle}>
              <Ionicons name="add" size={22} color="#fff" />
            </View>
          </View>
          <Text style={sb.label}>Your Story</Text>
        </TouchableOpacity>

        {unique.map(s => (
          <TouchableOpacity
            key={s.user_id}
            style={sb.item}
            activeOpacity={0.8}
            onPress={() => navigation.navigate("StoryViewer", { userId: s.user_id })}
          >
            <LinearGradient colors={["#7c3aed", "#3b82f6", "#ec4899"]} style={sb.ring}>
              <View style={sb.avatarWrap}>
                {s.author_avatar ? (
                  <Image source={{ uri: s.author_avatar }} style={sb.avatar} />
                ) : (
                  <View style={sb.avatarFallback}>
                    <Text style={sb.avatarLetter}>
                      {s.author_name?.[0]?.toUpperCase() || "?"}
                    </Text>
                  </View>
                )}
              </View>
            </LinearGradient>
            <Text style={sb.label} numberOfLines={1}>
              {s.author_name?.split(" ")[0] || "User"}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

// styles for bubbles
const sb = StyleSheet.create({
  wrap: { borderBottomWidth: 0.5, borderBottomColor: colors.border, backgroundColor: colors.bg },
  row: { paddingHorizontal: 12, paddingVertical: 10 },
  item: { alignItems: "center", marginRight: 14, width: 64 },
  addRing: { width: 64, height: 64, borderRadius: 32, borderWidth: 1.5, borderColor: colors.border2, alignItems: "center", justifyContent: "center" },
  addCircle: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.bgSecondary, alignItems: "center", justifyContent: "center" },
  ring: { width: 64, height: 64, borderRadius: 32, padding: 2.5, alignItems: "center", justifyContent: "center" },
  avatarWrap: { width: 57, height: 57, borderRadius: 28.5, overflow: "hidden", borderWidth: 2, borderColor: colors.bg },
  avatar: { width: "100%", height: "100%" },
  avatarFallback: { width: "100%", height: "100%", backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  avatarLetter: { color: "#fff", fontWeight: "700", fontSize: 20 },
  label: { fontSize: 11, color: colors.text, textAlign: "center", maxWidth: 64 },
});

// ── Feed Screen ────────────────────────────────────────────────
export default function FeedScreen({ navigation }) {
  const { user } = useAuth();
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [visibleIndex, setVisibleIndex] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setVisibleIndex(viewableItems[0].index ?? 0);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 80,
    minimumViewTime: 200,
  }).current;

  // ✅ Fetch feed
  const fetchFeed = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await api.get("/stories/feed");
      console.log("Feed:", data);
      setStories(data?.stories || []);
    } catch (err) {
      console.log("Feed error:", err.response?.data || err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ✅ Fetch notifications
  const fetchUnread = async () => {
    try {
      const { data } = await api.get("/stories/notifications/count");
      setUnreadCount(data?.count || 0);
    } catch (err) {
      console.log("Notif error:", err.message);
    }
  };

  useEffect(() => {
    fetchFeed();
    fetchUnread();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchFeed(true);
      fetchUnread();
    }, [])
  );

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={s.header}>
        <View style={s.logoWrap}>
          <Image
            source={require("../../assets/kinscribe-logo.png")}
            style={s.logoIcon}
            resizeMode="cover"
          />
          <Text style={s.logo}>KinsCribe</Text>
        </View>

        <View style={s.headerRight}>
          <TouchableOpacity onPress={() => navigation.navigate("Notifications")}>
            <Ionicons name="notifications-outline" size={26} color={colors.text} />
            {unreadCount > 0 && (
              <View style={s.notifBadge}>
                <Text style={s.notifBadgeText}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate("FeedAI")}>
            <Ionicons name="sparkles" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 80 }} />
      ) : (
        <FlatList
          data={stories}
          keyExtractor={(i) => String(i.id)}
          renderItem={({ item, index }) => (
            <StoryCard
              story={item}
              isVisible={index === visibleIndex}
              navigation={navigation}
              onUpdate={() => fetchFeed(true)}
            />
          )}
          ListHeaderComponent={
            stories.length > 0 ? (
              <StoriesBubbles
                stories={stories}
                navigation={navigation}
                onAddStory={() => navigation.navigate("Create")}
              />
            ) : null
          }
          contentContainerStyle={{ paddingBottom: 90 }}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            fetchFeed(true);
          }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <Text style={s.emptyTitle}>Share your first memory</Text>
              <TouchableOpacity
                style={s.emptyBtn}
                onPress={() => navigation.navigate("Create")}
              >
                <Text style={s.emptyBtnText}>Share a Story</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg || "#000" },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 10,
  },

  logoWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },

  logoIcon: {
    width: 102,
    height: 102,
    borderRadius: 20,
    overflow: "hidden",
  },

  logo: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
  },

  headerRight: {
    flexDirection: "row",
    gap: 18,
  },

  emptyWrap: {
    alignItems: "center",
    marginTop: 80,
  },

  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },

  emptyBtn: {
    marginTop: 12,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },

  emptyBtnText: {
    color: "#fff",
    fontWeight: "700",
  },

  notifBadge: {
    position: "absolute",
    top: -2,
    right: -4,
    backgroundColor: "red",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
  },

  notifBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "800",
  },
});