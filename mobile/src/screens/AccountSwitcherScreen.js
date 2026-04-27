import { useState, useEffect } from 'react';
import {
  View, StyleSheet, TouchableOpacity, ScrollView,
  Image, Alert, ActivityIndicator, Modal, TextInput,
} from 'react-native';
import AppText from '../components/AppText';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from '../i18n';
import { colors, radius } from '../theme';
import GradientButton from '../components/GradientButton';

export default function AccountSwitcherScreen({ navigation }) {
  const { user, savedAccounts, switchAccount, addAccount, removeAccount } = useAuth();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [switching, setSwitching] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ email: '', password: '' });
  const [addLoading, setAddLoading] = useState(false);

  const handleSwitch = async (account) => {
    if (account.isCurrent) return;
    
    setSwitching(account.id);
    try {
      await switchAccount(account.id);
      navigation.reset({ index: 0, routes: [{ name: 'Main', params: { screen: 'Profile' } }] });
    } catch (error) {
      Alert.alert('Switch Failed', error.message || 'Could not switch to that account.');
    } finally {
      setSwitching(null);
    }
  };

  const handleAddAccount = async () => {
    if (!addForm.email.trim() || !addForm.password.trim()) {
      Alert.alert('Error', 'Please enter both email and password.');
      return;
    }

    setAddLoading(true);
    try {
      await addAccount(addForm.email.trim(), addForm.password);
      setShowAddModal(false);
      setAddForm({ email: '', password: '' });
      navigation.reset({ index: 0, routes: [{ name: 'Main', params: { screen: 'Profile' } }] });
    } catch (error) {
      Alert.alert('Add Account Failed', error.response?.data?.error || 'Could not add account.');
    } finally {
      setAddLoading(false);
    }
  };

  const handleRemove = async (accountId) => {
    Alert.alert(
      'Remove Account',
      'Are you sure you want to remove this account? You\'ll need to log in again to add it back.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeAccount(accountId);
            } catch (error) {
              Alert.alert('Error', 'Could not remove account.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <LinearGradient colors={['#1C1A14', '#2A2720', '#1C1A14']} style={StyleSheet.absoluteFill} />

      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <AppText style={s.headerTitle}>Switch Account</AppText>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        {savedAccounts.map(account => (
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
                      : <AppText style={s.avatarLetter}>{account.name?.[0]?.toUpperCase()}</AppText>}
                  </View>
                </LinearGradient>
              )}
              {!account.isCurrent && (
                <View style={[s.avatarInner, { backgroundColor: colors.bgSecondary }]}>
                  {account.avatar
                    ? <Image source={{ uri: account.avatar }} style={s.avatarImg} />
                    : <AppText style={s.avatarLetter}>{account.name?.[0]?.toUpperCase()}</AppText>}
                </View>
              )}
            </View>

            <View style={{ flex: 1 }}>
              <AppText style={[s.accountName, { color: theme.text }]}>{account.name}</AppText>
              <AppText style={[s.accountUsername, { color: theme.muted }]}>@{account.username || account.email}</AppText>
            </View>

            {account.isCurrent ? (
              <View style={s.activeBadge}>
                <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                <AppText style={s.activeText}>Active</AppText>
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

        <TouchableOpacity 
          style={[s.addBtn, { borderColor: theme.border2 }]} 
          onPress={() => setShowAddModal(true)}
        >
          <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
          <AppText style={s.addBtnText}>Add Account</AppText>
        </TouchableOpacity>
      </ScrollView>

      {/* Add Account Modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={s.modalOverlay}>
          <View style={[s.modalContent, { backgroundColor: theme.bg }]}>
            <View style={s.modalHeader}>
              <AppText style={[s.modalTitle, { color: theme.text }]}>Add Account</AppText>
              <TouchableOpacity onPress={() => setShowAddModal(false)} style={s.modalClose}>
                <Ionicons name="close" size={24} color={colors.muted} />
              </TouchableOpacity>
            </View>

            <View style={s.modalBody}>
              <AppText style={[s.inputLabel, { color: theme.text }]}>Email</AppText>
              <TextInput
                style={[s.input, { backgroundColor: theme.bgSecondary, color: theme.text, borderColor: theme.border2 }]}
                value={addForm.email}
                onChangeText={(text) => setAddForm(prev => ({ ...prev, email: text }))}
                placeholder="Enter email address"
                placeholderTextColor={colors.muted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <AppText style={[s.inputLabel, { color: theme.text }]}>Password</AppText>
              <TextInput
                style={[s.input, { backgroundColor: theme.bgSecondary, color: theme.text, borderColor: theme.border2 }]}
                value={addForm.password}
                onChangeText={(text) => setAddForm(prev => ({ ...prev, password: text }))}
                placeholder="Enter password"
                placeholderTextColor={colors.muted}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />

              <GradientButton
                label={addLoading ? 'Adding Account...' : 'Add Account'}
                onPress={handleAddAccount}
                disabled={addLoading}
                loading={addLoading}
                style={s.addButton}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingTop: 52, 
    paddingHorizontal: 16, 
    paddingBottom: 14, 
    gap: 12, 
    borderBottomWidth: 0.5, 
    borderBottomColor: colors.border 
  },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 22, fontWeight: '800', color: colors.text },
  scroll: { padding: 16, gap: 10 },
  accountRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 14, 
    padding: 14, 
    borderRadius: radius.lg, 
    borderWidth: 1, 
    backgroundColor: 'rgba(30,41,59,0.5)' 
  },
  accountRowActive: { borderColor: '#7c3aed', backgroundColor: 'rgba(124,58,237,0.08)' },
  avatarWrap: { width: 52, height: 52 },
  avatarRing: { width: 52, height: 52, borderRadius: 26, padding: 2.5, alignItems: 'center', justifyContent: 'center' },
  avatarInner: { 
    width: 46, 
    height: 46, 
    borderRadius: 23, 
    overflow: 'hidden', 
    backgroundColor: colors.primary, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarLetter: { color: '#fff', fontWeight: '800', fontSize: 18 },
  accountName: { fontSize: 15, fontWeight: '700' },
  accountUsername: { fontSize: 12, marginTop: 2 },
  activeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  activeText: { color: '#10b981', fontSize: 12, fontWeight: '700' },
  removeBtn: { padding: 4 },
  addBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 10, 
    padding: 14, 
    borderRadius: radius.lg, 
    borderWidth: 1, 
    borderStyle: 'dashed', 
    marginTop: 6 
  },
  addBtnText: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  modalClose: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
    gap: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 14,
    fontSize: 16,
    marginBottom: 4,
  },
  addButton: {
    marginTop: 10,
  },
});
