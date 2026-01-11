import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TermsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Kullanım Koşulları</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.lastUpdated}>Son güncelleme: Ocak 2025</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Hizmet Kullanımı</Text>
          <Text style={styles.sectionText}>
            Network Solution uygulamasını kullanarak bu kullanım koşullarını kabul etmiş olursunuz. 
            Uygulama, girişimcilerin birbirleriyle iletişim kurması ve network oluşturması için 
            tasarlanmıştır. Uygulamayı yasalara uygun şekilde kullanmayı kabul edersiniz.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Hesap Güvenliği</Text>
          <Text style={styles.sectionText}>
            Hesap bilgilerinizin güvenliğinden siz sorumlusunuz. Şifrenizi kimseyle paylaşmamalı 
            ve hesabınızda şüpheli bir aktivite fark ettiğinizde bizi bilgilendirmelisiniz. 
            İki faktörlü doğrulama kullanmanızı öneririz.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. İçerik Politikası</Text>
          <Text style={styles.sectionText}>
            Paylaştığınız tüm içeriklerden siz sorumlusunuz. Yasadışı, zararlı, tehditkar, 
            taciz edici, iftira niteliğinde veya başka şekilde sakıncalı içerik paylaşmak yasaktır. 
            Bu tür içerikleri kaldırma ve hesapları askıya alma hakkını saklı tutarız.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Fikri Mülkiyet</Text>
          <Text style={styles.sectionText}>
            Network Solution'ın tüm fikri mülkiyet hakları bize aittir. Logo, tasarım ve 
            yazılımlarımızı izinsiz kullanmak yasaktır. Paylaştığınız içerikler üzerindeki 
            haklarınız size aittir, ancak bize kullanım lisansı vermiş olursunuz.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Hizmet Değişiklikleri</Text>
          <Text style={styles.sectionText}>
            Hizmetlerimizi istediğimiz zaman değiştirme veya sonlandırma hakkını saklı tutarız. 
            Önemli değişiklikler için kullanıcıları önceden bilgilendirmeye çalışırız.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. Sorumluluk Sınırlaması</Text>
          <Text style={styles.sectionText}>
            Hizmetlerimizi "olduğu gibi" sunuyoruz. Kesintisiz veya hatasız çalışacağını 
            garanti etmiyoruz. Hizmet kullanımından doğabilecek dolaylı zararlardan 
            sorumlu değiliz.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. İletişim</Text>
          <Text style={styles.sectionText}>
            Bu koşullarla ilgili sorularınız için destek@networksolution.com adresinden 
            bize ulaşabilirsiniz.
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>© 2025 Network Solution</Text>
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
  content: { flex: 1, padding: 16 },
  lastUpdated: { color: '#6b7280', fontSize: 13, marginBottom: 24 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 10 },
  sectionText: { fontSize: 14, color: '#9ca3af', lineHeight: 22 },
  footer: { alignItems: 'center', paddingVertical: 32 },
  footerText: { color: '#6b7280', fontSize: 13 },
});
