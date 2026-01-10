import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../src/services/api';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';

interface Post {
  id: string;
  content: string;
  imageUrl?: string;
  likeCount: number;
  commentCount: number;
  timestamp: string;
}

export default function MyPostsScreen() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const loadPosts = useCallback(async () => {
    try {
      const response = await api.get('/my-posts');
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

  const handleDelete = async (postId: string) => {
    Alert.alert(
      'Gönderiyi Sil',
      'Bu gönderiyi silmek istediğinize emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/posts/${postId}`);
              setPosts(posts.filter(p => p.id !== postId));
            } catch (error) {
              Alert.alert('Hata', 'Gönderi silinemedi');
            }
          },
        },
      ]
    );
  };

  const formatTime = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true, locale: tr });
    } catch { return ''; }
  };

  const renderPost = ({ item }: { item: Post }) => (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <Text style={styles.postTime}>{formatTime(item.timestamp)}</Text>
        <TouchableOpacity onPress={() => handleDelete(item.id)}>
          <Ionicons name="trash-outline" size={20} color="#ef4444" />
        </TouchableOpacity>
      </View>
      <Text style={styles.postContent} numberOfLines={3}>{item.content}</Text>
      {item.imageUrl && (
        <Image source={{ uri: item.imageUrl }} style={styles.postImage} />
      )}
      <View style={styles.postStats}>
        <View style={styles.stat}>
          <Ionicons name="heart" size={18} color="#ef4444" />
          <Text style={styles.statText}>{item.likeCount}</Text>
        </View>
        <View style={styles.stat}>
          <Ionicons name="chatbubble" size={18} color="#6b7280" />
          <Text style={styles.statText}>{item.commentCount}</Text>
        </View>
      </View>
    </View>
  );

  if (loading) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#6366f1" /></View>;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gönderilerim</Text>
        <TouchableOpacity onPress={() => router.push('/post/create')}>
          <Ionicons name="add-circle" size={28} color="#6366f1" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={64} color="#374151" />
            <Text style={styles.emptyText}>Henüz gönderi paylaşmadınız</Text>
            <TouchableOpacity style={styles.emptyButton} onPress={() => router.push('/post/create')}>
              <Text style={styles.emptyButtonText}>İlk Gönderiyi Paylaş</Text>
            </TouchableOpacity>
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
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '600' },
  list: { padding: 16 },
  postCard: { backgroundColor: '#111827', borderRadius: 16, padding: 16, marginBottom: 12 },
  postHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  postTime: { color: '#6b7280', fontSize: 13 },
  postContent: { color: '#e5e7eb', fontSize: 15, lineHeight: 22 },
  postImage: { width: '100%', height: 150, borderRadius: 12, marginTop: 12 },
  postStats: { flexDirection: 'row', marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#1f2937', gap: 20 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statText: { color: '#6b7280', fontSize: 14 },
  emptyState: { alignItems: 'center', paddingVertical: 64 },
  emptyText: { color: '#6b7280', fontSize: 16, marginTop: 16 },
  emptyButton: { backgroundColor: '#6366f1', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24, marginTop: 20 },
  emptyButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
