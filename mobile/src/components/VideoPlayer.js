import { useRef, useState, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { toStreamableUri } from '../utils/cloudinary';

const { width, height } = Dimensions.get('window');

export default function VideoPlayer({ uri, isVisible, feedMode = false, onPress, style }) {
  const videoRef = useRef(null);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    if (!videoRef.current) return;
    
    if (isVisible) {
      videoRef.current.playAsync().catch(() => {});
    } else {
      videoRef.current.pauseAsync().catch(() => {});
    }
  }, [isVisible]);

  useEffect(() => {
    return () => {
      if (videoRef.current) {
        videoRef.current.stopAsync().catch(() => {});
        videoRef.current.unloadAsync().catch(() => {});
      }
    };
  }, []);

  const handlePress = () => {
    if (feedMode && onPress) {
      onPress();
    }
  };

  return (
    <TouchableOpacity 
      style={[feedMode ? styles.feedContainer : styles.reelsContainer, style]} 
      onPress={handlePress}
      activeOpacity={feedMode ? 0.9 : 1}
    >
      <Video
        ref={videoRef}
        source={{ uri: toStreamableUri(uri) }}
        style={StyleSheet.absoluteFillObject}
        resizeMode={ResizeMode.COVER}
        shouldPlay={false}
        isLooping
        isMuted={muted}
        useNativeControls={false}
      />
      
      {/* Mute button */}
      <TouchableOpacity 
        style={styles.muteBtn} 
        onPress={() => setMuted(m => !m)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons 
          name={muted ? 'volume-mute' : 'volume-high'} 
          size={18} 
          color="#fff" 
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  feedContainer: {
    width: width,
    height: width * 1.5,
    backgroundColor: '#000',
    position: 'relative',
  },
  reelsContainer: {
    width: width,
    height: height,
    backgroundColor: '#000',
    position: 'relative',
  },
  muteBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
});
