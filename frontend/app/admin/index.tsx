import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import api from '../../src/services/api';

interface DashboardStats {
  totalUsers: number;
  totalCommunities: number;
  totalSubgroups: number;
  totalMessages: number;
  totalPosts: number;
  totalServices: number;
  newUsersThisWeek: number;
  bannedUsers: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { userProfile } = useAuth();
  const router = useRouter();

  const loadDashboard = useCallback(async () => {
    try {
      const response = await api.get('/admin/dashboard');
      setStats(response.data.stats);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadDashboard();
  }, [loadDashboard]);

  if (!userProfile?.isAdmin) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.accessDenied}>
          <Ionicons name="lock-closed" size={64} color="#ef4444" />
          <Text style={styles.accessDeniedText}>Erişim Reddedildi</Text>
          <Text style={styles.accessDeniedSubtext}>Bu sayfaya erişim yetkiniz yok</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Geri Dön</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  const menuItems = [
    {
      icon: 'people',
      title: 'Üye Yönetimi',
      subtitle: 'Kullanıcıları yönet, yasakla, kısıtla',
      route: '/admin/users',
      color: '#6366f1',
    },
    {
      icon: 'business',
      title: 'Topluluk Yönetimi',
      subtitle: '81 il topluluğunu yönet',
      route: '/admin/communities',
      color: '#10b981',
    },
    {
      icon: 'chatbubbles',
      title: 'İçerik Yönetimi',
      subtitle: 'Mesajları sil, sabitle',
      route: '/admin/content',
      color: '#f59e0b',
    },
    {
      icon: 'shield-checkmark',
      title: 'Yönetici Yönetimi',
      subtitle: 'Yönetici ata, yetki ver',
      route: '/admin/admins',
      color: '#ef4444',
    },
    {
      icon: 'flag',
      title: 'Raporlar',
      subtitle: 'Kullanıcı ve içerik raporları',
      route: '/admin/reports',
      color: '#8b5cf6',
    },
    {
      icon: 'shield',
      title: 'Güvenlik Logları',
      subtitle: 'Şüpheli aktiviteleri izle',
      route: '/admin/security',
      color: '#ec4899',
    },
    {
      icon: 'globe',
      title: 'Web Sitesi',
      subtitle: 'networksolution.com.tr',
      route: 'https://networksolution.com.tr/',
      color: '#14b8a6',
      external: true,
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBackButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Yönetici Paneli</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />
        }
      >
        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Ionicons name="people" size={28} color="#6366f1" />
            <Text style={styles.statNumber}>{stats?.totalUsers || 0}</Text>
            <Text style={styles.statLabel}>Toplam Üye</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="business" size={28} color="#10b981" />
            <Text style={styles.statNumber}>{stats?.totalCommunities || 0}</Text>
            <Text style={styles.statLabel}>Topluluk</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="chatbubbles" size={28} color="#f59e0b" />
            <Text style={styles.statNumber}>{stats?.totalMessages || 0}</Text>
            <Text style={styles.statLabel}>Mesaj</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="document-text" size={28} color="#8b5cf6" />
            <Text style={styles.statNumber}>{stats?.totalPosts || 0}</Text>
            <Text style={styles.statLabel}>Gönderi</Text>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.quickStats}>
          <View style={styles.quickStatItem}>
            <View style={styles.quickStatIcon}>
              <Ionicons name="person-add" size={20} color="#10b981" />
            </View>
            <View>
              <Text style={styles.quickStatNumber}>{stats?.newUsersThisWeek || 0}</Text>
              <Text style={styles.quickStatLabel}>Bu hafta yeni üye</Text>
            </View>
          </View>
          <View style={styles.quickStatItem}>
            <View style={[styles.quickStatIcon, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
              <Ionicons name="ban" size={20} color="#ef4444" />
            </View>
            <View>
              <Text style={styles.quickStatNumber}>{stats?.bannedUsers || 0}</Text>
              <Text style={styles.quickStatLabel}>Yasaklı üye</Text>
            </View>
          </View>
        </View>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Yönetim Araçları</Text>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.menuCard}
              onPress={() => router.push(item.route as any)}
            >
              <View style={[styles.menuIcon, { backgroundColor: `${item.color}15` }]}>
                <Ionicons name={item.icon as any} size={24} color={item.color} />
              </View>
              <View style={styles.menuInfo}>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color="#6b7280" />
            </TouchableOpacity>
          ))}
        </View>
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
  accessDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  accessDeniedText: {
    color: '#ef4444',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
  },
  accessDeniedSubtext: {
    color: '#6b7280',
    fontSize: 14,
    marginTop: 8,
  },
  backButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  headerBackButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 12,
  },
  statCard: {
    width: '47%',
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 4,
  },
  quickStats: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 16,
  },
  quickStatItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  quickStatIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickStatNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  quickStatLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  menuSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9ca3af',
    marginBottom: 12,
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  menuIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuInfo: {
    flex: 1,
    marginLeft: 16,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  menuSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
});
