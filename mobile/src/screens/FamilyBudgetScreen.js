import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, TextInput, Modal, FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import api from '../api/axios';
import { colors, radius } from '../theme';

const CATEGORIES = [
  { key: 'food', label: 'Food', icon: '🍔', color: '#f59e0b' },
  { key: 'transport', label: 'Transport', icon: '🚗', color: '#3b82f6' },
  { key: 'bills', label: 'Bills', icon: '💡', color: '#e11d48' },
  { key: 'entertainment', label: 'Fun', icon: '🎉', color: '#7c3aed' },
  { key: 'health', label: 'Health', icon: '💊', color: '#10b981' },
  { key: 'education', label: 'Education', icon: '📚', color: '#06b6d4' },
  { key: 'other', label: 'Other', icon: '📦', color: '#94a3b8' },
];

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function FamilyBudgetScreen({ navigation }) {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [data, setData] = useState({ entries: [], total_income: 0, total_expense: 0, balance: 0 });
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: '', amount: '', category: 'other', entry_type: 'expense', notes: '' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const fetchBudget = useCallback(async () => {
    try {
      const res = await api.get(`/extras/budget?month=${month}&year=${year}`);
      setData(res.data);
    } catch {} finally { setLoading(false); }
  }, [month, year]);

  useEffect(() => { fetchBudget(); }, [fetchBudget]);

  const saveEntry = async () => {
    if (!form.title.trim() || !form.amount) return Alert.alert('Title and amount required');
    setSaving(true);
    try {
      const res = await api.post('/extras/budget', { ...form, amount: parseFloat(form.amount) });
      setData(prev => ({
        ...prev,
        entries: [res.data.entry, ...prev.entries],
        total_income: form.entry_type === 'income' ? prev.total_income + parseFloat(form.amount) : prev.total_income,
        total_expense: form.entry_type === 'expense' ? prev.total_expense + parseFloat(form.amount) : prev.total_expense,
        balance: form.entry_type === 'income' ? prev.balance + parseFloat(form.amount) : prev.balance - parseFloat(form.amount),
      }));
      setShowAdd(false);
      setForm({ title: '', amount: '', category: 'other', entry_type: 'expense', notes: '' });
    } catch {} finally { setSaving(false); }
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
        } catch {}
      }},
    ]);
  };

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const getCatInfo = (key) => CATEGORIES.find(c => c.key === key) || CATEGORIES[CATEGORIES.length - 1];

  return (
    <View style={s.container}>
      <LinearGradient colors={['#0f172a', '#1a0f2e', '#0f172a']} style={StyleSheet.absoluteFill} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}><Ionicons name="arrow-back" size={24} color={colors.text} /></TouchableOpacity>
        <Text style={s.headerTitle}>Family Budget</Text>
        <TouchableOpacity style={s.addBtn} onPress={() => setShowAdd(true)}><Ionicons name="add" size={22} color="#fff" /></TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Month nav */}
        <View style={s.monthNav}>
          <TouchableOpacity onPress={prevMonth} style={s.navBtn}><Ionicons name="chevron-back" size={22} color={colors.text} /></TouchableOpacity>
          <Text style={s.monthTitle}>{MONTHS[month - 1]} {year}</Text>
          <TouchableOpacity onPress={nextMonth} style={s.navBtn}><Ionicons name="chevron-forward" size={22} color={colors.text} /></TouchableOpacity>
        </View>

        {/* Summary cards */}
        <View style={s.summaryRow}>
          <LinearGradient colors={['rgba(16,185,129,0.3)', 'rgba(16,185,129,0.1)']} style={s.summaryCard}>
            <Text style={s.summaryLabel}>Income</Text>
            <Text style={[s.summaryAmount, { color: '#10b981' }]}>+${data.total_income.toFixed(2)}</Text>
          </LinearGradient>
          <LinearGradient colors={['rgba(225,29,72,0.3)', 'rgba(225,29,72,0.1)']} style={s.summaryCard}>
            <Text style={s.summaryLabel}>Expenses</Text>
            <Text style={[s.summaryAmount, { color: '#e11d48' }]}>-${data.total_expense.toFixed(2)}</Text>
          </LinearGradient>
        </View>

        <LinearGradient
          colors={data.balance >= 0 ? ['rgba(16,185,129,0.2)', 'rgba(59,130,246,0.1)'] : ['rgba(225,29,72,0.2)', 'rgba(239,68,68,0.1)']}
          style={s.balanceCard}
        >
          <Text style={s.balanceLabel}>Balance</Text>
          <Text style={[s.balanceAmount, { color: data.balance >= 0 ? '#10b981' : '#e11d48' }]}>
            {data.balance >= 0 ? '+' : ''}{data.balance.toFixed(2)}
          </Text>
        </LinearGradient>

        {/* Entries */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Transactions</Text>
          {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} /> :
            data.entries.length === 0 ? (
              <View style={s.empty}>
                <Text style={{ fontSize: 40 }}>💰</Text>
                <Text style={s.emptyTitle}>No entries yet</Text>
                <Text style={s.emptySub}>Track your family expenses and income</Text>
              </View>
            ) : data.entries.map(entry => {
              const cat = getCatInfo(entry.category);
              return (
                <TouchableOpacity key={entry.id} style={s.entryRow} onLongPress={() => deleteEntry(entry)} activeOpacity={0.8}>
                  <View style={[s.entryIcon, { backgroundColor: `${cat.color}22` }]}>
                    <Text style={{ fontSize: 18 }}>{cat.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.entryTitle}>{entry.title}</Text>
                    <Text style={s.entryMeta}>{entry.author_name} · {cat.label}</Text>
                  </View>
                  <Text style={[s.entryAmount, { color: entry.entry_type === 'income' ? '#10b981' : '#e11d48' }]}>
                    {entry.entry_type === 'income' ? '+' : '-'}${entry.amount.toFixed(2)}
                  </Text>
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
            <Text style={s.modalTitle}>Add Entry</Text>

            <View style={s.typeToggle}>
              <TouchableOpacity style={[s.typeBtn, form.entry_type === 'expense' && s.typeBtnExpense]} onPress={() => set('entry_type', 'expense')}>
                <Text style={[s.typeBtnText, form.entry_type === 'expense' && { color: '#fff' }]}>Expense</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.typeBtn, form.entry_type === 'income' && s.typeBtnIncome]} onPress={() => set('entry_type', 'income')}>
                <Text style={[s.typeBtnText, form.entry_type === 'income' && { color: '#fff' }]}>Income</Text>
              </TouchableOpacity>
            </View>

            <TextInput style={s.input} placeholder="Title *" placeholderTextColor={colors.dim} value={form.title} onChangeText={v => set('title', v)} />
            <TextInput style={s.input} placeholder="Amount *" placeholderTextColor={colors.dim} keyboardType="decimal-pad" value={form.amount} onChangeText={v => set('amount', v)} />

            <Text style={s.fieldLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {CATEGORIES.map(c => (
                  <TouchableOpacity key={c.key} style={[s.catChip, form.category === c.key && { borderColor: c.color, backgroundColor: `${c.color}22` }]} onPress={() => set('category', c.key)}>
                    <Text>{c.icon}</Text>
                    <Text style={[s.catChipText, form.category === c.key && { color: c.color }]}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <TouchableOpacity style={s.saveBtn} onPress={saveEntry} disabled={saving}>
              <LinearGradient colors={form.entry_type === 'income' ? ['#10b981', '#059669'] : ['#e11d48', '#be123c']} style={s.saveBtnGrad}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.saveBtnText}>Add {form.entry_type === 'income' ? 'Income' : 'Expense'}</Text>}
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={{ alignItems: 'center', paddingVertical: 12 }} onPress={() => setShowAdd(false)}>
              <Text style={{ color: colors.muted }}>Cancel</Text>
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
