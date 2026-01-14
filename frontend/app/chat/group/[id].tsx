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
  Alert,
  ScrollView,
  Modal,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Location from 'expo-location';
import { Video, ResizeMode } from 'expo-av';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../../src/config/firebase';
import { subgroupApi } from '../../../src/services/api';
import { useAuth } from '../../../src/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import api from '../../../src/services/api';

// Tepki emoji listesi
const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡'];
const EMOJI_LIST = [
  '😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂',
  '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛',
  '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
  '🔥', '✨', '🎉', '🎊', '💯', '👏', '🙌', '👋', '🤝', '💪',
];

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderProfileImage?: string;
  content: string;
  timestamp: string;
  type?: 'text' | 'image' | 'video' | 'file' | 'location' | 'poll';
  mediaUrl?: string;
  fileName?: string;
  edited?: boolean;
  isPinned?: boolean;
  replyTo?: {
    id: string;
    content: string;
    senderName: string;
  };
  status?: 'sent' | 'delivered' | 'read';
  readBy?: string[];
  deliveredTo?: string[];
  reactions?: { emoji: string; userId: string; userName: string }[];
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
    isLive?: boolean;
  };
  poll?: Poll;
}

interface Poll {
  id: string;
  question: string;
  options: { id: string; text: string; votes: string[] }[];
  createdBy: string;
  createdByName: string;
  createdAt: string;
  isMultipleChoice: boolean;
  isAnonymous: boolean;
}

interface SubGroup {
  id: string;
  name: string;
  memberCount: number;
  communityName?: string;
  groupAdmins?: string[];
  members?: string[];
}

