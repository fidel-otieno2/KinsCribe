import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';

const API_URL = 'https://kinscribe-1.onrender.com/api';

export default function StoryPromptEngine({ token, onSelectPrompt }) {
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadPrompts();
  }, []);

  const loadPrompts = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/ai/story-prompts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPrompts(response.data.prompts || []);
    } catch (error) {
      console.error('Load prompts error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPrompts();
    setRefreshing(false);
  };

  const getPromptIcon = (type) => {
    switch (type) {
      case 'gap':
        return 'calendar-outline';
      case 'recent':
        return 'time-outline';
      case 'seasonal':
        return 'leaf-outline';
      case 'ai_generated':
        return 'sparkles-outline';
      default:
        return 'bulb-outline';
    }
  };

  const getPromptColor = (priority) => {
    switch (priority) {
      case 'high':
        return '#ef4444';
      case 'medium':
        return '#f59e0b';
      case 'low':
        return '#10b981';
      default:
        return '#6b7280';
    }
  };

  const getPriorityLabel = (priority) => {
    switch (priority) {
      case 'high':
        return 'Important';
      case 'medium':
        return 'Suggested';
      case 'low':
        return 'Optional';
      default:
        return '';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7c3aed" />
        <Text style={styles.loadingText}>Generating story prompts...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      <View style={styles.header}>
        <Ionicons name="bulb" size={32} color="#7c3aed" />
        <Text style={styles.headerTitle}>What Should You Post?</Text>
        <Text style={styles.headerSubtitle}>
          AI-powered prompts based on your family timeline
        </Text>
      </View>

      {prompts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="checkmark-circle" size={64} color="#10b981" />
          <Text style={styles.emptyTitle}>All Caught Up!</Text>
          <Text style={styles.emptyText}>
            Your family timeline is complete. Check back later for new prompts.
          </Text>
        </View>
      ) : (
        <View style={styles.promptsContainer}>
          {prompts.map((prompt, index) => (
            <TouchableOpacity
              key={index}
              style={styles.promptCard}
              onPress={() => onSelectPrompt?.(prompt)}
              activeOpacity={0.7}
            >
              <View style={styles.promptHeader}>
                <View
                  style={[
                    styles.iconContainer,
                    { backgroundColor: `${getPromptColor(prompt.priority)}20` },
                  ]}
                >
                  <Ionicons
                    name={getPromptIcon(prompt.type)}
                    size={24}
                    color={getPromptColor(prompt.priority)}
                  />
                </View>

                {prompt.priority && (
                  <View
                    style={[
                      styles.priorityBadge,
                      { backgroundColor: getPromptColor(prompt.priority) },
                    ]}
                  >
                    <Text style={styles.priorityText}>
                      {getPriorityLabel(prompt.priority)}
                    </Text>
                  </View>
                )}
              </View>

              <Text style={styles.promptText}>{prompt.prompt}</Text>

              {prompt.year && (
                <View style={styles.yearTag}>
                  <Ionicons name="calendar" size={14} color="#7c3aed" />
                  <Text style={styles.yearText}>{prompt.year}</Text>
                </View>
              )}

              <View style={styles.promptFooter}>
                <Text style={styles.typeLabel}>
                  {prompt.type.replace('_', ' ').toUpperCase()}
                </Text>
                <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.infoCard}>
        <Ionicons name="information-circle" size={24} color="#7c3aed" />
        <View style={styles.infoContent}>
          <Text style={styles.infoTitle}>How it works</Text>
          <Text style={styles.infoText}>
            AI analyzes your family timeline to find gaps, suggest seasonal
            stories, and remind you about important dates. Tap any prompt to
            start writing!
          </Text>
        </View>
      </View>

      <View style={styles.statsCard}>
        <Text style={styles.statsTitle}>Timeline Coverage</Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{prompts.length}</Text>
            <Text style={styles.statLabel}>Prompts</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {prompts.filter((p) => p.priority === 'high').length}
            </Text>
            <Text style={styles.statLabel}>Important</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {prompts.filter((p) => p.type === 'gap').length}
            </Text>
            <Text style={styles.statLabel}>Gaps</Text>
          </View>
        </View>
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
    textAlign: 'center',
  },
  emptyContainer: {
    padding: 48,
    alignItems: 'center',
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
  promptsContainer: {
    padding: 16,
  },
  promptCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  promptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  priorityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  promptText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    lineHeight: 26,
    marginBottom: 12,
  },
  yearTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#ede9fe',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 12,
    gap: 6,
  },
  yearText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7c3aed',
  },
  promptFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  typeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9ca3af',
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#ede9fe',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#7c3aed',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    color: '#6b21a8',
    lineHeight: 20,
  },
  statsCard: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#7c3aed',
  },
  statLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#e5e7eb',
  },
});
