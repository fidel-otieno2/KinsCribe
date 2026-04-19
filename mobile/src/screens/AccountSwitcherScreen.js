import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Image, Alert, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { colors, radius } from '../theme';
import api from '../api/axios';

const ACCOUNTS_KEY = 'saved_accounts';

export default function AccountSwitcherScreen({ navigation }) {
  const { user, login, logout } = useAuth();
  const { theme } = useTheme();
  const [accounts, setAccounts] = useState([]);
  const [switching, setSwitching] = useState(null);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const raw = await AsyncStorage.getItem(ACCOUNTS_KEY);
      const saved = raw ? JSON.parse(raw) : [];
      // Always include current user
      const current = { id: user?.id, name: user?.name, username: user?.username, avatar: user?.avatar_url, email: user?.email, isCurrent: true };
      const others = saved.filter(a => a.id !== user?.id);
      setAccounts([current, ...others]);
    } catch {}
  };

  const handleSwitch = async (account) => {
    if (account.isCurrent) return;
    if (!account.email || !account.password) {
      return Alert.alert('Cannot Switch', 'Re-login to that account first to enable quick switching.');
    }
    setSwitching(account.id);
    try {
      await login(account.email, account.password);
      navigation.goBack();
    } catch {
      Alert.alert('Switch Failed', 'Could not switch to that account.');
    } finally { setSwitching(null); }
  };

  const handleAddAccount = () => {
    Alert.alert('Add Account', 'Log out and sign in with another account to add it here.');
  };

  const handleRemove = async (accountId) => {
    const updated = accounts.filter(a => a.id !== accountId && !a.isCurrent);
    await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(updated));
    loadAccounts();
  };

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <LinearGradient colors={['#1C1A14', '#2A2720', '#1C1A14']} style={StyleSheet.absoluteFill} />

      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Switch Account</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        {accounts.map(account => (
          <TouchableOpacity
            key={account.id}
            style={[s.accountRow, account.isCurrent && s.accountRowActive, { borderColor: theme.border2 }]}
            onPress={() => handleSwitch(account)}
            activeOpacity={account.isCurrent ? 1 : 0.7}
          >
            <View style={s.avatarWrap}>
              {account.isCurrent && (
                <LinearGradient colors={['#7c3aed', '#3b82f6']} style={s.avatarRing}>
                  <View style={s.avatarInner}>
                    {account.avatar
                      ? <Image source={{ uri: account.avatar }} style={s.avatarImg} />
                      : <Text style={s.avatarLetter}>{account.name?.[0]?.toUpperCase()}</Text>}
                  </View>
                </LinearGradient>
              )}
              {!account.isCurrent && (
                <View style={[s.avatarInner, { backgroundColor: colors.bgSecondary }]}>
                  {account.avatar
                    ? <Image source={{ uri: account.avatar }} style={s.avatarImg} />
                    : <Text style={s.avatarLetter}>{account.name?.[0]?.toUpperCase()}</Text>}
                </View>
              )}
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[s.accountName, { color: theme.text }]}>{account.name}</Text>
              <Text style={[s.accountUsername, { color: theme.muted }]}>@{account.username || account.email}</Text>
            </View>

            {account.isCurrent ? (
              <View style={s.activeBadge}>
                <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                <Text style={s.activeText}>Active</Text>
              </View>
            ) : switching === account.id ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <TouchableOpacity onPress={() => handleRemove(account.id)} style={s.removeBtn}>
                <Ionicons name="close-circle-outline" size={20} color={colors.muted} />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={[s.addBtn, { borderColor: theme.border2 }]} onPress={handleAddAccount}>
          <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
          <Text style={s.addBtnText}>Add Account</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 52, paddingHorizontal: 16, paddingBottom: 14, gap: 12, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 22, fontWeight: '800', color: colors.text },
  scroll: { padding: 16, gap: 10 },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: radius.lg, borderWidth: 1, backgroundColor: 'rgba(30,41,59,0.5)' },
  accountRowActive: { borderColor: '#7c3aed', backgroundColor: 'rgba(124,58,237,0.08)' },
  avatarWrap: { width: 52, height: 52 },
  avatarRing: { width: 52, height: 52, borderRadius: 26, padding: 2.5, alignItems: 'center', justifyContent: 'center' },
  avatarInner: { width: 46, height: 46, borderRadius: 23, overflow: 'hidden', backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: '100%', height: '100%' },
  avatarLetter: { color: '#fff', fontWeight: '800', fontSize: 18 },
  accountName: { fontSize: 15, fontWeight: '700' },
  accountUsername: { fontSize: 12, marginTop: 2 },
  activeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  activeText: { color: '#10b981', fontSize: 12, fontWeight: '700' },
  removeBtn: { padding: 4 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 14, borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed', marginTop: 6 },
  addBtnText: { color: colors.primary, fontWeight: '700', fontSize: 15 },
});
