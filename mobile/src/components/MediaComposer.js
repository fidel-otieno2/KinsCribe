import { useState, useRef, useEffect } from 'react';
import {
  View, StyleSheet, Image, TouchableOpacity, TextInput,
  ScrollView, Modal, Pressable, Dimensions, Animated,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Video, ResizeMode } from 'expo-av';
import AppText from './AppText';
import { colors } from '../theme';

const { width: W, height: H } = Dimensions.get('window');

// ── Filters ───────────────────────────────────────────────────────────────────
const FILTERS = [
  { id: 'none',      label: 'Original', tint: null },
  { id: 'warm',      label: 'Warm',     tint: 'rgba(255,140,0,0.18)' },
  { id: 'cool',      label: 'Cool',     tint: 'rgba(0,120,255,0.18)' },
  { id: 'fade',      label: 'Fade',     tint: 'rgba(255,255,255,0.22)' },
  { id: 'drama',     label: 'Drama',    tint: 'rgba(0,0,0,0.28)' },
  { id: 'rose',      label: 'Rose',     tint: 'rgba(255,80,120,0.2)' },
  { id: 'forest',    label: 'Forest',   tint: 'rgba(0,160,80,0.18)' },
  { id: 'golden',    label: 'Golden',   tint: 'rgba(255,200,0,0.2)' },
];

// ── Sticker packs (subset) ────────────────────────────────────────────────────
const OVERLAY_STICKERS = [
  '😂','❤️','🔥','😍','🎉','✨','💯','👑','🌟','💪',
  '😎','🥳','💀','🤣','😭','🙏','👏','🫶','💥','🎊',
];

// ── Text colors ───────────────────────────────────────────────────────────────
const TEXT_COLORS = ['#ffffff','#000000','#ff3b30','#ff9500','#ffcc00','#34c759','#007aff','#af52de','#ff2d55','#5ac8fa'];

