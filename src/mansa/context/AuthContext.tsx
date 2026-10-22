import React, { createContext, useContext, useEffect, useState } from "react";
import {
  auth,
  googleProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  FirebaseUser,
  firebaseConfigured,
} from "../services/firebaseAuth";
import type { FirestoreUserProfile } from "../services/dbService";
import { safeStorage } from "../utils/storage";

const syncAuthenticatedProfile = async (user: {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
}) => {
  const { syncUserProfile } = await import("../services/dbService");
  return syncUserProfile(user);
};

const getAuthErrorCode = (error: unknown): string | undefined => {
  if (typeof error === "object" && error !== null && "code" in error) {
    return typeof error.code === "string" ? error.code : undefined;
  }
  return undefined;
};

const getErrorMessage = (error: unknown): string | undefined =>
  error instanceof Error ? error.message : undefined;

export type AppUser = Pick<FirebaseUser, "uid" | "email" | "displayName" | "photoURL">;

interface AuthContextType {
  user: AppUser | null;
  profile: FirestoreUserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, name?: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_ACCOUNTS_KEY = "mansa_local_auth_accounts";
const LOCAL_SESSION_KEY = "mansa_local_auth_session";

type LocalAccount = {
  uid: string;
  email: string;
  password: string;
  displayName: string;
  createdAt: string;
};

const readLocalAccounts = (): LocalAccount[] => {
  try {
    const raw = safeStorage.getItem(LOCAL_ACCOUNTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const localProfile = (account: LocalAccount): FirestoreUserProfile => ({
  uid: account.uid,
  email: account.email,
  displayName: account.displayName,
  avatarInitials: account.displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase(),
  country: "Côte d’Ivoire",
  currency: "XOF",
  createdAt: account.createdAt,
  updatedAt: new Date().toISOString(),
});

const localUser = (account: LocalAccount): AppUser => ({
  uid: account.uid,
  email: account.email,
  displayName: account.displayName,
  photoURL: null,
});

const saveLocalSession = (account: LocalAccount) => {
  safeStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(account));
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [profile, setProfile] = useState<FirestoreUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (!firebaseConfigured || !auth) {
      const rawSession = safeStorage.getItem(LOCAL_SESSION_KEY);
      if (rawSession) {
        try {
          const account = JSON.parse(rawSession) as LocalAccount;
          if (account?.uid && account?.email) {
            setUser(localUser(account));
            setProfile(localProfile(account));
          }
        } catch {
          safeStorage.removeItem(LOCAL_SESSION_KEY);
        }
      }
      setLoading(false);
      return () => {
        isMounted = false;
      };
    }

    // Failsafe timeout: in cross-origin iframes or restricted environments, Firebase Auth
    // can take time to resolve IndexedDB locks. Never block the user for more than 1200ms.
    const failsafeTimer = setTimeout(() => {
      if (isMounted) {
        setLoading(false);
      }
    }, 1200);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      clearTimeout(failsafeTimer);
      if (!isMounted) return;

      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          const userProfile = await syncAuthenticatedProfile({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL,
          });
          if (isMounted) setProfile(userProfile);
        } catch (err) {
          console.error("Error syncing profile with Firestore:", err);
          const initials =
            (firebaseUser.displayName
              ? firebaseUser.displayName
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()
              : firebaseUser.email?.slice(0, 2).toUpperCase()) || "MA";

          if (isMounted) {
            setProfile({
              uid: firebaseUser.uid,
              email: firebaseUser.email || "",
              displayName:
                firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Créateur",
              avatarInitials: initials,
              ...(firebaseUser.photoURL ? { photoURL: firebaseUser.photoURL } : {}),
              country: "Côte d'Ivoire",
              currency: "XOF",
            });
          }
        }
        if (isMounted) setLoading(false);
      } else {
        if (isMounted) {
          setUser(null);
          setProfile(null);
        }
        if (isMounted) setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(failsafeTimer);
      unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    if (!firebaseConfigured || !auth) {
      const localError = new Error("La connexion Google nécessite la configuration Firebase.");
      setError(localError.message);
      throw localError;
    }
    try {
      setError(null);
      setLoading(true);
      const res = await signInWithPopup(auth, googleProvider);
      if (res.user) {
        const userProfile = await syncAuthenticatedProfile({
          uid: res.user.uid,
          email: res.user.email,
          displayName: res.user.displayName,
          photoURL: res.user.photoURL,
        });
        setProfile(userProfile);
      }
    } catch (err: unknown) {
      console.error("Google Sign-In Error:", err);
      let msg = "Échec de la connexion Google.";
      const code = getAuthErrorCode(err);
      if (code === "auth/popup-closed-by-user") {
        msg = "Connexion annulée par l'utilisateur.";
      } else if (code === "auth/unauthorized-domain") {
        msg = "Domaine non autorisé dans la console Firebase.";
      } else if (getErrorMessage(err)) {
        msg = getErrorMessage(err)!;
      }
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    if (!firebaseConfigured || !auth) {
      const account = readLocalAccounts().find(
        (item) => item.email.toLowerCase() === email.trim().toLowerCase(),
      );
      if (!account || account.password !== pass) {
        const message = "Identifiants invalides. Vérifiez votre email et mot de passe.";
        setError(message);
        throw new Error(message);
      }
      saveLocalSession(account);
      setUser(localUser(account));
      setProfile(localProfile(account));
      setError(null);
      return;
    }
    try {
      setError(null);
      setLoading(true);
      const res = await signInWithEmailAndPassword(auth, email, pass);
      if (res.user) {
        const userProfile = await syncAuthenticatedProfile({
          uid: res.user.uid,
          email: res.user.email,
          displayName: res.user.displayName,
          photoURL: res.user.photoURL,
        });
        setProfile(userProfile);
      }
    } catch (err: unknown) {
      console.error("Email Sign-In Error:", err);
      let msg = "Adresse email ou mot de passe incorrect.";
      const code = getAuthErrorCode(err);
      if (
        code === "auth/user-not-found" ||
        code === "auth/wrong-password" ||
        code === "auth/invalid-credential"
      ) {
        msg = "Identifiants invalides. Vérifiez votre email et mot de passe.";
      } else if (code === "auth/too-many-requests") {
        msg = "Trop de tentatives échouées. Veuillez patienter un moment.";
      }
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signUpWithEmail = async (email: string, pass: string, name?: string) => {
    if (!firebaseConfigured || !auth) {
      const normalizedEmail = email.trim().toLowerCase();
      const accounts = readLocalAccounts();
      if (accounts.some((item) => item.email.toLowerCase() === normalizedEmail)) {
        const message = "Cette adresse email est déjà associée à un compte.";
        setError(message);
        throw new Error(message);
      }
      if (pass.length < 6) {
        const message = "Le mot de passe doit contenir au moins 6 caractères.";
        setError(message);
        throw new Error(message);
      }
      const account: LocalAccount = {
        uid: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        email: normalizedEmail,
        password: pass,
        displayName: name?.trim() || normalizedEmail.split("@")[0] || "Créateur",
        createdAt: new Date().toISOString(),
      };
      safeStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify([...accounts, account]));
      saveLocalSession(account);
      setUser(localUser(account));
      setProfile(localProfile(account));
      setError(null);
      return;
    }
    try {
      setError(null);
      setLoading(true);
      const res = await createUserWithEmailAndPassword(auth, email, pass);
      if (res.user) {
        const userProfile = await syncAuthenticatedProfile({
          uid: res.user.uid,
          email: res.user.email,
          displayName: name || res.user.email?.split("@")[0] || "Nouveau Créateur",
          photoURL: res.user.photoURL,
        });
        setProfile(userProfile);
      }
    } catch (err: unknown) {
      console.error("Sign-Up Error:", err);
      let msg = "Erreur lors de la création du compte.";
      const code = getAuthErrorCode(err);
      if (code === "auth/email-already-in-use") {
        msg = "Cette adresse email est déjà associée à un compte.";
      } else if (code === "auth/weak-password") {
        msg = "Le mot de passe doit contenir au moins 6 caractères.";
      } else if (code === "auth/invalid-email") {
        msg = "Format d'adresse email invalide.";
      }
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    if (!firebaseConfigured || !auth) {
      const exists = readLocalAccounts().some(
        (item) => item.email.toLowerCase() === email.trim().toLowerCase(),
      );
      if (!exists) throw new Error("Aucun compte trouvé avec cette adresse email.");
      setError("La réinitialisation par email nécessite la configuration Firebase.");
      return;
    }
    try {
      setError(null);
      await sendPasswordResetEmail(auth, email);
    } catch (err: unknown) {
      console.error("Reset password error:", err);
      setError("Impossible d'envoyer l'email de réinitialisation.");
      throw err;
    }
  };

  const logout = async () => {
    if (!firebaseConfigured || !auth) {
      safeStorage.removeItem(LOCAL_SESSION_KEY);
      setUser(null);
      setProfile(null);
      return;
    }
    try {
      await firebaseSignOut(auth);
      setUser(null);
      setProfile(null);
    } catch (err) {
      console.error("Logout error:", err);
      setUser(null);
      setProfile(null);
    }
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        resetPassword,
        logout,
        error,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
