import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  Animated,
  PanResponder,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const BookReader = ({ route, navigation }) => {
  const { storybook } = route.params;
  
  const [currentPage, setCurrentPage] = useState(0);
  const [theme, setTheme] = useState(storybook.theme || 'sepia');
  const [fontSize, setFontSize] = useState(storybook.font_size || 'medium');
  const [showMenu, setShowMenu] = useState(false);
  const [showChapterIndex, setShowChapterIndex] = useState(false);
  
  const pageAnim = useRef(new Animated.Value(0)).current;
  const stories = storybook.stories || [];
  const totalPages = stories.length + 2; // +2 for cover and end page

  // Theme configurations
  const themes = {
    sepia: {
      background: '#F4ECD8',
      text: '#3E2723',
      accent: '#8B4513',
      shadow: 'rgba(139, 69, 19, 0.3)',
    },
    night: {
      background: '#1A1A1A',
      text: '#E0E0E0',
      accent: '#BB86FC',
      shadow: 'rgba(187, 134, 252, 0.3)',
    },
    classic: {
      background: '#FFFFFF',
      text: '#000000',
      accent: '#7c3aed',
      shadow: 'rgba(124, 58, 237, 0.3)',
    },
  };

  const fontSizes = {
    small: { title: 20, body: 14, date: 12 },
    medium: { title: 24, body: 16, date: 14 },
    large: { title: 28, body: 18, date: 16 },
  };

  const currentTheme = themes[theme];
  const currentFontSize = fontSizes[fontSize];

  // Pan responder for swipe gestures
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10;
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > 50 && currentPage > 0) {
          // Swipe right - previous page
          turnPage(-1);
        } else if (gestureState.dx < -50 && currentPage < totalPages - 1) {
          // Swipe left - next page
          turnPage(1);
        }
      },
    })
  ).current;

  const turnPage = (direction) => {
    const newPage = currentPage + direction;
    if (newPage >= 0 && newPage < totalPages) {
      // Animate page turn
      Animated.sequence([
        Animated.timing(pageAnim, {
          toValue: direction > 0 ? -1 : 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(pageAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]).start();

      setCurrentPage(newPage);
    }
  };

  const renderCoverPage = () => (
    <View style={[styles.page, { backgroundColor: currentTheme.background }]}>
      <LinearGradient
        colors={[currentTheme.accent + '20', currentTheme.background]}
        style={styles.coverGradient}
      >
        <View style={styles.coverContent}>
          {storybook.cover_image ? (
            <Image
              source={{ uri: storybook.cover_image }}
              style={styles.coverImage}
            />
          ) : (
            <Ionicons name="book" size={80} color={currentTheme.accent} />
          )}
          
          <Text style={[styles.coverTitle, { color: currentTheme.text }]}>
            {storybook.title}
          </Text>
          
          <View style={styles.coverDivider} />
          
          <Text style={[styles.coverSubtitle, { color: currentTheme.text }]}>
            {storybook.description || 'A Family Storybook'}
          </Text>
          
          <Text style={[styles.coverFamily, { color: currentTheme.accent }]}>
            The {storybook.family_name || 'Family'} Collection
          </Text>
          
          <Text style={[styles.coverDate, { color: currentTheme.text + '80' }]}>
            {new Date(storybook.created_at).getFullYear()}
          </Text>
        </View>
      </LinearGradient>
    </View>
  );

  const renderStoryPage = (story, index) => (
    <View style={[styles.page, { backgroundColor: currentTheme.background }]}>
      <ScrollView
        style={styles.pageScroll}
        contentContainerStyle={styles.pageContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Chapter number */}
        <Text style={[styles.chapterNumber, { color: currentTheme.accent }]}>
          Chapter {index + 1}
        </Text>

        {/* Story title */}
        <Text
          style={[
            styles.storyTitle,
            { color: currentTheme.text, fontSize: currentFontSize.title },
          ]}
        >
          {story.title}
        </Text>

        {/* Story date and location */}
        <View style={styles.storyMeta}>
          {story.story_date && (
            <Text
              style={[
                styles.storyDate,
                { color: currentTheme.text + '80', fontSize: currentFontSize.date },
              ]}
            >
              {new Date(story.story_date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </Text>
          )}
          {story.location && (
            <Text
              style={[
                styles.storyLocation,
                { color: currentTheme.accent, fontSize: currentFontSize.date },
              ]}
            >
              📍 {story.location}
            </Text>
          )}
        </View>

        {/* Decorative divider */}
        <View style={styles.divider}>
          <View style={[styles.dividerLine, { backgroundColor: currentTheme.accent }]} />
          <Ionicons name="flower-outline" size={16} color={currentTheme.accent} />
          <View style={[styles.dividerLine, { backgroundColor: currentTheme.accent }]} />
        </View>

        {/* Story content */}
        <Text
          style={[
            styles.storyContent,
            { color: currentTheme.text, fontSize: currentFontSize.body },
          ]}
        >
          {story.enhanced_text || story.content || story.transcript}
        </Text>

        {/* Author info */}
        <View style={styles.authorSection}>
          <View style={[styles.authorDivider, { backgroundColor: currentTheme.accent }]} />
          <Text style={[styles.authorText, { color: currentTheme.text + '80' }]}>
            Told by {story.author_name}
          </Text>
        </View>

        {/* Page number */}
        <Text style={[styles.pageNumber, { color: currentTheme.text + '60' }]}>
          {index + 2}
        </Text>
      </ScrollView>
    </View>
  );

  const renderEndPage = () => (
    <View style={[styles.page, { backgroundColor: currentTheme.background }]}>
      <View style={styles.endPageContent}>
        <Ionicons name="heart" size={60} color={currentTheme.accent} />
        <Text style={[styles.endTitle, { color: currentTheme.text }]}>
          The End
        </Text>
        <Text style={[styles.endSubtitle, { color: currentTheme.text + '80' }]}>
          Thank you for reading our family story
        </Text>
        <Text style={[styles.endDate, { color: currentTheme.accent }]}>
          {stories.length} stories • {new Date().getFullYear()}
        </Text>
      </View>
    </View>
  );

  const renderChapterIndex = () => (
    <View style={[styles.chapterIndex, { backgroundColor: currentTheme.background }]}>
      <View style={styles.chapterHeader}>
        <Text style={[styles.chapterIndexTitle, { color: currentTheme.text }]}>
          Table of Contents
        </Text>
        <TouchableOpacity onPress={() => setShowChapterIndex(false)}>
          <Ionicons name="close" size={24} color={currentTheme.text} />
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.chapterList}>
        {stories.map((story, index) => (
          <TouchableOpacity
            key={story.id}
            style={styles.chapterItem}
            onPress={() => {
              setCurrentPage(index + 1);
              setShowChapterIndex(false);
            }}
          >
            <View style={styles.chapterItemContent}>
              <Text style={[styles.chapterItemNumber, { color: currentTheme.accent }]}>
                {index + 1}
              </Text>
              <View style={styles.chapterItemText}>
                <Text
                  style={[styles.chapterItemTitle, { color: currentTheme.text }]}
                  numberOfLines={1}
                >
                  {story.title}
                </Text>
                {story.story_date && (
                  <Text style={[styles.chapterItemDate, { color: currentTheme.text + '60' }]}>
                    {new Date(story.story_date).getFullYear()}
                  </Text>
                )}
              </View>
            </View>
            <Text style={[styles.chapterItemPage, { color: currentTheme.text + '60' }]}>
              {index + 2}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderMenu = () => (
    <View style={[styles.menu, { backgroundColor: currentTheme.background }]}>
      {/* Theme selector */}
      <View style={styles.menuSection}>
        <Text style={[styles.menuLabel, { color: currentTheme.text }]}>Theme</Text>
        <View style={styles.themeButtons}>
          {Object.keys(themes).map((t) => (
            <TouchableOpacity
              key={t}
              style={[
                styles.themeButton,
                { backgroundColor: themes[t].background },
                theme === t && styles.themeButtonActive,
              ]}
              onPress={() => setTheme(t)}
            >
              <Text style={[styles.themeButtonText, { color: themes[t].text }]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Font size selector */}
      <View style={styles.menuSection}>
        <Text style={[styles.menuLabel, { color: currentTheme.text }]}>Font Size</Text>
        <View style={styles.fontButtons}>
          {['small', 'medium', 'large'].map((size) => (
            <TouchableOpacity
              key={size}
              style={[
                styles.fontButton,
                fontSize === size && { backgroundColor: currentTheme.accent },
              ]}
              onPress={() => setFontSize(size)}
            >
              <Text
                style={[
                  styles.fontButtonText,
                  { color: fontSize === size ? '#fff' : currentTheme.text },
                ]}
              >
                {size.charAt(0).toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity
        style={[styles.menuCloseButton, { backgroundColor: currentTheme.accent }]}
        onPress={() => setShowMenu(false)}
      >
        <Text style={styles.menuCloseText}>Done</Text>
      </TouchableOpacity>
    </View>
  );

  const renderCurrentPage = () => {
    if (currentPage === 0) return renderCoverPage();
    if (currentPage === totalPages - 1) return renderEndPage();
    return renderStoryPage(stories[currentPage - 1], currentPage - 1);
  };

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.background }]}>
      <StatusBar barStyle={theme === 'night' ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: currentTheme.background }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={currentTheme.text} />
        </TouchableOpacity>
        
        <Text style={[styles.headerTitle, { color: currentTheme.text }]} numberOfLines={1}>
          {storybook.title}
        </Text>
        
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setShowChapterIndex(true)}
          >
            <Ionicons name="list" size={24} color={currentTheme.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setShowMenu(true)}
          >
            <Ionicons name="settings-outline" size={24} color={currentTheme.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Book pages with page-turn animation */}
      <Animated.View
        style={[
          styles.bookContainer,
          {
            transform: [
              {
                perspective: 1000,
              },
              {
                rotateY: pageAnim.interpolate({
                  inputRange: [-1, 0, 1],
                  outputRange: ['-15deg', '0deg', '15deg'],
                }),
              },
            ],
            opacity: pageAnim.interpolate({
              inputRange: [-1, 0, 1],
              outputRange: [0.7, 1, 0.7],
            }),
          },
        ]}
        {...panResponder.panHandlers}
      >
        {renderCurrentPage()}
        
        {/* Page shadow effect */}
        <View
          style={[
            styles.pageShadow,
            {
              shadowColor: currentTheme.shadow,
            },
          ]}
        />
      </Animated.View>

      {/* Navigation arrows */}
      {currentPage > 0 && (
        <TouchableOpacity
          style={[styles.navButton, styles.navButtonLeft]}
          onPress={() => turnPage(-1)}
        >
          <Ionicons name="chevron-back" size={32} color={currentTheme.accent} />
        </TouchableOpacity>
      )}
      
      {currentPage < totalPages - 1 && (
        <TouchableOpacity
          style={[styles.navButton, styles.navButtonRight]}
          onPress={() => turnPage(1)}
        >
          <Ionicons name="chevron-forward" size={32} color={currentTheme.accent} />
        </TouchableOpacity>
      )}

      {/* Progress indicator */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: currentTheme.accent,
                width: `${((currentPage + 1) / totalPages) * 100}%`,
              },
            ]}
          />
        </View>
        <Text style={[styles.progressText, { color: currentTheme.text + '80' }]}>
          {currentPage + 1} / {totalPages}
        </Text>
      </View>

      {/* Overlays */}
      {showChapterIndex && renderChapterIndex()}
      {showMenu && renderMenu()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    marginHorizontal: 16,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  headerButton: {
    padding: 4,
  },
  bookContainer: {
    flex: 1,
    margin: 20,
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  page: {
    flex: 1,
    borderRadius: 8,
  },
  pageShadow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 8,
    elevation: 5,
  },
  
  // Cover page
  coverGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  coverContent: {
    alignItems: 'center',
  },
  coverImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 24,
  },
  coverTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: 'serif',
  },
  coverDivider: {
    width: 100,
    height: 2,
    backgroundColor: 'rgba(0,0,0,0.2)',
    marginVertical: 16,
  },
  coverSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    fontStyle: 'italic',
  },
  coverFamily: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  coverDate: {
    fontSize: 14,
  },
  
  // Story page
  pageScroll: {
    flex: 1,
  },
  pageContent: {
    padding: 32,
    paddingBottom: 60,
  },
  chapterNumber: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  storyTitle: {
    fontWeight: 'bold',
    marginBottom: 12,
    fontFamily: 'serif',
    lineHeight: 32,
  },
  storyMeta: {
    marginBottom: 20,
  },
  storyDate: {
    marginBottom: 4,
  },
  storyLocation: {
    fontWeight: '500',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  storyContent: {
    lineHeight: 28,
    textAlign: 'justify',
    fontFamily: 'serif',
  },
  authorSection: {
    marginTop: 32,
    alignItems: 'center',
  },
  authorDivider: {
    width: 60,
    height: 1,
    marginBottom: 12,
  },
  authorText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  pageNumber: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 12,
  },
  
  // End page
  endPageContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  endTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    marginTop: 24,
    marginBottom: 12,
    fontFamily: 'serif',
  },
  endSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    fontStyle: 'italic',
  },
  endDate: {
    fontSize: 14,
    fontWeight: '600',
  },
  
  // Navigation
  navButton: {
    position: 'absolute',
    top: '50%',
    padding: 12,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.9)',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  navButtonLeft: {
    left: 8,
  },
  navButtonRight: {
    right: 8,
  },
  
  // Progress
  progressContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 3,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
  },
  
  // Chapter index
  chapterIndex: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: 20,
    paddingTop: 60,
  },
  chapterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  chapterIndexTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  chapterList: {
    flex: 1,
  },
  chapterItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  chapterItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  chapterItemNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 16,
    width: 32,
  },
  chapterItemText: {
    flex: 1,
  },
  chapterItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  chapterItemDate: {
    fontSize: 12,
  },
  chapterItemPage: {
    fontSize: 14,
    marginLeft: 12,
  },
  
  // Menu
  menu: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  menuSection: {
    marginBottom: 24,
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  themeButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  themeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  themeButtonActive: {
    borderColor: '#7c3aed',
  },
  themeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  fontButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  fontButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)',
  },
  fontButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  menuCloseButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  menuCloseText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default BookReader;
