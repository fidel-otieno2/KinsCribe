import React, { useRef } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const PageTurnAnimation = ({ children, onPageTurn, currentPage, totalPages }) => {
  const translateX = useSharedValue(0);
  const rotateY = useSharedValue(0);
  const scale = useSharedValue(1);

  const gesture = Gesture.Pan()
    .onUpdate((event) => {
      // Calculate drag progress
      const progress = event.translationX / SCREEN_WIDTH;
      translateX.value = event.translationX;
      
      // Rotate page based on drag
      rotateY.value = interpolate(
        progress,
        [-1, 0, 1],
        [180, 0, -180],
        Extrapolate.CLAMP
      );
      
      // Slight scale effect for depth
      scale.value = interpolate(
        Math.abs(progress),
        [0, 0.5, 1],
        [1, 0.95, 0.9],
        Extrapolate.CLAMP
      );
    })
    .onEnd((event) => {
      const velocity = event.velocityX;
      const progress = event.translationX / SCREEN_WIDTH;

      // Determine if page should turn
      if (Math.abs(progress) > 0.3 || Math.abs(velocity) > 500) {
        if (progress > 0 && currentPage > 0) {
          // Turn to previous page
          translateX.value = withTiming(SCREEN_WIDTH, { duration: 300 });
          rotateY.value = withTiming(-180, { duration: 300 });
          setTimeout(() => {
            onPageTurn(-1);
            translateX.value = 0;
            rotateY.value = 0;
            scale.value = 1;
          }, 300);
        } else if (progress < 0 && currentPage < totalPages - 1) {
          // Turn to next page
          translateX.value = withTiming(-SCREEN_WIDTH, { duration: 300 });
          rotateY.value = withTiming(180, { duration: 300 });
          setTimeout(() => {
            onPageTurn(1);
            translateX.value = 0;
            rotateY.value = 0;
            scale.value = 1;
          }, 300);
        } else {
          // Snap back
          translateX.value = withTiming(0, { duration: 200 });
          rotateY.value = withTiming(0, { duration: 200 });
          scale.value = withTiming(1, { duration: 200 });
        }
      } else {
        // Snap back
        translateX.value = withTiming(0, { duration: 200 });
        rotateY.value = withTiming(0, { duration: 200 });
        scale.value = withTiming(1, { duration: 200 });
      }
    });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { perspective: 1000 },
        { translateX: translateX.value },
        { rotateY: `${rotateY.value}deg` },
        { scale: scale.value },
      ],
    };
  });

  // Shadow animation
  const shadowStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      Math.abs(rotateY.value),
      [0, 90, 180],
      [0, 0.5, 0],
      Extrapolate.CLAMP
    );

    return {
      opacity,
    };
  });

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.container}>
        <Animated.View style={[styles.page, animatedStyle]}>
          {children}
        </Animated.View>
        
        {/* Page curl shadow */}
        <Animated.View style={[styles.shadow, shadowStyle]} />
      </View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  page: {
    flex: 1,
    backfaceVisibility: 'hidden',
  },
  shadow: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 50,
    height: '100%',
    backgroundColor: '#000',
  },
});

export default PageTurnAnimation;
