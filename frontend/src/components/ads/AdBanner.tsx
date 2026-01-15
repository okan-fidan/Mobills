import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

// Test Ad Unit IDs - Gerçek ID'ler ile değiştirin
const TEST_BANNER_ID = Platform.select({
  ios: 'ca-app-pub-3940256099942544/2934735716',
  android: 'ca-app-pub-3940256099942544/6300978111',
  default: 'ca-app-pub-3940256099942544/6300978111',
});

// AdMob sadece native build'de çalışır
// Expo Go'da placeholder gösterilir
let BannerAd: any = null;
let BannerAdSize: any = null;
let TestIds: any = null;

try {
  const MobileAds = require('react-native-google-mobile-ads');
  BannerAd = MobileAds.BannerAd;
  BannerAdSize = MobileAds.BannerAdSize;
  TestIds = MobileAds.TestIds;
} catch (error) {
  // Expo Go'da modül yüklenemez
  console.log('AdMob modülü yüklenemedi - Expo Go kullanılıyor olabilir');
}

interface AdBannerProps {
  size?: 'banner' | 'largeBanner' | 'mediumRectangle' | 'fullBanner' | 'leaderboard';
  style?: any;
}

export const AdBanner: React.FC<AdBannerProps> = ({ size = 'banner', style }) => {
  // Expo Go veya Web için placeholder
  if (!BannerAd || Platform.OS === 'web') {
    return (
      <View style={[styles.placeholder, style]}>
        <View style={styles.placeholderContent}>
          <Text style={styles.placeholderText}>📢 Reklam Alanı</Text>
          <Text style={styles.placeholderSubtext}>
            {Platform.OS === 'web' ? 'Web\'de reklam desteklenmiyor' : 'Development build gerekli'}
          </Text>
        </View>
      </View>
    );
  }

  // Native build için gerçek AdMob banner
  const adSize = {
    banner: BannerAdSize.BANNER,
    largeBanner: BannerAdSize.LARGE_BANNER,
    mediumRectangle: BannerAdSize.MEDIUM_RECTANGLE,
    fullBanner: BannerAdSize.FULL_BANNER,
    leaderboard: BannerAdSize.LEADERBOARD,
  }[size] || BannerAdSize.BANNER;

  return (
    <View style={[styles.container, style]}>
      <BannerAd
        unitId={TEST_BANNER_ID}
        size={adSize}
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,
        }}
        onAdLoaded={() => console.log('Ad loaded')}
        onAdFailedToLoad={(error: any) => console.log('Ad failed to load:', error)}
      />
    </View>
  );
};

// Sabit yükseklikli banner wrapper
export const FixedBannerAd: React.FC<{ position?: 'top' | 'bottom' }> = ({ position = 'bottom' }) => {
  return (
    <View style={[
      styles.fixedContainer,
      position === 'top' ? styles.fixedTop : styles.fixedBottom
    ]}>
      <AdBanner />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a2e',
  },
  placeholder: {
    height: 60,
    backgroundColor: '#1f2937',
    borderRadius: 8,
    marginHorizontal: 16,
    marginVertical: 8,
    overflow: 'hidden',
  },
  placeholderContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#374151',
    borderStyle: 'dashed',
    borderRadius: 8,
  },
  placeholderText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '600',
  },
  placeholderSubtext: {
    color: '#4b5563',
    fontSize: 11,
    marginTop: 2,
  },
  fixedContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#0a0a0a',
    paddingVertical: 4,
  },
  fixedTop: {
    top: 0,
  },
  fixedBottom: {
    bottom: 0,
  },
});

export default AdBanner;
