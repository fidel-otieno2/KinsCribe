import { useEffect, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { colors, radius, shadows } from "../theme";
import GradientButton from "../components/GradientButton";

export default function FamilyScreen() {
  const { user } = useAuth();
  const [family, setFamily] = useState(null);
  const [members, setMembers] = useState([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const navigation = useNavigation();

  useEffect(() => {
    api
      .get("/family/my-family")
      .then(({ data }) => {
        setFamily(data.family);
        setMembers(data.members);
      })
      .finally(() => setLoading(false));
  }, []);

  const sendInvite = async () => {
    if (!inviteEmail) return;
    setSending(true);
    try {
      await api.post("/family/invite/email", { email: inviteEmail });
      Alert.alert("Invite Sent", `Invite sent to ${inviteEmail}`);
      setInviteEmail("");
    } catch (err) {
      Alert.alert(
        "Error",
        err.response?.data?.error || "Failed to send invite",
      );
    } finally {
      setSending(false);
    }
  };

  if (loading)
    return (
      <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />
    );

  return (
    <View style={s.container}>
      <Text style={s.pageTitle}>{family?.name}</Text>

      <View style={s.codeBox}>
        <Text style={s.codeLabel}>Invite Code</Text>
        <Text style={s.code}>{family?.invite_code}</Text>
        <Text style={s.codeSub}>Share this with family members</Text>
      </View>

      {user?.role === "admin" && (
        <View style={s.inviteRow}>
          <TextInput
            style={[s.input, { flex: 1 }]}
            placeholder="Invite by email..."
            placeholderTextColor={colors.dim}
            keyboardType="email-address"
            autoCapitalize="none"
            value={inviteEmail}
            onChangeText={setInviteEmail}
          />
          <TouchableOpacity
            style={s.sendBtn}
            onPress={sendInvite}
            disabled={sending}
          >
            {sending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={s.sendBtnText}>Send</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      <Text style={s.sectionTitle}>Family Tree</Text>
      <View style={s.treeContainer}>
        <View style={s.ownerNode}>
          <View style={s.avatarLarge}>
            <Text style={s.avatarTextLarge}>
              {family?.owner_name?.[0] || user?.name?.[0]}
            </Text>
          </View>
          <Text style={s.ownerName}>{family?.owner_name || user?.name}</Text>
          <Text style={s.ownerRole}>👑 Owner</Text>
        </View>
        <View style={s.treeLines}>
          {members.slice(0, 4).map((_, i) => (
            <View key={i} style={s.line} />
          ))}
        </View>
        <View style={s.memberNodes}>
          {members.slice(0, 4).map((m) => (
            <TouchableOpacity
              key={m.id}
              style={s.memberNode}
              onPress={() =>
                navigation.navigate("Timeline", {
                  filter: "member",
                  memberId: m.id,
                })
              }
            >
              <View style={s.avatar}>
                <Text style={s.avatarText}>{m.name?.[0]}</Text>
              </View>
              <Text style={s.nodeName}>{m.name.split(" ")[0]}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <Text style={s.sectionTitle}>Members ({members.length})</Text>
      <FlatList
        data={members}
        keyExtractor={(m) => String(m.id)}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        renderItem={({ item: m }) => (
          <TouchableOpacity
            style={s.memberRow}
            onPress={() =>
              navigation.navigate("Timeline", {
                filter: "member",
                memberId: m.id,
              })
            }
          >
            <View style={s.avatar}>
              <Text style={s.avatarText}>{m.name?.[0]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.memberName}>{m.name}</Text>
              <Text style={s.memberEmail}>{m.email}</Text>
            </View>
            <View style={s.roleBadge}>
              <Text style={s.roleText}>{m.role}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  pageTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
    padding: 16,
    paddingTop: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  codeBox: {
    margin: 16,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  codeLabel: { fontSize: 12, color: colors.muted, marginBottom: 6 },
  code: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.primary,
    letterSpacing: 6,
  },
  codeSub: { fontSize: 12, color: colors.dim, marginTop: 4 },
  inviteRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  input: {
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: colors.border2,
    borderRadius: 10,
    padding: 12,
    color: colors.text,
    fontSize: 14,
  },
  sendBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 18,
    justifyContent: "center",
  },
  sendBtnText: { color: "#fff", fontWeight: "700" },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  memberName: { fontSize: 14, fontWeight: "600", color: colors.text },
  memberEmail: { fontSize: 12, color: colors.muted },
  roleBadge: {
    backgroundColor: "#1e0a3c",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  roleText: { color: colors.primary, fontSize: 11, fontWeight: "600" },
  treeContainer: {
    paddingHorizontal: 20,
    alignItems: "center",
    marginBottom: 20,
  },
  ownerNode: {
    alignItems: "center",
    marginBottom: 20,
  },
  avatarLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  avatarTextLarge: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 24,
  },
  ownerName: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 4,
  },
  ownerRole: {
    fontSize: 13,
    color: colors.muted,
  },
  treeLines: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginBottom: 16,
  },
  line: {
    width: 2,
    height: 40,
    backgroundColor: colors.border2,
  },
  memberNodes: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
  },
  memberNode: {
    alignItems: "center",
    padding: 8,
  },
  nodeName: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 4,
    textAlign: "center",
  },
});
