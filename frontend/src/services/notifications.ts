import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import api from './api';

// Notification handler ayarları
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Push notification token al
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  // Expo Go SDK 53+ push notifications desteklemiyor
  // Development build veya production için çalışır
  try {
    let token = null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#6366f1',
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('Push notification izni verilmedi!');
        return null;
      }
      
      // Expo push token al - hata durumunda sessizce devam et
      try {
        const tokenResponse = await Notifications.getExpoPushTokenAsync();
        token = tokenResponse.data;
      } catch (tokenError) {
        // Expo Go'da push token almak başarısız olabilir, bu normaldir
        console.log('Push token alınamadı (Expo Go kullanıyor olabilirsiniz)');
        return null;
      }
    } else {
      console.log('Push notifications sadece fiziksel cihazlarda çalışır');
    }

    return token;
  } catch (error) {
    console.log('Push notification setup hatası:', error);
    return null;
  }
}

// Token'ı backend'e kaydet
export async function savePushToken(token: string): Promise<void> {
  try {
    await api.post('/api/user/push-token', { token });
    console.log('Push token kaydedildi');
  } catch (error) {
    console.log('Push token kaydedilemedi');
  }
}

// Yerel bildirim gönder
export async function sendLocalNotification(title: string, body: string, data?: object): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: 'default',
      },
      trigger: null, // Hemen göster
    });
  } catch (error) {
    console.log('Yerel bildirim gönderilemedi');
  }
}

// Bildirim listener'ları
export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
) {
  return Notifications.addNotificationReceivedListener(callback);
}

export function addNotificationResponseReceivedListener(
  callback: (response: Notifications.NotificationResponse) => void
) {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

// Badge sayısını güncelle
export async function setBadgeCount(count: number): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch (error) {
    // Sessizce devam et
  }
}

// Tüm bildirimleri temizle
export async function clearAllNotifications(): Promise<void> {
  try {
    await Notifications.dismissAllNotificationsAsync();
    await Notifications.setBadgeCountAsync(0);
  } catch (error) {
    // Sessizce devam et
  }
}

export default {
  registerForPushNotificationsAsync,
  savePushToken,
  sendLocalNotification,
  addNotificationReceivedListener,
  addNotificationResponseReceivedListener,
  setBadgeCount,
  clearAllNotifications,
};
