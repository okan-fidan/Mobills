import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import api, { postApi } from '../../src/services/api';
import { useAuth } from '../../src/contexts/AuthContext';
import Toast from 'react-native-toast-message';

interface Comment {
  id: string;
  userId: string;
  userName: string;
  userProfileImage?: string;
  content: string;
  timestamp: string;
  likes: string[];
}

interface Post {
  id: string;
  userId: string;
  userName: string;
  userProfileImage?: string;
  content: string;
  imageUrl?: string;
  location?: string;
  mentions?: string[];
  likeCount: number;
  commentCount: number;
  isLiked: boolean;
  timestamp: string;
}

export default function PostDetailScreen() {
  const { id: postId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, userProfile } = useAuth();
  
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Kullanıcının kendi gönderi mi kontrol et
  const isOwner = post && user && post.userId === user.uid;

  const loadData = useCallback(async () => {
    try {
      // Post'u yükle
      const postsRes = await api.get('/api/posts');
      const foundPost = postsRes.data.find((p: Post) => p.id === postId);
      if (foundPost) {
        setPost(foundPost);
      }
      
      // Yorumları yükle
      const commentsRes = await api.get(`/api/posts/${postId}/comments`);
      setComments(commentsRes.data || []);
    } catch (error) {
      console.error('Error loading post:', error);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleLike = async () => {
    if (!post) return;
    try {
      const response = await api.post(`/api/posts/${postId}/like`);
      setPost({
        ...post,
        isLiked: response.data.liked,
        likeCount: response.data.likeCount,
      });
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  const handleSendComment = async () => {
    if (!newComment.trim()) return;
    
    setSending(true);
    try {
      const response = await api.post(`/api/posts/${postId}/comments`, {
        content: newComment.trim(),
      });
      setComments([...comments, response.data]);
      setNewComment('');
      if (post) {
        setPost({ ...post, commentCount: post.commentCount + 1 });
      }
    } catch (error) {
      console.error('Error sending comment:', error);
      Alert.alert('Hata', 'Yorum gönderilemedi');
    } finally {
      setSending(false);
    }
  };

  const handleDeletePost = () => {
    Alert.alert(
      'Gönderiyi Sil',
      'Bu gönderiyi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.',
      [
        { text: 'İptal', style: 'cancel' },
        { 
          text: 'Sil', 
          style: 'destructive',
          onPress: confirmDeletePost 
        },
      ]
    );
  };

  const confirmDeletePost = async () => {
    if (!postId) return;
    
    setDeleting(true);
    try {
      await postApi.delete(postId);
      Toast.show({
        type: 'success',
        text1: 'Başarılı',
        text2: 'Gönderi silindi',
      });
      router.back();
    } catch (error: any) {
      console.error('Error deleting post:', error);
      const errorMsg = error.response?.data?.detail || 'Gönderi silinemedi';
      Toast.show({
        type: 'error',
        text1: 'Hata',
        text2: errorMsg,
      });
    } finally {
      setDeleting(false);
    }
  };

  const formatTime = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true, locale: tr });
    } catch {
      return '';
    }
  };

  const renderComment = ({ item }: { item: Comment }) => (
    <View style={styles.commentCard}>
      <TouchableOpacity 
        style={styles.commentAvatar}
        onPress={() => router.push(`/user/${item.userId}`)}
      >
        {item.userProfileImage ? (
          <Image source={{ uri: item.userProfileImage }} style={styles.avatarImage} />
        ) : (
          <Ionicons name="person" size={18} color="#9ca3af" />
        )}
      </TouchableOpacity>
      <View style={styles.commentContent}>
        <View style={styles.commentHeader}>
          <Text style={styles.commentUserName}>{item.userName}</Text>
          <Text style={styles.commentTime}>{formatTime(item.timestamp)}</Text>
        </View>
        <Text style={styles.commentText}>{item.content}</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (!post) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="document-text-outline" size={64} color="#6b7280" />
        <Text style={styles.errorText}>Gönderi bulunamadı</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Gönderi</Text>
          {isOwner ? (
            <TouchableOpacity 
              onPress={handleDeletePost} 
              style={styles.deleteButton}
              disabled={deleting}
            >
              {deleting ? (
                <ActivityIndicator size="small" color="#ef4444" />
              ) : (
                <Ionicons name="trash-outline" size={22} color="#ef4444" />
              )}
            </TouchableOpacity>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>

        <FlatList
          data={comments}
          renderItem={renderComment}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <>
              {/* Post Content */}
              <View style={styles.postCard}>
                <TouchableOpacity 
                  style={styles.postHeader}
                  onPress={() => router.push(`/user/${post.userId}`)}
                >
                  <View style={styles.avatar}>
                    {post.userProfileImage ? (
                      <Image source={{ uri: post.userProfileImage }} style={styles.avatarImage} />
                    ) : (
                      <Ionicons name="person" size={20} color="#9ca3af" />
                    )}
                  </View>
                  <View style={styles.postHeaderInfo}>
                    <Text style={styles.userName}>{post.userName}</Text>
                    <Text style={styles.postTime}>{formatTime(post.timestamp)}</Text>
                  </View>
                </TouchableOpacity>

                <Text style={styles.postContent}>{post.content}</Text>

                {post.location && (
                  <View style={styles.locationTag}>
                    <Ionicons name="location" size={14} color="#6366f1" />
                    <Text style={styles.locationText}>{post.location}</Text>
                  </View>
                )}

                {post.imageUrl && (
                  <Image source={{ uri: post.imageUrl }} style={styles.postImage} resizeMode="cover" />
                )}

                <View style={styles.postActions}>
                  <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
                    <Ionicons 
                      name={post.isLiked ? 'heart' : 'heart-outline'} 
                      size={24} 
                      color={post.isLiked ? '#ef4444' : '#6b7280'} 
                    />
                    <Text style={[styles.actionText, post.isLiked && styles.likedText]}>
                      {post.likeCount}
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.actionButton}>
                    <Ionicons name="chatbubble" size={22} color="#6366f1" />
                    <Text style={[styles.actionText, { color: '#6366f1' }]}>{comments.length}</Text>
                  </View>
                </View>
              </View>

              {/* Comments Header */}
              <View style={styles.commentsHeader}>
                <Text style={styles.commentsTitle}>Yorumlar ({comments.length})</Text>
              </View>
            </>
          }
          ListEmptyComponent={
            <View style={styles.emptyComments}>
              <Ionicons name="chatbubble-outline" size={48} color="#374151" />
              <Text style={styles.emptyText}>Henüz yorum yok</Text>
              <Text style={styles.emptySubtext}>İlk yorumu sen yap!</Text>
            </View>
          }
          contentContainerStyle={styles.commentsList}
        />

        {/* Comment Input */}
        <View style={styles.inputContainer}>
          <View style={styles.inputAvatar}>
            {userProfile?.profileImageUrl ? (
              <Image source={{ uri: userProfile.profileImageUrl }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person" size={16} color="#9ca3af" />
            )}
          </View>
          <TextInput
            style={styles.input}
            placeholder="Yorum yaz..."
            placeholderTextColor="#6b7280"
            value={newComment}
            onChangeText={setNewComment}
            multiline
            maxLength={500}
          />
          <TouchableOpacity 
            style={[styles.sendButton, !newComment.trim() && styles.sendButtonDisabled]}
            onPress={handleSendComment}
            disabled={!newComment.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  loadingContainer: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' },
  errorContainer: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#6b7280', fontSize: 16, marginTop: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1f2937' },
  backButton: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#fff' },
  postCard: { backgroundColor: '#111827', margin: 16, borderRadius: 16, overflow: 'hidden' },
  postHeader: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1f2937', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  postHeaderInfo: { flex: 1, marginLeft: 12 },
  userName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  postTime: { color: '#6b7280', fontSize: 12, marginTop: 2 },
  postContent: { paddingHorizontal: 14, paddingBottom: 14, color: '#e5e7eb', fontSize: 16, lineHeight: 24 },
  locationTag: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 12, gap: 4 },
  locationText: { color: '#6366f1', fontSize: 13 },
  postImage: { width: '100%', height: 250 },
  postActions: { flexDirection: 'row', padding: 14, borderTopWidth: 1, borderTopColor: '#1f2937' },
  actionButton: { flexDirection: 'row', alignItems: 'center', marginRight: 24, gap: 6 },
  actionText: { color: '#6b7280', fontSize: 14 },
  likedText: { color: '#ef4444' },
  commentsHeader: { paddingHorizontal: 16, paddingVertical: 12 },
  commentsTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  commentsList: { paddingBottom: 16 },
  commentCard: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1f2937' },
  commentAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1f2937', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  commentContent: { flex: 1, marginLeft: 12 },
  commentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  commentUserName: { color: '#fff', fontSize: 14, fontWeight: '500' },
  commentTime: { color: '#6b7280', fontSize: 11 },
  commentText: { color: '#e5e7eb', fontSize: 14, marginTop: 4, lineHeight: 20 },
  emptyComments: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { color: '#9ca3af', fontSize: 16, marginTop: 12 },
  emptySubtext: { color: '#6b7280', fontSize: 14, marginTop: 4 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#1f2937', backgroundColor: '#111827' },
  inputAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1f2937', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  input: { flex: 1, marginHorizontal: 12, color: '#fff', fontSize: 15, maxHeight: 80 },
  sendButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center' },
  sendButtonDisabled: { opacity: 0.5 },
});
