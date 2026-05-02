import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, TextInput, Modal, Image,
  Dimensions,
} from 'react-native';
import AppText from '../components/AppText';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from '../i18n';
import { colors, radius } from '../theme';
import Toast from '../components/Toast';
import useToast from '../hooks/useToast';

const { width } = Dimensions.get('window');

const RELATIONSHIPS = [
  'Father', 'Mother', 'Son', 'Daughter', 'Brother', 'Sister',
  'Grandfather', 'Grandmother', 'Uncle', 'Aunt', 'Cousin',
  'Husband', 'Wife', 'Partner', 'Nephew', 'Niece', 'Other'
];

const GENERATION_COLORS = {
  '-2': '#f59e0b',
  '-1': '#3b82f6',
  '0': '#7c3aed',
  '1': '#10b981',
  '2': '#ec4899',
};

function TreeNode({ node, onPress, onLongPress }) {
  const color = GENERATION_COLORS[String(node.generation)] || colors.primary;
  return (
    <TouchableOpacity
      style={[s.node, { borderColor: color }]}
      onPress={() => onPress(node)}
      onLongPress={() => onLongPress(node)}
      activeOpacity={0.8}
    >
      <View style={[s.nodeAvatar, { backgroundColor: `${color}33` }]}>
        {node.display_avatar
          ? <Image source={{ uri: node.display_avatar }} style={s.nodeAvatarImg} />
          : <AppText style={[s.nodeAvatarLetter, { color }]}>{node.display_name?.[0]?.toUpperCase() || '?'}</AppText>}
        {node.is_deceased && (
          <View style={s.deceasedBadge}>
            <AppText style={s.deceasedText}>✝</AppText>
          </View>
        )}
      </View>
      <AppText style={s.nodeName} numberOfLines={1}>{node.display_name}</AppText>
      {node.relationship_label && (
        <AppText style={[s.nodeRelation, { color }]}>{node.relationship_label}</AppText>
      )}
      {node.birth_date && (
        <AppText style={s.nodeBirth}>{new Date(node.birth_date).getFullYear()}</AppText>
      )}
    </TouchableOpacity>
  );
}

