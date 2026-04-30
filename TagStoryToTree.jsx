import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { API_URL } from '../config';

const TagStoryToTree = ({ route, navigation }) => {
  const { storyId, nodeId } = route.params;
  
  const [stories, setStories] = useState([]);
  const [treeMembers, setTreeMembers] = useState([]);
  const [selectedStory, setSelectedStory] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [tagging, setTagging] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [storiesRes, membersRes] = await Promise.all([
        axios.get(`${API_URL}/stories/family`),
        axios.get(`${API_URL}/family/tree`),
      ]);
      
      setStories(storiesRes.data.stories);
      setTreeMembers(membersRes.data.nodes);
      
      // Pre-select if passed as params
      if (storyId) {
        const story = storiesRes.data.stories.find(s => s.id === storyId);
        setSelectedStory(story);
      }
      if (nodeId) {
        const member = membersRes.data.nodes.find(n => n.id === nodeId);
        setSelectedMember(member);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTag = async () => {
    if (!selectedStory || !selectedMember) {
      alert('Please select both a story and a family member');
      return;
    }

    try {
      setTagging(true);
      await axios.post(`${API_URL}/storybooks/${selectedStory.id}/tag-person`, {
        tree_node_id: selectedMember.id,
      });
      
      alert(`Successfully tagged "${selectedStory.title}" to ${selectedMember.display_name}`);
      navigation.goBack();
    } catch (error) {
      console.error('Error tagging story:', error);
      alert('Failed to tag story. Please try again.');
    } finally {
      setTagging(false);
    }
  };

  const filteredStories = stories.filter(story =>
    story.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredMembers = treeMembers.filter(member =>
    member.display_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderStoryItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.itemCard,
        selectedStory?.id === item.id && styles.itemCardSelected,
      ]}
      onPress={() => setSelectedStory(item)}
    >
      {item.media_url && (
        <Image source={{ uri: item.media_url }} style={styles.itemImage} />
      )}
      <View style={styles.itemInfo}>
        <Text style={styles.itemTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.itemMeta}>
          {new Date(item.story_date || item.created_at).toLocaleDateString()}
        </Text>
        {item.location && (
          <Text style={styles.itemLocation} numberOfLines={1}>
            📍 {item.location}
          </Text>
        )}
      </View>
      {selectedStory?.id === item.id && (
        <Ionicons name="checkmark-circle" size={24} color="#10b981" />
      )}
    </TouchableOpacity>
  );

  const renderMemberItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.memberCard,
        selectedMember?.id === item.id && styles.memberCardSelected,
      ]}
      onPress={() => setSelectedMember(item)}
    >
      <View style={styles.memberAvatar}>
        {item.display_avatar ? (
          <Image source={{ uri: item.display_avatar }} style={styles.memberAvatarImage} />
        ) : (
          <Text style={styles.memberAvatarText}>
            {item.display_name?.charAt(0).toUpperCase()}
          </Text>
        )}
      </View>
      <View style={styles.memberInfo}>
        <Text style={styles.memberName}>{item.display_name}</Text>
        {item.relationship_label && (
          <Text style={styles.memberRelation}>{item.relationship_label}</Text>
        )}
        {item.birth_date && (
          <Text style={styles.memberDate}>
            {new Date(item.birth_date).getFullYear()}
            {item.death_date && ` - ${new Date(item.death_date).getFullYear()}`}
          </Text>
        )}
      </View>
      {selectedMember?.id === item.id && (
        <Ionicons name="checkmark-circle" size={24} color="#10b981" />
      )}
    </TouchableOpacity>
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
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={28} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tag Story to Person</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* Progress indicator */}
      <View style={styles.progress}>
        <View style={[styles.progressStep, selectedStory && styles.progressStepActive]}>
          <View style={[styles.progressDot, selectedStory && styles.progressDotActive]}>
            <Text style={styles.progressDotText}>1</Text>
          </View>
          <Text style={styles.progressLabel}>Select Story</Text>
        </View>
        <View style={styles.progressLine} />
        <View style={[styles.progressStep, selectedMember && styles.progressStepActive]}>
          <View style={[styles.progressDot, selectedMember && styles.progressDotActive]}>
            <Text style={styles.progressDotText}>2</Text>
          </View>
          <Text style={styles.progressLabel}>Select Person</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#999" />
        <TextInput
          style={styles.searchInput}
          placeholder={selectedStory ? "Search family members..." : "Search stories..."}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      {!selectedStory ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select a Story</Text>
          <FlatList
            data={filteredStories}
            renderItem={renderStoryItem}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.list}
          />
        </View>
      ) : !selectedMember ? (
        <View style={styles.section}>
          <View style={styles.selectedPreview}>
            <Text style={styles.selectedLabel}>Selected Story:</Text>
            <View style={styles.selectedCard}>
              <Text style={styles.selectedTitle}>{selectedStory.title}</Text>
              <TouchableOpacity onPress={() => setSelectedStory(null)}>
                <Text style={styles.changeText}>Change</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <Text style={styles.sectionTitle}>Select a Family Member</Text>
          <FlatList
            data={filteredMembers}
            renderItem={renderMemberItem}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.list}
          />
        </View>
      ) : (
        <View style={styles.confirmSection}>
          <Ionicons name="link" size={60} color="#7c3aed" />
          <Text style={styles.confirmTitle}>Ready to Tag</Text>
          
          <View style={styles.confirmCard}>
            <Text style={styles.confirmLabel}>Story</Text>
            <Text style={styles.confirmValue}>{selectedStory.title}</Text>
          </View>
          
          <Ionicons name="arrow-down" size={32} color="#7c3aed" />
          
          <View style={styles.confirmCard}>
            <Text style={styles.confirmLabel}>Person</Text>
            <Text style={styles.confirmValue}>{selectedMember.display_name}</Text>
            {selectedMember.relationship_label && (
              <Text style={styles.confirmRelation}>{selectedMember.relationship_label}</Text>
            )}
          </View>

          <TouchableOpacity
            style={styles.confirmButton}
            onPress={handleTag}
            disabled={tagging}
          >
            {tagging ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark" size={24} color="#fff" />
                <Text style={styles.confirmButtonText}>Confirm Tag</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.resetButton}
            onPress={() => {
              setSelectedStory(null);
              setSelectedMember(null);
            }}
          >
            <Text style={styles.resetButtonText}>Start Over</Text>
          </TouchableOpacity>
        </View>
      )}
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
  
  // Header
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  
  // Progress
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  progressStep: {
    alignItems: 'center',
  },
  progressStepActive: {
    opacity: 1,
  },
  progressDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressDotActive: {
    backgroundColor: '#7c3aed',
  },
  progressDotText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  progressLabel: {
    fontSize: 12,
    color: '#666',
  },
  progressLine: {
    width: 60,
    height: 2,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 16,
  },
  
  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1a1a1a',
  },
  
  // Section
  section: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  list: {
    padding: 16,
    gap: 12,
  },
  
  // Story item
  itemCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    gap: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  itemCardSelected: {
    borderColor: '#10b981',
    backgroundColor: '#10b98110',
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  itemInfo: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  itemMeta: {
    fontSize: 12,
    color: '#7c3aed',
    marginBottom: 2,
  },
  itemLocation: {
    fontSize: 12,
    color: '#666',
  },
  
  // Member item
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  memberCardSelected: {
    borderColor: '#10b981',
    backgroundColor: '#10b98110',
  },
  memberAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#7c3aed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
  },
  memberAvatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  memberRelation: {
    fontSize: 13,
    color: '#7c3aed',
    marginBottom: 2,
  },
  memberDate: {
    fontSize: 12,
    color: '#999',
  },
  
  // Selected preview
  selectedPreview: {
    padding: 16,
    backgroundColor: '#fff',
    marginBottom: 16,
  },
  selectedLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  selectedCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#7c3aed10',
    borderRadius: 8,
  },
  selectedTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
    flex: 1,
  },
  changeText: {
    fontSize: 14,
    color: '#7c3aed',
    fontWeight: '600',
  },
  
  // Confirm
  confirmSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  confirmTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginTop: 16,
    marginBottom: 32,
  },
  confirmCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginVertical: 8,
  },
  confirmLabel: {
    fontSize: 12,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  confirmValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    textAlign: 'center',
  },
  confirmRelation: {
    fontSize: 14,
    color: '#7c3aed',
    marginTop: 4,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#7c3aed',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 32,
    minWidth: 200,
    justifyContent: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resetButton: {
    marginTop: 16,
    paddingVertical: 12,
  },
  resetButtonText: {
    color: '#7c3aed',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default TagStoryToTree;
