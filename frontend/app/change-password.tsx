import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/contexts/AuthContext';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { auth } from '../src/config/firebase';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Hata', 'Lütfen tüm alanları doldurun');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Hata', 'Yeni şifreler eşleşmiyor');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Hata', 'Yeni şifre en az 6 karakter olmalıdır');
      return;
    }

    setLoading(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.email) {
        throw new Error('Kullanıcı oturumu bulunamadı');
      }

      // Re-authenticate user
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);

      // Update password
      await updatePassword(currentUser, newPassword);

      Alert.alert('Başarılı', 'Şifreniz başarıyla değiştirildi', [
        { text: 'Tamam', onPress: () => router.back() }
      ]);
    } catch (error: any) {
      console.error('Error changing password:', error);
      let errorMessage = 'Şifre değiştirilemedi';
      
      if (error.code === 'auth/wrong-password') {
        errorMessage = 'Mevcut şifreniz yanlış';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Yeni şifre çok zayıf';
      } else if (error.code === 'auth/requires-recent-login') {
        errorMessage = 'Bu işlem için yeniden giriş yapmanız gerekiyor';
      }
      
      Alert.alert('Hata', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Şifre Değiştir</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView 
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.iconContainer}>
          <Ionicons name="key" size={48} color="#6366f1" />
        </View>

        <Text style={styles.description}>
          Hesabınızın güvenliği için güçlü bir şifre seçin. Şifreniz en az 6 karakter olmalıdır.
        </Text>

        {/* Current Password */}
        <View style={styles.inputContainer}>
          <Ionicons name="lock-closed" size={20} color="#6b7280" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Mevcut Şifre"
            placeholderTextColor="#6b7280"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry={!showCurrentPassword}
          />
          <TouchableOpacity onPress={() => setShowCurrentPassword(!showCurrentPassword)}>
            <Ionicons name={showCurrentPassword ? 'eye-off' : 'eye'} size={20} color="#6b7280" />
          </TouchableOpacity>
        </View>

        {/* New Password */}
        <View style={styles.inputContainer}>
          <Ionicons name="key" size={20} color="#6b7280" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Yeni Şifre"
            placeholderTextColor="#6b7280"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry={!showNewPassword}
          />
          <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)}>
            <Ionicons name={showNewPassword ? 'eye-off' : 'eye'} size={20} color="#6b7280" />
          </TouchableOpacity>
        </View>

        {/* Confirm Password */}
        <View style={styles.inputContainer}>
          <Ionicons name="checkmark-circle" size={20} color="#6b7280" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Yeni Şifre (Tekrar)"
            placeholderTextColor="#6b7280"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showConfirmPassword}
          />
          <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
            <Ionicons name={showConfirmPassword ? 'eye-off' : 'eye'} size={20} color="#6b7280" />
          </TouchableOpacity>
        </View>

        {/* Password Requirements */}
        <View style={styles.requirements}>
          <Text style={styles.requirementTitle}>Şifre Gereksinimleri:</Text>
          <View style={styles.requirementItem}>
            <Ionicons 
              name={newPassword.length >= 6 ? 'checkmark-circle' : 'ellipse-outline'} 
              size={16} 
              color={newPassword.length >= 6 ? '#10b981' : '#6b7280'} 
            />
            <Text style={[styles.requirementText, newPassword.length >= 6 && styles.requirementMet]}>
              En az 6 karakter
            </Text>
          </View>
          <View style={styles.requirementItem}>
            <Ionicons 
              name={newPassword === confirmPassword && newPassword.length > 0 ? 'checkmark-circle' : 'ellipse-outline'} 
              size={16} 
              color={newPassword === confirmPassword && newPassword.length > 0 ? '#10b981' : '#6b7280'} 
            />
            <Text style={[styles.requirementText, newPassword === confirmPassword && newPassword.length > 0 && styles.requirementMet]}>
              Şifreler eşleşmeli
            </Text>
          </View>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.disabledButton]}
          onPress={handleChangePassword}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Şifreyi Değiştir</Text>
          )}
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1f2937' },
  backButton: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#fff' },
  content: { flex: 1, padding: 24 },
  iconContainer: { width: 88, height: 88, borderRadius: 44, backgroundColor: 'rgba(99, 102, 241, 0.1)', justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 24 },
  description: { color: '#9ca3af', fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 32 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1f2937', borderRadius: 12, paddingHorizontal: 16, marginBottom: 16 },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, paddingVertical: 16, color: '#fff', fontSize: 16 },
  requirements: { marginTop: 8, marginBottom: 24 },
  requirementTitle: { color: '#9ca3af', fontSize: 13, marginBottom: 8 },
  requirementItem: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  requirementText: { color: '#6b7280', fontSize: 13 },
  requirementMet: { color: '#10b981' },
  submitButton: { backgroundColor: '#6366f1', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  disabledButton: { opacity: 0.6 },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
