import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { communityApi } from '../../src/services/api';

interface Community {
  id: string;
  name: string;
  city: string;
  memberCount: number;
  isMember: boolean;
  imageUrl?: string;
  activeMembers?: number;
  lastActivity?: string;
}

type FilterType = 'all' | 'joined' | 'popular';
type SortType = 'name' | 'members' | 'activity';

// Türkiye bölgeleri
const REGIONS = [
  { id: 'all', name: 'Tümü', icon: 'globe' },
  { id: 'marmara', name: 'Marmara', cities: ['İstanbul', 'Bursa', 'Kocaeli', 'Balıkesir', 'Tekirdağ', 'Edirne', 'Çanakkale', 'Sakarya', 'Kırklareli', 'Yalova', 'Bilecik'] },
  { id: 'ege', name: 'Ege', cities: ['İzmir', 'Aydın', 'Denizli', 'Manisa', 'Muğla', 'Afyonkarahisar', 'Kütahya', 'Uşak'] },
  { id: 'akdeniz', name: 'Akdeniz', cities: ['Antalya', 'Adana', 'Mersin', 'Hatay', 'Isparta', 'Kahramanmaraş', 'Osmaniye', 'Burdur'] },
  { id: 'ic_anadolu', name: 'İç Anadolu', cities: ['Ankara', 'Konya', 'Kayseri', 'Eskişehir', 'Sivas', 'Aksaray', 'Karaman', 'Kırıkkale', 'Kırşehir', 'Nevşehir', 'Niğde', 'Yozgat', 'Çankırı'] },
  { id: 'karadeniz', name: 'Karadeniz', cities: ['Samsun', 'Trabzon', 'Ordu', 'Zonguldak', 'Rize', 'Giresun', 'Kastamonu', 'Tokat', 'Çorum', 'Amasya', 'Sinop', 'Bartın', 'Karabük', 'Düzce', 'Bolu', 'Artvin', 'Gümüşhane', 'Bayburt'] },
  { id: 'dogu', name: 'Doğu Anadolu', cities: ['Erzurum', 'Malatya', 'Van', 'Elazığ', 'Ağrı', 'Erzincan', 'Kars', 'Bingöl', 'Muş', 'Bitlis', 'Hakkari', 'Tunceli', 'Iğdır', 'Ardahan'] },
  { id: 'guneydogu', name: 'Güneydoğu', cities: ['Gaziantep', 'Diyarbakır', 'Şanlıurfa', 'Mardin', 'Batman', 'Siirt', 'Şırnak', 'Kilis', 'Adıyaman'] },
];

