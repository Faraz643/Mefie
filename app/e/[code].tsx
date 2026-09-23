import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";
import { GlassButton, GlassCard, GlassInput } from "../../components/Glass";
import { Screen } from "../../components/Screen";
import { colors, typography } from "../../lib/theme";
import { supabase } from "../../lib/app-context";

export default function InviteRoute() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code: string }>();
  const [name, setName] = useState("");
  const [event, setEvent] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!supabase) return;
      const { data: resolved } = await supabase.rpc(
        "resolve_event_invite",
        { p_invite_code: String(code || "").toUpperCase() },
      );
      const data = Array.isArray(resolved) ? resolved[0] : resolved;
      setEvent(data);
      if (!data)
        setError("This event link isn't valid or the event has ended.");
    };
    load();
  }, [code]);

  const join = async () => {
    if (!name.trim() || !event) {
      setError("Enter your name to join.");
      return;
    }
    try {
      const { data: participantId, error: joinError } = await supabase.rpc(
        "join_event_by_invite",
        {
          p_invite_code: String(code || "").toUpperCase(),
          p_display_name: name,
        },
      );
      if (joinError) throw joinError;
      if (!participantId) {
        setError("You were removed from this event. Use a temporary invite to rejoin.");
        return;
      }
      router.replace({ pathname: "/event/[id]", params: { id: event.id } });
    } catch (e: any) {
      setError(e?.message || "Could not join this event.");
    }
  };

  return (
    <Screen>
      <Text style={styles.kicker}>YOU'RE INVITED</Text>
      <Text style={styles.title}>{event?.name || "Mefie event"}</Text>
      <Text style={styles.sub}>
        Everyone's photos go into one shared album.
      </Text>
      {event ? (
        <GlassCard>
          <GlassInput
            label="Your name"
            value={name}
            onChangeText={setName}
            placeholder="Aman"
          />
        </GlassCard>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {event ? (
        <GlassButton primary label="Join event" onPress={join} />
      ) : (
        <GlassButton
          label="Back to Mefie"
          onPress={() => router.replace("/")}
        />
      )}
    </Screen>
  );
}
const styles = StyleSheet.create({
  kicker: {
    color: colors.muted,
    fontSize: 12,
        marginTop: 50,
  fontFamily: typography.extraBold, },
  title: { color: colors.white, fontSize: 34, fontFamily: typography.extraBold, marginTop: 8 },
  sub: { color: colors.muted, fontSize: 15, fontFamily: typography.regular, lineHeight: 22, marginTop: 8 },
  error: { color: "#FFB4B4", fontSize: 13, fontFamily: typography.regular, marginBottom: 12 },
});
