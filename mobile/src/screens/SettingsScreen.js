import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { colors, radius } from "../theme";

function SettingRow({
  icon,
  label,
  value,
  onPress,
  toggle,
  toggled,
  color,
  danger,
}) {
  return (
    <TouchableOpacity
      style={s.row}
      onPress={onPress}
      activeOpacity={toggle ? 1 : 0.7}
    >
      <View
        style={[
          s.rowIcon,
          { backgroundColor: color ? `${color}22` : "rgba(124,58,237,0.15)" },
        ]}
      >
        <Ionicons name={icon} size={18} color={color || "#7c3aed"} />
      </View>
      <Text style={[s.rowLabel, danger && { color: "#f87171" }]}>{label}</Text>
      {toggle ? (
        <Switch
          value={toggled}
          onValueChange={onPress}
          trackColor={{ true: "#7c3aed", false: colors.border2 }}
          thumbColor="#fff"
        />
      ) : value ? (
        <Text style={s.rowValue}>{value}</Text>
      ) : (
        <Ionicons name="chevron-forward" size={16} color={colors.dim} />
      )}
    </TouchableOpacity>
  );
}

export default function SettingsScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [notifs, setNotifs] = useState(true);
  const [privateDefault, setPrivateDefault] = useState(false);

  const handleLogout = () => {
    Alert.alert("Log Out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log Out", style: "destructive", onPress: logout },
    ]);
  };

  const sections = [
    {
      title: "Account",
      items: [
        {
          icon: "person-outline",
          label: "Edit Profile",

          onPress: () => navigation.navigate("Main", { screen: "Profile" }),
        },


        { icon: "mail-outline", label: "Email", value: user?.email },
        {
          icon: "shield-checkmark-outline",
          label: "Change Password",
          onPress: () =>
            Alert.alert("Change Password", "Email link to reset password"),
        },
      ],
    },
    {
      title: "Privacy",
      items: [
        {
          icon: "lock-closed-outline",
          label: "Default Story Privacy",
          value: privateDefault ? "Private" : "Family",
          onPress: () => setPrivateDefault(!privateDefault),
        },
        {
          icon: "eye-off-outline",
          label: "Who can see my profile",
          value: "Family Only",
          onPress: () =>
            Alert.alert("Profile Visibility", "Set who can view your profile"),
        },
      ],
    },
    {
      title: "Notifications",
      items: [
        {
          icon: "notifications-outline",
          label: "Push Notifications",
          toggle: true,
          toggled: notifs,
          onPress: () => setNotifs(!notifs),
        },
        {
          icon: "heart-outline",
          label: "Likes",
          toggle: true,
          toggled: notifs,
          onPress: () => setNotifs(!notifs),
        },
        {
          icon: "chatbubble-outline",
          label: "Comments",
          toggle: true,
          toggled: notifs,
          onPress: () => setNotifs(!notifs),
        },
      ],
    },
    {
      title: "About",
      items: [
        {
          icon: "information-circle-outline",
          label: "App Version",
          value: "1.0.0",
        },
        {
          icon: "document-text-outline",
          label: "Privacy Policy",
          onPress: () =>
            Alert.alert(
              "Privacy Policy",
              "Your stories are private by default, shared only within family",
            ),
        },
        {
          icon: "help-circle-outline",
          label: "Help & Support",
          onPress: () =>
            Alert.alert("Help", "Contact support@kinscribe.com for assistance"),
        },
      ],
    },
  ];

  return (
    <View style={s.container}>
      <LinearGradient
        colors={["#0f172a", "#1a0f2e", "#0f172a"]}
        style={StyleSheet.absoluteFill}
      />

      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        {sections.map(({ title, items }) => (
          <View key={title} style={s.section}>
            <Text style={s.sectionTitle}>{title}</Text>
            <BlurView intensity={15} tint="dark" style={s.sectionCard}>
              <View style={s.sectionCardInner}>
                {items.map((item, i) => (
                  <View key={item.label}>
                    <SettingRow {...item} />
                    {i < items.length - 1 && <View style={s.divider} />}
                  </View>
                ))}
              </View>
            </BlurView>
          </View>
        ))}

        {/* Logout */}
        <BlurView
          intensity={15}
          tint="dark"
          style={[s.sectionCard, { marginHorizontal: 16 }]}
        >
          <View style={s.sectionCardInner}>
            <SettingRow
              icon="log-out-outline"
              label="Log Out"
              onPress={handleLogout}
              danger
              color="#f87171"
            />
          </View>
        </BlurView>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 24, fontWeight: "800", color: colors.text },
  scroll: { paddingBottom: 40 },
  section: { marginBottom: 8 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.muted,
    paddingHorizontal: 20,
    paddingVertical: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  sectionCard: {
    marginHorizontal: 16,
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border2,
  },
  sectionCardInner: { backgroundColor: "rgba(15,23,42,0.6)" },
  row: { flexDirection: "row", alignItems: "center", padding: 16, gap: 12 },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { flex: 1, fontSize: 14, color: colors.text, fontWeight: "500" },
  rowValue: { fontSize: 13, color: colors.muted },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: 62 },
});