export default function GroupChatScreen() {
  const { id: groupId } = useLocalSearchParams<{ id: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [subgroup, setSubgroup] = useState<SubGroup | null>(null);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showMessageActions, setShowMessageActions] = useState(false);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  // Yanıtlama (Reply) için state
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  // İletme (Forward) için state
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardTargets, setForwardTargets] = useState<{id: string, name: string, type: 'group' | 'user'}[]>([]);
  const [loadingForwardTargets, setLoadingForwardTargets] = useState(false);
  // @mention için state'ler
  const [showMentionList, setShowMentionList] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [groupMembers, setGroupMembers] = useState<{uid: string; firstName: string; lastName: string}[]>([]);
  // Anketler
  const [polls, setPolls] = useState<Poll[]>([]);
  const [showPollModal, setShowPollModal] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  // Akıllı yanıtlar
  const [smartReplies, setSmartReplies] = useState<string[]>([]);
  const [loadingSmartReplies, setLoadingSmartReplies] = useState(false);
  // Tepki (Reaction) için state'ler
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [reactionTargetMessage, setReactionTargetMessage] = useState<Message | null>(null);
  // Konum paylaşma için state'ler
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(false);
  
  const flatListRef = useRef<FlatList>(null);
  const { user, userProfile } = useAuth();
  const router = useRouter();

  const isGroupAdmin = subgroup?.groupAdmins?.includes(user?.uid || '') || false;

  // Filtrelenmiş üye listesi (@mention için)
  const filteredMembers = groupMembers.filter(member => {
    const fullName = `${member.firstName} ${member.lastName}`.toLowerCase();
    return fullName.includes(mentionSearch.toLowerCase());
  });

  const loadData = useCallback(async () => {
    if (!groupId) return;
    try {
      const [messagesRes, groupRes] = await Promise.all([
        subgroupApi.getMessages(groupId),
        subgroupApi.getOne(groupId),
      ]);
      setMessages(messagesRes.data.reverse());
      setSubgroup(groupRes.data);
      
      // Üyeleri yükle (@mention için)
      try {
        const membersRes = await subgroupApi.getMembers(groupId);
        setGroupMembers(membersRes.data || []);
      } catch (e) {
        // Üye yükleme hatası sessizce geç
      }
      
      // Mesajları okundu olarak işaretle
      markMessagesAsRead();
    } catch (error) {
      console.error('Error loading group chat:', error);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  // Mesajları okundu olarak işaretle
  const markMessagesAsRead = async () => {
    if (!groupId || !user?.uid) return;
    try {
      const unreadMessages = messages.filter(
        m => m.senderId !== user.uid && !m.readBy?.includes(user.uid)
      );
      for (const msg of unreadMessages) {
        await api.post(`/api/messages/${msg.id}/status`, { status: 'read' });
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Son mesaj değiştiğinde akıllı yanıtları yükle
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.senderId !== user?.uid && lastMessage.type === 'text') {
      loadSmartReplies(lastMessage.content);
    } else {
      setSmartReplies([]);
    }
  }, [messages]);

  // Akıllı yanıtları yükle
  const loadSmartReplies = async (messageContent: string) => {
    if (!messageContent || messageContent.length < 3) {
      setSmartReplies([]);
      return;
    }
    
    setLoadingSmartReplies(true);
    try {
      const response = await api.post('/ai/smart-replies', {
        messageContent,
        conversationType: 'group',
      });
      setSmartReplies(response.data.replies || []);
    } catch (error) {
      console.error('Error loading smart replies:', error);
      setSmartReplies([]);
    } finally {
      setLoadingSmartReplies(false);
    }
  };

  // Akıllı yanıtı seç ve gönder
  const handleSelectSmartReply = (reply: string) => {
    setInputText(reply);
    setSmartReplies([]);
  };

  // İletme hedeflerini yükle
  const loadForwardTargets = async () => {
    setLoadingForwardTargets(true);
    try {
      const [chatsRes, usersRes] = await Promise.all([
        api.get('/api/chats'),
        api.get('/api/users'),
      ]);
      
      const targets: {id: string, name: string, type: 'group' | 'user'}[] = [];
      
      // Sohbetleri ekle
      chatsRes.data?.forEach((chat: any) => {
        targets.push({
          id: chat.chatId,
          name: chat.userName,
          type: 'user'
        });
      });
      
      // Kullanıcıları ekle (henüz sohbet başlatılmamış olanlar)
      usersRes.data?.slice(0, 20).forEach((u: any) => {
        if (!targets.find(t => t.id.includes(u.uid))) {
          targets.push({
            id: u.uid,
            name: `${u.firstName} ${u.lastName}`,
            type: 'user'
          });
        }
      });
      
      setForwardTargets(targets);
    } catch (error) {
      console.error('Error loading forward targets:', error);
    } finally {
      setLoadingForwardTargets(false);
    }
  };

  const uploadMedia = async (uri: string, type: 'image' | 'video' | 'file', fileName?: string) => {
    if (!user?.uid || !groupId) return null;
    
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const ext = type === 'file' ? (fileName?.split('.').pop() || 'file') : (type === 'video' ? 'mp4' : 'jpg');
      const path = `group_media/${groupId}/${Date.now()}.${ext}`;
      const storageRef = ref(storage, path);
      
      await uploadBytes(storageRef, blob);
      return await getDownloadURL(storageRef);
    } catch (error) {
      console.error('Error uploading media:', error);
      return null;
    }
  };

  const handleSend = async (mediaUrl?: string, mediaType?: 'image' | 'video' | 'file', fileName?: string) => {
    // Düzenleme modu
    if (editingMessage) {
      await handleEditMessage();
      return;
    }
    
    if ((!inputText.trim() && !mediaUrl) || !groupId) return;

    setSending(true);
    setShowEmojiPicker(false);
    setShowAttachMenu(false);
    
    const messageText = inputText.trim();
    setInputText('');

    try {
      const messageData: any = {
        content: messageText,
        type: mediaType || 'text',
      };
      
      if (mediaUrl) {
        messageData.mediaUrl = mediaUrl;
        if (fileName) messageData.fileName = fileName;
      }

      // Yanıtlanan mesaj varsa ekle
      if (replyingTo) {
        messageData.replyTo = {
          id: replyingTo.id,
          content: replyingTo.content.substring(0, 100),
          senderName: replyingTo.senderName,
        };
      }

      const response = await subgroupApi.sendMessage(groupId, messageData);
      setMessages([...messages, response.data]);
      setReplyingTo(null);
      setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
    } catch (error) {
      console.error('Error sending message:', error);
      setInputText(messageText);
    } finally {
      setSending(false);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!groupId) return;
    
    Alert.alert(
      'Mesajı Sil',
      'Bu mesajı silmek istediğinize emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              await subgroupApi.deleteMessage(groupId, messageId);
              setMessages(messages.filter(m => m.id !== messageId));
            } catch (error) {
              console.error('Error deleting message:', error);
              Alert.alert('Hata', 'Mesaj silinemedi');
            }
          },
        },
      ]
    );
    setShowMessageActions(false);
  };

  const handleEditMessage = async () => {
    if (!editingMessage || !inputText.trim() || !groupId) return;
    
    try {
      await subgroupApi.editMessage(groupId, editingMessage.id, inputText.trim());
      setMessages(messages.map(m => 
        m.id === editingMessage.id 
          ? { ...m, content: inputText.trim(), edited: true }
          : m
      ));
      setEditingMessage(null);
      setInputText('');
    } catch (error) {
      console.error('Error editing message:', error);
      Alert.alert('Hata', 'Mesaj düzenlenemedi');
    }
  };

  const startEditMessage = (message: Message) => {
    setEditingMessage(message);
    setInputText(message.content);
    setShowMessageActions(false);
  };

  const cancelEdit = () => {
    setEditingMessage(null);
    setInputText('');
  };

  const handlePinMessage = async (message: Message) => {
    if (!groupId) return;
    
    try {
      await subgroupApi.pinMessage(groupId, message.id);
      Alert.alert('Başarılı', 'Mesaj sabitlendi');
      setMessages(messages.map(m => 
        m.id === message.id ? { ...m, isPinned: true } : m
      ));
    } catch (error: any) {
      console.error('Error pinning message:', error);
      Alert.alert('Hata', error?.response?.data?.detail || 'Mesaj sabitlenemedi');
    }
    setShowMessageActions(false);
  };

  // Yanıtlama başlat
  const startReply = (message: Message) => {
    setReplyingTo(message);
    setShowMessageActions(false);
  };

  // Yanıtlamayı iptal et
  const cancelReply = () => {
    setReplyingTo(null);
  };

  // İletme başlat
  const startForward = (message: Message) => {
    setForwardingMessage(message);
    setShowMessageActions(false);
    setShowForwardModal(true);
    loadForwardTargets();
  };

  // Mesaj ilet
  const handleForward = async (targetId: string, targetType: 'group' | 'user') => {
    if (!forwardingMessage) return;
    
    try {
      if (targetType === 'user') {
        // Özel mesaj olarak ilet
        await api.post('/api/private-messages', {
          receiverId: targetId,
          content: `📨 İletilen mesaj:\n\n${forwardingMessage.content}`,
          type: forwardingMessage.type || 'text',
          mediaUrl: forwardingMessage.mediaUrl,
        });
      } else {
        // Grup mesajı olarak ilet
        await subgroupApi.sendMessage(targetId, {
          content: `📨 İletilen mesaj:\n\n${forwardingMessage.content}`,
          type: forwardingMessage.type || 'text',
          mediaUrl: forwardingMessage.mediaUrl,
        });
      }
      
      Alert.alert('Başarılı', 'Mesaj iletildi');
      setShowForwardModal(false);
      setForwardingMessage(null);
    } catch (error) {
      console.error('Error forwarding message:', error);
      Alert.alert('Hata', 'Mesaj iletilemedi');
    }
  };

  // @mention için text değişikliği
  const handleTextChange = (text: string) => {
    setInputText(text);
    
    const lastAtIndex = text.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const afterAt = text.slice(lastAtIndex + 1);
      if (!afterAt.includes(' ')) {
        setMentionSearch(afterAt);
        setShowMentionList(true);
        return;
      }
    }
    setShowMentionList(false);
    setMentionSearch('');
  };

  // Üye seçildiğinde mention ekle
  const handleSelectMention = (member: {uid: string; firstName: string; lastName: string}) => {
    const lastAtIndex = inputText.lastIndexOf('@');
    const beforeAt = inputText.slice(0, lastAtIndex);
    const newText = `${beforeAt}@${member.firstName} ${member.lastName} `;
    setInputText(newText);
    setShowMentionList(false);
    setMentionSearch('');
  };

  const handleLongPressMessage = (message: Message) => {
    setSelectedMessage(message);
    setShowMessageActions(true);
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('İzin Gerekli', 'Fotoğraf seçmek için galeri izni gerekiyor.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      setUploading(true);
      const url = await uploadMedia(result.assets[0].uri, 'image');
      setUploading(false);
      if (url) await handleSend(url, 'image');
      else Alert.alert('Hata', 'Fotoğraf yüklenemedi');
    }
    setShowAttachMenu(false);
  };

  const pickVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('İzin Gerekli', 'Video seçmek için galeri izni gerekiyor.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      quality: 0.5,
      videoMaxDuration: 60,
    });

    if (!result.canceled && result.assets[0]) {
      setUploading(true);
      const url = await uploadMedia(result.assets[0].uri, 'video');
      setUploading(false);
      if (url) await handleSend(url, 'video');
      else Alert.alert('Hata', 'Video yüklenemedi');
    }
    setShowAttachMenu(false);
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const file = result.assets[0];
        setUploading(true);
        const url = await uploadMedia(file.uri, 'file', file.name);
        setUploading(false);
        if (url) await handleSend(url, 'file', file.name);
        else Alert.alert('Hata', 'Dosya yüklenemedi');
      }
    } catch (error) {
      console.error('Error picking document:', error);
    }
    setShowAttachMenu(false);
  };

  // Tepki ekle/kaldır
  const handleReaction = async (message: Message, emoji: string) => {
    if (!groupId || !user?.uid) return;
    
    try {
      await api.post(`/api/subgroups/${groupId}/messages/${message.id}/reaction`, {
        emoji,
        userId: user.uid,
        userName: userProfile?.firstName || 'Kullanıcı',
      });
      
      // Tepkileri güncelle
      const existingReaction = message.reactions?.find(
        r => r.userId === user.uid && r.emoji === emoji
      );
      
      setMessages(messages.map(m => {
        if (m.id !== message.id) return m;
        
        let newReactions = [...(m.reactions || [])];
        
        if (existingReaction) {
          // Tepkiyi kaldır
          newReactions = newReactions.filter(
            r => !(r.userId === user.uid && r.emoji === emoji)
          );
        } else {
          // Tepki ekle
          newReactions.push({
            emoji,
            userId: user.uid,
            userName: userProfile?.firstName || 'Kullanıcı',
          });
        }
        
        return { ...m, reactions: newReactions };
      }));
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
    
    setShowReactionPicker(false);
    setReactionTargetMessage(null);
  };

  // Konum paylaş
  const shareLocation = async (isLive: boolean = false, duration?: number) => {
    setLoadingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('İzin Gerekli', 'Konum paylaşmak için konum izni gerekiyor.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      // Adres al
      let address = '';
      try {
        const [addressResult] = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        if (addressResult) {
          address = [addressResult.street, addressResult.district, addressResult.city]
            .filter(Boolean)
            .join(', ');
        }
      } catch (e) {}

      // Konum mesajı gönder
      await subgroupApi.sendMessage(groupId!, {
        content: `📍 ${address || 'Konum'}`,
        type: 'location',
        location: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          address,
          isLive,
          duration,
        },
      });

      loadData();
      Alert.alert('Başarılı', 'Konum paylaşıldı');
    } catch (error) {
      console.error('Error sharing location:', error);
      Alert.alert('Hata', 'Konum paylaşılamadı');
    } finally {
      setLoadingLocation(false);
      setShowLocationPicker(false);
      setShowAttachMenu(false);
    }
  };

  // Konum mesajını haritada aç
  const openLocationInMaps = (lat: number, lng: number) => {
    const url = Platform.select({
      ios: `maps:${lat},${lng}?q=Konum`,
      android: `geo:${lat},${lng}?q=${lat},${lng}(Konum)`,
      default: `https://maps.google.com/?q=${lat},${lng}`,
    });
    Linking.openURL(url as string).catch(() => {
      Linking.openURL(`https://maps.google.com/?q=${lat},${lng}`);
    });
  };

  const formatTime = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true, locale: tr });
    } catch {
      return '';
    }
  };

  // Mesaj içeriğini @mention highlight'lı şekilde render et
  const renderMessageContent = (content: string, isMe: boolean) => {
    const mentionRegex = /@([A-Za-zÇçĞğİıÖöŞşÜü]+\s[A-Za-zÇçĞğİıÖöŞşÜü]+)/g;
    const parts = content.split(mentionRegex);
    
    if (parts.length === 1) {
      return <Text style={[styles.messageText, isMe && styles.myMessageText]}>{content}</Text>;
    }

    const elements: React.ReactNode[] = [];
    let match;
    let lastIndex = 0;
    const regex = new RegExp(mentionRegex);
    
    while ((match = regex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        elements.push(
          <Text key={`text-${lastIndex}`} style={[styles.messageText, isMe && styles.myMessageText]}>
            {content.slice(lastIndex, match.index)}
          </Text>
        );
      }
      elements.push(
        <Text key={`mention-${match.index}`} style={[styles.mentionHighlight, isMe && styles.myMentionHighlight]}>
          {match[0]}
        </Text>
      );
      lastIndex = match.index + match[0].length;
    }
    
    if (lastIndex < content.length) {
      elements.push(
        <Text key={`text-end`} style={[styles.messageText, isMe && styles.myMessageText]}>
          {content.slice(lastIndex)}
        </Text>
      );
    }

    return <Text style={[styles.messageText, isMe && styles.myMessageText]}>{elements}</Text>;
  };

  // Mesaj durumu ikonu
  const renderMessageStatus = (message: Message, isMe: boolean) => {
    if (!isMe) return null;
    
    const memberCount = subgroup?.members?.length || 0;
    const readCount = message.readBy?.length || 1;
    const deliveredCount = message.deliveredTo?.length || 0;
    
    // Herkes okudu
    if (readCount >= memberCount - 1 && memberCount > 1) {
      return <Ionicons name="checkmark-done" size={14} color="#60a5fa" />;
    }
    // İletildi
    if (deliveredCount > 0) {
      return <Ionicons name="checkmark-done" size={14} color="rgba(255,255,255,0.6)" />;
    }
    // Gönderildi
    return <Ionicons name="checkmark" size={14} color="rgba(255,255,255,0.6)" />;
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.senderId === user?.uid;

    return (
      <TouchableOpacity 
        style={[styles.messageContainer, isMe && styles.myMessageContainer]}
        onLongPress={() => handleLongPressMessage(item)}
        delayLongPress={500}
        activeOpacity={0.8}
      >
        {!isMe && (
          <TouchableOpacity 
            style={styles.avatarSmall}
            onPress={() => router.push(`/user/${item.senderId}`)}
          >
            {item.senderProfileImage ? (
              <Image source={{ uri: item.senderProfileImage }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person" size={16} color="#9ca3af" />
            )}
          </TouchableOpacity>
        )}
        <View style={[styles.messageBubble, isMe ? styles.myBubble : styles.otherBubble]}>
          {item.isPinned && (
            <View style={styles.pinnedBadge}>
              <Ionicons name="pin" size={12} color="#f59e0b" />
              <Text style={styles.pinnedText}>Sabitlendi</Text>
            </View>
          )}
          {!isMe && <Text style={styles.senderName}>{item.senderName}</Text>}
          
          {/* Yanıtlanan mesaj */}
          {item.replyTo && (
            <View style={[styles.replyPreview, isMe && styles.myReplyPreview]}>
              <View style={styles.replyBar} />
              <View style={styles.replyContent}>
                <Text style={styles.replyName}>{item.replyTo.senderName}</Text>
                <Text style={styles.replyText} numberOfLines={2}>{item.replyTo.content}</Text>
              </View>
            </View>
          )}
          
          {item.type === 'image' && item.mediaUrl && (
            <Image source={{ uri: item.mediaUrl }} style={styles.messageImage} resizeMode="cover" />
          )}
          
          {item.type === 'video' && item.mediaUrl && (
            <View style={styles.videoContainer}>
              <Video
                source={{ uri: item.mediaUrl }}
                style={styles.messageVideo}
                useNativeControls
                resizeMode={ResizeMode.CONTAIN}
              />
            </View>
          )}
          
          {item.type === 'file' && item.mediaUrl && (
            <TouchableOpacity style={styles.fileAttachment}>
              <Ionicons name="document" size={24} color="#6366f1" />
              <Text style={styles.fileName} numberOfLines={1}>{item.fileName || 'Dosya'}</Text>
            </TouchableOpacity>
          )}

          {/* Konum mesajı */}
          {item.type === 'location' && item.location && (
            <TouchableOpacity 
              style={styles.locationMessage}
              onPress={() => openLocationInMaps(item.location!.latitude, item.location!.longitude)}
            >
              <View style={styles.locationIcon}>
                <Ionicons 
                  name={item.location.isLive ? 'navigate' : 'location'} 
                  size={24} 
                  color={item.location.isLive ? '#10b981' : '#6366f1'} 
                />
                {item.location.isLive && (
                  <View style={styles.liveBadge}>
                    <Text style={styles.liveText}>CANLI</Text>
                  </View>
                )}
              </View>
              <View style={styles.locationInfo}>
                <Text style={styles.locationTitle}>
                  {item.location.isLive ? 'Canlı Konum' : 'Konum'}
                </Text>
                {item.location.address && (
                  <Text style={styles.locationAddress} numberOfLines={2}>
                    {item.location.address}
                  </Text>
                )}
                <Text style={styles.locationCoords}>
                  {item.location.latitude.toFixed(5)}, {item.location.longitude.toFixed(5)}
                </Text>
              </View>
              <Ionicons name="open-outline" size={18} color="#6b7280" />
            </TouchableOpacity>
          )}
          
          {item.content && item.type !== 'location' ? (
            renderMessageContent(item.content, isMe)
          ) : null}

          {/* Tepkiler (Reactions) */}
          {item.reactions && item.reactions.length > 0 && (
            <View style={styles.reactionsContainer}>
              {Object.entries(
                item.reactions.reduce((acc: {[key: string]: number}, r) => {
                  acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                  return acc;
                }, {})
              ).map(([emoji, count]) => (
                <TouchableOpacity 
                  key={emoji} 
                  style={styles.reactionBubble}
                  onPress={() => handleReaction(item, emoji)}
                >
                  <Text style={styles.reactionEmoji}>{emoji}</Text>
                  {(count as number) > 1 && (
                    <Text style={styles.reactionCount}>{count}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
          
          <View style={styles.messageFooter}>
            <Text style={[styles.messageTime, isMe && styles.myMessageTime]}>
              {formatTime(item.timestamp)}
            </Text>
            {item.edited && (
              <Text style={[styles.editedLabel, isMe && styles.myEditedLabel]}> (düzenlendi)</Text>
            )}
            {renderMessageStatus(item, isMe)}
          </View>
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
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Message Actions Modal */}
      <Modal
        visible={showMessageActions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMessageActions(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1}
          onPress={() => setShowMessageActions(false)}
        >
          <View style={styles.actionsModal}>
            <Text style={styles.actionsTitle}>Mesaj İşlemleri</Text>
            
            {/* Hızlı Tepkiler */}
            <View style={styles.quickReactionsRow}>
              {REACTION_EMOJIS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={styles.quickReactionButton}
                  onPress={() => selectedMessage && handleReaction(selectedMessage, emoji)}
                >
                  <Text style={styles.quickReactionEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
            
            {/* Yanıtla */}
            <TouchableOpacity 
              style={styles.actionItem}
              onPress={() => selectedMessage && startReply(selectedMessage)}
            >
              <Ionicons name="arrow-undo" size={22} color="#10b981" />
              <Text style={styles.actionText}>Yanıtla</Text>
            </TouchableOpacity>
            
            {/* İlet */}
            <TouchableOpacity 
              style={styles.actionItem}
              onPress={() => selectedMessage && startForward(selectedMessage)}
            >
              <Ionicons name="arrow-redo" size={22} color="#8b5cf6" />
              <Text style={styles.actionText}>İlet</Text>
            </TouchableOpacity>
            
            {/* Düzenle (sadece kendi mesajları ve text tipinde) */}
            {selectedMessage?.senderId === user?.uid && selectedMessage?.type === 'text' && (
              <TouchableOpacity 
                style={styles.actionItem}
                onPress={() => selectedMessage && startEditMessage(selectedMessage)}
              >
                <Ionicons name="pencil" size={22} color="#6366f1" />
                <Text style={styles.actionText}>Düzenle</Text>
              </TouchableOpacity>
            )}
            
            {/* Sabitle (sadece admin) */}
            {isGroupAdmin && (
              <TouchableOpacity 
                style={styles.actionItem}
                onPress={() => selectedMessage && handlePinMessage(selectedMessage)}
              >
                <Ionicons name="pin" size={22} color="#f59e0b" />
                <Text style={styles.actionText}>{selectedMessage?.isPinned ? 'Sabitlemeyi Kaldır' : 'Sabitle'}</Text>
              </TouchableOpacity>
            )}
            
            {/* Sil (kendi mesajları veya admin) */}
            {(selectedMessage?.senderId === user?.uid || isGroupAdmin) && (
              <TouchableOpacity 
                style={[styles.actionItem, styles.deleteAction]}
                onPress={() => selectedMessage && handleDeleteMessage(selectedMessage.id)}
              >
                <Ionicons name="trash" size={22} color="#ef4444" />
                <Text style={[styles.actionText, styles.deleteText]}>Sil</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              style={styles.actionItem}
              onPress={() => setShowMessageActions(false)}
            >
              <Ionicons name="close" size={22} color="#6b7280" />
              <Text style={styles.actionText}>İptal</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Forward Modal */}
      <Modal
        visible={showForwardModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowForwardModal(false)}
      >
        <View style={styles.forwardModalOverlay}>
          <View style={styles.forwardModalContent}>
            <View style={styles.forwardModalHeader}>
              <Text style={styles.forwardModalTitle}>Mesajı İlet</Text>
              <TouchableOpacity onPress={() => setShowForwardModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            {/* İletilecek mesaj önizleme */}
            {forwardingMessage && (
              <View style={styles.forwardPreview}>
                <Ionicons name="arrow-redo" size={16} color="#8b5cf6" />
                <Text style={styles.forwardPreviewText} numberOfLines={2}>
                  {forwardingMessage.content}
                </Text>
              </View>
            )}
            
            {loadingForwardTargets ? (
              <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 20 }} />
            ) : (
              <ScrollView style={styles.forwardTargetList}>
                {forwardTargets.map((target) => (
                  <TouchableOpacity
                    key={target.id}
                    style={styles.forwardTargetItem}
                    onPress={() => handleForward(target.id, target.type)}
                  >
                    <View style={styles.forwardTargetAvatar}>
                      <Ionicons 
                        name={target.type === 'group' ? 'people' : 'person'} 
                        size={20} 
                        color="#6366f1" 
                      />
                    </View>
                    <Text style={styles.forwardTargetName}>{target.name}</Text>
                    <Ionicons name="send" size={18} color="#6b7280" />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.groupIcon}>
          <Ionicons name="chatbubbles" size={20} color="#6366f1" />
        </View>
        <TouchableOpacity 
          style={styles.headerInfo}
          onPress={() => router.push(`/chat/group/menu/${groupId}`)}
        >
          <Text style={styles.headerName}>{subgroup?.name}</Text>
          <Text style={styles.headerSubtitle}>
            {subgroup?.memberCount} üye {subgroup?.communityName && `• ${subgroup.communityName}`}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.menuButton}
          onPress={() => router.push(`/chat/group/menu/${groupId}`)}
        >
          <Ionicons name="ellipsis-vertical" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
              <Text style={styles.emptySubtext}>Grupta ilk mesajı siz gönderin!</Text>
            </View>
          }
        />

        {/* Emoji Picker */}
        {showEmojiPicker && (
          <View style={styles.emojiPicker}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.emojiGrid}>
                {EMOJI_LIST.map((emoji, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.emojiButton}
                    onPress={() => setInputText(prev => prev + emoji)}
                  >
                    <Text style={styles.emoji}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Attach Menu */}
        {showAttachMenu && (
          <View style={styles.attachMenu}>
            <TouchableOpacity style={styles.attachOption} onPress={pickImage}>
              <View style={[styles.attachIcon, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                <Ionicons name="image" size={24} color="#10b981" />
              </View>
              <Text style={styles.attachText}>Fotoğraf</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachOption} onPress={pickVideo}>
              <View style={[styles.attachIcon, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                <Ionicons name="videocam" size={24} color="#ef4444" />
              </View>
              <Text style={styles.attachText}>Video</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachOption} onPress={pickDocument}>
              <View style={[styles.attachIcon, { backgroundColor: 'rgba(99, 102, 241, 0.1)' }]}>
                <Ionicons name="document" size={24} color="#6366f1" />
              </View>
              <Text style={styles.attachText}>Dosya</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Uploading indicator */}
        {uploading && (
          <View style={styles.uploadingBar}>
            <ActivityIndicator size="small" color="#6366f1" />
            <Text style={styles.uploadingText}>Yükleniyor...</Text>
          </View>
        )}

        {/* Editing indicator */}
        {editingMessage && (
          <View style={styles.editingBar}>
            <View style={styles.editingInfo}>
              <Ionicons name="pencil" size={18} color="#6366f1" />
              <Text style={styles.editingText}>Mesaj düzenleniyor</Text>
            </View>
            <TouchableOpacity onPress={cancelEdit}>
              <Ionicons name="close" size={22} color="#6b7280" />
            </TouchableOpacity>
          </View>
        )}

        {/* Reply indicator */}
        {replyingTo && (
          <View style={styles.replyBarContainer}>
            <View style={styles.replyBarContent}>
              <Ionicons name="arrow-undo" size={18} color="#10b981" />
              <View style={styles.replyBarInfo}>
                <Text style={styles.replyBarName}>{replyingTo.senderName}</Text>
                <Text style={styles.replyBarText} numberOfLines={1}>{replyingTo.content}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={cancelReply}>
              <Ionicons name="close" size={22} color="#6b7280" />
            </TouchableOpacity>
          </View>
        )}

        {/* Smart Replies */}
        {smartReplies.length > 0 && !editingMessage && !inputText && (
          <View style={styles.smartRepliesContainer}>
            <View style={styles.smartRepliesHeader}>
              <Ionicons name="sparkles" size={14} color="#6366f1" />
              <Text style={styles.smartRepliesTitle}>Akıllı Yanıtlar</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.smartRepliesScroll}>
              {smartReplies.map((reply, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.smartReplyChip}
                  onPress={() => handleSelectSmartReply(reply)}
                >
                  <Text style={styles.smartReplyText}>{reply}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Input */}
        <View style={styles.inputContainer}>
          <TouchableOpacity 
            style={styles.attachButton} 
            onPress={() => { setShowAttachMenu(!showAttachMenu); setShowEmojiPicker(false); }}
          >
            <Ionicons name={showAttachMenu ? "close" : "attach"} size={26} color="#6b7280" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.emojiButton2} 
            onPress={() => { setShowEmojiPicker(!showEmojiPicker); setShowAttachMenu(false); }}
          >
            <Ionicons name={showEmojiPicker ? "close" : "happy-outline"} size={26} color="#6b7280" />
          </TouchableOpacity>
          <View style={styles.inputWrapper}>
            {/* @mention listesi */}
            {showMentionList && filteredMembers.length > 0 && (
              <View style={styles.mentionList}>
                <ScrollView keyboardShouldPersistTaps="handled" style={styles.mentionScroll}>
                  {filteredMembers.slice(0, 5).map((member) => (
                    <TouchableOpacity
                      key={member.uid}
                      style={styles.mentionItem}
                      onPress={() => handleSelectMention(member)}
                    >
                      <View style={styles.mentionAvatar}>
                        <Text style={styles.mentionAvatarText}>
                          {member.firstName?.[0]}{member.lastName?.[0]}
                        </Text>
                      </View>
                      <Text style={styles.mentionName}>{member.firstName} {member.lastName}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
            <TextInput
              style={[styles.input, editingMessage && styles.inputEditing, replyingTo && styles.inputReplying]}
              placeholder={editingMessage ? "Mesajı düzenle..." : replyingTo ? "Yanıtınızı yazın..." : "Mesaj yaz... (@mention için @ kullanın)"}
              placeholderTextColor="#6b7280"
              value={inputText}
              onChangeText={handleTextChange}
              multiline
              maxLength={1000}
            />
          </View>
          <TouchableOpacity
            style={[styles.sendButton, (!inputText.trim() || sending) && styles.sendButtonDisabled, editingMessage && styles.editSendButton]}
            onPress={() => handleSend()}
            disabled={!inputText.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name={editingMessage ? "checkmark" : "send"} size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  loadingContainer: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1f2937' },
  backButton: { marginRight: 12 },
  menuButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  groupIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(99, 102, 241, 0.1)', justifyContent: 'center', alignItems: 'center' },
  avatarSmall: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1f2937', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', marginRight: 8 },
  avatarImage: { width: '100%', height: '100%' },
  headerInfo: { flex: 1, marginLeft: 12 },
  headerName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  headerSubtitle: { color: '#6b7280', fontSize: 13, marginTop: 2 },
  keyboardView: { flex: 1 },
  messagesList: { paddingHorizontal: 16, paddingVertical: 16, flexGrow: 1 },
  messageContainer: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end' },
  myMessageContainer: { flexDirection: 'row-reverse' },
  messageBubble: { maxWidth: '75%', padding: 12, borderRadius: 16 },
  myBubble: { backgroundColor: '#6366f1', borderBottomRightRadius: 4 },
  otherBubble: { backgroundColor: '#1f2937', borderBottomLeftRadius: 4 },
  senderName: { color: '#6366f1', fontSize: 13, fontWeight: '600', marginBottom: 4 },
  pinnedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(245, 158, 11, 0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginBottom: 6, gap: 4, alignSelf: 'flex-start' },
  pinnedText: { color: '#f59e0b', fontSize: 11, fontWeight: '600' },
  messageText: { color: '#e5e7eb', fontSize: 15, lineHeight: 20 },
  myMessageText: { color: '#fff' },
  mentionHighlight: { color: '#60a5fa', fontWeight: '600', backgroundColor: 'rgba(96, 165, 250, 0.15)', borderRadius: 4, paddingHorizontal: 2 },
  myMentionHighlight: { color: '#93c5fd', backgroundColor: 'rgba(147, 197, 253, 0.2)' },
  messageFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 },
  messageTime: { color: '#9ca3af', fontSize: 11 },
  myMessageTime: { color: 'rgba(255, 255, 255, 0.7)' },
  editedLabel: { color: '#6b7280', fontSize: 10, fontStyle: 'italic' },
  myEditedLabel: { color: 'rgba(255, 255, 255, 0.5)' },
  messageImage: { width: 200, height: 200, borderRadius: 12, marginBottom: 8 },
  videoContainer: { width: 200, height: 150, borderRadius: 12, overflow: 'hidden', marginBottom: 8 },
  messageVideo: { width: '100%', height: '100%' },
  fileAttachment: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(99, 102, 241, 0.1)', padding: 12, borderRadius: 12, marginBottom: 8, gap: 8 },
  fileName: { color: '#e5e7eb', fontSize: 14, flex: 1 },
  // Reply Preview styles
  replyPreview: { backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: 8, marginBottom: 8, flexDirection: 'row' },
  myReplyPreview: { backgroundColor: 'rgba(255,255,255,0.1)' },
  replyBar: { width: 3, backgroundColor: '#10b981', borderRadius: 2, marginRight: 8 },
  replyContent: { flex: 1 },
  replyName: { color: '#10b981', fontSize: 12, fontWeight: '600', marginBottom: 2 },
  replyText: { color: '#9ca3af', fontSize: 13 },
  // Reply Bar (Input area)
  replyBarContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#111827', padding: 12, borderTopWidth: 1, borderTopColor: '#1f2937' },
  replyBarContent: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 },
  replyBarInfo: { flex: 1 },
  replyBarName: { color: '#10b981', fontSize: 13, fontWeight: '600' },
  replyBarText: { color: '#9ca3af', fontSize: 13 },
  inputReplying: { borderColor: '#10b981', borderWidth: 1 },
  // Smart Replies styles
  smartRepliesContainer: { backgroundColor: '#111827', paddingVertical: 10, paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: '#1f2937' },
  smartRepliesHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  smartRepliesTitle: { color: '#6366f1', fontSize: 12, fontWeight: '600' },
  smartRepliesScroll: { flexDirection: 'row' },
  smartReplyChip: { backgroundColor: 'rgba(99, 102, 241, 0.1)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, marginRight: 8, borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.3)' },
  smartReplyText: { color: '#a5b4fc', fontSize: 14 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 64 },
  emptyText: { color: '#9ca3af', fontSize: 16, marginTop: 16 },
  emptySubtext: { color: '#6b7280', fontSize: 13, marginTop: 8 },
  emojiPicker: { backgroundColor: '#111827', padding: 12, borderTopWidth: 1, borderTopColor: '#1f2937' },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  emojiButton: { padding: 8 },
  emojiButton2: { padding: 8 },
  emoji: { fontSize: 24 },
  attachMenu: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#111827', padding: 16, borderTopWidth: 1, borderTopColor: '#1f2937' },
  attachOption: { alignItems: 'center', gap: 8 },
  attachIcon: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  attachText: { color: '#9ca3af', fontSize: 12 },
  uploadingBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#111827', padding: 10, gap: 8 },
  uploadingText: { color: '#6366f1', fontSize: 14 },
  editingBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#111827', padding: 12, borderTopWidth: 1, borderTopColor: '#1f2937' },
  editingInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editingText: { color: '#6366f1', fontSize: 14 },
  inputContainer: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 8, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#1f2937', gap: 4 },
  attachButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  inputWrapper: { flex: 1, position: 'relative' },
  input: { backgroundColor: '#1f2937', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: '#fff', fontSize: 15, maxHeight: 100 },
  inputEditing: { borderWidth: 1, borderColor: '#6366f1' },
  mentionList: { position: 'absolute', bottom: '100%', left: 0, right: 0, backgroundColor: '#1f2937', borderRadius: 12, marginBottom: 4, maxHeight: 200, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
  mentionScroll: { maxHeight: 200 },
  mentionItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#374151' },
  mentionAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  mentionAvatarText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  mentionName: { color: '#fff', fontSize: 14 },
  sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center' },
  sendButtonDisabled: { opacity: 0.5 },
  editSendButton: { backgroundColor: '#10b981' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  actionsModal: { backgroundColor: '#1f2937', borderRadius: 20, padding: 20, width: '80%', maxWidth: 320 },
  actionsTitle: { color: '#fff', fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 16 },
  actionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 14, borderRadius: 12 },
  actionText: { color: '#e5e7eb', fontSize: 16 },
  deleteAction: { borderTopWidth: 1, borderTopColor: '#374151', marginTop: 8, paddingTop: 16 },
  deleteText: { color: '#ef4444' },
  // Forward Modal
  forwardModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  forwardModalContent: { backgroundColor: '#1f2937', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%', paddingBottom: 40 },
  forwardModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#374151' },
  forwardModalTitle: { color: '#fff', fontSize: 18, fontWeight: '600' },
  forwardPreview: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111827', margin: 16, padding: 12, borderRadius: 12, gap: 8 },
  forwardPreviewText: { color: '#9ca3af', fontSize: 14, flex: 1 },
  forwardTargetList: { paddingHorizontal: 16 },
  forwardTargetItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#374151' },
  forwardTargetAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(99, 102, 241, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  forwardTargetName: { flex: 1, color: '#fff', fontSize: 16 },
});
