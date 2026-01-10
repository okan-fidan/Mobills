import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { postApi } from '../../src/services/api';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';

interface Post {
  id: string;
  userId: string;
  userName: string;
  userProfileImage?: string;
  content: string;
  imageUrl?: string;
  likes: string[];
  comments: any[];
  isLiked: boolean;
  likeCount: number;
  commentCount: number;
  timestamp: string;
}

export default function HomeScreen() {
  const { userProfile } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [posting, setPosting] = useState(false);

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

  const handleCreatePost = async () => {
    if (!newPostContent.trim()) return;

    setPosting(true);
    try {
      const response = await postApi.create({ content: newPostContent });
      setPosts([{ ...response.data, isLiked: false, likeCount: 0, commentCount: 0 }, ...posts]);
      setNewPostContent('');
    } catch (error) {
      console.error('Error creating post:', error);
      Alert.alert('Hata', 'Gönderi oluşturulamadı');
    } finally {
      setPosting(false);
    }
  };

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
        <Text style={styles.headerTitle}>Ana Sayfa</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />
        }
      >
        {/* Create Post */}
        <View style={styles.createPostCard}>
          <View style={styles.createPostHeader}>
            <View style={styles.avatar}>
              {userProfile?.profileImageUrl ? (
                <Image source={{ uri: userProfile.profileImageUrl }} style={styles.avatarImage} />
              ) : (
                <Ionicons name="person" size={24} color="#9ca3af" />
              )}
            </View>
            <TextInput
              style={styles.postInput}
              placeholder="Ne düşünüyorsun?"
              placeholderTextColor="#6b7280"
              value={newPostContent}
              onChangeText={setNewPostContent}
              multiline
              maxLength={500}
            />
          </View>
          <TouchableOpacity
            style={[styles.postButton, (!newPostContent.trim() || posting) && styles.postButtonDisabled]}
            onPress={handleCreatePost}
            disabled={!newPostContent.trim() || posting}
          >
            {posting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.postButtonText}>Paylaş</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Posts */}
        {posts.map((post) => (
          <View key={post.id} style={styles.postCard}>
            <View style={styles.postHeader}>
              <View style={styles.avatar}>
                {post.userProfileImage ? (
                  <Image source={{ uri: post.userProfileImage }} style={styles.avatarImage} />
                ) : (
                  <Ionicons name="person" size={24} color="#9ca3af" />
                )}
              </View>
              <View style={styles.postHeaderText}>
                <Text style={styles.postUserName}>{post.userName}</Text>
                <Text style={styles.postTime}>{formatTime(post.timestamp)}</Text>
              </View>
            </View>

            <Text style={styles.postContent}>{post.content}</Text>

            {post.imageUrl && (
              <Image source={{ uri: post.imageUrl }} style={styles.postImage} resizeMode="cover" />
            )}

            <View style={styles.postActions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleLike(post.id)}
              >
                <Ionicons
                  name={post.isLiked ? 'heart' : 'heart-outline'}
                  size={22}
                  color={post.isLiked ? '#ef4444' : '#9ca3af'}
                />
                <Text style={[styles.actionText, post.isLiked && styles.actionTextActive]}>
                  {post.likeCount}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="chatbubble-outline" size={22} color="#9ca3af" />
                <Text style={styles.actionText}>{post.commentCount}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="share-outline" size={22} color="#9ca3af" />
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {posts.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={64} color="#374151" />
            <Text style={styles.emptyText}>Henüz gönderi yok</Text>
            <Text style={styles.emptySubtext}>Bir şeyler paylaşarak başlayın!</Text>
          </View>
        )}
      </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  createPostCard: {
    backgroundColor: '#111827',
    margin: 16,
    borderRadius: 12,
    padding: 16,
  },
  createPostHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1f2937',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  postInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    maxHeight: 100,
    textAlignVertical: 'top',
  },
  postButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignSelf: 'flex-end',
    marginTop: 12,
  },
  postButtonDisabled: {
    opacity: 0.5,
  },
  postButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  postCard: {
    backgroundColor: '#111827',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  postHeaderText: {
    flex: 1,
  },
  postUserName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  postTime: {
    color: '#6b7280',
    fontSize: 13,
    marginTop: 2,
  },
  postContent: {
    color: '#e5e7eb',
    fontSize: 15,
    lineHeight: 22,
  },
  postImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginTop: 12,
  },
  postActions: {
    flexDirection: 'row',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
    gap: 24,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  actionTextActive: {
    color: '#ef4444',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
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
  },
});
