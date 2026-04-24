import { useState, useEffect } from 'react';
import {
  View, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Dimensions, Image,
} from 'react-native';
import AppText from '../components/AppText';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import api from '../api/axios';
import { colors, radius } from '../theme';

const { width } = Dimensions.get('window');
const TABS = ['Overview', 'Content', 'Activity', 'Audience', 'AI', 'Messages', 'Family'];

// ── Primitives ────────────────────────────────────────────────

function StatCard({ label, value, icon, color, sub }) {
  return (
    <View style={[s.statCard, { borderColor: `${color}33` }]}>
      <LinearGradient colors={[`${color}22`, `${color}0a`]} style={StyleSheet.absoluteFill} />
      <View style={[s.statIcon, { backgroundColor: `${color}33` }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <AppText style={s.statValue}>{typeof value === 'number' ? value.toLocaleString() : (value ?? '—')}</AppText>
      <AppText style={s.statLabel}>{label}</AppText>
      {sub ? <AppText style={s.statSub}>{sub}</AppText> : null}
    </View>
  );
}

function Bar({ label, value, max, color }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <View style={s.barRow}>
      <AppText style={s.barLabel}>{label}</AppText>
      <View style={s.barTrack}>
        <LinearGradient colors={[color, `${color}66`]} style={[s.barFill, { width: `${pct}%` }]} />
      </View>
      <AppText style={s.barVal}>{typeof value === 'number' ? value.toLocaleString() : value}</AppText>
    </View>
  );
}

function Section({ title, children }) {
  return (
    <>
      <AppText style={s.sectionTitle}>{title}</AppText>
      {children}
    </>
  );
}

function Card({ children, style }) {
  return (
    <View style={[s.card, style]}>
      <LinearGradient colors={['rgba(124,58,237,0.08)', 'rgba(15,23,42,0.6)']} style={StyleSheet.absoluteFill} />
      {children}
    </View>
  );
}

// ── Tabs ──────────────────────────────────────────────────────

function OverviewTab({ d }) {
  const engColor = d.engagement_rate >= 5 ? '#10b981' : d.engagement_rate >= 2 ? '#f59e0b' : '#e11d48';
  return (
    <>
      <Section title="Account">
        <View style={s.grid}>
          <StatCard label="Posts" value={d.total_posts} icon="grid-outline" color="#7c3aed" />
          <StatCard label="Connections" value={d.connections} icon="people-outline" color="#3b82f6"
            sub={d.new_connections_this_week > 0 ? `+${d.new_connections_this_week} this week` : null} />
          <StatCard label="Interests" value={d.interests} icon="heart-outline" color="#ec4899" />
          <StatCard label="Total Views" value={d.total_views} icon="eye-outline" color="#06b6d4" />
          <StatCard label="Total Likes" value={d.total_likes} icon="heart" color="#e11d48" />
          <StatCard label="Saves" value={d.total_saves} icon="bookmark" color="#10b981" />
        </View>
      </Section>

      <Section title="Engagement Rate">
        <Card>
          <View style={s.engRow}>
            <View style={[s.engBadge, { backgroundColor: `${engColor}22`, borderColor: `${engColor}44` }]}>
              <AppText style={[s.engRate, { color: engColor }]}>{d.engagement_rate}%</AppText>
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <AppText style={s.engDesc}>
                {d.engagement_rate >= 5
                  ? '🔥 Excellent — your audience is highly engaged'
                  : d.engagement_rate >= 2
                  ? '📈 Good — keep posting consistently'
                  : '💡 Low — try more interactive content'}
              </AppText>
              <AppText style={s.engFormula}>(likes + comments + shares) ÷ views</AppText>
            </View>
          </View>
        </Card>
      </Section>

      <Section title="Breakdown">
        <Card style={{ gap: 12 }}>
          {(() => {
            const max = Math.max(d.total_likes, d.total_comments, d.total_saves, d.total_shares, 1);
            return (
              <>
                <Bar label="Likes" value={d.total_likes} max={max} color="#e11d48" />
                <Bar label="Comments" value={d.total_comments} max={max} color="#f59e0b" />
                <Bar label="Saves" value={d.total_saves} max={max} color="#10b981" />
                <Bar label="Shares" value={d.total_shares} max={max} color="#3b82f6" />
              </>
            );
          })()}
        </Card>
      </Section>

      <Section title="Growth Tips">
        {[
          { icon: '📸', tip: 'Post 3–5 times per week for consistent growth', color: '#7c3aed' },
          { icon: '🕐', tip: 'Post in the evenings when connections are most active', color: '#3b82f6' },
          { icon: '💬', tip: 'Reply to comments — it doubles your engagement rate', color: '#f59e0b' },
          { icon: '📖', tip: 'Share family stories to deepen connections', color: '#ec4899' },
        ].map((item, i) => (
          <View key={i} style={s.tipRow}>
            <View style={[s.tipIcon, { backgroundColor: `${item.color}22` }]}>
              <AppText style={{ fontSize: 16 }}>{item.icon}</AppText>
            </View>
            <AppText style={s.tipText}>{item.tip}</AppText>
          </View>
        ))}
      </Section>
    </>
  );
}

function ContentTab({ d }) {
  const types = d.content_types || {};
  const typeMax = Math.max(...Object.values(types), 1);
  const topMusic = d.top_music || [];
  const musicMax = topMusic.length > 0 ? topMusic[0].count : 1;

  return (
    <>
      <Section title="Content Stats">
        <View style={s.grid}>
          <StatCard label="Stories" value={d.stories_count} icon="albums-outline" color="#7c3aed" />
          <StatCard label="Story Views" value={d.story_views} icon="eye-outline" color="#06b6d4" />
          <StatCard label="Total Posts" value={d.total_posts} icon="grid-outline" color="#3b82f6" />
        </View>
      </Section>

      {/* Voice Posts */}
      {d.voice_posts_count > 0 && (
        <Section title="Voice Posts">
          <View style={s.grid}>
            <StatCard label="Voice Posts" value={d.voice_posts_count} icon="mic-outline" color="#f59e0b" />
            <StatCard label="Total Plays" value={d.voice_plays} icon="play-circle-outline" color="#10b981" />
            <StatCard
              label="Avg Plays"
              value={d.voice_posts_count > 0 ? Math.round(d.voice_plays / d.voice_posts_count) : 0}
              icon="stats-chart-outline"
              color="#ec4899"
            />
          </View>
        </Section>
      )}

      {Object.keys(types).length > 0 && (
        <Section title="Content Types">
          <Card style={{ gap: 12 }}>
            {Object.entries(types).map(([type, count]) => (
              <Bar key={type} label={type.charAt(0).toUpperCase() + type.slice(1)} value={count} max={typeMax} color="#7c3aed" />
            ))}
          </Card>
        </Section>
      )}

      {/* Top Music */}
      {topMusic.length > 0 && (
        <Section title="Top Music Used">
          <Card style={{ gap: 12 }}>
            {topMusic.map((m, i) => (
              <View key={i} style={s.musicRow}>
                <View style={s.musicRank}>
                  <AppText style={s.rankNum}>#{i + 1}</AppText>
                </View>
                <Ionicons name="musical-note" size={14} color="#a78bfa" style={{ marginRight: 6 }} />
                <AppText style={s.musicName} numberOfLines={1}>{m.name}</AppText>
                <View style={s.musicBarWrap}>
                  <LinearGradient
                    colors={['#7c3aed', '#ec4899']}
                    style={[s.musicBarFill, { width: `${Math.round((m.count / musicMax) * 100)}%` }]}
                  />
                </View>
                <AppText style={s.musicCount}>{m.count}×</AppText>
              </View>
            ))}
          </Card>
        </Section>
      )}

      {/* Top Story */}
      {d.top_story && (
        <Section title="Best Story">
          <Card style={s.topStoryRow}>
            {d.top_story.media_url && d.top_story.media_type === 'image' ? (
              <Image source={{ uri: d.top_story.media_url }} style={s.topStoryThumb} />
            ) : (
              <View style={[s.topStoryThumb, s.topPostThumbPlaceholder]}>
                <Ionicons name={d.top_story.media_type === 'video' ? 'videocam' : 'albums'} size={22} color={colors.muted} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <AppText style={s.topPostCaption}>{d.top_story.music_name ? `🎵 ${d.top_story.music_name}` : 'Story'}</AppText>
              <AppText style={s.statSub}>👁 {d.top_story.views} views</AppText>
            </View>
            <View style={s.chatterBadge}>
              <AppText style={s.chatterCount}>🏆 Top</AppText>
            </View>
          </Card>
        </Section>
      )}

      {d.top_posts?.length > 0 && (
        <Section title="Top Performing Posts">
          {d.top_posts.map((p, i) => (
            <Card key={p.id} style={s.topPostRow}>
              <View style={s.topPostRank}>
                <AppText style={s.rankNum}>#{i + 1}</AppText>
              </View>
              {p.media_url && p.media_type === 'image' ? (
                <Image source={{ uri: p.media_url }} style={s.topPostThumb} />
              ) : (
                <View style={[s.topPostThumb, s.topPostThumbPlaceholder]}>
                  <Ionicons name={p.media_type === 'video' ? 'videocam' : 'document-text'} size={20} color={colors.muted} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <AppText style={s.topPostCaption} numberOfLines={2}>{p.caption || 'No caption'}</AppText>
                <View style={s.topPostStats}>
                  <AppText style={s.topPostStat}>❤️ {p.likes}</AppText>
                  <AppText style={s.topPostStat}>💬 {p.comments}</AppText>
                  <AppText style={s.topPostStat}>🔖 {p.saves}</AppText>
                  <AppText style={s.topPostStat}>👁 {p.views}</AppText>
                </View>
              </View>
            </Card>
          ))}
        </Section>
      )}
    </>
  );
}

function ActivityTab({ d }) {
  const trend = d.weekly_trend || [];
  const maxCount = Math.max(...trend.map(t => t.count), 1);
  const totalThisWeek = trend.reduce((sum, t) => sum + t.count, 0);
  const chartHeight = 80;

  return (
    <>
      <Section title="7-Day Growth">
        <Card>
          <View style={s.chartContainer}>
            {trend.map((t, i) => {
              const barH = maxCount > 0 ? Math.max((t.count / maxCount) * chartHeight, 4) : 4;
              const isToday = i === trend.length - 1;
              return (
                <View key={i} style={s.chartCol}>
                  <AppText style={s.chartVal}>{t.count > 0 ? t.count : ''}</AppText>
                  <View style={[s.chartBarWrap, { height: chartHeight }]}>
                    <LinearGradient
                      colors={isToday ? ['#7c3aed', '#3b82f6'] : ['rgba(124,58,237,0.5)', 'rgba(59,130,246,0.3)']}
                      style={[s.chartBar, { height: barH }]}
                    />
                  </View>
                  <AppText style={[s.chartDay, isToday && { color: '#a78bfa' }]}>{t.day}</AppText>
                </View>
              );
            })}
          </View>
        </Card>
      </Section>

      <Section title="Week Summary">
        <View style={s.grid}>
          <StatCard
            label="New Connections"
            value={totalThisWeek}
            icon="trending-up-outline"
            color="#10b981"
            sub={totalThisWeek > 0 ? 'this week' : null}
          />
          <StatCard label="Story Views" value={d.story_views} icon="eye-outline" color="#06b6d4" />
          <StatCard label="Story Replies" value={d.story_replies} icon="chatbubble-outline" color="#ec4899" />
        </View>
      </Section>

      <Section title="Engagement This Week">
        <Card style={{ gap: 12 }}>
          {(() => {
            const max = Math.max(d.total_likes, d.total_comments, d.total_shares, 1);
            return (
              <>
                <Bar label="Likes" value={d.total_likes} max={max} color="#e11d48" />
                <Bar label="Comments" value={d.total_comments} max={max} color="#f59e0b" />
                <Bar label="Shares" value={d.total_shares} max={max} color="#3b82f6" />
              </>
            );
          })()}
        </Card>
      </Section>

      {d.notifications?.new_connections_notifs > 0 && (
        <Section title="Notification Highlights">
          <Card style={{ gap: 10 }}>
            <View style={s.notifRow}>
              <Ionicons name="person-add-outline" size={16} color="#10b981" />
              <AppText style={s.notifText}>
                <AppText style={{ color: '#10b981', fontWeight: '700' }}>{d.notifications.new_connections_notifs}</AppText> new connection{d.notifications.new_connections_notifs !== 1 ? 's' : ''} this week
              </AppText>
            </View>
            {d.notifications.mentions > 0 && (
              <View style={s.notifRow}>
                <Ionicons name="at-outline" size={16} color="#a78bfa" />
                <AppText style={s.notifText}>
                  <AppText style={{ color: '#a78bfa', fontWeight: '700' }}>{d.notifications.mentions}</AppText> mention{d.notifications.mentions !== 1 ? 's' : ''} total
                </AppText>
              </View>
            )}
            {d.notifications.unread > 0 && (
              <View style={s.notifRow}>
                <Ionicons name="notifications-outline" size={16} color="#f59e0b" />
                <AppText style={s.notifText}>
                  <AppText style={{ color: '#f59e0b', fontWeight: '700' }}>{d.notifications.unread}</AppText> unread notification{d.notifications.unread !== 1 ? 's' : ''}
                </AppText>
              </View>
            )}
          </Card>
        </Section>
      )}
    </>
  );
}

function AudienceTab({ d }) {
  return (
    <>
      <Section title="Audience Summary">
        <View style={s.grid}>
          <StatCard label="Connections" value={d.connections} icon="people-outline" color="#3b82f6" />
          <StatCard label="New This Week" value={d.new_connections_this_week} icon="trending-up-outline" color="#10b981" />
          <StatCard label="Interests" value={d.interests} icon="heart-outline" color="#ec4899" />
        </View>
      </Section>

      {d.top_connections?.length > 0 && (
        <Section title="Most Interactive Connections">
          <Card style={{ gap: 0 }}>
            {d.top_connections.map((u, i) => (
              <View key={u.id} style={[s.chatterRow, i < d.top_connections.length - 1 && s.chatterBorder]}>
                {u.avatar ? (
                  <Image source={{ uri: u.avatar }} style={s.chatterAvatar} />
                ) : (
                  <View style={[s.chatterAvatar, s.chatterAvatarPlaceholder]}>
                    <AppText style={{ color: colors.muted, fontWeight: '700' }}>{u.name?.[0]}</AppText>
                  </View>
                )}
                <AppText style={s.chatterName} numberOfLines={1}>{u.name}</AppText>
                <View style={s.chatterBadge}>
                  <AppText style={s.chatterCount}>{u.interactions} interactions</AppText>
                </View>
              </View>
            ))}
          </Card>
        </Section>
      )}

      <Section title="Best Time to Post">
        <Card style={{ gap: 12 }}>
          {[
            { time: '7am–9am', label: 'Morning', score: 60 },
            { time: '12pm–2pm', label: 'Lunch', score: 75 },
            { time: '6pm–9pm', label: 'Evening', score: 95 },
            { time: '9pm–11pm', label: 'Night', score: 80 },
          ].map(t => (
            <View key={t.time} style={s.barRow}>
              <AppText style={[s.barLabel, { width: 72 }]}>{t.time}</AppText>
              <AppText style={[s.barVal, { width: 52, textAlign: 'left', color: colors.text }]}>{t.label}</AppText>
              <View style={s.barTrack}>
                <LinearGradient colors={['#7c3aed', '#3b82f6']} style={[s.barFill, { width: `${t.score}%` }]} />
              </View>
              <AppText style={[s.barVal, { color: colors.primary }]}>{t.score}%</AppText>
            </View>
          ))}
        </Card>
      </Section>
    </>
  );
}

function AITab({ d }) {
  const insights = d.ai_insights || [];
  const icons = ['🤖', '📊', '📈', '🎵', '🎙️', '💡', '🔥', '⚡'];
  const accentColors = ['#7c3aed', '#3b82f6', '#10b981', '#ec4899', '#f59e0b', '#06b6d4', '#e11d48', '#a78bfa'];

  return (
    <>
      <Section title="AI-Powered Insights">
        {insights.length === 0 ? (
          <Card>
            <AppText style={s.emptyText}>🤖 Post more content to unlock AI-powered insights about your audience.</AppText>
          </Card>
        ) : (
          insights.map((insight, i) => (
            <Card key={i} style={[s.aiInsightCard, { borderColor: `${accentColors[i % accentColors.length]}33` }]}>
              <LinearGradient
                colors={[`${accentColors[i % accentColors.length]}15`, 'transparent']}
                style={StyleSheet.absoluteFill}
              />
              <View style={[s.aiInsightIcon, { backgroundColor: `${accentColors[i % accentColors.length]}22` }]}>
                <AppText style={{ fontSize: 18 }}>{icons[i % icons.length]}</AppText>
              </View>
              <AppText style={s.aiInsightText}>{insight}</AppText>
            </Card>
          ))
        )}
      </Section>

      <Section title="Content Performance Score">
        <Card>
          <View style={s.engRow}>
            <View style={[s.engBadge, {
              backgroundColor: d.engagement_rate >= 5 ? '#10b98122' : d.engagement_rate >= 2 ? '#f59e0b22' : '#e11d4822',
              borderColor: d.engagement_rate >= 5 ? '#10b98144' : d.engagement_rate >= 2 ? '#f59e0b44' : '#e11d4844',
            }]}>
              <AppText style={[s.engRate, {
                color: d.engagement_rate >= 5 ? '#10b981' : d.engagement_rate >= 2 ? '#f59e0b' : '#e11d48'
              }]}>{d.engagement_rate}%</AppText>
            </View>
            <View style={{ flex: 1, marginLeft: 14, gap: 6 }}>
              <AppText style={s.engDesc}>Engagement Rate</AppText>
              <Bar label="Posts" value={d.total_posts} max={Math.max(d.total_posts, 10)} color="#7c3aed" />
              <Bar label="Stories" value={d.stories_count} max={Math.max(d.stories_count, 10)} color="#ec4899" />
            </View>
          </View>
        </Card>
      </Section>

      <Section title="Recommendations">
        {[
          d.voice_posts_count === 0 && { icon: '🎙️', tip: 'Try voice posts — they build deeper personal connections', color: '#f59e0b' },
          d.top_music?.length === 0 && { icon: '🎵', tip: 'Add music to your stories — they get significantly more views', color: '#ec4899' },
          d.total_shares === 0 && { icon: '📤', tip: 'Create shareable content to grow your reach organically', color: '#3b82f6' },
          d.stories_count === 0 && { icon: '📖', tip: 'Post stories — they expire in 24h and drive urgency', color: '#7c3aed' },
          { icon: '💬', tip: 'Reply to every comment in the first hour for maximum reach', color: '#10b981' },
        ].filter(Boolean).slice(0, 4).map((item, i) => (
          <View key={i} style={s.tipRow}>
            <View style={[s.tipIcon, { backgroundColor: `${item.color}22` }]}>
              <AppText style={{ fontSize: 16 }}>{item.icon}</AppText>
            </View>
            <AppText style={s.tipText}>{item.tip}</AppText>
          </View>
        ))}
      </Section>
    </>
  );
}

function MessagesTab({ d }) {
  return (
    <>
      <Section title="Messaging Stats">
        <View style={s.grid}>
          <StatCard label="Sent" value={d.messages_sent} icon="paper-plane-outline" color="#3b82f6" />
          <StatCard label="Received" value={d.messages_received} icon="chatbubble-outline" color="#7c3aed" />
          <StatCard label="Conversations" value={d.active_conversations} icon="chatbubbles-outline" color="#10b981" />
        </View>
      </Section>

      {d.top_chatters?.length > 0 && (
        <Section title="Most Active Chats">
          <Card style={{ gap: 0 }}>
            {d.top_chatters.map((u, i) => (
              <View key={u.id} style={[s.chatterRow, i < d.top_chatters.length - 1 && s.chatterBorder]}>
                {u.avatar ? (
                  <Image source={{ uri: u.avatar }} style={s.chatterAvatar} />
                ) : (
                  <View style={[s.chatterAvatar, s.chatterAvatarPlaceholder]}>
                    <AppText style={{ color: colors.muted, fontWeight: '700' }}>{u.name?.[0]}</AppText>
                  </View>
                )}
                <AppText style={s.chatterName} numberOfLines={1}>{u.name}</AppText>
                <View style={s.chatterBadge}>
                  <AppText style={s.chatterCount}>{u.count} msgs</AppText>
                </View>
              </View>
            ))}
          </Card>
        </Section>
      )}

      {d.messages_sent === 0 && d.messages_received === 0 && (
        <Card>
          <AppText style={s.emptyText}>💬 Start conversations to see messaging insights here.</AppText>
        </Card>
      )}
    </>
  );
}

function FamilyTab({ d }) {
  const fam = d.family || {};
  if (!fam.member_count) {
    return (
      <Card style={{ marginTop: 8 }}>
        <AppText style={s.emptyText}>👨‍👩‍👧 Join or create a family group to see family insights.</AppText>
      </Card>
    );
  }
  return (
    <>
      <Section title="Family Overview">
        <View style={s.grid}>
          <StatCard label="Members" value={fam.member_count} icon="people-outline" color="#7c3aed" />
          <StatCard label="Group Messages" value={fam.total_messages} icon="chatbubbles-outline" color="#3b82f6" />
          <StatCard label="Family Stories" value={fam.total_stories} icon="albums-outline" color="#ec4899" />
        </View>
      </Section>

      {fam.most_active_member && (
        <Section title="Most Active Member">
          <Card style={s.activeMemberRow}>
            {fam.most_active_member.avatar ? (
              <Image source={{ uri: fam.most_active_member.avatar }} style={s.chatterAvatar} />
            ) : (
              <View style={[s.chatterAvatar, s.chatterAvatarPlaceholder]}>
                <AppText style={{ color: colors.muted, fontWeight: '700' }}>
                  {fam.most_active_member.name?.[0]}
                </AppText>
              </View>
            )}
            <View style={{ flex: 1, marginLeft: 12 }}>
              <AppText style={s.chatterName}>{fam.most_active_member.name}</AppText>
              <AppText style={s.statSub}>{fam.most_active_member.count} messages sent</AppText>
            </View>
            <Ionicons name="trophy-outline" size={22} color="#f59e0b" />
          </Card>
        </Section>
      )}

      <Section title="Family Tip">
        <Card>
          <AppText style={s.aiInsight}>
            👨‍👩‍👧 Share more family stories and tag members to boost group engagement.
          </AppText>
        </Card>
      </Section>
    </>
  );
}

// ── Main Screen ───────────────────────────────────────────────

export default function PostInsightsScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    api.get('/extras/insights/profile')
      .then(({ data }) => setData(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <View style={s.center}>
      <LinearGradient colors={['#0f172a', '#1a0f2e', '#0f172a']} style={StyleSheet.absoluteFill} />
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );

  const renderTab = () => {
    if (!data) return null;
    switch (tab) {
      case 0: return <OverviewTab d={data} />;
      case 1: return <ContentTab d={data} />;
      case 2: return <ActivityTab d={data} />;
      case 3: return <AudienceTab d={data} />;
      case 4: return <AITab d={data} />;
      case 5: return <MessagesTab d={data} />;
      case 6: return <FamilyTab d={data} />;
      default: return null;
    }
  };

  return (
    <View style={s.container}>
      <LinearGradient colors={['#0f172a', '#1a0f2e', '#0f172a']} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <AppText style={s.headerTitle}>Insights</AppText>
      </View>

      {/* Tab Bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabBar} contentContainerStyle={s.tabBarContent}>
        {TABS.map((name, i) => (
          <TouchableOpacity key={name} onPress={() => setTab(i)} style={[s.tabBtn, tab === i && s.tabBtnActive]}>
            {tab === i && <LinearGradient colors={['#7c3aed', '#3b82f6']} style={StyleSheet.absoluteFill} borderRadius={20} />}
            <AppText style={[s.tabLabel, tab === i && s.tabLabelActive]}>{name}</AppText>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {renderTab()}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 52, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 22, fontWeight: '800', color: colors.text, marginLeft: 8 },

  tabBar: { flexGrow: 0, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  tabBarContent: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  tabBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  tabBtnActive: { borderColor: 'transparent' },
  tabLabel: { fontSize: 13, fontWeight: '600', color: colors.muted },
  tabLabelActive: { color: '#fff' },

  scroll: { padding: 16, paddingBottom: 100 },

  sectionTitle: { fontSize: 11, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, marginTop: 22 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { width: (width - 42) / 3, borderRadius: radius.lg, padding: 12, overflow: 'hidden', borderWidth: 1, gap: 5 },
  statIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 10, color: colors.muted, fontWeight: '600' },
  statSub: { fontSize: 10, color: '#10b981', fontWeight: '600' },

  card: { borderRadius: radius.lg, overflow: 'hidden', padding: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 2 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barLabel: { width: 68, fontSize: 12, color: colors.muted },
  barTrack: { flex: 1, height: 7, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  barVal: { width: 38, fontSize: 12, color: colors.text, fontWeight: '600', textAlign: 'right' },

  engRow: { flexDirection: 'row', alignItems: 'center' },
  engBadge: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  engRate: { fontSize: 20, fontWeight: '800' },
  engDesc: { fontSize: 13, color: colors.text, lineHeight: 18 },
  engFormula: { fontSize: 10, color: colors.muted, marginTop: 4 },

  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  tipIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tipText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 18 },

  topPostRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  topPostRank: { width: 24, alignItems: 'center' },
  rankNum: { fontSize: 12, fontWeight: '800', color: colors.muted },
  topPostThumb: { width: 52, height: 52, borderRadius: 10 },
  topPostThumbPlaceholder: { backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  topPostCaption: { fontSize: 12, color: colors.text, lineHeight: 16, marginBottom: 4 },
  topPostStats: { flexDirection: 'row', gap: 8 },
  topPostStat: { fontSize: 11, color: colors.muted },

  chatterRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 2, gap: 10 },
  chatterBorder: { borderBottomWidth: 0.5, borderBottomColor: colors.border },
  chatterAvatar: { width: 38, height: 38, borderRadius: 19 },
  chatterAvatarPlaceholder: { backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  chatterName: { flex: 1, fontSize: 14, color: colors.text, fontWeight: '600' },
  chatterBadge: { backgroundColor: 'rgba(124,58,237,0.2)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  chatterCount: { fontSize: 11, color: '#a78bfa', fontWeight: '700' },

  activeMemberRow: { flexDirection: 'row', alignItems: 'center' },

  aiInsight: { fontSize: 13, color: colors.text, lineHeight: 20 },
  emptyText: { fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 20 },

  // Activity / Chart
  chartContainer: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingTop: 8 },
  chartCol: { flex: 1, alignItems: 'center', gap: 4 },
  chartVal: { fontSize: 9, color: colors.muted, fontWeight: '700', height: 12 },
  chartBarWrap: { justifyContent: 'flex-end', width: '70%' },
  chartBar: { borderRadius: 4, width: '100%' },
  chartDay: { fontSize: 10, color: colors.muted, fontWeight: '600' },

  // Notification row
  notifRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  notifText: { fontSize: 13, color: colors.text, flex: 1, lineHeight: 18 },

  // Music
  musicRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  musicRank: { width: 20, alignItems: 'center' },
  musicName: { flex: 1, fontSize: 12, color: colors.text, fontWeight: '600' },
  musicBarWrap: { width: 60, height: 5, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden' },
  musicBarFill: { height: '100%', borderRadius: 3 },
  musicCount: { fontSize: 11, color: '#a78bfa', fontWeight: '700', width: 24, textAlign: 'right' },

  // Top Story
  topStoryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  topStoryThumb: { width: 56, height: 80, borderRadius: 10 },

  // AI Insights tab
  aiInsightCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  aiInsightIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  aiInsightText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 20 },
});
