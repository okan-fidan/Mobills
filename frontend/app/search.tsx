import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { userListApi, communityApi, postApi } from '../src/services/api';
import { useAuth } from '../src/contexts/AuthContext';
import debounce from 'lodash/debounce';

type TabType = 'all' | 'users' | 'communities' | 'posts';

interface SearchResult {
  type: 'user' | 'community' | 'post';
  id: string;
  title: string;
  subtitle?: string;
  image?: string;
}

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const { user } = useAuth();
  const router = useRouter();

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    const allResults: SearchResult[] = [];

    try {
      // Kullanıcıları ara
      if (activeTab === 'all' || activeTab === 'users') {
        const usersRes = await userListApi.getAll();
        const filteredUsers = usersRes.data.filter((u: any) =>
          `${u.firstName} ${u.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
          u.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          u.occupation?.toLowerCase().includes(searchQuery.toLowerCase())
        ).slice(0, 10);

        filteredUsers.forEach((u: any) => {
          allResults.push({
            type: 'user',
            id: u.uid,
            title: `${u.firstName} ${u.lastName}`,
            subtitle: u.city || u.occupation,
            image: u.profileImageUrl,
          });
        });
      }

      // Toplulukları ara
      if (activeTab === 'all' || activeTab === 'communities') {
        const communitiesRes = await communityApi.getAll();
        const filteredCommunities = communitiesRes.data.filter((c: any) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.city?.toLowerCase().includes(searchQuery.toLowerCase())
        ).slice(0, 10);

        filteredCommunities.forEach((c: any) => {
          allResults.push({
            type: 'community',
            id: c.id,
            title: c.name,
            subtitle: `${c.memberCount} üye • ${c.city}`,
          });
        });
      }

      // Gönderileri ara
      if (activeTab === 'all' || activeTab === 'posts') {
        const postsRes = await postApi.getAll();
        const filteredPosts = postsRes.data.filter((p: any) =>
          p.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.userName?.toLowerCase().includes(searchQuery.toLowerCase())
        ).slice(0, 10);

        filteredPosts.forEach((p: any) => {
          allResults.push({
            type: 'post',
            id: p.id,
            title: p.userName,
            subtitle: p.content?.slice(0, 60) + (p.content?.length > 60 ? '...' : ''),
            image: p.userProfileImage,
          });
        });
      }

      setResults(allResults);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  const debouncedSearch = useCallback(debounce(performSearch, 300), [performSearch]);

  useEffect(() => {
    debouncedSearch(query);
  }, [query, debouncedSearch]);

  const handleResultPress = (item: SearchResult) => {
    // Son aramalara ekle
    if (!recentSearches.includes(query)) {
      setRecentSearches(prev => [query, ...prev.slice(0, 4)]);
    }

    switch (item.type) {
      case 'user':
        router.push(`/user/${item.id}`);
        break;
      case 'community':
        router.push(`/community/${item.id}`);
        break;
      case 'post':
        // Post detay sayfası olabilir
        break;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'user': return 'person';
      case 'community': return 'people';
      case 'post': return 'document-text';
      default: return 'search';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'user': return '#6366f1';
      case 'community': return '#10b981';
      case 'post': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const renderTab = (tab: TabType, label: string) => (
    <TouchableOpacity
      style={[styles.tab, activeTab === tab && styles.activeTab]}
      onPress={() => setActiveTab(tab)}
    >
      <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{label}</Text>
    </TouchableOpacity>
  );

  const renderResult = ({ item }: { item: SearchResult }) => (
    <TouchableOpacity style={styles.resultCard} onPress={() => handleResultPress(item)}>
      <View style={[styles.resultIcon, { backgroundColor: `${getTypeColor(item.type)}20` }]}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.resultImage} />
        ) : (
          <Ionicons name={getTypeIcon(item.type) as any} size={24} color={getTypeColor(item.type)} />
        )}
      </View>
      <View style={styles.resultInfo}>
        <Text style={styles.resultTitle}>{item.title}</Text>
        {item.subtitle && <Text style={styles.resultSubtitle}>{item.subtitle}</Text>}
      </View>
      <View style={styles.resultType}>
        <Text style={[styles.resultTypeText, { color: getTypeColor(item.type) }]}>
          {item.type === 'user' ? 'Kullanıcı' : item.type === 'community' ? 'Topluluk' : 'Gönderi'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#6b7280" />
          <TextInput
            style={styles.searchInput}
            placeholder="Kullanıcı, topluluk veya gönderi ara..."
            placeholderTextColor="#6b7280"
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={20} color="#6b7280" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {renderTab('all', 'Tümü')}
        {renderTab('users', 'Kullanıcılar')}
        {renderTab('communities', 'Topluluklar')}
        {renderTab('posts', 'Gönderiler')}
      </View>

      {/* Results */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      ) : query.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="search" size={48} color="#6366f1" />
          </View>
          <Text style={styles.emptyTitle}>Ara ve Keşfet</Text>
          <Text style={styles.emptySubtitle}>Kullanıcıları, toplulukları ve gönderileri arayın</Text>
          
          {recentSearches.length > 0 && (
            <View style={styles.recentSection}>
              <Text style={styles.recentTitle}>Son Aramalar</Text>
              {recentSearches.map((search, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.recentItem}
                  onPress={() => setQuery(search)}
                >
                  <Ionicons name="time-outline" size={18} color="#6b7280" />
                  <Text style={styles.recentText}>{search}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      ) : results.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="search-outline" size={64} color="#374151" />
          <Text style={styles.noResultsText}>Sonuç bulunamadı</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          renderItem={renderResult}
          keyExtractor={(item) => `${item.type}-${item.id}`}
          contentContainerStyle={styles.resultsList}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  searchInputContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#1f2937', borderRadius: 12, paddingHorizontal: 12, height: 48, gap: 8 },
  searchInput: { flex: 1, color: '#fff', fontSize: 16 },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#1f2937' },
  activeTab: { backgroundColor: '#6366f1' },
  tabText: { color: '#9ca3af', fontSize: 14, fontWeight: '500' },
  activeTabText: { color: '#fff' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  resultsList: { padding: 16 },
  resultCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111827', borderRadius: 12, padding: 14, marginBottom: 10 },
  resultIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  resultImage: { width: '100%', height: '100%' },
  resultInfo: { flex: 1, marginLeft: 12 },
  resultTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },
  resultSubtitle: { color: '#6b7280', fontSize: 13, marginTop: 2 },
  resultType: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: '#1f2937' },
  resultTypeText: { fontSize: 11, fontWeight: '500' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyIconContainer: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(99, 102, 241, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyTitle: { color: '#fff', fontSize: 20, fontWeight: '600' },
  emptySubtitle: { color: '#6b7280', fontSize: 14, marginTop: 8, textAlign: 'center' },
  noResultsText: { color: '#6b7280', fontSize: 16, marginTop: 16 },
  recentSection: { width: '100%', marginTop: 32 },
  recentTitle: { color: '#9ca3af', fontSize: 14, fontWeight: '500', marginBottom: 12 },
  recentItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: '#1f2937' },
  recentText: { color: '#fff', fontSize: 15 },
});
