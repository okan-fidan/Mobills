import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';

export default function ProfileScreen() {
  const { userProfile, signOut } = useAuth();
  const router = useRouter();

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

  const menuItems = [
    {
      icon: 'person-outline',
      label: 'Profili Düzenle',
      onPress: () => router.push('/profile/edit'),
    },
    {
      icon: 'document-text-outline',
      label: 'Gönderilerim',
      onPress: () => router.push('/profile/my-posts'),
    },
    {
      icon: 'briefcase-outline',
      label: 'Hizmetlerim',
      onPress: () => router.push('/profile/my-services'),
    },
    {
      icon: 'notifications-outline',
      label: 'Bildirim Ayarları',
      onPress: () => {},
    },
    {
      icon: 'shield-checkmark-outline',
      label: 'Gizlilik',
      onPress: () => {},
    },
    {
      icon: 'help-circle-outline',
      label: 'Yardım',
      onPress: () => {},
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            {userProfile?.profileImageUrl ? (
              <Image source={{ uri: userProfile.profileImageUrl }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person" size={48} color="#9ca3af" />
            )}
          </View>
          <Text style={styles.name}>
            {userProfile?.firstName} {userProfile?.lastName}
          </Text>
          <Text style={styles.email}>{userProfile?.email}</Text>
          
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Ionicons name="location-outline" size={18} color="#6366f1" />
              <Text style={styles.infoText}>{userProfile?.city || 'Belirtilmemiş'}</Text>
            </View>
            {userProfile?.occupation && (
              <View style={styles.infoItem}>
                <Ionicons name="briefcase-outline" size={18} color="#6366f1" />
                <Text style={styles.infoText}>{userProfile.occupation}</Text>
              </View>
            )}
          </View>

          {userProfile?.isAdmin && (
            <TouchableOpacity 
              style={styles.adminBadge}
              onPress={() => router.push('/admin')}
            >
              <Ionicons name="shield-checkmark" size={16} color="#10b981" />
              <Text style={styles.adminText}>Yönetici Paneli</Text>
              <Ionicons name="chevron-forward" size={14} color="#10b981" />
            </TouchableOpacity>
          )}
        </View>

        {/* Admin Panel Button */}
        {userProfile?.isAdmin && (
          <TouchableOpacity 
            style={styles.adminPanelButton}
            onPress={() => router.push('/admin')}
          >
            <View style={styles.adminPanelIcon}>
              <Ionicons name="settings" size={24} color="#6366f1" />
            </View>
            <View style={styles.adminPanelInfo}>
              <Text style={styles.adminPanelTitle}>Yönetici Paneli</Text>
              <Text style={styles.adminPanelSubtitle}>Üye, topluluk ve içerik yönetimi</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#6b7280" />
          </TouchableOpacity>
        )}

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{userProfile?.communities?.length || 0}</Text>
            <Text style={styles.statLabel}>Topluluk</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Gönderi</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Bağlantı</Text>
          </View>
        </View>

        {/* Menu */}
        <View style={styles.menuContainer}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.menuItem}
              onPress={item.onPress}
            >
              <View style={styles.menuItemLeft}>
                <Ionicons name={item.icon as any} size={22} color="#9ca3af" />
                <Text style={styles.menuItemText}>{item.label}</Text>
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

        <Text style={styles.version}>Versiyon 1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#1f2937',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 16,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  email: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
  },
  infoRow: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 24,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 16,
    gap: 6,
  },
  adminText: {
    color: '#10b981',
    fontSize: 13,
    fontWeight: '500',
  },
  adminPanelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  adminPanelIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  adminPanelInfo: {
    flex: 1,
    marginLeft: 12,
  },
  adminPanelTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  adminPanelSubtitle: {
    color: '#6b7280',
    fontSize: 13,
    marginTop: 2,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#111827',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  statLabel: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#374151',
  },
  menuContainer: {
    backgroundColor: '#111827',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuItemText: {
    color: '#fff',
    fontSize: 16,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    marginHorizontal: 16,
    marginTop: 24,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  signOutText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
  },
  version: {
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 12,
    marginTop: 24,
    marginBottom: 32,
  },
});
