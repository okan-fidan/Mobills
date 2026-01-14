import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { AuthProvider } from '../src/contexts/AuthContext';
import { ThemeProvider, useTheme } from '../src/contexts/ThemeContext';
import { ChatSettingsProvider } from '../src/contexts/ChatSettingsContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import RatingPrompt from '../src/components/RatingPrompt';
import { useAppRating } from '../src/hooks/useAppRating';

const queryClient = new QueryClient();

function AppContent() {
  const { isDark, colors } = useTheme();
  const {
    showPrompt,
    checkAndShowRating,
    handleRate,
    handleLater,
    handleDismiss,
  } = useAppRating();

  useEffect(() => {
    // Uygulama açıldığında rating kontrolü yap
    checkAndShowRating();
  }, []);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
        }}
      />
      <RatingPrompt
        visible={showPrompt}
        onRate={handleRate}
        onLater={handleLater}
        onDismiss={handleDismiss}
      />
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <ChatSettingsProvider>
              <AppContent />
            </ChatSettingsProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
