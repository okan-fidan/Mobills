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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Video, ResizeMode } from 'expo-av';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../../src/config/firebase';
import { subgroupApi } from '../../../src/services/api';
import { useAuth } from '../../../src/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';

// Emoji listesi
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
  type?: 'text' | 'image' | 'video' | 'file';
  mediaUrl?: string;
  fileName?: string;
  edited?: boolean;
  isPinned?: boolean;
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
  // Yeni özellikler için state'ler
  const [polls, setPolls] = useState<Poll[]>([]);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [showPollModal, setShowPollModal] = useState(false);
  const [showPinnedModal, setShowPinnedModal] = useState(false);
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [isMultipleChoice, setIsMultipleChoice] = useState(false);
  // @mention için state'ler
  const [showMentionList, setShowMentionList] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [groupMembers, setGroupMembers] = useState<{uid: string; firstName: string; lastName: string}[]>([]);
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
    } catch (error) {
      console.error('Error loading group chat:', error);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [loadData]);

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

      const response = await subgroupApi.sendMessage(groupId, messageData);
      setMessages([...messages, response.data]);
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
      // Mesajı pinned olarak işaretle
      setMessages(messages.map(m => 
        m.id === message.id ? { ...m, isPinned: true } : m
      ));
    } catch (error: any) {
      console.error('Error pinning message:', error);
      Alert.alert('Hata', error?.response?.data?.detail || 'Mesaj sabitlenemedi');
    }
    setShowMessageActions(false);
  };

  // @mention için text değişikliği
  const handleTextChange = (text: string) => {
    setInputText(text);
    
    // @ karakterinden sonra arama yap
    const lastAtIndex = text.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const afterAt = text.slice(lastAtIndex + 1);
      // Boşluk yoksa mention araması aktif
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
    if (message.senderId === user?.uid || isGroupAdmin) {
      setSelectedMessage(message);
      setShowMessageActions(true);
    }
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

  const formatTime = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true, locale: tr });
    } catch {
      return '';
    }
  };

  // Mesaj içeriğini @mention highlight'lı şekilde render et
  const renderMessageContent = (content: string, isMe: boolean) => {
    // @mention pattern: @Ad Soyad formatında
    const mentionRegex = /@([A-Za-zÇçĞğİıÖöŞşÜü]+\s[A-Za-zÇçĞğİıÖöŞşÜü]+)/g;
    const parts = content.split(mentionRegex);
    
    if (parts.length === 1) {
      // Mention yok, normal render
      return <Text style={[styles.messageText, isMe && styles.myMessageText]}>{content}</Text>;
    }

    // Mention'ları highlight et
    const elements: React.ReactNode[] = [];
    let match;
    let lastIndex = 0;
    const regex = new RegExp(mentionRegex);
    
    while ((match = regex.exec(content)) !== null) {
      // Mention öncesi text
      if (match.index > lastIndex) {
        elements.push(
          <Text key={`text-${lastIndex}`} style={[styles.messageText, isMe && styles.myMessageText]}>
            {content.slice(lastIndex, match.index)}
          </Text>
        );
      }
      // Mention (highlight)
      elements.push(
        <Text key={`mention-${match.index}`} style={[styles.mentionHighlight, isMe && styles.myMentionHighlight]}>
          {match[0]}
        </Text>
      );
      lastIndex = match.index + match[0].length;
    }
    
    // Kalan text
    if (lastIndex < content.length) {
      elements.push(
        <Text key={`text-end`} style={[styles.messageText, isMe && styles.myMessageText]}>
          {content.slice(lastIndex)}
        </Text>
      );
    }

    return <Text style={[styles.messageText, isMe && styles.myMessageText]}>{elements}</Text>;
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
          
          {item.content ? (
            renderMessageContent(item.content, isMe)
          ) : null}
          
          <View style={styles.messageFooter}>
            <Text style={[styles.messageTime, isMe && styles.myMessageTime]}>
              {formatTime(item.timestamp)}
            </Text>
            {item.edited && (
              <Text style={[styles.editedLabel, isMe && styles.myEditedLabel]}> (düzenlendi)</Text>
            )}
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
            {selectedMessage?.type === 'text' && (
              <TouchableOpacity 
                style={styles.actionItem}
                onPress={() => selectedMessage && startEditMessage(selectedMessage)}
              >
                <Ionicons name="pencil" size={22} color="#6366f1" />
                <Text style={styles.actionText}>Düzenle</Text>
              </TouchableOpacity>
            )}
            {isGroupAdmin && (
              <TouchableOpacity 
                style={styles.actionItem}
                onPress={() => selectedMessage && handlePinMessage(selectedMessage)}
              >
                <Ionicons name="pin" size={22} color="#f59e0b" />
                <Text style={styles.actionText}>Sabitle</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              style={[styles.actionItem, styles.deleteAction]}
              onPress={() => selectedMessage && handleDeleteMessage(selectedMessage.id)}
            >
              <Ionicons name="trash" size={22} color="#ef4444" />
              <Text style={[styles.actionText, styles.deleteText]}>Sil</Text>
            </TouchableOpacity>
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
              style={[styles.input, editingMessage && styles.inputEditing]}
              placeholder={editingMessage ? "Mesajı düzenle..." : "Mesaj yaz... (@mention için @ kullanın)"}
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
  messageFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  messageTime: { color: '#9ca3af', fontSize: 11 },
  myMessageTime: { color: 'rgba(255, 255, 255, 0.7)' },
  editedLabel: { color: '#6b7280', fontSize: 10, fontStyle: 'italic' },
  myEditedLabel: { color: 'rgba(255, 255, 255, 0.5)' },
  messageImage: { width: 200, height: 200, borderRadius: 12, marginBottom: 8 },
  videoContainer: { width: 200, height: 150, borderRadius: 12, overflow: 'hidden', marginBottom: 8 },
  messageVideo: { width: '100%', height: '100%' },
  fileAttachment: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(99, 102, 241, 0.1)', padding: 12, borderRadius: 12, marginBottom: 8, gap: 8 },
  fileName: { color: '#e5e7eb', fontSize: 14, flex: 1 },
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
});
