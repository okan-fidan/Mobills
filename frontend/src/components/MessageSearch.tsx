/**
 * Mesaj Arama Bileşeni
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';

interface Message {
  id: string;
  content: string;
  senderName: string;
  timestamp: string;
}

interface MessageSearchProps {
  messages: Message[];
  onSelectMessage: (messageId: string) => void;
  onClose: () => void;
}

export default function MessageSearch({ messages, onSelectMessage, onClose }: MessageSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Message[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (query.trim().length >= 2) {
      const filtered = messages.filter((m) =>
        m.content.toLowerCase().includes(query.toLowerCase())
      );
      setResults(filtered);
      setCurrentIndex(0);
    } else {
      setResults([]);
    }
  }, [query, messages]);

  const handleNavigate = (direction: 'up' | 'down') => {
    if (results.length === 0) return;
    
    let newIndex = currentIndex;
    if (direction === 'up') {
      newIndex = currentIndex > 0 ? currentIndex - 1 : results.length - 1;
    } else {
      newIndex = currentIndex < results.length - 1 ? currentIndex + 1 : 0;
    }
    
    setCurrentIndex(newIndex);
    onSelectMessage(results[newIndex].id);
  };

  const handleSelectResult = (message: Message, index: number) => {
    setCurrentIndex(index);
    onSelectMessage(message.id);
    Keyboard.dismiss();
  };

  const highlightText = (text: string, highlight: string) => {
    if (!highlight.trim()) return <Text>{text}</Text>;
    
    const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
    return (
      <Text>
        {parts.map((part, i) =>
          part.toLowerCase() === highlight.toLowerCase() ? (
            <Text key={i} style={styles.highlight}>{part}</Text>
          ) : (
            <Text key={i}>{part}</Text>
          )
        )}
      </Text>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchBar}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        
        <View style={styles.inputContainer}>
          <Ionicons name="search" size={20} color="#6b7280" />
          <TextInput
            style={styles.input}
            placeholder="Mesajlarda ara..."
            placeholderTextColor="#6b7280"
            value={query}
            onChangeText={setQuery}
            autoFocus
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={20} color="#6b7280" />
            </TouchableOpacity>
          )}
        </View>

        {results.length > 0 && (
          <View style={styles.navigation}>
            <Text style={styles.resultCount}>
              {currentIndex + 1}/{results.length}
            </Text>
            <TouchableOpacity onPress={() => handleNavigate('up')} style={styles.navButton}>
              <Ionicons name="chevron-up" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleNavigate('down')} style={styles.navButton}>
              <Ionicons name="chevron-down" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Results List */}
      {results.length > 0 && (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          style={styles.resultsList}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item, index }) => (
            <TouchableOpacity
              style={[
                styles.resultItem,
                index === currentIndex && styles.resultItemActive,
              ]}
              onPress={() => handleSelectResult(item, index)}
            >
              <View style={styles.resultContent}>
                <Text style={styles.senderName}>{item.senderName}</Text>
                <Text style={styles.messageText} numberOfLines={2}>
                  {highlightText(item.content, query)}
                </Text>
              </View>
              <Text style={styles.timestamp}>
                {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true, locale: tr })}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}

      {query.length >= 2 && results.length === 0 && (
        <View style={styles.noResults}>
          <Ionicons name="search-outline" size={48} color="#374151" />
          <Text style={styles.noResultsText}>Sonuç bulunamadı</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0a0a0a',
    zIndex: 100,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
    gap: 8,
  },
  closeButton: {
    padding: 4,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    borderRadius: 12,
    paddingHorizontal: 12,
    gap: 8,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    paddingVertical: 10,
  },
  navigation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  resultCount: {
    color: '#9ca3af',
    fontSize: 13,
    marginRight: 4,
  },
  navButton: {
    padding: 4,
  },
  resultsList: {
    flex: 1,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  resultItemActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  resultContent: {
    flex: 1,
  },
  senderName: {
    color: '#6366f1',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  messageText: {
    color: '#e5e7eb',
    fontSize: 14,
    lineHeight: 20,
  },
  highlight: {
    backgroundColor: 'rgba(99, 102, 241, 0.3)',
    color: '#fff',
    fontWeight: '600',
  },
  timestamp: {
    color: '#6b7280',
    fontSize: 12,
    marginLeft: 12,
  },
  noResults: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  noResultsText: {
    color: '#6b7280',
    fontSize: 16,
  },
});
