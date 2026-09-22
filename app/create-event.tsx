import { useRouter } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BackButton, Screen } from "../components/Screen";
import { GlassCard, GlassInput } from "../components/Glass";
import { colors, radii, shadows, typography } from "../lib/theme";
import { ensureParticipant, getSessionId, supabase, useApp } from "../lib/app-context";

function code() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export default function CreateEventScreen() {
  const router = useRouter();
  const { displayName } = useApp();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const create = async () => {
    if (!name.trim()) {
      setError("Give your event a name.");
      return;
    }
    if (!supabase) {
      setError("Cloud connection is not configured.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const creatorSessionId = await getSessionId();
      let data: any = null;
      let insertError: any = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const result = await supabase
          .from("events")
          .insert({
            name: name.trim(),
            invite_code: code(),
            creator_session_id: creatorSessionId,
          })
          .select("id,invite_code")
          .single();
        data = result.data;
        insertError = result.error;
        if (!insertError) break;
      }
      if (insertError || !data)
        throw insertError || new Error("Could not create the event.");
      await ensureParticipant(data.id, displayName);
      router.replace({
        pathname: "/event-created",
        params: { id: data.id, name: name.trim(), invite: data.invite_code },
      });
    } catch (e: any) {
      setError(e?.message || "Could not create the event.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <Screen>
      <BackButton />
      <View style={styles.heading}>
        <Text style={styles.title}>Create an event</Text>
        <Text style={styles.sub}>Just a name. That's it.</Text>
      </View>
      <GlassCard style={styles.formCard}>
        <GlassInput
          label="Event name"
          value={name}
          onChangeText={setName}
          placeholder="Ladakh Trip 2025"
        />
        <Text style={styles.hint}>
          You can invite everyone after it's created.
        </Text>
      </GlassCard>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        disabled={loading}
        onPress={create}
        focusable={false}
        android_ripple={{ color: "transparent" }}
        style={({ pressed }) => [
          styles.createButton,
          pressed && styles.pressed,
          loading && styles.disabled,
        ]}
      >
        <View style={styles.buttonContent}>
          <Text style={styles.createButtonLabel}>
            {loading ? "Creating…" : "Create event"}
          </Text>
          <MaterialCommunityIcons
            name="arrow-right"
            size={24}
            color={colors.black}
          />
        </View>
      </Pressable>
    </Screen>
  );
}
const styles = StyleSheet.create({
  heading: { marginTop: 34, paddingBottom: 3 },
  title: {
    color: colors.white,
    fontSize: 34,
    fontFamily: typography.extraBold, fontWeight: "800",
    letterSpacing: -1,
  },
  sub: { color: colors.muted, fontSize: 15, fontFamily: typography.regular, marginTop: 7 },
  formCard: { padding: 14 },
  hint: {
    color: colors.faint,
    fontSize: 12,
    fontFamily: typography.regular, marginTop: 12,
    marginHorizontal: 2,
  },
  error: { color: colors.danger, fontSize: 13, fontFamily: typography.regular, marginHorizontal: 4 },
  createButton: {
    height: 66,
    borderRadius: radii.pill,
    backgroundColor: "rgba(250,252,255,0.98)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.86)",
    alignItems: "center",
    justifyContent: "center",
    ...shadows,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  createButtonLabel: {
    color: colors.black,
    fontSize: 16,
    fontFamily: typography.bold, fontWeight: "700",
    letterSpacing: -0.15,
  },
  pressed: { transform: [{ scale: 0.985 }], opacity: 0.88 },
  disabled: { opacity: 0.55 },
});
