import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../src/services/api';
import { useAuth } from '../src/contexts/AuthContext';

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  category: string;
  points: number;
}

interface Level {
  level: number;
  name: string;
  points: number;
  nextLevelPoints: number | null;
  progress: number;
}

interface LeaderboardEntry {
  uid: string;
  name: string;
  profileImageUrl?: string;
  totalPoints: number;
  level: Level;
  badgeCount: number;
}

export default function BadgesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [myBadges, setMyBadges] = useState<Badge[]>([]);
  const [allBadges, setAllBadges] = useState<Badge[]>([]);
  const [myLevel, setMyLevel] = useState<Level | null>(null);
  const [totalPoints, setTotalPoints] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'my' | 'all' | 'leaderboard'>('my');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [myBadgesRes, allBadgesRes, leaderboardRes] = await Promise.all([
        api.get('/api/badges/my-badges'),
        api.get('/api/badges/definitions'),
        api.get('/api/badges/leaderboard'),
      ]);
      
      setMyBadges(myBadgesRes.data.badges || []);
      setMyLevel(myBadgesRes.data.level);
      setTotalPoints(myBadgesRes.data.totalPoints || 0);
      setAllBadges(allBadgesRes.data || []);
      setLeaderboard(leaderboardRes.data || []);
    } catch (error) {
      console.error('Error loading badges:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderBadgeCard = (badge: Badge, isEarned: boolean = true) => (
    <View key={badge.id} style={[styles.badgeCard, !isEarned && styles.badgeCardLocked]}>
      <View style={[styles.badgeIconContainer, { backgroundColor: badge.color + '20' }]}>
        <Text style={styles.badgeIcon}>{badge.icon}</Text>
      </View>
      <Text style={[styles.badgeName, !isEarned && styles.lockedText]}>{badge.name}</Text>
      <Text style={[styles.badgeDescription, !isEarned && styles.lockedText]} numberOfLines={2}>
        {badge.description}
      </Text>
      <View style={styles.badgePoints}>
        <Ionicons name="star" size={14} color={isEarned ? '#f59e0b' : '#6b7280'} />
        <Text style={[styles.badgePointsText, !isEarned && styles.lockedText]}>{badge.points} puan</Text>
      </View>
      {!isEarned && (
        <View style={styles.lockedOverlay}>
          <Ionicons name="lock-closed" size={24} color="#6b7280" />
        </View>
      )}
    </View>
  );

  const renderLeaderboardItem = (entry: LeaderboardEntry, index: number) => {
    const isMe = entry.uid === user?.uid;
    return (
      <TouchableOpacity
        key={entry.uid}
        style={[styles.leaderboardItem, isMe && styles.leaderboardItemMe]}
        onPress={() => router.push(`/user/${entry.uid}`)}
      >
        <View style={styles.leaderboardRank}>
          {index < 3 ? (
            <Text style={styles.rankMedal}>
              {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
            </Text>
          ) : (
            <Text style={styles.rankNumber}>{index + 1}</Text>
          )}
        </View>
        <View style={styles.leaderboardAvatar}>
          {entry.profileImageUrl ? (
            <Image source={{ uri: entry.profileImageUrl }} style={styles.avatarImage} />
          ) : (
            <Ionicons name="person" size={20} color="#6b7280" />
          )}
        </View>
        <View style={styles.leaderboardInfo}>
          <Text style={styles.leaderboardName}>{entry.name}</Text>
          <Text style={styles.leaderboardLevel}>Seviye {entry.level.level} • {entry.level.name}</Text>
        </View>
        <View style={styles.leaderboardStats}>
          <Text style={styles.leaderboardPoints}>{entry.totalPoints}</Text>
          <Text style={styles.leaderboardPointsLabel}>puan</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rozetler & Seviye</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Level Card */}
        {myLevel && (
          <LinearGradient
            colors={['#6366f1', '#8b5cf6']}
            style={styles.levelCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.levelHeader}>
              <View>
                <Text style={styles.levelTitle}>Seviye {myLevel.level}</Text>
                <Text style={styles.levelName}>{myLevel.name}</Text>
              </View>
              <View style={styles.levelPoints}>
                <Text style={styles.levelPointsValue}>{totalPoints}</Text>
                <Text style={styles.levelPointsLabel}>toplam puan</Text>
              </View>
            </View>
            
            {myLevel.nextLevelPoints && (
              <View style={styles.progressSection}>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${myLevel.progress * 100}%` }]} />
                </View>
                <Text style={styles.progressText}>
                  {Math.round(myLevel.progress * 100)}% • Sonraki seviye: {myLevel.nextLevelPoints} puan
                </Text>
              </View>
            )}
          </LinearGradient>
        )}

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'my' && styles.tabActive]}
            onPress={() => setActiveTab('my')}
          >
            <Text style={[styles.tabText, activeTab === 'my' && styles.tabTextActive]}>
              Rozetlerim ({myBadges.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'all' && styles.tabActive]}
            onPress={() => setActiveTab('all')}
          >
            <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>
              Tüm Rozetler
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'leaderboard' && styles.tabActive]}
            onPress={() => setActiveTab('leaderboard')}
          >
            <Text style={[styles.tabText, activeTab === 'leaderboard' && styles.tabTextActive]}>
              Sıralama
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        {activeTab === 'my' && (
          <View style={styles.badgesGrid}>
            {myBadges.length > 0 ? (
              myBadges.map(badge => renderBadgeCard(badge, true))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="ribbon-outline" size={64} color="#374151" />
                <Text style={styles.emptyTitle}>Henüz rozet kazanmadınız</Text>
                <Text style={styles.emptyText}>Platformda aktif olarak rozet kazanabilirsiniz</Text>
              </View>
            )}
          </View>
        )}

        {activeTab === 'all' && (
          <View style={styles.badgesGrid}>
            {allBadges.map(badge => {
              const isEarned = myBadges.some(b => b.id === badge.id);
              return renderBadgeCard(badge, isEarned);
            })}
          </View>
        )}

        {activeTab === 'leaderboard' && (
          <View style={styles.leaderboard}>
            {leaderboard.length > 0 ? (
              leaderboard.map((entry, index) => renderLeaderboardItem(entry, index))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="trophy-outline" size={64} color="#374151" />
                <Text style={styles.emptyTitle}>Henüz sıralama yok</Text>
                <Text style={styles.emptyText}>Rozet kazanarak sıralamaya girin</Text>
              </View>
            )}
          </View>
        )}
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
  levelCard: { margin: 16, borderRadius: 20, padding: 20 },
  levelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  levelTitle: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  levelName: { color: '#fff', fontSize: 28, fontWeight: 'bold', marginTop: 4 },
  levelPoints: { alignItems: 'flex-end' },
  levelPointsValue: { color: '#fff', fontSize: 32, fontWeight: 'bold' },
  levelPointsLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  progressSection: { marginTop: 20 },
  progressBar: { height: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#fff', borderRadius: 4 },
  progressText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 8, textAlign: 'center' },
  tabs: { flexDirection: 'row', marginHorizontal: 16, backgroundColor: '#111827', borderRadius: 12, padding: 4 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: '#1f2937' },
  tabText: { color: '#6b7280', fontSize: 14, fontWeight: '500' },
  tabTextActive: { color: '#fff' },
  badgesGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, justifyContent: 'space-between' },
  badgeCard: { width: '48%', backgroundColor: '#111827', borderRadius: 16, padding: 16, marginBottom: 12, alignItems: 'center' },
  badgeCardLocked: { opacity: 0.6 },
  badgeIconContainer: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  badgeIcon: { fontSize: 32 },
  badgeName: { color: '#fff', fontSize: 14, fontWeight: '600', textAlign: 'center', marginBottom: 4 },
  badgeDescription: { color: '#9ca3af', fontSize: 12, textAlign: 'center', marginBottom: 8 },
  lockedText: { color: '#6b7280' },
  badgePoints: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  badgePointsText: { color: '#f59e0b', fontSize: 12, fontWeight: '500' },
  lockedOverlay: { position: 'absolute', top: 8, right: 8 },
  leaderboard: { padding: 16 },
  leaderboardItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111827', borderRadius: 12, padding: 12, marginBottom: 8 },
  leaderboardItemMe: { backgroundColor: 'rgba(99, 102, 241, 0.2)', borderWidth: 1, borderColor: '#6366f1' },
  leaderboardRank: { width: 40, alignItems: 'center' },
  rankMedal: { fontSize: 24 },
  rankNumber: { color: '#9ca3af', fontSize: 16, fontWeight: '600' },
  leaderboardAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1f2937', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', marginRight: 12 },
  avatarImage: { width: '100%', height: '100%' },
  leaderboardInfo: { flex: 1 },
  leaderboardName: { color: '#fff', fontSize: 15, fontWeight: '500' },
  leaderboardLevel: { color: '#9ca3af', fontSize: 13, marginTop: 2 },
  leaderboardStats: { alignItems: 'flex-end' },
  leaderboardPoints: { color: '#f59e0b', fontSize: 18, fontWeight: 'bold' },
  leaderboardPointsLabel: { color: '#6b7280', fontSize: 11 },
  emptyState: { flex: 1, alignItems: 'center', paddingVertical: 48, width: '100%' },
  emptyTitle: { color: '#9ca3af', fontSize: 16, marginTop: 16, fontWeight: '500' },
  emptyText: { color: '#6b7280', fontSize: 14, marginTop: 8, textAlign: 'center' },
});
