import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { postApi } from '../../src/services/api';
import { useAuth } from '../../src/contexts/AuthContext';

export default function CreatePostScreen() {
  const [content, setContent] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { userProfile } = useAuth();
  const router = useRouter();

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('İzin Gerekli', 'Fotoğraf seçmek için galeri izni gerekiyor.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const handlePost = async () => {
    if (!content.trim()) {
      Alert.alert('Hata', 'Lütfen bir şeyler yazın');
      return;
    }

    setLoading(true);
    try {
      await postApi.create({
        content: content.trim(),
        imageUrl: selectedImage,
      });
      Alert.alert('Başarılı', 'Gönderiniz paylaşıldı!', [
        { text: 'Tamam', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('Error creating post:', error);
      Alert.alert('Hata', 'Gönderi paylaşılamadı');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Gönderi Oluştur</Text>
          <TouchableOpacity
            style={[styles.postButton, (!content.trim() || loading) && styles.postButtonDisabled]}
            onPress={handlePost}
            disabled={!content.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.postButtonText}>Paylaş</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.userSection}>
            <View style={styles.avatar}>
              {userProfile?.profileImageUrl ? (
                <Image source={{ uri: userProfile.profileImageUrl }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>
                  {userProfile?.firstName?.[0]}{userProfile?.lastName?.[0]}
                </Text>
              )}
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{userProfile?.firstName} {userProfile?.lastName}</Text>
              <Text style={styles.visibility}>Herkese Açık</Text>
            </View>
          </View>

          <TextInput
            style={styles.input}
            placeholder="Ne düşünüyorsun?"
            placeholderTextColor="#6b7280"
            value={content}
            onChangeText={setContent}
            multiline
            maxLength={2000}
            autoFocus
          />

          {selectedImage && (
            <View style={styles.imagePreview}>
              <Image source={{ uri: selectedImage }} style={styles.selectedImage} />
              <TouchableOpacity
                style={styles.removeImageButton}
                onPress={() => setSelectedImage(null)}
              >
                <Ionicons name="close-circle" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        <View style={styles.toolbar}>
          <TouchableOpacity style={styles.toolbarButton} onPress={pickImage}>
            <Ionicons name="image" size={24} color="#10b981" />
            <Text style={styles.toolbarText}>Fotoğraf</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolbarButton}>
            <Ionicons name="location" size={24} color="#f59e0b" />
            <Text style={styles.toolbarText}>Konum</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolbarButton}>
            <Ionicons name="pricetag" size={24} color="#6366f1" />
            <Text style={styles.toolbarText}>Etiketle</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1f2937' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '600' },
  postButton: { backgroundColor: '#6366f1', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  postButtonDisabled: { opacity: 0.5 },
  postButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  content: { flex: 1, padding: 16 },
  userSection: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#4338ca', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  userInfo: { marginLeft: 12 },
  userName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  visibility: { color: '#6b7280', fontSize: 13, marginTop: 2 },
  input: { color: '#fff', fontSize: 18, lineHeight: 26, minHeight: 120 },
  imagePreview: { marginTop: 16, borderRadius: 16, overflow: 'hidden', position: 'relative' },
  selectedImage: { width: '100%', height: 250, borderRadius: 16 },
  removeImageButton: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 14 },
  toolbar: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#1f2937' },
  toolbarButton: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toolbarText: { color: '#9ca3af', fontSize: 14 },
});