// ── Draggable text overlay ────────────────────────────────────────────────────
function DraggableText({ item, onRemove }) {
  const pan = useRef(new Animated.ValueXY({ x: item.x, y: item.y })).current;
  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
    onPanResponderRelease: () => pan.extractOffset(),
  })).current;

  return (
    <Animated.View
      style={[styles.draggableText, { transform: pan.getTranslateTransform() }]}
      {...panResponder.panHandlers}
    >
      <AppText style={[styles.overlayText, { color: item.color, fontSize: item.size }]}>
        {item.text}
      </AppText>
      <TouchableOpacity style={styles.removeTextBtn} onPress={onRemove}>
        <Ionicons name="close-circle" size={18} color="#fff" />
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Draggable sticker ─────────────────────────────────────────────────────────
function DraggableSticker({ item, onRemove }) {
  const pan = useRef(new Animated.ValueXY({ x: item.x, y: item.y })).current;
  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
    onPanResponderRelease: () => pan.extractOffset(),
  })).current;

  return (
    <Animated.View
      style={[styles.draggableSticker, { transform: pan.getTranslateTransform() }]}
      {...panResponder.panHandlers}
    >
      <AppText style={{ fontSize: 48 }}>{item.emoji}</AppText>
      <TouchableOpacity style={styles.removeTextBtn} onPress={onRemove}>
        <Ionicons name="close-circle" size={18} color="#fff" />
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Main MediaComposer ────────────────────────────────────────────────────────
export default function MediaComposer({ visible, mediaUri, mediaType, onClose, onSend }) {
  const [filter, setFilter] = useState('none');
  const [tab, setTab] = useState('filters'); // filters | text | stickers | music
  const [textOverlays, setTextOverlays] = useState([]);
  const [stickerOverlays, setStickerOverlays] = useState([]);
  const [caption, setCaption] = useState('');
  const [viewOnce, setViewOnce] = useState(false);

  // Text tool state
  const [addingText, setAddingText] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [textColor, setTextColor] = useState('#ffffff');
  const [textSize, setTextSize] = useState(22);

  const activeFilter = FILTERS.find(f => f.id === filter) || FILTERS[0];

  const handleAddText = () => {
    if (!draftText.trim()) { setAddingText(false); return; }
    setTextOverlays(prev => [...prev, {
      id: Date.now(),
      text: draftText.trim(),
      color: textColor,
      size: textSize,
      x: W / 2 - 80,
      y: H * 0.3,
    }]);
    setDraftText('');
    setAddingText(false);
  };

  const handleSend = () => {
    onSend({
      uri: mediaUri,
      type: mediaType,
      filter,
      caption,
      viewOnce,
    });
  };

  if (!visible || !mediaUri) return null;

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <View style={styles.container}>

        {/* ── Media preview ── */}
        <View style={styles.mediaWrap}>
          {mediaType === 'video' ? (
            <Video
              source={{ uri: mediaUri }}
              style={styles.media}
              resizeMode={ResizeMode.COVER}
              isLooping
              shouldPlay
            />
          ) : (
            <Image source={{ uri: mediaUri }} style={styles.media} resizeMode="cover" />
          )}

          {/* Filter tint overlay */}
          {activeFilter.tint && (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: activeFilter.tint }]} pointerEvents="none" />
          )}

          {/* View once badge */}
          {viewOnce && (
            <View style={styles.viewOnceBadge}>
              <Ionicons name="eye-off" size={14} color="#fff" />
              <AppText style={styles.viewOnceText}>View once</AppText>
            </View>
          )}

          {/* Text overlays */}
          {textOverlays.map((item, i) => (
            <DraggableText
              key={item.id}
              item={item}
              onRemove={() => setTextOverlays(prev => prev.filter(t => t.id !== item.id))}
            />
          ))}

          {/* Sticker overlays */}
          {stickerOverlays.map((item) => (
            <DraggableSticker
              key={item.id}
              item={item}
              onRemove={() => setStickerOverlays(prev => prev.filter(s => s.id !== item.id))}
            />
          ))}

          {/* Top bar */}
          <View style={styles.topBar}>
            <TouchableOpacity onPress={onClose} style={styles.topBtn}>
              <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>
            <View style={styles.topActions}>
              <TouchableOpacity
                style={[styles.topBtn, viewOnce && styles.topBtnActive]}
                onPress={() => setViewOnce(v => !v)}
              >
                <Ionicons name={viewOnce ? 'eye-off' : 'eye-outline'} size={22} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── Text input overlay ── */}
        {addingText && (
          <View style={styles.textInputOverlay}>
            <View style={styles.textColorRow}>
              {TEXT_COLORS.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[styles.colorDot, { backgroundColor: c }, textColor === c && styles.colorDotActive]}
                  onPress={() => setTextColor(c)}
                />
              ))}
            </View>
            <TextInput
              style={[styles.textDraftInput, { color: textColor, fontSize: textSize }]}
              value={draftText}
              onChangeText={setDraftText}
              placeholder="Type something..."
              placeholderTextColor="rgba(255,255,255,0.5)"
              autoFocus
              multiline
              textAlign="center"
            />
            <View style={styles.textSizeRow}>
              <TouchableOpacity onPress={() => setTextSize(s => Math.max(14, s - 4))}>
                <AppText style={styles.sizeBtn}>A-</AppText>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setTextSize(s => Math.min(48, s + 4))}>
                <AppText style={styles.sizeBtn}>A+</AppText>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.addTextDoneBtn} onPress={handleAddText}>
              <AppText style={styles.addTextDoneText}>Done</AppText>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Bottom panel ── */}
        {!addingText && (
          <View style={styles.bottomPanel}>

            {/* Tab bar */}
            <View style={styles.tabBar}>
              {[
                { id: 'filters',  icon: 'color-filter-outline',  label: 'Filters' },
                { id: 'text',     icon: 'text',                  label: 'Text' },
                { id: 'stickers', icon: 'happy-outline',         label: 'Stickers' },
              ].map(t => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.tabBtn, tab === t.id && styles.tabBtnActive]}
                  onPress={() => {
                    if (t.id === 'text') { setAddingText(true); setTab('text'); }
                    else setTab(t.id);
                  }}
                >
                  <Ionicons name={t.icon} size={20} color={tab === t.id ? colors.primary : colors.muted} />
                  <AppText style={[styles.tabLabel, tab === t.id && { color: colors.primary }]}>{t.label}</AppText>
                </TouchableOpacity>
              ))}
            </View>

            {/* Filters */}
            {tab === 'filters' && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                {FILTERS.map(f => (
                  <TouchableOpacity key={f.id} style={styles.filterItem} onPress={() => setFilter(f.id)}>
                    <View style={[styles.filterThumb, filter === f.id && styles.filterThumbActive]}>
                      <Image source={{ uri: mediaUri }} style={styles.filterThumbImg} resizeMode="cover" />
                      {f.tint && <View style={[StyleSheet.absoluteFill, { backgroundColor: f.tint, borderRadius: 10 }]} />}
                      {filter === f.id && (
                        <View style={styles.filterCheck}>
                          <Ionicons name="checkmark" size={12} color="#fff" />
                        </View>
                      )}
                    </View>
                    <AppText style={[styles.filterLabel, filter === f.id && { color: colors.primary }]}>{f.label}</AppText>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {/* Stickers */}
            {tab === 'stickers' && (
              <View style={styles.stickerGrid}>
                {OVERLAY_STICKERS.map(e => (
                  <TouchableOpacity
                    key={e}
                    style={styles.stickerBtn}
                    onPress={() => setStickerOverlays(prev => [...prev, {
                      id: Date.now(),
                      emoji: e,
                      x: W / 2 - 30,
                      y: H * 0.3,
                    }])}
                  >
                    <AppText style={{ fontSize: 34 }}>{e}</AppText>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Caption */}
            <View style={styles.captionRow}>
              <TextInput
                style={styles.captionInput}
                placeholder="Add a caption..."
                placeholderTextColor={colors.dim}
                value={caption}
                onChangeText={setCaption}
                multiline
                maxLength={300}
              />
              <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
                <LinearGradient colors={['#7c3aed', '#3b82f6']} style={styles.sendGrad}>
                  <Ionicons name="send" size={18} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  mediaWrap: { flex: 1, position: 'relative' },
  media: { width: '100%', height: '100%' },

  topBar: {
    position: 'absolute', top: 52, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  topBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  topBtnActive: { backgroundColor: 'rgba(124,58,237,0.6)' },
  topActions: { flexDirection: 'row', gap: 8 },

  viewOnceBadge: {
    position: 'absolute', top: 100, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  viewOnceText: { fontSize: 12, color: '#fff', fontWeight: '600' },

  // Draggable overlays
  draggableText: { position: 'absolute', padding: 4 },
  draggableSticker: { position: 'absolute', padding: 4 },
  overlayText: { fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 4 },
  removeTextBtn: { position: 'absolute', top: -8, right: -8 },

  // Text input overlay
  textInputOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 100,
  },
  textColorRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  colorDot: { width: 26, height: 26, borderRadius: 13 },
  colorDotActive: { borderWidth: 3, borderColor: '#fff' },
  textDraftInput: {
    width: '100%', textAlign: 'center',
    fontWeight: '800', minHeight: 60,
  },
  textSizeRow: { flexDirection: 'row', gap: 24, marginTop: 16 },
  sizeBtn: { fontSize: 18, color: '#fff', fontWeight: '700', paddingHorizontal: 12, paddingVertical: 6 },
  addTextDoneBtn: {
    marginTop: 20, backgroundColor: colors.primary,
    paddingHorizontal: 32, paddingVertical: 12, borderRadius: 24,
  },
  addTextDoneText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Bottom panel
  bottomPanel: {
    backgroundColor: '#0f172a',
    borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.08)',
    paddingBottom: 30,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, gap: 3 },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
  tabLabel: { fontSize: 11, color: colors.muted, fontWeight: '600' },

  // Filters
  filterRow: { paddingHorizontal: 12, paddingVertical: 12, gap: 10 },
  filterItem: { alignItems: 'center', gap: 5 },
  filterThumb: { width: 64, height: 64, borderRadius: 10, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  filterThumbActive: { borderColor: colors.primary },
  filterThumbImg: { width: '100%', height: '100%' },
  filterCheck: {
    position: 'absolute', bottom: 4, right: 4,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  filterLabel: { fontSize: 11, color: colors.muted, fontWeight: '500' },

  // Stickers
  stickerGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 12, paddingVertical: 10, gap: 4,
  },
  stickerBtn: { width: (W - 48) / 10, alignItems: 'center', paddingVertical: 4 },

  // Caption + send
  captionRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 12, paddingTop: 10,
  },
  captionInput: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10,
    color: colors.text, fontSize: 14, maxHeight: 80,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)',
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden' },
  sendGrad: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
