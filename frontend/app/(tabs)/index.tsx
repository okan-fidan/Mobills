import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Image,
  ScrollView,
  Animated,
  Dimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { postApi, communityApi } from '../../src/services/api';
import { useAuth } from '../../src/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

interface Post {
  id: string;
  userId: string;
  userName: string;
  userProfileImage?: string;
  content: string;
  imageUrl?: string;
  likeCount: number;
  commentCount: number;
  isLiked: boolean;
  timestamp: string;
}

interface Story {
  id: string;
  name: string;
  imageUrl?: string;
  hasNewStory: boolean;
  type: 'user' | 'community';
}

interface Announcement {
  id: string;
  content: string;
  communityName: string;
  communityId: string;
  timestamp: string;
}

// Skeleton Loading Component
const SkeletonPost = () => (
  <View style={styles.skeletonCard}>
    <View style={styles.skeletonHeader}>
      <View style={styles.skeletonAvatar} />
      <View style={styles.skeletonHeaderInfo}>
        <View style={styles.skeletonName} />
        <View style={styles.skeletonTime} />
      </View>
    </View>
    <View style={styles.skeletonContent} />
    <View style={styles.skeletonContentShort} />
    <View style={styles.skeletonActions} />
  </View>
);

// Stories Component
const StoriesSection = ({ stories, onStoryPress, onAddStory }: { 
  stories: Story[], 
  onStoryPress: (story: Story) => void,
  onAddStory: () => void 
}) => (
  <View style={styles.storiesContainer}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storiesScroll}>
      {/* Add Story Button */}
      <TouchableOpacity style={styles.storyItem} onPress={onAddStory}>
        <LinearGradient
          colors={['#6366f1', '#8b5cf6']}
          style={styles.addStoryCircle}
        >
          <View style={styles.addStoryInner}>
            <Ionicons name="add" size={28} color="#6366f1" />
          </View>
        </LinearGradient>
        <Text style={styles.storyName} numberOfLines={1}>Hikaye Ekle</Text>
      </TouchableOpacity>

      {/* Stories */}
      {stories.map((story) => (
        <TouchableOpacity 
          key={story.id} 
          style={styles.storyItem}
          onPress={() => onStoryPress(story)}
        >
          <LinearGradient
            colors={story.hasNewStory ? ['#f59e0b', '#ef4444', '#ec4899'] : ['#374151', '#374151']}
            style={styles.storyCircle}
          >
            <View style={styles.storyImageContainer}>
              {story.imageUrl ? (
                <Image source={{ uri: story.imageUrl }} style={styles.storyImage} />
              ) : (
                <View style={styles.storyPlaceholder}>
                  <Ionicons 
                    name={story.type === 'community' ? 'people' : 'person'} 
                    size={24} 
                    color="#9ca3af" 
                  />
                </View>
              )}
            </View>
          </LinearGradient>
          <Text style={styles.storyName} numberOfLines={1}>{story.name}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  </View>
);

// Welcome Card Component (for new users)
const WelcomeCard = ({ userProfile, onDismiss, router }: { 
  userProfile: any, 
  onDismiss: () => void,
  router: any 
}) => {
  const steps = [
    { id: 'profile', label: 'Profili Tamamla', icon: 'person', done: !!userProfile?.firstName },
    { id: 'community', label: 'Topluluğa Katıl', icon: 'people', done: (userProfile?.communities?.length || 0) > 0 },
    { id: 'post', label: 'İlk Gönderi', icon: 'create', done: false },
  ];
  
  const completedSteps = steps.filter(s => s.done).length;
  const progress = (completedSteps / steps.length) * 100;

  return (
    <View style={styles.welcomeCard}>
      <LinearGradient
        colors={['#6366f1', '#8b5cf6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.welcomeGradient}
      >
        <TouchableOpacity style={styles.welcomeClose} onPress={onDismiss}>
          <Ionicons name="close" size={20} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
        
        <View style={styles.welcomeHeader}>
          <Text style={styles.welcomeEmoji}>👋</Text>
          <View>
            <Text style={styles.welcomeTitle}>Hoş Geldin{userProfile?.firstName ? `, ${userProfile.firstName}` : ''}!</Text>
            <Text style={styles.welcomeSubtitle}>Hadi başlayalım</Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.progressText}>{completedSteps}/{steps.length} tamamlandı</Text>
        </View>

        {/* Steps */}
        <View style={styles.stepsContainer}>
          {steps.map((step, index) => (
            <TouchableOpacity 
              key={step.id}
              style={[styles.stepItem, step.done && styles.stepDone]}
              onPress={() => {
                if (step.id === 'profile') router.push('/(tabs)/profile');
                if (step.id === 'community') router.push('/(tabs)/communities');
                if (step.id === 'post') router.push('/post/create');
              }}
            >
              <View style={[styles.stepIcon, step.done && styles.stepIconDone]}>
                {step.done ? (
                  <Ionicons name="checkmark" size={16} color="#fff" />
                ) : (
                  <Ionicons name={step.icon as any} size={16} color="rgba(255,255,255,0.7)" />
                )}
              </View>
              <Text style={[styles.stepLabel, step.done && styles.stepLabelDone]}>{step.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>
    </View>
  );
};

// Announcement Banner Component
const AnnouncementBanner = ({ announcement, onPress, onDismiss }: {
  announcement: Announcement,
  onPress: () => void,
  onDismiss: () => void
}) => (
  <TouchableOpacity style={styles.announcementBanner} onPress={onPress} activeOpacity={0.9}>
    <LinearGradient
      colors={['#f59e0b', '#d97706']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={styles.announcementGradient}
    >
      <View style={styles.announcementIcon}>
        <Ionicons name="megaphone" size={20} color="#fff" />
      </View>
      <View style={styles.announcementContent}>
        <Text style={styles.announcementCommunity}>{announcement.communityName}</Text>
        <Text style={styles.announcementText} numberOfLines={1}>{announcement.content}</Text>
      </View>
      <TouchableOpacity style={styles.announcementClose} onPress={onDismiss}>
        <Ionicons name="close" size={18} color="rgba(255,255,255,0.7)" />
      </TouchableOpacity>
    </LinearGradient>
  </TouchableOpacity>
);

// Quick Actions Component
const QuickActions = ({ router }: { router: any }) => (
  <View style={styles.quickActionsContainer}>
    <TouchableOpacity style={styles.quickActionItem} onPress={() => router.push('/chat/new')}>
      <LinearGradient colors={['#10b981', '#059669']} style={styles.quickActionIcon}>
        <Ionicons name="chatbubble" size={20} color="#fff" />
      </LinearGradient>
      <Text style={styles.quickActionLabel}>Sohbet</Text>
    </TouchableOpacity>
    
    <TouchableOpacity style={styles.quickActionItem} onPress={() => router.push('/(tabs)/communities')}>
      <LinearGradient colors={['#6366f1', '#4f46e5']} style={styles.quickActionIcon}>
        <Ionicons name="people" size={20} color="#fff" />
      </LinearGradient>
      <Text style={styles.quickActionLabel}>Topluluklar</Text>
    </TouchableOpacity>
    
    <TouchableOpacity style={styles.quickActionItem} onPress={() => router.push('/service/create')}>
      <LinearGradient colors={['#f59e0b', '#d97706']} style={styles.quickActionIcon}>
        <Ionicons name="briefcase" size={20} color="#fff" />
      </LinearGradient>
      <Text style={styles.quickActionLabel}>Hizmet</Text>
    </TouchableOpacity>
    
    <TouchableOpacity style={styles.quickActionItem} onPress={() => router.push('/search')}>
      <LinearGradient colors={['#ec4899', '#db2777']} style={styles.quickActionIcon}>
        <Ionicons name="search" size={20} color="#fff" />
      </LinearGradient>
      <Text style={styles.quickActionLabel}>Keşfet</Text>
    </TouchableOpacity>
  </View>
);

export default function HomeScreen() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [showAnnouncement, setShowAnnouncement] = useState(true);
  const { userProfile, user } = useAuth();
  const router = useRouter();

  const loadData = useCallback(async () => {
    try {
      // Posts yükle
      const postsResponse = await postApi.getAll();
      setPosts(postsResponse.data || []);

      // Toplulukları yükle (hikayeler için)
      try {
        const communitiesResponse = await communityApi.getAll();
        const communityStories: Story[] = (communitiesResponse.data || [])
          .filter((c: any) => c.isMember)
          .slice(0, 8)
          .map((c: any) => ({
            id: c.id,
            name: c.name,
            imageUrl: c.imageUrl,
            hasNewStory: Math.random() > 0.5, // Demo için rastgele
            type: 'community' as const,
          }));
        setStories(communityStories);

        // Son duyuruyu al
        const memberCommunities = (communitiesResponse.data || []).filter((c: any) => c.isMember);
        if (memberCommunities.length > 0) {
          try {
            const announcementRes = await communityApi.getAnnouncements(memberCommunities[0].id);
            if (announcementRes.data && announcementRes.data.length > 0) {
              const latestAnnouncement = announcementRes.data[0];
              setAnnouncement({
                id: latestAnnouncement.id,
                content: latestAnnouncement.content,
                communityName: memberCommunities[0].name,
                communityId: memberCommunities[0].id,
                timestamp: latestAnnouncement.timestamp,
              });
            }
          } catch (e) {
            // Duyuru yükleme hatası sessizce geç
          }
        }
      } catch (e) {
        // Topluluk yükleme hatası
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleLike = async (postId: string) => {
    try {
      const response = await postApi.like(postId);
      setPosts(posts.map(post => 
        post.id === postId 
          ? { ...post, isLiked: response.data.liked, likeCount: response.data.likeCount }
          : post
      ));
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  const formatTime = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true, locale: tr });
    } catch {
      return '';
    }
  };

  const handleStoryPress = (story: Story) => {
    if (story.type === 'community') {
      router.push(`/community/${story.id}`);
    }
  };

  const renderPost = ({ item }: { item: Post }) => (
    <View style={styles.postCard}>
      <TouchableOpacity 
        style={styles.postHeader}
        onPress={() => router.push(`/user/${item.userId}`)}
      >
        <View style={styles.avatar}>
          {item.userProfileImage ? (
            <Image source={{ uri: item.userProfileImage }} style={styles.avatarImage} />
          ) : (
            <Ionicons name="person" size={20} color="#9ca3af" />
          )}
        </View>
        <View style={styles.postHeaderInfo}>
          <Text style={styles.userName}>{item.userName}</Text>
          <Text style={styles.postTime}>{formatTime(item.timestamp)}</Text>
        </View>
        <TouchableOpacity 
          style={styles.moreButton}
          onPress={() => Alert.alert(
            'Gönderi Seçenekleri',
            '',
            [
              { text: 'Bildir', onPress: () => Alert.alert('Bilgi', 'Gönderi bildirildi') },
              { text: 'Gizle', onPress: () => Alert.alert('Bilgi', 'Gönderi gizlendi') },
              { text: 'İptal', style: 'cancel' },
            ]
          )}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color="#6b7280" />
        </TouchableOpacity>
      </TouchableOpacity>

      <Text style={styles.postContent}>{item.content}</Text>

      {item.imageUrl && (
        <Image source={{ uri: item.imageUrl }} style={styles.postImage} resizeMode="cover" />
      )}

      <View style={styles.postActions}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleLike(item.id)}
        >
          <Ionicons 
            name={item.isLiked ? 'heart' : 'heart-outline'} 
            size={24} 
            color={item.isLiked ? '#ef4444' : '#6b7280'} 
          />
          <Text style={[styles.actionText, item.isLiked && styles.likedText]}>
            {item.likeCount}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => Alert.alert('Yorumlar', `${item.commentCount} yorum bulunuyor. Yorum özelliği yakında aktif olacak.`)}
        >
          <Ionicons name="chatbubble-outline" size={22} color="#6b7280" />
          <Text style={styles.actionText}>{item.commentCount}</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => Alert.alert('Paylaş', 'Bu gönderiyi paylaşmak istiyor musunuz?', [
            { text: 'İptal', style: 'cancel' },
            { text: 'Paylaş', onPress: () => Alert.alert('Başarılı', 'Gönderi paylaşıldı') },
          ])}
        >
          <Ionicons name="share-outline" size={22} color="#6b7280" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const ListHeader = () => (
    <>
      {/* Stories */}
      <StoriesSection 
        stories={stories} 
        onStoryPress={handleStoryPress}
        onAddStory={() => router.push('/post/create')}
      />

      {/* Announcement Banner */}
      {showAnnouncement && announcement && (
        <AnnouncementBanner 
          announcement={announcement}
          onPress={() => router.push(`/community/${announcement.communityId}`)}
          onDismiss={() => setShowAnnouncement(false)}
        />
      )}

      {/* Welcome Card (for new users or incomplete profile) */}
      {showWelcome && userProfile && (userProfile.communities?.length || 0) < 2 && (
        <WelcomeCard 
          userProfile={userProfile} 
          onDismiss={() => setShowWelcome(false)}
          router={router}
        />
      )}

      {/* Quick Actions */}
      <QuickActions router={router} />

      {/* Quick Post */}
      <TouchableOpacity 
        style={styles.quickPost}
        onPress={() => router.push('/post/create')}
      >
        <View style={styles.quickPostAvatar}>
          {userProfile?.profileImageUrl ? (
            <Image source={{ uri: userProfile.profileImageUrl }} style={styles.avatarImage} />
          ) : (
            <Ionicons name="person" size={18} color="#9ca3af" />
          )}
        </View>
        <Text style={styles.quickPostText}>Ne düşünüyorsun?</Text>
        <View style={styles.quickPostActions}>
          <TouchableOpacity style={styles.quickPostButton}>
            <Ionicons name="image" size={22} color="#10b981" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Network Solution</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => router.push('/search')}
          >
            <Ionicons name="search" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => router.push('/notifications')}
          >
            <Ionicons name="notifications-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <ScrollView>
          <View style={styles.skeletonStories}>
            {[1,2,3,4,5].map(i => (
              <View key={i} style={styles.skeletonStoryItem} />
            ))}
          </View>
          {[1, 2, 3].map(i => <SkeletonPost key={i} />)}
        </ScrollView>
      ) : (
        <FlatList
          data={posts}
          renderItem={renderPost}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={ListHeader}
          contentContainerStyle={styles.postsList}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="newspaper-outline" size={48} color="#6366f1" />
              </View>
              <Text style={styles.emptyText}>Henüz gönderi yok</Text>
              <Text style={styles.emptySubtext}>İlk gönderiyi paylaşan sen ol!</Text>
              <TouchableOpacity 
                style={styles.emptyButton}
                onPress={() => router.push('/post/create')}
              >
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={styles.emptyButtonText}>Gönderi Paylaş</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1f2937' },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#6366f1' },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 22, backgroundColor: '#1f2937' },
  
  // Stories
  storiesContainer: { borderBottomWidth: 1, borderBottomColor: '#1f2937', paddingVertical: 12 },
  storiesScroll: { paddingHorizontal: 12 },
  storyItem: { alignItems: 'center', marginHorizontal: 6, width: 72 },
  storyCircle: { width: 68, height: 68, borderRadius: 34, padding: 3, justifyContent: 'center', alignItems: 'center' },
  addStoryCircle: { width: 68, height: 68, borderRadius: 34, padding: 3, justifyContent: 'center', alignItems: 'center' },
  addStoryInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' },
  storyImageContainer: { width: 60, height: 60, borderRadius: 30, overflow: 'hidden', backgroundColor: '#1f2937' },
  storyImage: { width: '100%', height: '100%' },
  storyPlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: '#1f2937' },
  storyName: { color: '#9ca3af', fontSize: 11, marginTop: 4, textAlign: 'center' },
  
  // Announcement Banner
  announcementBanner: { marginHorizontal: 16, marginTop: 12, borderRadius: 12, overflow: 'hidden' },
  announcementGradient: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  announcementIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  announcementContent: { flex: 1, marginLeft: 12 },
  announcementCommunity: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '600' },
  announcementText: { color: '#fff', fontSize: 14, marginTop: 2 },
  announcementClose: { padding: 4 },
  
  // Welcome Card
  welcomeCard: { marginHorizontal: 16, marginTop: 12, borderRadius: 16, overflow: 'hidden' },
  welcomeGradient: { padding: 16 },
  welcomeClose: { position: 'absolute', top: 12, right: 12, zIndex: 1 },
  welcomeHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  welcomeEmoji: { fontSize: 36, marginRight: 12 },
  welcomeTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  welcomeSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 2 },
  progressContainer: { marginBottom: 16 },
  progressBar: { height: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#fff', borderRadius: 3 },
  progressText: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 6, textAlign: 'right' },
  stepsContainer: { flexDirection: 'row', justifyContent: 'space-between' },
  stepItem: { alignItems: 'center', flex: 1 },
  stepDone: { opacity: 0.7 },
  stepIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  stepIconDone: { backgroundColor: 'rgba(255,255,255,0.4)' },
  stepLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 11, textAlign: 'center' },
  stepLabelDone: { textDecorationLine: 'line-through' },
  
  // Quick Actions
  quickActionsContainer: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 16, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#1f2937' },
  quickActionItem: { alignItems: 'center' },
  quickActionIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  quickActionLabel: { color: '#9ca3af', fontSize: 11 },
  
  // Quick Post
  quickPost: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111827', marginHorizontal: 16, marginVertical: 12, borderRadius: 12, padding: 14 },
  quickPostAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1f2937', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  quickPostText: { flex: 1, marginLeft: 12, color: '#6b7280', fontSize: 15 },
  quickPostActions: { flexDirection: 'row' },
  quickPostButton: { padding: 8 },
  
  // Posts
  postsList: { paddingBottom: 16 },
  postCard: { backgroundColor: '#111827', marginHorizontal: 16, marginTop: 12, borderRadius: 16, overflow: 'hidden' },
  postHeader: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1f2937', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  postHeaderInfo: { flex: 1, marginLeft: 12 },
  userName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  postTime: { color: '#6b7280', fontSize: 12, marginTop: 2 },
  moreButton: { padding: 8 },
  postContent: { paddingHorizontal: 14, paddingBottom: 14, color: '#e5e7eb', fontSize: 15, lineHeight: 22 },
  postImage: { width: '100%', height: 250 },
  postActions: { flexDirection: 'row', padding: 14, borderTopWidth: 1, borderTopColor: '#1f2937' },
  actionButton: { flexDirection: 'row', alignItems: 'center', marginRight: 24, gap: 6 },
  actionText: { color: '#6b7280', fontSize: 14 },
  likedText: { color: '#ef4444' },
  
  // Empty State
  emptyState: { alignItems: 'center', paddingVertical: 64, paddingHorizontal: 32 },
  emptyIconContainer: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(99, 102, 241, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  emptySubtext: { color: '#6b7280', fontSize: 14, marginTop: 8, textAlign: 'center' },
  emptyButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#6366f1', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24, marginTop: 20, gap: 8 },
  emptyButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  
  // Skeleton styles
  skeletonCard: { backgroundColor: '#111827', marginHorizontal: 16, marginTop: 12, borderRadius: 16, padding: 14 },
  skeletonHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  skeletonAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1f2937' },
  skeletonHeaderInfo: { flex: 1, marginLeft: 12 },
  skeletonName: { width: 120, height: 14, borderRadius: 4, backgroundColor: '#1f2937' },
  skeletonTime: { width: 80, height: 10, borderRadius: 4, backgroundColor: '#1f2937', marginTop: 6 },
  skeletonContent: { width: '100%', height: 14, borderRadius: 4, backgroundColor: '#1f2937', marginBottom: 8 },
  skeletonContentShort: { width: '70%', height: 14, borderRadius: 4, backgroundColor: '#1f2937', marginBottom: 14 },
  skeletonActions: { width: '50%', height: 24, borderRadius: 4, backgroundColor: '#1f2937' },
  skeletonStories: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 12 },
  skeletonStoryItem: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#1f2937', marginHorizontal: 6 },
});
