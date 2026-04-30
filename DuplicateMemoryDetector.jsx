import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';

const API_URL = 'https://kinscribe-1.onrender.com/api';

export default function DuplicateMemoryDetector({ token, onMerge }) {
  const [duplicates, setDuplicates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [merging, setMerging] = useState(null);

  useEffect(() => {
    detectDuplicates();
  }, []);

  const detectDuplicates = async () => {
    try {
      setLoading(true);
      const response = await axios.post(
        `${API_URL}/ai/detect-duplicates`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setDuplicates(response.data.duplicates || []);
    } catch (error) {
      console.error('Duplicate detection error:', error);
      Alert.alert('Error', 'Failed to detect duplicates');
    } finally {
      setLoading(false);
    }
  };

  const handleMerge = async (duplicate) => {
    Alert.alert(
      'Merge Stories',
      `Merge "${duplicate.story1.title}" and "${duplicate.story2.title}" into one shared story?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Merge',
          onPress: async () => {
            try {
              setMerging(duplicate);
              // Create collaborative story
              const response = await axios.post(
                `${API_URL}/storybooks/collaborative-story`,
                {
                  title: `${duplicate.story1.title} (Shared Memory)`,
                  story_ids: [duplicate.story1.id, duplicate.story2.id],
                  description: `A shared memory from ${duplicate.story1.author} and ${duplicate.story2.author}`,
                },
                { headers: { Authorization: `Bearer ${token}` } }
              );
              
              Alert.alert('Success', 'Stories merged into one shared memory!');
              setDuplicates(prev => prev.filter(d => d !== duplicate));
              onMerge?.(response.data);
            } catch (error) {
              Alert.alert('Error', 'Failed to merge stories');
            } finally {
              setMerging(null);
            }
          },
        },
      ]
    );
  };

  const handleDismiss = (duplicate) => {
    setDuplicates(prev => prev.filter(d => d !== duplicate));
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7c3aed" />
        <Text style={styles.loadingText}>Detecting duplicate memories...</Text>
      </View>
    );
  }

  if (duplicates.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="checkmark-circle" size={64} color="#10b981" />
        <Text style={styles.emptyTitle}>No Duplicates Found</Text>
        <Text style={styles.emptyText}>
          All your family stories are unique!
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="copy-outline" size={32} color="#7c3aed" />
        <Text style={styles.headerTitle}>Duplicate Memories Detected</Text>
        <Text style={styles.headerSubtitle}>
          {duplicates.length} {duplicates.length === 1 ? 'pair' : 'pairs'} of stories about the same event
        </Text>
      </View>

      {duplicates.map((duplicate, index) => (
        <View key={index} style={styles.duplicateCard}>
          <View style={styles.confidenceBadge}>
            <Text style={styles.confidenceText}>
              {duplicate.confidence.toUpperCase()} MATCH
            </Text>
          </View>

          <Text style={styles.reasonText}>{duplicate.reason}</Text>

          {/* Story 1 */}
          <View style={styles.storyCard}>
            <View style={styles.storyHeader}>
              <Ionicons name="person-circle" size={24} color="#7c3aed" />
              <Text style={styles.authorName}>{duplicate.story1.author}</Text>
            </View>
            <Text style={styles.storyTitle}>{duplicate.story1.title}</Text>
            <Text style={styles.storyDate}>{duplicate.story1.date}</Text>
          </View>

          {/* VS Divider */}
          <View style={styles.vsDivider}>
            <View style={styles.vsLine} />
            <Text style={styles.vsText}>VS</Text>
            <View style={styles.vsLine} />
          </View>

          {/* Story 2 */}
          <View style={styles.storyCard}>
            <View style={styles.storyHeader}>
              <Ionicons name="person-circle" size={24} color="#7c3aed" />
              <Text style={styles.authorName}>{duplicate.story2.author}</Text>
            </View>
            <Text style={styles.storyTitle}>{duplicate.story2.title}</Text>
            <Text style={styles.storyDate}>{duplicate.story2.date}</Text>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.dismissButton}
              onPress={() => handleDismiss(duplicate)}
            >
              <Ionicons name="close" size={20} color="#6b7280" />
              <Text style={styles.dismissText}>Not the same</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.mergeButton,
                merging === duplicate && styles.mergeButtonDisabled,
              ]}
              onPress={() => handleMerge(duplicate)}
              disabled={merging === duplicate}
            >
              {merging === duplicate ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="git-merge" size={20} color="#fff" />
                  <Text style={styles.mergeText}>Merge Stories</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ))}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Merging creates one shared story with both perspectives
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
  },
  header: {
    padding: 24,
    backgroundColor: '#fff',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 12,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  duplicateCard: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  confidenceBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 12,
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#92400e',
  },
  reasonText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  storyCard: {
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  storyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7c3aed',
    marginLeft: 8,
  },
  storyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  storyDate: {
    fontSize: 14,
    color: '#6b7280',
  },
  vsDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  vsLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  vsText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#9ca3af',
    marginHorizontal: 12,
  },
  actions: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  dismissButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  dismissText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  mergeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7c3aed',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  mergeButtonDisabled: {
    opacity: 0.6,
  },
  mergeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  footer: {
    padding: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
});
