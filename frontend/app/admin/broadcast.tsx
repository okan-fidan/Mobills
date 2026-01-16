import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Switch,
  FlatList,
  Modal,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../src/contexts/AuthContext';
import api from '../../src/services/api';
import { showToast } from '../../src/components/ui';

const { width } = Dimensions.get('window');

interface Community {
  id: string;
  name: string;
  city: string;
  memberCount: number;
  subGroupCount: number;
}

interface SubGroup {
  id: string;
  name: string;
  communityId: string;
  communityName: string;
  memberCount: number;
}

interface BroadcastStats {
  totalCommunities: number;
  totalSubgroups: number;
  totalMembers: number;
}

interface Template {
  id: string;
  name: string;
  title: string;
  content: string;
  icon: string;
  color: string;
}

// Hazır duyuru şablonları
const TEMPLATES: Template[] = [
  {
    id: '1',
    name: 'Hoş Geldiniz',
    title: '🎉 Topluluğumuza Hoş Geldiniz!',
    content: 'Değerli girişimciler, topluluğumuza hoş geldiniz! Burada birlikte büyüyecek, öğrenecek ve başarıya ulaşacağız. Kendinizi tanıtmayı unutmayın!',
    icon: 'happy',
    color: '#10b981',
  },
  {
    id: '2',
    name: 'Etkinlik Duyurusu',
    title: '📅 Yaklaşan Etkinlik',
    content: 'Değerli üyelerimiz,\n\n[ETKİNLİK ADI] etkinliğimiz [TARİH] tarihinde [SAAT] saatinde gerçekleşecektir.\n\n📍 Yer: [KONUM]\n\nKatılımınızı bekliyoruz!',
    icon: 'calendar',
    color: '#6366f1',
  },
  {
    id: '3',
    name: 'Önemli Duyuru',
    title: '⚠️ Önemli Duyuru',
    content: 'Değerli üyelerimiz,\n\nDikkatinize sunmak istediğimiz önemli bir güncelleme bulunmaktadır:\n\n[DUYURU İÇERİĞİ]\n\nSorularınız için bizimle iletişime geçebilirsiniz.',
    icon: 'alert-circle',
    color: '#f59e0b',
  },
  {
    id: '4',
    name: 'Haftalık Özet',
    title: '📊 Bu Hafta Neler Oldu?',
    content: 'Merhaba değerli girişimciler!\n\nBu hafta topluluğumuzda:\n\n✅ [BAŞARI 1]\n✅ [BAŞARI 2]\n✅ [BAŞARI 3]\n\nHaftaya görüşmek üzere!',
    icon: 'trending-up',
    color: '#3b82f6',
  },
  {
    id: '5',
    name: 'Networking',
    title: '🤝 Networking Fırsatı',
    content: 'Değerli girişimciler,\n\nBu hafta networking etkinliğimiz var!\n\nBirbirinizle tanışın, işbirlikleri kurun ve ağınızı genişletin.\n\nDetaylar için DM atın!',
    icon: 'people',
    color: '#8b5cf6',
  },
  {
    id: '6',
    name: 'Başarı Hikayesi',
    title: '🏆 Başarı Hikayesi',
    content: 'Topluluğumuzdan harika bir başarı hikayesi!\n\n[ÜYE ADI] arkadaşımız [BAŞARI DETAYI] başardı!\n\nTebrikler! 🎊\n\nBu ilham verici hikayeyi sizlerle paylaşmak istedik.',
    icon: 'trophy',
    color: '#eab308',
  },
];

