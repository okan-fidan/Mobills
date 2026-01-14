/**
 * Uygulama değerlendirme hook'u
 */
import { useState, useEffect, useCallback } from 'react';
import {
  shouldShowRatingPrompt,
  requestReview,
  dismissRatingPrompt,
  incrementSessionCount,
  incrementPostCount,
  getRatingData,
} from '../utils/appRating';

export function useAppRating() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [ratingData, setRatingData] = useState<any>(null);

  // Oturum sayısını artır ve kontrol et
  const checkAndShowRating = useCallback(async () => {
    await incrementSessionCount();
    const shouldShow = await shouldShowRatingPrompt();
    if (shouldShow) {
      // Biraz bekle, kullanıcı uygulamaya alışsın
      setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
    }
  }, []);

  // Gönderi sonrası kontrol et
  const onPostCreated = useCallback(async () => {
    await incrementPostCount();
    const shouldShow = await shouldShowRatingPrompt();
    if (shouldShow) {
      setShowPrompt(true);
    }
  }, []);

  // Değerlendirme yap
  const handleRate = useCallback(async () => {
    setShowPrompt(false);
    await requestReview();
  }, []);

  // Daha sonra
  const handleLater = useCallback(async () => {
    setShowPrompt(false);
    await dismissRatingPrompt();
  }, []);

  // Kapat (bir daha gösterme)
  const handleDismiss = useCallback(async () => {
    setShowPrompt(false);
    await dismissRatingPrompt();
  }, []);

  // Rating verilerini yükle
  const loadRatingData = useCallback(async () => {
    const data = await getRatingData();
    setRatingData(data);
  }, []);

  useEffect(() => {
    loadRatingData();
  }, [loadRatingData]);

  return {
    showPrompt,
    ratingData,
    checkAndShowRating,
    onPostCreated,
    handleRate,
    handleLater,
    handleDismiss,
  };
}
