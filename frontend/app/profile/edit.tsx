import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Modal,
  FlatList,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../src/config/firebase';
import api from '../../src/services/api';
import { useAuth } from '../../src/contexts/AuthContext';
import { showToast } from '../../src/components/ui';

// Türkiye şehirleri
const TURKISH_CITIES = [
  'Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Aksaray', 'Amasya', 'Ankara', 'Antalya', 'Ardahan', 'Artvin',
  'Aydın', 'Balıkesir', 'Bartın', 'Batman', 'Bayburt', 'Bilecik', 'Bingöl', 'Bitlis', 'Bolu', 'Burdur',
  'Bursa', 'Çanakkale', 'Çankırı', 'Çorum', 'Denizli', 'Diyarbakır', 'Düzce', 'Edirne', 'Elazığ', 'Erzincan',
  'Erzurum', 'Eskişehir', 'Gaziantep', 'Giresun', 'Gümüşhane', 'Hakkari', 'Hatay', 'Iğdır', 'Isparta', 'İstanbul',
  'İzmir', 'Kahramanmaraş', 'Karabük', 'Karaman', 'Kars', 'Kastamonu', 'Kayseri', 'Kırıkkale', 'Kırklareli', 'Kırşehir',
  'Kilis', 'Kocaeli', 'Konya', 'Kütahya', 'Malatya', 'Manisa', 'Mardin', 'Mersin', 'Muğla', 'Muş',
  'Nevşehir', 'Niğde', 'Ordu', 'Osmaniye', 'Rize', 'Sakarya', 'Samsun', 'Siirt', 'Sinop', 'Sivas',
  'Şanlıurfa', 'Şırnak', 'Tekirdağ', 'Tokat', 'Trabzon', 'Tunceli', 'Uşak', 'Van', 'Yalova', 'Yozgat', 'Zonguldak'
];

