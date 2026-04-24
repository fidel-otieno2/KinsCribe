import { useState } from 'react';
import {
  View, TouchableOpacity, StyleSheet,
  LayoutAnimation, Platform, UIManager, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AppText from './AppText';
import { colors, radius } from '../theme';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

function GroupItem({ group, onPress }) {
  return (
    <TouchableOpacity style={s.item} onPress={onPress} activeOpacity={0.75}>
      {group.cover_url
        ? <Image source={{ uri: group.cover_url }} style={s.groupAvatar} />
        : (
          <LinearGradient colors={['#8B5E3C', '#C4A35A']} style={s.groupAvatarFallback}>
            <Ionicons name="people" size={13} color="#fff" />
          </LinearGradient>
        )}
      <View style={s.groupInfo}>
        <AppText style={s.groupName}>{group.name}</AppText>
        <AppText style={s.groupMeta}>{group.member_count} member{group.member_count !== 1 ? 's' : ''}</AppText>
      </View>
      <Ionicons name="chevron-forward" size={14} color={colors.dim} />
    </TouchableOpacity>
  );
}

function Section({ icon, iconColor, gradientColors, label, count, groups, onGroupPress }) {
  const [open, setOpen] = useState(false);

  const toggle = () => {
    LayoutAnimation.easeInEaseOut();
    setOpen(v => !v);
  };

  return (
    <View style={s.section}>
      <TouchableOpacity style={s.header} onPress={toggle} activeOpacity={0.8}>
        <View style={s.headerLeft}>
          <LinearGradient colors={gradientColors} style={s.iconBadge}>
            <Ionicons name={icon} size={13} color="#fff" />
          </LinearGradient>
          <AppText style={s.sectionTitle}>{label}</AppText>
          <View style={s.countBadge}>
            <AppText style={s.countText}>{count}</AppText>
          </View>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.dim} />
      </TouchableOpacity>

      {open && (
        <View style={s.list}>
          {groups.map(g => (
            <GroupItem key={g.id} group={g} onPress={() => onGroupPress?.(g)} />
          ))}
        </View>
      )}
    </View>
  );
}

export default function ProfileGroupsSection({ adminGroups = [], memberGroups = [], onGroupPress }) {
  if (adminGroups.length === 0 && memberGroups.length === 0) return null;

  return (
    <View style={s.container}>
      {adminGroups.length > 0 && (
        <Section
          icon="star"
          iconColor="#C4A35A"
          gradientColors={['#C4A35A', '#8B5E3C']}
          label="Admin of"
          count={adminGroups.length}
          groups={adminGroups}
          onGroupPress={onGroupPress}
        />
      )}
      {memberGroups.length > 0 && (
        <Section
          icon="people"
          iconColor={colors.primary}
          gradientColors={[colors.primary, colors.primaryDark || '#2D5A27']}
          label="Member of"
          count={memberGroups.length}
          groups={memberGroups}
          onGroupPress={onGroupPress}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { paddingHorizontal: 16, gap: 8, marginBottom: 4 },
  section: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderFamily,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBadge: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  countBadge: {
    backgroundColor: 'rgba(196,163,90,0.18)',
    borderRadius: 20,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  countText: { fontSize: 11, fontWeight: '700', color: colors.gold },
  list: { paddingHorizontal: 14, paddingBottom: 8 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
  },
  groupAvatar: { width: 32, height: 32, borderRadius: 8 },
  groupAvatarFallback: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  groupInfo: { flex: 1 },
  groupName: { fontSize: 13, fontWeight: '600', color: colors.text },
  groupMeta: { fontSize: 11, color: colors.muted, marginTop: 1 },
});
