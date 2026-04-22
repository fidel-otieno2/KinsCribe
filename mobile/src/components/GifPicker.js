import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, StyleSheet, TextInput, FlatList, TouchableOpacity,
  Image, Modal, Pressable, ActivityIndicator, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppText from './AppText';
import { colors } from '../theme';

const { width: SCREEN_W } = Dimensions.get('window');
const TENOR_KEY = 'LIVDSRZULELA'; // Tenor demo key
const GAP = 2;
const COLS = 2;
const ITEM_W = (SCREEN_W - GAP * (COLS + 1)) / COLS;

const CATEGORIES = [
  { label: '🔥 Trending', q: '' },
  { label: '😂 Funny',    q: 'funny' },
  { label: '❤️ Love',     q: 'love' },
  { label: '👋 Hello',    q: 'hello' },
  { label: '🎉 Party',    q: 'celebrate' },
  { label: '😢 Sad',      q: 'sad' },
  { label: '😮 Shocked',  q: 'shocked' },
  { label: '🙏 Thanks',   q: 'thank you' },
  { label: '🐶 Animals',  q: 'animals' },
];

export default function GifPicker({ visible, onClose, onSelect }) {
  const [query, setQuery]               = useState('');
  const [gifs, setGifs]                 = useState([]);
  const [loading, setLoading]           = useState(false);
  const [loadingMore, setLoadingMore]   = useState(false);
  const [activeCategory, setActive]     = useState('');
  const [nextPos, setNextPos]           = useState('');
  const debounceRef = useRef(null);

  const fetchGifs = useCallback(async (q, pos = '') => {
    const more = pos !== '';
    more ? setLoadingMore(true) : setLoading(true);
    try {
      const endpoint = q
        ? `https://g.tenor.com/v1/search?q=${encodeURIComponent(q)}&key=${TENOR_KEY}&limit=24&pos=${pos}`
        : `https://g.tenor.com/v1/trending?key=${TENOR_KEY}&limit=24&pos=${pos}`;

      const res  = await fetch(endpoint);
      const json = await res.json();

      if (json.error) {
        console.error('Tenor API error:', json.error);
        setGifs([]);
        return;
      }

      const parsed = (json.results || []).map(r => {
        const media = r.media?.[0] || {};
        const fmt = media.tinygif || media.gif || {};
        const [w, h] = fmt.dims || [200, 200];
        return { id: r.id, url: fmt.url, w, h };
      }).filter(g => g.url);

      setGifs(prev => more ? [...prev, ...parsed] : parsed);
      setNextPos(json.next || '');
    } catch (err) {
      console.error('Fetch error:', err);
    }
    finally { setLoading(false); setLoadingMore(false); }
  }, []);

  useEffect(() => {
    if (visible) {
      setQuery('');
      setActive('');
      setGifs([]);
      fetchGifs('');
    }
  }, [visible, fetchGifs]);

  const handleSearch = (val) => {
    setQuery(val);
    setActive('');
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchGifs(val.trim()), 400);
  };

  const handleCategory = (q) => {
    setActive(q);
    setQuery('');
    fetchGifs(q);
  };

  const renderGif = ({ item, index }) => {
    const aspectRatio = item.w / item.h || 1;
    const h = ITEM_W / aspectRatio;
    const isLeft = index % 2 === 0;
    return (
      <TouchableOpacity
        onPress={() => { onSelect(item); onClose(); }}
        activeOpacity={0.8}
        style={[s.gifItem, { width: ITEM_W, height: h, marginLeft: isLeft ? GAP : GAP / 2, marginRight: isLeft ? GAP / 2 : GAP }]}
      >
        <Image source={{ uri: item.url }} style={s.gifImg} resizeMode="cover" />
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose} />
      <View style={s.sheet}>
        <View style={s.handle} />

        {/* Header */}
        <View style={s.header}>
          <AppText style={s.title}>GIFs</AppText>
          <TouchableOpacity onPress={onClose} style={s.closeBtn}>
            <Ionicons name="close" size={20} color={colors.muted} />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={s.searchRow}>
          <Ionicons name="search" size={15} color={colors.dim} />
          <TextInput
            style={s.searchInput}
            placeholder="Search GIFs..."
            placeholderTextColor={colors.dim}
            value={query}
            onChangeText={handleSearch}
            returnKeyType="search"
            autoCorrect={false}
          />
          {!!query && (
            <TouchableOpacity onPress={() => { setQuery(''); fetchGifs(activeCategory); }}>
              <Ionicons name="close-circle" size={15} color={colors.dim} />
            </TouchableOpacity>
          )}
        </View>

        {/* Category chips — compact height */}
        <FlatList
          data={CATEGORIES}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={i => i.q}
          contentContainerStyle={s.chips}
          renderItem={({ item }) => {
            const active = activeCategory === item.q && !query;
            return (
              <TouchableOpacity
                style={[s.chip, active && s.chipActive]}
                onPress={() => handleCategory(item.q)}
              >
                <AppText style={[s.chipText, active && s.chipTextActive]}>
                  {item.label}
                </AppText>
              </TouchableOpacity>
            );
          }}
        />

        {/* Grid */}
        {loading ? (
          <View style={s.loader}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : (
          <FlatList
            data={gifs}
            keyExtractor={g => g.id}
            numColumns={COLS}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.grid}
            onEndReached={() => { if (!loadingMore && nextPos) fetchGifs(query || activeCategory, nextPos); }}
            onEndReachedThreshold={0.5}
            ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
            ListEmptyComponent={
              <View style={s.empty}>
                <Ionicons name="images-outline" size={38} color={colors.dim} />
                <AppText style={s.emptyText}>No GIFs found</AppText>
              </View>
            }
            ListFooterComponent={
              loadingMore
                ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 14 }} />
                : null
            }
            renderItem={renderGif}
          />
        )}

        <View style={s.attribution}>
          <AppText style={s.attributionText}>Powered by Tenor</AppText>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '82%',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  handle: {
    width: 36, height: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  closeBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 14 },

  // Chips — compact
  chips: { paddingHorizontal: 12, gap: 6, paddingBottom: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  chipActive: {
    backgroundColor: 'rgba(124,58,237,0.2)',
    borderColor: 'rgba(124,58,237,0.5)',
  },
  chipText: { fontSize: 12, color: colors.muted, fontWeight: '500' },
  chipTextActive: { color: colors.primary, fontWeight: '700' },

  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  grid: { paddingBottom: 16 },
  gifItem: { borderRadius: 8, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.04)', marginBottom: GAP },
  gifImg: { width: '100%', height: '100%' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 10 },
  emptyText: { color: colors.muted, fontSize: 14 },
  attribution: {
    alignItems: 'center',
    paddingVertical: 7,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  attributionText: { fontSize: 11, color: colors.dim },
});
