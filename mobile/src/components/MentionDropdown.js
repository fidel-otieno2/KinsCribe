import { View, FlatList, TouchableOpacity, StyleSheet, Image, ActivityIndicator, Keyboard } from 'react-native';
import { useState, useEffect } from 'react';
import AppText from './AppText';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';
import { BlurView } from 'expo-blur';

/**
 * MentionDropdown Component
 * 
 * Floating dropdown that appears above keyboard when @ is typed
 * Shows user search results with avatars
 * 
 * Props:
 * - visible: boolean
 * - results: array of users
 * - loading: boolean
 * - query: string
 * - onSelect: (user) => void
 * - onClose: () => void
 */
export default function MentionDropdown({ 
  visible, 
  results = [], 
  loading = false, 
  query = '',
  onSelect,
  onClose 
}) {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener('keyboardWillShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    
    const keyboardWillHide = Keyboard.addListener('keyboardWillHide', () => {
      setKeyboardHeight(0);
    });

    const keyboardDidShow = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    
    const keyboardDidHide = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
      keyboardDidShow.remove();
      keyboardDidHide.remove();
    };
  }, []);

  if (!visible) return null;

  return (
    <View 
      style={[
        styles.container, 
        { bottom: keyboardHeight > 0 ? keyboardHeight + 8 : 8 }
      ]}
      pointerEvents="box-none"
    >
      <BlurView intensity={95} tint="dark" style={styles.dropdown}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="at" size={16} color={colors.primary} />
            <AppText style={styles.headerTitle}>
              {query ? `Searching "${query}"` : 'Mention someone'}
            </AppText>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={20} color={colors.muted} />
          </TouchableOpacity>
        </View>

        {/* Results */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
            <AppText style={styles.loadingText}>Searching...</AppText>
          </View>
        ) : results.length > 0 ? (
          <FlatList
            data={results}
            keyExtractor={(item) => item.id.toString()}
            keyboardShouldPersistTaps="always"
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.resultItem}
                onPress={() => onSelect(item)}
                activeOpacity={0.7}
              >
                <View style={styles.avatar}>
                  {item.avatar_url ? (
                    <Image
                      source={{ uri: item.avatar_url }}
                      style={styles.avatarImage}
                    />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <AppText style={styles.avatarLetter}>
                        {item.name?.[0]?.toUpperCase() || 'U'}
                      </AppText>
                    </View>
                  )}
                </View>
                <View style={styles.userInfo}>
                  <AppText style={styles.userName}>{item.name}</AppText>
                  <AppText style={styles.userUsername}>@{item.username}</AppText>
                </View>
                <Ionicons name="add-circle" size={20} color={colors.primary} />
              </TouchableOpacity>
            )}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="search-outline" size={32} color={colors.dim} />
            <AppText style={styles.emptyText}>
              {query ? 'No users found' : 'Start typing to search'}
            </AppText>
          </View>
        )}
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingHorizontal: 16,
  },
  dropdown: {
    backgroundColor: 'rgba(28, 26, 20, 0.95)',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border2,
    maxHeight: 280,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  closeBtn: {
    padding: 4,
  },
  list: {
    maxHeight: 220,
  },
  listContent: {
    paddingVertical: 4,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  userUsername: {
    fontSize: 13,
    color: colors.muted,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: colors.muted,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: colors.dim,
  },
});
