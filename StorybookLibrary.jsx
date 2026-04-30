import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import { API_URL } from '../config';

const StorybookLibrary = ({ navigation }) => {
  const [storybooks, setStorybooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchStorybooks();
  }, []);

  const fetchStorybooks = async () => {
    try {
      const response = await axios.get(`${API_URL}/storybooks`);
      setStorybooks(response.data.storybooks);
    } catch (error) {
      console.error('Error fetching storybooks:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchStorybooks();
  };

  const renderStorybookCard = ({ item }) => (
    <TouchableOpacity
      style={styles.bookCard}
      onPress={() => navigation.navigate('BookReader', { storybook: item })}
      activeOpacity={0.9}
    >
      <LinearGradient
        colors={['#7c3aed', '#a855f7', '#c084fc']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.bookCover}
      >
        {item.cover_image ? (
          <Image source={{ uri: item.cover_image }} style={styles.coverImage} />
        ) : (
          <View style={styles.defaultCover}>
            <Ionicons name="book" size={60} color="#fff" />
            <Text style={styles.bookTitle} numberOfLines={2}>
              {item.title}
            </Text>
          </View>
        )}
        
        {/* Book spine effect */}
        <View style={styles.bookSpine} />
      </LinearGradient>

      <View style={styles.bookInfo}>
        <Text style={styles.bookTitleText} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.bookMeta}>
          {item.story_ids.length} stories • {new Date(item.created_at).getFullYear()}
        </Text>
        
        {/* Theme badge */}
        <View style={styles.themeBadge}>
          <Ionicons
            name={
              item.theme === 'sepia'
                ? 'sunny'
                : item.theme === 'night'
                ? 'moon'
                : 'document-text'
            }
            size={12}
            color="#7c3aed"
          />
          <Text style={styles.themeBadgeText}>{item.theme}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="book-outline" size={80} color="#ccc" />
      <Text style={styles.emptyTitle}>No Storybooks Yet</Text>
      <Text style={styles.emptySubtitle}>
        Create your first family storybook to preserve your memories
      </Text>
      <TouchableOpacity
        style={styles.createButton}
        onPress={() => navigation.navigate('CreateStorybook')}
      >
        <Ionicons name="add" size={24} color="#fff" />
        <Text style={styles.createButtonText}>Create Storybook</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7c3aed" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Family Library</Text>
          <Text style={styles.headerSubtitle}>
            {storybooks.length} {storybooks.length === 1 ? 'book' : 'books'}
          </Text>
        </View>
        
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('CreateStorybook')}
        >
          <Ionicons name="add" size={28} color="#7c3aed" />
        </TouchableOpacity>
      </View>

      {/* Featured section */}
      {storybooks.length > 0 && (
        <View style={styles.featuredSection}>
          <Text style={styles.sectionTitle}>Continue Reading</Text>
          <TouchableOpacity
            style={styles.featuredCard}
            onPress={() => navigation.navigate('BookReader', { storybook: storybooks[0] })}
          >
            <LinearGradient
              colors={['#7c3aed20', '#a855f720']}
              style={styles.featuredGradient}
            >
              <View style={styles.featuredContent}>
                <Ionicons name="book-outline" size={40} color="#7c3aed" />
                <View style={styles.featuredText}>
                  <Text style={styles.featuredTitle} numberOfLines={1}>
                    {storybooks[0].title}
                  </Text>
                  <Text style={styles.featuredMeta}>
                    {storybooks[0].story_ids.length} chapters
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color="#7c3aed" />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* Storybook grid */}
      <FlatList
        data={storybooks}
        renderItem={renderStorybookCard}
        keyExtractor={(item) => item.id.toString()}
        numColumns={2}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.row}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />

      {/* Quick actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.quickActionButton}
          onPress={() => navigation.navigate('AutoGenerateBook')}
        >
          <Ionicons name="sparkles" size={20} color="#7c3aed" />
          <Text style={styles.quickActionText}>Auto Generate</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.quickActionButton}
          onPress={() => navigation.navigate('Collections')}
        >
          <Ionicons name="albums" size={20} color="#7c3aed" />
          <Text style={styles.quickActionText}>Collections</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.quickActionButton}
          onPress={() => navigation.navigate('Timeline')}
        >
          <Ionicons name="time" size={20} color="#7c3aed" />
          <Text style={styles.quickActionText}>Timeline</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F0E8',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#7c3aed20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Featured section
  featuredSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  featuredCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  featuredGradient: {
    padding: 20,
  },
  featuredContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  featuredText: {
    flex: 1,
  },
  featuredTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  featuredMeta: {
    fontSize: 14,
    color: '#666',
  },
  
  // Book cards
  listContent: {
    padding: 20,
    paddingTop: 8,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  bookCard: {
    width: '48%',
    marginBottom: 20,
  },
  bookCover: {
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  defaultCover: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  bookTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginTop: 12,
  },
  bookSpine: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 8,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  bookInfo: {
    marginTop: 12,
  },
  bookTitleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  bookMeta: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  themeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#7c3aed20',
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  themeBadgeText: {
    fontSize: 10,
    color: '#7c3aed',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  
  // Empty state
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#7c3aed',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Quick actions
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  quickActionButton: {
    alignItems: 'center',
    gap: 4,
  },
  quickActionText: {
    fontSize: 12,
    color: '#7c3aed',
    fontWeight: '600',
  },
});

export default StorybookLibrary;
