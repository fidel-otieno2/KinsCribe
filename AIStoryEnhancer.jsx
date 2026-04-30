import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { API_URL } from '../config';

const AIStoryEnhancer = ({ visible, onClose, initialText, onApprove }) => {
  const [originalText, setOriginalText] = useState(initialText || '');
  const [enhancedText, setEnhancedText] = useState('');
  const [suggestedTitle, setSuggestedTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [showComparison, setShowComparison] = useState(false);

  const handleEnhance = async () => {
    if (!originalText.trim()) {
      alert('Please enter some text to enhance');
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post(`${API_URL}/ai/enhance-story`, {
        text: originalText,
      });

      setEnhancedText(response.data.enhanced);
      setSuggestedTitle(response.data.suggested_title);
      setShowComparison(true);
    } catch (error) {
      console.error('Enhancement error:', error);
      alert('Failed to enhance story. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = () => {
    onApprove({
      title: suggestedTitle,
      content: enhancedText,
      original: originalText,
    });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={28} color="#1a1a1a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>AI Story Enhancer</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView style={styles.content}>
          {!showComparison ? (
            // Input stage
            <View style={styles.inputStage}>
              <View style={styles.infoCard}>
                <Ionicons name="sparkles" size={32} color="#7c3aed" />
                <Text style={styles.infoTitle}>Transform Your Story</Text>
                <Text style={styles.infoText}>
                  Write in your own words - rough notes, voice transcripts, or short
                  captions. AI will enhance it into a beautiful narrative while keeping
                  all your facts and emotions.
                </Text>
              </View>

              <Text style={styles.label}>Your Story (rough draft)</Text>
              <TextInput
                style={styles.textInput}
                multiline
                placeholder="Type or paste your story here... It can be rough notes, broken sentences, or a voice transcript. AI will make it beautiful!"
                value={originalText}
                onChangeText={setOriginalText}
                textAlignVertical="top"
              />

              <TouchableOpacity
                style={[styles.enhanceButton, loading && styles.enhanceButtonDisabled]}
                onPress={handleEnhance}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="sparkles" size={24} color="#fff" />
                    <Text style={styles.enhanceButtonText}>Enhance with AI</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            // Comparison stage
            <View style={styles.comparisonStage}>
              <View style={styles.titlePreview}>
                <Text style={styles.titleLabel}>Suggested Title</Text>
                <TextInput
                  style={styles.titleInput}
                  value={suggestedTitle}
                  onChangeText={setSuggestedTitle}
                  placeholder="Story title"
                />
              </View>

              {/* Before */}
              <View style={styles.comparisonSection}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="document-text-outline" size={20} color="#999" />
                  <Text style={styles.sectionTitle}>Before (Original)</Text>
                </View>
                <ScrollView style={styles.textPreview}>
                  <Text style={styles.originalText}>{originalText}</Text>
                </ScrollView>
              </View>

              {/* Arrow */}
              <View style={styles.arrowContainer}>
                <Ionicons name="arrow-down" size={32} color="#7c3aed" />
                <Text style={styles.arrowText}>AI Enhanced</Text>
              </View>

              {/* After */}
              <View style={styles.comparisonSection}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="sparkles" size={20} color="#7c3aed" />
                  <Text style={[styles.sectionTitle, { color: '#7c3aed' }]}>
                    After (Enhanced)
                  </Text>
                </View>
                <ScrollView style={styles.textPreview}>
                  <Text style={styles.enhancedText}>{enhancedText}</Text>
                </ScrollView>
              </View>

              {/* Actions */}
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.approveButton}
                  onPress={handleApprove}
                >
                  <Ionicons name="checkmark-circle" size={24} color="#fff" />
                  <Text style={styles.approveButtonText}>Use Enhanced Version</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.rejectButton}
                  onPress={() => setShowComparison(false)}
                >
                  <Text style={styles.rejectButtonText}>Try Again</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.keepOriginalButton}
                  onPress={() => {
                    onApprove({
                      title: suggestedTitle,
                      content: originalText,
                      original: originalText,
                    });
                    onClose();
                  }}
                >
                  <Text style={styles.keepOriginalButtonText}>
                    Keep Original Instead
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F0E8',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  content: {
    flex: 1,
  },
  
  // Input stage
  inputStage: {
    padding: 20,
  },
  infoCard: {
    backgroundColor: '#7c3aed10',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginTop: 12,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  textInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1a1a1a',
    minHeight: 200,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 20,
  },
  enhanceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#7c3aed',
    paddingVertical: 16,
    borderRadius: 12,
  },
  enhanceButtonDisabled: {
    opacity: 0.6,
  },
  enhanceButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Comparison stage
  comparisonStage: {
    padding: 20,
  },
  titlePreview: {
    marginBottom: 24,
  },
  titleLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  titleInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  comparisonSection: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  textPreview: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    maxHeight: 150,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  originalText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  enhancedText: {
    fontSize: 15,
    color: '#1a1a1a',
    lineHeight: 22,
  },
  arrowContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  arrowText: {
    fontSize: 12,
    color: '#7c3aed',
    fontWeight: '600',
    marginTop: 4,
  },
  
  // Actions
  actions: {
    marginTop: 24,
    gap: 12,
  },
  approveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10b981',
    paddingVertical: 16,
    borderRadius: 12,
  },
  approveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  rejectButton: {
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  rejectButtonText: {
    color: '#7c3aed',
    fontSize: 14,
    fontWeight: '600',
  },
  keepOriginalButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  keepOriginalButtonText: {
    color: '#999',
    fontSize: 14,
  },
});

export default AIStoryEnhancer;
