import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import api from '../../src/services/api';
import { useAuth } from '../../src/contexts/AuthContext';

interface Report {
  id: string;
  type: string;
  contentType?: string;
  reporterId: string;
  reportedId?: string;
  contentId?: string;
  reason: string;
  details: string;
  status: string;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Bekliyor', color: '#f59e0b' },
  reviewing: { label: 'İnceleniyor', color: '#3b82f6' },
  resolved: { label: 'Çözüldü', color: '#10b981' },
  dismissed: { label: 'Reddedildi', color: '#6b7280' },
};

const REASON_LABELS: Record<string, string> = {
  spam: 'Spam veya Reklam',
  harassment: 'Taciz veya Zorbalık',
  fake: 'Sahte Hesap',
  inappropriate: 'Uygunsuz İçerik',
  scam: 'Dolandırıcılık',
  violence: 'Şiddet İçerikli',
  hate: 'Nefret Söylemi',
  misinformation: 'Yanlış Bilgi',
  copyright: 'Telif Hakkı İhlali',
  other: 'Diğer',
};

export default function AdminReportsScreen() {
  const router = useRouter();
  const { userProfile } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  const loadReports = useCallback(async () => {
    try {
      const response = await api.get(`/api/security/reports?status=${filter}`);
      setReports(response.data || []);
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadReports();
  }, [loadReports]);

  const handleUpdateStatus = async (reportId: string, newStatus: string) => {
    try {
      await api.put(`/security/reports/${reportId}`, { status: newStatus });
      setReports(reports.map(r => r.id === reportId ? { ...r, status: newStatus } : r));
      Alert.alert('Başarılı', 'Rapor durumu güncellendi');
    } catch (error) {
      Alert.alert('Hata', 'Durum güncellenemedi');
    }
  };

  const showStatusOptions = (report: Report) => {
    Alert.alert(
      'Durumu Değiştir',
      `Rapor: ${REASON_LABELS[report.reason] || report.reason}`,
      [
        { text: 'İnceleniyor', onPress: () => handleUpdateStatus(report.id, 'reviewing') },
        { text: 'Çözüldü', onPress: () => handleUpdateStatus(report.id, 'resolved') },
        { text: 'Reddet', onPress: () => handleUpdateStatus(report.id, 'dismissed') },
        { text: 'İptal', style: 'cancel' },
      ]
    );
  };

  const formatTime = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true, locale: tr });
    } catch { return ''; }
  };

  if (!userProfile?.isAdmin) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.accessDenied}>
          <Ionicons name="lock-closed" size={64} color="#ef4444" />
          <Text style={styles.accessDeniedText}>Erişim Reddedildi</Text>
        </View>
      </SafeAreaView>
    );
  }

  const renderReport = ({ item }: { item: Report }) => {
    const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
    
    return (
      <TouchableOpacity style={styles.reportCard} onPress={() => showStatusOptions(item)}>
        <View style={styles.reportHeader}>
          <View style={[styles.typeBadge, { backgroundColor: item.type === 'user' ? '#6366f120' : '#f59e0b20' }]}>
            <Ionicons 
              name={item.type === 'user' ? 'person' : 'document-text'} 
              size={16} 
              color={item.type === 'user' ? '#6366f1' : '#f59e0b'} 
            />
            <Text style={[styles.typeText, { color: item.type === 'user' ? '#6366f1' : '#f59e0b' }]}>
              {item.type === 'user' ? 'Kullanıcı' : item.contentType || 'İçerik'}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + '20' }]}>
            <Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
          </View>
        </View>
        
        <Text style={styles.reasonText}>{REASON_LABELS[item.reason] || item.reason}</Text>
        {item.details && <Text style={styles.detailsText} numberOfLines={2}>{item.details}</Text>}
        
        <View style={styles.reportFooter}>
          <Text style={styles.timeText}>{formatTime(item.createdAt)}</Text>
          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionText}>İşlem Yap</Text>
            <Ionicons name="chevron-forward" size={16} color="#6366f1" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#6366f1" /></View>;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Raporlar</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.filterContainer}>
        {['all', 'pending', 'reviewing', 'resolved'].map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterButton, filter === f && styles.filterButtonActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? 'Tümü' : STATUS_CONFIG[f]?.label || f}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={reports}
        renderItem={renderReport}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#6366f1" />}
        contentContainerStyle={reports.length === 0 ? styles.emptyContainer : styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="flag-outline" size={64} color="#374151" />
            <Text style={styles.emptyText}>Rapor bulunamadı</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  loadingContainer: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' },
  accessDenied: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  accessDeniedText: { color: '#ef4444', fontSize: 18, marginTop: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1f2937' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '600' },
  filterContainer: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  filterButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#1f2937' },
  filterButtonActive: { backgroundColor: '#6366f1' },
  filterText: { color: '#9ca3af', fontSize: 14 },
  filterTextActive: { color: '#fff' },
  listContent: { padding: 16 },
  reportCard: { backgroundColor: '#111827', borderRadius: 12, padding: 16, marginBottom: 12 },
  reportHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  typeBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 6 },
  typeText: { fontSize: 12, fontWeight: '500' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: '500' },
  reasonText: { color: '#fff', fontSize: 16, fontWeight: '500', marginBottom: 6 },
  detailsText: { color: '#9ca3af', fontSize: 14, lineHeight: 20 },
  reportFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#1f2937' },
  timeText: { color: '#6b7280', fontSize: 12 },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { color: '#6366f1', fontSize: 14 },
  emptyContainer: { flex: 1, justifyContent: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: '#6b7280', fontSize: 16, marginTop: 16 },
});
