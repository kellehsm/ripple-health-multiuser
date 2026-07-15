import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { api } from "../api/client";
import { setToken } from "../lib/auth";
import { useTheme } from "../theme/ThemeContext";

interface Props {
  onLoginSuccess: () => void;
}

export function LoginScreen({ onLoginSuccess }: Props) {
  const { theme } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    setError(null);
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      setError("Email and password are required.");
      return;
    }
    setLoading(true);
    try {
      const res = await api.login(trimmedEmail, password);
      if (!res.token) throw new Error("No token received");
      await setToken(res.token);
      onLoginSuccess();
    } catch (err: any) {
      const msg = err?.message ?? "";
      if (msg.includes("401") || msg.includes("Invalid")) {
        setError("Incorrect email or password.");
      } else {
        setError("Couldn't connect. Check your network and try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  const ink = theme.ink;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.page }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.logoBlock}>
          <Text style={[styles.appName, { color: ink }]}>Ripple{"\n"}Wellness</Text>
        </View>

        <View style={styles.form}>
          <Text style={[styles.label, { color: ink }]}>Email</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.card, borderColor: ink, color: theme.textStrong, shadowColor: ink }]}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            placeholder="you@example.com"
            placeholderTextColor={theme.textSoft}
            returnKeyType="next"
          />

          <Text style={[styles.label, { color: ink }]}>Password</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.card, borderColor: ink, color: theme.textStrong, shadowColor: ink }]}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
            placeholder="••••••••"
            placeholderTextColor={theme.textSoft}
            returnKeyType="done"
            onSubmitEditing={handleLogin}
          />

          {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.teal.solid, borderColor: ink, shadowColor: ink }, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={ink} />
            ) : (
              <Text style={[styles.buttonText, { color: ink }]}>Sign in</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingVertical: 48,
  },
  logoBlock: {
    marginBottom: 48,
    alignItems: "flex-start",
  },
  appName: {
    fontSize: 42,
    fontWeight: "900",
    lineHeight: 46,
    letterSpacing: -1,
  },
  form: { gap: 4 },
  label: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 6,
  },
  input: {
    borderWidth: 2,
    borderRadius: 0,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  error: {
    fontWeight: "700",
    fontSize: 14,
    marginTop: 12,
  },
  button: {
    marginTop: 28,
    borderWidth: 2,
    paddingVertical: 16,
    alignItems: "center",
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: {
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
});