function AddNodeModal({ visible, onClose, onSave, parentNode }) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { toast, hide, info } = useToast();
  const [form, setForm] = useState({
    display_name: '', relationship_label: '', birth_date: '',
    death_date: '', is_deceased: false, generation: parentNode ? parentNode.generation + 1 : 0
  });
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.display_name.trim()) return info('Please enter a name');
    setLoading(true);
    try {
      await onSave({ ...form, parent_node_id: parentNode?.id });
      setForm({ display_name: '', relationship_label: '', birth_date: '', death_date: '', is_deceased: false, generation: 0 });
      onClose();
    } catch {} finally { setLoading(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <BlurView intensity={20} tint="dark" style={s.modalOverlay}>
        <View style={s.modalSheet}>
          <LinearGradient colors={['rgba(124,58,237,0.1)', '#0f172a']} style={StyleSheet.absoluteFill} />
          <View style={s.modalHandle} />
          <AppText style={s.modalTitle}>{parentNode ? `Add child of ${parentNode.display_name}` : 'Add Family Member'}</AppText>

          <AppText style={s.fieldLabel}>Full Name *</AppText>
          <TextInput style={[s.fieldInput, { backgroundColor: theme.bgCard, color: theme.text, borderColor: theme.border2 }]} placeholder="e.g. John Smith" placeholderTextColor={theme.dim} value={form.display_name} onChangeText={v => set('display_name', v)} />

          <AppText style={s.fieldLabel}>Relationship</AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {RELATIONSHIPS.map(r => (
                <TouchableOpacity
                  key={r}
                  style={[s.relChip, form.relationship_label === r && s.relChipActive]}
                  onPress={() => set('relationship_label', r)}
                >
                  <AppText style={[s.relChipText, form.relationship_label === r && { color: '#fff' }]}>{r}</AppText>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <AppText style={s.fieldLabel}>Birth Year (optional)</AppText>
          <TextInput style={[s.fieldInput, { backgroundColor: theme.bgCard, color: theme.text, borderColor: theme.border2 }]} placeholder="e.g. 1965" placeholderTextColor={theme.dim} keyboardType="numeric" value={form.birth_date} onChangeText={v => set('birth_date', v.length === 4 ? `${v}-01-01` : v)} />

          <TouchableOpacity style={s.deceasedToggle} onPress={() => set('is_deceased', !form.is_deceased)}>
            <View style={[s.checkbox, form.is_deceased && s.checkboxActive]}>
              {form.is_deceased && <Ionicons name="checkmark" size={14} color="#fff" />}
            </View>
            <AppText style={s.deceasedLabel}>Deceased member</AppText>
          </TouchableOpacity>

          {form.is_deceased && (
            <>
              <AppText style={s.fieldLabel}>Death Year (optional)</AppText>
              <TextInput style={[s.fieldInput, { backgroundColor: theme.bgCard, color: theme.text, borderColor: theme.border2 }]} placeholder="e.g. 2010" placeholderTextColor={theme.dim} keyboardType="numeric" value={form.death_date} onChangeText={v => set('death_date', v.length === 4 ? `${v}-12-31` : v)} />
            </>
          )}

          <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={loading}>
            <LinearGradient colors={['#7c3aed', '#3b82f6']} style={s.saveBtnGrad}>
              {loading ? <ActivityIndicator color="#fff" size="small" /> : <AppText style={s.saveBtnText}>Add Member</AppText>}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
            <AppText style={s.cancelBtnText}>{t('cancel')}</AppText>
          </TouchableOpacity>
        </View>
      </BlurView>
    </Modal>
  );
}

export default function FamilyTreeScreen({ navigation }) {
  const { user } = useAuth();
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();
  const { toast, hide, success, error } = useToast();
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedParent, setSelectedParent] = useState(null);
  const [autoGenerated, setAutoGenerated] = useState(false);
  const [myRole, setMyRole] = useState('member');

  const fetchTree = useCallback(async () => {
    try {
      const { data } = await api.get('/extras/tree');
      setNodes(data.nodes || []);
      setAutoGenerated(false);
      
      // Fetch user's role in family
      const familyData = await api.get('/family/my-family');
      const members = familyData.data.members || [];
      const me = members.find(m => m.id === user?.id);
      setMyRole(me?.role || 'member');
    } catch {} finally { setLoading(false); }
  }, [user]);

  useEffect(() => { fetchTree(); }, [fetchTree]);

  const addNode = async (nodeData) => {
    if (myRole !== 'admin') {
      error('Only admins can add members to the tree');
      return;
    }
    const { data } = await api.post('/extras/tree', nodeData);
    setNodes(prev => [...prev, data.node]);
    setAutoGenerated(false);
  };

  const deleteNode = (node) => {
    if (myRole !== 'admin') {
      error('Only admins can remove members from the tree');
      return;
    }
    Alert.alert('Remove Member', `Remove ${node.display_name} from the tree?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/extras/tree/${node.id}`);
          setNodes(prev => prev.filter(n => n.id !== node.id));
          success('Member removed from tree');
        } catch { error('Failed to remove member'); }
      }},
    ]);
  };

  // Auto-generate tree from family members (admin only)
  const autoGenerateTree = useCallback(async () => {
    if (myRole !== 'admin') {
      error('Only admins can generate the family tree');
      return;
    }
    try {
      const { data } = await api.post('/extras/tree/auto-generate');
      setNodes(data.nodes || []);
      setAutoGenerated(true);
      success(data.message || `Generated tree with ${data.nodes?.length || 0} members`);
      fetchTree(); // Refresh to get proper data
    } catch (err) {
      error(err.response?.data?.error || 'Failed to generate tree');
    }
  }, [myRole, success, error, fetchTree]);

  // Group nodes by generation
  const byGeneration = nodes.reduce((acc, n) => {
    const g = n.generation ?? 0;
    if (!acc[g]) acc[g] = [];
    acc[g].push(n);
    return acc;
  }, {});

  const generations = Object.keys(byGeneration).sort((a, b) => Number(a) - Number(b));

  const genLabels = { '-2': 'Great Grandparents', '-1': 'Grandparents', '0': 'Parents / You', '1': 'Children', '2': 'Grandchildren' };

  if (loading) return (
    <View style={[s.container, { backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }]}>
      <ActivityIndicator color={theme.primary} size="large" />
    </View>
  );

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <Toast visible={toast.visible} type={toast.type} message={toast.message} onHide={hide} />
      <LinearGradient colors={isDark ? ['#0f172a', '#1a0f2e', '#0f172a'] : [theme.bg, theme.bgSecondary, theme.bg]} style={StyleSheet.absoluteFill} />

      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <AppText style={[s.headerTitle, { color: theme.text }]}>Family Tree</AppText>
          {myRole !== 'admin' && (
            <AppText style={[s.headerSubtitle, { color: theme.muted }]}>View Only</AppText>
          )}
        </View>
        {myRole === 'admin' && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {nodes.length === 0 && (
              <TouchableOpacity style={s.autoBtn} onPress={autoGenerateTree}>
                <Ionicons name="flash" size={18} color="#fff" />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={s.addBtn} onPress={() => { setSelectedParent(null); setShowAdd(true); }}>
              <Ionicons name="add" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {nodes.length === 0 ? (
        <View style={s.empty}>
          <LinearGradient colors={['rgba(124,58,237,0.2)', 'rgba(59,130,246,0.1)']} style={s.emptyIcon}>
            <Ionicons name="git-network-outline" size={48} color={theme.primary} />
          </LinearGradient>
          <AppText style={[s.emptyTitle, { color: theme.text }]}>Build Your Family Tree</AppText>
          {myRole === 'admin' ? (
            <>
              <AppText style={[s.emptySub, { color: theme.muted }]}>Auto-generate from family members or add manually</AppText>
              <TouchableOpacity style={s.startBtn} onPress={autoGenerateTree}>
                <LinearGradient colors={['#7c3aed', '#3b82f6']} style={s.startBtnGrad}>
                  <Ionicons name="flash" size={18} color="#fff" />
                  <AppText style={s.startBtnText}>Auto-Generate Tree</AppText>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity style={s.manualBtn} onPress={() => setShowAdd(true)}>
                <Ionicons name="add" size={16} color={theme.muted} />
                <AppText style={[s.manualBtnText, { color: theme.muted }]}>Add Manually</AppText>
              </TouchableOpacity>
            </>
          ) : (
            <AppText style={[s.emptySub, { color: theme.muted }]}>Ask your family admin to create the tree</AppText>
          )}
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.treeScroll}>
          {autoGenerated && myRole === 'admin' && (
            <View style={s.autoNotice}>
              <Ionicons name="information-circle" size={16} color="#3b82f6" />
              <AppText style={s.autoNoticeText}>Auto-generated tree. Tap members to set relationships.</AppText>
            </View>
          )}
          {myRole !== 'admin' && (
            <View style={s.viewOnlyNotice}>
              <Ionicons name="eye" size={16} color="#94a3b8" />
              <AppText style={s.viewOnlyNoticeText}>View-only mode. Only admins can edit the tree.</AppText>
            </View>
          )}
          {generations.map(gen => (
            <View key={gen} style={s.generation}>
              <View style={s.genLabelRow}>
                <View style={[s.genDot, { backgroundColor: GENERATION_COLORS[gen] || colors.primary }]} />
                <AppText style={[s.genLabel, { color: theme.muted }]}>{genLabels[gen] || `Generation ${gen}`}</AppText>
                <TouchableOpacity
                  style={s.addChildBtn}
                  onPress={() => {
                    setSelectedParent(byGeneration[gen][0]);
                    setShowAdd(true);
                  }}
                >
                  <Ionicons name="add-circle-outline" size={18} color={theme.muted} />
                </TouchableOpacity>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.genRow}>
                {byGeneration[gen].map(node => (
                  <TreeNode
                    key={node.id}
                    node={node}
                    onPress={(n) => {
                      if (myRole !== 'admin') {
                        // View-only: just show info
                        Alert.alert(
                          n.display_name,
                          n.relationship_label || 'Family member',
                          [
                            n.user_id ? { text: 'View Profile', onPress: () => navigation.navigate('UserProfile', { userId: n.user_id, userName: n.display_name }) } : null,
                            { text: 'Close', style: 'cancel' },
                          ].filter(Boolean)
                        );
                        return;
                      }
                      
                      // Admin: full edit options
                      const actions = [
                        { text: 'Add Child', onPress: () => { setSelectedParent(n); setShowAdd(true); } },
                      ];
                      
                      // Add set parent option if not already set
                      if (!n.parent_node_id && byGeneration[gen].length > 1) {
                        actions.push({
                          text: 'Set Parent',
                          onPress: () => {
                            const potentialParents = nodes.filter(node => 
                              node.id !== n.id && 
                              (node.generation < n.generation || node.generation === n.generation - 1)
                            );
                            if (potentialParents.length === 0) {
                              Alert.alert('No Parents', 'Add members from older generations first');
                              return;
                            }
                            Alert.alert(
                              'Select Parent',
                              'Choose a parent for ' + n.display_name,
                              potentialParents.map(p => ({
                                text: p.display_name,
                                onPress: async () => {
                                  try {
                                    await api.post(`/extras/tree/${n.id}/set-parent`, { parent_node_id: p.id });
                                    fetchTree();
                                    success(`Set ${p.display_name} as parent`);
                                  } catch { error('Failed to set parent'); }
                                }
                              })).concat([{ text: 'Cancel', style: 'cancel' }])
                            );
                          }
                        });
                      }
                      
                      if (n.user_id) {
                        actions.push({ 
                          text: 'View Profile', 
                          onPress: () => navigation.navigate('UserProfile', { userId: n.user_id, userName: n.display_name }) 
                        });
                      }
                      
                      actions.push(
                        { text: 'Remove', style: 'destructive', onPress: () => deleteNode(n) },
                        { text: 'Cancel', style: 'cancel' }
                      );
                      
                      Alert.alert(n.display_name, n.relationship_label || 'Family member', actions);
                    }}
                    onLongPress={myRole === 'admin' ? deleteNode : undefined}
                  />
                ))}
                {myRole === 'admin' && (
                  <TouchableOpacity
                    style={[s.addNodeBtn, { borderColor: theme.border2 }]}
                    onPress={() => { setSelectedParent(byGeneration[gen][0]); setShowAdd(true); }}
                  >
                    <Ionicons name="add" size={24} color={theme.dim} />
                  </TouchableOpacity>
                )}
              </ScrollView>

              {/* Connector line */}
              {Number(gen) < Math.max(...generations.map(Number)) && (
                <View style={s.connector} />
              )}
            </View>
          ))}

          {myRole === 'admin' && (
            <TouchableOpacity style={s.addGenerationBtn} onPress={() => { setSelectedParent(null); setShowAdd(true); }}>
              <Ionicons name="add-circle-outline" size={20} color={theme.primary} />
              <AppText style={[s.addGenerationText, { color: theme.primary }]}>Add Another Generation</AppText>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      <AddNodeModal
        visible={showAdd}
        onClose={() => { setShowAdd(false); setSelectedParent(null); }}
        onSave={addNode}
        parentNode={selectedParent}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 52, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: colors.text },
  headerSubtitle: { fontSize: 11, color: colors.muted, marginTop: 2 },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  treeScroll: { padding: 16, paddingBottom: 100 },
  generation: { marginBottom: 8 },
  genLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  genDot: { width: 10, height: 10, borderRadius: 5 },
  genLabel: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
  addChildBtn: { padding: 4 },
  genRow: { gap: 12, paddingBottom: 8 },
  node: { width: 90, alignItems: 'center', backgroundColor: 'rgba(30,41,59,0.8)', borderRadius: radius.lg, padding: 10, borderWidth: 1.5 },
  nodeAvatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 6, position: 'relative' },
  nodeAvatarImg: { width: 52, height: 52, borderRadius: 26 },
  nodeAvatarLetter: { fontSize: 22, fontWeight: '800' },
  deceasedBadge: { position: 'absolute', bottom: -2, right: -2, backgroundColor: colors.dim, borderRadius: 8, width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  deceasedText: { fontSize: 9, color: '#fff' },
  nodeName: { fontSize: 11, fontWeight: '700', color: colors.text, textAlign: 'center' },
  nodeRelation: { fontSize: 10, fontWeight: '600', textAlign: 'center', marginTop: 2 },
  nodeBirth: { fontSize: 9, color: colors.dim, marginTop: 1 },
  addNodeBtn: { width: 90, height: 90, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border2, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  connector: { width: 2, height: 24, backgroundColor: colors.border, alignSelf: 'center', marginVertical: 4 },
  addGenerationBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)', borderRadius: radius.lg, borderStyle: 'dashed', marginTop: 8 },
  addGenerationText: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 14 },
  emptyIcon: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: colors.text, textAlign: 'center' },
  emptySub: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20 },
  startBtn: { borderRadius: radius.full, overflow: 'hidden', marginTop: 8 },
  startBtnGrad: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 28, paddingVertical: 14 },
  startBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  manualBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  manualBtnText: { fontSize: 14, fontWeight: '600' },
  autoBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#3b82f6', alignItems: 'center', justifyContent: 'center' },
  autoNotice: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(59,130,246,0.1)', padding: 12, borderRadius: radius.md, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(59,130,246,0.3)' },
  autoNoticeText: { flex: 1, fontSize: 12, color: '#3b82f6', fontWeight: '600' },
  viewOnlyNotice: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(148,163,184,0.1)', padding: 12, borderRadius: radius.md, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(148,163,184,0.3)' },
  viewOnlyNoticeText: { flex: 1, fontSize: 12, color: '#94a3b8', fontWeight: '600' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', padding: 24, paddingBottom: 40 },
  modalHandle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 20 },
  fieldLabel: { fontSize: 11, color: colors.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  fieldInput: { backgroundColor: 'rgba(30,41,59,0.9)', borderWidth: 1, borderColor: colors.border2, borderRadius: radius.md, padding: 13, color: colors.text, fontSize: 14, marginBottom: 16 },
  relChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full, backgroundColor: 'rgba(30,41,59,0.8)', borderWidth: 1, borderColor: colors.border2 },
  relChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  relChipText: { fontSize: 13, color: colors.muted, fontWeight: '600' },
  deceasedToggle: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.border2, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  deceasedLabel: { fontSize: 14, color: colors.text },
  saveBtn: { borderRadius: radius.md, overflow: 'hidden', marginBottom: 10 },
  saveBtnGrad: { paddingVertical: 14, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  cancelBtn: { alignItems: 'center', paddingVertical: 10 },
  cancelBtnText: { color: colors.muted, fontSize: 14 },
});
