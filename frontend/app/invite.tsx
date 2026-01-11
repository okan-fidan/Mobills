import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Share,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import api from '../src/services/api';
import { useAuth } from '../src/contexts/AuthContext';

export default function InviteScreen() {
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const { communityId, groupId } = useLocalSearchParams<{ communityId?: string; groupId?: string }>();
  
  const [loading, setLoading] = useState(true);
  const [community, setCommunity] = useState<any>(null);
  const [group, setGroup] = useState<any>(null);
  const [inviteLink, setInviteLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(true);

  useEffect(() => {
    loadData();
  }, [communityId, groupId]);

  const loadData = async () => {
    try {
      if (communityId) {
        const res = await api.get(`/api/communities/${communityId}`);
        setCommunity(res.data);
        setInviteLink(`https://networksolution.app/join/community/${communityId}`);
      }
      if (groupId) {
        const res = await api.get(`/api/subgroups/${groupId}`);
        setGroup(res.data);
        setInviteLink(`https://networksolution.app/join/group/${groupId}`);
      }
    } catch (error) {
      console.error('Error loading invite data:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    await Clipboard.setStringAsync(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    Alert.alert('Başarılı', 'Link kopyalandı!');
  };

  const shareLink = async () => {
    try {
      await Share.share({
        message: `${community?.name || group?.name || 'Network Solution'}'a katılmak için: ${inviteLink}`,
        url: inviteLink,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  // QR kod URL'si (Google Chart API kullanarak)
  const getQRCodeUrl = (data: string) => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data)}`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  const targetName = community?.name || group?.name || 'Network Solution';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Davet Et</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <LinearGradient
          colors={['#4338ca', '#6366f1']}
          style={styles.inviteCard}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="people" size={40} color="#fff" />
          </View>
          <Text style={styles.inviteTitle}>{targetName}</Text>
          <Text style={styles.inviteSubtitle}>Arkadaşlarını davet et!</Text>

          {/* QR Code using external API */}
          {showQR && inviteLink && (
            <View style={styles.qrContainer}>
              <View style={styles.qrWrapper}>
                <Image 
                  source={{ uri: getQRCodeUrl(inviteLink) }}
                  style={styles.qrImage}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.qrHint}>QR kodu taratarak katılın</Text>
            </View>
          )}

          <TouchableOpacity 
            style={styles.toggleQR}
            onPress={() => setShowQR(!showQR)}
          >
            <Ionicons name={showQR ? "qr-code-outline" : "qr-code"} size={18} color="#e0e7ff" />
            <Text style={styles.toggleQRText}>
              {showQR ? 'QR Kodu Gizle' : 'QR Kodu Göster'}
            </Text>
          </TouchableOpacity>
        </LinearGradient>

        <View style={styles.linkSection}>
          <Text style={styles.sectionTitle}>Davet Linki</Text>
          <View style={styles.linkContainer}>
            <TextInput
              style={styles.linkInput}
              value={inviteLink}
              editable={false}
              selectTextOnFocus
            />
            <TouchableOpacity 
              style={[styles.copyButton, copied && styles.copyButtonCopied]}
              onPress={copyToClipboard}
            >
              <Ionicons 
                name={copied ? "checkmark" : "copy"} 
                size={20} 
                color="#fff" 
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.shareSection}>
          <Text style={styles.sectionTitle}>Paylaş</Text>
          <View style={styles.shareButtons}>
            <TouchableOpacity style={styles.shareButton} onPress={shareLink}>
              <LinearGradient
                colors={['#10b981', '#059669']}
                style={styles.shareButtonGradient}
              >
                <Ionicons name="share-social" size={24} color="#fff" />
                <Text style={styles.shareButtonText}>Paylaş</Text>
              </LinearGradient>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.shareButton} onPress={copyToClipboard}>
              <LinearGradient
                colors={['#6366f1', '#4338ca']}
                style={styles.shareButtonGradient}
              >
                <Ionicons name="copy" size={24} color="#fff" />
                <Text style={styles.shareButtonText}>Kopyala</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.infoSection}>
          <Ionicons name="information-circle" size={20} color="#6b7280" />
          <Text style={styles.infoText}>
            Bu linki veya QR kodu paylaşarak arkadaşlarınızı {targetName}'a davet edebilirsiniz.
          </Text>
        </View>
      </ScrollView>
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
  contentContainer: { padding: 16 },
  inviteCard: { borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 24 },
  iconContainer: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  inviteTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 8, textAlign: 'center' },
  inviteSubtitle: { fontSize: 16, color: '#e0e7ff', marginBottom: 20 },
  qrContainer: { alignItems: 'center', marginTop: 8 },
  qrWrapper: { padding: 16, backgroundColor: '#fff', borderRadius: 16, marginBottom: 12 },
  qrImage: { width: 180, height: 180 },
  qrHint: { color: '#e0e7ff', fontSize: 13, marginTop: 8 },
  toggleQR: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16, paddingVertical: 8, paddingHorizontal: 16, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20 },
  toggleQRText: { color: '#e0e7ff', fontSize: 14 },
  linkSection: { marginBottom: 24 },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 12 },
  linkContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1f2937', borderRadius: 12, overflow: 'hidden' },
  linkInput: { flex: 1, color: '#9ca3af', fontSize: 14, padding: 14 },
  copyButton: { backgroundColor: '#6366f1', padding: 14, justifyContent: 'center', alignItems: 'center' },
  copyButtonCopied: { backgroundColor: '#10b981' },
  shareSection: { marginBottom: 24 },
  shareButtons: { flexDirection: 'row', gap: 12 },
  shareButton: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  shareButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, gap: 8 },
  shareButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  infoSection: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#1f2937', padding: 16, borderRadius: 12, gap: 12 },
  infoText: { flex: 1, color: '#9ca3af', fontSize: 14, lineHeight: 20 },
});