export default function CommunitiesScreen() {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [filteredCommunities, setFilteredCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [activeRegion, setActiveRegion] = useState('all');
  const [sortBy, setSortBy] = useState<SortType>('members');
  const router = useRouter();

  const loadCommunities = useCallback(async () => {
    try {
      const response = await communityApi.getAll();
      setCommunities(response.data);
    } catch (error) {
      console.error('Error loading communities:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadCommunities();
  }, [loadCommunities]);

  useEffect(() => {
    let filtered = [...communities];

    // Arama filtresi
    if (searchQuery) {
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.city.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Üyelik filtresi
    if (activeFilter === 'joined') {
      filtered = filtered.filter((c) => c.isMember);
    } else if (activeFilter === 'popular') {
      filtered = filtered.filter((c) => c.memberCount >= 5);
    }

    // Bölge filtresi
    if (activeRegion !== 'all') {
      const region = REGIONS.find((r) => r.id === activeRegion);
      if (region && 'cities' in region) {
        filtered = filtered.filter((c) => region.cities.includes(c.city));
      }
    }

    // Sıralama
    filtered.sort((a, b) => {
      if (sortBy === 'members') return b.memberCount - a.memberCount;
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return 0;
    });

    setFilteredCommunities(filtered);
  }, [searchQuery, communities, activeFilter, activeRegion, sortBy]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadCommunities();
  }, [loadCommunities]);

  const joinedCount = communities.filter((c) => c.isMember).length;
  const popularCommunities = communities
    .sort((a, b) => b.memberCount - a.memberCount)
    .slice(0, 5);

  const renderCommunity = ({ item }: { item: Community }) => (
    <TouchableOpacity
      style={styles.communityCard}
      onPress={() => router.push(`/community/${item.id}`)}
      activeOpacity={0.7}
    >
      <LinearGradient
        colors={item.isMember ? ['#10b981', '#059669'] : ['#6366f1', '#4f46e5']}
        style={styles.communityIcon}
      >
        <Ionicons name="people" size={28} color="#fff" />
      </LinearGradient>
      <View style={styles.communityInfo}>
        <Text style={styles.communityName}>{item.name}</Text>
        <View style={styles.communityMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="location" size={14} color="#6b7280" />
            <Text style={styles.metaText}>{item.city}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="people" size={14} color="#6b7280" />
            <Text style={styles.metaText}>{item.memberCount} üye</Text>
          </View>
        </View>
      </View>
      <View style={styles.communityBadge}>
        {item.isMember ? (
          <View style={styles.memberBadge}>
            <Ionicons name="checkmark-circle" size={20} color="#10b981" />
          </View>
        ) : (
          <View style={styles.joinBadge}>
            <Ionicons name="add" size={20} color="#6366f1" />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderPopularCommunity = ({ item, index }: { item: Community; index: number }) => (
    <TouchableOpacity
      style={styles.popularCard}
      onPress={() => router.push(`/community/${item.id}`)}
      activeOpacity={0.7}
    >
      <View style={styles.popularRank}>
        <Text style={styles.rankText}>{index + 1}</Text>
      </View>
      <LinearGradient
        colors={['#f59e0b', '#d97706']}
        style={styles.popularIcon}
      >
        <Ionicons name="trophy" size={20} color="#fff" />
      </LinearGradient>
      <View style={styles.popularInfo}>
        <Text style={styles.popularName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.popularMembers}>{item.memberCount} üye</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>Topluluklar yükleniyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Topluluklar</Text>
          <Text style={styles.headerSubtitle}>
            {communities.length} topluluk • {joinedCount} üyelik
          </Text>
        </View>
        <TouchableOpacity 
          style={styles.searchButton}
          onPress={() => router.push('/search')}
        >
          <Ionicons name="search" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#6b7280" />
        <TextInput
          style={styles.searchInput}
          placeholder="Topluluk veya şehir ara..."
          placeholderTextColor="#6b7280"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#6b7280" />
          </TouchableOpacity>
        )}
      </View>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContent}
        >
          <TouchableOpacity
            style={[styles.filterChip, activeFilter === 'all' && styles.filterChipActive]}
            onPress={() => setActiveFilter('all')}
          >
            <Text style={[styles.filterText, activeFilter === 'all' && styles.filterTextActive]}>
              Tümü
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, activeFilter === 'joined' && styles.filterChipActive]}
            onPress={() => setActiveFilter('joined')}
          >
            <Ionicons 
              name="checkmark-circle" 
              size={16} 
              color={activeFilter === 'joined' ? '#fff' : '#6b7280'} 
            />
            <Text style={[styles.filterText, activeFilter === 'joined' && styles.filterTextActive]}>
              Üye Olduklarım ({joinedCount})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, activeFilter === 'popular' && styles.filterChipActive]}
            onPress={() => setActiveFilter('popular')}
          >
            <Ionicons 
              name="flame" 
              size={16} 
              color={activeFilter === 'popular' ? '#fff' : '#f59e0b'} 
            />
            <Text style={[styles.filterText, activeFilter === 'popular' && styles.filterTextActive]}>
              Popüler
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Region Filters */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.regionContainer}
        contentContainerStyle={styles.regionContent}
      >
        {REGIONS.map((region) => (
          <TouchableOpacity
            key={region.id}
            style={[styles.regionChip, activeRegion === region.id && styles.regionChipActive]}
            onPress={() => setActiveRegion(region.id)}
          >
            <Text style={[styles.regionText, activeRegion === region.id && styles.regionTextActive]}>
              {region.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={filteredCommunities}
        renderItem={renderCommunity}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />
        }
        ListHeaderComponent={
          activeFilter === 'all' && activeRegion === 'all' && !searchQuery ? (
            <View style={styles.recommendedSection}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <Ionicons name="trophy" size={20} color="#f59e0b" />
                  <Text style={styles.sectionTitle}>En Popüler</Text>
                </View>
                <TouchableOpacity onPress={() => setActiveFilter('popular')}>
                  <Text style={styles.seeAllText}>Tümünü Gör</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={popularCommunities}
                renderItem={renderPopularCommunity}
                keyExtractor={(item) => `popular-${item.id}`}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.popularList}
              />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={64} color="#374151" />
            <Text style={styles.emptyText}>Sonuç bulunamadı</Text>
            <Text style={styles.emptySubtext}>Farklı bir arama veya filtre deneyin</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#6b7280', fontSize: 14, marginTop: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  headerSubtitle: { fontSize: 14, color: '#6b7280', marginTop: 2 },
  searchButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1f2937', justifyContent: 'center', alignItems: 'center' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1f2937', marginHorizontal: 16, marginBottom: 12, borderRadius: 12, paddingHorizontal: 16, height: 48, gap: 12 },
  searchInput: { flex: 1, color: '#fff', fontSize: 16 },
  filtersContainer: { marginBottom: 8 },
  filtersContent: { paddingHorizontal: 16, gap: 8 },
  filterChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1f2937', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, gap: 6 },
  filterChipActive: { backgroundColor: '#6366f1' },
  filterText: { color: '#9ca3af', fontSize: 14, fontWeight: '500' },
  filterTextActive: { color: '#fff' },
  regionContainer: { marginBottom: 12 },
  regionContent: { paddingHorizontal: 16, gap: 8 },
  regionChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: '#111827', borderWidth: 1, borderColor: '#1f2937' },
  regionChipActive: { backgroundColor: 'rgba(99, 102, 241, 0.15)', borderColor: '#6366f1' },
  regionText: { color: '#6b7280', fontSize: 13, fontWeight: '500' },
  regionTextActive: { color: '#6366f1' },
  listContent: { paddingHorizontal: 16, paddingBottom: 16 },
  recommendedSection: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#fff' },
  seeAllText: { color: '#6366f1', fontSize: 14, fontWeight: '500' },
  popularList: { gap: 12 },
  popularCard: { width: 160, backgroundColor: '#111827', borderRadius: 16, padding: 14, position: 'relative' },
  popularRank: { position: 'absolute', top: -8, left: -8, width: 28, height: 28, borderRadius: 14, backgroundColor: '#f59e0b', justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  rankText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  popularIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  popularInfo: { },
  popularName: { color: '#fff', fontSize: 14, fontWeight: '600' },
  popularMembers: { color: '#6b7280', fontSize: 12, marginTop: 4 },
  communityCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111827', borderRadius: 16, padding: 16, marginBottom: 12 },
  communityIcon: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  communityInfo: { flex: 1, marginLeft: 14 },
  communityName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  communityMeta: { flexDirection: 'row', marginTop: 6, gap: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: '#6b7280', fontSize: 13 },
  communityBadge: { marginLeft: 8 },
  memberBadge: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(16, 185, 129, 0.15)', justifyContent: 'center', alignItems: 'center' },
  joinBadge: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(99, 102, 241, 0.15)', justifyContent: 'center', alignItems: 'center' },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64 },
  emptyText: { color: '#9ca3af', fontSize: 16, marginTop: 16 },
  emptySubtext: { color: '#6b7280', fontSize: 14, marginTop: 4 },
});
