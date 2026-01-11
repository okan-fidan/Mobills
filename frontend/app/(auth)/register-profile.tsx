import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { generalApi } from '../../src/services/api';
import { Picker } from '@react-native-picker/picker';

export default function RegisterProfileScreen() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [occupation, setOccupation] = useState('');
  const [cities, setCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingCities, setLoadingCities] = useState(true);
  const { user, registerProfile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    loadCities();
  }, []);

  const loadCities = async () => {
    try {
      const response = await generalApi.getCities();
      setCities(response.data.cities);
    } catch (error) {
      console.error('Error loading cities:', error);
      // Fallback cities
      setCities(['İstanbul', 'Ankara', 'İzmir', 'Bursa', 'Antalya']);
    } finally {
      setLoadingCities(false);
    }
  };

  const handleSubmit = async () => {
    if (!firstName || !lastName || !city) {
      Alert.alert('Hata', 'Lütfen zorunlu alanları doldurun');
      return;
    }

    setLoading(true);
    try {
      await registerProfile({
        email: user?.email || '',
        firstName,
        lastName,
        phone,
        city,
        occupation,
      });
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Error registering profile:', error);
      Alert.alert('Hata', 'Profil oluşturulamadı');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Ionicons name="person-circle" size={80} color="#6366f1" />
            <Text style={styles.title}>Profil Bilgileri</Text>
            <Text style={styles.subtitle}>Bilgilerinizi tamamlayın</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color="#9ca3af" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Ad *"
                placeholderTextColor="#6b7280"
                value={firstName}
                onChangeText={setFirstName}
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color="#9ca3af" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Soyad *"
                placeholderTextColor="#6b7280"
                value={lastName}
                onChangeText={setLastName}
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="call-outline" size={20} color="#9ca3af" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Telefon"
                placeholderTextColor="#6b7280"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.pickerContainer}>
              <Ionicons name="location-outline" size={20} color="#9ca3af" style={styles.inputIcon} />
              {loadingCities ? (
                <ActivityIndicator size="small" color="#6366f1" />
              ) : (
                <View style={styles.pickerWrapper}>
                  <Text style={[styles.pickerLabel, city ? styles.pickerLabelSelected : {}]}>
                    {city || 'Şehir Seçin *'}
                  </Text>
                  <Picker
                    selectedValue={city}
                    onValueChange={(itemValue) => setCity(itemValue)}
                    style={styles.picker}
                    dropdownIconColor="#9ca3af"
                  >
                    <Picker.Item label="Şehir Seçin" value="" color="#6b7280" />
                    {cities.map((c) => (
                      <Picker.Item key={c} label={c} value={c} color="#000" />
                    ))}
                  </Picker>
                </View>
              )}
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="briefcase-outline" size={20} color="#9ca3af" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Meslek"
                placeholderTextColor="#6b7280"
                value={occupation}
                onChangeText={setOccupation}
              />
            </View>

            {Platform.OS === 'web' ? (
              <button
                style={{
                  backgroundColor: '#6366f1',
                  height: 56,
                  borderRadius: 12,
                  border: 'none',
                  cursor: 'pointer',
                  width: '100%',
                  marginTop: 16,
                  opacity: loading ? 0.7 : 1,
                }}
                onClick={() => {
                  console.log('Web button clicked!');
                  handleSubmit();
                }}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Tamamla</Text>
                )}
              </button>
            ) : (
              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={() => {
                  console.log('Button pressed!');
                  handleSubmit();
                }}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Tamamla</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#9ca3af',
    marginTop: 8,
  },
  form: {
    gap: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 1,
    borderColor: '#374151',
  },
  pickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 1,
    borderColor: '#374151',
  },
  pickerWrapper: {
    flex: 1,
    position: 'relative',
  },
  pickerLabel: {
    color: '#6b7280',
    fontSize: 16,
    position: 'absolute',
    left: 0,
    top: 18,
    zIndex: 1,
  },
  pickerLabelSelected: {
    color: '#fff',
  },
  picker: {
    flex: 1,
    color: '#fff',
    opacity: 0,
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#6366f1',
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
