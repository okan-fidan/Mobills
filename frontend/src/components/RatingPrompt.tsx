/**
 * Uygulama İçi Değerlendirme Modal Bileşeni
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface RatingPromptProps {
  visible: boolean;
  onRate: () => void;
  onLater: () => void;
  onDismiss: () => void;
}

const { width } = Dimensions.get('window');

export default function RatingPrompt({ visible, onRate, onLater, onDismiss }: RatingPromptProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onLater}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Close button */}
          <TouchableOpacity style={styles.closeButton} onPress={onDismiss}>
            <Ionicons name="close" size={24} color="#6b7280" />
          </TouchableOpacity>
          
          {/* Icon */}
          <View style={styles.iconContainer}>
            <LinearGradient
              colors={['#6366f1', '#8b5cf6']}
              style={styles.iconGradient}
            >
              <Ionicons name="star" size={40} color="#fff" />
            </LinearGradient>
          </View>
          
          {/* Title */}
          <Text style={styles.title}>Network Solution'ı Beğendiniz mi?</Text>
          
          {/* Description */}
          <Text style={styles.description}>
            Deneyiminiz bizim için çok değerli! Uygulamayı değerlendirerek
            diğer girişimcilerin de keşfetmesine yardımcı olabilirsiniz.
          </Text>
          
          {/* Stars preview */}
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Ionicons key={star} name="star" size={32} color="#f59e0b" />
            ))}
          </View>
          
          {/* Rate button */}
          <TouchableOpacity style={styles.rateButton} onPress={onRate}>
            <LinearGradient
              colors={['#6366f1', '#8b5cf6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.rateButtonGradient}
            >
              <Ionicons name="heart" size={20} color="#fff" />
              <Text style={styles.rateButtonText}>Değerlendir</Text>
            </LinearGradient>
          </TouchableOpacity>
          
          {/* Later button */}
          <TouchableOpacity style={styles.laterButton} onPress={onLater}>
            <Text style={styles.laterButtonText}>Daha Sonra</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    backgroundColor: '#111827',
    borderRadius: 24,
    padding: 32,
    width: width - 48,
    maxWidth: 360,
    alignItems: 'center',
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
  },
  iconContainer: {
    marginBottom: 20,
  },
  iconGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  rateButton: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  rateButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  rateButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  laterButton: {
    paddingVertical: 12,
  },
  laterButtonText: {
    color: '#6b7280',
    fontSize: 15,
  },
});
