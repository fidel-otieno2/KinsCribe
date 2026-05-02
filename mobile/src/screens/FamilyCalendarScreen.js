import { useState, useEffect, useCallback } from 'react';
import {
  View, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, TextInput, Modal, Dimensions,
  Platform,
} from 'react-native';
import AppText from '../components/AppText';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import api from '../api/axios';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from '../i18n';
import { colors, radius } from '../theme';
import Toast from '../components/Toast';
import useToast from '../hooks/useToast';

const { width } = Dimensions.get('window');
const DAY_SIZE = (width - 32 - 24) / 7;

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const EVENT_TYPES = [
  { key: 'birthday', label: '🎂 Birthday', color: '#ec4899' },
  { key: 'anniversary', label: '💍 Anniversary', color: '#f59e0b' },
  { key: 'event', label: '📅 Event', color: '#7c3aed' },
  { key: 'milestone', label: '🏆 Milestone', color: '#10b981' },
  { key: 'appointment', label: '🏥 Appointment', color: '#3b82f6' },
  { key: 'vacation', label: '✈️ Vacation', color: '#06b6d4' },
  { key: 'meeting', label: '👥 Meeting', color: '#8b5cf6' },
];

function EventDetailsModal({ visible, onClose, event, onDelete, onEdit }) {
  const { theme } = useTheme();
  
  if (!event) return null;
  
  const eventType = EVENT_TYPES.find(t => t.key === event.event_type) || EVENT_TYPES[2];
  const eventDate = new Date(event.event_date);
  
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity 
        style={m.overlay} 
        activeOpacity={1} 
        onPress={onClose}
      >
        <BlurView intensity={30} tint="dark" style={m.overlay}>
          <TouchableOpacity 
            activeOpacity={1} 
            style={m.detailsCard}
            onPress={(e) => e.stopPropagation()}
          >
            <LinearGradient 
              colors={[`${event.color}22`, 'rgba(15,23,42,0.95)']} 
              style={StyleSheet.absoluteFill} 
            />
            
            {/* Header */}
            <View style={[m.detailsHeader, { borderBottomColor: theme.border }]}>
              <View style={[m.eventTypeIcon, { backgroundColor: `${event.color}33` }]}>
                <AppText style={{ fontSize: 24 }}>{eventType.label.split(' ')[0]}</AppText>
              </View>
              <TouchableOpacity onPress={onClose} style={m.closeBtn}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            
            {/* Content */}
            <ScrollView style={m.detailsContent} showsVerticalScrollIndicator={false}>
              <AppText style={[m.detailsTitle, { color: theme.text }]}>{event.title}</AppText>
              
              <View style={m.detailsRow}>
                <Ionicons name="calendar-outline" size={20} color={event.color} />
                <View style={{ flex: 1 }}>
                  <AppText style={[m.detailsLabel, { color: theme.muted }]}>Date & Time</AppText>
                  <AppText style={[m.detailsValue, { color: theme.text }]}>
                    {eventDate.toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      month: 'long', 
                      day: 'numeric', 
                      year: 'numeric' 
                    })}
                  </AppText>
                  <AppText style={[m.detailsValue, { color: theme.muted, fontSize: 13 }]}>
                    {eventDate.toLocaleTimeString('en-US', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </AppText>
                </View>
              </View>
              
              {event.description && (
                <View style={m.detailsRow}>
                  <Ionicons name="document-text-outline" size={20} color={event.color} />
                  <View style={{ flex: 1 }}>
                    <AppText style={[m.detailsLabel, { color: theme.muted }]}>Description</AppText>
                    <AppText style={[m.detailsValue, { color: theme.text }]}>
                      {event.description}
                    </AppText>
                  </View>
                </View>
              )}
              
              <View style={m.detailsRow}>
                <Ionicons name="pricetag-outline" size={20} color={event.color} />
                <View style={{ flex: 1 }}>
                  <AppText style={[m.detailsLabel, { color: theme.muted }]}>Type</AppText>
                  <AppText style={[m.detailsValue, { color: theme.text }]}>
                    {eventType.label}
                  </AppText>
                </View>
              </View>
              
              {event.is_recurring && (
                <View style={m.detailsRow}>
                  <Ionicons name="repeat-outline" size={20} color={event.color} />
                  <View style={{ flex: 1 }}>
                    <AppText style={[m.detailsLabel, { color: theme.muted }]}>Recurring</AppText>
                    <AppText style={[m.detailsValue, { color: theme.text }]}>
                      Repeats {event.recurrence || 'yearly'}
                    </AppText>
                  </View>
                </View>
              )}
              
              {event.creator_name && (
                <View style={m.detailsRow}>
                  <Ionicons name="person-outline" size={20} color={event.color} />
                  <View style={{ flex: 1 }}>
                    <AppText style={[m.detailsLabel, { color: theme.muted }]}>Created by</AppText>
                    <AppText style={[m.detailsValue, { color: theme.text }]}>
                      {event.creator_name}
                    </AppText>
                  </View>
                </View>
              )}
            </ScrollView>
            
            {/* Actions */}
            <View style={[m.detailsActions, { borderTopColor: theme.border }]}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity 
                  style={[m.actionBtn, { flex: 1, backgroundColor: 'rgba(124,58,237,0.1)' }]}
                  onPress={() => {
                    onClose();
                    onEdit(event);
                  }}
                >
                  <Ionicons name="create-outline" size={20} color={colors.primary} />
                  <AppText style={[m.actionBtnText, { color: colors.primary }]}>Edit</AppText>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[m.actionBtn, { flex: 1, backgroundColor: 'rgba(239,68,68,0.1)' }]}
                  onPress={() => {
                    onClose();
                    onDelete(event);
                  }}
                >
                  <Ionicons name="trash-outline" size={20} color="#ef4444" />
                  <AppText style={[m.actionBtnText, { color: '#ef4444' }]}>Delete</AppText>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </BlurView>
      </TouchableOpacity>
    </Modal>
  );
}

