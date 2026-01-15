import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../src/services/api';
import { useAuth } from '../../src/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';

interface Service {
  id: string;
  userId: string;
  userName: string;
  title: string;
  description: string;
  category: string;
  city: string;
  contactPhone?: string;
  averageRating?: number;
  reviewCount?: number;
  timestamp: string;
}

interface Review {
  id: string;
  userId: string;
  userName: string;
  userProfileImage?: string;
  rating: number;
  title?: string;
  comment: string;
  helpful: string[];
  helpfulCount: number;
  isHelpful: boolean;
  response?: {
    text: string;
    createdAt: string;
  };
  createdAt: string;
}

interface ReviewSummary {
  total: number;
  averageRating: number;
  ratingDistribution: { [key: number]: number };
}

export default function ServiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  
  const [service, setService] = useState<Service | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Review form
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [rating, setRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    if (!id) return;
    try {
      const [servicesRes, reviewsRes] = await Promise.all([
        api.get('/api/services'),
        api.get(`/api/reviews/service/${id}`),
      ]);
      
      const foundService = servicesRes.data.find((s: Service) => s.id === id);
      setService(foundService || null);
      setReviews(reviewsRes.data.reviews || []);
      setSummary(reviewsRes.data.summary || null);
    } catch (error) {
      console.error('Error loading service:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!reviewComment.trim()) {
      Alert.alert('Hata', 'Lütfen bir yorum yazın');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/api/reviews', {
        serviceId: id,
        rating,
        title: reviewTitle.trim() || undefined,
        comment: reviewComment.trim(),
      });

      Alert.alert('Başarılı', 'Değerlendirmeniz eklendi');
      setShowReviewModal(false);
      setRating(5);
      setReviewTitle('');
      setReviewComment('');
      loadData();
    } catch (error: any) {
      Alert.alert('Hata', error?.response?.data?.detail || 'Değerlendirme eklenemedi');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleHelpful = async (reviewId: string) => {
    try {
      const res = await api.post(`/reviews/${reviewId}/helpful`);
      setReviews(reviews.map(r =>
        r.id === reviewId
          ? { ...r, isHelpful: res.data.helpful, helpfulCount: res.data.count }
          : r
      ));
    } catch (error) {
      console.error('Error toggling helpful:', error);
    }
  };

  const renderStars = (count: number, size: number = 16, interactive: boolean = false) => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            disabled={!interactive}
            onPress={() => interactive && setRating(star)}
          >
            <Ionicons
              name={star <= count ? 'star' : 'star-outline'}
              size={size}
              color={star <= count ? '#f59e0b' : '#6b7280'}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderRatingBar = (stars: number, count: number, total: number) => {
    const percentage = total > 0 ? (count / total) * 100 : 0;
    return (
      <View key={stars} style={styles.ratingBarRow}>
        <Text style={styles.ratingBarLabel}>{stars}</Text>
        <Ionicons name="star" size={12} color="#f59e0b" />
        <View style={styles.ratingBarContainer}>
          <View style={[styles.ratingBarFill, { width: `${percentage}%` }]} />
        </View>
        <Text style={styles.ratingBarCount}>{count}</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (!service) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Hizmet Bulunamadı</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Hizmet Detayı</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Service Info */}
        <View style={styles.serviceCard}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{service.category}</Text>
          </View>
          <Text style={styles.serviceTitle}>{service.title}</Text>
          <Text style={styles.serviceDescription}>{service.description}</Text>
          
          <View style={styles.serviceMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="person" size={16} color="#6b7280" />
              <Text style={styles.metaText}>{service.userName}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="location" size={16} color="#6b7280" />
              <Text style={styles.metaText}>{service.city}</Text>
            </View>
          </View>

          {/* İletişime Geç - Özel Mesaj Başlat */}
          {service.userId !== user?.uid && (
            <TouchableOpacity 
              style={styles.contactButton}
              onPress={() => router.push(`/chat/${service.userId}`)}
            >
              <Ionicons name="chatbubble" size={20} color="#fff" />
              <Text style={styles.contactButtonText}>Mesaj Gönder</Text>
            </TouchableOpacity>
          )}

          {/* Randevu Al Butonu */}
          {service.userId !== user?.uid && (
            <TouchableOpacity 
              style={styles.appointmentButton}
              onPress={() => router.push(`/appointments?userId=${service.userId}`)}
            >
              <Ionicons name="calendar" size={20} color="#6366f1" />
              <Text style={styles.appointmentButtonText}>Randevu Al</Text>
            </TouchableOpacity>
          )}

          {/* Telefon ile Ara */}
          {service.contactPhone && (
            <TouchableOpacity style={styles.phoneButton}>
              <Ionicons name="call" size={20} color="#10b981" />
              <Text style={styles.phoneButtonText}>{service.contactPhone}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Rating Summary */}
        {summary && (
          <View style={styles.ratingSummary}>
            <View style={styles.ratingOverview}>
              <Text style={styles.ratingBig}>{summary.averageRating.toFixed(1)}</Text>
              {renderStars(Math.round(summary.averageRating), 20)}
              <Text style={styles.ratingTotal}>{summary.total} değerlendirme</Text>
            </View>
            <View style={styles.ratingBars}>
              {[5, 4, 3, 2, 1].map((stars) =>
                renderRatingBar(stars, summary.ratingDistribution[stars] || 0, summary.total)
              )}
            </View>
          </View>
        )}

        {/* Add Review Button */}
        {service.userId !== user?.uid && (
          <TouchableOpacity
            style={styles.addReviewButton}
            onPress={() => setShowReviewModal(true)}
          >
            <Ionicons name="star" size={20} color="#fff" />
            <Text style={styles.addReviewText}>Değerlendirme Yap</Text>
          </TouchableOpacity>
        )}

        {/* Reviews */}
        <View style={styles.reviewsSection}>
          <Text style={styles.sectionTitle}>Değerlendirmeler</Text>
          
          {reviews.length > 0 ? (
            reviews.map((review) => (
              <View key={review.id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <View style={styles.reviewerInfo}>
                    <View style={styles.reviewerAvatar}>
                      {review.userProfileImage ? (
                        <Image source={{ uri: review.userProfileImage }} style={styles.avatarImage} />
                      ) : (
                        <Ionicons name="person" size={16} color="#6b7280" />
                      )}
                    </View>
                    <View>
                      <Text style={styles.reviewerName}>{review.userName}</Text>
                      <Text style={styles.reviewDate}>
                        {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true, locale: tr })}
                      </Text>
                    </View>
                  </View>
                  {renderStars(review.rating, 14)}
                </View>
                
                {review.title && <Text style={styles.reviewTitle}>{review.title}</Text>}
                <Text style={styles.reviewComment}>{review.comment}</Text>
                
                {/* Response */}
                {review.response && (
                  <View style={styles.responseBox}>
                    <Text style={styles.responseLabel}>Hizmet sağlayıcı yanıtı:</Text>
                    <Text style={styles.responseText}>{review.response.text}</Text>
                  </View>
                )}
                
                {/* Helpful */}
                <TouchableOpacity
                  style={[styles.helpfulButton, review.isHelpful && styles.helpfulButtonActive]}
                  onPress={() => handleToggleHelpful(review.id)}
                >
                  <Ionicons
                    name={review.isHelpful ? 'thumbs-up' : 'thumbs-up-outline'}
                    size={16}
                    color={review.isHelpful ? '#6366f1' : '#6b7280'}
                  />
                  <Text style={[styles.helpfulText, review.isHelpful && styles.helpfulTextActive]}>
                    Yararlı ({review.helpfulCount})
                  </Text>
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="chatbubbles-outline" size={48} color="#374151" />
              <Text style={styles.emptyText}>Henüz değerlendirme yok</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Review Modal */}
      <Modal visible={showReviewModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Değerlendirme Yap</Text>
              <TouchableOpacity onPress={() => setShowReviewModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Rating */}
              <Text style={styles.inputLabel}>Puanınız</Text>
              <View style={styles.ratingSelector}>
                {renderStars(rating, 32, true)}
              </View>

              {/* Title */}
              <Text style={styles.inputLabel}>Başlık (Opsiyonel)</Text>
              <TextInput
                style={styles.input}
                placeholder="Değerlendirme başlığı"
                placeholderTextColor="#6b7280"
                value={reviewTitle}
                onChangeText={setReviewTitle}
              />

              {/* Comment */}
              <Text style={styles.inputLabel}>Yorumunuz</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Deneyiminizi paylaşın..."
                placeholderTextColor="#6b7280"
                value={reviewComment}
                onChangeText={setReviewComment}
                multiline
                numberOfLines={4}
              />

              <TouchableOpacity
                style={[styles.submitButton, submitting && styles.disabledButton]}
                onPress={handleSubmitReview}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Değerlendirmeyi Gönder</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  loadingContainer: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1f2937' },
  backButton: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#fff' },
  content: { flex: 1 },
  serviceCard: { backgroundColor: '#111827', margin: 16, borderRadius: 16, padding: 20 },
  categoryBadge: { backgroundColor: 'rgba(99, 102, 241, 0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, alignSelf: 'flex-start', marginBottom: 12 },
  categoryText: { color: '#6366f1', fontSize: 12, fontWeight: '600' },
  serviceTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 8 },
  serviceDescription: { color: '#9ca3af', fontSize: 15, lineHeight: 22, marginBottom: 16 },
  serviceMeta: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { color: '#9ca3af', fontSize: 14 },
  contactButton: { backgroundColor: '#6366f1', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, gap: 8, marginBottom: 10 },
  contactButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  appointmentButton: { backgroundColor: 'rgba(99, 102, 241, 0.1)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, gap: 8, marginBottom: 10, borderWidth: 1, borderColor: '#6366f1' },
  appointmentButtonText: { color: '#6366f1', fontSize: 16, fontWeight: '600' },
  phoneButton: { backgroundColor: 'rgba(16, 185, 129, 0.1)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, gap: 8, borderWidth: 1, borderColor: '#10b981' },
  phoneButtonText: { color: '#10b981', fontSize: 16, fontWeight: '600' },
  ratingSummary: { flexDirection: 'row', backgroundColor: '#111827', marginHorizontal: 16, borderRadius: 16, padding: 16, marginBottom: 16 },
  ratingOverview: { alignItems: 'center', paddingRight: 16, borderRightWidth: 1, borderRightColor: '#374151' },
  ratingBig: { color: '#fff', fontSize: 48, fontWeight: 'bold' },
  starsContainer: { flexDirection: 'row', gap: 2, marginVertical: 4 },
  ratingTotal: { color: '#6b7280', fontSize: 12, marginTop: 4 },
  ratingBars: { flex: 1, paddingLeft: 16, justifyContent: 'center' },
  ratingBarRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 2, gap: 4 },
  ratingBarLabel: { color: '#9ca3af', fontSize: 12, width: 12 },
  ratingBarContainer: { flex: 1, height: 6, backgroundColor: '#374151', borderRadius: 3, marginHorizontal: 4 },
  ratingBarFill: { height: '100%', backgroundColor: '#f59e0b', borderRadius: 3 },
  ratingBarCount: { color: '#6b7280', fontSize: 12, width: 20 },
  addReviewButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#6366f1', marginHorizontal: 16, paddingVertical: 14, borderRadius: 12, gap: 8, marginBottom: 16 },
  addReviewText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  reviewsSection: { padding: 16 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 16 },
  reviewCard: { backgroundColor: '#111827', borderRadius: 12, padding: 16, marginBottom: 12 },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  reviewerInfo: { flexDirection: 'row', alignItems: 'center' },
  reviewerAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1f2937', justifyContent: 'center', alignItems: 'center', marginRight: 10, overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  reviewerName: { color: '#fff', fontSize: 14, fontWeight: '500' },
  reviewDate: { color: '#6b7280', fontSize: 12, marginTop: 2 },
  reviewTitle: { color: '#fff', fontSize: 15, fontWeight: '600', marginBottom: 8 },
  reviewComment: { color: '#9ca3af', fontSize: 14, lineHeight: 20 },
  responseBox: { backgroundColor: 'rgba(99, 102, 241, 0.1)', borderRadius: 8, padding: 12, marginTop: 12 },
  responseLabel: { color: '#6366f1', fontSize: 12, fontWeight: '600', marginBottom: 4 },
  responseText: { color: '#9ca3af', fontSize: 14 },
  helpfulButton: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#1f2937' },
  helpfulButtonActive: { backgroundColor: 'rgba(99, 102, 241, 0.1)' },
  helpfulText: { color: '#6b7280', fontSize: 13 },
  helpfulTextActive: { color: '#6366f1' },
  emptyState: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { color: '#6b7280', fontSize: 15, marginTop: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1f2937', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#374151' },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: '600' },
  modalBody: { padding: 20 },
  inputLabel: { color: '#9ca3af', fontSize: 14, marginBottom: 8 },
  ratingSelector: { alignItems: 'center', marginBottom: 24 },
  input: { backgroundColor: '#374151', borderRadius: 12, padding: 14, color: '#fff', fontSize: 16, marginBottom: 16 },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  submitButton: { backgroundColor: '#6366f1', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 8, marginBottom: 20 },
  disabledButton: { opacity: 0.6 },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
