import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../src/services/api';

interface Service {
  id: string;
  title: string;
  description: string;
  category: string;
  price?: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  consulting: 'Danışmanlık',
  marketing: 'Pazarlama',
  design: 'Tasarım',
  development: 'Yazılım',
  finance: 'Finans',
  legal: 'Hukuk',
  other: 'Diğer',
};

export default function MyServicesScreen() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const loadServices = useCallback(async () => {
    try {
      const response = await api.get('/my-services');
      setServices(response.data);
    } catch (error) {
      console.error('Error loading services:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadServices();
  }, [loadServices]);

  const handleDelete = async (serviceId: string) => {
    Alert.alert(
      'Hizmeti Sil',
      'Bu hizmeti silmek istediğinize emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/services/${serviceId}`);
              setServices(services.filter(s => s.id !== serviceId));
            } catch (error) {
              Alert.alert('Hata', 'Hizmet silinemedi');
            }
          },
        },
      ]
    );
  };

  const renderService = ({ item }: { item: Service }) => (
    <View style={styles.serviceCard}>
      <View style={styles.serviceHeader}>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>{CATEGORY_LABELS[item.category] || item.category}</Text>
        </View>
        <TouchableOpacity onPress={() => handleDelete(item.id)}>
          <Ionicons name="trash-outline" size={20} color="#ef4444" />
        </TouchableOpacity>
      </View>
      <Text style={styles.serviceTitle}>{item.title}</Text>
      <Text style={styles.serviceDescription} numberOfLines={2}>{item.description}</Text>
      {item.price && (
        <View style={styles.priceRow}>
          <Ionicons name="pricetag" size={16} color="#10b981" />
          <Text style={styles.priceText}>{item.price} ₺</Text>
        </View>
      )}
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
        <Text style={styles.headerTitle}>Hizmetlerim</Text>
        <TouchableOpacity onPress={() => router.push('/service/create')}>
          <Ionicons name="add-circle" size={28} color="#10b981" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={services}
        renderItem={renderService}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="briefcase-outline" size={64} color="#374151" />
            <Text style={styles.emptyText}>Henüz hizmet eklemediniz</Text>
            <TouchableOpacity style={styles.emptyButton} onPress={() => router.push('/service/create')}>
              <Text style={styles.emptyButtonText}>İlk Hizmeti Ekle</Text>
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
  serviceCard: { backgroundColor: '#111827', borderRadius: 16, padding: 16, marginBottom: 12 },
  serviceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  categoryBadge: { backgroundColor: 'rgba(99, 102, 241, 0.15)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  categoryText: { color: '#6366f1', fontSize: 12, fontWeight: '600' },
  serviceTitle: { color: '#fff', fontSize: 17, fontWeight: '600', marginBottom: 6 },
  serviceDescription: { color: '#9ca3af', fontSize: 14, lineHeight: 20 },
  priceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 6 },
  priceText: { color: '#10b981', fontSize: 16, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingVertical: 64 },
  emptyText: { color: '#6b7280', fontSize: 16, marginTop: 16 },
  emptyButton: { backgroundColor: '#10b981', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24, marginTop: 20 },
  emptyButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
