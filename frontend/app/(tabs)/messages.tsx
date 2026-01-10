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
import { collection, query, where, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import { useAuth } from '../../src/contexts/AuthContext';
import api from '../../src/services/api';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';

interface Chat {
  chatId: string;
  odierUserId: string;
  otherUserName: string;
  otherUserImage?: string;
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
  isTyping?: boolean;
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
  const [userCache, setUserCache] = useState<Record<string, any>>({});
  const { userProfile, user } = useAuth();
  const router = useRouter();

  // Firebase'den DM sohbetlerini dinle
  useEffect(() => {
    if (!user?.uid) return;

    const conversationsRef = collection(db, 'conversations');
    const q = query(
      conversationsRef,
      where('participantIds', 'array-contains', user.uid),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const chatList: Chat[] = [];
      
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        if (data.type !== 'dm') continue;
        
        const otherUserId = data.participantIds?.find((id: string) => id !== user.uid);
        if (!otherUserId) continue;

        // Kullanıcı bilgilerini al (cache'den veya API'den)
        let otherUser = userCache[otherUserId];
        if (!otherUser) {
          try {
            const userRes = await api.get(`/users/${otherUserId}`);
            otherUser = userRes.data;
            setUserCache(prev => ({ ...prev, [otherUserId]: otherUser }));
          } catch (e) {
            otherUser = { firstName: 'Kullanıcı', lastName: '' };
          }
        }

        // Son mesajı al
        const messagesRef = collection(db, 'conversations', docSnap.id, 'messages');
        const messagesQuery = query(messagesRef, orderBy('createdAt', 'desc'));
        const messagesSnap = await getDocs(messagesQuery);
        
        let lastMessage = '';
        let lastMessageTime = data.updatedAt?.toDate() || new Date();
        let unreadCount = 0;
        
        messagesSnap.forEach((msgDoc, index) => {
          const msgData = msgDoc.data();
          if (index === 0) {
            lastMessage = msgData.text || '';
            lastMessageTime = msgData.createdAt?.toDate() || new Date();
          }
          // Okunmamış mesajları say
          if (msgData.senderId !== user.uid && !msgData.readBy?.includes(user.uid)) {
            unreadCount++;
          }
        });

        chatList.push({
          chatId: docSnap.id,
          odierUserId: otherUserId,
          otherUserName: `${otherUser.firstName || ''} ${otherUser.lastName || ''}`.trim() || 'Kullanıcı',
          otherUserImage: otherUser.profileImageUrl,
          lastMessage,
          lastMessageTime,
          unreadCount,
          isTyping: data.typing?.[otherUserId] || false,
        });
      }

      setChats(chatList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  const loadGroupChats = useCallback(async () => {
    try {
      const communitiesRes = await api.get('/communities');
      
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
                  name: sg.name.replace(`${community.name} - `, ''),
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
      console.error('Error loading groups:', error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadGroupChats();
  }, [loadGroupChats]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadGroupChats();
  }, [loadGroupChats]);

  const formatTime = (date: Date) => {
    if (!date) return '';
    try {
      return formatDistanceToNow(date, { addSuffix: true, locale: tr });
    } catch {
      return '';
    }
  };

  const renderChat = ({ item }: { item: Chat }) => (
    <TouchableOpacity
      style={styles.chatCard}
      onPress={() => router.push(`/chat/${item.odierUserId}`)}
    >
      <View style={styles.avatarContainer}>
        <View style={styles.avatar}>
          {item.otherUserImage ? (
            <Image source={{ uri: item.otherUserImage }} style={styles.avatarImage} />
          ) : (
            <Ionicons name="person" size={24} color="#9ca3af" />
          )}
        </View>
      </View>
      
      <View style={styles.chatInfo}>
        <View style={styles.chatHeader}>
          <Text style={styles.chatName}>{item.otherUserName}</Text>
          <Text style={styles.chatTime}>{formatTime(item.lastMessageTime)}</Text>
        </View>
        <View style={styles.chatPreview}>
          {item.isTyping ? (
            <View style={styles.typingContainer}>
              <Text style={styles.typingText}>yazıyor</Text>
              <View style={styles.typingDots}>
                <View style={[styles.typingDot, styles.dot1]} />
                <View style={[styles.typingDot, styles.dot2]} />
                <View style={[styles.typingDot, styles.dot3]} />
              </View>
            </View>
          ) : (
            <Text style={styles.lastMessage} numberOfLines={1}>
              {item.lastMessage || 'Henüz mesaj yok'}
            </Text>
          )}
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
          {item.communityName} • {item.memberCount} üye
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
            Özel Mesajlar
          </Text>
          {chats.filter(c => c.unreadCount > 0).length > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>
                {chats.reduce((acc, c) => acc + c.unreadCount, 0)}
              </Text>
            </View>
          )}
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
              <View style={styles.emptyIconContainer}>
                <Ionicons name="chatbubbles-outline" size={64} color="#6366f1" />
              </View>
              <Text style={styles.emptyText}>Henüz mesaj yok</Text>
              <Text style={styles.emptySubtext}>
                Yeni bir sohbet başlatmak için sağ üstteki butona tıklayın
              </Text>
              <TouchableOpacity 
                style={styles.emptyButton}
                onPress={() => router.push('/chat/new')}
              >
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={styles.emptyButtonText}>Yeni Sohbet</Text>
              </TouchableOpacity>
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
              <View style={styles.emptyIconContainer}>
                <Ionicons name="people-outline" size={64} color="#6366f1" />
              </View>
              <Text style={styles.emptyText}>Henüz grup yok</Text>
              <Text style={styles.emptySubtext}>
                Topluluklar sekmesinden gruplara katılabilirsiniz
              </Text>
              <TouchableOpacity 
                style={styles.emptyButton}
                onPress={() => router.push('/(tabs)/communities')}
              >
                <Ionicons name="compass" size={20} color="#fff" />
                <Text style={styles.emptyButtonText}>Toplulukları Keşfet</Text>
              </TouchableOpacity>
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
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  newChatButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  tabText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '500',
  },
  activeTabText: {
    color: '#6366f1',
  },
  tabBadge: {
    backgroundColor: '#ef4444',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  tabBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  listContent: {
    paddingVertical: 8,
    flexGrow: 1,
  },
  chatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1f2937',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  groupIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatInfo: {
    flex: 1,
    marginLeft: 14,
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
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typingText: {
    color: '#6366f1',
    fontSize: 14,
    fontStyle: 'italic',
  },
  typingDots: {
    flexDirection: 'row',
    marginLeft: 4,
  },
  typingDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#6366f1',
    marginHorizontal: 1,
  },
  dot1: {
    opacity: 0.4,
  },
  dot2: {
    opacity: 0.7,
  },
  dot3: {
    opacity: 1,
  },
  unreadBadge: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginLeft: 8,
  },
  unreadCount: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  emptySubtext: {
    color: '#6b7280',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366f1',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 24,
    gap: 8,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
