import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import api from '../../src/services/api';

const CATEGORIES = [
  { value: 'consulting', label: 'Danışmanlık' },
  { value: 'marketing', label: 'Pazarlama' },
  { value: 'design', label: 'Tasarım' },
  { value: 'development', label: 'Yazılım' },
  { value: 'finance', label: 'Finans' },
  { value: 'legal', label: 'Hukuk' },
  { value: 'other', label: 'Diğer' },
];

export default function CreateServiceScreen() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('consulting');
  const [price, setPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleCreate = async () => {
    if (!title.trim() || !description.trim()) {
      Alert.alert('Hata', 'Lütfen başlık ve açıklama girin');
      return;
    }

    setLoading(true);
    try {
      await api.post('/services', {
        title: title.trim(),
        description: description.trim(),
        category,
        price: price ? parseFloat(price) : null,
      });
      Alert.alert('Başarılı', 'Hizmetiniz eklendi!', [
        { text: 'Tamam', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('Error creating service:', error);
      Alert.alert('Hata', 'Hizmet eklenemedi');
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
          <Text style={styles.headerTitle}>Hizmet Ekle</Text>
          <TouchableOpacity
            style={[styles.saveButton, (!title.trim() || !description.trim() || loading) && styles.saveButtonDisabled]}
            onPress={handleCreate}
            disabled={!title.trim() || !description.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Kaydet</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Hizmet Başlığı</Text>
            <TextInput
              style={styles.input}
              placeholder="Örn: Web Sitesi Tasarımı"
              placeholderTextColor="#6b7280"
              value={title}
              onChangeText={setTitle}
              maxLength={100}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Kategori</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={category}
                onValueChange={setCategory}
                style={styles.picker}
                dropdownIconColor="#fff"
              >
                {CATEGORIES.map((cat) => (
                  <Picker.Item key={cat.value} label={cat.label} value={cat.value} color="#fff" />
                ))}
              </Picker>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Açıklama</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Hizmetinizi detaylı açıklayın..."
              placeholderTextColor="#6b7280"
              value={description}
              onChangeText={setDescription}
              multiline
              maxLength={1000}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Fiyat (Opsiyonel)</Text>
            <View style={styles.priceInput}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="0"
                placeholderTextColor="#6b7280"
                value={price}
                onChangeText={setPrice}
                keyboardType="numeric"
              />
              <Text style={styles.currency}>₺</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1f2937' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '600' },
  saveButton: { backgroundColor: '#10b981', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  content: { flex: 1, padding: 16 },
  inputGroup: { marginBottom: 24 },
  label: { color: '#9ca3af', fontSize: 14, fontWeight: '500', marginBottom: 8 },
  input: { backgroundColor: '#1f2937', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: '#fff', fontSize: 16 },
  textArea: { minHeight: 120, textAlignVertical: 'top' },
  pickerContainer: { backgroundColor: '#1f2937', borderRadius: 12, overflow: 'hidden' },
  picker: { color: '#fff' },
  priceInput: { flexDirection: 'row', alignItems: 'center' },
  currency: { color: '#6b7280', fontSize: 18, marginLeft: 12 },
});
