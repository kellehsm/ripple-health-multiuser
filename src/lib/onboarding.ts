import * as FileSystem from "expo-file-system/legacy";

const FLAG = FileSystem.documentDirectory + "onboarding_done";

export async function hasCompletedOnboarding(): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(FLAG);
    return info.exists;
  } catch {
    return false;
  }
}

export async function markOnboardingComplete(): Promise<void> {
  try {
    await FileSystem.writeAsStringAsync(FLAG, "1");
  } catch {
    // best-effort; if it fails the user sees onboarding once more on next launch
  }
}
