import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Image,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Switch,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { subgroupApi } from '../../../../src/services/api';
import { useAuth } from '../../../../src/contexts/AuthContext';
import api from '../../../../src/services/api';
import { showToast } from '../../../../src/components/ui';

const { width } = Dimensions.get('window');

interface SubGroup {
  id: string;
  name: string;
  description?: string;
  memberCount: number;
  communityName?: string;
  communityId?: string;
  groupAdmins?: string[];
  members?: string[];
  imageUrl?: string;
  isGroupAdmin?: boolean;
  isSuperAdmin?: boolean;
  createdAt?: string;
}

interface Member {
  uid: string;
  firstName: string;
  lastName: string;
  profileImageUrl?: string;
  isAdmin?: boolean;
}

interface MediaItem {
  id: string;
  type: 'image' | 'video';
  url: string;
}

interface Poll {
  id: string;
  question: string;
  options: { id: string; text: string; votes: string[] }[];
  creatorName: string;
  createdAt: string;
}

interface PinnedMessage {
  id: string;
  content: string;
  senderName: string;
  timestamp: string;
}

export default function GroupMenuScreen() {
  const { id: groupId } = useLocalSearchParams<{ id: string }>();
  const [subgroup, setSubgroup] = useState<SubGroup | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [pinnedMessages, setPinnedMessages] = useState<PinnedMessage[]>([]);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  // Modal states
  const [showPollModal, setShowPollModal] = useState(false);
  const [showEditDescModal, setShowEditDescModal] = useState(false);
  const [showMuteModal, setShowMuteModal] = useState(false);
  
  // Form states
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [creatingPoll, setCreatingPoll] = useState(false);
  const [newDescription, setNewDescription] = useState('');
  const [savingDescription, setSavingDescription] = useState(false);
  
  // Settings states
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [muteUntil, setMuteUntil] = useState<string | null>(null);
  
  const scrollY = useRef(new Animated.Value(0)).current;
  const { user, userProfile } = useAuth();
  const router = useRouter();

  const isAdmin = subgroup?.isGroupAdmin || subgroup?.isSuperAdmin || userProfile?.isAdmin;

  const loadData = useCallback(async () => {
    if (!groupId) return;
    try {
      const [groupRes, membersRes, pollsRes, pinnedRes, mediaRes] = await Promise.all([
        subgroupApi.getOne(groupId),
        subgroupApi.getMembers(groupId).catch(() => ({ data: [] })),
        subgroupApi.getPolls(groupId).catch(() => ({ data: [] })),
        subgroupApi.getPinnedMessages(groupId).catch(() => ({ data: [] })),
        subgroupApi.getMedia(groupId).catch(() => ({ data: [] })),
      ]);
      
      setSubgroup(groupRes.data);
      setMembers(membersRes.data || []);
      setPolls(pollsRes.data || []);
      setPinnedMessages(pinnedRes.data || []);
      setMediaItems((mediaRes.data || []).slice(0, 6));
      setNewDescription(groupRes.data?.description || '');
    } catch (error) {
      console.error('Error loading group menu:', error);
      showToast.error('Hata', 'Grup bilgileri yüklenemedi');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [groupId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleChangeGroupImage = async () => {
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
        await api.put(`/api/subgroups/${groupId}/image`, {
          imageData: result.assets[0].base64,
        });
        showToast.success('Başarılı', 'Grup fotoğrafı güncellendi');
        loadData();
      } catch (error) {
        Alert.alert('Hata', 'Fotoğraf yüklenemedi');
      } finally {
        setUploadingImage(false);
      }
    }
  };

  const handleSaveDescription = async () => {
    setSavingDescription(true);
    try {
      await api.put(`/api/subgroups/${groupId}/description`, {
        description: newDescription.trim(),
      });
      showToast.success('Başarılı', 'Açıklama güncellendi');
      setShowEditDescModal(false);
      loadData();
    } catch (error) {
      Alert.alert('Hata', 'Açıklama güncellenemedi');
    } finally {
      setSavingDescription(false);
    }
  };

  const handleLeaveGroup = async () => {
    Alert.alert('Gruptan Ayrıl', 'Bu gruptan ayrılmak istediğinize emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Ayrıl',
        style: 'destructive',
        onPress: async () => {
          try {
            await subgroupApi.leave(groupId!);
            showToast.success('Başarılı', 'Gruptan ayrıldınız');
            router.replace('/(tabs)/communities');
          } catch (error) {
            Alert.alert('Hata', 'Ayrılma işlemi başarısız');
          }
        },
      },
    ]);
  };

  const handleCreatePoll = async () => {
    if (!pollQuestion.trim()) {
      Alert.alert('Hata', 'Lütfen bir soru girin');
      return;
    }
    
    const validOptions = pollOptions.filter(o => o.trim());
    if (validOptions.length < 2) {
      Alert.alert('Hata', 'En az 2 seçenek gerekli');
      return;
    }

    setCreatingPoll(true);
    try {
      await subgroupApi.createPoll(groupId!, {
        question: pollQuestion.trim(),
        options: validOptions,
      });
      showToast.success('Başarılı', 'Anket oluşturuldu');
      setShowPollModal(false);
      setPollQuestion('');
      setPollOptions(['', '']);
      loadData();
    } catch (error) {
      Alert.alert('Hata', 'Anket oluşturulamadı');
    } finally {
      setCreatingPoll(false);
    }
  };

  const handleMute = (duration: string) => {
    setMuteUntil(duration);
    setShowMuteModal(false);
    showToast.success('Bildirimler', `Bildirimler ${duration} susturuldu`);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const handleReportGroup = () => {
    Alert.alert(
      'Grubu Bildir',
      'Bu grubu neden bildirmek istiyorsunuz?',
      [
        { text: 'Spam', onPress: () => showToast.info('Bildirildi', 'Şikayetiniz alındı') },
        { text: 'Uygunsuz İçerik', onPress: () => showToast.info('Bildirildi', 'Şikayetiniz alındı') },
        { text: 'Sahte Hesap', onPress: () => showToast.info('Bildirildi', 'Şikayetiniz alındı') },
        { text: 'İptal', style: 'cancel' },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (!subgroup) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
        <Text style={styles.errorText}>Grup bulunamadı</Text>
      </View>
    );
  }

  const description = subgroup.description || 'Grup açıklaması eklemek için dokunun';
  const shouldTruncate = description.length > 100;
  const adminMembers = members.filter(m => subgroup.groupAdmins?.includes(m.uid));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Grup Bilgisi</Text>
        <TouchableOpacity style={styles.headerButton}>
          <Ionicons name="search" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <Animated.ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
      >
        {/* Profile Section */}
        <View style={styles.profileSection}>
          <TouchableOpacity
            style={styles.avatarWrapper}
            onPress={isAdmin ? handleChangeGroupImage : undefined}
            disabled={!isAdmin || uploadingImage}
            activeOpacity={0.8}
          >
            {subgroup.imageUrl ? (
              <Image source={{ uri: subgroup.imageUrl }} style={styles.avatar} />
            ) : (
              <LinearGradient colors={['#6366f1', '#4f46e5']} style={styles.avatarPlaceholder}>
                <Ionicons name="chatbubbles" size={56} color="#fff" />
              </LinearGradient>
            )}
            {isAdmin && (
              <View style={styles.cameraButton}>
                {uploadingImage ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="camera" size={18} color="#fff" />
                )}
              </View>
            )}
          </TouchableOpacity>

          <Text style={styles.groupName}>{subgroup.name}</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.memberCountText}>Grup • {subgroup.memberCount} üye</Text>
          </View>

          {subgroup.communityName && (
            <TouchableOpacity 
              style={styles.communityLink}
              onPress={() => router.push(`/community/${subgroup.communityId}`)}
            >
              <Ionicons name="people" size={16} color="#6366f1" />
              <Text style={styles.communityLinkText}>{subgroup.communityName}</Text>
              <Ionicons name="chevron-forward" size={14} color="#6366f1" />
            </TouchableOpacity>
          )}
        </View>

        {/* Description Section */}
        <TouchableOpacity 
          style={styles.descriptionSection}
          onPress={isAdmin ? () => setShowEditDescModal(true) : undefined}
          disabled={!isAdmin}
          activeOpacity={isAdmin ? 0.7 : 1}
        >
          <View style={styles.descriptionHeader}>
            <Ionicons name="information-circle" size={20} color="#6b7280" />
            <Text style={styles.descriptionLabel}>Açıklama</Text>
            {isAdmin && <Ionicons name="pencil" size={16} color="#6366f1" />}
          </View>
          <Text 
            style={[styles.descriptionText, !subgroup.description && styles.placeholderText]} 
            numberOfLines={showFullDescription ? undefined : 3}
          >
            {description}
          </Text>
          {shouldTruncate && (
            <TouchableOpacity onPress={() => setShowFullDescription(!showFullDescription)}>
              <Text style={styles.readMoreText}>
                {showFullDescription ? 'Daha az göster' : 'Devamını oku'}
              </Text>
            </TouchableOpacity>
          )}
          {subgroup.createdAt && (
            <Text style={styles.createdAt}>
              Oluşturulma: {formatDate(subgroup.createdAt)}
            </Text>
          )}
        </TouchableOpacity>

        {/* Media Preview Section */}
        <View style={styles.section}>
          <TouchableOpacity 
            style={styles.sectionHeader}
            onPress={() => router.push(`/chat/group/media/${groupId}`)}
          >
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionIcon, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                <Ionicons name="images" size={20} color="#3b82f6" />
              </View>
              <Text style={styles.sectionTitle}>Medya, Linkler ve Belgeler</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#6b7280" />
          </TouchableOpacity>

          {mediaItems.length > 0 ? (
            <View style={styles.mediaPreviewGrid}>
              {mediaItems.slice(0, 6).map((item, index) => (
                <TouchableOpacity 
                  key={item.id} 
                  style={styles.mediaPreviewItem}
                  onPress={() => router.push(`/chat/group/media/${groupId}`)}
                >
                  <Image source={{ uri: item.url }} style={styles.mediaPreviewImage} />
                  {index === 5 && mediaItems.length > 6 && (
                    <View style={styles.moreOverlay}>
                      <Text style={styles.moreText}>+{mediaItems.length - 6}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={styles.noMediaText}>Henüz medya paylaşılmadı</Text>
          )}
        </View>

        {/* Notifications Section */}
        <View style={styles.section}>
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <View style={[styles.sectionIcon, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                <Ionicons name="notifications" size={20} color="#10b981" />
              </View>
              <Text style={styles.settingText}>Bildirimler</Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: '#374151', true: '#6366f1' }}
              thumbColor="#fff"
            />
          </View>

          {notificationsEnabled && (
            <TouchableOpacity 
              style={styles.settingItem}
              onPress={() => setShowMuteModal(true)}
            >
              <View style={styles.settingLeft}>
                <View style={[styles.sectionIcon, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
                  <Ionicons name="volume-mute" size={20} color="#f59e0b" />
                </View>
                <View>
                  <Text style={styles.settingText}>Sustur</Text>
                  {muteUntil && <Text style={styles.settingSubtext}>{muteUntil}</Text>}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#6b7280" />
            </TouchableOpacity>
          )}
        </View>

        {/* Polls Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionIcon, { backgroundColor: 'rgba(139, 92, 246, 0.1)' }]}>
                <Ionicons name="stats-chart" size={20} color="#8b5cf6" />
              </View>
              <Text style={styles.sectionTitle}>Anketler</Text>
              {polls.length > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{polls.length}</Text>
                </View>
              )}
            </View>
            <TouchableOpacity style={styles.addButton} onPress={() => setShowPollModal(true)}>
              <Ionicons name="add-circle" size={28} color="#8b5cf6" />
            </TouchableOpacity>
          </View>

          {polls.length > 0 ? (
            <View style={styles.itemList}>
              {polls.slice(0, 2).map((poll) => (
                <View key={poll.id} style={styles.pollCard}>
                  <Text style={styles.pollQuestion}>{poll.question}</Text>
                  <View style={styles.pollMeta}>
                    <Ionicons name="person-outline" size={12} color="#6b7280" />
                    <Text style={styles.pollMetaText}>{poll.creatorName}</Text>
                    <Text style={styles.pollMetaText}>•</Text>
                    <Text style={styles.pollMetaText}>{poll.options.length} seçenek</Text>
                  </View>
                </View>
              ))}
              {polls.length > 2 && (
                <TouchableOpacity style={styles.showAllLink}>
                  <Text style={styles.showAllText}>Tüm anketleri gör ({polls.length})</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrapper}>
                <Ionicons name="stats-chart-outline" size={32} color="#374151" />
              </View>
              <Text style={styles.emptyText}>Henüz anket yok</Text>
              <Text style={styles.emptySubtext}>Yeni anket oluşturmak için + butonuna dokunun</Text>
            </View>
          )}
        </View>

        {/* Pinned Messages Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionIcon, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
                <Ionicons name="pin" size={20} color="#f59e0b" />
              </View>
              <Text style={styles.sectionTitle}>Sabitlenen Mesajlar</Text>
              {pinnedMessages.length > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{pinnedMessages.length}</Text>
                </View>
              )}
            </View>
          </View>

          {pinnedMessages.length > 0 ? (
            <View style={styles.itemList}>
              {pinnedMessages.slice(0, 2).map((msg) => (
                <View key={msg.id} style={styles.pinnedCard}>
                  <Text style={styles.pinnedContent} numberOfLines={2}>{msg.content}</Text>
                  <Text style={styles.pinnedMeta}>{msg.senderName}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyStateSmall}>
              <Ionicons name="pin-outline" size={24} color="#374151" />
              <Text style={styles.emptyTextSmall}>Sabitlenen mesaj yok</Text>
            </View>
          )}
        </View>

        {/* Members Section */}
        <View style={styles.section}>
          <TouchableOpacity 
            style={styles.sectionHeader}
            onPress={() => router.push(`/chat/group/members/${groupId}`)}
          >
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionIcon, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                <Ionicons name="people" size={20} color="#10b981" />
              </View>
              <Text style={styles.sectionTitle}>{subgroup.memberCount} Üye</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#6b7280" />
          </TouchableOpacity>

          {/* Admin Preview */}
          {adminMembers.length > 0 && (
            <View style={styles.adminPreview}>
              {adminMembers.slice(0, 3).map((admin) => (
                <TouchableOpacity
                  key={admin.uid}
                  style={styles.memberPreviewItem}
                  onPress={() => router.push(`/user/${admin.uid}`)}
                >
                  {admin.profileImageUrl ? (
                    <Image source={{ uri: admin.profileImageUrl }} style={styles.memberPreviewAvatar} />
                  ) : (
                    <LinearGradient colors={['#6366f1', '#4f46e5']} style={styles.memberPreviewAvatarPlaceholder}>
                      <Text style={styles.avatarInitial}>{admin.firstName.charAt(0)}</Text>
                    </LinearGradient>
                  )}
                  <Text style={styles.memberPreviewName} numberOfLines={1}>
                    {admin.firstName}
                  </Text>
                  <View style={styles.adminLabel}>
                    <Ionicons name="shield-checkmark" size={10} color="#10b981" />
                  </View>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.memberPreviewItem}
                onPress={() => router.push(`/chat/group/members/${groupId}`)}
              >
                <View style={styles.showAllMembersButton}>
                  <Ionicons name="people" size={20} color="#6366f1" />
                </View>
                <Text style={styles.memberPreviewName}>Tümü</Text>
              </TouchableOpacity>
            </View>
          )}

          {isAdmin && (
            <TouchableOpacity style={styles.addMemberButton}>
              <Ionicons name="person-add" size={20} color="#6366f1" />
              <Text style={styles.addMemberText}>Üye Ekle</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Actions Section */}
        <View style={styles.actionsSection}>
          <TouchableOpacity style={styles.actionItem} onPress={handleReportGroup}>
            <Ionicons name="flag-outline" size={22} color="#f59e0b" />
            <Text style={[styles.actionText, { color: '#f59e0b' }]}>Grubu Bildir</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionItem} onPress={handleLeaveGroup}>
            <Ionicons name="exit-outline" size={22} color="#ef4444" />
            <Text style={[styles.actionText, { color: '#ef4444' }]}>Gruptan Ayrıl</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </Animated.ScrollView>

      {/* Edit Description Modal */}
      <Modal visible={showEditDescModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowEditDescModal(false)}>
                <Text style={styles.modalCancel}>İptal</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Açıklama Düzenle</Text>
              <TouchableOpacity onPress={handleSaveDescription} disabled={savingDescription}>
                {savingDescription ? (
                  <ActivityIndicator size="small" color="#6366f1" />
                ) : (
                  <Text style={styles.modalSave}>Kaydet</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <TextInput
                style={styles.descriptionInput}
                placeholder="Grup açıklaması..."
                placeholderTextColor="#6b7280"
                value={newDescription}
                onChangeText={setNewDescription}
                multiline
                maxLength={500}
                textAlignVertical="top"
              />
              <Text style={styles.charCount}>{newDescription.length}/500</Text>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Poll Modal */}
      <Modal visible={showPollModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowPollModal(false)}>
                <Text style={styles.modalCancel}>İptal</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Yeni Anket</Text>
              <TouchableOpacity onPress={handleCreatePoll} disabled={creatingPoll}>
                {creatingPoll ? (
                  <ActivityIndicator size="small" color="#6366f1" />
                ) : (
                  <Text style={styles.modalSave}>Oluştur</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <TextInput
                style={styles.pollInput}
                placeholder="Sorunuz..."
                placeholderTextColor="#6b7280"
                value={pollQuestion}
                onChangeText={setPollQuestion}
              />

              <Text style={styles.optionsLabel}>Seçenekler</Text>
              {pollOptions.map((option, index) => (
                <View key={index} style={styles.optionRow}>
                  <TextInput
                    style={styles.optionInput}
                    placeholder={`Seçenek ${index + 1}`}
                    placeholderTextColor="#6b7280"
                    value={option}
                    onChangeText={(text) => {
                      const newOptions = [...pollOptions];
                      newOptions[index] = text;
                      setPollOptions(newOptions);
                    }}
                  />
                  {pollOptions.length > 2 && (
                    <TouchableOpacity
                      style={styles.removeOption}
                      onPress={() => setPollOptions(pollOptions.filter((_, i) => i !== index))}
                    >
                      <Ionicons name="close-circle" size={24} color="#ef4444" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              {pollOptions.length < 6 && (
                <TouchableOpacity
                  style={styles.addOptionButton}
                  onPress={() => setPollOptions([...pollOptions, ''])}
                >
                  <Ionicons name="add-circle-outline" size={20} color="#6366f1" />
                  <Text style={styles.addOptionText}>Seçenek Ekle</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Mute Modal */}
      <Modal visible={showMuteModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.muteModalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.muteModalTitle}>Bildirimleri Sustur</Text>
            
            {['1 saat', '8 saat', '1 gün', '1 hafta', 'Her zaman'].map((duration) => (
              <TouchableOpacity
                key={duration}
                style={styles.muteOption}
                onPress={() => handleMute(duration)}
              >
                <Text style={styles.muteOptionText}>{duration}</Text>
                {muteUntil === duration && (
                  <Ionicons name="checkmark" size={22} color="#6366f1" />
                )}
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.muteCancel}
              onPress={() => setShowMuteModal(false)}
            >
              <Text style={styles.muteCancelText}>İptal</Text>
            </TouchableOpacity>
          </View>
        </View>
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

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  headerButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },

  scrollView: {
    flex: 1,
  },

  // Profile Section
  profileSection: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderBottomWidth: 8,
    borderBottomColor: '#111827',
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraButton: {
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
  groupName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  memberCountText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  communityLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: 20,
  },
  communityLinkText: {
    color: '#6366f1',
    fontSize: 13,
    fontWeight: '500',
  },

  // Description Section
  descriptionSection: {
    padding: 16,
    borderBottomWidth: 8,
    borderBottomColor: '#111827',
  },
  descriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  descriptionLabel: {
    flex: 1,
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  descriptionText: {
    color: '#e5e7eb',
    fontSize: 15,
    lineHeight: 22,
  },
  placeholderText: {
    color: '#6b7280',
    fontStyle: 'italic',
  },
  readMoreText: {
    color: '#6366f1',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 6,
  },
  createdAt: {
    color: '#4b5563',
    fontSize: 12,
    marginTop: 12,
  },

  // Section Styles
  section: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 8,
    borderBottomColor: '#111827',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  badge: {
    backgroundColor: '#374151',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  badgeText: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '600',
  },
  addButton: {
    padding: 4,
  },

  // Media Preview
  mediaPreviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  mediaPreviewItem: {
    width: (width - 40) / 3,
    height: (width - 40) / 3,
    borderRadius: 8,
    overflow: 'hidden',
  },
  mediaPreviewImage: {
    width: '100%',
    height: '100%',
  },
  moreOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  noMediaText: {
    color: '#6b7280',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },

  // Settings
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingText: {
    fontSize: 15,
    color: '#fff',
  },
  settingSubtext: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },

  // Items
  itemList: {
    gap: 10,
  },
  pollCard: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: '#8b5cf6',
  },
  pollQuestion: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  pollMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  pollMetaText: {
    color: '#6b7280',
    fontSize: 12,
  },
  pinnedCard: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
  },
  pinnedContent: {
    color: '#e5e7eb',
    fontSize: 14,
  },
  pinnedMeta: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 6,
  },
  showAllLink: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  showAllText: {
    color: '#6366f1',
    fontSize: 14,
    fontWeight: '500',
  },

  // Empty States
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1f2937',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '500',
  },
  emptySubtext: {
    color: '#6b7280',
    fontSize: 13,
    marginTop: 4,
  },
  emptyStateSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  emptyTextSmall: {
    color: '#6b7280',
    fontSize: 14,
  },

  // Members Preview
  adminPreview: {
    flexDirection: 'row',
    gap: 16,
    paddingTop: 8,
  },
  memberPreviewItem: {
    alignItems: 'center',
    width: 64,
  },
  memberPreviewAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginBottom: 6,
  },
  memberPreviewAvatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  avatarInitial: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  memberPreviewName: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
  },
  adminLabel: {
    position: 'absolute',
    top: 40,
    right: 4,
    backgroundColor: '#0a0a0a',
    borderRadius: 8,
    padding: 2,
  },
  showAllMembersButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  addMemberButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: 12,
  },
  addMemberText: {
    color: '#6366f1',
    fontSize: 15,
    fontWeight: '500',
  },

  // Actions Section
  actionsSection: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  actionText: {
    fontSize: 15,
    fontWeight: '500',
  },

  // Modal Styles
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
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#6b7280',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  modalCancel: {
    color: '#6b7280',
    fontSize: 15,
  },
  modalSave: {
    color: '#6366f1',
    fontSize: 15,
    fontWeight: '600',
  },
  modalBody: {
    padding: 16,
  },
  descriptionInput: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 14,
    color: '#fff',
    fontSize: 15,
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#374151',
  },
  charCount: {
    color: '#6b7280',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 8,
  },
  pollInput: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 14,
    color: '#fff',
    fontSize: 15,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  optionsLabel: {
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  optionInput: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 14,
    color: '#fff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#374151',
  },
  removeOption: {
    padding: 4,
  },
  addOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 6,
    marginTop: 4,
  },
  addOptionText: {
    color: '#6366f1',
    fontSize: 15,
    fontWeight: '500',
  },

  // Mute Modal
  muteModalContent: {
    backgroundColor: '#1f2937',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 20,
  },
  muteModalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  muteOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  muteOptionText: {
    color: '#fff',
    fontSize: 16,
  },
  muteCancel: {
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  muteCancelText: {
    color: '#6366f1',
    fontSize: 16,
    fontWeight: '500',
  },
});
