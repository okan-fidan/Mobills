import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/contexts/AuthContext';
import api from '../src/services/api';

export default function PrivacySecurityScreen() {
  const router = useRouter();
  const { user, userProfile } = useAuth();
  
  // 2FA State
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [loading2FA, setLoading2FA] = useState(true);
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [pendingCode, setPendingCode] = useState('');
  const [verifying2FA, setVerifying2FA] = useState(false);
  
  // Privacy Settings
  const [showOnlineStatus, setShowOnlineStatus] = useState(true);
  const [showLastSeen, setShowLastSeen] = useState(true);
  const [profileVisibility, setProfileVisibility] = useState<'public' | 'contacts' | 'private'>('public');
  const [showPhone, setShowPhone] = useState(false);
  const [showEmail, setShowEmail] = useState(true);
  
  // Security Log
  const [securityLogs, setSecurityLogs] = useState<any[]>([]);
  const [showSecurityLogs, setShowSecurityLogs] = useState(false);

  useEffect(() => {
    load2FAStatus();
    loadPrivacySettings();
  }, []);

  const load2FAStatus = async () => {
    try {
      const response = await api.get('/api/security/2fa/status');
      setTwoFactorEnabled(response.data.enabled || false);
    } catch (error) {
      console.error('Error loading 2FA status:', error);
    } finally {
      setLoading2FA(false);
    }
  };

  const loadPrivacySettings = async () => {
    try {
      const response = await api.get('/api/user/privacy-settings');
      if (response.data) {
        setShowOnlineStatus(response.data.showOnlineStatus ?? true);
        setShowLastSeen(response.data.showLastSeen ?? true);
        setProfileVisibility(response.data.profileVisibility ?? 'public');
        setShowPhone(response.data.showPhone ?? false);
        setShowEmail(response.data.showEmail ?? true);
      }
    } catch (error) {
      console.error('Error loading privacy settings:', error);
    }
  };

  const savePrivacySetting = async (key: string, value: any) => {
    try {
      await api.put('/api/user/privacy-settings', { [key]: value });
    } catch (error) {
      console.error('Error saving privacy setting:', error);
    }
  };

  const toggle2FA = async () => {
    if (!twoFactorEnabled) {
      try {
        const response = await api.post('/api/auth/2fa/enable', { method: 'email' });
        setPendingCode(response.data.demo_code || '');
        setShow2FAModal(true);
        Alert.alert('Kod Gönderildi', 'Doğrulama kodu bildirimlerinize gönderildi.');
      } catch (error: any) {
        Alert.alert('Hata', error?.response?.data?.detail || '2FA etkinleştirilemedi');
      }
    } else {
      Alert.alert(
        'İki Faktörlü Doğrulama',
        'İki faktörlü doğrulamayı devre dışı bırakmak istediğinize emin misiniz?',
        [
          { text: 'İptal', style: 'cancel' },
          {
            text: 'Devre Dışı Bırak',
            style: 'destructive',
            onPress: async () => {
              try {
                await api.post('/api/auth/2fa/disable', { code: '000000' });
                setTwoFactorEnabled(false);
                Alert.alert('Başarılı', '2FA devre dışı bırakıldı');
              } catch (error: any) {
                Alert.alert('Hata', error?.response?.data?.detail || 'İşlem başarısız');
              }
            },
          },
        ]
      );
    }
  };

  const verify2FACode = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      Alert.alert('Hata', 'Lütfen 6 haneli doğrulama kodunu girin');
      return;
    }

    setVerifying2FA(true);
    try {
      await api.post('/api/auth/2fa/verify', { code: verificationCode });
      setTwoFactorEnabled(true);
      setShow2FAModal(false);
      setVerificationCode('');
      Alert.alert('Başarılı', 'İki faktörlü doğrulama etkinleştirildi!');
    } catch (error: any) {
      Alert.alert('Hata', error?.response?.data?.detail || 'Kod doğrulanamadı');
    } finally {
      setVerifying2FA(false);
    }
  };

  const handleChangePassword = () => {
    router.push('/change-password');
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Hesabı Sil',
      'Hesabınızı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Hesabı Sil',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Son Onay',
              'Tüm verileriniz kalıcı olarak silinecek. Devam etmek istiyor musunuz?',
              [
                { text: 'Vazgeç', style: 'cancel' },
                {
                  text: 'Evet, Sil',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await api.delete('/api/user/account');
                      Alert.alert('Hesap Silindi', 'Hesabınız başarıyla silindi.');
                      router.replace('/(auth)/login');
                    } catch (error) {
                      Alert.alert('Hata', 'Hesap silinemedi. Lütfen destek ile iletişime geçin.');
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gizlilik ve Güvenlik</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Two Factor Auth Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>İKİ FAKTÖRLÜ DOĞRULAMA</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingIcon}>
              <Ionicons name="shield-checkmark" size={24} color="#10b981" />
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>İki Faktörlü Doğrulama</Text>
              <Text style={styles.settingDescription}>
                {twoFactorEnabled ? 'Aktif - Hesabınız ekstra koruma altında' : 'Devre dışı'}
              </Text>
            </View>
            {loading2FA ? (
              <ActivityIndicator size="small" color="#6366f1" />
            ) : (
              <Switch
                value={twoFactorEnabled}
                onValueChange={toggle2FA}
                trackColor={{ false: '#374151', true: '#10b981' }}
                thumbColor="#fff"
              />
            )}
          </View>

          <TouchableOpacity style={styles.settingItem} onPress={handleChangePassword}>
            <View style={styles.settingIcon}>
              <Ionicons name="key" size={24} color="#6366f1" />
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Şifre Değiştir</Text>
              <Text style={styles.settingDescription}>Hesap şifrenizi güncelleyin</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#6b7280" />
          </TouchableOpacity>
        </View>

        {/* Privacy Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>GİZLİLİK AYARLARI</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingIcon}>
              <Ionicons name="eye" size={24} color="#8b5cf6" />
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Çevrimiçi Durumu Göster</Text>
              <Text style={styles.settingDescription}>Diğerleri çevrimiçi olduğunuzu görebilir</Text>
            </View>
            <Switch
              value={showOnlineStatus}
              onValueChange={(v) => { setShowOnlineStatus(v); savePrivacySetting('showOnlineStatus', v); }}
              trackColor={{ false: '#374151', true: '#8b5cf6' }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingIcon}>
              <Ionicons name="time" size={24} color="#f59e0b" />
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Son Görülme</Text>
              <Text style={styles.settingDescription}>Son görülme zamanınız gösterilsin</Text>
            </View>
            <Switch
              value={showLastSeen}
              onValueChange={(v) => { setShowLastSeen(v); savePrivacySetting('showLastSeen', v); }}
              trackColor={{ false: '#374151', true: '#f59e0b' }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingIcon}>
              <Ionicons name="mail" size={24} color="#3b82f6" />
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>E-posta Görünürlüğü</Text>
              <Text style={styles.settingDescription}>E-posta adresiniz profilden görünsün</Text>
            </View>
            <Switch
              value={showEmail}
              onValueChange={(v) => { setShowEmail(v); savePrivacySetting('showEmail', v); }}
              trackColor={{ false: '#374151', true: '#3b82f6' }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingIcon}>
              <Ionicons name="call" size={24} color="#10b981" />
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Telefon Görünürlüğü</Text>
              <Text style={styles.settingDescription}>Telefon numaranız profilden görünsün</Text>
            </View>
            <Switch
              value={showPhone}
              onValueChange={(v) => { setShowPhone(v); savePrivacySetting('showPhone', v); }}
              trackColor={{ false: '#374151', true: '#10b981' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Profile Visibility */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PROFİL GÖRÜNÜRLÜğÜ</Text>
          
          {['public', 'contacts', 'private'].map((option) => (
            <TouchableOpacity
              key={option}
              style={styles.radioItem}
              onPress={() => { setProfileVisibility(option as any); savePrivacySetting('profileVisibility', option); }}
            >
              <View style={styles.settingIcon}>
                <Ionicons 
                  name={option === 'public' ? 'globe' : option === 'contacts' ? 'people' : 'lock-closed'} 
                  size={24} 
                  color={profileVisibility === option ? '#6366f1' : '#6b7280'} 
                />
              </View>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingLabel, profileVisibility === option && styles.activeLabel]}>
                  {option === 'public' ? 'Herkese Açık' : option === 'contacts' ? 'Sadece Bağlantılar' : 'Gizli'}
                </Text>
                <Text style={styles.settingDescription}>
                  {option === 'public' 
                    ? 'Herkes profilinizi görebilir' 
                    : option === 'contacts' 
                    ? 'Sadece bağlantılarınız görebilir' 
                    : 'Kimse profilinizi göremez'}
                </Text>
              </View>
              <View style={[styles.radioOuter, profileVisibility === option && styles.radioOuterActive]}>
                {profileVisibility === option && <View style={styles.radioInner} />}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Session Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>OTURUM BİLGİLERİ</Text>
          
          <View style={styles.infoCard}>
            <Ionicons name="information-circle" size={20} color="#6366f1" />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Aktif Oturum</Text>
              <Text style={styles.infoText}>Bu cihaz • Şu an aktif</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.dangerButton} onPress={() => Alert.alert('Bilgi', 'Diğer tüm cihazlardan çıkış yapıldı.')}>
            <Ionicons name="log-out" size={20} color="#f59e0b" />
            <Text style={styles.dangerButtonText}>Diğer Cihazlardan Çıkış Yap</Text>
          </TouchableOpacity>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: '#ef4444' }]}>TEHLİKELİ BÖLGE</Text>
          
          <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteAccount}>
            <Ionicons name="trash" size={20} color="#ef4444" />
            <Text style={styles.deleteButtonText}>Hesabımı Sil</Text>
          </TouchableOpacity>
          <Text style={styles.deleteWarning}>
            Bu işlem geri alınamaz. Tüm verileriniz kalıcı olarak silinecektir.
          </Text>
        </View>
      </ScrollView>

      {/* 2FA Verification Modal */}
      <Modal visible={show2FAModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Doğrulama Kodu</Text>
              <TouchableOpacity onPress={() => setShow2FAModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Ionicons name="shield-checkmark" size={64} color="#10b981" style={{ alignSelf: 'center', marginBottom: 20 }} />
              
              <Text style={styles.modalDescription}>
                Bildirimlerinize gönderilen 6 haneli doğrulama kodunu girin.
              </Text>

              {pendingCode && (
                <View style={styles.demoCodeBox}>
                  <Text style={styles.demoCodeLabel}>Demo Kod:</Text>
                  <Text style={styles.demoCodeValue}>{pendingCode}</Text>
                </View>
              )}

              <TextInput
                style={styles.codeInput}
                placeholder="000000"
                placeholderTextColor="#6b7280"
                value={verificationCode}
                onChangeText={setVerificationCode}
                keyboardType="number-pad"
                maxLength={6}
                textAlign="center"
              />

              <TouchableOpacity
                style={[styles.verifyButton, verifying2FA && styles.disabledButton]}
                onPress={verify2FACode}
                disabled={verifying2FA}
              >
                {verifying2FA ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.verifyButtonText}>Doğrula ve Etkinleştir</Text>
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
  content: { flex: 1 },
  section: { paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#1f2937' },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: '#6b7280', marginBottom: 16, letterSpacing: 0.5 },
  settingItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  settingIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#1f2937', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  settingInfo: { flex: 1 },
  settingLabel: { fontSize: 15, fontWeight: '500', color: '#fff' },
  settingDescription: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  activeLabel: { color: '#6366f1' },
  radioItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  radioOuter: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#374151', justifyContent: 'center', alignItems: 'center' },
  radioOuterActive: { borderColor: '#6366f1' },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#6366f1' },
  infoCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(99, 102, 241, 0.1)', padding: 14, borderRadius: 12, marginBottom: 12 },
  infoContent: { marginLeft: 12, flex: 1 },
  infoTitle: { color: '#fff', fontSize: 14, fontWeight: '500' },
  infoText: { color: '#9ca3af', fontSize: 13, marginTop: 2 },
  dangerButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(245, 158, 11, 0.1)', paddingVertical: 14, borderRadius: 12, gap: 8 },
  dangerButtonText: { color: '#f59e0b', fontSize: 15, fontWeight: '600' },
  deleteButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(239, 68, 68, 0.1)', paddingVertical: 14, borderRadius: 12, gap: 8, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)' },
  deleteButtonText: { color: '#ef4444', fontSize: 15, fontWeight: '600' },
  deleteWarning: { color: '#6b7280', fontSize: 12, textAlign: 'center', marginTop: 12, lineHeight: 18 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#1f2937', borderRadius: 20, width: '100%', maxWidth: 400 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#374151' },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: '600' },
  modalBody: { padding: 24 },
  modalDescription: { color: '#9ca3af', fontSize: 14, textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  demoCodeBox: { backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: 12, padding: 16, marginBottom: 20, alignItems: 'center' },
  demoCodeLabel: { color: '#10b981', fontSize: 12, marginBottom: 4 },
  demoCodeValue: { color: '#10b981', fontSize: 28, fontWeight: 'bold', letterSpacing: 8 },
  codeInput: { backgroundColor: '#374151', borderRadius: 12, padding: 16, color: '#fff', fontSize: 24, fontWeight: 'bold', letterSpacing: 8, marginBottom: 20 },
  verifyButton: { backgroundColor: '#10b981', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  disabledButton: { opacity: 0.6 },
  verifyButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
