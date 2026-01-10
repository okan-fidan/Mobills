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
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, query, where, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import { useAuth } from '../../src/contexts/AuthContext';
import api from '../../src/services/api';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';

type TabType = 'all' | 'communities' | 'groups' | 'private';

interface Chat {
  chatId: string;
  odierUserId: string;
  otherUserName: string;
  otherUserImage?: string;
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
  isTyping?: boolean;
  source?: 'dm' | 'service';
}

interface Community {
  id: string;
  name: string;
  city: string;
  memberCount: number;
  imageUrl?: string;
  isMember: boolean;
  lastActivity?: string;
}

interface GroupChat {
  id: string;
  name: string;
  communityId: string;
  communityName: string;
  memberCount: number;
  lastMessage?: string;
  lastMessageTime?: string;
  isMember: boolean;
}

export default function MessagesScreen() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [groupChats, setGroupChats] = useState<GroupChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('all');
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

        const messagesRef = collection(db, 'conversations', docSnap.id, 'messages');
        const messagesQuery = query(messagesRef, orderBy('createdAt', 'desc'));
        const messagesSnap = await getDocs(messagesQuery);
        
        let lastMessage = '';
        let lastMessageTime = data.updatedAt?.toDate() || new Date();
        let unreadCount = 0;
        
        messagesSnap.forEach((msgDoc, index) => {
          const msgData = msgDoc.data();
          if (index === 0) {
            lastMessage = msgData.text || (msgData.mediaUrl ? '📎 Ek' : '');
            lastMessageTime = msgData.createdAt?.toDate() || new Date();
          }
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
          source: data.source || 'dm',
        });
      }

      setChats(chatList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  const loadData = useCallback(async () => {
    try {
      const communitiesRes = await api.get('/communities');
      
      // Üye olunan topluluklar
      const myCommunities: Community[] = communitiesRes.data
        .filter((c: any) => c.isMember)
        .map((c: any) => ({
          id: c.id,
          name: c.name,
          city: c.city,
          memberCount: c.memberCount,
          imageUrl: c.imageUrl,
          isMember: true,
        }));
      setCommunities(myCommunities);

      // Gruplar
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
                  communityId: community.id,
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
      console.error('Error loading data:', error);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const formatTime = (date: Date) => {
    if (!date) return '';
    try {
      return formatDistanceToNow(date, { addSuffix: true, locale: tr });
    } catch {
      return '';
    }
  };

  const tabs: { key: TabType; label: string; icon: string; gradient: string[] }[] = [
    { key: 'all', label: 'Tümü', icon: 'layers', gradient: ['#6366f1', '#8b5cf6'] },
    { key: 'communities', label: 'Topluluklarım', icon: 'globe', gradient: ['#f59e0b', '#f97316'] },
    { key: 'groups', label: 'Gruplarım', icon: 'people', gradient: ['#10b981', '#14b8a6'] },
    { key: 'private', label: 'Özel Mesajlar', icon: 'chatbubble', gradient: ['#3b82f6', '#6366f1'] },
  ];

  const renderTabBar = () => (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false} 
      style={styles.tabsContainer}
      contentContainerStyle={styles.tabsContent}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        const count = tab.key === 'private' 
          ? chats.reduce((acc, c) => acc + c.unreadCount, 0)
          : tab.key === 'communities' 
            ? communities.length 
            : tab.key === 'groups' 
              ? groupChats.length 
              : chats.length + groupChats.length;

        return (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            style={styles.tabWrapper}
          >
            {isActive ? (
              <LinearGradient
                colors={tab.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.tabActive}
              >
                <Ionicons name={tab.icon as any} size={18} color="#fff" />
                <Text style={styles.tabTextActive}>{tab.label}</Text>
                {count > 0 && (
                  <View style={styles.tabBadgeActive}>
                    <Text style={styles.tabBadgeTextActive}>{count}</Text>
                  </View>
                )}
              </LinearGradient>
            ) : (
              <View style={styles.tab}>
                <Ionicons name={tab.icon as any} size={18} color="#6b7280" />
                <Text style={styles.tabText}>{tab.label}</Text>
                {count > 0 && tab.key === 'private' && (
                  <View style={styles.tabBadge}>
                    <Text style={styles.tabBadgeText}>{count}</Text>
                  </View>
                )}
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

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
        {item.source === 'service' && (
          <View style={styles.serviceBadge}>
            <Ionicons name="briefcase" size={10} color="#fff" />
          </View>
        )}
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

  const renderCommunity = ({ item }: { item: Community }) => (
    <TouchableOpacity
      style={styles.communityCard}
      onPress={() => router.push(`/community/${item.id}`)}
    >
      <LinearGradient
        colors={['#f59e0b', '#f97316']}
        style={styles.communityIcon}
      >
        <Ionicons name="globe" size={24} color="#fff" />
      </LinearGradient>
      
      <View style={styles.chatInfo}>
        <Text style={styles.chatName}>{item.name}</Text>
        <View style={styles.communityMeta}>
          <Ionicons name="location" size={14} color="#6b7280" />
          <Text style={styles.communityMetaText}>{item.city}</Text>
          <Text style={styles.communityMetaText}>•</Text>
          <Ionicons name="people" size={14} color="#6b7280" />
          <Text style={styles.communityMetaText}>{item.memberCount} üye</Text>
        </View>
      </View>
      
      <Ionicons name="chevron-forward" size={20} color="#6b7280" />
    </TouchableOpacity>
  );

  const renderGroupChat = ({ item }: { item: GroupChat }) => (
    <TouchableOpacity
      style={styles.chatCard}
      onPress={() => router.push(`/chat/group/${item.id}`)}
    >
      <LinearGradient
        colors={['#10b981', '#14b8a6']}
        style={styles.groupIcon}
      >
        <Ionicons name="people" size={22} color="#fff" />
      </LinearGradient>
      
      <View style={styles.chatInfo}>
        <Text style={styles.chatName}>{item.name}</Text>
        <View style={styles.communityMeta}>
          <Ionicons name="globe-outline" size={14} color="#6b7280" />
          <Text style={styles.communityMetaText}>{item.communityName}</Text>
          <Text style={styles.communityMetaText}>•</Text>
          <Text style={styles.communityMetaText}>{item.memberCount} üye</Text>
        </View>
      </View>
      
      <Ionicons name="chevron-forward" size={20} color="#6b7280" />
    </TouchableOpacity>
  );

  const renderAllContent = () => (
    <ScrollView 
      style={styles.scrollView}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />
      }
    >
      {/* Özel Mesajlar Bölümü */}
      {chats.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <LinearGradient colors={['#3b82f6', '#6366f1']} style={styles.sectionIconBg}>
              <Ionicons name="chatbubble" size={16} color="#fff" />
            </LinearGradient>
            <Text style={styles.sectionTitle}>Özel Mesajlar</Text>
            <Text style={styles.sectionCount}>{chats.length}</Text>
          </View>
          {chats.slice(0, 3).map((chat) => (
            <View key={chat.chatId}>{renderChat({ item: chat })}</View>
          ))}
          {chats.length > 3 && (
            <TouchableOpacity style={styles.showMoreButton} onPress={() => setActiveTab('private')}>
              <Text style={styles.showMoreText}>Tümünü Gör ({chats.length})</Text>
              <Ionicons name="arrow-forward" size={16} color="#6366f1" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Topluluklar Bölümü */}
      {communities.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <LinearGradient colors={['#f59e0b', '#f97316']} style={styles.sectionIconBg}>
              <Ionicons name="globe" size={16} color="#fff" />
            </LinearGradient>
            <Text style={styles.sectionTitle}>Topluluklarım</Text>
            <Text style={styles.sectionCount}>{communities.length}</Text>
          </View>
          {communities.slice(0, 3).map((community) => (
            <View key={community.id}>{renderCommunity({ item: community })}</View>
          ))}
          {communities.length > 3 && (
            <TouchableOpacity style={styles.showMoreButton} onPress={() => setActiveTab('communities')}>
              <Text style={styles.showMoreText}>Tümünü Gör ({communities.length})</Text>
              <Ionicons name="arrow-forward" size={16} color="#6366f1" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Gruplar Bölümü */}
      {groupChats.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <LinearGradient colors={['#10b981', '#14b8a6']} style={styles.sectionIconBg}>
              <Ionicons name="people" size={16} color="#fff" />
            </LinearGradient>
            <Text style={styles.sectionTitle}>Gruplarım</Text>
            <Text style={styles.sectionCount}>{groupChats.length}</Text>
          </View>
          {groupChats.slice(0, 3).map((group) => (
            <View key={group.id}>{renderGroupChat({ item: group })}</View>
          ))}
          {groupChats.length > 3 && (
            <TouchableOpacity style={styles.showMoreButton} onPress={() => setActiveTab('groups')}>
              <Text style={styles.showMoreText}>Tümünü Gör ({groupChats.length})</Text>
              <Ionicons name="arrow-forward" size={16} color="#6366f1" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Boş Durum */}
      {chats.length === 0 && communities.length === 0 && groupChats.length === 0 && (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="chatbubbles-outline" size={64} color="#6366f1" />
          </View>
          <Text style={styles.emptyText}>Henüz içerik yok</Text>
          <Text style={styles.emptySubtext}>
            Topluluk ve gruplara katılın, yeni sohbetler başlatın!
          </Text>
          <TouchableOpacity 
            style={styles.emptyButton}
            onPress={() => router.push('/(tabs)/communities')}
          >
            <Ionicons name="compass" size={20} color="#fff" />
            <Text style={styles.emptyButtonText}>Keşfet</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );

  const renderEmptyState = (type: string, action: () => void, buttonText: string) => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <Ionicons 
          name={type === 'private' ? 'chatbubbles-outline' : type === 'communities' ? 'globe-outline' : 'people-outline'} 
          size={64} 
          color="#6366f1" 
        />
      </View>
      <Text style={styles.emptyText}>
        {type === 'private' ? 'Henüz mesaj yok' : type === 'communities' ? 'Topluluk bulunamadı' : 'Grup bulunamadı'}
      </Text>
      <Text style={styles.emptySubtext}>
        {type === 'private' 
          ? 'Yeni bir sohbet başlatmak için butona tıklayın' 
          : type === 'communities' 
            ? 'Topluluklara katılarak başlayın'
            : 'Gruplara katılarak sohbete başlayın'}
      </Text>
      <TouchableOpacity style={styles.emptyButton} onPress={action}>
        <Ionicons name={type === 'private' ? 'add' : 'compass'} size={20} color="#fff" />
        <Text style={styles.emptyButtonText}>{buttonText}</Text>
      </TouchableOpacity>
    </View>
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
          <LinearGradient
            colors={['#6366f1', '#8b5cf6']}
            style={styles.newChatGradient}
          >
            <Ionicons name="create-outline" size={22} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {renderTabBar()}

      {activeTab === 'all' && renderAllContent()}
      
      {activeTab === 'private' && (
        <FlatList
          data={chats}
          renderItem={renderChat}
          keyExtractor={(item) => item.chatId}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />
          }
          ListEmptyComponent={renderEmptyState('private', () => router.push('/chat/new'), 'Yeni Sohbet')}
        />
      )}

      {activeTab === 'communities' && (
        <FlatList
          data={communities}
          renderItem={renderCommunity}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />
          }
          ListEmptyComponent={renderEmptyState('communities', () => router.push('/(tabs)/communities'), 'Toplulukları Keşfet')}
        />
      )}

      {activeTab === 'groups' && (
        <FlatList
          data={groupChats}
          renderItem={renderGroupChat}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />
          }
          ListEmptyComponent={renderEmptyState('groups', () => router.push('/(tabs)/communities'), 'Gruplara Katıl')}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  loadingContainer: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  newChatButton: { borderRadius: 22, overflow: 'hidden' },
  newChatGradient: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  tabsContainer: { borderBottomWidth: 1, borderBottomColor: '#1f2937' },
  tabsContent: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  tabWrapper: { marginRight: 8 },
  tab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#111827', gap: 6 },
  tabActive: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, gap: 6 },
  tabText: { color: '#6b7280', fontSize: 14, fontWeight: '500' },
  tabTextActive: { color: '#fff', fontSize: 14, fontWeight: '600' },
  tabBadge: { backgroundColor: '#ef4444', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, minWidth: 20, alignItems: 'center' },
  tabBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  tabBadgeActive: { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, minWidth: 20, alignItems: 'center' },
  tabBadgeTextActive: { color: '#fff', fontSize: 10, fontWeight: '700' },
  scrollView: { flex: 1 },
  section: { marginTop: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 8, gap: 10 },
  sectionIconBg: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1 },
  sectionCount: { color: '#6b7280', fontSize: 14, backgroundColor: '#1f2937', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  showMoreButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 6 },
  showMoreText: { color: '#6366f1', fontSize: 14, fontWeight: '500' },
  listContent: { paddingVertical: 8, flexGrow: 1 },
  chatCard: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1f2937' },
  communityCard: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1f2937' },
  avatarContainer: { position: 'relative' },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#1f2937', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  serviceBadge: { position: 'absolute', bottom: 0, right: 0, width: 20, height: 20, borderRadius: 10, backgroundColor: '#10b981', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#0a0a0a' },
  groupIcon: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  communityIcon: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  chatInfo: { flex: 1, marginLeft: 14 },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chatName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  chatTime: { color: '#6b7280', fontSize: 12 },
  chatPreview: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  lastMessage: { color: '#9ca3af', fontSize: 14, flex: 1 },
  communityMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 },
  communityMetaText: { color: '#6b7280', fontSize: 13 },
  typingContainer: { flexDirection: 'row', alignItems: 'center' },
  typingText: { color: '#6366f1', fontSize: 14, fontStyle: 'italic' },
  typingDots: { flexDirection: 'row', marginLeft: 4 },
  typingDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#6366f1', marginHorizontal: 1 },
  dot1: { opacity: 0.4 },
  dot2: { opacity: 0.7 },
  dot3: { opacity: 1 },
  unreadBadge: { backgroundColor: '#6366f1', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, marginLeft: 8 },
  unreadCount: { color: '#fff', fontSize: 12, fontWeight: '700' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 64, paddingHorizontal: 32 },
  emptyIconContainer: { width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(99, 102, 241, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  emptyText: { color: '#fff', fontSize: 20, fontWeight: '600' },
  emptySubtext: { color: '#6b7280', fontSize: 14, marginTop: 8, textAlign: 'center', lineHeight: 20 },
  emptyButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#6366f1', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24, marginTop: 24, gap: 8 },
  emptyButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
