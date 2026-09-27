import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ensureAnonymousAuth, supabase, useApp } from "../lib/app-context";
import { colors, typography } from "../lib/theme";

const NAME_COMPLETED_KEY = "mefie.nameCompleted";

export default function NameScreen() {
  const router = useRouter();
  const { setDisplayName } = useApp();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const continueWithName = async () => {
    const value = name.trim().replace(/\s+/g, " ");
    if (!value) {
      setError("Enter your name to continue.");
      return;
    }
    if (value.length > 60) {
      setError("Keep your name under 60 characters.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      await setDisplayName(value);
      if (supabase) {
        await ensureAnonymousAuth();
        const { error: authError } = await supabase.auth.updateUser({
          data: { display_name: value },
        });
        if (authError) throw authError;
      }
      await AsyncStorage.setItem(NAME_COMPLETED_KEY, "true");
      router.replace("/");
    } catch (e: any) {
      setError(e?.message || "Could not save your name. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.content}>
        <View style={styles.mark}>
          <Text style={styles.markText}>M</Text>
        </View>
        <Text style={styles.eyebrow}>WELCOME TO MEFIE</Text>
        <Text style={styles.title}>What should we call you?</Text>
        <Text style={styles.subtitle}>
          Your name will appear when you share photos with your people.
        </Text>

        <View style={styles.inputWrap}>
          <Text style={styles.label}>Your name</Text>
          <TextInput
            value={name}
            onChangeText={(value) => {
              setName(value);
              if (error) setError("");
            }}
            placeholder="Enter your name"
            placeholderTextColor="rgba(255,255,255,.38)"
            autoFocus
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={continueWithName}
            style={styles.input}
            editable={!busy}
            maxLength={60}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          onPress={continueWithName}
          disabled={busy}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, busy && styles.buttonDisabled]}
        >
          <Text style={styles.buttonText}>{busy ? "Saving…" : "Continue"}</Text>
          {!busy ? <MaterialCommunityIcons name="arrow-right" size={24} color={colors.black} /> : null}
        </Pressable>

        <Text style={styles.privacy}>You can change your name later.</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0A0F15" },
  content: { flex: 1, paddingHorizontal: 26, paddingTop: 92, paddingBottom: 36 },
  mark: {
    width: 52,
    height: 52,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 46,
  },
  markText: { color: colors.white, fontSize: 27, fontFamily: typography.extraBold },
  eyebrow: { color: "rgba(255,255,255,.48)", fontSize: 11, letterSpacing: 1.6, fontFamily: typography.bold },
  title: { color: colors.white, fontSize: 34, lineHeight: 40, letterSpacing: -1, fontFamily: typography.extraBold, marginTop: 12 },
  subtitle: { color: "rgba(255,255,255,.64)", fontSize: 15, lineHeight: 22, fontFamily: typography.regular, marginTop: 12, maxWidth: 340 },
  inputWrap: { marginTop: 38, borderRadius: 20, paddingHorizontal: 18, paddingTop: 13, paddingBottom: 5, backgroundColor: "rgba(255,255,255,.055)", borderWidth: 1, borderColor: "rgba(255,255,255,.14)" },
  label: { color: "rgba(255,255,255,.5)", fontSize: 11, fontFamily: typography.semibold, marginBottom: 2 },
  input: { color: colors.white, fontSize: 19, fontFamily: typography.medium, paddingVertical: 10 },
  error: { color: "#FF9A9A", fontSize: 13, fontFamily: typography.medium, marginTop: 10, marginLeft: 4 },
  button: { height: 58, borderRadius: 29, backgroundColor: "#F7F8FA", marginTop: 24, paddingHorizontal: 22, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  buttonPressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  buttonDisabled: { opacity: 0.62 },
  buttonText: { color: colors.black, fontSize: 16, fontFamily: typography.extraBold },
  privacy: { color: "rgba(255,255,255,.38)", textAlign: "center", fontSize: 12, fontFamily: typography.regular, marginTop: 16 },
});
