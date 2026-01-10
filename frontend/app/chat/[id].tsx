import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, orderBy, onSnapshot, addDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import { userListApi } from '../../src/services/api';
import { useAuth } from '../../src/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderProfileImage?: string;
  content: string;
  timestamp: string;
}

interface User {
  uid: string;
  firstName: string;
  lastName: string;
  profileImageUrl?: string;
  city?: string;
}

export default function PrivateChatScreen() {
  const { id: otherUserId } = useLocalSearchParams<{ id: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [otherUser, setOtherUser] = useState<User | null>(null);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const { userProfile, user } = useAuth();
  const router = useRouter();

  const loadData = useCallback(async () => {
    if (!otherUserId || !user) return;
    try {
      // Karşı kullanıcının profilini backend'den çek
      const userRes = await userListApi.getOne(otherUserId);
      setOtherUser(userRes.data);

      // Sohbet kimliğini iki kullanıcının uid'sine göre belirle
      const userIds = [user.uid, otherUserId].sort();
      const chatId = `${userIds[0]}_${userIds[1]}`;

      const messagesRef = collection(db, 'conversations', chatId, 'messages');
      const q = query(messagesRef, orderBy('createdAt', 'asc'));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const docs: Message[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as any;
          docs.push({
            id: docSnap.id,
            senderId: data.senderId,
            senderName: data.senderName,
            senderProfileImage: data.senderProfileImage,
            content: data.text || '',
            timestamp: data.createdAt?.toDate?.().toISOString?.() || new Date().toISOString(),
          });
        });
        setMessages(docs);
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error('Error loading chat:', error);
      setLoading(false);
    }
  }, [otherUserId, user]);

  useEffect(() => {
    const unsubscribe = loadData();
    return () => {
      if (typeof unsubscribe === 'function') {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        unsubscribe();
      }
    };
  }, [loadData]);

  const handleSend = async () => {
    if (!inputText.trim() || !otherUserId) return;

    setSending(true);
    try {
      const response = await messageApi.sendPrivate({
        receiverId: otherUserId,
        content: inputText.trim(),
      });
      setMessages([...messages, response.data]);
      setInputText('');
      setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true, locale: tr });
    } catch {
      return '';
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.senderId === user?.uid;

    return (
      <View style={[styles.messageContainer, isMe && styles.myMessageContainer]}>
        {!isMe && (
          <View style={styles.avatarSmall}>
            {item.senderProfileImage ? (
              <Image source={{ uri: item.senderProfileImage }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person" size={16} color="#9ca3af" />
            )}
          </View>
        )}
        <View style={[styles.messageBubble, isMe ? styles.myBubble : styles.otherBubble]}>
          <Text style={[styles.messageText, isMe && styles.myMessageText]}>{item.content}</Text>
          <Text style={[styles.messageTime, isMe && styles.myMessageTime]}>
            {formatTime(item.timestamp)}
          </Text>
        </View>
      </View>
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
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.avatar}>
          {otherUser?.profileImageUrl ? (
            <Image source={{ uri: otherUser.profileImageUrl }} style={styles.avatarImage} />
          ) : (
            <Ionicons name="person" size={20} color="#9ca3af" />
          )}
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>
            {otherUser?.firstName} {otherUser?.lastName}
          </Text>
          {otherUser?.city && (
            <Text style={styles.headerSubtitle}>{otherUser.city}</Text>
          )}
        </View>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="chatbubbles-outline" size={64} color="#374151" />
              <Text style={styles.emptyText}>Henüz mesaj yok</Text>
              <Text style={styles.emptySubtext}>Bir mesaj göndererek sohbeti başlatın</Text>
            </View>
          }
        />

        {/* Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Mesaj yaz..."
            placeholderTextColor="#6b7280"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!inputText.trim() || sending) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  backButton: {
    marginRight: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1f2937',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1f2937',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginRight: 8,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  headerName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  headerSubtitle: {
    color: '#6b7280',
    fontSize: 13,
    marginTop: 2,
  },
  keyboardView: {
    flex: 1,
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexGrow: 1,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-end',
  },
  myMessageContainer: {
    flexDirection: 'row-reverse',
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 16,
  },
  myBubble: {
    backgroundColor: '#6366f1',
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: '#1f2937',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    color: '#e5e7eb',
    fontSize: 15,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#fff',
  },
  messageTime: {
    color: '#9ca3af',
    fontSize: 11,
    marginTop: 4,
  },
  myMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 16,
    marginTop: 16,
  },
  emptySubtext: {
    color: '#6b7280',
    fontSize: 13,
    marginTop: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
    gap: 12,
  },
  input: {
    flex: 1,
    backgroundColor: '#1f2937',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 15,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
