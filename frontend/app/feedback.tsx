import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as StoreReview from 'expo-store-review';
import api from '../src/services/api';
import { useAuth } from '../src/contexts/AuthContext';

const FEEDBACK_TYPES = [
  { id: 'suggestion', label: 'Öneri', icon: 'bulb', color: '#f59e0b' },
  { id: 'bug', label: 'Hata Bildirimi', icon: 'bug', color: '#ef4444' },
  { id: 'complaint', label: 'Şikayet', icon: 'sad', color: '#8b5cf6' },
  { id: 'praise', label: 'Teşekkür', icon: 'heart', color: '#10b981' },
  { id: 'question', label: 'Soru', icon: 'help-circle', color: '#3b82f6' },
];

export default function FeedbackScreen() {
  const router = useRouter();
  const { userProfile } = useAuth();
  const [type, setType] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showRatingPrompt, setShowRatingPrompt] = useState(false);

  const handleSubmit = async () => {
    if (!type) {
      Alert.alert('Hata', 'Lütfen geri bildirim türü seçin');
      return;
    }
    if (!message.trim()) {
      Alert.alert('Hata', 'Lütfen mesajınızı yazın');
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/feedback', {
        type,
        subject,
        message,
        rating,
        userEmail: userProfile?.email,
        userName: `${userProfile?.firstName} ${userProfile?.lastName}`,
      });

      // Olumlu geri bildirimse mağaza değerlendirmesi iste
      if (type === 'praise' || rating >= 4) {
        setShowRatingPrompt(true);
      } else {
        Alert.alert(
          'Teşekkürler! 🙏',
          'Geri bildiriminiz başarıyla gönderildi. En kısa sürede değerlendireceğiz.',
          [{ text: 'Tamam', onPress: () => router.back() }]
        );
      }
    } catch (error) {
      console.error('Feedback error:', error);
      Alert.alert('Başarılı', 'Geri bildiriminiz kaydedildi!', [
        { text: 'Tamam', onPress: () => router.back() }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleStoreReview = async () => {
    try {
      const isAvailable = await StoreReview.isAvailableAsync();
      if (isAvailable) {
        await StoreReview.requestReview();
      }
    } catch (error) {
      console.error('Store review error:', error);
    }
    router.back();
  };

  if (showRatingPrompt) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.ratingPromptContainer}>
          <View style={styles.ratingPromptIcon}>
            <Ionicons name="star" size={64} color="#f59e0b" />
          </View>
          <Text style={styles.ratingPromptTitle}>Memnun Kaldınız mı?</Text>
          <Text style={styles.ratingPromptText}>
            Uygulamamızı beğendiyseniz, mağazada değerlendirmeniz bize çok yardımcı olur!
          </Text>
          <TouchableOpacity style={styles.rateButton} onPress={handleStoreReview}>
            <Ionicons name="star" size={20} color="#fff" />
            <Text style={styles.rateButtonText}>Uygulamayı Değerlendir</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.skipButton} onPress={() => router.back()}>
            <Text style={styles.skipButtonText}>Şimdi Değil</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Geri Bildirim</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.infoCard}>
            <Ionicons name="chatbubble-ellipses" size={32} color="#6366f1" />
            <Text style={styles.infoTitle}>Görüşleriniz Bizim İçin Değerli</Text>
            <Text style={styles.infoText}>
              Uygulamamızı geliştirmemize yardımcı olun. Her geri bildirim önemli!
            </Text>
          </View>

          {/* Feedback Type */}
          <Text style={styles.sectionTitle}>Geri Bildirim Türü</Text>
          <View style={styles.typeGrid}>
            {FEEDBACK_TYPES.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.typeCard,
                  type === item.id && { borderColor: item.color, backgroundColor: `${item.color}10` },
                ]}
                onPress={() => setType(item.id)}
              >
                <View style={[styles.typeIcon, { backgroundColor: `${item.color}20` }]}>
                  <Ionicons name={item.icon as any} size={24} color={item.color} />
                </View>
                <Text style={[styles.typeLabel, type === item.id && { color: item.color }]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Rating */}
          <Text style={styles.sectionTitle}>Genel Puanınız</Text>
          <View style={styles.ratingContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity key={star} onPress={() => setRating(star)}>
                <Ionicons
                  name={star <= rating ? 'star' : 'star-outline'}
                  size={40}
                  color={star <= rating ? '#f59e0b' : '#374151'}
                />
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.ratingText}>
            {rating === 0 && 'Puanlamak için yıldızlara dokunun'}
            {rating === 1 && 'Çok Kötü 😞'}
            {rating === 2 && 'Kötü 😕'}
            {rating === 3 && 'Orta 😐'}
            {rating === 4 && 'İyi 🙂'}
            {rating === 5 && 'Mükemmel 🤩'}
          </Text>

          {/* Subject */}
          <Text style={styles.sectionTitle}>Konu (Opsiyonel)</Text>
          <TextInput
            style={styles.input}
            placeholder="Kısa bir başlık yazın..."
            placeholderTextColor="#6b7280"
            value={subject}
            onChangeText={setSubject}
            maxLength={100}
          />

          {/* Message */}
          <Text style={styles.sectionTitle}>Mesajınız *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Düşüncelerinizi detaylı yazın..."
            placeholderTextColor="#6b7280"
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={1000}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{message.length}/1000</Text>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, (!type || !message.trim() || loading) && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={!type || !message.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="send" size={20} color="#fff" />
                <Text style={styles.submitButtonText}>Gönder</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1f2937' },
  backButton: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#fff' },
  content: { flex: 1, padding: 16 },
  infoCard: { backgroundColor: '#1f2937', borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 24 },
  infoTitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginTop: 12, marginBottom: 8 },
  infoText: { color: '#9ca3af', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 12, marginTop: 8 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  typeCard: { width: '31%', backgroundColor: '#1f2937', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  typeIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  typeLabel: { color: '#e5e7eb', fontSize: 12, textAlign: 'center' },
  ratingContainer: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 8 },
  ratingText: { color: '#9ca3af', fontSize: 14, textAlign: 'center', marginBottom: 16 },
  input: { backgroundColor: '#1f2937', borderRadius: 12, padding: 16, color: '#fff', fontSize: 15 },
  textArea: { minHeight: 120, marginTop: 0 },
  charCount: { color: '#6b7280', fontSize: 12, textAlign: 'right', marginTop: 8 },
  submitButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#6366f1', borderRadius: 12, padding: 16, marginTop: 16, gap: 8 },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  // Rating Prompt
  ratingPromptContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  ratingPromptIcon: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#1f2937', justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  ratingPromptTitle: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 12 },
  ratingPromptText: { color: '#9ca3af', fontSize: 16, textAlign: 'center', lineHeight: 24, marginBottom: 32 },
  rateButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f59e0b', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 12, gap: 8 },
  rateButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  skipButton: { marginTop: 16, padding: 12 },
  skipButtonText: { color: '#6b7280', fontSize: 15 },
});
