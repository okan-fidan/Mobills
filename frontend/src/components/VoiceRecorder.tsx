/**
 * Sesli Mesaj Kaydedici Bileşeni
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';

interface VoiceRecorderProps {
  onRecordingComplete: (uri: string, duration: number) => void;
  onCancel: () => void;
}

export default function VoiceRecorder({ onRecordingComplete, onCancel }: VoiceRecorderProps) {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    requestPermission();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (isRecording) {
      // Pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording]);

  const requestPermission = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      setPermissionGranted(granted);
      if (!granted) {
        Alert.alert('İzin Gerekli', 'Sesli mesaj göndermek için mikrofon izni gerekiyor.');
      }
    } catch (error) {
      console.error('Permission error:', error);
    }
  };

  const startRecording = async () => {
    if (!permissionGranted) {
      await requestPermission();
      return;
    }

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(newRecording);
      setIsRecording(true);
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Recording error:', error);
      Alert.alert('Hata', 'Ses kaydı başlatılamadı');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      if (timerRef.current) clearInterval(timerRef.current);
      
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      
      setIsRecording(false);
      setRecording(null);

      if (uri && duration > 0) {
        onRecordingComplete(uri, duration);
      }
    } catch (error) {
      console.error('Stop recording error:', error);
    }
  };

  const cancelRecording = async () => {
    if (recording) {
      try {
        if (timerRef.current) clearInterval(timerRef.current);
        await recording.stopAndUnloadAsync();
      } catch (e) {}
    }
    setIsRecording(false);
    setRecording(null);
    setDuration(0);
    onCancel();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      {/* Cancel Button */}
      <TouchableOpacity style={styles.cancelButton} onPress={cancelRecording}>
        <Ionicons name="close" size={24} color="#ef4444" />
      </TouchableOpacity>

      {/* Recording Indicator */}
      <View style={styles.recordingInfo}>
        <Animated.View
          style={[
            styles.recordingDot,
            { transform: [{ scale: pulseAnim }] },
          ]}
        />
        <Text style={styles.durationText}>{formatDuration(duration)}</Text>
        <Text style={styles.recordingLabel}>
          {isRecording ? 'Kayıt yapılıyor...' : 'Kayda başlamak için basılı tutun'}
        </Text>
      </View>

      {/* Record Button */}
      <TouchableOpacity
        style={[styles.recordButton, isRecording && styles.recordButtonActive]}
        onPressIn={startRecording}
        onPressOut={stopRecording}
        delayLongPress={0}
      >
        <Ionicons
          name={isRecording ? 'stop' : 'mic'}
          size={28}
          color="#fff"
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
  },
  cancelButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    gap: 8,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ef4444',
  },
  durationText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  recordingLabel: {
    color: '#6b7280',
    fontSize: 13,
    flex: 1,
  },
  recordButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordButtonActive: {
    backgroundColor: '#ef4444',
  },
});
