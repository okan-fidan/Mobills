/**
 * Uygulama İçi Değerlendirme Yardımcısı
 * Kullanıcının uygulamayı değerlendirmesini istemek için kullanılır
 */
import * as StoreReview from 'expo-store-review';
import AsyncStorage from '@react-native-async-storage/async-storage';

const RATING_STORAGE_KEY = 'app_rating_data';
const MIN_SESSIONS = 5; // Minimum oturum sayısı
const MIN_POSTS = 3; // Minimum gönderi sayısı
const DAYS_BETWEEN_PROMPTS = 30; // Tekrar sormadan önce beklenecek gün

interface RatingData {
  sessionCount: number;
  postCount: number;
  lastPromptDate: string | null;
  hasRated: boolean;
  dismissed: boolean;
}

const defaultData: RatingData = {
  sessionCount: 0,
  postCount: 0,
  lastPromptDate: null,
  hasRated: false,
  dismissed: false,
};

/**
 * Rating verilerini yükle
 */
export async function getRatingData(): Promise<RatingData> {
  try {
    const data = await AsyncStorage.getItem(RATING_STORAGE_KEY);
    if (data) {
      return { ...defaultData, ...JSON.parse(data) };
    }
    return defaultData;
  } catch {
    return defaultData;
  }
}

/**
 * Rating verilerini kaydet
 */
async function saveRatingData(data: RatingData): Promise<void> {
  try {
    await AsyncStorage.setItem(RATING_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Rating data save error:', error);
  }
}

/**
 * Oturum sayısını artır
 */
export async function incrementSessionCount(): Promise<void> {
  const data = await getRatingData();
  data.sessionCount += 1;
  await saveRatingData(data);
}

/**
 * Gönderi sayısını artır
 */
export async function incrementPostCount(): Promise<void> {
  const data = await getRatingData();
  data.postCount += 1;
  await saveRatingData(data);
}

/**
 * Değerlendirme yapıldı olarak işaretle
 */
export async function markAsRated(): Promise<void> {
  const data = await getRatingData();
  data.hasRated = true;
  await saveRatingData(data);
}

/**
 * Değerlendirme istemini reddet
 */
export async function dismissRatingPrompt(): Promise<void> {
  const data = await getRatingData();
  data.dismissed = true;
  data.lastPromptDate = new Date().toISOString();
  await saveRatingData(data);
}

/**
 * Değerlendirme istemi gösterilmeli mi kontrol et
 */
export async function shouldShowRatingPrompt(): Promise<boolean> {
  const data = await getRatingData();
  
  // Zaten değerlendirdiyse gösterme
  if (data.hasRated) {
    return false;
  }
  
  // Yeterli oturum veya gönderi sayısı yoksa gösterme
  if (data.sessionCount < MIN_SESSIONS && data.postCount < MIN_POSTS) {
    return false;
  }
  
  // Son gösterimden beri yeterli zaman geçti mi?
  if (data.lastPromptDate) {
    const lastDate = new Date(data.lastPromptDate);
    const daysSinceLastPrompt = (Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceLastPrompt < DAYS_BETWEEN_PROMPTS) {
      return false;
    }
  }
  
  return true;
}

/**
 * Değerlendirme isteğini göster
 */
export async function requestReview(): Promise<boolean> {
  try {
    // Store review mevcut mu kontrol et
    const isAvailable = await StoreReview.isAvailableAsync();
    
    if (isAvailable) {
      await StoreReview.requestReview();
      await markAsRated();
      return true;
    }
    
    // Mevcut değilse, store'a yönlendir
    if (await StoreReview.hasAction()) {
      await StoreReview.requestReview();
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Review request error:', error);
    return false;
  }
}

/**
 * Tüm rating verilerini sıfırla (test için)
 */
export async function resetRatingData(): Promise<void> {
  await AsyncStorage.removeItem(RATING_STORAGE_KEY);
}
