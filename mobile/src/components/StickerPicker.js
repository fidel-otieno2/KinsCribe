import { useState } from 'react';
import {
  View, StyleSheet, FlatList, TouchableOpacity,
  Modal, Pressable, Dimensions, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppText from './AppText';
import { colors } from '../theme';

const { width: SCREEN_W } = Dimensions.get('window');
const COLS = 5;
const ITEM_SIZE = (SCREEN_W - 32) / COLS;

const PACKS = [
  {
    id: 'faces',
    icon: '😄',
    label: 'Faces',
    stickers: [
      '😀','😂','🤣','😍','🥰','😘','😎','🤩','🥳','😜',
      '🤪','😏','😒','😔','😢','😭','😤','😡','🤬','🥺',
      '😱','😨','😰','😓','🤗','🤔','🤭','🤫','🤥','😶',
      '😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱',
    ],
  },
  {
    id: 'love',
    icon: '❤️',
    label: 'Love',
    stickers: [
      '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔',
      '❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️',
      '😻','💑','👫','💏','💋','💌','💍','💎','🌹','🌷',
      '🌸','💐','🫶','🤝','👐','🙌','👏','🫂','🥂','🎁',
    ],
  },
  {
    id: 'animals',
    icon: '🐶',
    label: 'Animals',
    stickers: [
      '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯',
      '🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐔','🐧',
      '🐦','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝',
      '🐛','🦋','🐌','🐞','🐜','🦟','🦗','🕷️','🦂','🐢',
    ],
  },
  {
    id: 'food',
    icon: '🍕',
    label: 'Food',
    stickers: [
      '🍕','🍔','🌮','🌯','🥗','🍜','🍣','🍱','🍛','🍲',
      '🥘','🍝','🍠','🥐','🥖','🥨','🧀','🥚','🍳','🥞',
      '🧇','🥓','🥩','🍗','🍖','🌭','🥪','🥙','🧆','🥚',
      '🍦','🍧','🍨','🍩','🍪','🎂','🍰','🧁','🥧','🍫',
    ],
  },
  {
    id: 'activities',
    icon: '⚽',
    label: 'Sports',
    stickers: [
      '⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱',
      '🏓','🏸','🏒','🥊','🥋','🎽','🛹','🛷','⛸️','🥌',
      '🎿','⛷️','🏂','🪂','🏋️','🤼','🤸','🤺','🏇','⛹️',
      '🤾','🏌️','🏄','🚣','🧗','🚵','🚴','🏆','🥇','🎖️',
    ],
  },
  {
    id: 'travel',
    icon: '✈️',
    label: 'Travel',
    stickers: [
      '✈️','🚀','🛸','🚁','🛶','⛵','🚢','🚂','🚃','🚄',
      '🚅','🚆','🚇','🚈','🚉','🚊','🚝','🚞','🚋','🚌',
      '🚍','🚎','🚐','🚑','🚒','🚓','🚔','🚕','🚖','🚗',
      '🌍','🌎','🌏','🗺️','🧭','🏔️','⛰️','🌋','🗻','🏕️',
    ],
  },
  {
    id: 'objects',
    icon: '💡',
    label: 'Objects',
    stickers: [
      '💡','🔦','🕯️','🪔','🧯','🛢️','💰','💵','💴','💶',
      '💷','💸','💳','🪙','💹','📈','📉','📊','📋','📌',
      '📍','📎','🖇️','📏','📐','✂️','🗃️','🗄️','🗑️','🔒',
      '🔓','🔏','🔐','🔑','🗝️','🔨','🪓','⛏️','⚒️','🛠️',
    ],
  },
  {
    id: 'symbols',
    icon: '✨',
    label: 'Symbols',
    stickers: [
      '✨','⭐','🌟','💫','⚡','🔥','🌈','☀️','🌤️','⛅',
      '🌥️','☁️','🌦️','🌧️','⛈️','🌩️','🌨️','❄️','☃️','⛄',
      '🌬️','💨','🌪️','🌫️','🌊','💧','💦','☔','⛱️','⚡',
      '🎆','🎇','🧨','🎉','🎊','🎈','🎀','🎁','🎗️','🎟️',
    ],
  },
];

export default function StickerPicker({ visible, onClose, onSelect }) {
  const [activePack, setActivePack] = useState(PACKS[0].id);

  const currentPack = PACKS.find(p => p.id === activePack) || PACKS[0];

  const handleSelect = (sticker) => {
    onSelect(sticker);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose} />
      <View style={s.sheet}>
        <View style={s.handle} />

        {/* Header */}
        <View style={s.header}>
          <AppText style={s.title}>Stickers</AppText>
          <TouchableOpacity onPress={onClose} style={s.closeBtn}>
            <Ionicons name="close" size={20} color={colors.muted} />
          </TouchableOpacity>
        </View>

        {/* Pack tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.tabs}
        >
          {PACKS.map(pack => (
            <TouchableOpacity
              key={pack.id}
              style={[s.tab, activePack === pack.id && s.tabActive]}
              onPress={() => setActivePack(pack.id)}
            >
              <AppText style={s.tabEmoji}>{pack.icon}</AppText>
              {activePack === pack.id && (
                <AppText style={s.tabLabel}>{pack.label}</AppText>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Pack label */}
        <View style={s.packHeader}>
          <AppText style={s.packLabel}>{currentPack.label}</AppText>
          <AppText style={s.packCount}>{currentPack.stickers.length} stickers</AppText>
        </View>

        {/* Sticker grid */}
        <FlatList
          data={currentPack.stickers}
          keyExtractor={(item, i) => `${activePack}-${i}`}
          numColumns={COLS}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.grid}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.stickerBtn}
              onPress={() => handleSelect(item)}
              activeOpacity={0.6}
            >
              <AppText style={s.sticker}>{item}</AppText>
            </TouchableOpacity>
          )}
        />

        {/* Tenor attribution */}
        <View style={s.footer}>
          <AppText style={s.footerText}>KinsCribe Stickers</AppText>
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
    height: '72%',
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

  // Pack tabs
  tabs: {
    paddingHorizontal: 12,
    gap: 6,
    paddingBottom: 10,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  tabActive: {
    backgroundColor: 'rgba(124,58,237,0.2)',
    borderColor: 'rgba(124,58,237,0.5)',
  },
  tabEmoji: { fontSize: 18 },
  tabLabel: { fontSize: 12, fontWeight: '700', color: colors.primary },

  // Pack header
  packHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  packLabel: { fontSize: 13, fontWeight: '700', color: colors.text },
  packCount: { fontSize: 11, color: colors.dim },

  // Grid
  grid: { paddingHorizontal: 8, paddingBottom: 20 },
  stickerBtn: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  sticker: { fontSize: 36 },

  footer: {
    alignItems: 'center',
    paddingVertical: 7,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  footerText: { fontSize: 11, color: colors.dim },
});
