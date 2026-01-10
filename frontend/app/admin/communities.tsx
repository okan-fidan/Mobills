import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Alert,
  Modal,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { adminApi, generalApi, subgroupRequestApi } from '../../src/services/api';

interface Community {
  id: string;
  name: string;
  city: string;
  description?: string;
  memberCount: number;
  superAdminCount: number;
  subGroupCount: number;
  bannedCount: number;
}

interface SubGroup {
  id: string;
  name: string;
  description?: string;
  memberCount: number;
}

interface Member {
  uid: string;
  firstName: string;
  lastName: string;
  email: string;
  isSuperAdmin: boolean;
  isBannedFromCommunity: boolean;
}

interface JoinRequest {
  communityId: string;
  communityName: string;
  subgroupId: string;
  subgroupName: string;
  userId: string;
  userName: string;
  userEmail?: string;
  userCity?: string;
  requestedAt: string;
}

type TabType = 'communities' | 'subgroups' | 'requests';

export default function AdminCommunitiesScreen() {
  const [activeTab, setActiveTab] = useState<TabType>('communities');
  const [communities, setCommunities] = useState<Community[]>([]);
  const [filteredCommunities, setFilteredCommunities] = useState<Community[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Community CRUD Modal States
  const [createCommunityModal, setCreateCommunityModal] = useState(false);
  const [editCommunityModal, setEditCommunityModal] = useState(false);
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);
  const [communityForm, setCommunityForm] = useState({ name: '', city: '', description: '' });
  const [cityPickerModal, setCityPickerModal] = useState(false);
  const [savingCommunity, setSavingCommunity] = useState(false);
  
  // Members Modal
  const [members, setMembers] = useState<Member[]>([]);
  const [membersModalVisible, setMembersModalVisible] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  
  // Subgroups Modal
  const [subgroups, setSubgroups] = useState<SubGroup[]>([]);
  const [subgroupsModalVisible, setSubgroupsModalVisible] = useState(false);
  const [loadingSubgroups, setLoadingSubgroups] = useState(false);
  const [editSubgroupModal, setEditSubgroupModal] = useState(false);
  const [selectedSubgroup, setSelectedSubgroup] = useState<SubGroup | null>(null);
  const [subgroupForm, setSubgroupForm] = useState({ name: '', description: '' });
  
  const router = useRouter();

  const loadCommunities = useCallback(async () => {
    try {
      const response = await adminApi.getCommunities();
      setCommunities(response.data);
      setFilteredCommunities(response.data);
    } catch (error) {
      console.error('Error loading communities:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadJoinRequests = useCallback(async () => {
    try {
      const response = await adminApi.getAllJoinRequests();
      setJoinRequests(response.data);
    } catch (error) {
      console.error('Error loading join requests:', error);
    }
  }, []);

  const loadCities = useCallback(async () => {
    try {
      const response = await generalApi.getCities();
      setCities(response.data.cities || []);
    } catch (error) {
      console.error('Error loading cities:', error);
    }
  }, []);

  useEffect(() => {
    loadCommunities();
    loadJoinRequests();
    loadCities();
  }, [loadCommunities, loadJoinRequests, loadCities]);

  useEffect(() => {
    if (searchQuery) {
      const filtered = communities.filter(
        (c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.city.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredCommunities(filtered);
    } else {
      setFilteredCommunities(communities);
    }
  }, [searchQuery, communities]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadCommunities();
    loadJoinRequests();
  }, [loadCommunities, loadJoinRequests]);

  // Community CRUD Functions
  const handleCreateCommunity = async () => {
    if (!communityForm.name || !communityForm.city) {
      Alert.alert('Hata', 'İsim ve şehir zorunludur');
      return;
    }
    
    setSavingCommunity(true);
    try {
      await adminApi.createCommunity({
        name: communityForm.name,
        city: communityForm.city,
        description: communityForm.description,
      });
      Alert.alert('Başarılı', 'Topluluk oluşturuldu');
      setCreateCommunityModal(false);
      setCommunityForm({ name: '', city: '', description: '' });
      loadCommunities();
    } catch (error: any) {
      Alert.alert('Hata', error.response?.data?.detail || 'Topluluk oluşturulamadı');
    } finally {
      setSavingCommunity(false);
    }
  };

  const handleUpdateCommunity = async () => {
    if (!selectedCommunity) return;
    
    setSavingCommunity(true);
    try {
      await adminApi.updateCommunity(selectedCommunity.id, {
        name: communityForm.name,
        description: communityForm.description,
      });
      Alert.alert('Başarılı', 'Topluluk güncellendi');
      setEditCommunityModal(false);
      loadCommunities();
    } catch (error: any) {
      Alert.alert('Hata', error.response?.data?.detail || 'Güncelleme başarısız');
    } finally {
      setSavingCommunity(false);
    }
  };

  const handleDeleteCommunity = (community: Community) => {
    Alert.alert(
      'Topluluğu Sil',
      `"${community.name}" topluluğunu silmek istediğinize emin misiniz? Bu işlem geri alınamaz ve tüm alt gruplar ile mesajlar silinecektir.`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              await adminApi.deleteCommunity(community.id);
              Alert.alert('Başarılı', 'Topluluk silindi');
              loadCommunities();
            } catch (error: any) {
              Alert.alert('Hata', error.response?.data?.detail || 'Silme başarısız');
            }
          },
        },
      ]
    );
  };

  const openEditCommunity = (community: Community) => {
    setSelectedCommunity(community);
    setCommunityForm({
      name: community.name,
      city: community.city,
      description: community.description || '',
    });
    setEditCommunityModal(true);
  };

  // Members Functions
  const loadMembers = async (communityId: string) => {
    setLoadingMembers(true);
    try {
      const response = await adminApi.getCommunityMembers(communityId);
      setMembers(response.data);
    } catch (error) {
      console.error('Error loading members:', error);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleOpenMembers = async (community: Community) => {
    setSelectedCommunity(community);
    setMembersModalVisible(true);
    await loadMembers(community.id);
  };

  const handleMemberAction = async (action: string, userId: string) => {
    if (!selectedCommunity) return;

    try {
      switch (action) {
        case 'ban':
          await adminApi.banFromCommunity(selectedCommunity.id, userId);
          Alert.alert('Başarılı', 'Kullanıcı yasaklandı');
          break;
        case 'kick':
          await adminApi.kickFromCommunity(selectedCommunity.id, userId);
          Alert.alert('Başarılı', 'Kullanıcı çıkarıldı');
          break;
        case 'addSuperAdmin':
          await adminApi.addSuperAdmin(selectedCommunity.id, userId);
          Alert.alert('Başarılı', 'Süper yönetici eklendi');
          break;
        case 'removeSuperAdmin':
          await adminApi.removeSuperAdmin(selectedCommunity.id, userId);
          Alert.alert('Başarılı', 'Süper yönetici kaldırıldı');
          break;
      }
      await loadMembers(selectedCommunity.id);
      loadCommunities();
    } catch (error: any) {
      Alert.alert('Hata', error.response?.data?.detail || 'İşlem başarısız');
    }
  };

  // Subgroups Functions
  const loadSubgroups = async (communityId: string) => {
    setLoadingSubgroups(true);
    try {
      // For now, we'll just show a placeholder - subgroups are loaded with community detail
      setSubgroups([]);
    } catch (error) {
      console.error('Error loading subgroups:', error);
    } finally {
      setLoadingSubgroups(false);
    }
  };

  const handleOpenSubgroups = async (community: Community) => {
    setSelectedCommunity(community);
    setSubgroupsModalVisible(true);
    // Load subgroups for this community - we'll implement this properly
  };

  const handleUpdateSubgroup = async () => {
    if (!selectedSubgroup) return;
    
    try {
      await adminApi.updateSubgroup(selectedSubgroup.id, {
        name: subgroupForm.name,
        description: subgroupForm.description,
      });
      Alert.alert('Başarılı', 'Alt grup güncellendi');
      setEditSubgroupModal(false);
    } catch (error: any) {
      Alert.alert('Hata', error.response?.data?.detail || 'Güncelleme başarısız');
    }
  };

  const handleDeleteSubgroup = (subgroup: SubGroup) => {
    Alert.alert(
      'Alt Grubu Sil',
      `"${subgroup.name}" alt grubunu silmek istediğinize emin misiniz?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              await adminApi.deleteSubgroup(subgroup.id);
              Alert.alert('Başarılı', 'Alt grup silindi');
              loadCommunities();
            } catch (error: any) {
              Alert.alert('Hata', error.response?.data?.detail || 'Silme başarısız');
            }
          },
        },
      ]
    );
  };

  // Join Request Functions
  const handleApproveRequest = async (request: JoinRequest) => {
    try {
      await subgroupRequestApi.approve(request.subgroupId, request.userId);
      Alert.alert('Başarılı', 'Katılım isteği onaylandı');
      loadJoinRequests();
    } catch (error: any) {
      Alert.alert('Hata', error.response?.data?.detail || 'İşlem başarısız');
    }
  };

  const handleRejectRequest = async (request: JoinRequest) => {
    Alert.alert(
      'İsteği Reddet',
      `${request.userName} kullanıcısının "${request.subgroupName}" grubuna katılma isteğini reddetmek istediğinize emin misiniz?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Reddet',
          style: 'destructive',
          onPress: async () => {
            try {
              await subgroupRequestApi.reject(request.subgroupId, request.userId);
              Alert.alert('Başarılı', 'Katılım isteği reddedildi');
              loadJoinRequests();
            } catch (error: any) {
              Alert.alert('Hata', error.response?.data?.detail || 'İşlem başarısız');
            }
          },
        },
      ]
    );
  };

  // Render Functions
  const renderCommunity = ({ item }: { item: Community }) => (
    <View style={styles.communityCard}>
      <TouchableOpacity
        style={styles.communityMainContent}
        onPress={() => handleOpenMembers(item)}
      >
        <View style={styles.communityIcon}>
          <Ionicons name="people" size={24} color="#6366f1" />
        </View>
        <View style={styles.communityInfo}>
          <Text style={styles.communityName}>{item.name}</Text>
          <Text style={styles.communityCity}>
            <Ionicons name="location-outline" size={12} color="#6b7280" /> {item.city}
          </Text>
          <View style={styles.communityStats}>
            <Text style={styles.statText}>{item.memberCount} üye</Text>
            <Text style={styles.statText}>•</Text>
            <Text style={styles.statText}>{item.subGroupCount} grup</Text>
            {item.bannedCount > 0 && (
              <>
                <Text style={styles.statText}>•</Text>
                <Text style={[styles.statText, { color: '#ef4444' }]}>{item.bannedCount} yasaklı</Text>
              </>
            )}
          </View>
        </View>
      </TouchableOpacity>
      
      <View style={styles.communityActions}>
        <TouchableOpacity
          style={styles.actionIconBtn}
          onPress={() => openEditCommunity(item)}
        >
          <Ionicons name="create-outline" size={20} color="#3b82f6" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionIconBtn}
          onPress={() => handleDeleteCommunity(item)}
        >
          <Ionicons name="trash-outline" size={20} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderMember = ({ item }: { item: Member }) => (
    <View style={styles.memberCard}>
      <View style={styles.memberInfo}>
        <View style={styles.memberNameRow}>
          <Text style={styles.memberName}>{item.firstName} {item.lastName}</Text>
          {item.isSuperAdmin && (
            <View style={styles.superAdminBadge}>
              <Ionicons name="shield" size={12} color="#6366f1" />
            </View>
          )}
        </View>
        <Text style={styles.memberEmail}>{item.email}</Text>
      </View>
      <View style={styles.memberActions}>
        {item.isSuperAdmin ? (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleMemberAction('removeSuperAdmin', item.uid)}
          >
            <Ionicons name="shield-outline" size={20} color="#6b7280" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleMemberAction('addSuperAdmin', item.uid)}
          >
            <Ionicons name="shield-checkmark" size={20} color="#6366f1" />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => handleMemberAction('kick', item.uid)}
        >
          <Ionicons name="exit" size={20} color="#f59e0b" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => handleMemberAction('ban', item.uid)}
        >
          <Ionicons name="ban" size={20} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderJoinRequest = ({ item }: { item: JoinRequest }) => (
    <View style={styles.requestCard}>
      <View style={styles.requestInfo}>
        <Text style={styles.requestUserName}>{item.userName}</Text>
        <Text style={styles.requestEmail}>{item.userEmail}</Text>
        <View style={styles.requestMeta}>
          <Text style={styles.requestSubgroup}>{item.subgroupName}</Text>
          <Text style={styles.requestCity}>{item.userCity}</Text>
        </View>
      </View>
      <View style={styles.requestActions}>
        <TouchableOpacity
          style={[styles.requestActionBtn, styles.approveBtn]}
          onPress={() => handleApproveRequest(item)}
        >
          <Ionicons name="checkmark" size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.requestActionBtn, styles.rejectBtn]}
          onPress={() => handleRejectRequest(item)}
        >
          <Ionicons name="close" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderTab = (tab: TabType, label: string, icon: string, count?: number) => (
    <TouchableOpacity
      style={[styles.tab, activeTab === tab && styles.activeTab]}
      onPress={() => setActiveTab(tab)}
    >
      <Ionicons name={icon as any} size={20} color={activeTab === tab ? '#6366f1' : '#6b7280'} />
      <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{label}</Text>
      {count !== undefined && count > 0 && (
        <View style={styles.tabBadge}>
          <Text style={styles.tabBadgeText}>{count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Topluluk Yönetimi</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            setCommunityForm({ name: '', city: '', description: '' });
            setCreateCommunityModal(true);
          }}
        >
          <Ionicons name="add" size={24} color="#6366f1" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        {renderTab('communities', 'Topluluklar', 'people', communities.length)}
        {renderTab('requests', 'İstekler', 'time', joinRequests.length)}
      </View>

      {activeTab === 'communities' && (
        <>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#6b7280" />
            <TextInput
              style={styles.searchInput}
              placeholder="Topluluk veya şehir ara..."
              placeholderTextColor="#6b7280"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <FlatList
            data={filteredCommunities}
            renderItem={renderCommunity}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />
            }
          />
        </>
      )}

      {activeTab === 'requests' && (
        <FlatList
          data={joinRequests}
          renderItem={renderJoinRequest}
          keyExtractor={(item) => `${item.subgroupId}-${item.userId}`}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="checkmark-circle-outline" size={64} color="#374151" />
              <Text style={styles.emptyText}>Bekleyen istek yok</Text>
            </View>
          }
        />
      )}

      {/* Create Community Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={createCommunityModal}
        onRequestClose={() => setCreateCommunityModal(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Yeni Topluluk</Text>
              <TouchableOpacity onPress={() => setCreateCommunityModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formContainer}>
              <Text style={styles.inputLabel}>Topluluk Adı *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Örn: İstanbul Tech Girişimciler"
                placeholderTextColor="#6b7280"
                value={communityForm.name}
                onChangeText={(text) => setCommunityForm({ ...communityForm, name: text })}
              />

              <Text style={styles.inputLabel}>Şehir *</Text>
              <TouchableOpacity
                style={styles.cityPicker}
                onPress={() => setCityPickerModal(true)}
              >
                <Text style={communityForm.city ? styles.cityPickerText : styles.cityPickerPlaceholder}>
                  {communityForm.city || 'Şehir seçin'}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#6b7280" />
              </TouchableOpacity>

              <Text style={styles.inputLabel}>Açıklama</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Topluluk hakkında kısa bir açıklama..."
                placeholderTextColor="#6b7280"
                value={communityForm.description}
                onChangeText={(text) => setCommunityForm({ ...communityForm, description: text })}
                multiline
                numberOfLines={3}
              />

              <TouchableOpacity
                style={[styles.submitButton, savingCommunity && styles.submitButtonDisabled]}
                onPress={handleCreateCommunity}
                disabled={savingCommunity}
              >
                {savingCommunity ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Topluluk Oluştur</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Community Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editCommunityModal}
        onRequestClose={() => setEditCommunityModal(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Topluluğu Düzenle</Text>
              <TouchableOpacity onPress={() => setEditCommunityModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formContainer}>
              <Text style={styles.inputLabel}>Topluluk Adı</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Topluluk adı"
                placeholderTextColor="#6b7280"
                value={communityForm.name}
                onChangeText={(text) => setCommunityForm({ ...communityForm, name: text })}
              />

              <Text style={styles.inputLabel}>Şehir</Text>
              <View style={styles.disabledInput}>
                <Text style={styles.disabledText}>{communityForm.city}</Text>
              </View>
              <Text style={styles.helperText}>Şehir değiştirilemez</Text>

              <Text style={styles.inputLabel}>Açıklama</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Topluluk hakkında kısa bir açıklama..."
                placeholderTextColor="#6b7280"
                value={communityForm.description}
                onChangeText={(text) => setCommunityForm({ ...communityForm, description: text })}
                multiline
                numberOfLines={3}
              />

              <TouchableOpacity
                style={[styles.submitButton, savingCommunity && styles.submitButtonDisabled]}
                onPress={handleUpdateCommunity}
                disabled={savingCommunity}
              >
                {savingCommunity ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Güncelle</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* City Picker Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={cityPickerModal}
        onRequestClose={() => setCityPickerModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.cityPickerModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Şehir Seçin</Text>
              <TouchableOpacity onPress={() => setCityPickerModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={cities}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.cityItem}
                  onPress={() => {
                    setCommunityForm({ ...communityForm, city: item });
                    setCityPickerModal(false);
                  }}
                >
                  <Text style={styles.cityItemText}>{item}</Text>
                  {communityForm.city === item && (
                    <Ionicons name="checkmark" size={20} color="#6366f1" />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Members Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={membersModalVisible}
        onRequestClose={() => setMembersModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{selectedCommunity?.name}</Text>
                <Text style={styles.modalSubtitle}>{members.length} üye</Text>
              </View>
              <TouchableOpacity onPress={() => setMembersModalVisible(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {loadingMembers ? (
              <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 32 }} />
            ) : (
              <FlatList
                data={members}
                renderItem={renderMember}
                keyExtractor={(item) => item.uid}
                style={styles.membersList}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>Henüz üye yok</Text>
                }
              />
            )}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
    gap: 16,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#1f2937',
    gap: 6,
  },
  activeTab: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
  },
  tabText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '500',
  },
  activeTabText: {
    color: '#6366f1',
  },
  tabBadge: {
    backgroundColor: '#6366f1',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  tabBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  communityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  communityMainContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  communityIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  communityInfo: {
    flex: 1,
    marginLeft: 12,
  },
  communityName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  communityCity: {
    color: '#9ca3af',
    fontSize: 13,
    marginTop: 2,
  },
  communityStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  statText: {
    color: '#6b7280',
    fontSize: 12,
  },
  communityActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1f2937',
    justifyContent: 'center',
    alignItems: 'center',
  },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
  },
  requestInfo: {
    flex: 1,
  },
  requestUserName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  requestEmail: {
    color: '#6b7280',
    fontSize: 13,
    marginTop: 2,
  },
  requestMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  requestSubgroup: {
    color: '#6366f1',
    fontSize: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  requestCity: {
    color: '#9ca3af',
    fontSize: 12,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  requestActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  approveBtn: {
    backgroundColor: '#10b981',
  },
  rejectBtn: {
    backgroundColor: '#ef4444',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 16,
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '85%',
  },
  cityPickerModalContent: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  modalSubtitle: {
    color: '#6b7280',
    fontSize: 14,
    marginTop: 4,
  },
  formContainer: {
    maxHeight: 400,
  },
  inputLabel: {
    color: '#9ca3af',
    fontSize: 14,
    marginBottom: 8,
    marginTop: 16,
  },
  textInput: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  cityPicker: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cityPickerText: {
    color: '#fff',
    fontSize: 16,
  },
  cityPickerPlaceholder: {
    color: '#6b7280',
    fontSize: 16,
  },
  cityItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  cityItemText: {
    color: '#fff',
    fontSize: 16,
  },
  disabledInput: {
    backgroundColor: '#0a0a0a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  disabledText: {
    color: '#6b7280',
    fontSize: 16,
  },
  helperText: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 4,
  },
  submitButton: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  membersList: {
    maxHeight: 400,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  memberInfo: {
    flex: 1,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memberName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  superAdminBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    padding: 4,
    borderRadius: 4,
  },
  memberEmail: {
    color: '#6b7280',
    fontSize: 13,
    marginTop: 2,
  },
  memberActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
