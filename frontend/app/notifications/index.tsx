import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import api from '../../src/services/api';

interface Notification {
  id: string;
  type: 'message' | 'like' | 'comment' | 'follow' | 'community' | 'announcement';
  title: string;
  body: string;
  isRead: boolean;
  timestamp: string;
  data?: any;
}

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const loadNotifications = useCallback(async () => {
    try {
      const response = await api.get('/api/notifications');
      setNotifications(response.data);
    } catch (error) {
      console.error('Error loading notifications:', error);
      // Demo data for now
      setNotifications([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadNotifications();
  }, [loadNotifications]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'message': return { name: 'chatbubble', color: '#6366f1' };
      case 'like': return { name: 'heart', color: '#ef4444' };
      case 'comment': return { name: 'chatbubble-ellipses', color: '#3b82f6' };
      case 'follow': return { name: 'person-add', color: '#10b981' };
      case 'community': return { name: 'people', color: '#f59e0b' };
      case 'announcement': return { name: 'megaphone', color: '#8b5cf6' };
      default: return { name: 'notifications', color: '#6b7280' };
    }
  };

  const handlePress = async (notification: Notification) => {
    // Mark as read
    try {
      await api.put(`/api/notifications/${notification.id}/read`);
      setNotifications(notifications.map(n => 
        n.id === notification.id ? { ...n, isRead: true } : n
      ));
    } catch (e) {}

    // Navigate based on type
    switch (notification.type) {
      case 'message':
        if (notification.data?.chatId) router.push(`/chat/${notification.data.chatId}`);
        break;
      case 'community':
        if (notification.data?.communityId) router.push(`/community/${notification.data.communityId}`);
        break;
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.put('/api/notifications/read-all');
      setNotifications(notifications.map(n => ({ ...n, isRead: true })));
    } catch (e) {}
  };

  const formatTime = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true, locale: tr });
    } catch { return ''; }
  };

  const renderNotification = ({ item }: { item: Notification }) => {
    const icon = getIcon(item.type);
    return (
      <TouchableOpacity 
        style={[styles.notificationCard, !item.isRead && styles.unreadCard]}
        onPress={() => handlePress(item)}
      >
        <View style={[styles.iconContainer, { backgroundColor: `${icon.color}20` }]}>
          <Ionicons name={icon.name as any} size={22} color={icon.color} />
        </View>
        <View style={styles.content}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.body} numberOfLines={2}>{item.body}</Text>
          <Text style={styles.time}>{formatTime(item.timestamp)}</Text>
        </View>
        {!item.isRead && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#6366f1" /></View>;
  }

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bildirimler</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllAsRead}>
            <Text style={styles.markAllText}>Tümünü Okundu İşaretle</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="notifications-outline" size={64} color="#6366f1" />
            </View>
            <Text style={styles.emptyText}>Bildiriminiz yok</Text>
            <Text style={styles.emptySubtext}>Yeni bildirimler burada görünecek</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  loadingContainer: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1f2937' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '600', flex: 1, marginLeft: 16 },
  markAllText: { color: '#6366f1', fontSize: 13 },
  list: { paddingVertical: 8 },
  notificationCard: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1f2937' },
  unreadCard: { backgroundColor: 'rgba(99, 102, 241, 0.05)' },
  iconContainer: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1, marginLeft: 14 },
  title: { color: '#fff', fontSize: 15, fontWeight: '600' },
  body: { color: '#9ca3af', fontSize: 13, marginTop: 2 },
  time: { color: '#6b7280', fontSize: 12, marginTop: 4 },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#6366f1' },
  emptyState: { alignItems: 'center', paddingVertical: 80 },
  emptyIconContainer: { width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(99, 102, 241, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  emptySubtext: { color: '#6b7280', fontSize: 14, marginTop: 8 },
});
