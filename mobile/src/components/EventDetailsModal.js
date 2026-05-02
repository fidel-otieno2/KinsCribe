import { useState, useEffect } from 'react';
import {
  View, StyleSheet, TouchableOpacity, ScrollView,
  Modal, TextInput, ActivityIndicator,
} from 'react-native';
import AppText from '../components/AppText';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import api from '../api/axios';
import { colors, radius } from '../theme';

const EVENT_TYPES = [
  { key: 'birthday', label: '🎂 Birthday', color: '#ec4899' },
  { key: 'anniversary', label: '💍 Anniversary', color: '#f59e0b' },
  { key: 'event', label: '📅 Event', color: '#7c3aed' },
  { key: 'milestone', label: '🏆 Milestone', color: '#10b981' },
  { key: 'appointment', label: '🏥 Appointment', color: '#3b82f6' },
  { key: 'vacation', label: '✈️ Vacation', color: '#06b6d4' },
  { key: 'meeting', label: '👥 Meeting', color: '#8b5cf6' },
];

export default function EventDetailsModal({ visible, onClose, event, onDelete, onEdit, theme, currentUser }) {
  const [reactions, setReactions] = useState([]);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const REACTIONS = ['❤️', '👍', '🎉', '😍', '😂', '😮', '😢', '👏'];
  
  useEffect(() => {
    if (visible && event) {
      fetchReactionsAndComments();
    }
  }, [visible, event]);
  
  const fetchReactionsAndComments = async () => {
    if (!event || !event.id) {
      console.log('No event or event.id:', event);
      return;
    }
    console.log('Fetching reactions/comments for event:', event.id);
    try {
      const [reactionsRes, commentsRes] = await Promise.all([
        api.get(`/extras/calendar/${event.id}/reactions`),
        api.get(`/extras/calendar/${event.id}/comments`),
      ]);
      console.log('Reactions:', reactionsRes.data.reactions);
      console.log('Comments:', commentsRes.data.comments);
      setReactions(reactionsRes.data.reactions || []);
      setComments(commentsRes.data.comments || []);
    } catch (err) {
      console.log('Failed to fetch reactions/comments:', err.response?.data || err.message);
    }
  };
  
  const handleReaction = async (emoji) => {
    if (!event || !event.id) {
      console.log('No event or event.id for reaction');
      return;
    }
    console.log('Adding reaction:', emoji, 'to event:', event.id);
    try {
      const { data } = await api.post(`/extras/calendar/${event.id}/reactions`, { reaction: emoji });
      console.log('Reaction response:', data);
      setReactions(data.reactions || []);
      setShowReactionPicker(false);
    } catch (err) {
      console.log('Failed to add reaction:', err.response?.data || err.message);
      alert('Failed to add reaction: ' + (err.response?.data?.error || err.message));
    }
  };
  
  const handleComment = async () => {
    if (!event || !event.id) {
      console.log('No event or event.id for comment');
      return;
    }
    if (!commentText.trim()) {
      console.log('Empty comment text');
      return;
    }
    console.log('Adding comment:', commentText, 'to event:', event.id);
    setLoading(true);
    try {
      const { data } = await api.post(`/extras/calendar/${event.id}/comments`, { text: commentText });
      console.log('Comment response:', data);
      setComments(prev => [data.comment, ...prev]);
      setCommentText('');
    } catch (err) {
      console.log('Failed to add comment:', err.response?.data || err.message);
      alert('Failed to add comment: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };
  
  if (!event) return null;
  
  const eventType = EVENT_TYPES.find(t => t.key === event.event_type) || EVENT_TYPES[2];
  const eventDate = new Date(event.event_date);
  
  // Group reactions by emoji
  const reactionGroups = reactions.reduce((acc, r) => {
    if (!acc[r.reaction]) acc[r.reaction] = [];
    acc[r.reaction].push(r);
    return acc;
  }, {});
  
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity 
        style={s.overlay} 
        activeOpacity={1} 
        onPress={onClose}
      >
        <BlurView intensity={30} tint="dark" style={s.overlay}>
          <TouchableOpacity 
            activeOpacity={1} 
            style={s.detailsCard}
            onPress={(e) => e.stopPropagation()}
          >
            <LinearGradient 
              colors={[`${event.color}22`, 'rgba(15,23,42,0.95)']} 
              style={StyleSheet.absoluteFill} 
            />
            
            {/* Header */}
            <View style={[s.detailsHeader, { borderBottomColor: theme.border }]}>
              <View style={[s.eventTypeIcon, { backgroundColor: `${event.color}33` }]}>
                <AppText style={{ fontSize: 24 }}>{eventType.label.split(' ')[0]}</AppText>
              </View>
              <TouchableOpacity onPress={onClose} style={s.closeBtn}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            
            {/* Content */}
            <ScrollView style={s.detailsContent} showsVerticalScrollIndicator={false}>
              <AppText style={[s.detailsTitle, { color: theme.text }]}>{event.title}</AppText>
              
              <View style={s.detailsRow}>
                <Ionicons name="calendar-outline" size={20} color={event.color} />
                <View style={{ flex: 1 }}>
                  <AppText style={[s.detailsLabel, { color: theme.muted }]}>Date & Time</AppText>
                  <AppText style={[s.detailsValue, { color: theme.text }]}>
                    {eventDate.toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      month: 'long', 
                      day: 'numeric', 
                      year: 'numeric' 
                    })}
                  </AppText>
                  <AppText style={[s.detailsValue, { color: theme.muted, fontSize: 13 }]}>
                    {eventDate.toLocaleTimeString('en-US', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </AppText>
                </View>
              </View>
              
              {event.description && (
                <View style={s.detailsRow}>
                  <Ionicons name="document-text-outline" size={20} color={event.color} />
                  <View style={{ flex: 1 }}>
                    <AppText style={[s.detailsLabel, { color: theme.muted }]}>Description</AppText>
                    <AppText style={[s.detailsValue, { color: theme.text }]}>
                      {event.description}
                    </AppText>
                  </View>
                </View>
              )}
              
              {event.creator_name && (
                <View style={s.detailsRow}>
                  <Ionicons name="person-outline" size={20} color={event.color} />
                  <View style={{ flex: 1 }}>
                    <AppText style={[s.detailsLabel, { color: theme.muted }]}>Created by</AppText>
                    <AppText style={[s.detailsValue, { color: theme.text }]}>
                      {event.creator_name}
                    </AppText>
                  </View>
                </View>
              )}
              
              {/* Reactions Section */}
              <View style={[s.section, { borderTopColor: theme.border }]}>
                <AppText style={[s.sectionTitle, { color: theme.muted }]}>Reactions</AppText>
                <View style={s.reactionsRow}>
                  {Object.entries(reactionGroups).map(([emoji, users]) => (
                    <View key={emoji} style={[s.reactionBubble, { backgroundColor: theme.bgCard }]}>
                      <AppText style={s.reactionEmoji}>{emoji}</AppText>
                      <AppText style={[s.reactionCount, { color: theme.text }]}>{users.length}</AppText>
                    </View>
                  ))}
                  <TouchableOpacity 
                    style={[s.addReactionBtn, { backgroundColor: theme.bgCard }]}
                    onPress={() => setShowReactionPicker(!showReactionPicker)}
                  >
                    <Ionicons name="add" size={18} color={theme.text} />
                  </TouchableOpacity>
                </View>
                
                {showReactionPicker && (
                  <View style={[s.reactionPicker, { backgroundColor: theme.bgCard }]}>
                    {REACTIONS.map(emoji => (
                      <TouchableOpacity 
                        key={emoji} 
                        style={s.reactionOption}
                        onPress={() => handleReaction(emoji)}
                      >
                        <AppText style={s.reactionOptionEmoji}>{emoji}</AppText>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
              
              {/* Comments Section */}
              <View style={[s.section, { borderTopColor: theme.border }]}>
                <AppText style={[s.sectionTitle, { color: theme.muted }]}>Comments ({comments.length})</AppText>
                
                {/* Comment Input */}
                <View style={[s.commentInput, { backgroundColor: theme.bgCard, borderColor: theme.border2 }]}>
                  <TextInput
                    style={[s.commentTextInput, { color: theme.text }]}
                    placeholder="Add a comment..."
                    placeholderTextColor={theme.dim}
                    value={commentText}
                    onChangeText={setCommentText}
                    multiline
                  />
                  <TouchableOpacity 
                    style={[s.commentSendBtn, !commentText.trim() && { opacity: 0.5 }]}
                    onPress={handleComment}
                    disabled={!commentText.trim() || loading}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons name="send" size={18} color="#fff" />
                    )}
                  </TouchableOpacity>
                </View>
                
                {/* Comments List */}
                {comments.map(comment => (
                  <View key={comment.id} style={[s.commentItem, { borderBottomColor: theme.border }]}>
                    <View style={s.commentHeader}>
                      <AppText style={[s.commentAuthor, { color: theme.text }]}>{comment.user_name}</AppText>
                      <AppText style={[s.commentTime, { color: theme.dim }]}>
                        {new Date(comment.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </AppText>
                    </View>
                    <AppText style={[s.commentText, { color: theme.text }]}>{comment.text}</AppText>
                  </View>
                ))}
                
                {comments.length === 0 && (
                  <AppText style={[s.noComments, { color: theme.dim }]}>No comments yet. Be the first!</AppText>
                )}
              </View>
            </ScrollView>
            
            {/* Actions */}
            {currentUser && (currentUser.role === 'admin' || event.created_by === currentUser.id) && (
              <View style={[s.detailsActions, { borderTopColor: theme.border }]}>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity 
                    style={[s.actionBtn, { flex: 1, backgroundColor: 'rgba(124,58,237,0.1)' }]}
                    onPress={() => {
                      onClose();
                      onEdit(event);
                    }}
                  >
                    <Ionicons name="create-outline" size={20} color={colors.primary} />
                    <AppText style={[s.actionBtnText, { color: colors.primary }]}>Edit</AppText>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[s.actionBtn, { flex: 1, backgroundColor: 'rgba(239,68,68,0.1)' }]}
                    onPress={() => {
                      onClose();
                      onDelete(event);
                    }}
                  >
                    <Ionicons name="trash-outline" size={20} color="#ef4444" />
                    <AppText style={[s.actionBtnText, { color: '#ef4444' }]}>Delete</AppText>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </TouchableOpacity>
        </BlurView>
      </TouchableOpacity>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  detailsCard: { 
    width: '100%', 
    maxWidth: 400,
    maxHeight: '85%',
    borderRadius: radius.xl, 
    overflow: 'hidden',
    backgroundColor: 'rgba(15,23,42,0.98)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.3)',
  },
  detailsHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
  },
  eventTypeIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: { padding: 4 },
  detailsContent: {
    padding: 20,
  },
  detailsTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 24,
  },
  detailsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  detailsLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  detailsValue: {
    fontSize: 15,
    lineHeight: 22,
  },
  section: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  reactionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reactionBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  reactionEmoji: {
    fontSize: 18,
  },
  reactionCount: {
    fontSize: 14,
    fontWeight: '700',
  },
  addReactionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
  },
  reactionOption: {
    padding: 8,
  },
  reactionOptionEmoji: {
    fontSize: 28,
  },
  commentInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  commentTextInput: {
    flex: 1,
    fontSize: 14,
    maxHeight: 80,
  },
  commentSendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: '700',
  },
  commentTime: {
    fontSize: 12,
  },
  commentText: {
    fontSize: 14,
    lineHeight: 20,
  },
  noComments: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },
  detailsActions: {
    padding: 20,
    borderTopWidth: 1,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: radius.md,
  },
  actionBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
