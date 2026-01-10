import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../src/services/api';
import { useAuth } from '../../src/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';

interface Chat {
  chatId: string;
  userId: string;
  userName: string;
  userProfileImage?: string;
  lastMessage: string;
  lastMessageTime: string;
  lastMessageType: string;
  unreadCount: number;
  isOnline: boolean;
}

interface GroupChat {
  id: string;
  name: string;
  communityName?: string;
  memberCount: number;
  lastMessage?: string;
  lastMessageTime?: string;
  isMember: boolean;
}

export default function MessagesScreen() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [groupChats, setGroupChats] = useState<GroupChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'private' | 'groups'>('private');
  const { userProfile } = useAuth();
  const router = useRouter();

  const loadChats = useCallback(async () => {
    try {
      const [chatsRes, communitiesRes] = await Promise.all([
        api.get('/chats'),
        api.get('/communities'),
      ]);
      
      setChats(chatsRes.data);
      
      // Get all subgroups user is member of
      const myGroups: GroupChat[] = [];
      for (const community of communitiesRes.data) {
        if (community.isMember) {
          try {
            const communityDetails = await api.get(`/communities/${community.id}`);
            const subgroups = communityDetails.data.subGroupsList || [];
            for (const sg of subgroups) {
              if (sg.isMember) {
                myGroups.push({
                  id: sg.id,
                  name: sg.name,
                  communityName: community.name,
                  memberCount: sg.memberCount,
                  isMember: true,
                });
              }
            }
          } catch (e) {
            console.error('Error loading community details:', e);
          }
        }
      }
      setGroupChats(myGroups);
    } catch (error) {
      console.error('Error loading chats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadChats();
  }, [loadChats]);

  const formatTime = (timestamp: string) => {
    if (!timestamp) return '';
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true, locale: tr });
    } catch {
      return '';
    }
  };

  const renderChat = ({ item }: { item: Chat }) => (
    <TouchableOpacity
      style={styles.chatCard}
      onPress={() => router.push(`/chat/${item.userId}`)}
    >
      <View style={styles.avatarContainer}>
        <View style={styles.avatar}>
          {item.userProfileImage ? (
            <Image source={{ uri: item.userProfileImage }} style={styles.avatarImage} />
          ) : (
            <Ionicons name="person" size={24} color="#9ca3af" />
          )}
        </View>
        {item.isOnline && <View style={styles.onlineIndicator} />}
      </View>
      
      <View style={styles.chatInfo}>
        <View style={styles.chatHeader}>
          <Text style={styles.chatName}>{item.userName}</Text>
          <Text style={styles.chatTime}>{formatTime(item.lastMessageTime)}</Text>
        </View>
        <View style={styles.chatPreview}>
          <Text style={styles.lastMessage} numberOfLines={1}>
            {item.lastMessageType === 'image' ? '📷 Fotoğraf' : item.lastMessage}
          </Text>
          {item.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadCount}>
                {item.unreadCount > 99 ? '99+' : item.unreadCount}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderGroupChat = ({ item }: { item: GroupChat }) => (
    <TouchableOpacity
      style={styles.chatCard}
      onPress={() => router.push(`/chat/group/${item.id}`)}
    >
      <View style={styles.groupIcon}>
        <Ionicons name="people" size={24} color="#6366f1" />
      </View>
      
      <View style={styles.chatInfo}>
        <View style={styles.chatHeader}>
          <Text style={styles.chatName}>{item.name}</Text>
        </View>
        <Text style={styles.groupSubtitle}>
          {item.memberCount} üye
        </Text>
      </View>
      
      <Ionicons name="chevron-forward" size={20} color="#6b7280" />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mesajlar</Text>
        <TouchableOpacity 
          style={styles.newChatButton}
          onPress={() => router.push('/chat/new')}
        >
          <Ionicons name="create-outline" size={24} color="#6366f1" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'private' && styles.activeTab]}
          onPress={() => setActiveTab('private')}
        >
          <Ionicons 
            name="chatbubble" 
            size={20} 
            color={activeTab === 'private' ? '#6366f1' : '#6b7280'} 
          />
          <Text style={[styles.tabText, activeTab === 'private' && styles.activeTabText]}>
            Özel
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'groups' && styles.activeTab]}
          onPress={() => setActiveTab('groups')}
        >
          <Ionicons 
            name="people" 
            size={20} 
            color={activeTab === 'groups' ? '#6366f1' : '#6b7280'} 
          />
          <Text style={[styles.tabText, activeTab === 'groups' && styles.activeTabText]}>
            Gruplar
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'private' ? (
        <FlatList
          data={chats}
          renderItem={renderChat}
          keyExtractor={(item) => item.chatId}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="chatbubbles-outline" size={64} color="#374151" />
              <Text style={styles.emptyText}>Henüz mesaj yok</Text>
              <Text style={styles.emptySubtext}>
                Yeni bir sohbet başlatmak için sağ üstteki butona tıklayın
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={groupChats}
          renderItem={renderGroupChat}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={64} color="#374151" />
              <Text style={styles.emptyText}>Henüz grup yok</Text>
              <Text style={styles.emptySubtext}>
                Topluluklar sekmesinden gruplara katılabilirsiniz
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  newChatButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#111827',
    gap: 8,
  },
  activeTab: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  tabText: {
    color: '#6b7280',
    fontSize: 15,
    fontWeight: '500',
  },
  activeTabText: {
    color: '#6366f1',
  },
  listContent: {
    paddingVertical: 8,
    flexGrow: 1,
  },
  chatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#1f2937',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: '#0a0a0a',
  },
  groupIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatInfo: {
    flex: 1,
    marginLeft: 12,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chatName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  chatTime: {
    color: '#6b7280',
    fontSize: 12,
  },
  chatPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  lastMessage: {
    color: '#9ca3af',
    fontSize: 14,
    flex: 1,
  },
  groupSubtitle: {
    color: '#6b7280',
    fontSize: 13,
    marginTop: 4,
  },
  unreadBadge: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  unreadCount: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    color: '#6b7280',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});
