import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../src/contexts/AuthContext';
import api from '../../src/services/api';

export default function ProfileScreen() {
  const { userProfile, signOut, refreshProfile } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState({ posts: 0, connections: 0, communities: 0 });
  const [loading, setLoading] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [postsRes, communitiesRes] = await Promise.all([
        api.get('/my-posts'),
        api.get('/communities'),
      ]);
      
      const myCommunities = communitiesRes.data.filter((c: any) => c.isMember);
      
      setStats({
        posts: postsRes.data?.length || 0,
        connections: 0,
        communities: myCommunities.length,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChangeProfileImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('İzin Gerekli', 'Fotoğraf seçmek için galeri izni gerekiyor.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setUploadingImage(true);
      try {
        // Upload image - this would need a proper upload endpoint
        const formData = new FormData();
        formData.append('image', {
          uri: result.assets[0].uri,
          type: 'image/jpeg',
          name: 'profile.jpg',
        } as any);
        
        await api.put('/user/profile-image', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        
        // Refresh profile to get new image
        if (refreshProfile) await refreshProfile();
        Alert.alert('Başarılı', 'Profil fotoğrafı güncellendi');
      } catch (error) {
        console.error('Error uploading image:', error);
        Alert.alert('Hata', 'Fotoğraf yüklenemedi');
      } finally {
        setUploadingImage(false);
      }
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Çıkış Yap',
      'Hesabınızdan çıkmak istediğinize emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Çıkış Yap',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  const quickActions = [
    {
      icon: 'create-outline',
      label: 'Gönderi Paylaş',
      color: '#6366f1',
      onPress: () => router.push('/post/create'),
    },
    {
      icon: 'briefcase-outline',
      label: 'Hizmet Ekle',
      color: '#10b981',
      onPress: () => router.push('/service/create'),
    },
    {
      icon: 'people-outline',
      label: 'Topluluklar',
      color: '#f59e0b',
      onPress: () => router.push('/(tabs)/communities'),
    },
  ];

  const menuItems = [
    {
      icon: 'person-outline',
      label: 'Profili Düzenle',
      subtitle: 'Bilgilerinizi güncelleyin',
      onPress: () => router.push('/profile/edit'),
      color: '#6366f1',
    },
    {
      icon: 'document-text-outline',
      label: 'Gönderilerim',
      subtitle: `${stats.posts} gönderi`,
      onPress: () => router.push('/profile/my-posts'),
      color: '#3b82f6',
    },
    {
      icon: 'briefcase-outline',
      label: 'Hizmetlerim',
      subtitle: 'Sunduğunuz hizmetler',
      onPress: () => router.push('/profile/my-services'),
      color: '#10b981',
    },
    {
      icon: 'notifications-outline',
      label: 'Bildirimler',
      subtitle: 'Tüm bildirimleriniz',
      onPress: () => router.push('/all-notifications'),
      color: '#f59e0b',
    },
    {
      icon: 'shield-checkmark-outline',
      label: 'Gizlilik ve Güvenlik',
      subtitle: 'Hesap güvenliği',
      onPress: () => router.push('/privacy-security'),
      color: '#8b5cf6',
    },
    {
      icon: 'help-circle-outline',
      label: 'Yardım ve Destek',
      subtitle: 'SSS ve iletişim',
      onPress: () => router.push('/help'),
      color: '#ec4899',
    },
    {
      icon: 'information-circle-outline',
      label: 'Hakkımızda',
      subtitle: 'Uygulama bilgileri',
      onPress: () => router.push('/about'),
      color: '#3b82f6',
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header with Gradient */}
        <LinearGradient
          colors={['#1e1b4b', '#312e81', '#4338ca']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            {/* Avatar */}
            <View style={styles.avatarContainer}>
              <View style={styles.avatar}>
                {userProfile?.profileImageUrl ? (
                  <Image source={{ uri: userProfile.profileImageUrl }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarText}>
                    {userProfile?.firstName?.[0]}{userProfile?.lastName?.[0]}
                  </Text>
                )}
              </View>
              <TouchableOpacity style={styles.editAvatarButton} onPress={handleChangeProfileImage} disabled={uploadingImage}>
                {uploadingImage ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="camera" size={16} color="#fff" />
                )}
              </TouchableOpacity>
            </View>

            {/* User Info */}
            <Text style={styles.name}>
              {userProfile?.firstName} {userProfile?.lastName}
            </Text>
            <Text style={styles.email}>{userProfile?.email}</Text>
            
            <View style={styles.badgeRow}>
              {userProfile?.city && (
                <View style={styles.badge}>
                  <Ionicons name="location" size={14} color="#a5b4fc" />
                  <Text style={styles.badgeText}>{userProfile.city}</Text>
                </View>
              )}
              {userProfile?.occupation && (
                <View style={styles.badge}>
                  <Ionicons name="briefcase" size={14} color="#a5b4fc" />
                  <Text style={styles.badgeText}>{userProfile.occupation}</Text>
                </View>
              )}
            </View>

            {/* Admin Badge */}
            {userProfile?.isAdmin && (
              <TouchableOpacity 
                style={styles.adminBadge}
                onPress={() => router.push('/admin')}
              >
                <View style={styles.adminBadgeInner}>
                  <Ionicons name="shield-checkmark" size={18} color="#fbbf24" />
                  <Text style={styles.adminBadgeText}>Yönetici</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        </LinearGradient>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <TouchableOpacity style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: 'rgba(99, 102, 241, 0.1)' }]}>
              <Ionicons name="people" size={24} color="#6366f1" />
            </View>
            <Text style={styles.statNumber}>{stats.communities}</Text>
            <Text style={styles.statLabel}>Topluluk</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
              <Ionicons name="document-text" size={24} color="#10b981" />
            </View>
            <Text style={styles.statNumber}>{stats.posts}</Text>
            <Text style={styles.statLabel}>Gönderi</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
              <Ionicons name="link" size={24} color="#f59e0b" />
            </View>
            <Text style={styles.statNumber}>{stats.connections}</Text>
            <Text style={styles.statLabel}>Bağlantı</Text>
          </TouchableOpacity>
        </View>

        {/* Admin Panel Button */}
        {userProfile?.isAdmin && (
          <TouchableOpacity 
            style={styles.adminPanelButton}
            onPress={() => router.push('/admin')}
          >
            <LinearGradient
              colors={['#4338ca', '#6366f1']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.adminPanelGradient}
            >
              <View style={styles.adminPanelIcon}>
                <Ionicons name="settings" size={28} color="#fff" />
              </View>
              <View style={styles.adminPanelInfo}>
                <Text style={styles.adminPanelTitle}>Yönetici Paneli</Text>
                <Text style={styles.adminPanelSubtitle}>Üye, topluluk ve içerik yönetimi</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Quick Actions */}
        <View style={styles.quickActionsContainer}>
          <Text style={styles.sectionTitle}>Hızlı İşlemler</Text>
          <View style={styles.quickActionsRow}>
            {quickActions.map((action, index) => (
              <TouchableOpacity
                key={index}
                style={styles.quickActionItem}
                onPress={action.onPress}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: `${action.color}20` }]}>
                  <Ionicons name={action.icon as any} size={24} color={action.color} />
                </View>
                <Text style={styles.quickActionLabel}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Menu */}
        <View style={styles.menuContainer}>
          <Text style={styles.sectionTitle}>Hesap Ayarları</Text>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.menuItem}
              onPress={item.onPress}
            >
              <View style={[styles.menuItemIcon, { backgroundColor: `${item.color}15` }]}>
                <Ionicons name={item.icon as any} size={22} color={item.color} />
              </View>
              <View style={styles.menuItemContent}>
                <Text style={styles.menuItemText}>{item.label}</Text>
                <Text style={styles.menuItemSubtext}>{item.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#6b7280" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={22} color="#ef4444" />
          <Text style={styles.signOutText}>Çıkış Yap</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.version}>Network Solution v1.0.0</Text>
          <Text style={styles.copyright}>© 2025 Tüm hakları saklıdır</Text>
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
  headerGradient: {
    paddingTop: 20,
    paddingBottom: 40,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerContent: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#4338ca',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#1e1b4b',
  },
  name: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#fff',
  },
  email: {
    fontSize: 14,
    color: '#a5b4fc',
    marginTop: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 12,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  badgeText: {
    color: '#e0e7ff',
    fontSize: 13,
  },
  adminBadge: {
    marginTop: 16,
  },
  adminBadgeInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
    gap: 6,
  },
  adminBadgeText: {
    color: '#fbbf24',
    fontSize: 14,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: -24,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  statLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  adminPanelButton: {
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  adminPanelGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  adminPanelIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  adminPanelInfo: {
    flex: 1,
    marginLeft: 14,
  },
  adminPanelTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  adminPanelSubtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
    marginTop: 2,
  },
  quickActionsContainer: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  quickActionItem: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  quickActionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  quickActionLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  menuContainer: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  menuItemIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItemContent: {
    flex: 1,
    marginLeft: 14,
  },
  menuItemText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  menuItemSubtext: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 2,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    marginHorizontal: 16,
    marginTop: 24,
    borderRadius: 14,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  signOutText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  version: {
    color: '#6b7280',
    fontSize: 13,
  },
  copyright: {
    color: '#4b5563',
    fontSize: 11,
    marginTop: 4,
  },
});
