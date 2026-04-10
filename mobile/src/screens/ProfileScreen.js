import { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import StoryCard from "../components/StoryCard";
import { colors, radius, shadows } from "../theme";

import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function ProfileScreen({ navigation }) {
  const { user, refreshUser } = useAuth();
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const handleAvatarUpload = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed to access gallery.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setUploading(true);
      const asset = result.assets[0];
      try {
        const token = await AsyncStorage.getItem("access_token");
        const res = await fetch("https://kinscribe-1.onrender.com/api/auth/avatar", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ image: asset.base64 }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Upload failed");
        await refreshUser();
        Alert.alert("Success", "Profile picture updated!");
      } catch (err) {
        console.log("Upload error:", err.message);
        Alert.alert("Error", err.message || "Upload failed");
      } finally {
        setUploading(false);
      }
    }
  };

  useEffect(() => {
    if (user) {
      api
        .get("/stories/feed")
        .then(({ data }) =>
          setStories(data.stories.filter((s) => s.user_id === user?.id)),
        )
        .finally(() => setLoading(false));
    }
  }, [user]);

  if (loading) {
    return (
      <ActivityIndicator
        style={{ flex: 1, justifyContent: "center" }}
        color="#7c3aed"
      />
    );
  }

  return (
    <View style={s.container}>
      <LinearGradient
        colors={["#0f172a", "#1a0f2e", "#0f172a"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={s.orb1} />

      <FlatList
        data={stories}
        keyExtractor={(i) => String(i.id)}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <View style={s.header}>
              <Text style={s.headerTitle}>Profile</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate("Settings")}
                style={s.settingsBtn}
              >
                <Ionicons
                  name="settings-outline"
                  size={22}
                  color={colors.text}
                />
              </TouchableOpacity>
            </View>

            <BlurView intensity={20} tint="dark" style={s.profileCard}>
              <LinearGradient
                colors={["rgba(124,58,237,0.15)", "rgba(15,23,42,0.6)"]}
                style={StyleSheet.absoluteFill}
              />
              <View style={s.profileInner}>
                <View style={s.avatarWrap}>
                  {user?.avatar_url ? (
                    <Image source={{ uri: user.avatar_url }} style={s.avatar} />
                  ) : (
                    <LinearGradient
                      colors={["#7c3aed", "#3b82f6"]}
                      style={s.avatarGrad}
                    >
                      <Text style={s.avatarText}>
                        {user?.name?.[0]?.toUpperCase()}
                      </Text>
                    </LinearGradient>
                  )}
                </View>
                <Text style={s.name}>{user?.name}</Text>
                {user?.username && (
                  <Text style={s.username}>@{user.username}</Text>
                )}
                <View style={s.badges}>
                  <View style={s.badge}>
                    <Ionicons
                      name="shield-checkmark"
                      size={12}
                      color="#7c3aed"
                    />
                    <Text style={s.badgeText}>{user?.role}</Text>
                  </View>
                </View>
                <View style={s.statsRow}>
                  <View style={s.stat}>
                    <Text style={s.statNum}>{stories.length}</Text>
                    <Text style={s.statLabel}>Stories</Text>
                  </View>
                  <View style={s.statDivider} />
                  <View style={s.stat}>
                    <Text style={s.statNum}>0</Text>
                    <Text style={s.statLabel}>Likes</Text>
                  </View>
                  <View style={s.statDivider} />
                  <View style={s.stat}>
                    <Text style={s.statNum}>0</Text>
                    <Text style={s.statLabel}>Comments</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[s.uploadBtn, { backgroundColor: uploading ? '#374151' : '#7c3aed', borderRadius: 12 }]}
                  onPress={handleAvatarUpload}
                  disabled={uploading}
                  activeOpacity={0.8}
                >
                  <Ionicons name="camera-outline" size={16} color="#fff" />
                  <Text style={s.uploadBtnText}>Upload Photo</Text>
                </TouchableOpacity>
                {uploading && (
                  <ActivityIndicator
                    style={{ marginTop: 12 }}
                    color="#7c3aed"
                  />
                )}
              </View>
            </BlurView>

            <Text style={s.sectionTitle}>My Stories</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 16 }}>
            <StoryCard story={item} onUpdate={() => {}} />
          </View>
        )}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="book-outline" size={48} color={colors.dim} />
            <Text style={s.emptyText}>No stories yet</Text>
            <TouchableOpacity
              style={s.createBtn}
              onPress={() => navigation.navigate("Create")}
            >
              <Text style={s.createBtnText}>Create your first story</Text>
            </TouchableOpacity>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 100 }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  orb1: {
    position: "absolute",
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: "rgba(124,58,237,0.1)",
    top: 0,
    right: -60,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerTitle: { fontSize: 24, fontWeight: "800", color: colors.text },
  settingsBtn: {
    padding: 8,
    backgroundColor: "rgba(30,41,59,0.6)",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border2,
  },
  profileCard: {
    marginHorizontal: 16,
    borderRadius: radius.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border2,
    marginBottom: 24,
    ...shadows.lg,
  },
  profileInner: { padding: 24, alignItems: "center" },
  avatarWrap: { marginBottom: 14 },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: "#7c3aed",
  },
  avatarGrad: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 32 },
  name: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 4,
  },
  username: { fontSize: 14, color: colors.muted, marginBottom: 12 },
  badges: { flexDirection: "row", gap: 8, marginBottom: 20 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(124,58,237,0.15)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  badgeText: { color: "#a78bfa", fontSize: 11, fontWeight: "600" },
  statsRow: { flexDirection: "row", alignItems: "center", gap: 24 },
  stat: { alignItems: "center" },
  statNum: { fontSize: 22, fontWeight: "800", color: colors.text },
  statLabel: { fontSize: 12, color: colors.muted, marginTop: 2 },
  statDivider: { width: 1, height: 30, backgroundColor: colors.border },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  uploadBtn: { marginTop: 16 },
  uploadBtnGrad: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  uploadBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  empty: { alignItems: "center", marginTop: 40, gap: 10 },
  emptyText: { color: colors.muted, fontSize: 15 },
  createBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  createBtnText: { color: "#fff", fontWeight: "600" },
});
