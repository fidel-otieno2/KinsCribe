import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';

const MOCK = [
  { id: 1, type: 'like', user: 'Mama Achieng', story: 'My childhood story', time: '2m ago', icon: 'heart', color: '#e0245e' },
  { id: 2, type: 'comment', user: 'Uncle James', story: 'Wedding day memories', time: '1h ago', icon: 'chatbubble', color: '#3b82f6' },
  { id: 3, type: 'invite', user: 'Dad', story: null, time: '3h ago', icon: 'people', color: '#7c3aed' },
  { id: 4, type: 'like', user: 'Sister Grace', story: 'First day of school', time: '1d ago', icon: 'heart', color: '#e0245e' },
];

export default function NotificationsScreen() {
  return (
    <View style={s.container}>
      <LinearGradient colors={['#0f172a', '#1a0f2e', '#0f172a']} style={StyleSheet.absoluteFill} />

      <View style={s.header}>
        <Text style={s.headerTitle}>Notifications</Text>
      </View>

      <FlatList
        data={MOCK}
        keyExtractor={i => String(i.id)}
        contentContainerStyle={s.list}
        renderItem={({ item }) => (
          <BlurView intensity={15} tint="dark" style={s.card}>
            <View style={s.cardInner}>
              <View style={[s.iconWrap, { backgroundColor: `${item.color}22` }]}>
                <Ionicons name={item.icon} size={20} color={item.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.notifText}>
                  <Text style={s.userName}>{item.user} </Text>
                  {item.type === 'like' && <Text style={s.action}>liked your story </Text>}
                  {item.type === 'comment' && <Text style={s.action}>commented on </Text>}
                  {item.type === 'invite' && <Text style={s.action}>invited you to join their family</Text>}
                  {item.story && <Text style={s.storyName}>"{item.story}"</Text>}
                </Text>
                <Text style={s.time}>{item.time}</Text>
              </View>
            </View>
          </BlurView>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingTop: 52, paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: 24, fontWeight: '800', color: colors.text },
  list: { padding: 16, gap: 10 },
  card: { borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border2 },
  cardInner: { backgroundColor: 'rgba(15,23,42,0.6)', padding: 14, flexDirection: 'row', gap: 12, alignItems: 'center' },
  iconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  notifText: { fontSize: 13, color: colors.text, lineHeight: 18 },
  userName: { fontWeight: '700', color: colors.text },
  action: { color: colors.muted },
  storyName: { color: '#7c3aed', fontWeight: '600' },
  time: { fontSize: 11, color: colors.dim, marginTop: 4 },
});
