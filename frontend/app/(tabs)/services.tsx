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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { serviceApi } from '../../src/services/api';
import { useAuth } from '../../src/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';

const CATEGORIES = [
  'Teknoloji',
  'Pazarlama',
  'Finans',
  'Hukuk',
  'Eğitim',
  'Tasarım',
  'Yazılım',
  'Danışmanlık',
  'Diğer',
];

interface Service {
  id: string;
  userId: string;
  userName: string;
  title: string;
  description: string;
  category: string;
  city: string;
  contactPhone: string;
  timestamp: string;
}

export default function ServicesScreen() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [creating, setCreating] = useState(false);
  const { userProfile, user } = useAuth();
  const router = useRouter();

  const handleContactService = (service: Service) => {
    if (service.userId === user?.uid) {
      Alert.alert('Bilgi', 'Kendi hizmetinize mesaj gönderemezsiniz');
      return;
    }
    // Mesajlar sayfasına yönlendir ve sohbet başlat
    router.push(`/chat/${service.userId}`);
  };

  const loadServices = useCallback(async () => {
    try {
      const response = await serviceApi.getAll();
      setServices(response.data);
    } catch (error) {
      console.error('Error loading services:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadServices();
  }, [loadServices]);

  const handleCreateService = async () => {
    if (!title || !description || !category) {
      Alert.alert('Hata', 'Lütfen tüm alanları doldurun');
      return;
    }

    setCreating(true);
    try {
      const response = await serviceApi.create({ title, description, category });
      setServices([response.data, ...services]);
      setModalVisible(false);
      setTitle('');
      setDescription('');
      setCategory('');
    } catch (error) {
      console.error('Error creating service:', error);
      Alert.alert('Hata', 'Hizmet oluşturulamadı');
    } finally {
      setCreating(false);
    }
  };

  const formatTime = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true, locale: tr });
    } catch {
      return '';
    }
  };

  const renderService = ({ item }: { item: Service }) => (
    <View style={styles.serviceCard}>
      <View style={styles.serviceHeader}>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>{item.category}</Text>
        </View>
        <Text style={styles.serviceTime}>{formatTime(item.timestamp)}</Text>
      </View>
      <Text style={styles.serviceTitle}>{item.title}</Text>
      <Text style={styles.serviceDescription}>{item.description}</Text>
      <View style={styles.serviceFooter}>
        <TouchableOpacity 
          style={styles.serviceUser}
          onPress={() => router.push(`/user/${item.userId}`)}
        >
          <View style={styles.userAvatar}>
            <Ionicons name="person" size={14} color="#9ca3af" />
          </View>
          <Text style={styles.serviceUserName}>{item.userName}</Text>
        </TouchableOpacity>
        {item.city && (
          <View style={styles.serviceLocation}>
            <Ionicons name="location-outline" size={16} color="#9ca3af" />
            <Text style={styles.serviceLocationText}>{item.city}</Text>
          </View>
        )}
      </View>
      <TouchableOpacity 
        style={styles.contactButton}
        onPress={() => handleContactService(item)}
      >
        <Ionicons name="chatbubble" size={18} color="#fff" />
        <Text style={styles.contactButtonText}>İletişime Geç</Text>
      </TouchableOpacity>
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
        <View>
          <Text style={styles.headerTitle}>Hizmetler</Text>
          <Text style={styles.headerSubtitle}>Girişimci hizmetleri</Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={services}
        renderItem={renderService}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="briefcase-outline" size={64} color="#374151" />
            <Text style={styles.emptyText}>Henüz hizmet yok</Text>
            <Text style={styles.emptySubtext}>Hizmetinizi ekleyerek başlayın!</Text>
          </View>
        }
      />

      {/* Create Service Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Yeni Hizmet Ekle</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.modalInput}
              placeholder="Hizmet Başlığı"
              placeholderTextColor="#6b7280"
              value={title}
              onChangeText={setTitle}
            />

            <TextInput
              style={[styles.modalInput, styles.textArea]}
              placeholder="Hizmet Açıklaması"
              placeholderTextColor="#6b7280"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
            />

            <Text style={styles.categoryLabel}>Kategori Seçin</Text>
            <View style={styles.categoryGrid}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryOption,
                    category === cat && styles.categoryOptionSelected,
                  ]}
                  onPress={() => setCategory(cat)}
                >
                  <Text
                    style={[
                      styles.categoryOptionText,
                      category === cat && styles.categoryOptionTextSelected,
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.submitButton, creating && styles.submitButtonDisabled]}
              onPress={handleCreateService}
              disabled={creating}
            >
              {creating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Hizmet Ekle</Text>
              )}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
  },
  serviceCard: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  categoryText: {
    color: '#6366f1',
    fontSize: 13,
    fontWeight: '500',
  },
  serviceTime: {
    color: '#6b7280',
    fontSize: 12,
  },
  serviceTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  serviceDescription: {
    color: '#9ca3af',
    fontSize: 14,
    lineHeight: 20,
  },
  serviceFooter: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 16,
  },
  serviceUser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  serviceUserName: {
    color: '#9ca3af',
    fontSize: 13,
  },
  serviceLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  serviceLocationText: {
    color: '#9ca3af',
    fontSize: 13,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366f1',
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 16,
    gap: 8,
  },
  contactButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    color: '#6b7280',
    fontSize: 14,
    marginTop: 8,
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
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  modalInput: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#fff',
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  categoryLabel: {
    color: '#9ca3af',
    fontSize: 14,
    marginBottom: 12,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  categoryOption: {
    backgroundColor: '#1f2937',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#374151',
  },
  categoryOptionSelected: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  categoryOptionText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  categoryOptionTextSelected: {
    color: '#fff',
  },
  submitButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
