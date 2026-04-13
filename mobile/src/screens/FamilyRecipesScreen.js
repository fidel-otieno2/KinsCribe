import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, TextInput, Modal, Image, FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import api from '../api/axios';
import { colors, radius } from '../theme';

const CATEGORIES = [
  { key: 'all', label: 'All', icon: '🍽️' },
  { key: 'breakfast', label: 'Breakfast', icon: '🌅' },
  { key: 'lunch', label: 'Lunch', icon: '🥗' },
  { key: 'dinner', label: 'Dinner', icon: '🍲' },
  { key: 'snack', label: 'Snack', icon: '🍎' },
  { key: 'dessert', label: 'Dessert', icon: '🍰' },
];

function RecipeCard({ recipe, onPress, onDelete }) {
  return (
    <TouchableOpacity style={rc.card} onPress={onPress} onLongPress={onDelete} activeOpacity={0.85}>
      {recipe.image_url
        ? <Image source={{ uri: recipe.image_url }} style={rc.img} resizeMode="cover" />
        : <View style={[rc.img, rc.imgPlaceholder]}>
            <Text style={{ fontSize: 40 }}>🍽️</Text>
          </View>}
      <View style={rc.info}>
        <Text style={rc.title} numberOfLines={1}>{recipe.title}</Text>
        <Text style={rc.author}>by {recipe.author_name}</Text>
        <View style={rc.meta}>
          {recipe.prep_time && <View style={rc.metaItem}><Ionicons name="time-outline" size={12} color={colors.muted} /><Text style={rc.metaText}>{recipe.prep_time}m</Text></View>}
          {recipe.servings && <View style={rc.metaItem}><Ionicons name="people-outline" size={12} color={colors.muted} /><Text style={rc.metaText}>{recipe.servings}</Text></View>}
          {recipe.category && <View style={[rc.catBadge]}><Text style={rc.catText}>{recipe.category}</Text></View>}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const rc = StyleSheet.create({
  card: { backgroundColor: colors.bgSecondary, borderRadius: radius.lg, overflow: 'hidden', marginBottom: 12, borderWidth: 0.5, borderColor: colors.border },
  img: { width: '100%', height: 160 },
  imgPlaceholder: { backgroundColor: 'rgba(124,58,237,0.1)', alignItems: 'center', justifyContent: 'center' },
  info: { padding: 14 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 4 },
  author: { fontSize: 12, color: colors.muted, marginBottom: 8 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: colors.muted },
  catBadge: { backgroundColor: 'rgba(124,58,237,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  catText: { fontSize: 11, color: colors.primary, fontWeight: '600' },
});

export default function FamilyRecipesScreen({ navigation }) {
  const [recipes, setRecipes] = useState([]);
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', instructions: '', prep_time: '', servings: '', category: 'dinner', tags: '' });
  const [ingredients, setIngredients] = useState(['']);
  const [imageUri, setImageUri] = useState(null);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const fetchRecipes = useCallback(async () => {
    try {
      const params = category !== 'all' ? `?category=${category}` : '';
      const { data } = await api.get(`/extras/recipes${params}`);
      setRecipes(data.recipes || []);
    } catch {} finally { setLoading(false); }
  }, [category]);

  useEffect(() => { fetchRecipes(); }, [fetchRecipes]);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  };

  const saveRecipe = async () => {
    if (!form.title.trim()) return Alert.alert('Title required');
    setSaving(true);
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v) formData.append(k, v); });
      const filteredIngredients = ingredients.filter(i => i.trim());
      formData.append('ingredients', JSON.stringify(filteredIngredients));
      if (imageUri) formData.append('image', { uri: imageUri, type: 'image/jpeg', name: 'recipe.jpg' });
      const { data } = await api.post('/extras/recipes', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setRecipes(prev => [data.recipe, ...prev]);
      setShowAdd(false);
      setForm({ title: '', description: '', instructions: '', prep_time: '', servings: '', category: 'dinner', tags: '' });
      setIngredients(['']);
      setImageUri(null);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to save');
    } finally { setSaving(false); }
  };

  const deleteRecipe = (recipe) => {
    Alert.alert('Delete Recipe', `Delete "${recipe.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await api.delete(`/extras/recipes/${recipe.id}`); setRecipes(prev => prev.filter(r => r.id !== recipe.id)); } catch {}
      }},
    ]);
  };

  if (selected) {
    return (
      <View style={s.container}>
        <LinearGradient colors={['#0f172a', '#1a0f2e', '#0f172a']} style={StyleSheet.absoluteFill} />
        <View style={s.header}>
          <TouchableOpacity onPress={() => setSelected(null)} style={s.backBtn}><Ionicons name="arrow-back" size={24} color={colors.text} /></TouchableOpacity>
          <Text style={s.headerTitle} numberOfLines={1}>{selected.title}</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
          {selected.image_url && <Image source={{ uri: selected.image_url }} style={{ width: '100%', height: 220, borderRadius: radius.lg, marginBottom: 16 }} resizeMode="cover" />}
          <Text style={s.recipeTitle}>{selected.title}</Text>
          <Text style={s.recipeAuthor}>by {selected.author_name}</Text>
          {selected.description && <Text style={s.recipeDesc}>{selected.description}</Text>}
          {selected.ingredients?.length > 0 && (
            <>
              <Text style={s.sectionTitle}>Ingredients</Text>
              {selected.ingredients.map((ing, i) => (
                <View key={i} style={s.ingredientRow}>
                  <View style={s.ingredientDot} />
                  <Text style={s.ingredientText}>{ing}</Text>
                </View>
              ))}
            </>
          )}
          {selected.instructions && (
            <>
              <Text style={s.sectionTitle}>Instructions</Text>
              <Text style={s.instructions}>{selected.instructions}</Text>
            </>
          )}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <LinearGradient colors={['#0f172a', '#1a0f2e', '#0f172a']} style={StyleSheet.absoluteFill} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}><Ionicons name="arrow-back" size={24} color={colors.text} /></TouchableOpacity>
        <Text style={s.headerTitle}>Family Recipes</Text>
        <TouchableOpacity style={s.addBtn} onPress={() => setShowAdd(true)}><Ionicons name="add" size={22} color="#fff" /></TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.catRow}>
        {CATEGORIES.map(c => (
          <TouchableOpacity key={c.key} style={[s.catBtn, category === c.key && s.catBtnActive]} onPress={() => setCategory(c.key)}>
            <Text style={s.catIcon}>{c.icon}</Text>
            <Text style={[s.catLabel, category === c.key && { color: '#fff' }]}>{c.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} /> : (
        <FlatList
          data={recipes}
          keyExtractor={i => String(i.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          renderItem={({ item }) => <RecipeCard recipe={item} onPress={() => setSelected(item)} onDelete={() => deleteRecipe(item)} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={{ fontSize: 48 }}>🍽️</Text>
              <Text style={s.emptyTitle}>No recipes yet</Text>
              <Text style={s.emptySub}>Add your family's favourite recipes</Text>
            </View>
          }
        />
      )}

      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
        <BlurView intensity={20} tint="dark" style={{ flex: 1, justifyContent: 'flex-end' }}>
          <View style={s.addSheet}>
            <LinearGradient colors={['rgba(124,58,237,0.1)', '#0f172a']} style={StyleSheet.absoluteFill} />
            <View style={s.modalHandle} />
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={s.modalTitle}>Add Recipe</Text>
              <TouchableOpacity style={s.imgPicker} onPress={pickImage}>
                {imageUri ? <Image source={{ uri: imageUri }} style={s.imgPickerImg} resizeMode="cover" /> : <><Ionicons name="camera-outline" size={28} color={colors.muted} /><Text style={s.imgPickerText}>Add Photo</Text></>}
              </TouchableOpacity>
              <TextInput style={s.input} placeholder="Recipe title *" placeholderTextColor={colors.dim} value={form.title} onChangeText={v => set('title', v)} />
              <TextInput style={[s.input, { height: 70 }]} placeholder="Description" placeholderTextColor={colors.dim} multiline value={form.description} onChangeText={v => set('description', v)} />
              <Text style={s.fieldLabel}>Ingredients</Text>
              {ingredients.map((ing, i) => (
                <View key={i} style={s.ingRow}>
                  <TextInput style={[s.input, { flex: 1, marginBottom: 0 }]} placeholder={`Ingredient ${i + 1}`} placeholderTextColor={colors.dim} value={ing} onChangeText={v => { const arr = [...ingredients]; arr[i] = v; setIngredients(arr); }} />
                  {i === ingredients.length - 1 && <TouchableOpacity onPress={() => setIngredients([...ingredients, ''])} style={{ padding: 10 }}><Ionicons name="add-circle" size={22} color={colors.primary} /></TouchableOpacity>}
                </View>
              ))}
              <TextInput style={[s.input, { height: 100, marginTop: 12 }]} placeholder="Instructions (step by step)" placeholderTextColor={colors.dim} multiline value={form.instructions} onChangeText={v => set('instructions', v)} />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TextInput style={[s.input, { flex: 1 }]} placeholder="Prep time (min)" placeholderTextColor={colors.dim} keyboardType="numeric" value={form.prep_time} onChangeText={v => set('prep_time', v)} />
                <TextInput style={[s.input, { flex: 1 }]} placeholder="Servings" placeholderTextColor={colors.dim} keyboardType="numeric" value={form.servings} onChangeText={v => set('servings', v)} />
              </View>
              <TouchableOpacity style={s.saveBtn} onPress={saveRecipe} disabled={saving}>
                <LinearGradient colors={['#7c3aed', '#3b82f6']} style={s.saveBtnGrad}>
                  {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.saveBtnText}>Save Recipe</Text>}
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity style={{ alignItems: 'center', paddingVertical: 12 }} onPress={() => setShowAdd(false)}>
                <Text style={{ color: colors.muted }}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
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
  catRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  catBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full, backgroundColor: 'rgba(30,41,59,0.8)', borderWidth: 1, borderColor: colors.border2 },
  catBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  catIcon: { fontSize: 14 },
  catLabel: { fontSize: 13, color: colors.muted, fontWeight: '600' },
  empty: { alignItems: 'center', marginTop: 60, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  emptySub: { fontSize: 14, color: colors.muted },
  addSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', padding: 24, paddingBottom: 40, maxHeight: '90%' },
  modalHandle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 16 },
  imgPicker: { width: '100%', height: 140, borderRadius: radius.lg, backgroundColor: 'rgba(30,41,59,0.8)', borderWidth: 1.5, borderColor: colors.border2, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', marginBottom: 14, overflow: 'hidden', gap: 8 },
  imgPickerImg: { width: '100%', height: '100%' },
  imgPickerText: { color: colors.muted, fontSize: 13 },
  input: { backgroundColor: 'rgba(30,41,59,0.9)', borderWidth: 1, borderColor: colors.border2, borderRadius: radius.md, padding: 13, color: colors.text, fontSize: 14, marginBottom: 12, textAlignVertical: 'top' },
  fieldLabel: { fontSize: 11, color: colors.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  ingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  saveBtn: { borderRadius: radius.md, overflow: 'hidden', marginTop: 8 },
  saveBtnGrad: { paddingVertical: 14, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  recipeTitle: { fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 4 },
  recipeAuthor: { fontSize: 13, color: colors.muted, marginBottom: 12 },
  recipeDesc: { fontSize: 14, color: colors.muted, lineHeight: 20, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 12, marginTop: 8 },
  ingredientRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  ingredientDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  ingredientText: { fontSize: 14, color: colors.text },
  instructions: { fontSize: 14, color: colors.muted, lineHeight: 22 },
});
