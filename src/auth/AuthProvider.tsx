import type { Session } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';

import { AUTH_REDIRECT_URL, getSupabase, isAuthConfigured, parseAuthCallback } from './supabase';

/** What happened with the last email link the app was opened from. */
export type LinkStatus = { state: 'idle' } | { state: 'working' } | { state: 'error'; message: string };

export type AuthContextValue = {
  /** False while the stored session is still being read; the splash screen waits for it. */
  ready: boolean;
  /** Whether this build has a Supabase project at all. */
  configured: boolean;
  session: Session | null;
  /** Set when the user arrived through a password-reset link and must pick a new password. */
  recovery: boolean;
  linkStatus: LinkStatus;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  /** Creates the account. Resolves to true when a confirmation email was sent instead of a session. */
  signUpWithPassword: (email: string, password: string) => Promise<boolean>;
  sendMagicLink: (email: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  /** Resolves to false when the user cancelled Apple's sheet. */
  signInWithApple: () => Promise<boolean>;
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Removes the account and everything the server holds about it, then signs out. */
  deleteAccount: () => Promise<void>;
  clearRecovery: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(!isAuthConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [recovery, setRecovery] = useState(false);
  const [linkStatus, setLinkStatus] = useState<LinkStatus>({ state: 'idle' });

  // Restore the stored session once, then follow every change (sign in, sign
  // out, token refresh) for the rest of the app's life.
  useEffect(() => {
    if (!isAuthConfigured) return;
    const supabase = getSupabase();
    let cancelled = false;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) return;
        setSession(data.session);
      })
      .catch(() => {
        // Unreadable storage is the same as being signed out.
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next) setRecovery(false);
    });
    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  // Email links (confirmation, magic link, password reset) open the app at
  // mindtomouth://auth/callback with the tokens in the URL. Each URL is
  // handled once, whether it launched the app or arrived while it was open.
  const url = Linking.useLinkingURL();
  const handledUrl = useRef<string | null>(null);
  useEffect(() => {
    if (!isAuthConfigured || !url || handledUrl.current === url) return;
    handledUrl.current = url;
    const parsed = parseAuthCallback(url);
    if (parsed.kind === 'none') return;
    (async () => {
      if (parsed.kind === 'error') {
        setLinkStatus({ state: 'error', message: parsed.message });
        return;
      }
      setLinkStatus({ state: 'working' });
      try {
        const { error } = await getSupabase().auth.setSession({
          access_token: parsed.session.accessToken,
          refresh_token: parsed.session.refreshToken,
        });
        if (error) throw error;
        if (parsed.session.type === 'recovery') setRecovery(true);
        setLinkStatus({ state: 'idle' });
      } catch (e) {
        setLinkStatus({
          state: 'error',
          message: e instanceof Error ? e.message : 'The link could not be used.',
        });
      }
    })();
  }, [url]);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const { error } = await getSupabase().auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signUpWithPassword = useCallback(async (email: string, password: string) => {
    const { data, error } = await getSupabase().auth.signUp({
      email,
      password,
      options: { emailRedirectTo: AUTH_REDIRECT_URL },
    });
    if (error) throw error;
    // With "Confirm email" on (the Supabase default) there is no session until
    // the user opens the confirmation link.
    return data.session === null;
  }, []);

  const sendMagicLink = useCallback(async (email: string) => {
    const { error } = await getSupabase().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: AUTH_REDIRECT_URL, shouldCreateUser: true },
    });
    if (error) throw error;
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    const { error } = await getSupabase().auth.resetPasswordForEmail(email, {
      redirectTo: AUTH_REDIRECT_URL,
    });
    if (error) throw error;
  }, []);

  const signInWithApple = useCallback(async () => {
    // Apple gets the SHA-256 of a fresh nonce and signs it into the identity
    // token; Supabase gets the raw nonce and checks the two match, which stops
    // a captured token from being replayed.
    const rawNonce = Crypto.randomUUID();
    const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
    let credential: AppleAuthentication.AppleAuthenticationCredential;
    try {
      credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });
    } catch (e) {
      if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return false;
      throw e;
    }
    if (!credential.identityToken) throw new Error('Apple did not return an identity token.');
    const supabase = getSupabase();
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
      nonce: rawNonce,
    });
    if (error) throw error;
    // Apple only sends the name on the very first sign-in, so keep it now or never.
    const name = [credential.fullName?.givenName, credential.fullName?.familyName]
      .filter(Boolean)
      .join(' ');
    if (name) await supabase.auth.updateUser({ data: { full_name: name } });
    return true;
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await getSupabase().auth.updateUser({ password });
    if (error) throw error;
    setRecovery(false);
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await getSupabase().auth.signOut();
    // A failed server call (offline, session already gone) must still sign out locally.
    if (error) await getSupabase().auth.signOut({ scope: 'local' });
    setSession(null);
    setRecovery(false);
  }, []);

  const deleteAccount = useCallback(async () => {
    const supabase = getSupabase();
    // `delete_user` is a SECURITY DEFINER function (supabase/schema.sql) that
    // deletes the calling user from auth.users; identities, sessions and
    // refresh tokens go with it. The client cannot delete users directly.
    const { error } = await supabase.rpc('delete_user');
    if (error) throw error;
    await supabase.auth.signOut({ scope: 'local' });
    setSession(null);
    setRecovery(false);
  }, []);

  const clearRecovery = useCallback(() => setRecovery(false), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      configured: isAuthConfigured,
      session,
      recovery,
      linkStatus,
      signInWithPassword,
      signUpWithPassword,
      sendMagicLink,
      sendPasswordReset,
      signInWithApple,
      updatePassword,
      signOut,
      deleteAccount,
      clearRecovery,
    }),
    [
      ready,
      session,
      recovery,
      linkStatus,
      signInWithPassword,
      signUpWithPassword,
      sendMagicLink,
      sendPasswordReset,
      signInWithApple,
      updatePassword,
      signOut,
      deleteAccount,
      clearRecovery,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/** Plain-language name of how the current user signed in. */
export function providerLabel(session: Session): string {
  const provider = session.user.app_metadata?.provider;
  if (provider === 'apple') return 'Apple';
  return 'email';
}
