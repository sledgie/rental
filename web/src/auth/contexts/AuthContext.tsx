import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { SignUpInput, User } from "../lib/types";
import { authService } from "../services";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";

interface AuthContextValue {
  user: User | null;
  initializing: boolean;
  authenticating: boolean;
  signIn: (email: string, password: string, remember?: boolean) => Promise<User>;
  signUp: (input: SignUpInput) => Promise<User>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  resendSignupEmail: (email: string) => Promise<void>;
  verifyEmail: () => Promise<void>;
  resetDemo: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [authenticating, setAuthenticating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    authService
      .getCurrentUser()
      .then((sessionUser) => {
        if (!cancelled) setUser(sessionUser);
      })
      .finally(() => {
        if (!cancelled) setInitializing(false);
      });
    // Supabase can end a session on its own (expired refresh token, sign-out in another tab).
    const { data: listener } = isSupabaseConfigured
      ? supabase.auth.onAuthStateChange((event) => {
          if (event === "SIGNED_OUT" && !cancelled) setUser(null);
        })
      : { data: null };
    return () => {
      cancelled = true;
      listener?.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string, remember = true) => {
    setAuthenticating(true);
    try {
      const signedIn = await authService.login(email, password, remember);
      setUser(signedIn);
      return signedIn;
    } finally {
      setAuthenticating(false);
    }
  }, []);

  const signUp = useCallback(async (input: SignUpInput) => {
    setAuthenticating(true);
    try {
      const created = await authService.signUp(input);
      setUser(created);
      return created;
    } finally {
      setAuthenticating(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    await authService.logout();
    setUser(null);
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    await authService.requestPasswordReset(email);
  }, []);

  const resendSignupEmail = useCallback(async (email: string) => {
    await authService.resendSignupEmail(email);
  }, []);

  const verifyEmail = useCallback(async () => {
    if (!user) return;
    await authService.verifyEmail(user.id);
    setUser((current) => (current ? { ...current, emailVerified: true } : current));
  }, [user]);

  const resetDemo = useCallback(async () => {
    await authService.resetDemoData();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      initializing,
      authenticating,
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      resendSignupEmail,
      verifyEmail,
      resetDemo,
      isAuthenticated: Boolean(user),
    }),
    [user, initializing, authenticating, signIn, signUp, signOut, requestPasswordReset, resendSignupEmail, verifyEmail, resetDemo]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
