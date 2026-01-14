/**
 * Sesli Mesaj Oynatıcı Bileşeni
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';

interface VoiceMessagePlayerProps {
  uri: string;
  duration: number;
  isMe?: boolean;
}

export default function VoiceMessagePlayer({ uri, duration, isMe = false }: VoiceMessagePlayerProps) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const loadAndPlay = async () => {
    try {
      setIsLoading(true);

      if (sound) {
        const status = await sound.getStatusAsync();
        if (status.isLoaded) {
          if (isPlaying) {
            await sound.pauseAsync();
            setIsPlaying(false);
          } else {
            await sound.playAsync();
            setIsPlaying(true);
          }
          setIsLoading(false);
          return;
        }
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true },
        onPlaybackStatusUpdate
      );

      setSound(newSound);
      setIsPlaying(true);
    } catch (error) {
      console.error('Error playing audio:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      setPosition(status.positionMillis / 1000);
      
      const progress = status.positionMillis / status.durationMillis;
      progressAnim.setValue(progress);

      if (status.didJustFinish) {
        setIsPlaying(false);
        setPosition(0);
        progressAnim.setValue(0);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={[styles.container, isMe && styles.containerMe]}>
      <TouchableOpacity
        style={[styles.playButton, isMe && styles.playButtonMe]}
        onPress={loadAndPlay}
        disabled={isLoading}
      >
        <Ionicons
          name={isLoading ? 'hourglass' : isPlaying ? 'pause' : 'play'}
          size={20}
          color={isMe ? '#6366f1' : '#fff'}
        />
      </TouchableOpacity>

      <View style={styles.waveformContainer}>
        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressFill,
              isMe && styles.progressFillMe,
              { width: progressWidth },
            ]}
          />
        </View>

        {/* Waveform visualization (static) */}
        <View style={styles.waveform}>
          {[...Array(20)].map((_, i) => (
            <View
              key={i}
              style={[
                styles.waveBar,
                isMe && styles.waveBarMe,
                { height: Math.random() * 16 + 4 },
              ]}
            />
          ))}
        </View>
      </View>

      <Text style={[styles.duration, isMe && styles.durationMe]}>
        {formatTime(isPlaying ? position : duration)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    borderRadius: 20,
    padding: 8,
    minWidth: 200,
    maxWidth: 280,
  },
  containerMe: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonMe: {
    backgroundColor: '#fff',
  },
  waveformContainer: {
    flex: 1,
    marginHorizontal: 10,
    height: 32,
    justifyContent: 'center',
  },
  progressTrack: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: 'rgba(99, 102, 241, 0.3)',
    borderRadius: 4,
  },
  progressFillMe: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 24,
  },
  waveBar: {
    width: 3,
    backgroundColor: '#6366f1',
    borderRadius: 2,
  },
  waveBarMe: {
    backgroundColor: '#fff',
  },
  duration: {
    color: '#9ca3af',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    minWidth: 36,
  },
  durationMe: {
    color: '#e5e7eb',
  },
});
