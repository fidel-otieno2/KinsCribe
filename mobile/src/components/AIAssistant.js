import { useState } from 'react';
import {
  View, StyleSheet, TouchableOpacity, Modal, Pressable,
  TextInput, ScrollView, ActivityIndicator, Dimensions, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AppText from './AppText';
import { colors } from '../theme';
import api from '../api/axios';

const { width: SCREEN_W } = Dimensions.get('window');

const FEATURES = [
  { id: 'improve',   icon: 'sparkles',           color: '#8b5cf6', label: 'Improve',     sub: 'Polish your message' },
  { id: 'tone',      icon: 'analytics-outline',  color: '#f59e0b', label: 'Tone Check',  sub: 'Check how it sounds' },
  { id: 'shorter',   icon: 'remove-circle-outline', color: '#3b82f6', label: 'Shorter',  sub: 'Make it concise' },
  { id: 'formal',    icon: 'briefcase-outline',  color: '#10b981', label: 'Formal',      sub: 'Professional tone' },
  { id: 'friendly',  icon: 'heart-outline',      color: '#e0245e', label: 'Friendly',    sub: 'Warm & casual' },
  { id: 'translate', icon: 'language-outline',   color: '#06b6d4', label: 'Translate',   sub: 'To another language' },
  { id: 'reply',     icon: 'chatbubbles-outline', color: '#f97316', label: 'Smart Reply', sub: 'Suggest replies' },
  { id: 'idea',      icon: 'bulb-outline',        color: '#a855f7', label: 'Story Idea',  sub: 'Get inspiration' },
];

const LANGS = [
  { code: 'es', label: 'Spanish',    flag: '🇪🇸' },
  { code: 'fr', label: 'French',     flag: '🇫🇷' },
  { code: 'de', label: 'German',     flag: '🇩🇪' },
  { code: 'ar', label: 'Arabic',     flag: '🇸🇦' },
  { code: 'sw', label: 'Swahili',    flag: '🇰🇪' },
  { code: 'pt', label: 'Portuguese', flag: '🇧🇷' },
  { code: 'zh', label: 'Chinese',    flag: '🇨🇳' },
  { code: 'ja', label: 'Japanese',   flag: '🇯🇵' },
  { code: 'hi', label: 'Hindi',      flag: '🇮🇳' },
  { code: 'it', label: 'Italian',    flag: '🇮🇹' },
];

const TONE_COLORS = {
  positive: '#10b981', inspiring: '#10b981', funny: '#f59e0b',
  neutral: '#6b7280', sad: '#3b82f6', negative: '#e0245e', aggressive: '#e0245e',
};
const TONE_ICONS = {
  positive: 'happy-outline', inspiring: 'star-outline', funny: 'happy-outline',
  neutral: 'remove-circle-outline', sad: 'sad-outline', negative: 'warning-outline', aggressive: 'flame-outline',
};

// ── View states ───────────────────────────────────────────────
// 'home' | 'translate_pick' | 'loading' | 'result'

export default function AIAssistant({ visible, onClose, currentText, onUseText, lastMessage }) {
  const [view, setView]               = useState('home');
  const [activeFeature, setActive]    = useState(null);
  const [result, setResult]           = useState('');
  const [toneResult, setToneResult]   = useState(null);
  const [replies, setReplies]         = useState([]);
  const [customInput, setCustomInput] = useState('');
  const [error, setError]             = useState('');

  const workingText = () => currentText?.trim() || customInput?.trim() || '';

  const reset = () => {
    setView('home');
    setActive(null);
    setResult('');
    setToneResult(null);
    setReplies([]);
    setError('');
  };

  const handleClose = () => { reset(); onClose(); };

  const callAI = async (featureId, lang = '') => {
    setActive(featureId);
    setView('loading');
    setResult('');
    setToneResult(null);
    setReplies([]);
    setError('');

    const text = workingText();

    try {
      switch (featureId) {
        case 'improve': {
          const { data } = await api.post('/ai/chat', {
            message: `Improve this message. Keep it natural and concise. Return ONLY the improved text, no explanation, no quotes:\n${text}`,
          });
          setResult(data.response || '');
          break;
        }
        case 'shorter': {
          const { data } = await api.post('/ai/chat', {
            message: `Make this message shorter and more concise. Return ONLY the shortened text, no explanation:\n${text}`,
          });
          setResult(data.response || '');
          break;
        }
        case 'formal': {
          const { data } = await api.post('/ai/chat', {
            message: `Rewrite this message in a formal, professional tone. Return ONLY the rewritten text:\n${text}`,
          });
          setResult(data.response || '');
          break;
        }
        case 'friendly': {
          const { data } = await api.post('/ai/chat', {
            message: `Rewrite this message in a warm, friendly and casual tone. Return ONLY the rewritten text:\n${text}`,
          });
          setResult(data.response || '');
          break;
        }
        case 'translate': {
          const { data } = await api.post('/ai/chat', {
            message: `Translate this message to ${lang}. Return ONLY the translation, no explanation:\n${text}`,
          });
          setResult(data.response || '');
          break;
        }
        case 'tone': {
          const { data } = await api.post('/ai/tone-check', { text });
          setToneResult(data);
          break;
        }
        case 'reply': {
          const { data } = await api.post('/ai/smart-replies', {
            message: lastMessage?.trim() || text,
          });
          setReplies(data.replies || []);
          break;
        }
        case 'idea': {
          const { data } = await api.post('/ai/story-idea', {
            theme: text || 'family memory',
          });
          setResult(data.idea || '');
          break;
        }
      }
      setView('result');
    } catch (e) {
      setError('Something went wrong. Please try again.');
      setView('result');
    }
  };

  const handleFeatureTap = (featureId) => {
    if (featureId === 'translate') {
      setActive('translate');
      setView('translate_pick');
    } else {
      callAI(featureId);
    }
  };

  const activeFeatureObj = FEATURES.find(f => f.id === activeFeature);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <Pressable style={s.overlay} onPress={handleClose} />
      <View style={s.sheet}>
        <View style={s.handle} />

        {/* ── Header ── */}
        <View style={s.header}>
          <LinearGradient colors={['#7c3aed', '#3b82f6']} style={s.headerIcon}>
            <Ionicons name="sparkles" size={18} color="#fff" />
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <AppText style={s.title}>AI Assistant</AppText>
            <AppText style={s.subtitle}>Powered by Llama 3.3 · 70B</AppText>
          </View>
          {view !== 'home' && (
            <TouchableOpacity onPress={reset} style={s.backBtn}>
              <Ionicons name="chevron-back" size={18} color={colors.muted} />
              <AppText style={s.backText}>Back</AppText>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleClose} style={s.closeBtn}>
            <Ionicons name="close" size={20} color={colors.muted} />
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.body}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── HOME VIEW ── */}
          {view === 'home' && (
            <>
              {/* Text preview or input */}
              {currentText?.trim() ? (
                <View style={s.textPreview}>
                  <View style={s.textPreviewRow}>
                    <Ionicons name="create-outline" size={14} color={colors.primary} />
                    <AppText style={s.textPreviewLabel}>Your message</AppText>
                  </View>
                  <AppText style={s.textPreviewContent} numberOfLines={3}>{currentText}</AppText>
                </View>
              ) : (
                <TextInput
                  style={s.customInput}
                  placeholder="Type or paste text to work with..."
                  placeholderTextColor={colors.dim}
                  value={customInput}
                  onChangeText={setCustomInput}
                  multiline
                />
              )}

              {/* Feature grid */}
              <View style={s.grid}>
                {FEATURES.map(f => (
                  <TouchableOpacity
                    key={f.id}
                    style={s.featureCard}
                    onPress={() => handleFeatureTap(f.id)}
                    activeOpacity={0.7}
                  >
                    <LinearGradient
                      colors={[`${f.color}25`, `${f.color}08`]}
                      style={s.featureCardInner}
                    >
                      <View style={[s.featureIconWrap, { backgroundColor: `${f.color}22` }]}>
                        <Ionicons name={f.icon} size={24} color={f.color} />
                      </View>
                      <AppText style={s.featureLabel}>{f.label}</AppText>
                      <AppText style={s.featureSub}>{f.sub}</AppText>
                    </LinearGradient>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* ── TRANSLATE LANGUAGE PICKER ── */}
          {view === 'translate_pick' && (
            <>
              <AppText style={s.sectionTitle}>Choose a language</AppText>
              {!workingText() && (
                <TextInput
                  style={[s.customInput, { marginBottom: 14 }]}
                  placeholder="Enter text to translate..."
                  placeholderTextColor={colors.dim}
                  value={customInput}
                  onChangeText={setCustomInput}
                  multiline
                />
              )}
              <View style={s.langGrid}>
                {LANGS.map(lang => (
                  <TouchableOpacity
                    key={lang.code}
                    style={s.langCard}
                    onPress={() => callAI('translate', lang.label)}
                    activeOpacity={0.75}
                  >
                    <AppText style={s.langFlag}>{lang.flag}</AppText>
                    <AppText style={s.langLabel}>{lang.label}</AppText>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* ── LOADING ── */}
          {view === 'loading' && (
            <View style={s.loadingWrap}>
              {activeFeatureObj && (
                <View style={[s.loadingIconWrap, { backgroundColor: `${activeFeatureObj.color}18` }]}>
                  <Ionicons name={activeFeatureObj.icon} size={32} color={activeFeatureObj.color} />
                </View>
              )}
              <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: 16 }} />
              <AppText style={s.loadingTitle}>
                {activeFeatureObj?.label}...
              </AppText>
              <AppText style={s.loadingSubtitle}>AI is working on it</AppText>
            </View>
          )}

          {/* ── RESULT ── */}
          {view === 'result' && (
            <View style={s.resultWrap}>
              {/* Feature badge */}
              {activeFeatureObj && (
                <View style={[s.resultBadge, { backgroundColor: `${activeFeatureObj.color}15`, borderColor: `${activeFeatureObj.color}30` }]}>
                  <Ionicons name={activeFeatureObj.icon} size={16} color={activeFeatureObj.color} />
                  <AppText style={[s.resultBadgeText, { color: activeFeatureObj.color }]}>
                    {activeFeatureObj.label}
                  </AppText>
                </View>
              )}

              {/* Error */}
              {!!error && (
                <View style={s.errorBox}>
                  <Ionicons name="warning-outline" size={18} color="#e0245e" />
                  <AppText style={s.errorText}>{error}</AppText>
                </View>
              )}

              {/* Tone result */}
              {!error && toneResult && (
                <View style={s.toneWrap}>
                  <View style={[s.toneBadge, {
                    backgroundColor: `${TONE_COLORS[toneResult.tone] || '#6b7280'}15`,
                    borderColor: `${TONE_COLORS[toneResult.tone] || '#6b7280'}35`,
                  }]}>
                    <Ionicons name={TONE_ICONS[toneResult.tone] || 'remove-circle-outline'} size={28} color={TONE_COLORS[toneResult.tone] || '#6b7280'} />
                    <View>
                      <AppText style={[s.toneName, { color: TONE_COLORS[toneResult.tone] || '#6b7280' }]}>
                        {(toneResult.tone || 'neutral').charAt(0).toUpperCase() + (toneResult.tone || 'neutral').slice(1)}
                      </AppText>
                      <AppText style={s.toneSubLabel}>Detected tone</AppText>
                    </View>
                  </View>
                  <View style={s.scoreRow}>
                    <AppText style={s.scoreLabel}>Positivity</AppText>
                    <AppText style={[s.scoreNum, { color: TONE_COLORS[toneResult.tone] || '#6b7280' }]}>
                      {toneResult.score ?? '—'}/10
                    </AppText>
                  </View>
                  <View style={s.scoreTrack}>
                    <View style={[s.scoreFill, {
                      width: `${((toneResult.score || 0) / 10) * 100}%`,
                      backgroundColor: TONE_COLORS[toneResult.tone] || '#6b7280',
                    }]} />
                  </View>
                  {!!toneResult.suggestion && (
                    <View style={s.tipBox}>
                      <Ionicons name="bulb-outline" size={15} color="#f59e0b" />
                      <AppText style={s.tipText}>{toneResult.suggestion}</AppText>
                    </View>
                  )}
                  <TouchableOpacity style={s.retryBtn} onPress={() => callAI('tone')}>
                    <Ionicons name="refresh-outline" size={15} color={colors.muted} />
                    <AppText style={s.retryText}>Check again</AppText>
                  </TouchableOpacity>
                </View>
              )}

              {/* Smart replies */}
              {!error && replies.length > 0 && (
                <View style={s.repliesWrap}>
                  <AppText style={s.repliesTitle}>Tap a reply to send it</AppText>
                  {replies.map((r, i) => (
                    <TouchableOpacity
                      key={i}
                      style={s.replyRow}
                      onPress={() => { onUseText(r); handleClose(); }}
                      activeOpacity={0.75}
                    >
                      <AppText style={s.replyText}>{r}</AppText>
                      <View style={s.replyArrow}>
                        <Ionicons name="arrow-up" size={14} color="#fff" />
                      </View>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity style={s.retryBtn} onPress={() => callAI('reply')}>
                    <Ionicons name="refresh-outline" size={15} color={colors.muted} />
                    <AppText style={s.retryText}>Regenerate</AppText>
                  </TouchableOpacity>
                </View>
              )}

              {/* Text result (improve / shorter / formal / friendly / translate / idea) */}
              {!error && !!result && (
                <View style={s.textResultWrap}>
                  <AppText style={s.textResult}>{result}</AppText>

                  {activeFeature !== 'idea' && (
                    <TouchableOpacity
                      style={s.useBtn}
                      onPress={() => { onUseText(result); handleClose(); }}
                      activeOpacity={0.85}
                    >
                      <LinearGradient colors={['#7c3aed', '#3b82f6']} style={s.useBtnGrad}>
                        <Ionicons name="checkmark-circle" size={18} color="#fff" />
                        <AppText style={s.useBtnText}>Use this</AppText>
                      </LinearGradient>
                    </TouchableOpacity>
                  )}

                  <View style={s.actionRow}>
                    <TouchableOpacity
                      style={s.secondaryBtn}
                      onPress={() => activeFeature === 'translate'
                        ? setView('translate_pick')
                        : callAI(activeFeature)
                      }
                    >
                      <Ionicons name="refresh-outline" size={15} color={colors.muted} />
                      <AppText style={s.secondaryBtnText}>
                        {activeFeature === 'translate' ? 'Change language' : 'Try again'}
                      </AppText>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}

        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: '#0d1117',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    maxHeight: '90%',
    borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.08)',
  },
  handle: {
    width: 38, height: 4, backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 2, alignSelf: 'center', marginTop: 10,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  headerIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 11, color: colors.dim, marginTop: 1 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)' },
  backText: { fontSize: 13, color: colors.muted },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' },
  body: { padding: 16, paddingBottom: 48 },

  // Text preview
  textPreview: {
    backgroundColor: 'rgba(124,58,237,0.08)', borderRadius: 14,
    padding: 14, marginBottom: 18,
    borderWidth: 0.5, borderColor: 'rgba(124,58,237,0.22)',
  },
  textPreviewRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  textPreviewLabel: { fontSize: 10, color: colors.primary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  textPreviewContent: { fontSize: 14, color: colors.text, lineHeight: 21 },

  customInput: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14,
    padding: 14, color: colors.text, fontSize: 14,
    minHeight: 90, textAlignVertical: 'top',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 18,
  },

  // Feature grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  featureCard: {
    width: (SCREEN_W - 52) / 2, borderRadius: 18, overflow: 'hidden',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  featureCardInner: { padding: 16, gap: 6, minHeight: 110 },
  featureIconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  featureLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
  featureSub: { fontSize: 11, color: colors.muted, lineHeight: 16 },

  // Translate lang picker
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 14 },
  langGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  langCard: {
    width: (SCREEN_W - 62) / 3, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', paddingVertical: 14, gap: 6,
  },
  langFlag: { fontSize: 28 },
  langLabel: { fontSize: 12, fontWeight: '600', color: colors.text },

  // Loading
  loadingWrap: { alignItems: 'center', paddingVertical: 50, gap: 8 },
  loadingIconWrap: { width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  loadingTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginTop: 8 },
  loadingSubtitle: { fontSize: 13, color: colors.muted },

  // Result
  resultWrap: { gap: 14 },
  resultBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 0.5,
  },
  resultBadgeText: { fontSize: 13, fontWeight: '700' },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(224,36,94,0.1)', borderRadius: 12, padding: 14,
    borderWidth: 0.5, borderColor: 'rgba(224,36,94,0.25)',
  },
  errorText: { fontSize: 14, color: '#e0245e', flex: 1 },

  // Tone
  toneWrap: { gap: 12 },
  toneBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 16, padding: 16, borderWidth: 1,
  },
  toneName: { fontSize: 20, fontWeight: '800' },
  toneSubLabel: { fontSize: 11, color: colors.muted, marginTop: 2 },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  scoreLabel: { fontSize: 13, color: colors.muted },
  scoreNum: { fontSize: 16, fontWeight: '800' },
  scoreTrack: { height: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' },
  scoreFill: { height: '100%', borderRadius: 4 },
  tipBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: 'rgba(245,158,11,0.08)', borderRadius: 12, padding: 12,
    borderWidth: 0.5, borderColor: 'rgba(245,158,11,0.2)',
  },
  tipText: { fontSize: 13, color: colors.text, flex: 1, lineHeight: 19 },

  // Smart replies
  repliesWrap: { gap: 10 },
  repliesTitle: { fontSize: 12, color: colors.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  replyRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(124,58,237,0.1)', borderRadius: 14, padding: 14,
    borderWidth: 0.5, borderColor: 'rgba(124,58,237,0.25)',
  },
  replyText: { fontSize: 14, color: colors.text, flex: 1, lineHeight: 20 },
  replyArrow: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginLeft: 10,
  },

  // Text result
  textResultWrap: { gap: 12 },
  textResult: {
    fontSize: 15, color: colors.text, lineHeight: 23,
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 16,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.09)',
  },
  useBtn: { borderRadius: 14, overflow: 'hidden' },
  useBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15 },
  useBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  actionRow: { flexDirection: 'row', justifyContent: 'center' },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 16 },
  secondaryBtnText: { fontSize: 13, color: colors.muted },

  retryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  retryText: { fontSize: 13, color: colors.muted },
});
