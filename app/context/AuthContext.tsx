"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  User,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { UserProfile, SchoolProfile, SubscriptionPlan } from "../lib/types";

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  school: SchoolProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [school, setSchool] = useState<SchoolProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const docRef = doc(db, "users", firebaseUser.uid);
          const docSnap = await getDoc(docRef);

          let userProfile: UserProfile;

          if (!docSnap.exists()) {
            // Auto-create Firestore profile on first login
            const defaultProfile = {
              email: firebaseUser.email || "",
              name: "TEST",
              schoolId: null,
              extraAvatarAccess: [],
              createdAt: serverTimestamp(),
            };
            await setDoc(docRef, defaultProfile);
            userProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || "",
              name: "TEST",
              schoolId: null,
              extraAvatarAccess: [],
              locale: null,
              createdAt: new Date(),
            };
          } else {
            const data = docSnap.data();
            userProfile = {
              uid: firebaseUser.uid,
              email: data.email,
              name: data.name,
              schoolId: data.schoolId ?? null,
              extraAvatarAccess: data.extraAvatarAccess || [],
              locale: data.locale ?? null,
              createdAt: data.createdAt?.toDate() || new Date(),
            };
          }

          setProfile(userProfile);

          // Load school if user belongs to one
          if (userProfile.schoolId) {
            const schoolRef = doc(db, "schools", userProfile.schoolId);
            const schoolSnap = await getDoc(schoolRef);
            if (schoolSnap.exists()) {
              const sData = schoolSnap.data();
              setSchool({
                id: schoolSnap.id,
                name: sData.name,
                subscriptionPlan: (sData.subscriptionPlan || "free") as SubscriptionPlan,
                customAgentAccess: sData.customAgentAccess || [],
              });
            } else {
              setSchool(null);
            }
          } else {
            setSchool(null);
          }
        } catch (err) {
          console.error("Error fetching user profile:", err);
          setProfile(null);
          setSchool(null);
        }
      } else {
        setProfile(null);
        setSchool(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, profile, school, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