export default function BroadcastScreen() {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [subgroups, setSubgroups] = useState<SubGroup[]>([]);
  const [stats, setStats] = useState<BroadcastStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  
  // Selection states
  const [selectedCommunities, setSelectedCommunities] = useState<Set<string>>(new Set());
  const [selectedSubgroups, setSelectedSubgroups] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(true);
  
  // Message state
  const [messageTitle, setMessageTitle] = useState('');
  const [messageContent, setMessageContent] = useState('');
  const [sendAsAnnouncement, setSendAsAnnouncement] = useState(true);
  const [sendAsMessage, setSendAsMessage] = useState(true);
  const [sendPushNotification, setSendPushNotification] = useState(true);
  
  // Schedule state
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState(new Date(Date.now() + 3600000)); // 1 saat sonra
  const [showDateModal, setShowDateModal] = useState(false);
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'compose' | 'templates' | 'scheduled' | 'history'>('compose');
  
  // History & Scheduled
  const [broadcastHistory, setBroadcastHistory] = useState<any[]>([]);
  const [scheduledBroadcasts, setScheduledBroadcasts] = useState<any[]>([]);
  
  const { userProfile, user } = useAuth();
  const router = useRouter();

  const loadData = useCallback(async () => {
    try {
      const [commRes, subgroupsRes, historyRes, scheduledRes] = await Promise.all([
        api.get('/api/admin/communities'),
        api.get('/api/admin/all-subgroups'),
        api.get('/api/admin/broadcast-history').catch(() => ({ data: [] })),
        api.get('/api/admin/scheduled-broadcasts').catch(() => ({ data: [] })),
      ]);
      
      setCommunities(commRes.data || []);
      setSubgroups(subgroupsRes.data || []);
      setBroadcastHistory(historyRes.data || []);
      setScheduledBroadcasts(scheduledRes.data || []);
      
      const totalMembers = (commRes.data || []).reduce((sum: number, c: Community) => sum + c.memberCount, 0);
      setStats({
        totalCommunities: commRes.data?.length || 0,
        totalSubgroups: subgroupsRes.data?.length || 0,
        totalMembers,
      });
      
      // Select all by default
      const allSubgroupIds = (subgroupsRes.data || []).map((s: SubGroup) => s.id);
      setSelectedSubgroups(new Set(allSubgroupIds));
      setSelectedCommunities(new Set((commRes.data || []).map((c: Community) => c.id)));
    } catch (error) {
      console.error('Error loading broadcast data:', error);
      showToast.error('Hata', 'Veriler yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedCommunities(new Set());
      setSelectedSubgroups(new Set());
    } else {
      setSelectedCommunities(new Set(communities.map(c => c.id)));
      setSelectedSubgroups(new Set(subgroups.map(s => s.id)));
    }
    setSelectAll(!selectAll);
  };

  const toggleCommunity = (id: string) => {
    const newCommSet = new Set(selectedCommunities);
    const newSubSet = new Set(selectedSubgroups);
    
    if (newCommSet.has(id)) {
      newCommSet.delete(id);
      // Remove all subgroups of this community
      subgroups.filter(s => s.communityId === id).forEach(s => newSubSet.delete(s.id));
    } else {
      newCommSet.add(id);
      // Add all subgroups of this community
      subgroups.filter(s => s.communityId === id).forEach(s => newSubSet.add(s.id));
    }
    
    setSelectedCommunities(newCommSet);
    setSelectedSubgroups(newSubSet);
    setSelectAll(false);
  };

  const applyTemplate = (template: Template) => {
    setMessageTitle(template.title);
    setMessageContent(template.content);
    setActiveTab('compose');
    showToast.success('Şablon Uygulandı', template.name);
  };

  const handleSendBroadcast = async () => {
    // Validation
    if (!messageContent.trim()) {
      Alert.alert('Hata', 'Lütfen bir mesaj içeriği girin');
      return;
    }

    if (!sendAsAnnouncement && !sendAsMessage) {
      Alert.alert('Hata', 'En az bir gönderim tipi seçmelisiniz (Duyuru veya Mesaj)');
      return;
    }

    // Get target groups
    let targetGroups: string[] = [];
    if (selectAll) {
      targetGroups = subgroups.map(s => s.id);
    } else {
      targetGroups = Array.from(selectedSubgroups);
    }

    if (targetGroups.length === 0) {
      Alert.alert('Hata', 'Lütfen en az bir grup seçin');
      return;
    }

    const confirmMessage = isScheduled 
      ? `${targetGroups.length} gruba ${formatDateTime(scheduledDate)} tarihinde duyuru gönderilecek.`
      : `${targetGroups.length} gruba hemen duyuru gönderilecek.`;

    Alert.alert(
      isScheduled ? 'Duyuruyu Zamanla' : 'Duyuru Gönder',
      `${confirmMessage}\n\nEmin misiniz?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: isScheduled ? 'Zamanla' : 'Gönder',
          style: 'default',
          onPress: async () => {
            setSending(true);
            try {
              const payload = {
                title: messageTitle.trim() || undefined,
                content: messageContent.trim(),
                targetGroups,
                sendAsAnnouncement,
                sendAsMessage,
                sendPushNotification,
              };

              let response;
              if (isScheduled) {
                response = await api.post('/api/admin/schedule-broadcast', {
                  ...payload,
                  scheduledAt: scheduledDate.toISOString(),
                });
                showToast.success('Zamanlandı', `Duyuru ${formatDateTime(scheduledDate)} için zamanlandı`);
              } else {
                response = await api.post('/api/admin/broadcast', payload);
                showToast.success('Gönderildi', `${response.data.sentCount} gruba duyuru gönderildi!`);
              }
              
              // Reset form
              setMessageTitle('');
              setMessageContent('');
              setIsScheduled(false);
              
              // Reload data
              loadData();
            } catch (error: any) {
              console.error('Broadcast error:', error);
              const msg = error.response?.data?.detail || 'Duyuru gönderilemedi';
              Alert.alert('Hata', msg);
            } finally {
              setSending(false);
            }
          },
        },
      ]
    );
  };

  const handleCancelScheduled = async (broadcastId: string) => {
    Alert.alert(
      'Zamanlanmış Duyuruyu İptal Et',
      'Bu duyuruyu iptal etmek istediğinize emin misiniz?',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'İptal Et',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/admin/scheduled-broadcasts/${broadcastId}`);
              showToast.success('İptal Edildi', 'Zamanlanmış duyuru iptal edildi');
              loadData();
            } catch (error) {
              showToast.error('Hata', 'İptal işlemi başarısız');
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDateTime = (date: Date) => {
    return date.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Date picker helpers
  const adjustDate = (days: number) => {
    const newDate = new Date(scheduledDate);
    newDate.setDate(newDate.getDate() + days);
    setScheduledDate(newDate);
  };

  const adjustHours = (hours: number) => {
    const newDate = new Date(scheduledDate);
    newDate.setHours(newDate.getHours() + hours);
    setScheduledDate(newDate);
  };

  if (!userProfile?.isAdmin) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.accessDenied}>
          <Ionicons name="lock-closed" size={64} color="#ef4444" />
          <Text style={styles.accessDeniedText}>Erişim Reddedildi</Text>
          <Text style={styles.accessDeniedSubtext}>Bu sayfaya erişim yetkiniz yok</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Geri Dön</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Yükleniyor...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Toplu Duyuru Merkezi</Text>
        <TouchableOpacity style={styles.headerButton} onPress={loadData}>
          <Ionicons name="refresh" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        {[
          { key: 'compose', icon: 'create', label: 'Oluştur' },
          { key: 'templates', icon: 'documents', label: 'Şablonlar' },
          { key: 'scheduled', icon: 'time', label: 'Zamanlanmış', count: scheduledBroadcasts.length },
          { key: 'history', icon: 'archive', label: 'Geçmiş', count: broadcastHistory.length },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.activeTab]}
            onPress={() => setActiveTab(tab.key as any)}
          >
            <Ionicons
              name={tab.icon as any}
              size={18}
              color={activeTab === tab.key ? '#6366f1' : '#6b7280'}
            />
            <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
              {tab.label}
            </Text>
            {tab.count !== undefined && tab.count > 0 && (
              <View style={[styles.tabBadge, activeTab === tab.key && styles.activeTabBadge]}>
                <Text style={styles.tabBadgeText}>{tab.count}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Compose Tab */}
      {activeTab === 'compose' && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.content}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Stats Cards */}
            <View style={styles.statsRow}>
              <LinearGradient colors={['#6366f1', '#4f46e5']} style={styles.statCard}>
                <Ionicons name="business" size={24} color="#fff" />
                <Text style={styles.statNumber}>{stats?.totalCommunities}</Text>
                <Text style={styles.statLabel}>Topluluk</Text>
              </LinearGradient>
              <LinearGradient colors={['#10b981', '#059669']} style={styles.statCard}>
                <Ionicons name="chatbubbles" size={24} color="#fff" />
                <Text style={styles.statNumber}>{stats?.totalSubgroups}</Text>
                <Text style={styles.statLabel}>Grup</Text>
              </LinearGradient>
              <LinearGradient colors={['#f59e0b', '#d97706']} style={styles.statCard}>
                <Ionicons name="people" size={24} color="#fff" />
                <Text style={styles.statNumber}>{stats?.totalMembers}</Text>
                <Text style={styles.statLabel}>Üye</Text>
              </LinearGradient>
            </View>

            {/* Target Selection */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <View style={[styles.sectionIcon, { backgroundColor: 'rgba(99, 102, 241, 0.1)' }]}>
                    <Ionicons name="locate" size={18} color="#6366f1" />
                  </View>
                  <Text style={styles.sectionTitle}>Hedef Seçimi</Text>
                </View>
                <TouchableOpacity onPress={handleSelectAll} style={styles.selectAllBtn}>
                  <Text style={styles.selectAllText}>
                    {selectAll ? 'Temizle' : 'Tümünü Seç'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.selectionInfo}>
                <Ionicons 
                  name={selectAll ? "checkmark-circle" : "ellipse-outline"} 
                  size={22} 
                  color={selectAll ? "#10b981" : "#6b7280"} 
                />
                <Text style={styles.selectionText}>
                  {selectAll 
                    ? `✓ Tüm gruplar seçili (${stats?.totalSubgroups} grup)` 
                    : `${selectedSubgroups.size} grup seçili`}
                </Text>
              </View>

              <Text style={styles.subsectionTitle}>İl Bazlı Hızlı Seçim</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.communityScroll}>
                {communities.slice(0, 20).map((community) => {
                  const isSelected = selectedCommunities.has(community.id);
                  return (
                    <TouchableOpacity
                      key={community.id}
                      style={[styles.communityChip, isSelected && styles.communityChipSelected]}
                      onPress={() => toggleCommunity(community.id)}
                    >
                      <Text style={[styles.communityChipText, isSelected && styles.communityChipTextSelected]}>
                        {community.city}
                      </Text>
                      {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Quick Templates */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <View style={[styles.sectionIcon, { backgroundColor: 'rgba(139, 92, 246, 0.1)' }]}>
                    <Ionicons name="flash" size={18} color="#8b5cf6" />
                  </View>
                  <Text style={styles.sectionTitle}>Hızlı Şablon</Text>
                </View>
                <TouchableOpacity onPress={() => setActiveTab('templates')}>
                  <Text style={styles.selectAllText}>Tümü →</Text>
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {TEMPLATES.slice(0, 4).map((template) => (
                  <TouchableOpacity
                    key={template.id}
                    style={[styles.quickTemplateCard, { borderColor: template.color }]}
                    onPress={() => applyTemplate(template)}
                  >
                    <View style={[styles.quickTemplateIcon, { backgroundColor: `${template.color}20` }]}>
                      <Ionicons name={template.icon as any} size={22} color={template.color} />
                    </View>
                    <Text style={styles.quickTemplateName}>{template.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Message Content */}
            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <View style={[styles.sectionIcon, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
                  <Ionicons name="create" size={18} color="#f59e0b" />
                </View>
                <Text style={styles.sectionTitle}>Duyuru İçeriği</Text>
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Başlık (Opsiyonel)</Text>
                <TextInput
                  style={styles.titleInput}
                  placeholder="Örn: 📢 Önemli Duyuru"
                  placeholderTextColor="#6b7280"
                  value={messageTitle}
                  onChangeText={setMessageTitle}
                  maxLength={100}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Mesaj İçeriği *</Text>
                <TextInput
                  style={styles.contentInput}
                  placeholder="Duyuru mesajınızı buraya yazın..."
                  placeholderTextColor="#6b7280"
                  value={messageContent}
                  onChangeText={setMessageContent}
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                  maxLength={1000}
                />
                <View style={styles.charCountRow}>
                  <Text style={styles.charCount}>{messageContent.length}/1000</Text>
                  {messageContent.length > 0 && (
                    <TouchableOpacity onPress={() => { setMessageTitle(''); setMessageContent(''); }}>
                      <Text style={styles.clearText}>Temizle</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>

            {/* Send Options */}
            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <View style={[styles.sectionIcon, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                  <Ionicons name="options" size={18} color="#10b981" />
                </View>
                <Text style={styles.sectionTitle}>Gönderim Seçenekleri</Text>
              </View>
              
              <View style={styles.optionRow}>
                <View style={styles.optionInfo}>
                  <View style={[styles.optionIcon, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
                    <Ionicons name="megaphone" size={20} color="#f59e0b" />
                  </View>
                  <View style={styles.optionTextContainer}>
                    <Text style={styles.optionTitle}>Duyuru Kanalı</Text>
                    <Text style={styles.optionSubtitle}>Topluluk duyuru kanalına gönder</Text>
                  </View>
                </View>
                <Switch
                  value={sendAsAnnouncement}
                  onValueChange={setSendAsAnnouncement}
                  trackColor={{ false: '#374151', true: '#6366f1' }}
                  thumbColor="#fff"
                />
              </View>

              <View style={styles.optionRow}>
                <View style={styles.optionInfo}>
                  <View style={[styles.optionIcon, { backgroundColor: 'rgba(99, 102, 241, 0.1)' }]}>
                    <Ionicons name="chatbubbles" size={20} color="#6366f1" />
                  </View>
                  <View style={styles.optionTextContainer}>
                    <Text style={styles.optionTitle}>Grup Mesajı</Text>
                    <Text style={styles.optionSubtitle}>Seçili gruplara mesaj olarak gönder</Text>
                  </View>
                </View>
                <Switch
                  value={sendAsMessage}
                  onValueChange={setSendAsMessage}
                  trackColor={{ false: '#374151', true: '#6366f1' }}
                  thumbColor="#fff"
                />
              </View>

              <View style={styles.optionRow}>
                <View style={styles.optionInfo}>
                  <View style={[styles.optionIcon, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                    <Ionicons name="notifications" size={20} color="#ef4444" />
                  </View>
                  <View style={styles.optionTextContainer}>
                    <Text style={styles.optionTitle}>Push Bildirimi</Text>
                    <Text style={styles.optionSubtitle}>Üyelere anlık bildirim gönder</Text>
                  </View>
                </View>
                <Switch
                  value={sendPushNotification}
                  onValueChange={setSendPushNotification}
                  trackColor={{ false: '#374151', true: '#6366f1' }}
                  thumbColor="#fff"
                />
              </View>
            </View>

            {/* Schedule Option */}
            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <View style={[styles.sectionIcon, { backgroundColor: 'rgba(139, 92, 246, 0.1)' }]}>
                  <Ionicons name="time" size={18} color="#8b5cf6" />
                </View>
                <Text style={styles.sectionTitle}>Zamanlama</Text>
              </View>
              
              <View style={styles.optionRow}>
                <View style={styles.optionInfo}>
                  <View style={[styles.optionIcon, { backgroundColor: 'rgba(139, 92, 246, 0.1)' }]}>
                    <Ionicons name="calendar" size={20} color="#8b5cf6" />
                  </View>
                  <View style={styles.optionTextContainer}>
                    <Text style={styles.optionTitle}>İleri Tarihli Gönder</Text>
                    <Text style={styles.optionSubtitle}>Belirli bir zamanda gönder</Text>
                  </View>
                </View>
                <Switch
                  value={isScheduled}
                  onValueChange={setIsScheduled}
                  trackColor={{ false: '#374151', true: '#8b5cf6' }}
                  thumbColor="#fff"
                />
              </View>

              {isScheduled && (
                <View style={styles.schedulePickers}>
                  <View style={styles.dateTimeRow}>
                    <TouchableOpacity style={styles.adjustBtn} onPress={() => adjustDate(-1)}>
                      <Ionicons name="remove" size={20} color="#8b5cf6" />
                    </TouchableOpacity>
                    <View style={styles.dateDisplay}>
                      <Ionicons name="calendar" size={18} color="#8b5cf6" />
                      <Text style={styles.dateText}>
                        {scheduledDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </Text>
                    </View>
                    <TouchableOpacity style={styles.adjustBtn} onPress={() => adjustDate(1)}>
                      <Ionicons name="add" size={20} color="#8b5cf6" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.dateTimeRow}>
                    <TouchableOpacity style={styles.adjustBtn} onPress={() => adjustHours(-1)}>
                      <Ionicons name="remove" size={20} color="#8b5cf6" />
                    </TouchableOpacity>
                    <View style={styles.dateDisplay}>
                      <Ionicons name="time" size={18} color="#8b5cf6" />
                      <Text style={styles.dateText}>
                        {scheduledDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                    <TouchableOpacity style={styles.adjustBtn} onPress={() => adjustHours(1)}>
                      <Ionicons name="add" size={20} color="#8b5cf6" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>

            {/* Send Button */}
            <View style={styles.sendButtonContainer}>
              <TouchableOpacity
                style={[
                  styles.sendButton, 
                  sending && styles.sendButtonDisabled,
                  isScheduled && styles.scheduleButton,
                  (!messageContent.trim() || (!sendAsAnnouncement && !sendAsMessage)) && styles.sendButtonDisabled
                ]}
                onPress={handleSendBroadcast}
                disabled={sending || !messageContent.trim() || (!sendAsAnnouncement && !sendAsMessage)}
              >
                {sending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name={isScheduled ? "time" : "send"} size={22} color="#fff" />
                    <Text style={styles.sendButtonText}>
                      {isScheduled 
                        ? 'Duyuruyu Zamanla' 
                        : selectAll 
                          ? `Tüm Gruplara Gönder (${stats?.totalSubgroups})` 
                          : `${selectedSubgroups.size} Gruba Gönder`}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <FlatList
          data={TEMPLATES}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.templatesList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.templateCard, { borderLeftColor: item.color }]}
              onPress={() => applyTemplate(item)}
              activeOpacity={0.7}
            >
              <View style={styles.templateHeader}>
                <View style={[styles.templateIconWrapper, { backgroundColor: `${item.color}20` }]}>
                  <Ionicons name={item.icon as any} size={28} color={item.color} />
                </View>
                <View style={styles.templateInfo}>
                  <Text style={styles.templateName}>{item.name}</Text>
                  <Text style={styles.templateTitle} numberOfLines={1}>{item.title}</Text>
                </View>
              </View>
              <Text style={styles.templateContent} numberOfLines={3}>{item.content}</Text>
              <TouchableOpacity 
                style={[styles.useTemplateBtn, { backgroundColor: item.color }]}
                onPress={() => applyTemplate(item)}
              >
                <Ionicons name="flash" size={16} color="#fff" />
                <Text style={styles.useTemplateBtnText}>Şablonu Kullan</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Scheduled Tab */}
      {activeTab === 'scheduled' && (
        <FlatList
          data={scheduledBroadcasts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.historyList}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrapper}>
                <Ionicons name="time-outline" size={56} color="#374151" />
              </View>
              <Text style={styles.emptyText}>Zamanlanmış duyuru yok</Text>
              <Text style={styles.emptySubtext}>İleri tarihli duyurular burada görünür</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.scheduledCard}>
              <View style={styles.scheduledHeader}>
                <View style={styles.scheduledTime}>
                  <Ionicons name="time" size={18} color="#8b5cf6" />
                  <Text style={styles.scheduledTimeText}>{formatDate(item.scheduledAt)}</Text>
                </View>
                <TouchableOpacity 
                  style={styles.cancelBtn}
                  onPress={() => handleCancelScheduled(item.id)}
                >
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                </TouchableOpacity>
              </View>
              {item.title && <Text style={styles.scheduledTitle}>{item.title}</Text>}
              <Text style={styles.scheduledContent} numberOfLines={2}>{item.content}</Text>
              <View style={styles.scheduledMeta}>
                <View style={styles.metaItem}>
                  <Ionicons name="chatbubbles-outline" size={14} color="#6b7280" />
                  <Text style={styles.metaText}>{item.targetGroups?.length || 0} grup</Text>
                </View>
              </View>
            </View>
          )}
        />
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <FlatList
          data={broadcastHistory}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.historyList}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrapper}>
                <Ionicons name="megaphone-outline" size={56} color="#374151" />
              </View>
              <Text style={styles.emptyText}>Henüz duyuru gönderilmedi</Text>
              <Text style={styles.emptySubtext}>Gönderilen duyurular burada görünür</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.historyCard}>
              <View style={styles.historyHeader}>
                <View style={styles.historyIconWrapper}>
                  <Ionicons name="megaphone" size={16} color="#f59e0b" />
                </View>
                <Text style={styles.historyDate}>{formatDate(item.sentAt)}</Text>
                {item.sendPushNotification && (
                  <View style={styles.pushBadge}>
                    <Ionicons name="notifications" size={10} color="#fff" />
                  </View>
                )}
              </View>
              {item.title && <Text style={styles.historyTitle}>{item.title}</Text>}
              <Text style={styles.historyContent} numberOfLines={3}>{item.content}</Text>
              <View style={styles.historyStats}>
                <View style={styles.historyStat}>
                  <Ionicons name="checkmark-circle" size={14} color="#10b981" />
                  <Text style={styles.historyStatText}>{item.sentCount} gruba gönderildi</Text>
                </View>
                <View style={styles.historyStat}>
                  <Ionicons name="person" size={14} color="#6b7280" />
                  <Text style={styles.historyStatText}>{item.senderName}</Text>
                </View>
              </View>
            </View>
          )}
        />
      )}
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
  loadingText: {
    color: '#9ca3af',
    marginTop: 12,
    fontSize: 14,
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
    fontWeight: '700',
    marginTop: 16,
  },
  accessDeniedSubtext: {
    color: '#6b7280',
    fontSize: 14,
    marginTop: 8,
  },
  backBtn: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
  },
  backBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },

  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
    backgroundColor: '#111827',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 6,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#6366f1',
  },
  tabText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#6366f1',
  },
  tabBadge: {
    backgroundColor: '#374151',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 18,
    alignItems: 'center',
  },
  activeTabBadge: {
    backgroundColor: '#6366f1',
  },
  tabBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },

  content: {
    flex: 1,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },

  // Section
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  selectAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: 16,
  },
  selectAllText: {
    color: '#6366f1',
    fontSize: 13,
    fontWeight: '600',
  },
  selectionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#111827',
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  selectionText: {
    color: '#e5e7eb',
    fontSize: 14,
    fontWeight: '500',
  },
  subsectionTitle: {
    fontSize: 13,
    color: '#9ca3af',
    marginBottom: 10,
    fontWeight: '500',
  },
  communityScroll: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  communityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1f2937',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#374151',
  },
  communityChipSelected: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  communityChipText: {
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: '500',
  },
  communityChipTextSelected: {
    color: '#fff',
  },

  // Quick Templates
  quickTemplateCard: {
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 16,
    marginRight: 12,
    alignItems: 'center',
    borderWidth: 2,
    width: 110,
  },
  quickTemplateIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  quickTemplateName: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Input
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  titleInput: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 14,
    color: '#fff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  contentInput: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 14,
    color: '#fff',
    fontSize: 15,
    minHeight: 140,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  charCountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  charCount: {
    color: '#6b7280',
    fontSize: 12,
  },
  clearText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '500',
  },

  // Options
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111827',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  optionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  optionIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  optionSubtitle: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 2,
  },

  // Schedule
  schedulePickers: {
    marginTop: 12,
    gap: 10,
  },
  dateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  adjustBtn: {
    width: 44,
    height: 44,
    backgroundColor: '#1f2937',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#374151',
  },
  dateDisplay: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#111827',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#8b5cf6',
  },
  dateText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },

  // Send Button
  sendButtonContainer: {
    padding: 16,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#f59e0b',
    padding: 18,
    borderRadius: 14,
  },
  scheduleButton: {
    backgroundColor: '#8b5cf6',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  // Templates List
  templatesList: {
    padding: 16,
  },
  templateCard: {
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
    borderLeftWidth: 4,
  },
  templateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  templateIconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  templateInfo: {
    flex: 1,
  },
  templateName: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  templateTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
  templateContent: {
    color: '#d1d5db',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  useTemplateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
  },
  useTemplateBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  // Scheduled
  scheduledCard: {
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#8b5cf6',
  },
  scheduledHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  scheduledTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scheduledTimeText: {
    color: '#8b5cf6',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelBtn: {
    width: 36,
    height: 36,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scheduledTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  scheduledContent: {
    color: '#d1d5db',
    fontSize: 14,
    lineHeight: 20,
  },
  scheduledMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    color: '#6b7280',
    fontSize: 13,
  },

  // History
  historyList: {
    padding: 16,
  },
  historyCard: {
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  historyIconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyDate: {
    color: '#9ca3af',
    fontSize: 13,
    flex: 1,
  },
  pushBadge: {
    backgroundColor: '#ef4444',
    borderRadius: 10,
    padding: 4,
  },
  historyTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  historyContent: {
    color: '#d1d5db',
    fontSize: 14,
    lineHeight: 20,
  },
  historyStats: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
  },
  historyStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  historyStatText: {
    color: '#6b7280',
    fontSize: 13,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyIconWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#1f2937',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  emptySubtext: {
    color: '#6b7280',
    fontSize: 14,
    marginTop: 6,
  },
});
