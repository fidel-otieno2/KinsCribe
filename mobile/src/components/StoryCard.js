import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image,
  Modal, Alert, Share, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import VideoPlayer from './VideoPlayer';
import { colors } from '../theme';

export default function StoryCard({ story, onUpdate, isVisible = true }) {
  const { user } = useAuth();

  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [imgLoading, setImgLoading] = useState(true);
  const [imgError, setImgError] = useState(false);

  const mediaUrl = story.media_url?.startsWith('http') ? story.media_url : null;

  const isVideo = story.media_type === 'video' && mediaUrl;
  const isImage = story.media_type === 'image' && mediaUrl;
  const isOwner = story.user_id === user?.id;

  // ─── ACTIONS ─────────────────────────────
  const toggleLike = async () => {
    setLiked(!liked);
    try {
      await api.post(`/stories/${story.id}/like`);
    } catch {
      setLiked(liked);
    }
  };

  const toggleSave = async () => {
    setSaved(!saved);
    try {
      await api.post(`/stories/${story.id}/save`);
    } catch {
      setSaved(saved);
    }
  };

  const deleteStory = async () => {
    try {
      await api.delete(`/stories/${story.id}`);
      onUpdate?.();
    } catch {
      Alert.alert('Error', 'Failed to delete');
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({ message: story.title });
    } catch {}
  };

  return (
    <View style={s.card}>
      {/* ─── HEADER ───────────────────────── */}
      <View style={s.header}>
        <View style={s.avatar}>
          {story.author_avatar ? (
            <Image source={{ uri: story.author_avatar }} style={s.avatarImg} />
          ) : (
            <Text style={{ color: '#fff' }}>
              {story.author_name?.[0] || 'U'}
            </Text>
          )}
        </View>

        <View style={{ flex: 1 }}>
          <Text style={s.username}>{story.author_name}</Text>

          <View style={s.metaRow}>
            {story.location && (
              <>
                <Ionicons name="location-outline" size={12} color="#aaa" />
                <Text style={s.metaText}>{story.location}</Text>
              </>
            )}
            <Text style={s.metaText}>
              {new Date(story.created_at).toLocaleDateString()}
            </Text>
          </View>
        </View>

        <TouchableOpacity onPress={() => setShowMenu(true)}>
          <Ionicons name="ellipsis-horizontal" size={20} color="#aaa" />
        </TouchableOpacity>
      </View>

      {/* ─── MEDIA ───────────────────────── */}
      <View style={s.mediaContainer}>
        {isVideo ? (
          <VideoPlayer uri={mediaUrl} isVisible={isVisible} />
        ) : isImage ? (
          <>
            {imgLoading && (
              <ActivityIndicator style={s.loader} color="#fff" />
            )}

            <Image
              source={{ uri: mediaUrl }}
              style={s.media}
              resizeMode="cover"
              onLoadEnd={() => setImgLoading(false)}
              onError={() => {
                setImgError(true);
                setImgLoading(false);
              }}
            />

            {imgError && (
              <View style={s.errorBox}>
                <Ionicons name="image-outline" size={40} color="#555" />
                <Text style={{ color: '#888' }}>Failed to load image</Text>
              </View>
            )}
          </>
        ) : (
          <View style={s.errorBox}>
            <Text style={{ color: '#888' }}>No media available</Text>
          </View>
        )}

        {/* 🎵 MUSIC OVERLAY */}
        {story.music_name && (
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)']}
            style={s.musicOverlay}
          >
            <Ionicons name="musical-notes" size={16} color="#fff" />
            <Text style={s.musicText}>{story.music_name}</Text>
          </LinearGradient>
        )}
      </View>

      {/* ─── ACTIONS ───────────────────────── */}
      <View style={s.actions}>
        <View style={s.leftActions}>
          <TouchableOpacity onPress={toggleLike}>
            <Ionicons
              name={liked ? 'heart' : 'heart-outline'}
              size={26}
              color={liked ? '#e11d48' : '#fff'}
            />
          </TouchableOpacity>

          <TouchableOpacity>
            <Ionicons name="chatbubble-outline" size={24} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity onPress={handleShare}>
            <Ionicons name="paper-plane-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={toggleSave}>
          <Ionicons
            name={saved ? 'bookmark' : 'bookmark-outline'}
            size={24}
            color={saved ? '#7c3aed' : '#fff'}
          />
        </TouchableOpacity>
      </View>

      {/* ─── CAPTION ───────────────────────── */}
      <View style={s.captionBox}>
        <Text style={s.caption}>
          <Text style={s.username}>{story.author_name} </Text>
          {story.title}
        </Text>
      </View>

      {/* ─── MENU ───────────────────────── */}
      <Modal visible={showMenu} transparent animationType="fade">
        <TouchableOpacity style={s.menuBackdrop} onPress={() => setShowMenu(false)}>
          <View style={s.menu}>
            {isOwner && (
              <TouchableOpacity style={s.menuItem} onPress={deleteStory}>
                <Ionicons name="trash" size={20} color="red" />
                <Text>Delete</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={s.menuItem} onPress={handleShare}>
              <Ionicons name="share-outline" size={20} />
              <Text>Share</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.menuItem} onPress={toggleSave}>
              <Ionicons name="bookmark-outline" size={20} />
              <Text>Save</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#000',
    marginBottom: 12,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    gap: 10,
  },

  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },

  avatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
  },

  username: {
    color: '#fff',
    fontWeight: '600',
  },

  metaRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },

  metaText: {
    color: '#aaa',
    fontSize: 11,
  },

  mediaContainer: {
    width: '100%',
    height: 400,
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
  },

  media: {
    width: '100%',
    height: '100%',
  },

  loader: {
    position: 'absolute',
  },

  errorBox: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  musicOverlay: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    padding: 10,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },

  musicText: {
    color: '#fff',
    fontSize: 12,
  },

  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
  },

  leftActions: {
    flexDirection: 'row',
    gap: 14,
  },

  captionBox: {
    paddingHorizontal: 10,
    paddingBottom: 10,
  },

  caption: {
    color: '#fff',
  },

  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  menu: {
    backgroundColor: '#fff',
    borderRadius: 10,
    width: 200,
  },

  menuItem: {
    padding: 14,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
});