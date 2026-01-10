import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface OnboardingSlide {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  color: string;
}

const slides: OnboardingSlide[] = [
  {
    id: '1',
    icon: 'people',
    title: 'Topluluklara Katılın',
    description: 'Şehrinize göre girişimci topluluklarını keşfedin ve diğer girişimcilerle bağlantı kurun.',
    color: '#6366f1',
  },
  {
    id: '2',
    icon: 'chatbubbles',
    title: 'Mesajlaşın',
    description: 'Grup sohbetleri ve özel mesajlar ile iletişimde kalın. Fikirlerinizi paylaşın.',
    color: '#06b6d4',
  },
  {
    id: '3',
    icon: 'briefcase',
    title: 'Hizmetlerinizi Sunun',
    description: 'Sunduğunuz hizmetleri paylaşın ve diğer girişimcilerden hizmet alın.',
    color: '#10b981',
  },
  {
    id: '4',
    icon: 'rocket',
    title: 'Büyüyün',
    description: 'Mastermind gruplarına katılın, mentorlarla tanışın ve işinizi büyütün.',
    color: '#f59e0b',
  },
];

export default function OnboardingScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const router = useRouter();
  const { width } = useWindowDimensions();

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      scrollViewRef.current?.scrollTo({ x: (currentIndex + 1) * width, animated: true });
      setCurrentIndex(currentIndex + 1);
    } else {
      handleFinish();
    }
  };

  const handleSkip = () => {
    handleFinish();
  };

  const handleFinish = () => {
    router.replace('/(auth)/login');
  };

  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / width);
    if (index !== currentIndex && index >= 0 && index < slides.length) {
      setCurrentIndex(index);
    }
  };

  const currentSlide = slides[currentIndex];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleSkip}>
          <Text style={styles.skipText}>Atla</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: currentSlide.color }]}>
          <Ionicons name={currentSlide.icon} size={80} color="#fff" />
        </View>
        <Text style={styles.title}>{currentSlide.title}</Text>
        <Text style={styles.description}>{currentSlide.description}</Text>
      </View>

      <View style={styles.pagination}>
        {slides.map((_, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => setCurrentIndex(index)}
          >
            <View
              style={[
                styles.dot,
                {
                  backgroundColor: index === currentIndex ? '#6366f1' : '#4b5563',
                  width: index === currentIndex ? 24 : 8,
                },
              ]}
            />
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.button} onPress={handleNext}>
          <LinearGradient
            colors={['#4338ca', '#6366f1']}
            style={styles.buttonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.buttonText}>
              {currentIndex === slides.length - 1 ? 'Başla' : 'Devam'}
            </Text>
            <Ionicons 
              name={currentIndex === slides.length - 1 ? 'checkmark' : 'arrow-forward'} 
              size={20} 
              color="#fff" 
            />
          </LinearGradient>
        </TouchableOpacity>
      </View>
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
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  skipText: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  iconContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 24,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 24,
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  button: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
