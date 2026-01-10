import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { postApi } from '../../src/services/api';
import { useAuth } from '../../src/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';

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

export default function HomeScreen() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { userProfile } = useAuth();
  const router = useRouter();

  const loadPosts = useCallback(async () => {
    try {
      const response = await postApi.getAll();
      setPosts(response.data);
    } catch (error) {
      console.error('Error loading posts:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadPosts();
  }, [loadPosts]);

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
        <TouchableOpacity style={styles.moreButton}>
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

        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="chatbubble-outline" size={22} color="#6b7280" />
          <Text style={styles.actionText}>{item.commentCount}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="share-outline" size={22} color="#6b7280" />
        </TouchableOpacity>
      </View>
    </View>
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
          <TouchableOpacity style={styles.headerButton}>
            <Ionicons name="notifications-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

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

      {/* Posts */}
      {loading ? (
        <FlatList
          data={[1, 2, 3]}
          renderItem={() => <SkeletonPost />}
          keyExtractor={(item) => item.toString()}
          contentContainerStyle={styles.postsList}
        />
      ) : (
        <FlatList
          data={posts}
          renderItem={renderPost}
          keyExtractor={(item) => item.id}
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
  quickPost: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111827', marginHorizontal: 16, marginVertical: 12, borderRadius: 12, padding: 14 },
  quickPostAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1f2937', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  quickPostText: { flex: 1, marginLeft: 12, color: '#6b7280', fontSize: 15 },
  quickPostActions: { flexDirection: 'row' },
  quickPostButton: { padding: 8 },
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
});
