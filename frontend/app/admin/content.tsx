import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Modal,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../src/services/api';
import { communityApi } from '../../src/services/api';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';

interface Community {
  id: string;
  name: string;
  city: string;
  subGroupsList?: SubGroup[];
}

interface SubGroup {
  id: string;
  name: string;
  memberCount: number;
}

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  type: string;
  isPinned: boolean;
  timestamp: string;
}

export default function AdminContentScreen() {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);
  const [selectedSubgroup, setSelectedSubgroup] = useState<SubGroup | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [subgroupModalVisible, setSubgroupModalVisible] = useState(false);
  const [messagesModalVisible, setMessagesModalVisible] = useState(false);
  const router = useRouter();

  const loadCommunities = useCallback(async () => {
    try {
      const response = await api.get('/api/admin/communities');
      setCommunities(response.data);
    } catch (error) {
      console.error('Error loading communities:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCommunities();
  }, [loadCommunities]);

  const loadCommunityDetails = async (communityId: string) => {
    try {
      const response = await communityApi.getOne(communityId);
      return response.data;
    } catch (error) {
      console.error('Error loading community details:', error);
      return null;
    }
  };

  const handleSelectCommunity = async (community: Community) => {
    const details = await loadCommunityDetails(community.id);
    if (details) {
      setSelectedCommunity(details);
      setSubgroupModalVisible(true);
    }
  };

  const handleSelectSubgroup = async (subgroup: SubGroup) => {
    setSelectedSubgroup(subgroup);
    setSubgroupModalVisible(false);
    setMessagesModalVisible(true);
    setLoadingMessages(true);

    try {
      const response = await api.get(`/api/subgroups/${subgroup.id}/messages`);
      setMessages(response.data.reverse());
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handlePinMessage = async (messageId: string) => {
    try {
      const response = await api.post(`/admin/messages/${messageId}/pin`);
      Alert.alert('Başarılı', response.data.message);
      // Refresh messages
      if (selectedSubgroup) {
        const messagesRes = await api.get(`/api/subgroups/${selectedSubgroup.id}/messages`);
        setMessages(messagesRes.data.reverse());
      }
    } catch (error: any) {
      Alert.alert('Hata', error.response?.data?.detail || 'İşlem başarısız');
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    Alert.alert(
      'Mesajı Sil',
      'Bu mesajı silmek istediğinize emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/admin/messages/${messageId}`);
              Alert.alert('Başarılı', 'Mesaj silindi');
              if (selectedSubgroup) {
                const messagesRes = await api.get(`/api/subgroups/${selectedSubgroup.id}/messages`);
                setMessages(messagesRes.data.reverse());
              }
            } catch (error: any) {
              Alert.alert('Hata', error.response?.data?.detail || 'İşlem başarısız');
            }
          },
        },
      ]
    );
  };

  const formatTime = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true, locale: tr });
    } catch {
      return '';
    }
  };

  const renderCommunity = ({ item }: { item: Community }) => (
    <TouchableOpacity
      style={styles.communityCard}
      onPress={() => handleSelectCommunity(item)}
    >
      <View style={styles.communityIcon}>
        <Ionicons name="chatbubbles" size={24} color="#f59e0b" />
      </View>
      <View style={styles.communityInfo}>
        <Text style={styles.communityName}>{item.name}</Text>
        <Text style={styles.communityCity}>{item.city}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#6b7280" />
    </TouchableOpacity>
  );

  const renderSubgroup = ({ item }: { item: SubGroup }) => (
    <TouchableOpacity
      style={styles.subgroupCard}
      onPress={() => handleSelectSubgroup(item)}
    >
      <View style={styles.subgroupIcon}>
        <Ionicons name="chatbubble" size={20} color="#6366f1" />
      </View>
      <View style={styles.subgroupInfo}>
        <Text style={styles.subgroupName}>{item.name}</Text>
        <Text style={styles.subgroupMembers}>{item.memberCount} üye</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#6b7280" />
    </TouchableOpacity>
  );

  const renderMessage = ({ item }: { item: Message }) => (
    <View style={[styles.messageCard, item.isPinned && styles.pinnedMessage]}>
      <View style={styles.messageHeader}>
        <Text style={styles.senderName}>{item.senderName}</Text>
        <Text style={styles.messageTime}>{formatTime(item.timestamp)}</Text>
      </View>
      <Text style={styles.messageContent}>{item.content}</Text>
      <View style={styles.messageActions}>
        <TouchableOpacity
          style={styles.messageActionBtn}
          onPress={() => handlePinMessage(item.id)}
        >
          <Ionicons
            name={item.isPinned ? 'pin' : 'pin-outline'}
            size={18}
            color={item.isPinned ? '#f59e0b' : '#6b7280'}
          />
          <Text style={[styles.actionBtnText, item.isPinned && { color: '#f59e0b' }]}>
            {item.isPinned ? 'Sabitlemeyi Kaldır' : 'Sabitle'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.messageActionBtn}
          onPress={() => handleDeleteMessage(item.id)}
        >
          <Ionicons name="trash-outline" size={18} color="#ef4444" />
          <Text style={[styles.actionBtnText, { color: '#ef4444' }]}>Sil</Text>
        </TouchableOpacity>
      </View>
    </View>
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
        <Text style={styles.headerTitle}>İçerik Yönetimi</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.infoCard}>
        <Ionicons name="information-circle" size={24} color="#6366f1" />
        <Text style={styles.infoText}>
          Topluluk seçin, ardından alt grubu seçerek mesajları yönetin.
          Mesajları silebilir veya sabitleyebilirsiniz.
        </Text>
      </View>

      <FlatList
        data={communities}
        renderItem={renderCommunity}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
      />

      {/* Subgroups Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={subgroupModalVisible}
        onRequestClose={() => setSubgroupModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedCommunity?.name}</Text>
              <TouchableOpacity onPress={() => setSubgroupModalVisible(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>Alt Gruplar</Text>

            <FlatList
              data={selectedCommunity?.subGroupsList || []}
              renderItem={renderSubgroup}
              keyExtractor={(item) => item.id}
              style={styles.subgroupList}
              ListEmptyComponent={
                <Text style={styles.emptyText}>Alt grup yok</Text>
              }
            />
          </View>
        </View>
      </Modal>

      {/* Messages Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={messagesModalVisible}
        onRequestClose={() => setMessagesModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{selectedSubgroup?.name}</Text>
                <Text style={styles.modalSubtitle}>{messages.length} mesaj</Text>
              </View>
              <TouchableOpacity onPress={() => setMessagesModalVisible(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {loadingMessages ? (
              <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 32 }} />
            ) : (
              <FlatList
                data={messages}
                renderItem={renderMessage}
                keyExtractor={(item) => item.id}
                style={styles.messagesList}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>Mesaj yok</Text>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  infoText: {
    flex: 1,
    color: '#9ca3af',
    fontSize: 14,
    lineHeight: 20,
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
  communityIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
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
    color: '#6b7280',
    fontSize: 13,
    marginTop: 2,
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
  subgroupList: {
    maxHeight: 300,
  },
  subgroupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  subgroupIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  subgroupInfo: {
    flex: 1,
    marginLeft: 12,
  },
  subgroupName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  subgroupMembers: {
    color: '#6b7280',
    fontSize: 13,
  },
  messagesList: {
    maxHeight: 500,
  },
  messageCard: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  pinnedMessage: {
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  senderName: {
    color: '#6366f1',
    fontSize: 14,
    fontWeight: '600',
  },
  messageTime: {
    color: '#6b7280',
    fontSize: 12,
  },
  messageContent: {
    color: '#e5e7eb',
    fontSize: 14,
    lineHeight: 20,
  },
  messageActions: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 16,
  },
  messageActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionBtnText: {
    color: '#6b7280',
    fontSize: 13,
  },
  emptyText: {
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 32,
  },
});
