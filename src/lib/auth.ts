import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "ripple_jwt";

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
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
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
