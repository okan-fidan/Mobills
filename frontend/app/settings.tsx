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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../src/contexts/AuthContext';
import { useTheme } from '../src/contexts/ThemeContext';
import api from '../src/services/api';

interface NotificationSettings {
  messages: boolean;
  groups: boolean;
  communities: boolean;
  announcements: boolean;
  events: boolean;
  marketing: boolean;
}

export default function SettingsScreen() {
  const router = useRouter();
  const { signOut, userProfile } = useAuth();
  const { theme, setTheme, isDark, colors } = useTheme();
  
  // Notification settings
  const [notifications, setNotifications] = useState<NotificationSettings>({
    messages: true,
    groups: true,
    communities: true,
    announcements: true,
    events: true,
    marketing: false,
  });
  
  // 2FA state
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [pendingCode, setPendingCode] = useState('');
  const [verifying2FA, setVerifying2FA] = useState(false);

  useEffect(() => {
    loadSettings();
    load2FAStatus();
  }, []);

  const load2FAStatus = async () => {
    try {
      const response = await api.get('/api/security/2fa/status');
      setTwoFactorEnabled(response.data.enabled || false);
    } catch (error) {
      console.error('Error loading 2FA status:', error);
    }
  };

  const loadSettings = async () => {
    try {
      const savedNotifications = await AsyncStorage.getItem('notification_settings');
      if (savedNotifications) setNotifications(JSON.parse(savedNotifications));

      const saved2FA = await AsyncStorage.getItem('2fa_enabled');
      if (saved2FA) setTwoFactorEnabled(saved2FA === 'true');
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
  };

  const saveNotificationSetting = async (key: keyof NotificationSettings, value: boolean) => {
    const newSettings = { ...notifications, [key]: value };
    setNotifications(newSettings);
    try {
      await AsyncStorage.setItem('notification_settings', JSON.stringify(newSettings));
    } catch (error) {
      console.error('Error saving notification settings:', error);
    }
  };

  const toggle2FA = async () => {
    if (!twoFactorEnabled) {
      // Enable 2FA - QR kod ile kurulum
      try {
        const response = await api.post('/api/security/2fa/setup');
        setPendingCode(response.data.secret || '');
        // QR kod URL'sini sakla
        AsyncStorage.setItem('2fa_qr', response.data.qrCode || '');
        setShow2FAModal(true);
        Alert.alert('2FA Kurulumu', 'Authenticator uygulamanızla QR kodu tarayın veya kodu manuel girin.');
      } catch (error: any) {
        Alert.alert('Hata', error?.response?.data?.detail || '2FA etkinleştirilemedi');
      }
    } else {
      // Disable 2FA
      Alert.alert(
        'İki Faktörlü Doğrulama',
        'İki faktörlü doğrulamayı devre dışı bırakmak istediğinize emin misiniz?',
        [
          { text: 'İptal', style: 'cancel' },
          {
            text: 'Devre Dışı Bırak',
            style: 'destructive',
            onPress: async () => {
              setShow2FAModal(true);
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
      if (!twoFactorEnabled) {
        // Enable 2FA
        await api.post('/api/security/2fa/verify', { code: verificationCode });
        setTwoFactorEnabled(true);
        Alert.alert('Başarılı', 'İki faktörlü doğrulama etkinleştirildi!');
      } else {
        // Disable 2FA
        await api.post('/api/security/2fa/disable', { code: verificationCode });
        setTwoFactorEnabled(false);
        Alert.alert('Başarılı', '2FA devre dışı bırakıldı');
      }
      setShow2FAModal(false);
      setVerificationCode('');
    } catch (error: any) {
      Alert.alert('Hata', error?.response?.data?.detail || 'Kod doğrulanamadı');
    } finally {
      setVerifying2FA(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Çıkış Yap',
      'Hesabınızdan çıkış yapmak istediğinize emin misiniz?',
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

  const SettingItem = ({ 
    icon, 
    title, 
    subtitle, 
    rightElement,
    onPress,
    danger = false,
  }: {
    icon: string;
    title: string;
    subtitle?: string;
    rightElement?: React.ReactNode;
    onPress?: () => void;
    danger?: boolean;
  }) => (
    <TouchableOpacity 
      style={styles.settingItem} 
      onPress={onPress}
      disabled={!onPress && !rightElement}
    >
      <View style={[styles.settingIcon, danger && styles.dangerIcon]}>
        <Ionicons name={icon as any} size={22} color={danger ? '#ef4444' : '#6366f1'} />
      </View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingTitle, danger && styles.dangerText]}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      {rightElement || (onPress && <Ionicons name="chevron-forward" size={20} color="#6b7280" />)}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ayarlar</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Görünüm */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Görünüm</Text>
          
          <View style={styles.themeSelector}>
            <TouchableOpacity 
              style={[styles.themeOption, theme === 'light' && styles.themeOptionActive]}
              onPress={() => saveTheme('light')}
            >
              <Ionicons name="sunny" size={24} color={theme === 'light' ? '#6366f1' : '#6b7280'} />
              <Text style={[styles.themeText, theme === 'light' && styles.themeTextActive]}>Açık</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.themeOption, theme === 'dark' && styles.themeOptionActive]}
              onPress={() => saveTheme('dark')}
            >
              <Ionicons name="moon" size={24} color={theme === 'dark' ? '#6366f1' : '#6b7280'} />
              <Text style={[styles.themeText, theme === 'dark' && styles.themeTextActive]}>Koyu</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.themeOption, theme === 'system' && styles.themeOptionActive]}
              onPress={() => saveTheme('system')}
            >
              <Ionicons name="phone-portrait" size={24} color={theme === 'system' ? '#6366f1' : '#6b7280'} />
              <Text style={[styles.themeText, theme === 'system' && styles.themeTextActive]}>Sistem</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bildirimler */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bildirimler</Text>
          
          <SettingItem
            icon="chatbubble"
            title="Mesajlar"
            subtitle="Yeni mesaj bildirimleri"
            rightElement={
              <Switch
                value={notifications.messages}
                onValueChange={(v) => saveNotificationSetting('messages', v)}
                trackColor={{ false: '#374151', true: '#6366f1' }}
                thumbColor="#fff"
              />
            }
          />
          
          <SettingItem
            icon="people"
            title="Gruplar"
            subtitle="Grup mesajları ve aktiviteleri"
            rightElement={
              <Switch
                value={notifications.groups}
                onValueChange={(v) => saveNotificationSetting('groups', v)}
                trackColor={{ false: '#374151', true: '#6366f1' }}
                thumbColor="#fff"
              />
            }
          />
          
          <SettingItem
            icon="business"
            title="Topluluklar"
            subtitle="Topluluk güncellemeleri"
            rightElement={
              <Switch
                value={notifications.communities}
                onValueChange={(v) => saveNotificationSetting('communities', v)}
                trackColor={{ false: '#374151', true: '#6366f1' }}
                thumbColor="#fff"
              />
            }
          />
          
          <SettingItem
            icon="megaphone"
            title="Duyurular"
            subtitle="Topluluk duyuruları"
            rightElement={
              <Switch
                value={notifications.announcements}
                onValueChange={(v) => saveNotificationSetting('announcements', v)}
                trackColor={{ false: '#374151', true: '#6366f1' }}
                thumbColor="#fff"
              />
            }
          />
          
          <SettingItem
            icon="calendar"
            title="Etkinlikler"
            subtitle="Etkinlik hatırlatmaları"
            rightElement={
              <Switch
                value={notifications.events}
                onValueChange={(v) => saveNotificationSetting('events', v)}
                trackColor={{ false: '#374151', true: '#6366f1' }}
                thumbColor="#fff"
              />
            }
          />
        </View>

        {/* Güvenlik */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Güvenlik</Text>
          
          <SettingItem
            icon="shield-checkmark"
            title="İki Faktörlü Doğrulama"
            subtitle={twoFactorEnabled ? 'Etkin' : 'Devre dışı'}
            rightElement={
              <Switch
                value={twoFactorEnabled}
                onValueChange={toggle2FA}
                trackColor={{ false: '#374151', true: '#10b981' }}
                thumbColor="#fff"
              />
            }
          />
          
          <SettingItem
            icon="key"
            title="Şifre Değiştir"
            onPress={() => router.push('/change-password')}
          />
          
          <SettingItem
            icon="lock-closed"
            title="Gizlilik Ayarları"
            onPress={() => router.push('/privacy-security')}
          />
        </View>

        {/* Hesap */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hesap</Text>
          
          <SettingItem
            icon="person"
            title="Profil Düzenle"
            onPress={() => router.push('/profile/edit')}
          />
          
          <SettingItem
            icon="notifications"
            title="Bildirim Ayarları"
            onPress={() => router.push('/notification-settings')}
          />
          
          <SettingItem
            icon="chatbubble-ellipses"
            title="Geri Bildirim Gönder"
            onPress={() => router.push('/feedback')}
          />
          
          <SettingItem
            icon="help-circle"
            title="Yardım ve Destek"
            onPress={() => router.push('/help')}
          />
          
          <SettingItem
            icon="book"
            title="Uygulama Turu"
            onPress={() => router.push('/onboarding-tour')}
          />
          
          <SettingItem
            icon="document-text"
            title="Kullanım Koşulları"
            onPress={() => router.push('/terms')}
          />
          
          <SettingItem
            icon="log-out"
            title="Çıkış Yap"
            onPress={handleLogout}
            danger
          />
        </View>

        {/* Version */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>Network Solution v1.0.0</Text>
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
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
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
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  section: {
    paddingTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    marginBottom: 12,
    marginLeft: 4,
  },
  themeSelector: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 4,
  },
  themeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  themeOptionActive: {
    backgroundColor: '#1f2937',
  },
  themeText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '500',
  },
  themeTextActive: {
    color: '#fff',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dangerIcon: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  settingContent: {
    flex: 1,
    marginLeft: 12,
  },
  settingTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  dangerText: {
    color: '#ef4444',
  },
  settingSubtitle: {
    color: '#6b7280',
    fontSize: 13,
    marginTop: 2,
  },
  versionContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  versionText: {
    color: '#4b5563',
    fontSize: 13,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1f2937',
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
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
    padding: 24,
  },
  modalDescription: {
    color: '#9ca3af',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  demoCodeBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  demoCodeLabel: {
    color: '#10b981',
    fontSize: 12,
    marginBottom: 4,
  },
  demoCodeValue: {
    color: '#10b981',
    fontSize: 28,
    fontWeight: 'bold',
    letterSpacing: 8,
  },
  codeInput: {
    backgroundColor: '#374151',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 8,
    marginBottom: 20,
  },
  verifyButton: {
    backgroundColor: '#10b981',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
