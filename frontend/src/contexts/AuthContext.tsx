import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Platform } from 'react-native';
import { auth } from '../config/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import api, { userApi } from '../services/api';
import { 
  registerForPushNotificationsAsync, 
  savePushToken,
  addNotificationReceivedListener,
  addNotificationResponseReceivedListener
} from '../services/notifications';

interface UserProfile {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  city: string;
  occupation?: string;
  profileImageUrl?: string;
  isAdmin: boolean;
  communities: string[];
  needsRegistration?: boolean;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  registerProfile: (data: any) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const response = await userApi.getProfile();
          setUserProfile(response.data);
          
          // Push notification kaydı (sadece mobil cihazlarda)
          if (Platform.OS !== 'web') {
            const pushToken = await registerForPushNotificationsAsync();
            if (pushToken) {
              await savePushToken(pushToken);
            }
          }
        } catch (error) {
          console.error('Error fetching profile:', error);
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    // Notification listener'ları (sadece mobil cihazlarda)
    let notificationListener: any;
    let responseListener: any;
    
    if (Platform.OS !== 'web') {
      notificationListener = addNotificationReceivedListener(notification => {
        console.log('Bildirim alındı:', notification);
      });

      responseListener = addNotificationResponseReceivedListener(response => {
        console.log('Bildirime tıklandı:', response);
        // Burada bildirime tıklandığında yapılacak işlemler
        // Örn: ilgili sohbete yönlendirme
      });
    }

    return () => {
      unsubscribe();
      if (notificationListener) notificationListener.remove();
      if (responseListener) responseListener.remove();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUp = async (email: string, password: string) => {
    await createUserWithEmailAndPassword(auth, email, password);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setUserProfile(null);
  };

  const registerProfile = async (data: any) => {
    const response = await api.post('/api/user/register', data);
    setUserProfile(response.data);
  };

  const refreshProfile = async () => {
    if (user) {
      const response = await api.get('/api/user/profile');
      setUserProfile(response.data);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      userProfile,
      loading,
      signIn,
      signUp,
      signOut,
      registerProfile,
      refreshProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
