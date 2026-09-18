import * as React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  User as FirebaseUser,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebase';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeDoc: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = undefined;
      }

      if (firebaseUser) {
        // Listen to User document changes in real-time
        unsubscribeDoc = onSnapshot(doc(db, 'users', firebaseUser.uid), async (userDoc) => {
          if (userDoc.exists()) {
            const userData = userDoc.data() as any;
            
            // Force update for admin email to ensure they have access and correct structure
            if (firebaseUser.email === 'ingbiomedico@ucihonda.com.co') {
              const hasCorrectPermissions = userData.permissions && typeof userData.permissions === 'object' && !Array.isArray(userData.permissions);
              
              if (userData.role !== 'ADMIN' || userData.status !== 'active' || !hasCorrectPermissions) {
                const updatedAdmin: User = {
                  ...userData,
                  uid: firebaseUser.uid,
                  role: 'ADMIN',
                  status: 'active',
                  gender: userData.gender || 'male',
                  permissions: {
                    all: { view: true, create: true, edit: true, delete: true },
                    inventory: { view: true, create: true, edit: true, delete: true },
                    transfers: { view: true, create: true, edit: true, delete: true },
                    reports: { view: true, create: true, edit: true, delete: true },
                    compliance: { view: true, create: true, edit: true, delete: true },
                    alerts: { view: true, create: true, edit: true, delete: true },
                    providers: { view: true, create: true, edit: true, delete: true },
                    schedule: { view: true, create: true, edit: true, delete: true },
                    forms: { view: true, create: true, edit: true, delete: true },
                    users: { view: true, create: true, edit: true, delete: true }
                  }
                };
                await setDoc(doc(db, 'users', firebaseUser.uid), updatedAdmin);
                setUser(updatedAdmin);
              } else {
                setUser(userData);
              }
            } else {
              // Normalize existing roles if they are lowercase
              let updatedData = { ...userData };
              if (updatedData.role === 'admin' as any) updatedData.role = 'ADMIN';
              if (updatedData.role === 'user' as any) updatedData.role = 'USER';
              // Default gender if missing
              if (!updatedData.gender) updatedData.gender = 'male';
              setUser(updatedData);
            }
          } else {
            // Check if it's the admin email
            const isAdmin = firebaseUser.email === 'ingbiomedico@ucihonda.com.co';
            
            const newUser: User = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              role: isAdmin ? 'ADMIN' : 'USER',
              status: isAdmin ? 'active' : 'pending',
              gender: 'male',
              permissions: isAdmin ? {
                 all: { view: true, create: true, edit: true, delete: true },
                 inventory: { view: true, create: true, edit: true, delete: true },
                 transfers: { view: true, create: true, edit: true, delete: true },
                 reports: { view: true, create: true, edit: true, delete: true },
                 compliance: { view: true, create: true, edit: true, delete: true },
                 alerts: { view: true, create: true, edit: true, delete: true },
                 providers: { view: true, create: true, edit: true, delete: true },
                 schedule: { view: true, create: true, edit: true, delete: true },
                 forms: { view: true, create: true, edit: true, delete: true },
                 users: { view: true, create: true, edit: true, delete: true }
              } : {}
            };
            await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
            setUser(newUser);
          }
          setLoading(false);
        }, (error) => {
          console.warn("User doc onSnapshot error:", error);
          setLoading(false);
        });
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
    };
  }, []);

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginWithGoogle, logout }}>
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
