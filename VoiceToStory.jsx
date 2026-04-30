import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import axios from 'axios';
import { API_URL } from '../config';

const VoiceToStory = ({ visible, onClose, onStoryCreated }) => {
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  
  const durationInterval = useRef(null);

  const startRecording = async () => {
    try {
      // Request permissions
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        alert('Permission to access microphone is required!');
        return;
      }

      // Configure audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Start recording
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(recording);
      setIsRecording(true);
      setRecordingDuration(0);

      // Update duration every second
      durationInterval.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('Failed to start recording. Please try again.');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      clearInterval(durationInterval.current);
      setIsRecording(false);

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();

      // Process the recording
      await processRecording(uri);
    } catch (error) {
      console.error('Failed to stop recording:', error);
      alert('Failed to stop recording. Please try again.');
    }
  };

  const processRecording = async (uri) => {
    try {
      setProcessing(true);

      // Create form data
      const formData = new FormData();
      formData.append('audio', {
        uri,
        type: 'audio/m4a',
        name: 'recording.m4a',
      });

      // Send to API
      const response = await axios.post(`${API_URL}/ai/voice-to-story`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setResult(response.data);
    } catch (error) {
      console.error('Processing error:', error);
      alert('Failed to process recording. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCreateStory = () => {
    onStoryCreated({
      title: result.title,
      content: result.content,
      transcript: result.transcript,
      audio_url: result.audio_url,
      summary: result.summary,
      tags: result.suggested_tags,
      location: result.key_locations?.[0],
      story_date: result.estimated_date,
    });
    onClose();
  };

  const reset = () => {
    setRecording(null);
    setIsRecording(false);
    setRecordingDuration(0);
    setProcessing(false);
    setResult(null);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={28} color="#1a1a1a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Voice to Story</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {!result ? (
            // Recording stage
            <View style={styles.recordingStage}>
              <View style={styles.infoCard}>
                <Ionicons name="mic" size={48} color="#7c3aed" />
                <Text style={styles.infoTitle}>Record Your Story</Text>
                <Text style={styles.infoText}>
                  Just talk naturally! AI will transcribe your voice, structure it into a
                  beautiful story, and even suggest a title. Perfect for capturing memories
                  on the go.
                </Text>
              </View>

              {/* Recording visualizer */}
              <View style={styles.visualizer}>
                <View style={[styles.recordButton, isRecording && styles.recordButtonActive]}>
                  {isRecording ? (
                    <View style={styles.recordingIndicator}>
                      <View style={styles.recordingDot} />
                    </View>
                  ) : (
                    <Ionicons name="mic" size={48} color="#fff" />
                  )}
                </View>

                {isRecording && (
                  <View style={styles.waveform}>
                    {[...Array(20)].map((_, i) => (
                      <View
                        key={i}
                        style={[
                          styles.waveBar,
                          {
                            height: Math.random() * 40 + 10,
                            animationDelay: `${i * 0.1}s`,
                          },
                        ]}
                      />
                    ))}
                  </View>
                )}
              </View>

              {/* Duration */}
              {isRecording && (
                <Text style={styles.duration}>{formatDuration(recordingDuration)}</Text>
              )}

              {/* Controls */}
              <View style={styles.controls}>
                {!isRecording ? (
                  <TouchableOpacity style={styles.startButton} onPress={startRecording}>
                    <Ionicons name="mic" size={24} color="#fff" />
                    <Text style={styles.startButtonText}>Start Recording</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.stopButton} onPress={stopRecording}>
                    <Ionicons name="stop" size={24} color="#fff" />
                    <Text style={styles.stopButtonText}>Stop & Process</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Tips */}
              <View style={styles.tips}>
                <Text style={styles.tipsTitle}>💡 Tips for best results:</Text>
                <Text style={styles.tipItem}>• Speak clearly and at a normal pace</Text>
                <Text style={styles.tipItem}>• Mention dates, places, and people</Text>
                <Text style={styles.tipItem}>• Don't worry about perfect grammar</Text>
                <Text style={styles.tipItem}>• Record for at least 30 seconds</Text>
              </View>

              {/* Processing overlay */}
              {processing && (
                <View style={styles.processingOverlay}>
                  <ActivityIndicator size="large" color="#7c3aed" />
                  <Text style={styles.processingText}>
                    AI is transcribing and structuring your story...
                  </Text>
                  <Text style={styles.processingSubtext}>This may take a moment</Text>
                </View>
              )}
            </View>
          ) : (
            // Result stage
            <View style={styles.resultStage}>
              <View style={styles.successBadge}>
                <Ionicons name="checkmark-circle" size={60} color="#10b981" />
                <Text style={styles.successText}>Story Created!</Text>
              </View>

              {/* Title */}
              <View style={styles.resultSection}>
                <Text style={styles.resultLabel}>Title</Text>
                <Text style={styles.resultTitle}>{result.title}</Text>
              </View>

              {/* Content */}
              <View style={styles.resultSection}>
                <Text style={styles.resultLabel}>Story</Text>
                <ScrollView style={styles.contentPreview}>
                  <Text style={styles.contentText}>{result.content}</Text>
                </ScrollView>
              </View>

              {/* Metadata */}
              <View style={styles.metadata}>
                {result.estimated_date && (
                  <View style={styles.metadataItem}>
                    <Ionicons name="calendar" size={16} color="#7c3aed" />
                    <Text style={styles.metadataText}>{result.estimated_date}</Text>
                  </View>
                )}
                {result.key_locations?.length > 0 && (
                  <View style={styles.metadataItem}>
                    <Ionicons name="location" size={16} color="#7c3aed" />
                    <Text style={styles.metadataText}>{result.key_locations[0]}</Text>
                  </View>
                )}
              </View>

              {/* Tags */}
              {result.suggested_tags?.length > 0 && (
                <View style={styles.tags}>
                  <Text style={styles.tagsLabel}>Suggested Tags</Text>
                  <View style={styles.tagsList}>
                    {result.suggested_tags.map((tag, index) => (
                      <View key={index} style={styles.tag}>
                        <Text style={styles.tagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Transcript */}
              <TouchableOpacity
                style={styles.transcriptToggle}
                onPress={() => {
                  // Toggle transcript visibility
                }}
              >
                <Ionicons name="document-text" size={16} color="#7c3aed" />
                <Text style={styles.transcriptToggleText}>View Original Transcript</Text>
              </TouchableOpacity>

              {/* Actions */}
              <View style={styles.actions}>
                <TouchableOpacity style={styles.createButton} onPress={handleCreateStory}>
                  <Ionicons name="checkmark" size={24} color="#fff" />
                  <Text style={styles.createButtonText}>Create Story</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.retryButton} onPress={reset}>
                  <Text style={styles.retryButtonText}>Record Again</Text>
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
  contentContainer: {
    padding: 20,
  },
  
  // Recording stage
  recordingStage: {
    flex: 1,
  },
  infoCard: {
    backgroundColor: '#7c3aed10',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 40,
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
  visualizer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  recordButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#7c3aed',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  recordButtonActive: {
    backgroundColor: '#ef4444',
  },
  recordingIndicator: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ef4444',
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 24,
    height: 60,
  },
  waveBar: {
    width: 4,
    backgroundColor: '#7c3aed',
    borderRadius: 2,
  },
  duration: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 32,
  },
  controls: {
    marginBottom: 32,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#7c3aed',
    paddingVertical: 16,
    borderRadius: 12,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ef4444',
    paddingVertical: 16,
    borderRadius: 12,
  },
  stopButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  tips: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  tipItem: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(245, 240, 232, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  processingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginTop: 20,
    textAlign: 'center',
  },
  processingSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  
  // Result stage
  resultStage: {
    flex: 1,
  },
  successBadge: {
    alignItems: 'center',
    marginBottom: 32,
  },
  successText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#10b981',
    marginTop: 12,
  },
  resultSection: {
    marginBottom: 24,
  },
  resultLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  contentPreview: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    maxHeight: 200,
  },
  contentText: {
    fontSize: 15,
    color: '#1a1a1a',
    lineHeight: 22,
  },
  metadata: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  metadataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metadataText: {
    fontSize: 14,
    color: '#666',
  },
  tags: {
    marginBottom: 24,
  },
  tagsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  tagsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: '#7c3aed20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagText: {
    fontSize: 12,
    color: '#7c3aed',
    fontWeight: '600',
  },
  transcriptToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    marginBottom: 24,
  },
  transcriptToggleText: {
    fontSize: 14,
    color: '#7c3aed',
    fontWeight: '600',
  },
  actions: {
    gap: 12,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10b981',
    paddingVertical: 16,
    borderRadius: 12,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  retryButton: {
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  retryButtonText: {
    color: '#7c3aed',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default VoiceToStory;
