import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

interface AdBannerProps {
  size?: 'banner' | 'largeBanner' | 'mediumRectangle' | 'fullBanner' | 'leaderboard';
  style?: any;
}

// Expo Go ve Web için placeholder banner
// Gerçek AdMob reklamları sadece EAS build ile çalışır
export const AdBanner: React.FC<AdBannerProps> = ({ style }) => {
  return (
    <View style={[styles.placeholder, style]}>
      <View style={styles.placeholderContent}>
        <Text style={styles.placeholderText}>📢 Reklam Alanı</Text>
        <Text style={styles.placeholderSubtext}>
          {Platform.OS === 'web' 
            ? 'Web\'de reklam desteklenmiyor' 
            : 'EAS Build ile aktif olacak'}
        </Text>
      </View>
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
