import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const teamMembers = [
  { name: 'Ahmet Yılmaz', role: 'Kurucu & CEO', avatar: 'AY' },
  { name: 'Elif Kaya', role: 'CTO', avatar: 'EK' },
  { name: 'Mehmet Demir', role: 'Tasarım Direktörü', avatar: 'MD' },
];

const stats = [
  { label: 'Kullanıcı', value: '10K+', icon: 'people' },
  { label: 'Topluluk', value: '500+', icon: 'business' },
  { label: 'Mesaj', value: '1M+', icon: 'chatbubbles' },
  { label: 'Etkinlik', value: '200+', icon: 'calendar' },
];

export default function AboutScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Hakkımızda</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Hero Section */}
        <LinearGradient
          colors={['#1e1b4b', '#312e81', '#4338ca']}
          style={styles.heroSection}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.logoContainer}>
            <Ionicons name="business" size={48} color="#fff" />
          </View>
          <Text style={styles.appName}>Network Solution</Text>
          <Text style={styles.tagline}>Girişimcileri Buluşturan Platform</Text>
          <Text style={styles.version}>Versiyon 1.0.0</Text>
        </LinearGradient>

        {/* Stats */}
        <View style={styles.statsContainer}>
          {stats.map((stat, index) => (
            <View key={index} style={styles.statItem}>
              <View style={styles.statIcon}>
                <Ionicons name={stat.icon as any} size={24} color="#6366f1" />
              </View>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Mission */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>MİSYONUMUZ</Text>
          <View style={styles.missionCard}>
            <Ionicons name="rocket" size={32} color="#6366f1" />
            <Text style={styles.missionText}>
              Girişimcileri bir araya getirerek, bilgi paylaşımını ve iş birliğini kolaylaştırmak.
              Türkiye'nin her yerinden girişimcilerin network oluşturmasına yardımcı olmak.
            </Text>
          </View>
        </View>

        {/* Features */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ÖZELLİKLERİMİZ</Text>
          
          <View style={styles.featureItem}>
            <View style={[styles.featureIcon, { backgroundColor: 'rgba(99, 102, 241, 0.1)' }]}>
              <Ionicons name="people" size={24} color="#6366f1" />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Topluluklar</Text>
              <Text style={styles.featureDesc}>Şehir ve sektör bazlı topluluklar ile network oluşturun</Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <View style={[styles.featureIcon, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
              <Ionicons name="chatbubbles" size={24} color="#10b981" />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Anlık Mesajlaşma</Text>
              <Text style={styles.featureDesc}>Güvenli ve hızlı iletişim altyapısı</Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <View style={[styles.featureIcon, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
              <Ionicons name="briefcase" size={24} color="#f59e0b" />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Hizmet Pazarı</Text>
              <Text style={styles.featureDesc}>Hizmetlerinizi tanıtın, değerlendirme alın</Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <View style={[styles.featureIcon, { backgroundColor: 'rgba(236, 72, 153, 0.1)' }]}>
              <Ionicons name="calendar" size={24} color="#ec4899" />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Etkinlikler</Text>
              <Text style={styles.featureDesc}>Online ve yüz yüze etkinlikler düzenleyin</Text>
            </View>
          </View>
        </View>

        {/* Team */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>EKİBİMİZ</Text>
          <View style={styles.teamGrid}>
            {teamMembers.map((member, index) => (
              <View key={index} style={styles.teamMember}>
                <View style={styles.teamAvatar}>
                  <Text style={styles.teamAvatarText}>{member.avatar}</Text>
                </View>
                <Text style={styles.teamName}>{member.name}</Text>
                <Text style={styles.teamRole}>{member.role}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Contact */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>İLETİŞİM</Text>
          
          <TouchableOpacity 
            style={styles.contactItem}
            onPress={() => Linking.openURL('mailto:info@networksolution.com')}
          >
            <Ionicons name="mail" size={20} color="#6366f1" />
            <Text style={styles.contactText}>info@networksolution.com</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.contactItem}
            onPress={() => Linking.openURL('https://networksolution.com')}
          >
            <Ionicons name="globe" size={20} color="#6366f1" />
            <Text style={styles.contactText}>www.networksolution.com</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.contactItem}
            onPress={() => Linking.openURL('https://twitter.com/networksolution')}
          >
            <Ionicons name="logo-twitter" size={20} color="#1DA1F2" />
            <Text style={styles.contactText}>@networksolution</Text>
          </TouchableOpacity>
        </View>

        {/* Legal */}
        <View style={styles.legalSection}>
          <TouchableOpacity onPress={() => router.push('/terms')}>
            <Text style={styles.legalLink}>Kullanım Koşulları</Text>
          </TouchableOpacity>
          <Text style={styles.legalDivider}>•</Text>
          <TouchableOpacity onPress={() => router.push('/privacy-policy')}>
            <Text style={styles.legalLink}>Gizlilik Politikası</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>© 2025 Network Solution</Text>
          <Text style={styles.footerSubtext}>Tüm hakları saklıdır</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1f2937' },
  backButton: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#fff' },
  content: { flex: 1 },
  heroSection: { padding: 32, alignItems: 'center' },
  logoContainer: { width: 88, height: 88, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  appName: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  tagline: { fontSize: 16, color: 'rgba(255,255,255,0.8)', marginTop: 8 },
  version: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 16, backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  statsContainer: { flexDirection: 'row', marginHorizontal: 16, marginTop: -20, backgroundColor: '#111827', borderRadius: 16, padding: 16 },
  statItem: { flex: 1, alignItems: 'center' },
  statIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(99, 102, 241, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  statValue: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  statLabel: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  section: { paddingHorizontal: 16, paddingVertical: 20 },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: '#6b7280', marginBottom: 16, letterSpacing: 0.5 },
  missionCard: { backgroundColor: '#111827', borderRadius: 16, padding: 20, alignItems: 'center' },
  missionText: { color: '#9ca3af', fontSize: 15, lineHeight: 24, textAlign: 'center', marginTop: 16 },
  featureItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  featureIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  featureContent: { flex: 1 },
  featureTitle: { fontSize: 15, fontWeight: '600', color: '#fff' },
  featureDesc: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  teamGrid: { flexDirection: 'row', justifyContent: 'space-around' },
  teamMember: { alignItems: 'center' },
  teamAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  teamAvatarText: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  teamName: { fontSize: 14, fontWeight: '600', color: '#fff' },
  teamRole: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  contactItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  contactText: { color: '#9ca3af', fontSize: 15 },
  legalSection: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 16, gap: 12 },
  legalLink: { color: '#6366f1', fontSize: 14 },
  legalDivider: { color: '#6b7280' },
  footer: { alignItems: 'center', paddingVertical: 24 },
  footerText: { color: '#6b7280', fontSize: 13 },
  footerSubtext: { color: '#4b5563', fontSize: 11, marginTop: 4 },
});
