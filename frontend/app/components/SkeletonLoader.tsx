import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

interface SkeletonLoaderProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: object;
}

export function SkeletonLoader({
  width: skeletonWidth = '100%',
  height = 20,
  borderRadius = 4,
  style,
}: SkeletonLoaderProps) {
  const shimmerValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shimmerAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    shimmerAnimation.start();
    return () => shimmerAnimation.stop();
  }, [shimmerValue]);

  const opacity = shimmerValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width: skeletonWidth,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
}

export function SkeletonCard() {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <SkeletonLoader width={48} height={48} borderRadius={24} />
        <View style={styles.cardHeaderText}>
          <SkeletonLoader width={120} height={16} />
          <SkeletonLoader width={80} height={12} style={{ marginTop: 8 }} />
        </View>
      </View>
      <SkeletonLoader width="100%" height={60} style={{ marginTop: 12 }} />
      <View style={styles.cardFooter}>
        <SkeletonLoader width={60} height={24} borderRadius={12} />
        <SkeletonLoader width={60} height={24} borderRadius={12} />
        <SkeletonLoader width={60} height={24} borderRadius={12} />
      </View>
    </View>
  );
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} />
      ))}
    </View>
  );
}

export function SkeletonChatItem() {
  return (
    <View style={styles.chatItem}>
      <SkeletonLoader width={56} height={56} borderRadius={28} />
      <View style={styles.chatItemContent}>
        <SkeletonLoader width={140} height={16} />
        <SkeletonLoader width={200} height={14} style={{ marginTop: 6 }} />
      </View>
      <SkeletonLoader width={40} height={12} />
    </View>
  );
}

export function SkeletonProfile() {
  return (
    <View style={styles.profileContainer}>
      <SkeletonLoader width={100} height={100} borderRadius={50} />
      <SkeletonLoader width={150} height={24} style={{ marginTop: 16 }} />
      <SkeletonLoader width={200} height={16} style={{ marginTop: 8 }} />
      <View style={styles.statsRow}>
        <SkeletonLoader width={80} height={60} borderRadius={12} />
        <SkeletonLoader width={80} height={60} borderRadius={12} />
        <SkeletonLoader width={80} height={60} borderRadius={12} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#2a2a2a',
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardHeaderText: {
    marginLeft: 12,
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  chatItemContent: {
    flex: 1,
    marginLeft: 14,
  },
  profileContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 24,
    gap: 16,
  },
});

export default SkeletonLoader;
