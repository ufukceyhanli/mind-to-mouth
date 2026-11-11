import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as aesjs from 'aes-js';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import { AppState } from 'react-native';

/**
 * Every user needs an account, and accounts live in the Supabase project a
 * build is given through `.env` (see `.env.example`). Without the two
 * variables nobody can sign in, so the app stops at the welcome screen with a
 * notice that accounts are not set up.
 */
const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
const SUPABASE_ANON_KEY = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();

export const isAuthConfigured = SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;

/**
 * Where Supabase sends the user back after an email link (confirmation,
 * magic link, password reset). Must be listed under Authentication → URL
 * configuration → Redirect URLs in the Supabase dashboard.
 */
export const AUTH_REDIRECT_URL = Linking.createURL('auth/callback');

/**
 * Session storage. The keychain is the right place for tokens, but iOS can
 * reject values over about 2 KB and a Supabase session is bigger than that.
 * So, as Supabase recommends, a random AES-256 key lives in the keychain and
 * the encrypted session lives in AsyncStorage.
 */
class LargeSecureStore {
  private async encrypt(key: string, value: string): Promise<string> {
    const encryptionKey = Crypto.getRandomValues(new Uint8Array(32));
    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
    const encrypted = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
    await SecureStore.setItemAsync(key, aesjs.utils.hex.fromBytes(encryptionKey));
    return aesjs.utils.hex.fromBytes(encrypted);
  }

  private async decrypt(key: string, value: string): Promise<string | null> {
    const keyHex = await SecureStore.getItemAsync(key);
    if (!keyHex) return null;
    const cipher = new aesjs.ModeOfOperation.ctr(aesjs.utils.hex.toBytes(keyHex), new aesjs.Counter(1));
    return aesjs.utils.utf8.fromBytes(cipher.decrypt(aesjs.utils.hex.toBytes(value)));
  }

  async getItem(key: string): Promise<string | null> {
    try {
      const encrypted = await AsyncStorage.getItem(key);
      if (!encrypted) return null;
      return await this.decrypt(key, encrypted);
    } catch {
      // A corrupt or unreadable entry means "signed out", not a crash.
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    const encrypted = await this.encrypt(key, value);
    await AsyncStorage.setItem(key, encrypted);
  }

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(key);
  }
}

let client: SupabaseClient | null = null;

/** The shared Supabase client. Throws when the build has no Supabase config. */
export function getSupabase(): SupabaseClient {
  if (!isAuthConfigured) throw new Error('Accounts are not available in this build.');
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: new LargeSecureStore(),
        storageKey: 'mtm-auth-v1',
        autoRefreshToken: true,
        persistSession: true,
        // Email links are handled by hand in AuthProvider; there is no browser URL to read.
        detectSessionInUrl: false,
      },
    });
    // Only refresh tokens while the app is in the foreground, as Supabase advises for React Native.
    AppState.addEventListener('change', (state) => {
      if (!client) return;
      if (state === 'active') client.auth.startAutoRefresh();
      else client.auth.stopAutoRefresh();
    });
  }
  return client;
}

// ---- Server settings -------------------------------------------------------

/**
 * Which third-party providers the Supabase project has switched on. GoTrue's
 * public settings endpoint answers with `external: { google: true, ... }`, so
 * the app can hide a "Continue with Google" button that would only lead to an
 * error page.
 */
export async function fetchEnabledProviders(): Promise<Record<string, boolean>> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
    headers: { apikey: SUPABASE_ANON_KEY },
  });
  if (!res.ok) throw new Error(`Auth settings returned ${res.status}`);
  const body = (await res.json()) as { external?: Record<string, boolean> };
  return body.external ?? {};
}

// ---- Email link callbacks --------------------------------------------------

export type AuthCallback = {
  accessToken: string;
  refreshToken: string;
  /** Supabase's reason for the link: `recovery`, `magiclink`, `signup`, `invite`, ... */
  type: string | null;
};

export type ParsedCallback =
  | { kind: 'session'; session: AuthCallback }
  | { kind: 'error'; message: string }
  | { kind: 'none' };

/**
 * Reads the tokens Supabase appends to the redirect URL after an email link
 * is opened (`mindtomouth://auth/callback#access_token=...`). Supabase uses
 * the fragment for tokens and the query string for errors.
 */
export function parseAuthCallback(url: string): ParsedCallback {
  if (!url.includes('auth/callback')) return { kind: 'none' };
  const params = new Map<string, string>();
  for (const part of url.split(/[?#]/).slice(1)) {
    for (const pair of part.split('&')) {
      if (!pair) continue;
      const eq = pair.indexOf('=');
      const key = decodeURIComponent(eq === -1 ? pair : pair.slice(0, eq));
      const value = eq === -1 ? '' : decodeURIComponent(pair.slice(eq + 1).replace(/\+/g, ' '));
      params.set(key, value);
    }
  }
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (accessToken && refreshToken) {
    return { kind: 'session', session: { accessToken, refreshToken, type: params.get('type') ?? null } };
  }
  const error = params.get('error_description') ?? params.get('error');
  if (error) {
    const code = params.get('error_code');
    const message =
      code === 'otp_expired'
        ? 'That link has expired. Ask for a new one and open it within an hour.'
        : error;
    return { kind: 'error', message };
  }
  return { kind: 'none' };
}

/** Turns a Supabase error into one short sentence the user can act on. */
export function describeAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  if (
    lower.includes('network request failed') ||
    lower.includes('failed to fetch') ||
    lower.includes('fetch failed') ||
    lower.includes('hostname could not be found') ||
    lower.includes('internet connection') ||
    lower.includes('timed out')
  ) {
    return 'Could not reach the sign-in service. Check your connection and try again.';
  }
  if (lower.includes('invalid login credentials')) return 'Wrong email or password.';
  if (lower.includes('email not confirmed')) {
    return 'Confirm your email first: open the link we sent you, then sign in.';
  }
  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return 'Too many attempts. Wait a few minutes and try again.';
  }
  if (lower.includes('already registered')) return 'There is already an account with that email. Sign in instead.';
  if (lower.includes('provider is not enabled') || lower.includes('unsupported provider')) {
    return 'That way of signing in is not set up yet. Use email or Apple instead.';
  }
  if (lower.includes('password should be')) return 'Use a password of at least 6 characters.';
  if (lower.includes('could not find the function') || lower.includes('delete_user')) {
    return 'Account deletion is not set up on the server yet. See supabase/schema.sql.';
  }
  return message || 'Something went wrong. Please try again.';
}
