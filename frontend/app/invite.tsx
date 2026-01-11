import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  Share,
  Clipboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../src/contexts/AuthContext';
import api from '../src/services/api';

interface InviteLink {
  id: string;
  code: string;
  communityId: string;
  communityName: string;
  createdBy: string;
  createdAt: string;
  expiresAt?: string;
  maxUses?: number;
  uses: number;
  isActive: boolean;
}

export default function InviteScreen() {
  const router = useRouter();
  const { communityId } = useLocalSearchParams<{ communityId?: string }>();
  const { user, userProfile } = useAuth();
  
  const [inviteLinks, setInviteLinks] = useState<InviteLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Create invite form
  const [maxUses, setMaxUses] = useState('');
  const [expiresIn, setExpiresIn] = useState<'1d' | '7d' | '30d' | 'never'>('7d');

  useEffect(() => {
    loadInviteLinks();
  }, [communityId]);

  const loadInviteLinks = async () => {
    try {
      // Demo data
      const demoLinks: InviteLink[] = [
        {
          id: '1',
          code: 'ABC123XY',
          communityId: communityId || 'demo',
          communityName: 'İstanbul Girişimciler',
          createdBy: user?.uid || '',
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          maxUses: 50,
          uses: 12,
          isActive: true,
        },
        {
          id: '2',
          code: 'DEF456ZW',
          communityId: communityId || 'demo',
          communityName: 'İstanbul Girişimciler',
          createdBy: user?.uid || '',
          createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          maxUses: 100,
          uses: 100,
          isActive: false,
        },
      ];
      setInviteLinks(demoLinks);
    } catch (error) {
      console.error('Error loading invite links:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateInviteCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleCreateLink = async () => {
    setCreating(true);
    try {
      const newLink: InviteLink = {
        id: Date.now().toString(),
        code: generateInviteCode(),
        communityId: communityId || 'demo',
        communityName: 'İstanbul Girişimciler',
        createdBy: user?.uid || '',
        createdAt: new Date().toISOString(),
        expiresAt: expiresIn !== 'never' 
          ? new Date(Date.now() + (expiresIn === '1d' ? 1 : expiresIn === '7d' ? 7 : 30) * 24 * 60 * 60 * 1000).toISOString()
          : undefined,
        maxUses: maxUses ? parseInt(maxUses) : undefined,
        uses: 0,
        isActive: true,
      };
      
      setInviteLinks([newLink, ...inviteLinks]);
      setShowCreateModal(false);
      setMaxUses('');
      setExpiresIn('7d');
      
      // Auto copy and share
      const inviteUrl = `https://networksolution.app/invite/${newLink.code}`;
      await Share.share({
        message: `İstanbul Girişimciler topluluğuna katılmak için: ${inviteUrl}`,
      });
    } catch (error) {
      Alert.alert('Hata', 'Davet linki oluşturulamadı');
    } finally {
      setCreating(false);
    }
  };

  const handleCopyLink = async (code: string) => {
    const inviteUrl = `https://networksolution.app/invite/${code}`;
    await Clipboard.setString(inviteUrl);
    Alert.alert('Kopyalandı', 'Davet linki panoya kopyalandı');
  };

  const handleShareLink = async (code: string, communityName: string) => {
    const inviteUrl = `https://networksolution.app/invite/${code}`;
    try {
      await Share.share({
        message: `${communityName} topluluğuna katılmak için: ${inviteUrl}`,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleDeactivateLink = (linkId: string) => {
    Alert.alert(
      'Linki Devre Dışı Bırak',
      'Bu davet linkini devre dışı bırakmak istediğinize emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Devre Dışı Bırak',
          style: 'destructive',
          onPress: () => {
            setInviteLinks(inviteLinks.map(link =>
              link.id === linkId ? { ...link, isActive: false } : link
            ));
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const isExpired = (expiresAt?: string) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Davet Linkleri</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Info Card */}
        <View style={styles.infoCard}>
          <Ionicons name="link" size={24} color="#6366f1" />
          <Text style={styles.infoText}>
            Davet linkleri ile arkadaşlarınızı topluluğunuza kolayca davet edebilirsiniz.
          </Text>
        </View>

        {/* Invite Links */}
        {loading ? (
          <ActivityIndicator color="#6366f1" style={{ marginTop: 40 }} />
        ) : inviteLinks.length > 0 ? (
          inviteLinks.map((link) => {
            const expired = isExpired(link.expiresAt);
            const isFull = link.maxUses && link.uses >= link.maxUses;
            const isDisabled = !link.isActive || expired || isFull;

            return (
              <View key={link.id} style={[styles.linkCard, isDisabled && styles.linkCardDisabled]}>
                <View style={styles.linkHeader}>
                  <View style={styles.linkCode}>
                    <Ionicons name="link" size={18} color={isDisabled ? '#6b7280' : '#6366f1'} />
                    <Text style={[styles.linkCodeText, isDisabled && styles.disabledText]}>
                      {link.code}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, isDisabled ? styles.statusInactive : styles.statusActive]}>
                    <Text style={styles.statusText}>
                      {!link.isActive ? 'Devre Dışı' : expired ? 'Süresi Doldu' : isFull ? 'Dolu' : 'Aktif'}
                    </Text>
                  </View>
                </View>

                <View style={styles.linkStats}>
                  <View style={styles.statItem}>
                    <Ionicons name="people-outline" size={16} color="#6b7280" />
                    <Text style={styles.statText}>
                      {link.uses}{link.maxUses ? `/${link.maxUses}` : ''} kullanım
                    </Text>
                  </View>
                  {link.expiresAt && (
                    <View style={styles.statItem}>
                      <Ionicons name="time-outline" size={16} color="#6b7280" />
                      <Text style={styles.statText}>
                        {expired ? 'Süresi doldu' : `${formatDate(link.expiresAt)}'e kadar`}
                      </Text>
                    </View>
                  )}
                </View>

                {!isDisabled && (
                  <View style={styles.linkActions}>
                    <TouchableOpacity 
                      style={styles.linkActionBtn}
                      onPress={() => handleCopyLink(link.code)}
                    >
                      <Ionicons name="copy-outline" size={20} color="#6366f1" />
                      <Text style={styles.linkActionText}>Kopyala</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.linkActionBtn}
                      onPress={() => handleShareLink(link.code, link.communityName)}
                    >
                      <Ionicons name="share-outline" size={20} color="#10b981" />
                      <Text style={[styles.linkActionText, { color: '#10b981' }]}>Paylaş</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.linkActionBtn}
                      onPress={() => handleDeactivateLink(link.id)}
                    >
                      <Ionicons name="close-circle-outline" size={20} color="#ef4444" />
                      <Text style={[styles.linkActionText, { color: '#ef4444' }]}>Kapat</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="link-outline" size={48} color="#374151" />
            <Text style={styles.emptyText}>Henüz davet linki yok</Text>
            <TouchableOpacity 
              style={styles.createFirstBtn}
              onPress={() => setShowCreateModal(true)}
            >
              <Text style={styles.createFirstText}>İlk Linki Oluştur</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Create Modal */}
      <Modal visible={showCreateModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Yeni Davet Linki</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              {/* Max Uses */}
              <Text style={styles.inputLabel}>Maksimum Kullanım (opsiyonel)</Text>
              <TextInput
                style={styles.input}
                placeholder="Sınırsız"
                placeholderTextColor="#6b7280"
                value={maxUses}
                onChangeText={setMaxUses}
                keyboardType="number-pad"
              />

              {/* Expires In */}
              <Text style={styles.inputLabel}>Geçerlilik Süresi</Text>
              <View style={styles.expiresOptions}>
                {[
                  { value: '1d', label: '1 Gün' },
                  { value: '7d', label: '7 Gün' },
                  { value: '30d', label: '30 Gün' },
                  { value: 'never', label: 'Süresiz' },
                ].map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.expiresOption, expiresIn === option.value && styles.expiresOptionActive]}
                    onPress={() => setExpiresIn(option.value as any)}
                  >
                    <Text style={[styles.expiresOptionText, expiresIn === option.value && styles.expiresOptionTextActive]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.createBtn, creating && styles.disabledBtn]}
                onPress={handleCreateLink}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="add-circle" size={20} color="#fff" />
                    <Text style={styles.createBtnText}>Link Oluştur ve Paylaş</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1f2937' },
  backButton: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#fff' },
  addButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', backgroundColor: '#6366f1', borderRadius: 20 },
  content: { flex: 1, padding: 16 },
  infoCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(99, 102, 241, 0.1)', padding: 16, borderRadius: 12, marginBottom: 20, gap: 12 },
  infoText: { flex: 1, color: '#9ca3af', fontSize: 14, lineHeight: 20 },
  linkCard: { backgroundColor: '#111827', borderRadius: 16, padding: 16, marginBottom: 12 },
  linkCardDisabled: { opacity: 0.6 },
  linkHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  linkCode: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  linkCodeText: { color: '#fff', fontSize: 18, fontWeight: '600', fontFamily: 'monospace' },
  disabledText: { color: '#6b7280' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusActive: { backgroundColor: 'rgba(16, 185, 129, 0.2)' },
  statusInactive: { backgroundColor: 'rgba(107, 114, 128, 0.2)' },
  statusText: { fontSize: 12, fontWeight: '600', color: '#10b981' },
  linkStats: { flexDirection: 'row', gap: 20, marginBottom: 16 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statText: { color: '#6b7280', fontSize: 13 },
  linkActions: { flexDirection: 'row', justifyContent: 'space-around', borderTopWidth: 1, borderTopColor: '#1f2937', paddingTop: 12 },
  linkActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8 },
  linkActionText: { color: '#6366f1', fontSize: 14, fontWeight: '500' },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: '#6b7280', fontSize: 16, marginTop: 16, marginBottom: 20 },
  createFirstBtn: { backgroundColor: '#6366f1', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 },
  createFirstText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1f2937', borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#374151' },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: '600' },
  modalBody: { padding: 20 },
  inputLabel: { color: '#9ca3af', fontSize: 14, marginBottom: 8 },
  input: { backgroundColor: '#374151', borderRadius: 12, padding: 14, color: '#fff', fontSize: 16, marginBottom: 20 },
  expiresOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  expiresOption: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#374151' },
  expiresOptionActive: { backgroundColor: '#6366f1' },
  expiresOptionText: { color: '#9ca3af', fontSize: 14 },
  expiresOptionTextActive: { color: '#fff', fontWeight: '600' },
  createBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#6366f1', padding: 16, borderRadius: 12, gap: 8 },
  disabledBtn: { opacity: 0.6 },
  createBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
