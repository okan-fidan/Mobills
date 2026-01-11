import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import api from '../src/services/api';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data?: any;
  isRead: boolean;
  timestamp: string;
}

const NOTIFICATION_ICONS: { [key: string]: { icon: string; color: string } } = {
  message: { icon: 'chatbubble', color: '#6366f1' },
  group_message: { icon: 'chatbubbles', color: '#8b5cf6' },
  mention: { icon: 'at', color: '#f59e0b' },
  event: { icon: 'calendar', color: '#10b981' },
  event_join: { icon: 'person-add', color: '#10b981' },
  event_cancelled: { icon: 'calendar-outline', color: '#ef4444' },
  badge_earned: { icon: 'ribbon', color: '#f59e0b' },
  new_review: { icon: 'star', color: '#f59e0b' },
  '2fa_code': { icon: 'shield-checkmark', color: '#10b981' },
  '2fa_login_code': { icon: 'key', color: '#6366f1' },
  announcement: { icon: 'megaphone', color: '#ec4899' },
  community_invite: { icon: 'people', color: '#8b5cf6' },
  default: { icon: 'notifications', color: '#6b7280' },
};

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const response = await api.get('/notifications');
      setNotifications(response.data.notifications || []);
      setUnreadCount(response.data.unreadCount || 0);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadNotifications();
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await api.post(`/notifications/mark-read/${notificationId}`);
      setNotifications(notifications.map(n => 
        n.id === notificationId ? { ...n, isRead: true } : n
      ));
      setUnreadCount(Math.max(0, unreadCount - 1));
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.post('/notifications/mark-all-read');
      setNotifications(notifications.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
      Alert.alert('Başarılı', 'Tüm bildirimler okundu işaretlendi');
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const handleClearAll = () => {
    Alert.alert(
      'Tüm Bildirimleri Sil',
      'Tüm bildirimleri silmek istediğinize emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete('/notifications');
              setNotifications([]);
              setUnreadCount(0);
            } catch (error) {
              console.error('Error clearing notifications:', error);
            }
          },
        },
      ]
    );
  };

  const handleNotificationPress = async (notification: Notification) => {
    // Okundu işaretle
    if (!notification.isRead) {
      await handleMarkAsRead(notification.id);
    }

    // İlgili sayfaya yönlendir
    const data = notification.data || {};
    switch (notification.type) {
      case 'message':
        if (data.chatId) router.push(`/chat/${data.chatId}`);
        break;
      case 'group_message':
        if (data.groupId) router.push(`/chat/group/${data.groupId}`);
        break;
      case 'event':
      case 'event_join':
      case 'event_cancelled':
        router.push('/events');
        break;
      case 'badge_earned':
        router.push('/badges');
        break;
      case 'new_review':
        if (data.serviceId) router.push(`/service/${data.serviceId}`);
        break;
      case 'community_invite':
        if (data.communityId) router.push(`/community/${data.communityId}`);
        break;
      default:
        // Genel bildirimler için bir şey yapma
        break;
    }
  };

  const getNotificationIcon = (type: string) => {
    const config = NOTIFICATION_ICONS[type] || NOTIFICATION_ICONS.default;
    return config;
  };

  const renderNotification = ({ item }: { item: Notification }) => {
    const iconConfig = getNotificationIcon(item.type);
    
    return (
      <TouchableOpacity 
        style={[styles.notificationItem, !item.isRead && styles.unreadItem]}
        onPress={() => handleNotificationPress(item)}
      >
        <View style={[styles.iconContainer, { backgroundColor: iconConfig.color + '20' }]}>
          <Ionicons name={iconConfig.icon as any} size={22} color={iconConfig.color} />
        </View>
        <View style={styles.notificationContent}>
          <Text style={styles.notificationTitle}>{item.title}</Text>
          <Text style={styles.notificationMessage} numberOfLines={2}>{item.message}</Text>
          <Text style={styles.notificationTime}>
            {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true, locale: tr })}
          </Text>
        </View>
        {!item.isRead && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

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
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Bildirimler</Text>
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={handleMarkAllAsRead} style={styles.headerAction}>
          <Ionicons name="checkmark-done" size={24} color="#6366f1" />
        </TouchableOpacity>
      </View>

      {/* Actions */}
      {notifications.length > 0 && (
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionButton} onPress={handleMarkAllAsRead}>
            <Ionicons name="checkmark-done-outline" size={18} color="#6366f1" />
            <Text style={styles.actionText}>Tümünü Okundu İşaretle</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={handleClearAll}>
            <Ionicons name="trash-outline" size={18} color="#ef4444" />
            <Text style={[styles.actionText, { color: '#ef4444' }]}>Tümünü Sil</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Notifications List */}
      <FlatList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={64} color="#374151" />
            <Text style={styles.emptyTitle}>Bildirim Yok</Text>
            <Text style={styles.emptyText}>Yeni bildirimler burada görünecek</Text>
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
  backButton: { width: 40, height: 40, justifyContent: 'center' },
  headerTitleContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#fff' },
  unreadBadge: { backgroundColor: '#ef4444', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  unreadBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  headerAction: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1f2937' },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { color: '#6366f1', fontSize: 13, fontWeight: '500' },
  listContent: { padding: 16 },
  notificationItem: { flexDirection: 'row', backgroundColor: '#111827', borderRadius: 12, padding: 14, marginBottom: 10, alignItems: 'flex-start' },
  unreadItem: { backgroundColor: 'rgba(99, 102, 241, 0.1)', borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.3)' },
  iconContainer: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  notificationContent: { flex: 1 },
  notificationTitle: { color: '#fff', fontSize: 15, fontWeight: '600', marginBottom: 4 },
  notificationMessage: { color: '#9ca3af', fontSize: 14, lineHeight: 20, marginBottom: 6 },
  notificationTime: { color: '#6b7280', fontSize: 12 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#6366f1', marginLeft: 8, marginTop: 4 },
  emptyState: { alignItems: 'center', paddingVertical: 64 },
  emptyTitle: { color: '#9ca3af', fontSize: 18, fontWeight: '500', marginTop: 16 },
  emptyText: { color: '#6b7280', fontSize: 14, marginTop: 8 },
});
