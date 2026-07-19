import * as SecureStore from "expo-secure-store";
import { File, Paths } from "expo-file-system";

const TOKEN_KEY = "ripple_jwt";
const WIDGET_AUTH_FILE = "widget_auth.json";

export interface UserInfo {
  id: string;
  email: string;
  onboarding_completed: boolean;
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  // Mirror to a plain file so the Android widget (same package) can read it
  try {
    new File(Paths.document, WIDGET_AUTH_FILE).write(JSON.stringify({ token }));
  } catch {}
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  try {
    const f = new File(Paths.document, WIDGET_AUTH_FILE);
    if (f.exists) f.delete();
  } catch {}
}

export async function getUserId(): Promise<string | null> {
  const token = await getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.user_id ?? null;
  } catch {
    return null;
  }
}

// Logout hook — App registers this so Settings can trigger a full sign-out
let _logoutHandler: (() => void) | null = null;

export function registerLogoutHandler(cb: () => void): void {
  _logoutHandler = cb;
}

export async function logout(): Promise<void> {
  await clearToken();
  _logoutHandler?.();
}
