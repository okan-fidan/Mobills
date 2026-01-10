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
import { collection, query, orderBy, onSnapshot, addDoc, doc, setDoc, updateDoc, serverTimestamp, writeBatch, getDocs } from 'firebase/firestore';
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
  timestamp: Date;
  status: 'sending' | 'sent' | 'delivered' | 'read';
  readBy?: string[];
  deliveredTo?: string[];
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
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { userProfile, user } = useAuth();
  const router = useRouter();

  const getChatId = useCallback(() => {
    if (!user?.uid || !otherUserId) return null;
    const userIds = [user.uid, otherUserId].sort();
    return `${userIds[0]}_${userIds[1]}`;
  }, [user?.uid, otherUserId]);

  // Mesajları dinle
  useEffect(() => {
    if (!otherUserId || !user) return;

    const loadData = async () => {
      try {
        // Karşı kullanıcının profilini backend'den çek
        const userRes = await userListApi.getOne(otherUserId);
        setOtherUser(userRes.data);

        const chatId = getChatId();
        if (!chatId) return;

        const messagesRef = collection(db, 'conversations', chatId, 'messages');
        const q = query(messagesRef, orderBy('createdAt', 'asc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
          const docs: Message[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as any;
            const readBy = data.readBy || [];
            const deliveredTo = data.deliveredTo || [];
            
            let status: Message['status'] = 'sent';
            if (data.senderId === user.uid) {
              if (readBy.includes(otherUserId)) {
                status = 'read';
              } else if (deliveredTo.includes(otherUserId)) {
                status = 'delivered';
              } else {
                status = 'sent';
              }
            }

            docs.push({
              id: docSnap.id,
              senderId: data.senderId,
              senderName: data.senderName,
              senderProfileImage: data.senderProfileImage,
              content: data.text || '',
              timestamp: data.createdAt?.toDate?.() || new Date(),
              status,
              readBy,
              deliveredTo,
            });
          });
          setMessages(docs);
          setLoading(false);

          // Karşıdaki kullanıcının mesajlarını okundu olarak işaretle
          markMessagesAsRead(docs);
        });

        // Typing indicator dinle
        const conversationRef = doc(db, 'conversations', chatId);
        const typingUnsubscribe = onSnapshot(conversationRef, (docSnap) => {
          const data = docSnap.data();
          if (data?.typing?.[otherUserId]) {
            setOtherUserTyping(true);
          } else {
            setOtherUserTyping(false);
          }
        });

        return () => {
          unsubscribe();
          typingUnsubscribe();
        };
      } catch (error) {
        console.error('Error loading chat:', error);
        setLoading(false);
      }
    };

    loadData();
  }, [otherUserId, user, getChatId]);

  // Mesajları okundu olarak işaretle
  const markMessagesAsRead = async (msgs: Message[]) => {
    if (!user?.uid || !otherUserId) return;
    const chatId = getChatId();
    if (!chatId) return;

    const batch = writeBatch(db);
    let hasUpdates = false;

    for (const msg of msgs) {
      if (msg.senderId === otherUserId && !msg.readBy?.includes(user.uid)) {
        const msgRef = doc(db, 'conversations', chatId, 'messages', msg.id);
        batch.update(msgRef, {
          readBy: [...(msg.readBy || []), user.uid],
        });
        hasUpdates = true;
      }
    }

    if (hasUpdates) {
      try {
        await batch.commit();
      } catch (e) {
        console.error('Error marking messages as read:', e);
      }
    }
  };

  // Typing indicator güncelle
  const updateTypingStatus = async (typing: boolean) => {
    if (!user?.uid) return;
    const chatId = getChatId();
    if (!chatId) return;

    try {
      const conversationRef = doc(db, 'conversations', chatId);
      await updateDoc(conversationRef, {
        [`typing.${user.uid}`]: typing,
      });
    } catch (e) {
      // Doküman yoksa hata verebilir, görmezden gel
    }
  };

  const handleTextChange = (text: string) => {
    setInputText(text);

    // Typing indicator
    if (!isTyping && text.length > 0) {
      setIsTyping(true);
      updateTypingStatus(true);
    }

    // Typing timeout'u sıfırla
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      updateTypingStatus(false);
    }, 2000);
  };

  const handleSend = async () => {
    if (!inputText.trim() || !otherUserId || !user) return;

    // Typing'i kapat
    setIsTyping(false);
    updateTypingStatus(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    setSending(true);
    const messageText = inputText.trim();
    setInputText('');

    try {
      const chatId = getChatId();
      if (!chatId) return;

      const conversationRef = doc(db, 'conversations', chatId);
      // Konuşma dokümanı yoksa temel bilgileriyle oluştur
      await setDoc(
        conversationRef,
        {
          type: 'dm',
          participantIds: [user.uid, otherUserId].sort(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      const messagesRef = collection(conversationRef, 'messages');
      await addDoc(messagesRef, {
        senderId: user.uid,
        senderName: `${userProfile?.firstName || ''} ${userProfile?.lastName || ''}`.trim(),
        senderProfileImage: userProfile?.profileImageUrl || null,
        text: messageText,
        createdAt: serverTimestamp(),
        deliveredTo: [],
        readBy: [user.uid],
        status: 'sent',
      });

      setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
    } catch (error) {
      console.error('Error sending message:', error);
      setInputText(messageText); // Hata durumunda metni geri koy
    } finally {
      setSending(false);
    }
  };

  const formatTime = (date: Date) => {
    try {
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMins < 1) return 'şimdi';
      if (diffMins < 60) return `${diffMins} dk`;
      if (diffMins < 1440) return `${Math.floor(diffMins / 60)} sa`;
      return formatDistanceToNow(date, { addSuffix: false, locale: tr });
    } catch {
      return '';
    }
  };

  // Mesaj durumu ikonu
  const renderMessageStatus = (status: Message['status']) => {
    switch (status) {
      case 'sending':
        return <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.5)" />;
      case 'sent':
        return <Ionicons name="checkmark" size={14} color="rgba(255,255,255,0.7)" />;
      case 'delivered':
        return <Ionicons name="checkmark-done" size={14} color="rgba(255,255,255,0.7)" />;
      case 'read':
        return <Ionicons name="checkmark-done" size={14} color="#60a5fa" />;
      default:
        return null;
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
          <View style={styles.messageFooter}>
            <Text style={[styles.messageTime, isMe && styles.myMessageTime]}>
              {formatTime(item.timestamp)}
            </Text>
            {isMe && (
              <View style={styles.statusIcon}>
                {renderMessageStatus(item.status)}
              </View>
            )}
          </View>
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
          {otherUserTyping ? (
            <View style={styles.typingIndicator}>
              <Text style={styles.typingText}>yazıyor</Text>
              <View style={styles.typingDots}>
                <View style={[styles.typingDot, styles.dot1]} />
                <View style={[styles.typingDot, styles.dot2]} />
                <View style={[styles.typingDot, styles.dot3]} />
              </View>
            </View>
          ) : otherUser?.city ? (
            <Text style={styles.headerSubtitle}>{otherUser.city}</Text>
          ) : null}
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
              <View style={styles.emptyIconContainer}>
                <Ionicons name="chatbubbles-outline" size={48} color="#6366f1" />
              </View>
              <Text style={styles.emptyText}>Sohbete başlayın!</Text>
              <Text style={styles.emptySubtext}>
                {otherUser?.firstName} ile mesajlaşmaya başlayın
              </Text>
            </View>
          }
        />

        {/* Input */}
        <View style={styles.inputContainer}>
          <TouchableOpacity style={styles.attachButton}>
            <Ionicons name="add-circle-outline" size={28} color="#6b7280" />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder="Mesaj yaz..."
            placeholderTextColor="#6b7280"
            value={inputText}
            onChangeText={handleTextChange}
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
    width: 44,
    height: 44,
    borderRadius: 22,
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
    fontSize: 17,
    fontWeight: '600',
  },
  headerSubtitle: {
    color: '#6b7280',
    fontSize: 13,
    marginTop: 2,
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  typingText: {
    color: '#6366f1',
    fontSize: 13,
    fontStyle: 'italic',
  },
  typingDots: {
    flexDirection: 'row',
    marginLeft: 4,
  },
  typingDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#6366f1',
    marginHorizontal: 1,
  },
  dot1: {
    opacity: 0.4,
  },
  dot2: {
    opacity: 0.7,
  },
  dot3: {
    opacity: 1,
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
    borderRadius: 18,
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
    lineHeight: 21,
  },
  myMessageText: {
    color: '#fff',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  messageTime: {
    color: '#9ca3af',
    fontSize: 11,
  },
  myMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  statusIcon: {
    marginLeft: 2,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  emptySubtext: {
    color: '#6b7280',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
    gap: 8,
  },
  attachButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#1f2937',
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 12,
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
