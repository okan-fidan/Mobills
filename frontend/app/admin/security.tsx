import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import api from '../../src/services/api';
import { useAuth } from '../../src/contexts/AuthContext';

interface SuspiciousActivity {
  totalSuspicious: number;
  byUser: Record<string, { count: number; events: string[] }>;
  recentLogs: SecurityLog[];
}

interface SecurityLog {
  id: string;
  userId: string;
  eventType: string;
  metadata: any;
  timestamp: string;
  ip?: string;
}

const EVENT_CONFIG: Record<string, { label: string; icon: string; color: string; severity: string }> = {
  '2fa_verify_failed': { label: '2FA Doğrulama Başarısız', icon: 'shield', color: '#ef4444', severity: 'high' },
  '2fa_login_failed': { label: '2FA Giriş Başarısız', icon: 'log-in', color: '#ef4444', severity: 'high' },
  'login_failed': { label: 'Giriş Başarısız', icon: 'log-in-outline', color: '#f59e0b', severity: 'medium' },
  'rate_limit_exceeded': { label: 'Rate Limit Aşıldı', icon: 'warning', color: '#ef4444', severity: 'high' },
  'unauthorized_access': { label: 'Yetkisiz Erişim', icon: 'alert-circle', color: '#ef4444', severity: 'critical' },
};

export default function AdminSecurityScreen() {
  const router = useRouter();
  const { userProfile } = useAuth();
  const [data, setData] = useState<SuspiciousActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const response = await api.get('/api/security/logs/suspicious');
      setData(response.data);
    } catch (error) {
      console.error('Error loading security data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const formatTime = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true, locale: tr });
    } catch { return ''; }
  };

  const getEventConfig = (eventType: string) => {
    return EVENT_CONFIG[eventType] || { 
      label: eventType.replace(/_/g, ' '), 
      icon: 'information-circle', 
      color: '#6b7280',
      severity: 'low'
    };
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

  if (loading) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#6366f1" /></View>;
  }

  const suspiciousUsers = Object.entries(data?.byUser || {})
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Güvenlik İzleme</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={[{ type: 'content' }]}
        renderItem={() => (
          <View style={styles.content}>
            {/* Summary Card */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryIcon}>
                <Ionicons name="shield-checkmark" size={32} color="#fff" />
              </View>
              <View style={styles.summaryInfo}>
                <Text style={styles.summaryNumber}>{data?.totalSuspicious || 0}</Text>
                <Text style={styles.summaryLabel}>Son 24 saatte şüpheli aktivite</Text>
              </View>
            </View>

            {/* Suspicious Users */}
            {suspiciousUsers.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  <Ionicons name="warning" size={18} color="#f59e0b" /> Şüpheli Kullanıcılar
                </Text>
                {suspiciousUsers.map(([userId, info]) => (
                  <TouchableOpacity 
                    key={userId} 
                    style={styles.userCard}
                    onPress={() => router.push(`/user/${userId}`)}
                  >
                    <View style={styles.userIcon}>
                      <Ionicons name="person" size={20} color="#ef4444" />
                    </View>
                    <View style={styles.userInfo}>
                      <Text style={styles.userId} numberOfLines={1}>{userId}</Text>
                      <Text style={styles.userEvents}>
                        {info.events.slice(0, 3).map(e => getEventConfig(e).label).join(', ')}
                      </Text>
                    </View>
                    <View style={styles.countBadge}>
                      <Text style={styles.countText}>{info.count}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Recent Logs */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                <Ionicons name="time" size={18} color="#6366f1" /> Son Aktiviteler
              </Text>
              {(data?.recentLogs || []).slice(0, 20).map((log) => {
                const config = getEventConfig(log.eventType);
                return (
                  <View key={log.id} style={styles.logCard}>
                    <View style={[styles.logIcon, { backgroundColor: config.color + '20' }]}>
                      <Ionicons name={config.icon as any} size={18} color={config.color} />
                    </View>
                    <View style={styles.logInfo}>
                      <Text style={styles.logTitle}>{config.label}</Text>
                      <Text style={styles.logMeta}>
                        {log.userId?.slice(0, 20)}... • {formatTime(log.timestamp)}
                      </Text>
                      {log.ip && <Text style={styles.logIp}>IP: {log.ip}</Text>}
                    </View>
                    <View style={[styles.severityBadge, { backgroundColor: config.color + '20' }]}>
                      <Text style={[styles.severityText, { color: config.color }]}>
                        {config.severity === 'critical' ? '!' : config.severity === 'high' ? '!!' : '•'}
                      </Text>
                    </View>
                  </View>
                );
              })}
              
              {(!data?.recentLogs || data.recentLogs.length === 0) && (
                <View style={styles.emptyState}>
                  <Ionicons name="checkmark-circle" size={48} color="#10b981" />
                  <Text style={styles.emptyText}>Son 24 saatte şüpheli aktivite yok</Text>
                </View>
              )}
            </View>
          </View>
        )}
        keyExtractor={() => 'content'}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#6366f1" />}
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
  content: { padding: 16 },
  summaryCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ef4444', borderRadius: 16, padding: 20, marginBottom: 24 },
  summaryIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  summaryInfo: { flex: 1 },
  summaryNumber: { color: '#fff', fontSize: 36, fontWeight: 'bold' },
  summaryLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 4 },
  section: { marginBottom: 24 },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 12 },
  userCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1f2937', borderRadius: 12, padding: 14, marginBottom: 8 },
  userIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(239, 68, 68, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  userInfo: { flex: 1 },
  userId: { color: '#fff', fontSize: 14, fontWeight: '500' },
  userEvents: { color: '#6b7280', fontSize: 12, marginTop: 2 },
  countBadge: { backgroundColor: '#ef4444', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  countText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  logCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111827', borderRadius: 12, padding: 14, marginBottom: 8 },
  logIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  logInfo: { flex: 1 },
  logTitle: { color: '#fff', fontSize: 14, fontWeight: '500' },
  logMeta: { color: '#6b7280', fontSize: 12, marginTop: 2 },
  logIp: { color: '#4b5563', fontSize: 11, marginTop: 2 },
  severityBadge: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  severityText: { fontSize: 14, fontWeight: 'bold' },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { color: '#10b981', fontSize: 15, marginTop: 12 },
});
