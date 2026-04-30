import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { API_URL } from '../config';

const FamilyTree = ({ navigation }) => {
  const [treeNodes, setTreeNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState(null);
  const [showNodeModal, setShowNodeModal] = useState(false);
  const [nodeStories, setNodeStories] = useState([]);

  useEffect(() => {
    fetchFamilyTree();
  }, []);

  const fetchFamilyTree = async () => {
    try {
      const response = await axios.get(`${API_URL}/family/tree`);
      setTreeNodes(response.data.nodes);
    } catch (error) {
      console.error('Error fetching family tree:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchNodeStories = async (nodeId) => {
    try {
      const response = await axios.get(`${API_URL}/storybooks/tree-node/${nodeId}/stories`);
      setNodeStories(response.data.stories);
    } catch (error) {
      console.error('Error fetching node stories:', error);
    }
  };

  const handleNodePress = (node) => {
    setSelectedNode(node);
    fetchNodeStories(node.id);
    setShowNodeModal(true);
  };

  const organizeByGeneration = () => {
    const generations = {};
    treeNodes.forEach((node) => {
      const gen = node.generation || 0;
      if (!generations[gen]) {
        generations[gen] = [];
      }
      generations[gen].push(node);
    });
    return generations;
  };

  const renderTreeNode = (node, isLast = false) => {
    const hasChildren = node.child_ids && node.child_ids.length > 0;
    const isDeceased = node.is_deceased;
    
    return (
      <View key={node.id} style={styles.nodeContainer}>
        <TouchableOpacity
          style={[
            styles.nodeCard,
            isDeceased && styles.nodeCardDeceased,
          ]}
          onPress={() => handleNodePress(node)}
          activeOpacity={0.8}
        >
          {/* Avatar */}
          <View style={[styles.nodeAvatar, isDeceased && styles.nodeAvatarDeceased]}>
            {node.display_avatar ? (
              <Image source={{ uri: node.display_avatar }} style={styles.nodeAvatarImage} />
            ) : (
              <Text style={styles.nodeAvatarText}>
                {node.display_name?.charAt(0).toUpperCase()}
              </Text>
            )}
            {isDeceased && (
              <View style={styles.deceasedBadge}>
                <Ionicons name="flower" size={12} color="#fff" />
              </View>
            )}
          </View>

          {/* Info */}
          <View style={styles.nodeInfo}>
            <Text style={styles.nodeName} numberOfLines={1}>
              {node.display_name}
            </Text>
            {node.relationship_label && (
              <Text style={styles.nodeRelation}>{node.relationship_label}</Text>
            )}
            {node.birth_date && (
              <Text style={styles.nodeDate}>
                {new Date(node.birth_date).getFullYear()}
                {node.death_date && ` - ${new Date(node.death_date).getFullYear()}`}
              </Text>
            )}
          </View>

          {/* Story count badge */}
          <View style={styles.storyBadge}>
            <Ionicons name="book" size={12} color="#7c3aed" />
            <Text style={styles.storyBadgeText}>
              {/* This would come from API */}
              0
            </Text>
          </View>
        </TouchableOpacity>

        {/* Connection lines */}
        {hasChildren && (
          <View style={styles.connectionLine} />
        )}
      </View>
    );
  };

  const renderGeneration = (generation, nodes) => {
    const generationLabels = {
      '-3': 'Great-Grandparents',
      '-2': 'Grandparents',
      '-1': 'Parents',
      '0': 'Current Generation',
      '1': 'Children',
      '2': 'Grandchildren',
    };

    return (
      <View key={generation} style={styles.generationSection}>
        <View style={styles.generationHeader}>
          <View style={styles.generationLine} />
          <Text style={styles.generationLabel}>
            {generationLabels[generation] || `Generation ${generation}`}
          </Text>
          <View style={styles.generationLine} />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.generationNodes}
        >
          {nodes.map((node, index) => renderTreeNode(node, index === nodes.length - 1))}
        </ScrollView>
      </View>
    );
  };

  const renderNodeModal = () => {
    if (!selectedNode) return null;

    return (
      <Modal
        visible={showNodeModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowNodeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderInfo}>
                {selectedNode.display_avatar ? (
                  <Image
                    source={{ uri: selectedNode.display_avatar }}
                    style={styles.modalAvatar}
                  />
                ) : (
                  <View style={[styles.modalAvatar, styles.modalAvatarPlaceholder]}>
                    <Text style={styles.modalAvatarText}>
                      {selectedNode.display_name?.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.modalHeaderText}>
                  <Text style={styles.modalName}>{selectedNode.display_name}</Text>
                  {selectedNode.relationship_label && (
                    <Text style={styles.modalRelation}>{selectedNode.relationship_label}</Text>
                  )}
                </View>
              </View>
              <TouchableOpacity onPress={() => setShowNodeModal(false)}>
                <Ionicons name="close" size={28} color="#1a1a1a" />
              </TouchableOpacity>
            </View>

            {/* Life dates */}
            {(selectedNode.birth_date || selectedNode.death_date) && (
              <View style={styles.modalDates}>
                {selectedNode.birth_date && (
                  <View style={styles.modalDateItem}>
                    <Ionicons name="calendar" size={16} color="#7c3aed" />
                    <Text style={styles.modalDateText}>
                      Born {new Date(selectedNode.birth_date).toLocaleDateString()}
                    </Text>
                  </View>
                )}
                {selectedNode.death_date && (
                  <View style={styles.modalDateItem}>
                    <Ionicons name="flower" size={16} color="#666" />
                    <Text style={styles.modalDateText}>
                      Passed {new Date(selectedNode.death_date).toLocaleDateString()}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Stories section */}
            <View style={styles.modalSection}>
              <View style={styles.modalSectionHeader}>
                <Text style={styles.modalSectionTitle}>Stories</Text>
                <TouchableOpacity
                  style={styles.tagStoryButton}
                  onPress={() => {
                    setShowNodeModal(false);
                    navigation.navigate('TagStory', { nodeId: selectedNode.id });
                  }}
                >
                  <Ionicons name="add" size={20} color="#7c3aed" />
                  <Text style={styles.tagStoryButtonText}>Tag Story</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalStories}>
                {nodeStories.length === 0 ? (
                  <View style={styles.emptyStories}>
                    <Ionicons name="book-outline" size={48} color="#ccc" />
                    <Text style={styles.emptyStoriesText}>
                      No stories tagged yet
                    </Text>
                    <Text style={styles.emptyStoriesSubtext}>
                      Tag stories to preserve memories about {selectedNode.display_name}
                    </Text>
                  </View>
                ) : (
                  nodeStories.map((story) => (
                    <TouchableOpacity
                      key={story.id}
                      style={styles.modalStoryCard}
                      onPress={() => {
                        setShowNodeModal(false);
                        navigation.navigate('StoryDetail', { storyId: story.id });
                      }}
                    >
                      {story.media_url && (
                        <Image
                          source={{ uri: story.media_url }}
                          style={styles.modalStoryImage}
                        />
                      )}
                      <View style={styles.modalStoryInfo}>
                        <Text style={styles.modalStoryTitle} numberOfLines={2}>
                          {story.title}
                        </Text>
                        <Text style={styles.modalStoryDate}>
                          {new Date(story.story_date).toLocaleDateString()}
                        </Text>
                        <Text style={styles.modalStoryAuthor}>
                          by {story.author_name}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color="#ccc" />
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7c3aed" />
        <Text style={styles.loadingText}>Loading family tree...</Text>
      </View>
    );
  }

  const generations = organizeByGeneration();
  const sortedGenerations = Object.keys(generations).sort((a, b) => parseInt(a) - parseInt(b));

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Family Tree</Text>
        
        <TouchableOpacity onPress={() => navigation.navigate('AddTreeMember')}>
          <Ionicons name="person-add" size={24} color="#7c3aed" />
        </TouchableOpacity>
      </View>

      {/* Tree visualization */}
      <ScrollView
        style={styles.treeScroll}
        contentContainerStyle={styles.treeContent}
        showsVerticalScrollIndicator={false}
      >
        {sortedGenerations.map((gen) => renderGeneration(gen, generations[gen]))}

        {/* Empty state */}
        {treeNodes.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="git-network-outline" size={80} color="#ccc" />
            <Text style={styles.emptyTitle}>Build Your Family Tree</Text>
            <Text style={styles.emptySubtitle}>
              Add family members and tag stories to preserve your family history
            </Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => navigation.navigate('AddTreeMember')}
            >
              <Ionicons name="add" size={24} color="#fff" />
              <Text style={styles.addButtonText}>Add Family Member</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Quick actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.quickAction}
          onPress={() => navigation.navigate('TreeView', { view: 'chart' })}
        >
          <Ionicons name="git-network" size={20} color="#7c3aed" />
          <Text style={styles.quickActionText}>Tree View</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.quickAction}
          onPress={() => navigation.navigate('TreeView', { view: 'list' })}
        >
          <Ionicons name="list" size={20} color="#7c3aed" />
          <Text style={styles.quickActionText}>List View</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.quickAction}
          onPress={() => navigation.navigate('TreeExport')}
        >
          <Ionicons name="download" size={20} color="#7c3aed" />
          <Text style={styles.quickActionText}>Export</Text>
        </TouchableOpacity>
      </View>

      {/* Node detail modal */}
      {renderNodeModal()}
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
    backgroundColor: '#F5F0E8',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
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
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  
  // Tree
  treeScroll: {
    flex: 1,
  },
  treeContent: {
    padding: 20,
  },
  generationSection: {
    marginBottom: 32,
  },
  generationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  generationLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e0e0e0',
  },
  generationLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginHorizontal: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  generationNodes: {
    paddingVertical: 8,
    gap: 16,
  },
  
  // Node card
  nodeContainer: {
    alignItems: 'center',
  },
  nodeCard: {
    width: 140,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  nodeCardDeceased: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  nodeAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#7c3aed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    position: 'relative',
  },
  nodeAvatarDeceased: {
    backgroundColor: '#999',
  },
  nodeAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 32,
  },
  nodeAvatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  deceasedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#666',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  nodeInfo: {
    alignItems: 'center',
    width: '100%',
  },
  nodeName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 2,
  },
  nodeRelation: {
    fontSize: 11,
    color: '#7c3aed',
    marginBottom: 2,
  },
  nodeDate: {
    fontSize: 10,
    color: '#999',
  },
  storyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#7c3aed20',
    borderRadius: 12,
  },
  storyBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7c3aed',
  },
  connectionLine: {
    width: 2,
    height: 20,
    backgroundColor: '#e0e0e0',
    marginTop: 8,
  },
  
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalHeaderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modalAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
  },
  modalAvatarPlaceholder: {
    backgroundColor: '#7c3aed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalAvatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  modalHeaderText: {
    flex: 1,
  },
  modalName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  modalRelation: {
    fontSize: 14,
    color: '#7c3aed',
  },
  modalDates: {
    padding: 20,
    gap: 8,
  },
  modalDateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalDateText: {
    fontSize: 14,
    color: '#666',
  },
  modalSection: {
    flex: 1,
  },
  modalSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  modalSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  tagStoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#7c3aed20',
    borderRadius: 8,
  },
  tagStoryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7c3aed',
  },
  modalStories: {
    flex: 1,
    paddingHorizontal: 20,
  },
  modalStoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 12,
  },
  modalStoryImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  modalStoryInfo: {
    flex: 1,
  },
  modalStoryTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  modalStoryDate: {
    fontSize: 12,
    color: '#7c3aed',
    marginBottom: 2,
  },
  modalStoryAuthor: {
    fontSize: 12,
    color: '#666',
  },
  emptyStories: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStoriesText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStoriesSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  
  // Empty state
  emptyState: {
    alignItems: 'center',
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
    paddingHorizontal: 40,
    marginBottom: 32,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#7c3aed',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Quick actions
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  quickAction: {
    alignItems: 'center',
    gap: 4,
  },
  quickActionText: {
    fontSize: 12,
    color: '#7c3aed',
    fontWeight: '600',
  },
});

export default FamilyTree;
