import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import { API_URL } from '../config';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const FamilyTimeline = ({ navigation }) => {
  const [view, setView] = useState('year'); // decade | year | month
  const [selectedYear, setSelectedYear] = useState(null);
  const [timeline, setTimeline] = useState({});
  const [loading, setLoading] = useState(true);
  const scrollViewRef = useRef(null);
  const zoomAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    fetchTimeline();
  }, [view, selectedYear]);

  const fetchTimeline = async () => {
    try {
      setLoading(true);
      const params = { view };
      if (view === 'month' && selectedYear) {
        params.year = selectedYear;
      }
      
      const response = await axios.get(`${API_URL}/storybooks/timeline`, { params });
      setTimeline(response.data.timeline);
    } catch (error) {
      console.error('Error fetching timeline:', error);
    } finally {
      setLoading(false);
    }
  };

  const changeView = (newView) => {
    // Animate zoom transition
    Animated.sequence([
      Animated.timing(zoomAnim, {
        toValue: 0.8,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(zoomAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();

    setView(newView);
  };

  const renderDecadeView = () => {
    const decades = Object.keys(timeline).sort((a, b) => b - a);
    
    return (
      <ScrollView
        ref={scrollViewRef}
        style={styles.timelineScroll}
        contentContainerStyle={styles.decadeContainer}
        showsVerticalScrollIndicator={false}
      >
        {decades.map((decade) => {
          const stories = timeline[decade];
          const decadeStart = parseInt(decade);
          const decadeEnd = decadeStart + 9;
          
          return (
            <TouchableOpacity
              key={decade}
              style={styles.decadeCard}
              onPress={() => {
                setSelectedYear(decadeStart);
                changeView('year');
              }}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#7c3aed', '#a855f7']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.decadeGradient}
              >
                <View style={styles.decadeHeader}>
                  <Text style={styles.decadeTitle}>
                    {decadeStart}s
                  </Text>
                  <Text style={styles.decadeRange}>
                    {decadeStart} - {decadeEnd}
                  </Text>
                </View>
                
                <View style={styles.decadeStats}>
                  <View style={styles.statItem}>
                    <Ionicons name="book" size={20} color="#fff" />
                    <Text style={styles.statText}>{stories.length} stories</Text>
                  </View>
                </View>

                {/* Preview images */}
                <View style={styles.decadePreview}>
                  {stories.slice(0, 3).map((story, index) => (
                    story.media_url && (
                      <View
                        key={story.id}
                        style={[
                          styles.previewImage,
                          { zIndex: 3 - index, marginLeft: index * -20 }
                        ]}
                      >
                        <Image
                          source={{ uri: story.media_url }}
                          style={styles.previewImageInner}
                        />
                      </View>
                    )
                  ))}
                </View>

                <Ionicons name="chevron-forward" size={24} color="#fff" style={styles.decadeArrow} />
              </LinearGradient>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  };

  const renderYearView = () => {
    const years = Object.keys(timeline).sort((a, b) => b - a);
    const currentYear = new Date().getFullYear();
    
    return (
      <ScrollView
        ref={scrollViewRef}
        style={styles.timelineScroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Timeline line */}
        <View style={styles.timelineLine} />
        
        {years.map((year, index) => {
          const stories = timeline[year];
          const isCurrentYear = parseInt(year) === currentYear;
          
          return (
            <View key={year} style={styles.yearSection}>
              {/* Year marker */}
              <View style={styles.yearMarker}>
                <View style={[styles.yearDot, isCurrentYear && styles.yearDotCurrent]} />
                <TouchableOpacity
                  style={[styles.yearLabel, isCurrentYear && styles.yearLabelCurrent]}
                  onPress={() => {
                    setSelectedYear(parseInt(year));
                    changeView('month');
                  }}
                >
                  <Text style={[styles.yearText, isCurrentYear && styles.yearTextCurrent]}>
                    {year}
                  </Text>
                  {isCurrentYear && (
                    <View style={styles.currentBadge}>
                      <Text style={styles.currentBadgeText}>Now</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              {/* Stories for this year */}
              <View style={styles.yearStories}>
                <Text style={styles.yearStoriesCount}>
                  {stories.length} {stories.length === 1 ? 'story' : 'stories'}
                </Text>
                
                {stories.slice(0, 3).map((story) => (
                  <TouchableOpacity
                    key={story.id}
                    style={styles.storyCard}
                    onPress={() => navigation.navigate('StoryDetail', { storyId: story.id })}
                  >
                    {story.media_url && (
                      <Image source={{ uri: story.media_url }} style={styles.storyThumbnail} />
                    )}
                    <View style={styles.storyInfo}>
                      <Text style={styles.storyTitle} numberOfLines={2}>
                        {story.title}
                      </Text>
                      <Text style={styles.storyDate}>
                        {new Date(story.story_date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric'
                        })}
                      </Text>
                      {story.location && (
                        <Text style={styles.storyLocation} numberOfLines={1}>
                          📍 {story.location}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}

                {stories.length > 3 && (
                  <TouchableOpacity
                    style={styles.viewMoreButton}
                    onPress={() => {
                      setSelectedYear(parseInt(year));
                      changeView('month');
                    }}
                  >
                    <Text style={styles.viewMoreText}>
                      View all {stories.length} stories
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color="#7c3aed" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>
    );
  };

  const renderMonthView = () => {
    const months = Object.keys(timeline).sort();
    
    return (
      <ScrollView
        ref={scrollViewRef}
        style={styles.timelineScroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.monthHeader}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => changeView('year')}
          >
            <Ionicons name="chevron-back" size={24} color="#7c3aed" />
            <Text style={styles.backButtonText}>Back to Years</Text>
          </TouchableOpacity>
          <Text style={styles.monthHeaderTitle}>{selectedYear}</Text>
        </View>

        {months.map((monthKey) => {
          const stories = timeline[monthKey];
          const date = new Date(monthKey + '-01');
          const monthName = date.toLocaleDateString('en-US', { month: 'long' });
          
          return (
            <View key={monthKey} style={styles.monthSection}>
              <View style={styles.monthLabel}>
                <Text style={styles.monthName}>{monthName}</Text>
                <Text style={styles.monthCount}>
                  {stories.length} {stories.length === 1 ? 'story' : 'stories'}
                </Text>
              </View>

              <View style={styles.monthStories}>
                {stories.map((story) => (
                  <TouchableOpacity
                    key={story.id}
                    style={styles.monthStoryCard}
                    onPress={() => navigation.navigate('StoryDetail', { storyId: story.id })}
                  >
                    <View style={styles.monthStoryDate}>
                      <Text style={styles.monthStoryDay}>
                        {new Date(story.story_date).getDate()}
                      </Text>
                    </View>

                    {story.media_url && (
                      <Image
                        source={{ uri: story.media_url }}
                        style={styles.monthStoryImage}
                      />
                    )}

                    <View style={styles.monthStoryContent}>
                      <Text style={styles.monthStoryTitle} numberOfLines={2}>
                        {story.title}
                      </Text>
                      <Text style={styles.monthStoryAuthor}>
                        by {story.author_name}
                      </Text>
                      {story.location && (
                        <Text style={styles.monthStoryLocation} numberOfLines={1}>
                          📍 {story.location}
                        </Text>
                      )}
                    </View>

                    <Ionicons name="chevron-forward" size={20} color="#ccc" />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7c3aed" />
        <Text style={styles.loadingText}>Loading timeline...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Family Timeline</Text>
        
        <TouchableOpacity onPress={() => navigation.navigate('TimelineSettings')}>
          <Ionicons name="options-outline" size={24} color="#1a1a1a" />
        </TouchableOpacity>
      </View>

      {/* View selector */}
      <View style={styles.viewSelector}>
        <TouchableOpacity
          style={[styles.viewButton, view === 'decade' && styles.viewButtonActive]}
          onPress={() => changeView('decade')}
        >
          <Ionicons
            name="calendar"
            size={20}
            color={view === 'decade' ? '#fff' : '#7c3aed'}
          />
          <Text style={[styles.viewButtonText, view === 'decade' && styles.viewButtonTextActive]}>
            Decades
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.viewButton, view === 'year' && styles.viewButtonActive]}
          onPress={() => changeView('year')}
        >
          <Ionicons
            name="calendar-outline"
            size={20}
            color={view === 'year' ? '#fff' : '#7c3aed'}
          />
          <Text style={[styles.viewButtonText, view === 'year' && styles.viewButtonTextActive]}>
            Years
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.viewButton, view === 'month' && styles.viewButtonActive]}
          onPress={() => {
            if (!selectedYear) setSelectedYear(new Date().getFullYear());
            changeView('month');
          }}
        >
          <Ionicons
            name="calendar-number"
            size={20}
            color={view === 'month' ? '#fff' : '#7c3aed'}
          />
          <Text style={[styles.viewButtonText, view === 'month' && styles.viewButtonTextActive]}>
            Months
          </Text>
        </TouchableOpacity>
      </View>

      {/* Timeline content with zoom animation */}
      <Animated.View
        style={[
          styles.timelineContent,
          {
            transform: [{ scale: zoomAnim }],
          },
        ]}
      >
        {view === 'decade' && renderDecadeView()}
        {view === 'year' && renderYearView()}
        {view === 'month' && renderMonthView()}
      </Animated.View>

      {/* Stats footer */}
      <View style={styles.footer}>
        <View style={styles.footerStat}>
          <Text style={styles.footerStatValue}>
            {Object.values(timeline).flat().length}
          </Text>
          <Text style={styles.footerStatLabel}>Total Stories</Text>
        </View>
        <View style={styles.footerDivider} />
        <View style={styles.footerStat}>
          <Text style={styles.footerStatValue}>
            {Object.keys(timeline).length}
          </Text>
          <Text style={styles.footerStatLabel}>
            {view === 'decade' ? 'Decades' : view === 'year' ? 'Years' : 'Months'}
          </Text>
        </View>
      </View>
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
  
  // View selector
  viewSelector: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: '#fff',
  },
  viewButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#7c3aed20',
  },
  viewButtonActive: {
    backgroundColor: '#7c3aed',
  },
  viewButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7c3aed',
  },
  viewButtonTextActive: {
    color: '#fff',
  },
  
  // Timeline content
  timelineContent: {
    flex: 1,
  },
  timelineScroll: {
    flex: 1,
  },
  
  // Decade view
  decadeContainer: {
    padding: 20,
    gap: 16,
  },
  decadeCard: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  decadeGradient: {
    padding: 24,
  },
  decadeHeader: {
    marginBottom: 16,
  },
  decadeTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  decadeRange: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
  },
  decadeStats: {
    marginBottom: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  decadePreview: {
    flexDirection: 'row',
    marginTop: 16,
  },
  previewImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: '#fff',
    overflow: 'hidden',
  },
  previewImageInner: {
    width: '100%',
    height: '100%',
  },
  decadeArrow: {
    position: 'absolute',
    top: 24,
    right: 24,
  },
  
  // Year view
  timelineLine: {
    position: 'absolute',
    left: 40,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#e0e0e0',
  },
  yearSection: {
    flexDirection: 'row',
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  yearMarker: {
    alignItems: 'center',
    marginRight: 20,
  },
  yearDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#7c3aed',
    marginBottom: 8,
    borderWidth: 3,
    borderColor: '#F5F0E8',
  },
  yearDotCurrent: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#10b981',
  },
  yearLabel: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#7c3aed20',
  },
  yearLabelCurrent: {
    backgroundColor: '#10b98120',
  },
  yearText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#7c3aed',
  },
  yearTextCurrent: {
    color: '#10b981',
  },
  currentBadge: {
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#10b981',
    borderRadius: 4,
  },
  currentBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  yearStories: {
    flex: 1,
  },
  yearStoriesCount: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    fontWeight: '600',
  },
  storyCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  storyThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  storyInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  storyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  storyDate: {
    fontSize: 12,
    color: '#7c3aed',
    marginBottom: 2,
  },
  storyLocation: {
    fontSize: 12,
    color: '#666',
  },
  viewMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
    backgroundColor: '#7c3aed10',
    borderRadius: 8,
  },
  viewMoreText: {
    fontSize: 14,
    color: '#7c3aed',
    fontWeight: '600',
  },
  
  // Month view
  monthHeader: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },
  backButtonText: {
    fontSize: 16,
    color: '#7c3aed',
    fontWeight: '600',
  },
  monthHeaderTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  monthSection: {
    padding: 20,
  },
  monthLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  monthName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  monthCount: {
    fontSize: 14,
    color: '#666',
  },
  monthStories: {
    gap: 12,
  },
  monthStoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    gap: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  monthStoryDate: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#7c3aed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthStoryDay: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  monthStoryImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  monthStoryContent: {
    flex: 1,
  },
  monthStoryTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  monthStoryAuthor: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  monthStoryLocation: {
    fontSize: 12,
    color: '#7c3aed',
  },
  
  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  footerStat: {
    alignItems: 'center',
  },
  footerStatValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#7c3aed',
  },
  footerStatLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  footerDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#e0e0e0',
  },
});

export default FamilyTimeline;
