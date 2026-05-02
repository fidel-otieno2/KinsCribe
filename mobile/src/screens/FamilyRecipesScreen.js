import { useState, useEffect, useCallback } from 'react';
import {
  View, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, TextInput, Modal, Image, FlatList,
} from 'react-native';
import AppText from '../components/AppText';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import api from '../api/axios';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from '../i18n';
import { colors, radius } from '../theme';
import Toast from '../components/Toast';
import useToast from '../hooks/useToast';

const CATEGORIES = [
  { key: 'all', label: 'All', icon: '🍽️' },
  { key: 'breakfast', label: 'Breakfast', icon: '🌅' },
  { key: 'lunch', label: 'Lunch', icon: '🥗' },
  { key: 'dinner', label: 'Dinner', icon: '🍲' },
  { key: 'snack', label: 'Snack', icon: '🍎' },
  { key: 'dessert', label: 'Dessert', icon: '🍰' },
];

function RecipeCard({ recipe, onPress, onDelete }) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  return (
    <TouchableOpacity style={[rc.card, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]} onPress={onPress} onLongPress={onDelete} activeOpacity={0.85}>
      {recipe.image_url
        ? <Image source={{ uri: recipe.image_url }} style={rc.img} resizeMode="cover" />
        : <View style={[rc.img, rc.imgPlaceholder]}>
            <AppText style={{ fontSize: 40 }}>🍽️</AppText>
          </View>}
      <View style={rc.info}>
        <AppText style={[rc.title, { color: theme.text }]} numberOfLines={1}>{recipe.title}</AppText>
        <AppText style={[rc.author, { color: theme.muted }]}>by {recipe.author_name}</AppText>
        <View style={rc.meta}>
          {recipe.prep_time && <View style={rc.metaItem}><Ionicons name="time-outline" size={12} color={theme.muted} /><AppText style={[rc.metaText, { color: theme.muted }]}>{recipe.prep_time}m</AppText></View>}
          {recipe.servings && <View style={rc.metaItem}><Ionicons name="people-outline" size={12} color={theme.muted} /><AppText style={[rc.metaText, { color: theme.muted }]}>{recipe.servings}</AppText></View>}
          {recipe.category && <View style={rc.catBadge}><AppText style={[rc.catText, { color: theme.primary }]}>{recipe.category}</AppText></View>}
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
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();
  const { toast, hide, success, error, info } = useToast();
  const [recipes, setRecipes] = useState([]);
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', instructions: '', prep_time: '', servings: '', category: 'dinner', tags: '' });
  const [ingredients, setIngredients] = useState(['']);
  const [imageUri, setImageUri] = useState(null);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(null);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');

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
    if (!form.title.trim()) return info('Please add a recipe title');
    setSaving(true);
    try {
      const filteredIngredients = ingredients.filter(i => i.trim());

      if (imageUri) {
        // Use FormData for image upload
        const formData = new FormData();
        Object.entries(form).forEach(([k, v]) => { if (v) formData.append(k, String(v)); });
        formData.append('ingredients', JSON.stringify(filteredIngredients));
        formData.append('image', { uri: imageUri, type: 'image/jpeg', name: 'recipe.jpg' });
        const { data } = await api.post('/extras/recipes', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          transformRequest: (d) => d,
        });
        setRecipes(prev => [data.recipe, ...prev]);
      } else {
        // JSON post — simpler and more reliable without image
        const { data } = await api.post('/extras/recipes', {
          ...form,
          ingredients: filteredIngredients,
        });
        setRecipes(prev => [data.recipe, ...prev]);
      }

      setShowAdd(false);
      setForm({ title: '', description: '', instructions: '', prep_time: '', servings: '', category: 'dinner', tags: '' });
      setIngredients(['']);
      setImageUri(null);
    } catch (err) {
      error(err.response?.data?.error || err.message || 'Failed to save recipe');
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

  const handleReaction = async (type) => {
    try {
      await api.post(`/extras/recipes/${selected.id}/react`, { reaction_type: type });
      const { data } = await api.get(`/extras/recipes/${selected.id}`);
      setSelected(data.recipe);
      setRecipes(prev => prev.map(r => r.id === selected.id ? data.recipe : r));
    } catch {}
  };

  const loadComments = async () => {
    try {
      const { data } = await api.get(`/extras/recipes/${selected.id}/comments`);
      setComments(data.comments || []);
    } catch {}
  };

  const postComment = async () => {
    if (!commentText.trim()) return;
    try {
      const { data } = await api.post(`/extras/recipes/${selected.id}/comments`, { text: commentText });
      setComments(prev => [data.comment, ...prev]);
      setCommentText('');
      const recipeData = await api.get(`/extras/recipes/${selected.id}`);
      setSelected(recipeData.data.recipe);
    } catch {}
  };

  useEffect(() => {
    if (selected && showComments) {
      loadComments();
    }
  }, [selected, showComments]);

  if (selected) {
    return (
      <View style={[s.container, { backgroundColor: theme.bg }]}>
        <LinearGradient colors={isDark ? ['#0f172a', '#1a0f2e', '#0f172a'] : [theme.bg, theme.bgSecondary, theme.bg]} style={StyleSheet.absoluteFill} />
        <View style={[s.header, { borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={() => setSelected(null)} style={s.backBtn}><Ionicons name="arrow-back" size={24} color={theme.text} /></TouchableOpacity>
          <AppText style={[s.headerTitle, { color: theme.text }]} numberOfLines={1}>{selected.title}</AppText>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
          {selected.image_url && <Image source={{ uri: selected.image_url }} style={{ width: '100%', height: 220, borderRadius: radius.lg, marginBottom: 16 }} resizeMode="cover" />}
          <AppText style={[s.recipeTitle, { color: theme.text }]}>{selected.title}</AppText>
          <AppText style={[s.recipeAuthor, { color: theme.muted }]}>by {selected.author_name}</AppText>
          
          {/* Reactions */}
          <View style={s.reactionsRow}>
            <TouchableOpacity style={s.reactionBtn} onPress={() => handleReaction('like')}>
              <Ionicons name="heart" size={20} color="#e11d48" />
              <AppText style={[s.reactionText, { color: theme.text }]}>{selected.reaction_count || 0}</AppText>
            </TouchableOpacity>
            <TouchableOpacity style={s.reactionBtn} onPress={() => handleReaction('yum')}>
              <AppText style={{ fontSize: 20 }}>😋</AppText>
            </TouchableOpacity>
            <TouchableOpacity style={s.reactionBtn} onPress={() => setShowComments(true)}>
              <Ionicons name="chatbubble-outline" size={20} color={theme.text} />
              <AppText style={[s.reactionText, { color: theme.text }]}>{selected.comment_count || 0}</AppText>
            </TouchableOpacity>
          </View>
          
          {selected.description && <AppText style={[s.recipeDesc, { color: theme.muted }]}>{selected.description}</AppText>}
          {selected.ingredients?.length > 0 && (
            <>
              <AppText style={[s.sectionTitle, { color: theme.text }]}>Ingredients</AppText>
              {selected.ingredients.map((ing, i) => (
                <View key={i} style={s.ingredientRow}>
                  <View style={[s.ingredientDot, { backgroundColor: theme.primary }]} />
                  <AppText style={[s.ingredientText, { color: theme.text }]}>{ing}</AppText>
                </View>
              ))}
            </>
          )}
          {selected.instructions && (
            <>
              <AppText style={[s.sectionTitle, { color: theme.text }]}>Instructions</AppText>
              <AppText style={[s.instructions, { color: theme.muted }]}>{selected.instructions}</AppText>
            </>
          )}
        </ScrollView>
        
        {/* Comments Modal */}
        <Modal visible={showComments} transparent animationType="slide" onRequestClose={() => setShowComments(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
            <View style={[s.commentsSheet, { backgroundColor: theme.bgCard }]}>
              <View style={s.modalHandle} />
              <AppText style={[s.modalTitle, { color: theme.text }]}>Comments</AppText>
              <FlatList
                data={comments}
                keyExtractor={c => String(c.id)}
                style={{ maxHeight: 300 }}
                renderItem={({ item }) => (
                  <View style={s.commentRow}>
                    <View style={[s.commentAvatar, { backgroundColor: theme.primary }]}>
                      {item.user_avatar ? <Image source={{ uri: item.user_avatar }} style={{ width: 32, height: 32, borderRadius: 16 }} /> : <AppText style={{ color: '#fff', fontWeight: '700' }}>{item.user_name?.[0]}</AppText>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <AppText style={[s.commentName, { color: theme.text }]}>{item.user_name}</AppText>
                      <AppText style={[s.commentText, { color: theme.muted }]}>{item.text}</AppText>
                    </View>
                  </View>
                )}
                ListEmptyComponent={<AppText style={{ color: theme.muted, textAlign: 'center', marginTop: 20 }}>No comments yet</AppText>}
              />
              <View style={s.commentInputRow}>
                <TextInput
                  style={[s.commentInput, { backgroundColor: theme.bgSecondary, color: theme.text }]}
                  placeholder="Add a comment..."
                  placeholderTextColor={theme.dim}
                  value={commentText}
                  onChangeText={setCommentText}
                />
                <TouchableOpacity onPress={postComment} disabled={!commentText.trim()}>
                  <Ionicons name="send" size={22} color={commentText.trim() ? theme.primary : theme.dim} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <Toast visible={toast.visible} type={toast.type} message={toast.message} onHide={hide} />
      <LinearGradient colors={isDark ? ['#0f172a', '#1a0f2e', '#0f172a'] : [theme.bg, theme.bgSecondary, theme.bg]} style={StyleSheet.absoluteFill} />
      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}><Ionicons name="arrow-back" size={24} color={theme.text} /></TouchableOpacity>
        <AppText style={[s.headerTitle, { color: theme.text }]}>Family Recipes</AppText>
        <TouchableOpacity style={s.addBtn} onPress={() => setShowAdd(true)}><Ionicons name="add" size={22} color="#fff" /></TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.catRow}>
        {CATEGORIES.map(c => (
          <TouchableOpacity key={c.key} style={[s.catBtn, { backgroundColor: theme.bgCard, borderColor: theme.border2 }, category === c.key && s.catBtnActive]} onPress={() => setCategory(c.key)}>
            <AppText style={s.catIcon}>{c.icon}</AppText>
            <AppText style={[s.catLabel, { color: theme.muted }, category === c.key && { color: '#fff' }]}>{c.label}</AppText>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? <ActivityIndicator color={theme.primary} style={{ marginTop: 40 }} /> : (
        <FlatList
          data={recipes}
          keyExtractor={i => String(i.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          renderItem={({ item }) => <RecipeCard recipe={item} onPress={() => setSelected(item)} onDelete={() => deleteRecipe(item)} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <AppText style={{ fontSize: 48 }}>🍽️</AppText>
              <AppText style={[s.emptyTitle, { color: theme.text }]}>No recipes yet</AppText>
              <AppText style={[s.emptySub, { color: theme.muted }]}>Add your family's favourite recipes</AppText>
            </View>
          }
        />
      )}

      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' }}>
          <View style={s.addSheet}>
            <LinearGradient colors={['rgba(124,58,237,0.1)', '#0f172a']} style={StyleSheet.absoluteFill} />
            <View style={s.modalHandle} />
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <AppText style={[s.modalTitle, { color: theme.text }]}>Add Recipe</AppText>
              <TouchableOpacity style={[s.imgPicker, { backgroundColor: theme.bgCard, borderColor: theme.border2 }]} onPress={pickImage}>
                {imageUri ? <Image source={{ uri: imageUri }} style={s.imgPickerImg} resizeMode="cover" /> : <><Ionicons name="camera-outline" size={28} color={theme.muted} /><AppText style={[s.imgPickerText, { color: theme.muted }]}>Add Photo</AppText></>}
              </TouchableOpacity>
              <TextInput style={[s.input, { backgroundColor: theme.bgCard, color: theme.text, borderColor: theme.border2 }]} placeholder="Recipe title *" placeholderTextColor={theme.dim} value={form.title} onChangeText={v => set('title', v)} />
              <TextInput style={[s.input, { height: 70, backgroundColor: theme.bgCard, color: theme.text, borderColor: theme.border2 }]} placeholder="Description" placeholderTextColor={theme.dim} multiline value={form.description} onChangeText={v => set('description', v)} />
              <AppText style={[s.fieldLabel, { color: theme.muted }]}>Ingredients</AppText>
              {ingredients.map((ing, i) => (
                <View key={i} style={s.ingRow}>
                  <TextInput style={[s.input, { flex: 1, marginBottom: 0, backgroundColor: theme.bgCard, color: theme.text, borderColor: theme.border2 }]} placeholder={`Ingredient ${i + 1}`} placeholderTextColor={theme.dim} value={ing} onChangeText={v => { const arr = [...ingredients]; arr[i] = v; setIngredients(arr); }} />
                  {i === ingredients.length - 1 && <TouchableOpacity onPress={() => setIngredients([...ingredients, ''])} style={{ padding: 10 }}><Ionicons name="add-circle" size={22} color={theme.primary} /></TouchableOpacity>}
                </View>
              ))}
              <TextInput style={[s.input, { height: 100, marginTop: 12, backgroundColor: theme.bgCard, color: theme.text, borderColor: theme.border2 }]} placeholder="Instructions (step by step)" placeholderTextColor={theme.dim} multiline value={form.instructions} onChangeText={v => set('instructions', v)} />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TextInput style={[s.input, { flex: 1, backgroundColor: theme.bgCard, color: theme.text, borderColor: theme.border2 }]} placeholder="Prep time (min)" placeholderTextColor={theme.dim} keyboardType="numeric" value={form.prep_time} onChangeText={v => set('prep_time', v)} />
                <TextInput style={[s.input, { flex: 1, backgroundColor: theme.bgCard, color: theme.text, borderColor: theme.border2 }]} placeholder="Servings" placeholderTextColor={theme.dim} keyboardType="numeric" value={form.servings} onChangeText={v => set('servings', v)} />
              </View>
              <TouchableOpacity style={s.saveBtn} onPress={saveRecipe} disabled={saving}>
                <LinearGradient colors={['#7c3aed', '#3b82f6']} style={s.saveBtnGrad}>
                  {saving ? <ActivityIndicator color="#fff" size="small" /> : <AppText style={s.saveBtnText}>Save Recipe</AppText>}
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity style={{ alignItems: 'center', paddingVertical: 12 }} onPress={() => setShowAdd(false)}>
                <AppText style={{ color: theme.muted }}>{t('cancel')}</AppText>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
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
  addSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', padding: 24, paddingBottom: 40, maxHeight: '90%', backgroundColor: '#0f172a' },
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
  reactionsRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginVertical: 12, paddingVertical: 8, borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: colors.border },
  reactionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: 'rgba(124,58,237,0.1)' },
  reactionText: { fontSize: 13, fontWeight: '600', color: colors.text },
  commentsSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40, maxHeight: '80%' },
  commentRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  commentName: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  commentText: { fontSize: 13, lineHeight: 18 },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16, paddingTop: 16, borderTopWidth: 0.5, borderColor: colors.border },
  commentInput: { flex: 1, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, fontSize: 14 },
});