export default function EditProfileScreen() {
  const { userProfile, refreshProfile, user } = useAuth();
  const router = useRouter();
  
  const [firstName, setFirstName] = useState(userProfile?.firstName || '');
  const [lastName, setLastName] = useState(userProfile?.lastName || '');
  const [phone, setPhone] = useState(userProfile?.phone || '');
  const [occupation, setOccupation] = useState(userProfile?.occupation || '');
  const [city, setCity] = useState(userProfile?.city || '');
  const [profileImage, setProfileImage] = useState(userProfile?.profileImageUrl || '');
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [citySearch, setCitySearch] = useState('');

  const filteredCities = citySearch
    ? TURKISH_CITIES.filter(c => 
        c.toLowerCase().includes(citySearch.toLowerCase())
      )
    : TURKISH_CITIES;

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showToast.error('İzin Gerekli', 'Fotoğraf seçmek için galeri izni gerekiyor.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadImage(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri: string) => {
    if (!user?.uid) return;
    setUploadingImage(true);

    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const filename = `profile_images/${user.uid}_${Date.now()}.jpg`;
      const storageRef = ref(storage, filename);
      
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);
      
      setProfileImage(downloadURL);
      showToast.success('Başarılı', 'Fotoğraf yüklendi');
    } catch (error) {
      console.error('Error uploading image:', error);
      showToast.error('Hata', 'Fotoğraf yüklenemedi');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      showToast.error('Hata', 'Ad ve soyad zorunludur');
      return;
    }

    if (!city) {
      showToast.error('Hata', 'Lütfen şehir seçin');
      return;
    }

    setSaving(true);
    try {
      const updateData = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        occupation: occupation.trim(),
        city: city,
        profileImageUrl: profileImage,
      };
      
      console.log('Updating profile with:', updateData);
      
      await api.put('/api/user/profile', updateData);
      
      await refreshProfile();
      showToast.success('Başarılı', 'Profil güncellendi');
      router.back();
    } catch (error: any) {
      console.error('Error updating profile:', error?.response?.data || error?.message || error);
      showToast.error('Hata', error?.response?.data?.detail || 'Profil güncellenemedi');
    } finally {
      setSaving(false);
    }
  };

  const CityPickerModal = () => (
    <Modal
      visible={showCityPicker}
      animationType="slide"
      transparent
      onRequestClose={() => setShowCityPicker(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Şehir Seçin</Text>
            <TouchableOpacity onPress={() => setShowCityPicker(false)}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Arama */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#9ca3af" />
            <TextInput
              style={styles.searchInput}
              placeholder="Şehir ara..."
              placeholderTextColor="#6b7280"
              value={citySearch}
              onChangeText={setCitySearch}
              autoFocus
            />
            {citySearch.length > 0 && (
              <TouchableOpacity onPress={() => setCitySearch('')}>
                <Ionicons name="close-circle" size={20} color="#6b7280" />
              </TouchableOpacity>
            )}
          </View>

          {/* Şehir Listesi */}
          <FlatList
            data={filteredCities}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.cityItem,
                  city === item && styles.cityItemSelected
                ]}
                onPress={() => {
                  setCity(item);
                  setShowCityPicker(false);
                  setCitySearch('');
                }}
              >
                <Ionicons 
                  name="location" 
                  size={20} 
                  color={city === item ? '#6366f1' : '#6b7280'} 
                />
                <Text style={[
                  styles.cityItemText,
                  city === item && styles.cityItemTextSelected
                ]}>
                  {item}
                </Text>
                {city === item && (
                  <Ionicons name="checkmark-circle" size={22} color="#6366f1" />
                )}
              </TouchableOpacity>
            )}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyList}>
                <Ionicons name="search-outline" size={40} color="#374151" />
                <Text style={styles.emptyText}>Şehir bulunamadı</Text>
              </View>
            }
          />
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profili Düzenle</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color="#6366f1" />
          ) : (
            <Text style={styles.saveButton}>Kaydet</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Profile Image */}
        <View style={styles.imageSection}>
          <TouchableOpacity style={styles.imageContainer} onPress={pickImage} disabled={uploadingImage}>
            {uploadingImage ? (
              <ActivityIndicator size="large" color="#6366f1" />
            ) : profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.profileImage} />
            ) : (
              <View style={styles.placeholderImage}>
                <Ionicons name="person" size={48} color="#6b7280" />
              </View>
            )}
            <View style={styles.editImageBadge}>
              <Ionicons name="camera" size={18} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={styles.imageHint}>Profil fotoğrafını değiştirmek için dokun</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Ad *</Text>
            <TextInput
              style={styles.input}
              value={firstName}
              onChangeText={setFirstName}
              placeholder="Adınız"
              placeholderTextColor="#6b7280"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Soyad *</Text>
            <TextInput
              style={styles.input}
              value={lastName}
              onChangeText={setLastName}
              placeholder="Soyadınız"
              placeholderTextColor="#6b7280"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Telefon</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="05XX XXX XX XX"
              placeholderTextColor="#6b7280"
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Şehir *</Text>
            <TouchableOpacity
              style={styles.citySelector}
              onPress={() => setShowCityPicker(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="location-outline" size={20} color="#9ca3af" />
              <Text style={[styles.citySelectorText, !city && styles.placeholder]}>
                {city || 'Şehir Seçin'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Meslek / Sektör</Text>
            <TextInput
              style={styles.input}
              value={occupation}
              onChangeText={setOccupation}
              placeholder="Örn: Yazılım Geliştirici"
              placeholderTextColor="#6b7280"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>E-posta</Text>
            <View style={styles.disabledInput}>
              <Text style={styles.disabledText}>{userProfile?.email}</Text>
            </View>
            <Text style={styles.hint}>E-posta adresi değiştirilemez</Text>
          </View>
        </View>
      </ScrollView>

      <CityPickerModal />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1f2937' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#fff' },
  saveButton: { color: '#6366f1', fontSize: 16, fontWeight: '600' },
  content: { flex: 1 },
  imageSection: { alignItems: 'center', paddingVertical: 32 },
  imageContainer: { position: 'relative', width: 120, height: 120 },
  profileImage: { width: 120, height: 120, borderRadius: 60 },
  placeholderImage: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#1f2937', justifyContent: 'center', alignItems: 'center' },
  editImageBadge: { position: 'absolute', bottom: 4, right: 4, width: 36, height: 36, borderRadius: 18, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#0a0a0a' },
  imageHint: { color: '#6b7280', fontSize: 13, marginTop: 12 },
  form: { paddingHorizontal: 16, paddingBottom: 32 },
  inputGroup: { marginBottom: 20 },
  label: { color: '#9ca3af', fontSize: 14, marginBottom: 8 },
  input: { backgroundColor: '#1f2937', borderRadius: 12, padding: 16, color: '#fff', fontSize: 16 },
  disabledInput: { backgroundColor: '#111827', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#1f2937' },
  disabledText: { color: '#6b7280', fontSize: 16 },
  hint: { color: '#6b7280', fontSize: 12, marginTop: 6 },
  citySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  citySelectorText: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
  },
  placeholder: {
    color: '#6b7280',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1f2937',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    margin: 16,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
  },
  cityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  cityItemSelected: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  cityItemText: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
  },
  cityItemTextSelected: {
    color: '#6366f1',
    fontWeight: '600',
  },
  emptyList: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 16,
    marginTop: 12,
  },
});
