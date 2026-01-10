import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { userListApi, postApi } from '../../src/services/api';
import { useAuth } from '../../src/contexts/AuthContext';

interface UserProfile {
  uid: string;
  firstName: string;
  lastName: string;
  email: string;
  city?: string;
  occupation?: string;
  profileImageUrl?: string;
  isAdmin?: boolean;
  communities?: string[];
}

export default function UserProfileScreen() {
  const { id: userId } = useLocalSearchParams<{ id: string }>();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [postCount, setPostCount] = useState(0);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    loadProfile();
  }, [userId]);

  const loadProfile = async () => {
    if (!userId) return;
    try {
      const response = await userListApi.getOne(userId);
      setProfile(response.data);
      
      // Gönderi sayısını al
      try {
        const postsRes = await postApi.getAll();
        const userPosts = postsRes.data.filter((p: any) => p.userId === userId);
        setPostCount(userPosts.length);
      } catch (e) {}
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert('Hata', 'Profil yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleMessage = () => {
    if (userId === user?.uid) {
      Alert.alert('Bilgi', 'Kendinize mesaj gönderemezsiniz');
      return;
    }
    router.push(`/chat/${userId}`);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="person-outline" size={64} color="#6b7280" />
        <Text style={styles.errorText}>Kullanıcı bulunamadı</Text>
      </View>
    );
  }

  const isOwnProfile = userId === user?.uid;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient
          colors={['#1e1b4b', '#312e81', '#4338ca']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>

          <View style={styles.headerContent}>
            <View style={styles.avatarContainer}>
              <View style={styles.avatar}>
                {profile.profileImageUrl ? (
                  <Image source={{ uri: profile.profileImageUrl }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarText}>
                    {profile.firstName?.[0]}{profile.lastName?.[0]}
                  </Text>
                )}
              </View>
            </View>

            <Text style={styles.name}>{profile.firstName} {profile.lastName}</Text>
            
            <View style={styles.badgeRow}>
              {profile.city && (
                <View style={styles.badge}>
                  <Ionicons name="location" size={14} color="#a5b4fc" />
                  <Text style={styles.badgeText}>{profile.city}</Text>
                </View>
              )}
              {profile.occupation && (
                <View style={styles.badge}>
                  <Ionicons name="briefcase" size={14} color="#a5b4fc" />
                  <Text style={styles.badgeText}>{profile.occupation}</Text>
                </View>
              )}
            </View>

            {profile.isAdmin && (
              <View style={styles.adminBadge}>
                <Ionicons name="shield-checkmark" size={16} color="#fbbf24" />
                <Text style={styles.adminText}>Yönetici</Text>
              </View>
            )}
          </View>
        </LinearGradient>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: 'rgba(99, 102, 241, 0.1)' }]}>
              <Ionicons name="people" size={24} color="#6366f1" />
            </View>
            <Text style={styles.statNumber}>{profile.communities?.length || 0}</Text>
            <Text style={styles.statLabel}>Topluluk</Text>
          </View>
          
          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
              <Ionicons name="document-text" size={24} color="#10b981" />
            </View>
            <Text style={styles.statNumber}>{postCount}</Text>
            <Text style={styles.statLabel}>Gönderi</Text>
          </View>
          
          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
              <Ionicons name="star" size={24} color="#f59e0b" />
            </View>
            <Text style={styles.statNumber}>-</Text>
            <Text style={styles.statLabel}>Puan</Text>
          </View>
        </View>

        {/* Action Buttons */}
        {!isOwnProfile && (
          <View style={styles.actionsContainer}>
            <TouchableOpacity style={styles.messageButton} onPress={handleMessage}>
              <Ionicons name="chatbubble" size={20} color="#fff" />
              <Text style={styles.messageButtonText}>Mesaj Gönder</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Info Section */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Bilgiler</Text>
          
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="mail-outline" size={20} color="#6b7280" />
              <Text style={styles.infoText}>{profile.email}</Text>
            </View>
            
            {profile.city && (
              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={20} color="#6b7280" />
                <Text style={styles.infoText}>{profile.city}</Text>
              </View>
            )}
            
            {profile.occupation && (
              <View style={styles.infoRow}>
                <Ionicons name="briefcase-outline" size={20} color="#6b7280" />
                <Text style={styles.infoText}>{profile.occupation}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  loadingContainer: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' },
  errorContainer: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#6b7280', fontSize: 16, marginTop: 16 },
  headerGradient: { paddingTop: 16, paddingBottom: 40, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  backButton: { position: 'absolute', top: 16, left: 16, zIndex: 1, width: 44, height: 44, justifyContent: 'center' },
  headerContent: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 24 },
  avatarContainer: { marginBottom: 16 },
  avatar: { width: 110, height: 110, borderRadius: 55, backgroundColor: '#4338ca', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 4, borderColor: 'rgba(255, 255, 255, 0.2)' },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { fontSize: 36, fontWeight: 'bold', color: '#fff' },
  name: { fontSize: 26, fontWeight: 'bold', color: '#fff' },
  badgeRow: { flexDirection: 'row', marginTop: 12, gap: 12, flexWrap: 'wrap', justifyContent: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6 },
  badgeText: { color: '#e0e7ff', fontSize: 13 },
  adminBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(251, 191, 36, 0.15)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginTop: 12, gap: 6 },
  adminText: { color: '#fbbf24', fontSize: 14, fontWeight: '600' },
  statsContainer: { flexDirection: 'row', marginHorizontal: 16, marginTop: -24, gap: 12 },
  statCard: { flex: 1, backgroundColor: '#111827', borderRadius: 16, padding: 16, alignItems: 'center' },
  statIconContainer: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  statNumber: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  statLabel: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  actionsContainer: { paddingHorizontal: 16, marginTop: 20 },
  messageButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#6366f1', borderRadius: 14, padding: 16, gap: 8 },
  messageButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  infoSection: { paddingHorizontal: 16, marginTop: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 12 },
  infoCard: { backgroundColor: '#111827', borderRadius: 16, padding: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1f2937', gap: 12 },
  infoText: { color: '#e5e7eb', fontSize: 15, flex: 1 },
});
