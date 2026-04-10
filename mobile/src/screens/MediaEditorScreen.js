import { useState } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, ScrollView
} from 'react-native';
import { Video } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../api/axios';
import { colors, radius } from '../theme';

export default function MediaEditor({ route, navigation }) {
  const { mediaFile, mediaType } = route.params;

  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [music, setMusic] = useState(null);
  const [loading, setLoading] = useState(false);

  // 🎵 Fake music picker (replace later with real list)
  const pickMusic = () => {
    setMusic("default-music.mp3");
    Alert.alert("Music Added", "Sample music attached 🎵");
  };

  // 🚀 Upload handler
  const handlePost = async () => {
    if (!mediaFile) return Alert.alert("Error", "No media selected");

    const formData = new FormData();

    formData.append("file", {
      uri: mediaFile.uri,
      name: mediaType === "image" ? "photo.jpg" : "video.mp4",
      type: mediaType === "image" ? "image/jpeg" : "video/mp4",
    });

    formData.append("caption", caption);
    formData.append("location", location);
    formData.append("music", music || "");
    formData.append("type", mediaType);

    setLoading(true);

    try {
      await api.post("/stories/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      Alert.alert("Success", "Story posted successfully 🎉");
      navigation.navigate("Feed");

    } catch (err) {
      console.log(err.response?.data || err.message);
      Alert.alert("Upload Failed", "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.container}>
      <LinearGradient colors={['#0f172a', '#1e1040', '#0f172a']} style={StyleSheet.absoluteFill} />

      {/* HEADER */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Edit Story</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>

        {/* MEDIA PREVIEW */}
        <View style={s.previewBox}>
          {mediaType === 'image' ? (
            <Image source={{ uri: mediaFile.uri }} style={s.media} />
          ) : (
            <Video
              source={{ uri: mediaFile.uri }}
              style={s.media}
              useNativeControls
              resizeMode="cover"
              isLooping
            />
          )}
        </View>

        {/* CAPTION */}
        <Text style={s.label}>Caption</Text>
        <TextInput
          style={s.input}
          placeholder="Write something..."
          placeholderTextColor={colors.dim}
          value={caption}
          onChangeText={setCaption}
        />

        {/* LOCATION */}
        <Text style={s.label}>Location</Text>
        <TextInput
          style={s.input}
          placeholder="Add location..."
          placeholderTextColor={colors.dim}
          value={location}
          onChangeText={setLocation}
        />

        {/* ACTION BUTTONS */}
        <View style={s.actions}>
          <TouchableOpacity style={s.actionBtn} onPress={pickMusic}>
            <Ionicons name="musical-notes-outline" size={20} color="#fff" />
            <Text style={s.actionText}>Music</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.actionBtn}>
            <Ionicons name="color-filter-outline" size={20} color="#fff" />
            <Text style={s.actionText}>Effects</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.actionBtn}>
            <Ionicons name="sparkles-outline" size={20} color="#fff" />
            <Text style={s.actionText}>AI Enhance</Text>
          </TouchableOpacity>
        </View>

        {/* POST BUTTON */}
        <TouchableOpacity style={s.postBtn} onPress={handlePost} disabled={loading}>
          <LinearGradient colors={['#7c3aed', '#3b82f6']} style={s.postBtnGrad}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <>
                  <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
                  <Text style={s.postBtnText}>Post Story</Text>
                </>
            }
          </LinearGradient>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },

  previewBox: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: 20,
  },
  media: {
    width: '100%',
    height: 300,
  },

  label: {
    color: colors.muted,
    marginBottom: 6,
    fontSize: 13,
  },

  input: {
    backgroundColor: 'rgba(30,41,59,0.8)',
    borderRadius: radius.md,
    padding: 12,
    color: '#fff',
    marginBottom: 16,
  },

  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },

  actionBtn: {
    flex: 1,
    marginHorizontal: 4,
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: radius.md,
    alignItems: 'center',
  },

  actionText: {
    color: '#fff',
    marginTop: 4,
    fontSize: 12,
  },

  postBtn: {
    borderRadius: radius.md,
    overflow: 'hidden',
  },

  postBtnGrad: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    padding: 16,
  },

  postBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
});