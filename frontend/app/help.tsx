import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface FAQItem {
  question: string;
  answer: string;
  icon: string;
}

const faqItems: FAQItem[] = [
  {
    question: 'Nasıl yeni topluluk oluşturabilirim?',
    answer: 'Topluluklar sekmesinden sağ üstteki + butonuna tıklayarak yeni topluluk oluşturabilirsiniz. Topluluk adı, açıklama ve kategori bilgilerini girdikten sonra topluluk oluşturulur.',
    icon: 'people',
  },
  {
    question: 'Mesajlarım güvende mi?',
    answer: 'Evet, tüm mesajlarınız şifreli olarak saklanmaktadır. Firebase güvenlik altyapısı kullanılarak verileriniz korunmaktadır.',
    icon: 'shield-checkmark',
  },
  {
    question: 'Profil fotoğrafımı nasıl değiştiririm?',
    answer: 'Profil sayfanızda avatarınızın üzerindeki kamera ikonuna tıklayarak yeni bir fotoğraf seçebilirsiniz.',
    icon: 'camera',
  },
  {
    question: 'Hizmet nasıl ekleyebilirim?',
    answer: 'Profil sayfanızdaki "Hizmet Ekle" butonuna veya Hizmetler sekmesindeki + butonuna tıklayarak hizmet ekleyebilirsiniz. Hizmet başlığı, açıklama, kategori ve fiyat bilgilerini girmeniz gerekmektedir.',
    icon: 'briefcase',
  },
  {
    question: 'Bildirimlerimi nasıl yönetirim?',
    answer: 'Ayarlar sayfasından bildirim tercihlerinizi yönetebilirsiniz. Mesaj, grup, topluluk ve etkinlik bildirimlerini ayrı ayrı açıp kapatabilirsiniz.',
    icon: 'notifications',
  },
  {
    question: 'Hesabımı nasıl silerim?',
    answer: 'Gizlilik ve Güvenlik sayfasındaki "Hesabımı Sil" butonuna tıklayarak hesabınızı silebilirsiniz. Bu işlem geri alınamaz.',
    icon: 'trash',
  },
  {
    question: 'İki faktörlü doğrulama nedir?',
    answer: 'İki faktörlü doğrulama (2FA), hesabınıza ekstra güvenlik katmanı ekler. Giriş yaparken şifrenize ek olarak e-postanıza gönderilen bir kod girmeniz gerekir.',
    icon: 'lock-closed',
  },
  {
    question: 'Etkinlik nasıl oluştururum?',
    answer: 'Etkinlikler sayfasındaki + butonuna tıklayarak yeni etkinlik oluşturabilirsiniz. Online veya yüz yüze etkinlik seçeneği sunulmaktadır.',
    icon: 'calendar',
  },
];

