import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  FlatList,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

interface TourStep {
  id: string;
  icon: string;
  title: string;
  description: string;
  color: string;
  gradient: string[];
}

const TOUR_STEPS: TourStep[] = [
  {
    id: '1',
    icon: 'people',
    title: 'Topluluğa Katıl',
    description: '81 ilin girişimci topluluğuna katılın, aynı şehirdeki girişimcilerle tanışın ve networking yapın.',
    color: '#6366f1',
    gradient: ['#4338ca', '#6366f1'],
  },
  {
    id: '2',
    icon: 'chatbubbles',
    title: 'Sohbet Et',
    description: 'Gruplarda mesajlaşın, alt gruplara katılın ve diğer girişimcilerle fikirlerinizi paylaşın.',
    color: '#10b981',
    gradient: ['#059669', '#10b981'],
  },
  {
    id: '3',
    icon: 'briefcase',
    title: 'Hizmet Paylaş',
    description: 'Sunduğunuz hizmetleri yayınlayın, diğer girişimcilerin hizmetlerinden yararlanın.',
    color: '#f59e0b',
    gradient: ['#d97706', '#f59e0b'],
  },
  {
    id: '4',
    icon: 'trophy',
    title: 'Rozet Kazan',
    description: 'Aktif olun, rozetler kazanın ve liderlik tablosunda yerinizi alın!',
    color: '#ec4899',
    gradient: ['#db2777', '#ec4899'],
  },
  {
    id: '5',
    icon: 'calendar',
    title: 'Etkinliklere Katıl',
    description: 'Girişimcilik etkinliklerine katılın, workshoplara kayıt olun ve bilginizi artırın.',
    color: '#8b5cf6',
    gradient: ['#7c3aed', '#8b5cf6'],
  },
];

export default function OnboardingTourScreen() {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const handleNext = () => {
    if (currentIndex < TOUR_STEPS.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
      setCurrentIndex(currentIndex + 1);
    } else {
      completeTour();
    }
  };

  const handleSkip = () => {
    completeTour();
  };

  const completeTour = async () => {
    try {
      await AsyncStorage.setItem('onboarding_completed', 'true');
    } catch (error) {
      console.error('Error saving onboarding status:', error);
    }
    router.replace('/(tabs)');
  };

  const renderStep = ({ item, index }: { item: TourStep; index: number }) => (
    <View style={[styles.slide, { width }]}>
      <View style={[styles.iconContainer, { backgroundColor: item.color }]}>
        <Ionicons name={item.icon as any} size={80} color="#fff" />
      </View>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.description}>{item.description}</Text>
    </View>
  );

  const renderDots = () => (
    <View style={styles.dotsContainer}>
      {TOUR_STEPS.map((_, index) => {
        const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
        
        const dotWidth = scrollX.interpolate({
          inputRange,
          outputRange: [8, 24, 8],
          extrapolate: 'clamp',
        });
        
        const opacity = scrollX.interpolate({
          inputRange,
          outputRange: [0.3, 1, 0.3],
          extrapolate: 'clamp',
        });
        
        return (
          <Animated.View
            key={index}
            style={[
              styles.dot,
              {
                width: dotWidth,
                opacity,
                backgroundColor: TOUR_STEPS[currentIndex].color,
              },
            ]}
          />
        );
      })}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleSkip}>
          <Text style={styles.skipText}>Atla</Text>
        </TouchableOpacity>
      </View>

      <Animated.FlatList
        ref={flatListRef}
        data={TOUR_STEPS}
        renderItem={renderStep}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        onMomentumScrollEnd={(e) => {
          const newIndex = Math.round(e.nativeEvent.contentOffset.x / width);
          setCurrentIndex(newIndex);
        }}
        scrollEventThrottle={16}
      />

      {renderDots()}

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextButton, { backgroundColor: TOUR_STEPS[currentIndex].color }]}
          onPress={handleNext}
        >
          <Text style={styles.nextButtonText}>
            {currentIndex === TOUR_STEPS.length - 1 ? 'Başla' : 'Devam'}
          </Text>
          <Ionicons 
            name={currentIndex === TOUR_STEPS.length - 1 ? 'checkmark' : 'arrow-forward'} 
            size={20} 
            color="#fff" 
          />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 20, paddingTop: 10 },
  skipText: { color: '#6b7280', fontSize: 16 },
  slide: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  iconContainer: { width: 160, height: 160, borderRadius: 80, justifyContent: 'center', alignItems: 'center', marginBottom: 40 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 16, textAlign: 'center' },
  description: { fontSize: 16, color: '#9ca3af', textAlign: 'center', lineHeight: 24 },
  dotsContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 40 },
  dot: { height: 8, borderRadius: 4, marginHorizontal: 4 },
  footer: { paddingHorizontal: 20, paddingBottom: 20 },
  nextButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 12, gap: 8 },
  nextButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
});
