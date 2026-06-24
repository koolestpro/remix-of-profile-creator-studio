import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

interface AuthState {
  /** Current session, or null when signed out. */
  session: Session | null;
  /** True until the initial session check resolves. */
  loading: boolean;
  /** False when Supabase keys aren't set yet — auth is effectively off. */
  configured: boolean;
  /**
   * Step 1 of 2FA: verifies the password, signs out immediately, then sends
   * a 6-digit OTP to the email address.
   * Returns { needsOtp: true } on success, or { error } on failure.
   */
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ needsOtp?: boolean; error: string | null }>;
  /**
   * Step 2 of 2FA: verifies the 6-digit OTP sent to `email`.
   * On success Supabase creates the session and the user is signed in.
   */
  verifyOtp: (
    email: string,
    token: string,
  ) => Promise<{ error: string | null }>;
  /**
   * Re-send a fresh OTP to the given email (e.g. "Resend code" button).
   */
  resendOtp: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  /** Sends a one-time password / magic-link email. Used internally and for "resend". */
  const _sendOtp = async (email: string) => {
    if (!supabase) return { error: "Supabase is not configured yet." };
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        // Don't auto-create accounts — the user must already exist.
        shouldCreateUser: false,
        // Use the current origin so the link always points to the right
        // environment (production vs. localhost) automatically.
        emailRedirectTo: typeof window !== "undefined"
          ? window.location.origin
          : undefined,
      },
    });
    return { error: error ? error.message : null };
  };

  /**
   * Step 1: validate password, then immediately sign out and fire an OTP.
   * The caller should proceed to an OTP input screen on { needsOtp: true }.
   */
  const signIn = async (email: string, password: string) => {
    if (!supabase) return { error: "Supabase is not configured yet." };

    // Verify credentials first.
    const { error: pwError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (pwError) return { error: pwError.message };

    // Password is correct — sign out immediately so the session isn't live
    // until the second factor (OTP) is also verified.
    await supabase.auth.signOut({ scope: "local" });

    // Send the 6-digit code to the same email address.
    const { error: otpError } = await _sendOtp(email);
    if (otpError) return { error: otpError };

    return { needsOtp: true, error: null };
  };

  /** Step 2: verify the OTP token. On success, Supabase sets the session. */
  const verifyOtp = async (email: string, token: string) => {
    if (!supabase) return { error: "Supabase is not configured yet." };
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: token.trim(),
      type: "email",
    });
    return { error: error ? error.message : null };
  };

  /** Re-send a fresh OTP (e.g. "Didn't receive it?" button). */
  const resendOtp = async (email: string) => _sendOtp(email);

  const signOut = async () => {
    if (!supabase) return;
    // scope: 'global' revokes the refresh token on the server so ALL browser
    // tabs and devices are signed out, not just this one.
    await supabase.auth.signOut({ scope: "global" });
    setSession(null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        loading,
        configured: isSupabaseConfigured,
        signIn,
        verifyOtp,
        resendOtp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