function AddEventModal({ visible, onClose, onSave, selectedDate, editEvent }) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { toast, hide, info } = useToast();
  const [form, setForm] = useState({ 
    title: '', 
    description: '', 
    event_type: 'event', 
    color: '#7c3aed', 
    is_recurring: false, 
    recurrence: 'yearly',
    hour: '12',
    minute: '00',
    period: 'PM',
  });
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Load edit event data
  useEffect(() => {
    if (editEvent) {
      const eventDate = new Date(editEvent.event_date);
      const hours = eventDate.getHours();
      const minutes = eventDate.getMinutes();
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHour = hours % 12 || 12;
      
      setForm({
        title: editEvent.title || '',
        description: editEvent.description || '',
        event_type: editEvent.event_type || 'event',
        color: editEvent.color || '#7c3aed',
        is_recurring: editEvent.is_recurring || false,
        recurrence: editEvent.recurrence || 'yearly',
        hour: displayHour.toString().padStart(2, '0'),
        minute: minutes.toString().padStart(2, '0'),
        period: period,
      });
    } else {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHour = hours % 12 || 12;
      
      setForm({
        title: '',
        description: '',
        event_type: 'event',
        color: '#7c3aed',
        is_recurring: false,
        recurrence: 'yearly',
        hour: displayHour.toString().padStart(2, '0'),
        minute: minutes.toString().padStart(2, '0'),
        period: period,
      });
    }
  }, [editEvent, visible]);

  const handleSave = async () => {
    if (!form.title.trim()) return info('Please enter an event title');
    setLoading(true);
    try {
      // Combine selected date with chosen time
      const eventDateTime = editEvent ? new Date(editEvent.event_date) : new Date(selectedDate);
      
      // Convert 12-hour format to 24-hour
      let hours = parseInt(form.hour);
      if (form.period === 'PM' && hours !== 12) hours += 12;
      if (form.period === 'AM' && hours === 12) hours = 0;
      
      eventDateTime.setHours(hours);
      eventDateTime.setMinutes(parseInt(form.minute));
      
      const eventData = { 
        title: form.title,
        description: form.description,
        event_type: form.event_type,
        color: form.color,
        is_recurring: form.is_recurring,
        recurrence: form.recurrence,
        event_date: eventDateTime.toISOString(),
      };
      
      if (editEvent) {
        // Update existing event
        await api.put(`/extras/calendar/${editEvent.id}`, eventData);
      } else {
        // Create new event
        await onSave(eventData);
      }
      
      const now = new Date();
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();
      const currentPeriod = currentHours >= 12 ? 'PM' : 'AM';
      const currentDisplayHour = currentHours % 12 || 12;
      
      setForm({ 
        title: '', 
        description: '', 
        event_type: 'event', 
        color: '#7c3aed', 
        is_recurring: false, 
        recurrence: 'yearly',
        hour: currentDisplayHour.toString().padStart(2, '0'),
        minute: currentMinutes.toString().padStart(2, '0'),
        period: currentPeriod,
      });
      onClose();
    } catch {} finally { setLoading(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={m.modalOverlay}>
        <TouchableOpacity 
          style={StyleSheet.absoluteFill} 
          activeOpacity={1} 
          onPress={onClose}
        />
        <BlurView intensity={90} tint="dark" style={m.sheetContainer}>
          <View style={m.sheet}>
            <LinearGradient 
              colors={editEvent ? ['rgba(59,130,246,0.15)', 'rgba(15,23,42,0.98)'] : ['rgba(124,58,237,0.15)', 'rgba(15,23,42,0.98)']} 
              style={StyleSheet.absoluteFill} 
            />
            <View style={m.handle} />
            <AppText style={m.title}>{editEvent ? 'Edit Event' : 'Add Event'}</AppText>
            {selectedDate && !editEvent && <AppText style={m.dateLabel}>{selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</AppText>}
            {editEvent && <AppText style={m.dateLabel}>Editing: {editEvent.title}</AppText>}

          <AppText style={m.label}>Event Type</AppText>
          <View style={m.typeRow}>
            {EVENT_TYPES.map(t => (
              <TouchableOpacity key={t.key} style={[m.typeBtn, form.event_type === t.key && { borderColor: t.color, backgroundColor: `${t.color}22` }]} onPress={() => { set('event_type', t.key); set('color', t.color); }}>
                <AppText style={[m.typeBtnText, form.event_type === t.key && { color: t.color }]}>{t.label}</AppText>
              </TouchableOpacity>
            ))}
          </View>

          <AppText style={m.label}>Title *</AppText>
          <TextInput style={[m.input, { backgroundColor: theme.bgCard, color: theme.text, borderColor: theme.border2 }]} placeholder="e.g. Dad's Birthday" placeholderTextColor={theme.dim} value={form.title} onChangeText={v => set('title', v)} />

          <AppText style={m.label}>Description (optional)</AppText>
          <TextInput style={[m.input, { height: 70, backgroundColor: theme.bgCard, color: theme.text, borderColor: theme.border2 }]} placeholder="Add details..." placeholderTextColor={theme.dim} multiline value={form.description} onChangeText={v => set('description', v)} />

          <TouchableOpacity style={m.recurringRow} onPress={() => set('is_recurring', !form.is_recurring)}>
            <View style={[m.checkbox, form.is_recurring && m.checkboxActive]}>
              {form.is_recurring && <Ionicons name="checkmark" size={13} color="#fff" />}
            </View>
            <AppText style={m.recurringLabel}>Repeat yearly (e.g. birthdays)</AppText>
          </TouchableOpacity>

          <AppText style={m.label}>Time</AppText>
          <View style={m.timeRow}>
            <TextInput
              style={[m.timeInput, { backgroundColor: theme.bgCard, color: theme.text, borderColor: theme.border2 }]}
              value={form.hour}
              onChangeText={(v) => {
                const num = parseInt(v) || 0;
                if (num >= 1 && num <= 12) set('hour', v.padStart(2, '0'));
              }}
              keyboardType="number-pad"
              maxLength={2}
              placeholder="12"
              placeholderTextColor={theme.dim}
            />
            <AppText style={[m.timeSeparator, { color: theme.text }]}>:</AppText>
            <TextInput
              style={[m.timeInput, { backgroundColor: theme.bgCard, color: theme.text, borderColor: theme.border2 }]}
              value={form.minute}
              onChangeText={(v) => {
                const num = parseInt(v) || 0;
                if (num >= 0 && num <= 59) set('minute', v.padStart(2, '0'));
              }}
              keyboardType="number-pad"
              maxLength={2}
              placeholder="00"
              placeholderTextColor={theme.dim}
            />
            <View style={m.periodButtons}>
              <TouchableOpacity
                style={[m.periodBtn, form.period === 'AM' && m.periodBtnActive]}
                onPress={() => set('period', 'AM')}
              >
                <AppText style={[m.periodBtnText, form.period === 'AM' && m.periodBtnTextActive]}>AM</AppText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[m.periodBtn, form.period === 'PM' && m.periodBtnActive]}
                onPress={() => set('period', 'PM')}
              >
                <AppText style={[m.periodBtnText, form.period === 'PM' && m.periodBtnTextActive]}>PM</AppText>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={m.saveBtn} onPress={handleSave} disabled={loading}>
            <LinearGradient colors={['#7c3aed', '#3b82f6']} style={m.saveBtnGrad}>
              {loading ? <ActivityIndicator color="#fff" size="small" /> : <AppText style={m.saveBtnText}>Save Event</AppText>}
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={m.cancelBtn} onPress={onClose}>
            <AppText style={m.cancelText}>{t('cancel')}</AppText>
          </TouchableOpacity>
        </View>
      </BlurView>
    </View>
    </Modal>
  );
}

const m = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    maxHeight: '90%',
  },
  sheet: { 
    padding: 24, 
    paddingBottom: 40,
    backgroundColor: 'rgba(15,23,42,0.95)',
  },
  handle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 4 },
  dateLabel: { fontSize: 13, color: colors.primary, fontWeight: '600', marginBottom: 16 },
  label: { fontSize: 11, color: colors.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  typeBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border2, backgroundColor: 'rgba(30,41,59,0.6)' },
  typeBtnText: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  input: { backgroundColor: 'rgba(30,41,59,0.9)', borderWidth: 1, borderColor: colors.border2, borderRadius: radius.md, padding: 13, color: colors.text, fontSize: 14, marginBottom: 14, textAlignVertical: 'top' },
  recurringRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.border2, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  recurringLabel: { fontSize: 14, color: colors.text },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  timeInput: { width: 60, height: 50, borderRadius: radius.md, borderWidth: 1, textAlign: 'center', fontSize: 18, fontWeight: '700' },
  timeSeparator: { fontSize: 24, fontWeight: '700' },
  periodButtons: { flexDirection: 'row', gap: 6, marginLeft: 8 },
  periodBtn: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border2, backgroundColor: 'rgba(30,41,59,0.6)' },
  periodBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  periodBtnText: { fontSize: 14, fontWeight: '700', color: colors.muted },
  periodBtnTextActive: { color: '#fff' },
  saveBtn: { borderRadius: radius.md, overflow: 'hidden', marginBottom: 10 },
  saveBtnGrad: { paddingVertical: 14, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  cancelBtn: { alignItems: 'center', paddingVertical: 8 },
  cancelText: { color: colors.muted, fontSize: 14 },
  closeBtn: { padding: 4 },
  // Event Details Modal
  overlay: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  detailsCard: { 
    width: '100%', 
    maxWidth: 400,
    maxHeight: '80%',
    borderRadius: radius.xl, 
    overflow: 'hidden',
    backgroundColor: 'rgba(15,23,42,0.98)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.3)',
  },
  detailsHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
  },
  eventTypeIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsContent: {
    padding: 20,
  },
  detailsTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 24,
  },
  detailsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  detailsLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  detailsValue: {
    fontSize: 15,
    lineHeight: 22,
  },
  detailsActions: {
    padding: 20,
    borderTopWidth: 1,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: radius.md,
  },
  actionBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
});

