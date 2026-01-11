import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../src/contexts/AuthContext';
import api from '../src/services/api';

interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  communityId?: string;
  communityName?: string;
  createdBy: string;
  createdByName: string;
  attendees: string[];
  attendeeCount?: number;
  maxAttendees?: number;
  isOnline: boolean;
  meetingLink?: string;
  isAttending?: boolean;
  isFull?: boolean;
  isCreator?: boolean;
}

const MONTHS_TR = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

const DAYS_TR = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

export default function EventsScreen() {
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const { communityId } = useLocalSearchParams<{ communityId?: string }>();
  
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'calendar' | 'upcoming' | 'my'>('calendar');
  
  // Create event form
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    date: '',
    time: '19:00',
    location: '',
    isOnline: false,
    meetingLink: '',
    maxAttendees: '',
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadEvents();
  }, [communityId]);

  const loadEvents = async () => {
    try {
      const params = communityId ? `?community_id=${communityId}` : '';
      const response = await api.get(`/events${params}`);
      setEvents(response.data || []);
    } catch (error) {
      console.error('Error loading events:', error);
      // Demo data fallback
      setEvents([
        {
          id: '1',
          title: 'Girişimcilik Buluşması',
          description: 'Aylık networking etkinliğimiz',
          date: new Date().toISOString().split('T')[0],
          time: '19:00',
          location: 'İstanbul, Levent',
          communityName: 'İstanbul Girişimciler',
          createdBy: 'admin',
          createdByName: 'Admin',
          attendees: ['user1', 'user2'],
          attendeeCount: 2,
          maxAttendees: 50,
          isOnline: false,
          isAttending: false,
          isFull: false,
        },
      ]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadEvents();
  };

  const handleCreateEvent = async () => {
    if (!newEvent.title || !newEvent.date) {
      Alert.alert('Hata', 'Lütfen başlık ve tarih girin');
      return;
    }

    setCreating(true);
    try {
      await api.post('/events', {
        title: newEvent.title,
        description: newEvent.description,
        date: newEvent.date,
        time: newEvent.time,
        location: newEvent.location,
        isOnline: newEvent.isOnline,
        meetingLink: newEvent.isOnline ? newEvent.meetingLink : undefined,
        maxAttendees: newEvent.maxAttendees ? parseInt(newEvent.maxAttendees) : undefined,
        communityId: communityId || undefined,
      });
      
      Alert.alert('Başarılı', 'Etkinlik oluşturuldu');
      setShowCreateModal(false);
      setNewEvent({
        title: '',
        description: '',
        date: '',
        time: '19:00',
        location: '',
        isOnline: false,
        meetingLink: '',
        maxAttendees: '',
      });
      loadEvents();
    } catch (error: any) {
      Alert.alert('Hata', error?.response?.data?.detail || 'Etkinlik oluşturulamadı');
    } finally {
      setCreating(false);
    }
  };

  const handleJoinEvent = async (eventId: string) => {
    try {
      await api.post(`/events/${eventId}/join`);
      setEvents(events.map(e => 
        e.id === eventId 
          ? { ...e, isAttending: true, attendeeCount: (e.attendeeCount || 0) + 1 }
          : e
      ));
      Alert.alert('Başarılı', 'Etkinliğe katıldınız');
    } catch (error: any) {
      Alert.alert('Hata', error?.response?.data?.detail || 'Katılım işlemi başarısız');
    }
  };

  const handleLeaveEvent = async (eventId: string) => {
    try {
      await api.post(`/api/events/${eventId}/leave`);
      setEvents(events.map(e => 
        e.id === eventId 
          ? { ...e, isAttending: false, attendeeCount: Math.max((e.attendeeCount || 1) - 1, 0) }
          : e
      ));
      Alert.alert('Başarılı', 'Etkinlikten ayrıldınız');
    } catch (error: any) {
      Alert.alert('Hata', error?.response?.data?.detail || 'İşlem başarısız');
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];

    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null);
    }

    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  };

  const hasEventOnDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return events.some(e => e.date === dateStr);
  };

  const getEventsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return events.filter(e => e.date === dateStr);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getDate()} ${MONTHS_TR[date.getMonth()]}`;
  };

  const renderCalendar = () => {
    const days = getDaysInMonth(currentMonth);

    return (
      <View style={styles.calendar}>
        <View style={styles.calendarHeader}>
          <TouchableOpacity onPress={() => {
            const newDate = new Date(currentMonth);
            newDate.setMonth(newDate.getMonth() - 1);
            setCurrentMonth(newDate);
          }}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.monthTitle}>
            {MONTHS_TR[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </Text>
          <TouchableOpacity onPress={() => {
            const newDate = new Date(currentMonth);
            newDate.setMonth(newDate.getMonth() + 1);
            setCurrentMonth(newDate);
          }}>
            <Ionicons name="chevron-forward" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.dayNames}>
          {DAYS_TR.map(day => (
            <Text key={day} style={styles.dayName}>{day}</Text>
          ))}
        </View>

        <View style={styles.daysGrid}>
          {days.map((day, index) => {
            if (!day) {
              return <View key={`empty-${index}`} style={styles.dayCell} />;
            }

            const isToday = day.toDateString() === new Date().toDateString();
            const isSelected = day.toDateString() === selectedDate.toDateString();
            const hasEvent = hasEventOnDate(day);

            return (
              <TouchableOpacity
                key={day.toISOString()}
                style={[
                  styles.dayCell,
                  isSelected && styles.dayCellSelected,
                  isToday && !isSelected && styles.dayCellToday,
                ]}
                onPress={() => setSelectedDate(day)}
              >
                <Text style={[
                  styles.dayText,
                  isSelected && styles.dayTextSelected,
                  isToday && !isSelected && styles.dayTextToday,
                ]}>
                  {day.getDate()}
                </Text>
                {hasEvent && <View style={[styles.eventDot, isSelected && styles.eventDotSelected]} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  const renderEventCard = (item: Event) => {
    const attendeeCount = item.attendeeCount || item.attendees?.length || 0;

    return (
      <View key={item.id} style={styles.eventCard}>
        <View style={styles.eventHeader}>
          <View style={styles.eventDateBadge}>
            <Text style={styles.eventDateDay}>
              {new Date(item.date).getDate()}
            </Text>
            <Text style={styles.eventDateMonth}>
              {MONTHS_TR[new Date(item.date).getMonth()].substring(0, 3)}
            </Text>
          </View>
          <View style={styles.eventInfo}>
            <Text style={styles.eventTitle}>{item.title}</Text>
            {item.communityName && (
              <Text style={styles.eventCommunity}>{item.communityName}</Text>
            )}
          </View>
          {item.isOnline && (
            <View style={styles.onlineBadge}>
              <Ionicons name="videocam" size={14} color="#10b981" />
              <Text style={styles.onlineText}>Online</Text>
            </View>
          )}
        </View>

        {item.description && (
          <Text style={styles.eventDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}

        <View style={styles.eventMeta}>
          <View style={styles.eventMetaItem}>
            <Ionicons name="time-outline" size={16} color="#6b7280" />
            <Text style={styles.eventMetaText}>{item.time}</Text>
          </View>
          <View style={styles.eventMetaItem}>
            <Ionicons name="location-outline" size={16} color="#6b7280" />
            <Text style={styles.eventMetaText}>{item.location}</Text>
          </View>
          <View style={styles.eventMetaItem}>
            <Ionicons name="people-outline" size={16} color="#6b7280" />
            <Text style={styles.eventMetaText}>
              {attendeeCount}{item.maxAttendees ? `/${item.maxAttendees}` : ''} katılımcı
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.joinButton,
            item.isAttending && styles.joinedButton,
            item.isFull && !item.isAttending && styles.fullButton,
          ]}
          onPress={() => item.isAttending ? handleLeaveEvent(item.id) : handleJoinEvent(item.id)}
          disabled={item.isFull && !item.isAttending}
        >
          <Text style={[styles.joinButtonText, item.isAttending && styles.joinedButtonText]}>
            {item.isAttending ? 'Katıldın ✓' : item.isFull ? 'Dolu' : 'Katıl'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const selectedDateEvents = getEventsForDate(selectedDate);
  const upcomingEvents = events
    .filter(e => new Date(e.date) >= new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const myEvents = events.filter(e => e.isAttending || e.isCreator);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Etkinlikler</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'calendar' && styles.tabActive]}
          onPress={() => setActiveTab('calendar')}
        >
          <Ionicons name="calendar" size={18} color={activeTab === 'calendar' ? '#6366f1' : '#6b7280'} />
          <Text style={[styles.tabText, activeTab === 'calendar' && styles.tabTextActive]}>Takvim</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'upcoming' && styles.tabActive]}
          onPress={() => setActiveTab('upcoming')}
        >
          <Ionicons name="time" size={18} color={activeTab === 'upcoming' ? '#6366f1' : '#6b7280'} />
          <Text style={[styles.tabText, activeTab === 'upcoming' && styles.tabTextActive]}>Yaklaşan</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'my' && styles.tabActive]}
          onPress={() => setActiveTab('my')}
        >
          <Ionicons name="person" size={18} color={activeTab === 'my' ? '#6366f1' : '#6b7280'} />
          <Text style={[styles.tabText, activeTab === 'my' && styles.tabTextActive]}>Katıldıklarım</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />
        }
      >
        {activeTab === 'calendar' && (
          <>
            {renderCalendar()}
            
            <View style={styles.eventsSection}>
              <Text style={styles.sectionTitle}>
                {selectedDate.toDateString() === new Date().toDateString() 
                  ? 'Bugün' 
                  : formatDate(selectedDate.toISOString())}
              </Text>

              {selectedDateEvents.length > 0 ? (
                selectedDateEvents.map(event => renderEventCard(event))
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons name="calendar-outline" size={40} color="#374151" />
                  <Text style={styles.emptyText}>Bu tarihte etkinlik yok</Text>
                </View>
              )}
            </View>
          </>
        )}

        {activeTab === 'upcoming' && (
          <View style={styles.eventsSection}>
            <Text style={styles.sectionTitle}>Yaklaşan Etkinlikler</Text>
            {upcomingEvents.length > 0 ? (
              upcomingEvents.map(event => renderEventCard(event))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="calendar-outline" size={48} color="#374151" />
                <Text style={styles.emptyText}>Yaklaşan etkinlik yok</Text>
              </View>
            )}
          </View>
        )}

        {activeTab === 'my' && (
          <View style={styles.eventsSection}>
            <Text style={styles.sectionTitle}>Katıldığım Etkinlikler</Text>
            {myEvents.length > 0 ? (
              myEvents.map(event => renderEventCard(event))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="calendar-outline" size={48} color="#374151" />
                <Text style={styles.emptyText}>Henüz etkinliğe katılmadınız</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Create Event Modal */}
      <Modal visible={showCreateModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Yeni Etkinlik</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <TextInput
                style={styles.input}
                placeholder="Etkinlik Başlığı"
                placeholderTextColor="#6b7280"
                value={newEvent.title}
                onChangeText={(text) => setNewEvent({ ...newEvent, title: text })}
              />

              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Açıklama"
                placeholderTextColor="#6b7280"
                value={newEvent.description}
                onChangeText={(text) => setNewEvent({ ...newEvent, description: text })}
                multiline
                numberOfLines={3}
              />

              <TextInput
                style={styles.input}
                placeholder="Tarih (YYYY-MM-DD)"
                placeholderTextColor="#6b7280"
                value={newEvent.date}
                onChangeText={(text) => setNewEvent({ ...newEvent, date: text })}
              />

              <TextInput
                style={styles.input}
                placeholder="Saat (HH:MM)"
                placeholderTextColor="#6b7280"
                value={newEvent.time}
                onChangeText={(text) => setNewEvent({ ...newEvent, time: text })}
              />

              <TextInput
                style={styles.input}
                placeholder="Konum"
                placeholderTextColor="#6b7280"
                value={newEvent.location}
                onChangeText={(text) => setNewEvent({ ...newEvent, location: text })}
              />

              <TouchableOpacity
                style={styles.onlineToggle}
                onPress={() => setNewEvent({ ...newEvent, isOnline: !newEvent.isOnline })}
              >
                <Ionicons 
                  name={newEvent.isOnline ? 'checkbox' : 'square-outline'} 
                  size={24} 
                  color={newEvent.isOnline ? '#6366f1' : '#6b7280'} 
                />
                <Text style={styles.onlineToggleText}>Online Etkinlik</Text>
              </TouchableOpacity>

              {newEvent.isOnline && (
                <TextInput
                  style={styles.input}
                  placeholder="Toplantı Linki"
                  placeholderTextColor="#6b7280"
                  value={newEvent.meetingLink}
                  onChangeText={(text) => setNewEvent({ ...newEvent, meetingLink: text })}
                />
              )}

              <TextInput
                style={styles.input}
                placeholder="Maksimum Katılımcı (Opsiyonel)"
                placeholderTextColor="#6b7280"
                value={newEvent.maxAttendees}
                onChangeText={(text) => setNewEvent({ ...newEvent, maxAttendees: text })}
                keyboardType="numeric"
              />

              <TouchableOpacity
                style={[styles.createButton, creating && styles.disabledButton]}
                onPress={handleCreateEvent}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.createButtonText}>Etkinlik Oluştur</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  loadingContainer: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1f2937' },
  backButton: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#fff' },
  addButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', backgroundColor: '#6366f1', borderRadius: 20 },
  tabs: { flexDirection: 'row', marginHorizontal: 16, marginTop: 12, backgroundColor: '#111827', borderRadius: 12, padding: 4 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, gap: 6 },
  tabActive: { backgroundColor: '#1f2937' },
  tabText: { color: '#6b7280', fontSize: 13, fontWeight: '500' },
  tabTextActive: { color: '#fff' },
  content: { flex: 1 },
  calendar: { backgroundColor: '#111827', margin: 16, borderRadius: 16, padding: 16 },
  calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  monthTitle: { fontSize: 18, fontWeight: '600', color: '#fff' },
  dayNames: { flexDirection: 'row', marginBottom: 8 },
  dayName: { flex: 1, textAlign: 'center', color: '#6b7280', fontSize: 12, fontWeight: '600' },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.28%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  dayCellSelected: { backgroundColor: '#6366f1', borderRadius: 20 },
  dayCellToday: { borderWidth: 1, borderColor: '#6366f1', borderRadius: 20 },
  dayText: { color: '#fff', fontSize: 14 },
  dayTextSelected: { fontWeight: '600' },
  dayTextToday: { color: '#6366f1' },
  eventDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#f59e0b', position: 'absolute', bottom: 4 },
  eventDotSelected: { backgroundColor: '#fff' },
  eventsSection: { paddingHorizontal: 16, marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 16 },
  eventCard: { backgroundColor: '#111827', borderRadius: 16, padding: 16, marginBottom: 12 },
  eventHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  eventDateBadge: { backgroundColor: '#6366f1', borderRadius: 12, padding: 8, alignItems: 'center', marginRight: 12 },
  eventDateDay: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  eventDateMonth: { color: 'rgba(255,255,255,0.8)', fontSize: 12, textTransform: 'uppercase' },
  eventInfo: { flex: 1 },
  eventTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  eventCommunity: { color: '#9ca3af', fontSize: 13, marginTop: 4 },
  onlineBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16, 185, 129, 0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, gap: 4 },
  onlineText: { color: '#10b981', fontSize: 12, fontWeight: '500' },
  eventDescription: { color: '#9ca3af', fontSize: 14, marginBottom: 12, lineHeight: 20 },
  eventMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  eventMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  eventMetaText: { color: '#6b7280', fontSize: 13 },
  joinButton: { backgroundColor: '#6366f1', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  joinedButton: { backgroundColor: '#1f2937', borderWidth: 1, borderColor: '#10b981' },
  fullButton: { backgroundColor: '#374151' },
  joinButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  joinedButtonText: { color: '#10b981' },
  emptyState: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { color: '#6b7280', marginTop: 12, fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1f2937', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#374151' },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: '600' },
  modalBody: { padding: 20 },
  input: { backgroundColor: '#374151', borderRadius: 12, padding: 14, color: '#fff', fontSize: 16, marginBottom: 12 },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  onlineToggle: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12, paddingVertical: 8 },
  onlineToggleText: { color: '#fff', fontSize: 16 },
  createButton: { backgroundColor: '#6366f1', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 8, marginBottom: 20 },
  disabledButton: { opacity: 0.6 },
  createButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
