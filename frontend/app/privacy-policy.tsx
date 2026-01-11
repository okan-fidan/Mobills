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

export default function PrivacyPolicyScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gizlilik Politikası</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.lastUpdated}>Son güncelleme: Ocak 2025</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Toplanan Veriler</Text>
          <Text style={styles.sectionText}>
            Hizmetlerimizi sunmak için aşağıdaki verileri topluyoruz:{"\n"}
            • Hesap bilgileri (ad, e-posta, telefon){"\n"}
            • Profil bilgileri (fotoğraf, meslek, şehir){"\n"}
            • Mesajlar ve paylaşımlar{"\n"}
            • Cihaz ve kullanım bilgileri{"\n"}
            • Konum bilgileri (izin verildiyse)
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Verilerin Kullanımı</Text>
          <Text style={styles.sectionText}>
            Topladığımız verileri şu amaçlarla kullanıyoruz:{"\n"}
            • Hizmetlerimizi sunmak ve geliştirmek{"\n"}
            • Kullanıcı deneyimini kişiselleştirmek{"\n"}
            • İletişim ve bildirim göndermek{"\n"}
            • Güvenlik ve dolandırıcılık önleme{"\n"}
            • Yasal yükümlülükleri yerine getirmek
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Veri Güvenliği</Text>
          <Text style={styles.sectionText}>
            Verilerinizin güvenliği bizim için önemlidir. Firebase güvenlik altyapısı 
            kullanıyoruz ve verileriniz şifreli olarak saklanmaktadır. Düzenli güvenlik 
            denetimleri yapıyor ve en iyi güvenlik uygulamalarını takip ediyoruz.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Veri Paylaşımı</Text>
          <Text style={styles.sectionText}>
            Verilerinizi üçüncü taraflarla paylaşmıyoruz, ancak şu durumlar hariç:{"\n"}
            • Yasal zorunluluklar{"\n"}
            • Hizmet sağlayıcılarımız (Firebase, vb.){"\n"}
            • Sizin açık onayınız ile
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Kullanıcı Hakları</Text>
          <Text style={styles.sectionText}>
            KVKK kapsamında aşağıdaki haklara sahipsiniz:{"\n"}
            • Verilerinize erişim hakkı{"\n"}
            • Verilerin düzeltilmesini isteme hakkı{"\n"}
            • Verilerin silinmesini isteme hakkı{"\n"}
            • Veri işlemenin sınırlandırılması hakkı{"\n"}
            • Veri taşınabilirliği hakkı
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. Çerezler</Text>
          <Text style={styles.sectionText}>
            Uygulamamız performans ve kullanıcı deneyimini iyileştirmek için çerezler 
            ve benzer teknolojiler kullanmaktadır. Cihaz ayarlarınızdan çerezleri 
            yönetebilirsiniz.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. Değişiklikler</Text>
          <Text style={styles.sectionText}>
            Bu gizlilik politikasını zaman zaman güncelleyebiliriz. Önemli değişiklikler 
            için sizi bilgilendireceğiz. Güncel politikayı düzenli olarak kontrol 
            etmenizi öneririz.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>8. İletişim</Text>
          <Text style={styles.sectionText}>
            Gizlilik ile ilgili sorularınız için:{"\n"}
            E-posta: gizlilik@networksolution.com{"\n"}
            Adres: İstanbul, Türkiye
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
