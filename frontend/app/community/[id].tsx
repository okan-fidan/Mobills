import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { communityApi, subgroupRequestApi } from '../../src/services/api';
import { useAuth } from '../../src/contexts/AuthContext';
import api from '../../src/services/api';
import { showToast, SkeletonCard, AnimatedPressable } from '../../src/components/ui';

interface Announcement {
  id: string;
  content: string;
  senderName: string;
  timestamp: string;
}

interface Community {
  id: string;
  name: string;
  city: string;
  description?: string;
  memberCount: number;
  isMember: boolean;
  isSuperAdmin: boolean;
  imageUrl?: string;
  subGroupsList?: SubGroup[];
}

interface SubGroup {
  id: string;
  name: string;
  description?: string;
  memberCount: number;
  isMember: boolean;
  hasPendingRequest?: boolean;
  imageUrl?: string;
}

// Alt grup kartı için ikon belirleme
const getSubgroupIcon = (name: string): string => {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('start') || lowerName.includes('başla')) return 'rocket';
  if (lowerName.includes('gelişim')) return 'trending-up';
  if (lowerName.includes('değerlendirme')) return 'analytics';
  if (lowerName.includes('mastermind')) return 'bulb';
  return 'chatbubbles';
};

// Alt grup kartı için renk belirleme
const getSubgroupColor = (name: string): string => {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('start') || lowerName.includes('başla')) return '#10b981';
  if (lowerName.includes('gelişim')) return '#3b82f6';
  if (lowerName.includes('değerlendirme')) return '#f59e0b';
  if (lowerName.includes('mastermind')) return '#8b5cf6';
  return '#6366f1';
};

