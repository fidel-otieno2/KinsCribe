import { useState, useEffect, useCallback } from 'react';
import {
  View, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, TextInput, Modal, FlatList,
} from 'react-native';
import AppText from '../components/AppText';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import api from '../api/axios';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from '../i18n';
import { colors, radius } from '../theme';
import Toast from '../components/Toast';
import useToast from '../hooks/useToast';

const CATEGORIES = [
  { key: 'food', label: 'Food', icon: '🍔', color: '#f59e0b' },
  { key: 'transport', label: 'Transport', icon: '🚗', color: '#3b82f6' },
  { key: 'bills', label: 'Bills', icon: '💡', color: '#e11d48' },
  { key: 'entertainment', label: 'Fun', icon: '🎉', color: '#7c3aed' },
  { key: 'health', label: 'Health', icon: '💊', color: '#10b981' },
  { key: 'education', label: 'Education', icon: '📚', color: '#06b6d4' },
  { key: 'shopping', label: 'Shopping', icon: '🛍️', color: '#ec4899' },
  { key: 'housing', label: 'Housing', icon: '🏠', color: '#8b5cf6' },
  { key: 'savings', label: 'Savings', icon: '💰', color: '#14b8a6' },
  { key: 'other', label: 'Other', icon: '📦', color: '#94a3b8' },
];

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function FamilyBudgetScreen({ navigation }) {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();
  const { toast, hide, success, error, info } = useToast();
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [data, setData] = useState({ entries: [], total_income: 0, total_expense: 0, balance: 0 });
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: '', amount: '', category: 'other', entry_type: 'expense', notes: '' });
  const [saving, setSaving] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const fetchBudget = useCallback(async () => {
    try {
      const res = await api.get(`/extras/budget?month=${month}&year=${year}`);
      setData(res.data);
    } catch {} finally { setLoading(false); }
  }, [month, year]);

  useEffect(() => { fetchBudget(); }, [fetchBudget]);

  const saveEntry = async () => {
    if (!form.title.trim() || !form.amount) return info('Please enter a title and amount');
    setSaving(true);
    try {
      if (editingEntry) {
        // Update existing entry
        const res = await api.put(`/extras/budget/${editingEntry.id}`, { ...form, amount: parseFloat(form.amount) });
        setData(prev => {
          const oldEntry = prev.entries.find(e => e.id === editingEntry.id);
          const entries = prev.entries.map(e => e.id === editingEntry.id ? res.data.entry : e);
          
          // Recalculate totals
          let newIncome = prev.total_income;
          let newExpense = prev.total_expense;
          
          // Remove old entry amounts
          if (oldEntry.entry_type === 'income') newIncome -= oldEntry.amount;
          else newExpense -= oldEntry.amount;
          
          // Add new entry amounts
          if (res.data.entry.entry_type === 'income') newIncome += res.data.entry.amount;
          else newExpense += res.data.entry.amount;
          
          return {
            ...prev,
            entries,
            total_income: newIncome,
            total_expense: newExpense,
            balance: newIncome - newExpense,
          };
        });
        success('Entry updated successfully');
      } else {
        // Create new entry
        const res = await api.post('/extras/budget', { ...form, amount: parseFloat(form.amount) });
        setData(prev => ({
          ...prev,
          entries: [res.data.entry, ...prev.entries],
          total_income: form.entry_type === 'income' ? prev.total_income + parseFloat(form.amount) : prev.total_income,
          total_expense: form.entry_type === 'expense' ? prev.total_expense + parseFloat(form.amount) : prev.total_expense,
          balance: form.entry_type === 'income' ? prev.balance + parseFloat(form.amount) : prev.balance - parseFloat(form.amount),
        }));
        success('Entry added successfully');
      }
      setShowAdd(false);
      setEditingEntry(null);
      setForm({ title: '', amount: '', category: 'other', entry_type: 'expense', notes: '' });
    } catch { error('Failed to save entry. Try again.'); } finally { setSaving(false); }
  };

  const deleteEntry = (entry) => {
    Alert.alert('Delete Entry', `Delete "${entry.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/extras/budget/${entry.id}`);
          setData(prev => ({
            ...prev,
            entries: prev.entries.filter(e => e.id !== entry.id),
            total_income: entry.entry_type === 'income' ? prev.total_income - entry.amount : prev.total_income,
            total_expense: entry.entry_type === 'expense' ? prev.total_expense - entry.amount : prev.total_expense,
            balance: entry.entry_type === 'income' ? prev.balance - entry.amount : prev.balance + entry.amount,
          }));
          success('Entry deleted');
        } catch { error('Failed to delete entry'); }
      }},
    ]);
  };

  const editEntry = (entry) => {
    setEditingEntry(entry);
    setForm({
      title: entry.title,
      amount: entry.amount.toString(),
      category: entry.category,
      entry_type: entry.entry_type,
      notes: entry.notes || '',
    });
    setShowAdd(true);
  };

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const getCatInfo = (key) => CATEGORIES.find(c => c.key === key) || CATEGORIES[CATEGORIES.length - 1];

  // Filter and search entries
  const filteredEntries = data.entries.filter(entry => {
    const matchesSearch = entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         entry.notes?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'all' || entry.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  // Calculate category breakdown
  const categoryBreakdown = CATEGORIES.map(cat => {
    const catEntries = data.entries.filter(e => e.category === cat.key && e.entry_type === 'expense');
    const total = catEntries.reduce((sum, e) => sum + e.amount, 0);
    return { ...cat, total, count: catEntries.length };
  }).filter(c => c.total > 0).sort((a, b) => b.total - a.total);

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <Toast visible={toast.visible} type={toast.type} message={toast.message} onHide={hide} />
      <LinearGradient colors={isDark ? ['#0f172a', '#1a0f2e', '#0f172a'] : [theme.bg, theme.bgSecondary, theme.bg]} style={StyleSheet.absoluteFill} />
      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}><Ionicons name="arrow-back" size={24} color={theme.text} /></TouchableOpacity>
        <AppText style={[s.headerTitle, { color: theme.text }]}>Family Budget</AppText>
        <TouchableOpacity style={s.iconBtn} onPress={() => setShowFilters(!showFilters)}>
          <Ionicons name="options-outline" size={20} color={theme.text} />
        </TouchableOpacity>
        <TouchableOpacity style={s.addBtn} onPress={() => { setEditingEntry(null); setForm({ title: '', amount: '', category: 'other', entry_type: 'expense', notes: '' }); setShowAdd(true); }}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Month nav */}
        <View style={s.monthNav}>
          <TouchableOpacity onPress={prevMonth} style={s.navBtn}><Ionicons name="chevron-back" size={22} color={theme.text} /></TouchableOpacity>
          <AppText style={[s.monthTitle, { color: theme.text }]}>{MONTHS[month - 1]} {year}</AppText>
          <TouchableOpacity onPress={nextMonth} style={s.navBtn}><Ionicons name="chevron-forward" size={22} color={theme.text} /></TouchableOpacity>
        </View>

        {/* Search bar */}
        <View style={[s.searchContainer, { backgroundColor: theme.bgCard, borderColor: theme.border2 }]}>
          <Ionicons name="search" size={18} color={theme.muted} />
          <TextInput
            style={[s.searchInput, { color: theme.text }]}
            placeholder="Search transactions..."
            placeholderTextColor={theme.dim}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={theme.muted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Category filters */}
        {showFilters && (
          <View style={s.filtersContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16 }}>
                <TouchableOpacity
                  style={[s.filterChip, { backgroundColor: theme.bgCard, borderColor: theme.border2 }, filterCategory === 'all' && { borderColor: colors.primary, backgroundColor: `${colors.primary}22` }]}
                  onPress={() => setFilterCategory('all')}
                >
                  <AppText style={[s.filterChipText, { color: theme.muted }, filterCategory === 'all' && { color: colors.primary }]}>All</AppText>
                </TouchableOpacity>
                {CATEGORIES.map(c => (
                  <TouchableOpacity
                    key={c.key}
                    style={[s.filterChip, { backgroundColor: theme.bgCard, borderColor: theme.border2 }, filterCategory === c.key && { borderColor: c.color, backgroundColor: `${c.color}22` }]}
                    onPress={() => setFilterCategory(c.key)}
                  >
                    <AppText>{c.icon}</AppText>
                    <AppText style={[s.filterChipText, { color: theme.muted }, filterCategory === c.key && { color: c.color }]}>{c.label}</AppText>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Summary cards */}
        <View style={s.summaryRow}>
          <LinearGradient colors={['rgba(16,185,129,0.3)', 'rgba(16,185,129,0.1)']} style={s.summaryCard}>
            <AppText style={[s.summaryLabel, { color: theme.muted }]}>Income</AppText>
            <AppText style={[s.summaryAmount, { color: '#10b981' }]}>+${data.total_income.toFixed(2)}</AppText>
          </LinearGradient>
          <LinearGradient colors={['rgba(225,29,72,0.3)', 'rgba(225,29,72,0.1)']} style={s.summaryCard}>
            <AppText style={[s.summaryLabel, { color: theme.muted }]}>Expenses</AppText>
            <AppText style={[s.summaryAmount, { color: '#e11d48' }]}>-${data.total_expense.toFixed(2)}</AppText>
          </LinearGradient>
        </View>

        <LinearGradient
          colors={data.balance >= 0 ? ['rgba(16,185,129,0.2)', 'rgba(59,130,246,0.1)'] : ['rgba(225,29,72,0.2)', 'rgba(239,68,68,0.1)']}
          style={s.balanceCard}
        >
          <AppText style={[s.balanceLabel, { color: theme.text }]}>Balance</AppText>
          <AppText style={[s.balanceAmount, { color: data.balance >= 0 ? '#10b981' : '#e11d48' }]}>
            {data.balance >= 0 ? '+' : ''}{data.balance.toFixed(2)}
          </AppText>
        </LinearGradient>

        {/* Entries */}
        <View style={s.section}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <AppText style={[s.sectionTitle, { color: theme.muted }]}>Transactions</AppText>
            <AppText style={[s.sectionTitle, { color: theme.muted }]}>({filteredEntries.length})</AppText>
          </View>
          {loading ? <ActivityIndicator color={theme.primary} style={{ marginTop: 20 }} /> :
            filteredEntries.length === 0 ? (
              <View style={s.empty}>
                <AppText style={{ fontSize: 40 }}>💰</AppText>
                <AppText style={[s.emptyTitle, { color: theme.text }]}>{searchQuery || filterCategory !== 'all' ? 'No matching entries' : 'No entries yet'}</AppText>
                <AppText style={[s.emptySub, { color: theme.muted }]}>{searchQuery || filterCategory !== 'all' ? 'Try adjusting your filters' : 'Track your family expenses and income'}</AppText>
              </View>
            ) : filteredEntries.map(entry => {
              const cat = getCatInfo(entry.category);
              return (
                <TouchableOpacity
                  key={entry.id}
                  style={[s.entryRow, { borderBottomColor: theme.border }]}
                  onPress={() => editEntry(entry)}
                  onLongPress={() => deleteEntry(entry)}
                  activeOpacity={0.7}
                >
                  <View style={[s.entryIcon, { backgroundColor: `${cat.color}22` }]}>
                    <AppText style={{ fontSize: 18 }}>{cat.icon}</AppText>
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText style={[s.entryTitle, { color: theme.text }]}>{entry.title}</AppText>
                    <AppText style={[s.entryMeta, { color: theme.muted }]}>{entry.author_name} · {cat.label}</AppText>
                    {entry.notes && <AppText style={[s.entryNotes, { color: theme.dim }]} numberOfLines={1}>{entry.notes}</AppText>}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <AppText style={[s.entryAmount, { color: entry.entry_type === 'income' ? '#10b981' : '#e11d48' }]}>
                      {entry.entry_type === 'income' ? '+' : '-'}${entry.amount.toFixed(2)}
                    </AppText>
                    <AppText style={[s.entryDate, { color: theme.dim }]}>{new Date(entry.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</AppText>
                  </View>
                </TouchableOpacity>
              );
            })}
        </View>
      </ScrollView>

      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
        <BlurView intensity={20} tint="dark" style={{ flex: 1, justifyContent: 'flex-end' }}>
          <View style={s.addSheet}>
            <LinearGradient colors={['rgba(124,58,237,0.1)', '#0f172a']} style={StyleSheet.absoluteFill} />
            <View style={s.modalHandle} />
            <AppText style={[s.modalTitle, { color: theme.text }]}>{editingEntry ? 'Edit Entry' : 'Add Entry'}</AppText>

            <View style={s.typeToggle}>
              <TouchableOpacity style={[s.typeBtn, { borderColor: theme.border2 }, form.entry_type === 'expense' && s.typeBtnExpense]} onPress={() => set('entry_type', 'expense')}>
                <AppText style={[s.typeBtnText, { color: theme.muted }, form.entry_type === 'expense' && { color: '#fff' }]}>Expense</AppText>
              </TouchableOpacity>
              <TouchableOpacity style={[s.typeBtn, { borderColor: theme.border2 }, form.entry_type === 'income' && s.typeBtnIncome]} onPress={() => set('entry_type', 'income')}>
                <AppText style={[s.typeBtnText, { color: theme.muted }, form.entry_type === 'income' && { color: '#fff' }]}>Income</AppText>
              </TouchableOpacity>
            </View>

            <TextInput style={[s.input, { backgroundColor: theme.bgCard, color: theme.text, borderColor: theme.border2 }]} placeholder="Title *" placeholderTextColor={theme.dim} value={form.title} onChangeText={v => set('title', v)} />
            <TextInput style={[s.input, { backgroundColor: theme.bgCard, color: theme.text, borderColor: theme.border2 }]} placeholder="Amount *" placeholderTextColor={theme.dim} keyboardType="decimal-pad" value={form.amount} onChangeText={v => set('amount', v)} />

            <AppText style={[s.fieldLabel, { color: theme.muted }]}>Category</AppText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {CATEGORIES.map(c => (
                  <TouchableOpacity key={c.key} style={[s.catChip, { backgroundColor: theme.bgCard, borderColor: theme.border2 }, form.category === c.key && { borderColor: c.color, backgroundColor: `${c.color}22` }]} onPress={() => set('category', c.key)}>
                    <AppText>{c.icon}</AppText>
                    <AppText style={[s.catChipText, { color: theme.muted }, form.category === c.key && { color: c.color }]}>{c.label}</AppText>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <TouchableOpacity style={s.saveBtn} onPress={saveEntry} disabled={saving}>
              <LinearGradient colors={form.entry_type === 'income' ? ['#10b981', '#059669'] : ['#e11d48', '#be123c']} style={s.saveBtnGrad}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <AppText style={s.saveBtnText}>Add {form.entry_type === 'income' ? 'Income' : 'Expense'}</AppText>}
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={{ alignItems: 'center', paddingVertical: 12 }} onPress={() => setShowAdd(false)}>
              <AppText style={{ color: theme.muted }}>{t('cancel')}</AppText>
            </TouchableOpacity>
          </View>
        </BlurView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 52, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 22, fontWeight: '800', color: colors.text, marginLeft: 8 },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  navBtn: { padding: 8 },
  monthTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  summaryRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginBottom: 12 },
  summaryCard: { flex: 1, borderRadius: radius.lg, padding: 16, gap: 4 },
  summaryLabel: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  summaryAmount: { fontSize: 20, fontWeight: '800' },
  balanceCard: { marginHorizontal: 16, borderRadius: radius.lg, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  balanceLabel: { fontSize: 15, fontWeight: '700', color: colors.text },
  balanceAmount: { fontSize: 24, fontWeight: '800' },
  section: { paddingHorizontal: 16, paddingTop: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  entryIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  entryTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  entryMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  entryAmount: { fontSize: 16, fontWeight: '700' },
  empty: { alignItems: 'center', marginTop: 40, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  emptySub: { fontSize: 13, color: colors.muted },
  addSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', padding: 24, paddingBottom: 40 },
  modalHandle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 16 },
  typeToggle: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border2, alignItems: 'center' },
  typeBtnExpense: { backgroundColor: '#e11d48', borderColor: '#e11d48' },
  typeBtnIncome: { backgroundColor: '#10b981', borderColor: '#10b981' },
  typeBtnText: { fontWeight: '700', color: colors.muted },
  input: { backgroundColor: 'rgba(30,41,59,0.9)', borderWidth: 1, borderColor: colors.border2, borderRadius: radius.md, padding: 13, color: colors.text, fontSize: 14, marginBottom: 12 },
  fieldLabel: { fontSize: 11, color: colors.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border2, backgroundColor: 'rgba(30,41,59,0.8)' },
  catChipText: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  saveBtn: { borderRadius: radius.md, overflow: 'hidden', marginTop: 4 },
  saveBtnGrad: { paddingVertical: 14, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