export default function HelpScreen() {
  const router = useRouter();
  const [expandedIndex, setExpandedIndex] = React.useState<number | null>(null);

  const toggleExpand = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  const handleContact = (method: string) => {
    switch (method) {
      case 'email':
        Linking.openURL('mailto:destek@networksolution.com');
        break;
      case 'phone':
        Linking.openURL('tel:+905551234567');
        break;
      case 'web':
        Linking.openURL('https://networksolution.com/destek');
        break;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Yardım ve Destek</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Support Card */}
        <LinearGradient
          colors={['#6366f1', '#8b5cf6']}
          style={styles.supportCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons name="headset" size={48} color="#fff" />
          <Text style={styles.supportTitle}>Size Nasıl Yardımcı Olabiliriz?</Text>
          <Text style={styles.supportText}>
            Aşağıdaki sıkça sorulan sorulara göz atın veya destek ekibimizle iletişime geçin.
          </Text>
        </LinearGradient>

        {/* Contact Options */}
        <View style={styles.contactSection}>
          <Text style={styles.sectionTitle}>İLETİŞİM</Text>
          <View style={styles.contactRow}>
            <TouchableOpacity style={styles.contactItem} onPress={() => handleContact('email')}>
              <View style={[styles.contactIcon, { backgroundColor: 'rgba(99, 102, 241, 0.1)' }]}>
                <Ionicons name="mail" size={24} color="#6366f1" />
              </View>
              <Text style={styles.contactLabel}>E-posta</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.contactItem} onPress={() => handleContact('phone')}>
              <View style={[styles.contactIcon, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                <Ionicons name="call" size={24} color="#10b981" />
              </View>
              <Text style={styles.contactLabel}>Telefon</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.contactItem} onPress={() => handleContact('web')}>
              <View style={[styles.contactIcon, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
                <Ionicons name="globe" size={24} color="#f59e0b" />
              </View>
              <Text style={styles.contactLabel}>Web</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* FAQ */}
        <View style={styles.faqSection}>
          <Text style={styles.sectionTitle}>SIKÇA SORULAN SORULAR</Text>
          
          {faqItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.faqItem}
              onPress={() => toggleExpand(index)}
              activeOpacity={0.7}
            >
              <View style={styles.faqHeader}>
                <View style={styles.faqIconContainer}>
                  <Ionicons name={item.icon as any} size={20} color="#6366f1" />
                </View>
                <Text style={styles.faqQuestion}>{item.question}</Text>
                <Ionicons 
                  name={expandedIndex === index ? 'chevron-up' : 'chevron-down'} 
                  size={20} 
                  color="#6b7280" 
                />
              </View>
              {expandedIndex === index && (
                <View style={styles.faqAnswer}>
                  <Text style={styles.faqAnswerText}>{item.answer}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Quick Links */}
        <View style={styles.linksSection}>
          <Text style={styles.sectionTitle}>HIZLI BAĞLANTILAR</Text>
          
          <TouchableOpacity style={styles.linkItem} onPress={() => router.push('/about')}>
            <Ionicons name="information-circle-outline" size={22} color="#6b7280" />
            <Text style={styles.linkText}>Hakkımızda</Text>
            <Ionicons name="chevron-forward" size={20} color="#6b7280" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkItem} onPress={() => router.push('/terms')}>
            <Ionicons name="document-text-outline" size={22} color="#6b7280" />
            <Text style={styles.linkText}>Kullanım Koşulları</Text>
            <Ionicons name="chevron-forward" size={20} color="#6b7280" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkItem} onPress={() => router.push('/privacy-policy')}>
            <Ionicons name="shield-outline" size={22} color="#6b7280" />
            <Text style={styles.linkText}>Gizlilik Politikası</Text>
            <Ionicons name="chevron-forward" size={20} color="#6b7280" />
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Network Solution v1.0.0</Text>
          <Text style={styles.footerSubtext}>© 2025 Tüm hakları saklıdır</Text>
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
  supportCard: { margin: 16, borderRadius: 20, padding: 24, alignItems: 'center' },
  supportTitle: { color: '#fff', fontSize: 20, fontWeight: '600', marginTop: 16, textAlign: 'center' },
  supportText: { color: 'rgba(255,255,255,0.8)', fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  contactSection: { paddingHorizontal: 16, paddingVertical: 16 },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: '#6b7280', marginBottom: 16, letterSpacing: 0.5 },
  contactRow: { flexDirection: 'row', justifyContent: 'space-around' },
  contactItem: { alignItems: 'center' },
  contactIcon: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  contactLabel: { color: '#9ca3af', fontSize: 13 },
  faqSection: { paddingHorizontal: 16, paddingVertical: 16 },
  faqItem: { backgroundColor: '#111827', borderRadius: 12, marginBottom: 10, overflow: 'hidden' },
  faqHeader: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  faqIconContainer: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(99, 102, 241, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  faqQuestion: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '500' },
  faqAnswer: { paddingHorizontal: 14, paddingBottom: 14, paddingTop: 0 },
  faqAnswerText: { color: '#9ca3af', fontSize: 14, lineHeight: 20 },
  linksSection: { paddingHorizontal: 16, paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#1f2937' },
  linkItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12 },
  linkText: { flex: 1, color: '#fff', fontSize: 15 },
  footer: { alignItems: 'center', paddingVertical: 32 },
  footerText: { color: '#6b7280', fontSize: 13 },
  footerSubtext: { color: '#4b5563', fontSize: 11, marginTop: 4 },
});
