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
import { useAuth } from '../../src/contexts/AuthContext';
import api from '../../src/services/api';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';

type TabType = 'all' | 'communities' | 'groups' | 'private';

interface Chat {
  id: string;
  type: 'dm';
  otherUserId: string;
  otherUserName: string;
  otherUserImage?: string;
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
}

interface Community {
  id: string;
  name: string;
  city: string;
  memberCount: number;
  imageUrl?: string;
}

interface GroupChat {
  id: string;
  name: string;
  communityId: string;
  communityName: string;
  memberCount: number;
}

export default function MessagesScreen() {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [groupChats, setGroupChats] = useState<GroupChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [error, setError] = useState<string | null>(null);
  const { userProfile, user } = useAuth();
  const router = useRouter();

  const loadData = useCallback(async () => {
    // Kullanıcı giriş yapmamışsa veri yükleme
    if (!user) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setError(null);
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
        }));
      setCommunities(myCommunities);

      // Gruplar
      const myGroups: GroupChat[] = [];
      for (const community of communitiesRes.data.filter((c: any) => c.isMember)) {
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
              });
            }
          }
        } catch (e) {
          // Sessizce devam et
        }
      }
      setGroupChats(myGroups);
    } catch (error: any) {
      console.log('Error loading data:', error?.message || error);
      if (error?.response?.status === 403 || error?.response?.status === 401) {
        setError('Oturum süresi dolmuş olabilir. Lütfen tekrar giriş yapın.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    // User değiştiğinde veya hazır olduğunda veri yükle
    if (user) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [user, loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

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
        const count = tab.key === 'communities' 
          ? communities.length 
          : tab.key === 'groups' 
            ? groupChats.length 
            : communities.length + groupChats.length;

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
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  const renderCommunity = ({ item }: { item: Community }) => (
    <TouchableOpacity
      style={styles.itemCard}
      onPress={() => router.push(`/community/${item.id}`)}
    >
      <LinearGradient
        colors={['#f59e0b', '#f97316']}
        style={styles.itemIcon}
      >
        <Ionicons name="globe" size={24} color="#fff" />
      </LinearGradient>
      
      <View style={styles.itemInfo}>
        <Text style={styles.itemName}>{item.name}</Text>
        <View style={styles.itemMeta}>
          <Ionicons name="location" size={14} color="#6b7280" />
          <Text style={styles.itemMetaText}>{item.city}</Text>
          <Text style={styles.itemMetaText}>•</Text>
          <Ionicons name="people" size={14} color="#6b7280" />
          <Text style={styles.itemMetaText}>{item.memberCount} üye</Text>
        </View>
      </View>
      
      <Ionicons name="chevron-forward" size={20} color="#6b7280" />
    </TouchableOpacity>
  );

  const renderGroupChat = ({ item }: { item: GroupChat }) => (
    <TouchableOpacity
      style={styles.itemCard}
      onPress={() => router.push(`/chat/group/${item.id}`)}
    >
      <LinearGradient
        colors={['#10b981', '#14b8a6']}
        style={styles.itemIcon}
      >
        <Ionicons name="chatbubbles" size={22} color="#fff" />
      </LinearGradient>
      
      <View style={styles.itemInfo}>
        <Text style={styles.itemName}>{item.name}</Text>
        <View style={styles.itemMeta}>
          <Ionicons name="globe-outline" size={14} color="#6b7280" />
          <Text style={styles.itemMetaText}>{item.communityName}</Text>
          <Text style={styles.itemMetaText}>•</Text>
          <Text style={styles.itemMetaText}>{item.memberCount} üye</Text>
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
      {/* Topluluklar Bölümü */}
      {communities.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <LinearGradient colors={['#f59e0b', '#f97316']} style={styles.sectionIconBg}>
              <Ionicons name="globe" size={16} color="#fff" />
            </LinearGradient>
            <Text style={styles.sectionTitle}>Topluluklarım</Text>
            <View style={styles.sectionBadge}>
              <Text style={styles.sectionBadgeText}>{communities.length}</Text>
            </View>
          </View>
          {communities.map((community) => (
            <View key={community.id}>{renderCommunity({ item: community })}</View>
          ))}
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
            <View style={styles.sectionBadge}>
              <Text style={styles.sectionBadgeText}>{groupChats.length}</Text>
            </View>
          </View>
          {groupChats.map((group) => (
            <View key={group.id}>{renderGroupChat({ item: group })}</View>
          ))}
        </View>
      )}

      {/* Boş Durum */}
      {communities.length === 0 && groupChats.length === 0 && (
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
            <Text style={styles.emptyButtonText}>Toplulukları Keşfet</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );

  const renderEmptyState = (type: string) => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <Ionicons 
          name={type === 'private' ? 'chatbubbles-outline' : type === 'communities' ? 'globe-outline' : 'people-outline'} 
          size={64} 
          color="#6366f1" 
        />
      </View>
      <Text style={styles.emptyText}>
        {type === 'private' ? 'Henüz özel mesaj yok' : type === 'communities' ? 'Topluluk bulunamadı' : 'Grup bulunamadı'}
      </Text>
      <Text style={styles.emptySubtext}>
        {type === 'private' 
          ? 'Yeni bir sohbet başlatmak için butona tıklayın' 
          : type === 'communities' 
            ? 'Topluluklara katılarak başlayın'
            : 'Gruplara katılarak sohbete başlayın'}
      </Text>
      <TouchableOpacity 
        style={styles.emptyButton} 
        onPress={() => type === 'private' ? router.push('/chat/new') : router.push('/(tabs)/communities')}
      >
        <Ionicons name={type === 'private' ? 'add' : 'compass'} size={20} color="#fff" />
        <Text style={styles.emptyButtonText}>
          {type === 'private' ? 'Yeni Sohbet' : 'Keşfet'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Mesajlar</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>Yükleniyor...</Text>
        </View>
      </SafeAreaView>
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
      
      {activeTab === 'private' && renderEmptyState('private')}

      {activeTab === 'communities' && (
        communities.length > 0 ? (
          <FlatList
            data={communities}
            renderItem={renderCommunity}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />
            }
          />
        ) : renderEmptyState('communities')
      )}

      {activeTab === 'groups' && (
        groupChats.length > 0 ? (
          <FlatList
            data={groupChats}
            renderItem={renderGroupChat}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />
            }
          />
        ) : renderEmptyState('groups')
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#6b7280', fontSize: 14, marginTop: 12 },
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
  tabBadgeActive: { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, minWidth: 20, alignItems: 'center' },
  tabBadgeTextActive: { color: '#fff', fontSize: 10, fontWeight: '700' },
  scrollView: { flex: 1 },
  section: { marginTop: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 8, gap: 10 },
  sectionIconBg: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1 },
  sectionBadge: { backgroundColor: '#1f2937', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  sectionBadgeText: { color: '#6b7280', fontSize: 14 },
  listContent: { paddingVertical: 8, flexGrow: 1 },
  itemCard: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1f2937' },
  itemIcon: { width: 52, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  itemInfo: { flex: 1, marginLeft: 14 },
  itemName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  itemMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 },
  itemMetaText: { color: '#6b7280', fontSize: 13 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 64, paddingHorizontal: 32 },
  emptyIconContainer: { width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(99, 102, 241, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  emptyText: { color: '#fff', fontSize: 20, fontWeight: '600' },
  emptySubtext: { color: '#6b7280', fontSize: 14, marginTop: 8, textAlign: 'center', lineHeight: 20 },
  emptyButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#6366f1', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24, marginTop: 24, gap: 8 },
  emptyButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