export default function CommunityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [community, setCommunity] = useState<Community | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joiningSubgroup, setJoiningSubgroup] = useState<string | null>(null);
  // Duyuru modal state'leri
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [announcementText, setAnnouncementText] = useState('');
  const [sendingAnnouncement, setSendingAnnouncement] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const { userProfile, user } = useAuth();
  const router = useRouter();

  const isAdmin = community?.isSuperAdmin || userProfile?.isAdmin;

  const loadCommunity = useCallback(async () => {
    if (!id) return;
    try {
      const response = await communityApi.getOne(id);
      setCommunity(response.data);
    } catch (error) {
      console.error('Error loading community:', error);
      showToast.error('Hata', 'Topluluk yüklenemedi');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  const loadAnnouncements = useCallback(async () => {
    if (!id) return;
    try {
      const response = await communityApi.getAnnouncements(id);
      setAnnouncements(response.data || []);
    } catch (error) {
      console.error('Error loading announcements:', error);
    }
  }, [id]);

  useEffect(() => {
    loadCommunity();
    loadAnnouncements();
  }, [loadCommunity, loadAnnouncements]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadCommunity();
    loadAnnouncements();
  }, [loadCommunity, loadAnnouncements]);

  const handleJoin = async () => {
    if (!community) return;
    setJoining(true);
    try {
      if (community.isMember) {
        await communityApi.leave(community.id);
        Alert.alert('Başarılı', 'Topluluktan ayrıldınız');
      } else {
        await communityApi.join(community.id);
        Alert.alert('Başarılı', 'Topluluğa katıldınız!');
      }
      loadCommunity();
      loadAnnouncements();
    } catch (error) {
      console.error('Error joining/leaving community:', error);
      Alert.alert('Hata', 'İşlem başarısız');
    } finally {
      setJoining(false);
    }
  };

  const handleSubgroupAction = async (subgroup: SubGroup) => {
    if (subgroup.isMember) {
      // Üyeyse sohbete yönlendir
      router.push(`/chat/group/${subgroup.id}`);
    } else if (subgroup.hasPendingRequest) {
      // Zaten istek varsa bilgi ver
      Alert.alert('Bilgi', 'Bu grup için zaten bir katılım isteğiniz var. Yönetici onayı bekleniyor.');
    } else {
      // Katılım isteği gönder
      setJoiningSubgroup(subgroup.id);
      try {
        const response = await subgroupRequestApi.requestJoin(subgroup.id);
        if (response.data.status === 'joined') {
          Alert.alert('Başarılı', 'Gruba katıldınız!');
        } else {
          Alert.alert('İstek Gönderildi', 'Katılma isteğiniz gönderildi. Yönetici onayı bekleniyor.');
        }
        loadCommunity();
      } catch (error: any) {
        const message = error.response?.data?.detail || 'İşlem başarısız';
        Alert.alert('Hata', message);
      } finally {
        setJoiningSubgroup(null);
      }
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) return 'Az önce';
    if (hours < 24) return `${hours} saat önce`;
    if (days < 7) return `${days} gün önce`;
    return date.toLocaleDateString('tr-TR');
  };

  const handleSendAnnouncement = async () => {
    if (!announcementText.trim()) {
      Alert.alert('Hata', 'Lütfen bir duyuru metni girin');
      return;
    }

    setSendingAnnouncement(true);
    try {
      await communityApi.sendAnnouncement(id!, { content: announcementText.trim() });
      Alert.alert('Başarılı', 'Duyuru gönderildi');
      setShowAnnouncementModal(false);
      setAnnouncementText('');
      loadAnnouncements();
    } catch (error: any) {
      console.error('Error sending announcement:', error);
      Alert.alert('Hata', error?.response?.data?.detail || 'Duyuru gönderilemedi');
    } finally {
      setSendingAnnouncement(false);
    }
  };

  const handleDeleteAnnouncement = async (announcementId: string) => {
    Alert.alert(
      'Duyuruyu Sil',
      'Bu duyuruyu silmek istediğinize emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              await communityApi.deleteAnnouncement(id!, announcementId);
              loadAnnouncements();
            } catch (error) {
              Alert.alert('Hata', 'Duyuru silinemedi');
            }
          },
        },
      ]
    );
  };

  // Topluluk fotoğrafı değiştir
  const handleChangeCommunityImage = async () => {
    if (!isAdmin) return;
    
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
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setUploadingImage(true);
      try {
        await api.put(`/api/communities/${id}/image`, {
          imageData: result.assets[0].base64,
        });
        Alert.alert('Başarılı', 'Topluluk fotoğrafı güncellendi');
        loadCommunity();
      } catch (error) {
        Alert.alert('Hata', 'Fotoğraf yüklenemedi');
      } finally {
        setUploadingImage(false);
      }
    }
  };

  // Topluluktan ayrıl
  const handleLeaveCommunity = async () => {
    Alert.alert(
      'Topluluktan Ayrıl',
      'Bu topluluktan ayrılmak istediğinize emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Ayrıl',
          style: 'destructive',
          onPress: async () => {
            try {
              await communityApi.leave(community!.id);
              Alert.alert('Başarılı', 'Topluluktan ayrıldınız');
              setShowSettingsModal(false);
              router.back();
            } catch (error) {
              Alert.alert('Hata', 'Ayrılma işlemi başarısız');
            }
          },
        },
      ]
    );
  };

  // Alt grup kart durumunu render et
  const renderSubgroupStatus = (subgroup: SubGroup) => {
    if (joiningSubgroup === subgroup.id) {
      return <ActivityIndicator size="small" color="#6366f1" />;
    }

    if (subgroup.isMember) {
      return (
        <View style={styles.memberBadge}>
          <Ionicons name="checkmark-circle" size={20} color="#10b981" />
          <Text style={styles.memberText}>Üyesin</Text>
        </View>
      );
    }

    if (subgroup.hasPendingRequest) {
      return (
        <View style={styles.pendingBadge}>
          <Ionicons name="time" size={20} color="#f59e0b" />
          <Text style={styles.pendingText}>Beklemede</Text>
        </View>
      );
    }

    return (
      <View style={styles.joinBadge}>
        <Ionicons name="add-circle" size={20} color="#6366f1" />
        <Text style={styles.joinText}>Katıl</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (!community) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
        <Text style={styles.errorText}>Topluluk bulunamadı</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{community.name}</Text>
        {community.isMember && (
          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={() => setShowSettingsModal(true)}
          >
            <Ionicons name="ellipsis-vertical" size={24} color="#fff" />
          </TouchableOpacity>
        )}
        {!community.isMember && <View style={{ width: 44 }} />}
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />
        }
      >
        {/* Community Info with Image */}
        <View style={styles.communityHeader}>
          <TouchableOpacity 
            style={styles.communityImageWrapper}
            onPress={isAdmin ? handleChangeCommunityImage : undefined}
            disabled={!isAdmin || uploadingImage}
          >
            {community.imageUrl ? (
              <Image source={{ uri: community.imageUrl }} style={styles.communityImage} />
            ) : (
              <View style={styles.communityIcon}>
                <Ionicons name="people" size={48} color="#6366f1" />
              </View>
            )}
            {isAdmin && (
              <View style={styles.editImageBadge}>
                {uploadingImage ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="camera" size={16} color="#fff" />
                )}
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.communityName}>{community.name}</Text>
          <View style={styles.locationRow}>
            <Ionicons name="location" size={18} color="#6366f1" />
            <Text style={styles.locationText}>{community.city}</Text>
          </View>
          <Text style={styles.memberCount}>{community.memberCount} üye</Text>
          {community.description && (
            <Text style={styles.description}>{community.description}</Text>
          )}

          {/* Katıl butonu - sadece üye değilse göster */}
          {!community.isMember && (
            <TouchableOpacity
              style={styles.joinButton}
              onPress={handleJoin}
              disabled={joining}
            >
              {joining ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="enter-outline" size={20} color="#fff" />
                  <Text style={styles.joinButtonText}>Katıl</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Announcements Section - EN ÜSTTE */}
        <View style={styles.announcementsSection}>
          <View style={styles.announcementHeader}>
            <Ionicons name="megaphone" size={24} color="#f59e0b" />
            <Text style={styles.sectionTitle}>Duyurular</Text>
            {isAdmin && (
              <TouchableOpacity 
                style={styles.addAnnouncementBtn}
                onPress={() => setShowAnnouncementModal(true)}
              >
                <Ionicons name="add-circle" size={28} color="#f59e0b" />
              </TouchableOpacity>
            )}
          </View>
          
          {!community.isMember && (
            <View style={styles.guestNotice}>
              <Ionicons name="information-circle" size={18} color="#6b7280" />
              <Text style={styles.guestNoticeText}>
                Sadece son 5 duyuruyu görüntülüyorsunuz. Tümünü görmek için topluluğa katılın.
              </Text>
            </View>
          )}

          {announcements.length > 0 ? (
            announcements.map((announcement) => (
              <View key={announcement.id} style={styles.announcementCard}>
                <View style={styles.announcementMeta}>
                  <Text style={styles.announcementSender}>{announcement.senderName}</Text>
                  <View style={styles.announcementActions}>
                    <Text style={styles.announcementTime}>
                      {formatDate(announcement.timestamp)}
                    </Text>
                    {isAdmin && (
                      <TouchableOpacity 
                        onPress={() => handleDeleteAnnouncement(announcement.id)}
                        style={styles.deleteAnnouncementBtn}
                      >
                        <Ionicons name="trash-outline" size={18} color="#ef4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
                <Text style={styles.announcementContent}>{announcement.content}</Text>
              </View>
            ))
          ) : (
            <View style={styles.emptyAnnouncements}>
              <Ionicons name="megaphone-outline" size={40} color="#374151" />
              <Text style={styles.emptyText}>Henüz duyuru yok</Text>
            </View>
          )}
        </View>

        {/* Subgroups Section */}
        <View style={styles.subgroupsSection}>
          <Text style={styles.sectionTitle}>Alt Gruplar</Text>
          <Text style={styles.sectionSubtitle}>
            Gruplara katılmak için yönetici onayı gereklidir
          </Text>
          
          {community.subGroupsList && community.subGroupsList.length > 0 ? (
            <View style={styles.subgroupGrid}>
              {community.subGroupsList.map((subgroup) => {
                const iconName = getSubgroupIcon(subgroup.name);
                const color = getSubgroupColor(subgroup.name);
                const displayName = subgroup.name.replace(`${community.name} - `, '');
                
                return (
                  <TouchableOpacity
                    key={subgroup.id}
                    style={[styles.subgroupCard, { borderLeftColor: color }]}
                    onPress={() => handleSubgroupAction(subgroup)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.subgroupIconWrapper, { backgroundColor: `${color}20` }]}>
                      <Ionicons name={iconName as any} size={28} color={color} />
                    </View>
                    <View style={styles.subgroupInfo}>
                      <Text style={styles.subgroupName}>{displayName}</Text>
                      {subgroup.description && (
                        <Text style={styles.subgroupDescription} numberOfLines={2}>
                          {subgroup.description}
                        </Text>
                      )}
                      <Text style={styles.subgroupMembers}>{subgroup.memberCount} üye</Text>
                    </View>
                    {renderSubgroupStatus(subgroup)}
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptySubgroups}>
              <Ionicons name="chatbubbles-outline" size={48} color="#374151" />
              <Text style={styles.emptyText}>Henüz alt grup yok</Text>
            </View>
          )}
        </View>

        {/* Bottom padding */}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Ayarlar Modal */}
      <Modal visible={showSettingsModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.settingsModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Topluluk Ayarları</Text>
              <TouchableOpacity onPress={() => setShowSettingsModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.settingsModalBody}>
              {/* Profil Resmi Değiştir - Sadece admin için */}
              {isAdmin && (
                <TouchableOpacity 
                  style={styles.settingsOption}
                  onPress={() => {
                    setShowSettingsModal(false);
                    handleChangeCommunityImage();
                  }}
                >
                  <View style={[styles.settingsIconWrapper, { backgroundColor: 'rgba(99, 102, 241, 0.1)' }]}>
                    <Ionicons name="camera" size={24} color="#6366f1" />
                  </View>
                  <View style={styles.settingsOptionInfo}>
                    <Text style={styles.settingsOptionTitle}>Profil Fotoğrafı Değiştir</Text>
                    <Text style={styles.settingsOptionSubtitle}>Topluluk resmini güncelle</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#6b7280" />
                </TouchableOpacity>
              )}

              {/* Duyuru Gönder - Sadece admin için */}
              {isAdmin && (
                <TouchableOpacity 
                  style={styles.settingsOption}
                  onPress={() => {
                    setShowSettingsModal(false);
                    setShowAnnouncementModal(true);
                  }}
                >
                  <View style={[styles.settingsIconWrapper, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
                    <Ionicons name="megaphone" size={24} color="#f59e0b" />
                  </View>
                  <View style={styles.settingsOptionInfo}>
                    <Text style={styles.settingsOptionTitle}>Duyuru Gönder</Text>
                    <Text style={styles.settingsOptionSubtitle}>Tüm üyelere bildirim gönder</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#6b7280" />
                </TouchableOpacity>
              )}

              {/* Bildirimler */}
              <TouchableOpacity style={styles.settingsOption}>
                <View style={[styles.settingsIconWrapper, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                  <Ionicons name="notifications" size={24} color="#10b981" />
                </View>
                <View style={styles.settingsOptionInfo}>
                  <Text style={styles.settingsOptionTitle}>Bildirimler</Text>
                  <Text style={styles.settingsOptionSubtitle}>Bildirimleri yönet</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#6b7280" />
              </TouchableOpacity>

              {/* Topluluktan Ayrıl */}
              <TouchableOpacity 
                style={[styles.settingsOption, styles.dangerOption]}
                onPress={handleLeaveCommunity}
              >
                <View style={[styles.settingsIconWrapper, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                  <Ionicons name="exit" size={24} color="#ef4444" />
                </View>
                <View style={styles.settingsOptionInfo}>
                  <Text style={[styles.settingsOptionTitle, styles.dangerText]}>Topluluktan Ayrıl</Text>
                  <Text style={styles.settingsOptionSubtitle}>Bu topluluktan çık</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#ef4444" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Duyuru Gönderme Modal */}
      <Modal visible={showAnnouncementModal} animationType="slide" transparent>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Yeni Duyuru</Text>
              <TouchableOpacity onPress={() => setShowAnnouncementModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <TextInput
                style={styles.announcementInput}
                placeholder="Duyuru metnini yazın..."
                placeholderTextColor="#6b7280"
                value={announcementText}
                onChangeText={setAnnouncementText}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              <TouchableOpacity 
                style={[styles.sendAnnouncementBtn, sendingAnnouncement && styles.disabledBtn]}
                onPress={handleSendAnnouncement}
                disabled={sendingAnnouncement}
              >
                {sendingAnnouncement ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="megaphone" size={20} color="#fff" />
                    <Text style={styles.sendAnnouncementText}>Duyuru Gönder</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  errorContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
    marginTop: 16,
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
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  adminButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  communityHeader: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  communityIcon: {
    width: 96,
    height: 96,
    borderRadius: 24,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  communityName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  locationText: {
    color: '#9ca3af',
    fontSize: 16,
  },
  memberCount: {
    color: '#6b7280',
    fontSize: 14,
    marginTop: 4,
  },
  description: {
    color: '#9ca3af',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 20,
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 24,
    marginTop: 24,
    gap: 8,
  },
  leaveButton: {
    backgroundColor: '#374151',
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  subgroupsSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 16,
  },
  subgroupGrid: {
    gap: 12,
  },
  subgroupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
  },
  subgroupIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subgroupInfo: {
    flex: 1,
    marginLeft: 12,
  },
  subgroupName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  subgroupDescription: {
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  subgroupMembers: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 4,
  },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  memberText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '500',
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  pendingText: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: '500',
  },
  joinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  joinText: {
    color: '#6366f1',
    fontSize: 12,
    fontWeight: '500',
  },
  emptySubgroups: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 14,
    marginTop: 12,
  },
  announcementsSection: {
    padding: 16,
  },
  announcementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  guestNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  guestNoticeText: {
    flex: 1,
    color: '#9ca3af',
    fontSize: 12,
    lineHeight: 16,
  },
  announcementCard: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
  },
  announcementMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  announcementSender: {
    color: '#f59e0b',
    fontSize: 14,
    fontWeight: '600',
  },
  announcementTime: {
    color: '#6b7280',
    fontSize: 12,
  },
  announcementContent: {
    color: '#e5e7eb',
    fontSize: 14,
    lineHeight: 20,
  },
  emptyAnnouncements: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  addAnnouncementBtn: {
    marginLeft: 'auto',
  },
  announcementActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deleteAnnouncementBtn: {
    padding: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1f2937',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  modalBody: {
    padding: 20,
  },
  announcementInput: {
    backgroundColor: '#374151',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  sendAnnouncementBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f59e0b',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    gap: 8,
  },
  disabledBtn: {
    opacity: 0.6,
  },
  sendAnnouncementText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  settingsButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  communityImageWrapper: {
    width: 96,
    height: 96,
    borderRadius: 24,
    marginBottom: 16,
    position: 'relative',
  },
  communityImage: {
    width: 96,
    height: 96,
    borderRadius: 24,
  },
  editImageBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0a0a0a',
  },
  settingsModalContent: {
    backgroundColor: '#1f2937',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    marginTop: 'auto',
  },
  settingsModalBody: {
    padding: 16,
    gap: 8,
  },
  settingsOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    padding: 16,
    borderRadius: 12,
  },
  settingsIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsOptionInfo: {
    flex: 1,
    marginLeft: 12,
  },
  settingsOptionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  settingsOptionSubtitle: {
    color: '#6b7280',
    fontSize: 13,
    marginTop: 2,
  },
  dangerOption: {
    marginTop: 8,
  },
  dangerText: {
    color: '#ef4444',
  },
});