export default function FamilyCalendarScreen({ navigation }) {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();
  const { toast, hide, success, error } = useToast();
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [events, setEvents] = useState([]);
  const [onThisDay, setOnThisDay] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showEventDetails, setShowEventDetails] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);

  const fetchEvents = useCallback(async () => {
    try {
      const [eventsRes, onThisDayRes, upcomingRes] = await Promise.all([
        api.get(`/extras/calendar?month=${currentMonth + 1}&year=${currentYear}`),
        api.get('/extras/on-this-day'),
        api.get('/extras/calendar/upcoming'),
      ]);
      setEvents(eventsRes.data.events || []);
      setOnThisDay(onThisDayRes.data.stories || []);
      setUpcoming(upcomingRes.data.events || []);
    } catch {} finally { setLoading(false); }
  }, [currentMonth, currentYear]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const addEvent = async (eventData) => {
    try {
      if (editingEvent) {
        // Update existing event
        await api.put(`/extras/calendar/${editingEvent.id}`, eventData);
        success('Event updated successfully!');
        setEditingEvent(null);
      } else {
        // Create new event
        const { data } = await api.post('/extras/calendar', eventData);
        setEvents(prev => [...prev, data.event]);
        success('Event added successfully!');
      }
      fetchEvents(); // Refresh to get updated data
    } catch (err) {
      error(editingEvent ? 'Failed to update event' : 'Failed to add event');
      throw err;
    }
  };

  const deleteEvent = (event) => {
    Alert.alert('Delete Event', `Delete "${event.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/extras/calendar/${event.id}`);
          setEvents(prev => prev.filter(e => e.id !== event.id));
          setUpcoming(prev => prev.filter(e => e.id !== event.id));
          success('Event deleted');
        } catch {
          error('Failed to delete event');
        }
      }},
    ]);
  };

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
    else setCurrentMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
    else setCurrentMonth(m => m + 1);
  };

  // Build calendar grid
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const getEventsForDay = (day) => {
    if (!day) return [];
    return events.filter(e => {
      const d = new Date(e.event_date);
      return d.getDate() === day && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
  };

  const isToday = (day) => day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <Toast visible={toast.visible} type={toast.type} message={toast.message} onHide={hide} />
      <LinearGradient colors={isDark ? ['#0f172a', '#1a0f2e', '#0f172a'] : [theme.bg, theme.bgSecondary, theme.bg]} style={StyleSheet.absoluteFill} />

      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <AppText style={[s.headerTitle, { color: theme.text }]}>Family Calendar</AppText>
        <TouchableOpacity style={s.addBtn} onPress={() => { setSelectedDate(new Date()); setShowAdd(true); }}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

        {/* On This Day */}
        {onThisDay.length > 0 && (
          <View style={s.onThisDay}>
            <LinearGradient colors={['rgba(124,58,237,0.3)', 'rgba(59,130,246,0.2)']} style={s.onThisDayGrad}>
              <Ionicons name="sparkles" size={16} color="#a78bfa" />
              <AppText style={s.onThisDayTitle}>On This Day</AppText>
              <AppText style={s.onThisDayCount}>{onThisDay.length} {onThisDay.length === 1 ? 'memory' : 'memories'}</AppText>
            </LinearGradient>
          </View>
        )}

        {/* Month navigation */}
        <View style={s.monthNav}>
          <TouchableOpacity onPress={prevMonth} style={s.navBtn}>
            <Ionicons name="chevron-back" size={22} color={theme.text} />
          </TouchableOpacity>
          <AppText style={[s.monthTitle, { color: theme.text }]}>{MONTHS[currentMonth]} {currentYear}</AppText>
          <TouchableOpacity onPress={nextMonth} style={s.navBtn}>
            <Ionicons name="chevron-forward" size={22} color={theme.text} />
          </TouchableOpacity>
        </View>

        {/* Day headers */}
        <View style={s.dayHeaders}>
          {DAYS.map(d => <AppText key={d} style={[s.dayHeader, { color: theme.muted }]}>{d}</AppText>)}
        </View>

        {/* Calendar grid */}
        <View style={s.grid}>
          {cells.map((day, idx) => {
            const dayEvents = getEventsForDay(day);
            return (
              <TouchableOpacity
                key={idx}
                style={[s.cell, isToday(day) && s.cellToday, !day && s.cellEmpty]}
                onPress={() => {
                  if (!day) return;
                  setSelectedDate(new Date(currentYear, currentMonth, day));
                  setShowAdd(true);
                }}
                activeOpacity={day ? 0.7 : 1}
              >
                {day && (
                  <>
                    <AppText style={[s.cellDay, { color: theme.text }, isToday(day) && s.cellDayToday]}>{day}</AppText>
                    <View style={s.eventDots}>
                      {dayEvents.slice(0, 3).map((e, i) => (
                        <View key={i} style={[s.eventDot, { backgroundColor: e.color || colors.primary }]} />
                      ))}
                    </View>
                  </>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Upcoming events */}
        {upcoming.length > 0 && (
          <View style={s.section}>
            <AppText style={[s.sectionTitle, { color: theme.muted }]}>Upcoming Events</AppText>
            {upcoming.map(event => (
              <TouchableOpacity 
                key={event.id} 
                style={[s.eventRow, { borderBottomColor: theme.border }]} 
                onPress={() => {
                  setSelectedEvent(event);
                  setShowEventDetails(true);
                }}
                activeOpacity={0.8}
              >
                <View style={[s.eventColorBar, { backgroundColor: event.color || theme.primary }]} />
                <View style={{ flex: 1 }}>
                  <AppText style={[s.eventTitle, { color: theme.text }]}>{event.title}</AppText>
                  <AppText style={[s.eventDate, { color: theme.muted }]}>
                    {new Date(event.event_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    {' · '}
                    {new Date(event.event_date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    {event.is_recurring && ' · Yearly'}
                  </AppText>
                </View>
                <View style={[s.eventTypeBadge, { backgroundColor: `${event.color || colors.primary}22` }]}>
                  <AppText style={[s.eventTypeText, { color: event.color || colors.primary }]}>{event.event_type}</AppText>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* This month's events */}
        {events.length > 0 && (
          <View style={s.section}>
            <AppText style={[s.sectionTitle, { color: theme.muted }]}>{MONTHS[currentMonth]} Events</AppText>
            {events.map(event => (
              <TouchableOpacity 
                key={event.id} 
                style={[s.eventRow, { borderBottomColor: theme.border }]} 
                onPress={() => {
                  setSelectedEvent(event);
                  setShowEventDetails(true);
                }}
                activeOpacity={0.8}
              >
                <View style={[s.eventColorBar, { backgroundColor: event.color || theme.primary }]} />
                <View style={{ flex: 1 }}>
                  <AppText style={[s.eventTitle, { color: theme.text }]}>{event.title}</AppText>
                  <AppText style={[s.eventDate, { color: theme.muted }]}>
                    {new Date(event.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    {' · '}
                    {new Date(event.event_date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    {event.description ? ` · ${event.description.substring(0, 30)}${event.description.length > 30 ? '...' : ''}` : ''}
                  </AppText>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.dim} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {events.length === 0 && !loading && (
          <View style={s.emptyMonth}>
            <AppText style={[s.emptyMonthText, { color: theme.muted }]}>No events in {MONTHS[currentMonth]}</AppText>
            <AppText style={[s.emptyMonthSub, { color: theme.dim }]}>Tap + to add a family event</AppText>
          </View>
        )}
      </ScrollView>

      <AddEventModal
        visible={showAdd}
        onClose={() => {
          setShowAdd(false);
          setEditingEvent(null);
        }}
        onSave={addEvent}
        selectedDate={selectedDate}
        editEvent={editingEvent}
      />
      
      <EventDetailsModal
        visible={showEventDetails}
        onClose={() => setShowEventDetails(false)}
        event={selectedEvent}
        onDelete={deleteEvent}
        onEdit={(event) => {
          setEditingEvent(event);
          setSelectedDate(new Date(event.event_date));
          setShowAdd(true);
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 52, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 22, fontWeight: '800', color: colors.text, marginLeft: 8 },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  onThisDay: { margin: 16, borderRadius: radius.lg, overflow: 'hidden' },
  onThisDayGrad: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14 },
  onThisDayTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: '#a78bfa' },
  onThisDayCount: { fontSize: 13, color: colors.muted },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  navBtn: { padding: 8 },
  monthTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  dayHeaders: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 4 },
  dayHeader: { width: DAY_SIZE, textAlign: 'center', fontSize: 11, fontWeight: '700', color: colors.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 0 },
  cell: { width: DAY_SIZE, height: DAY_SIZE + 8, alignItems: 'center', paddingTop: 4, borderRadius: 8 },
  cellToday: { backgroundColor: 'rgba(124,58,237,0.2)' },
  cellEmpty: {},
  cellDay: { fontSize: 14, color: colors.text, fontWeight: '500' },
  cellDayToday: { color: colors.primary, fontWeight: '800' },
  eventDots: { flexDirection: 'row', gap: 2, marginTop: 2 },
  eventDot: { width: 4, height: 4, borderRadius: 2 },
  section: { paddingHorizontal: 16, paddingTop: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  eventColorBar: { width: 4, height: 40, borderRadius: 2 },
  eventTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  eventDate: { fontSize: 12, color: colors.muted, marginTop: 2 },
  eventTypeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  eventTypeText: { fontSize: 11, fontWeight: '600' },
  emptyMonth: { alignItems: 'center', paddingTop: 40, gap: 6 },
  emptyMonthText: { fontSize: 16, color: colors.muted },
  emptyMonthSub: { fontSize: 13, color: colors.dim },
});
