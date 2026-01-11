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
  
  // Theme state
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('dark');
  
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
      const response = await api.get('/auth/2fa/status');
      setTwoFactorEnabled(response.data.enabled || false);
    } catch (error) {
      console.error('Error loading 2FA status:', error);
    }
  };

  const loadSettings = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('app_theme');
      if (savedTheme) setTheme(savedTheme as any);

      const savedNotifications = await AsyncStorage.getItem('notification_settings');
      if (savedNotifications) setNotifications(JSON.parse(savedNotifications));

      const saved2FA = await AsyncStorage.getItem('2fa_enabled');
      if (saved2FA) setTwoFactorEnabled(saved2FA === 'true');
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveTheme = async (newTheme: 'light' | 'dark' | 'system') => {
    try {
      await AsyncStorage.setItem('app_theme', newTheme);
      setTheme(newTheme);
    } catch (error) {
      console.error('Error saving theme:', error);
    }
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
      // Enable 2FA
      Alert.alert(
        'İki Faktörlü Doğrulama',
        'İki faktörlü doğrulamayı etkinleştirmek için e-posta adresinize bir doğrulama kodu göndereceğiz.',
        [
          { text: 'İptal', style: 'cancel' },
          {
            text: 'Etkinleştir',
            onPress: async () => {
              // Simüle: Gerçek uygulamada backend'e istek atılır
              setTwoFactorEnabled(true);
              await AsyncStorage.setItem('2fa_enabled', 'true');
              Alert.alert('Başarılı', 'İki faktörlü doğrulama etkinleştirildi');
            },
          },
        ]
      );
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
              setTwoFactorEnabled(false);
              await AsyncStorage.setItem('2fa_enabled', 'false');
            },
          },
        ]
      );
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
            onPress={() => Alert.alert('Bilgi', 'Şifre değiştirme özelliği yakında')}
          />
          
          <SettingItem
            icon="lock-closed"
            title="Gizlilik Ayarları"
            onPress={() => Alert.alert('Bilgi', 'Gizlilik ayarları yakında')}
          />
        </View>

        {/* Hesap */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hesap</Text>
          
          <SettingItem
            icon="person"
            title="Profil Düzenle"
            onPress={() => router.push('/(tabs)/profile')}
          />
          
          <SettingItem
            icon="help-circle"
            title="Yardım ve Destek"
            onPress={() => Alert.alert('Bilgi', 'Destek: support@networksolution.com')}
          />
          
          <SettingItem
            icon="document-text"
            title="Kullanım Koşulları"
            onPress={() => Alert.alert('Bilgi', 'Kullanım koşulları yakında')}
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
});
