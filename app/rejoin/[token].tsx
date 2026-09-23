import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";
import { GlassButton, GlassCard, GlassInput } from "../../components/Glass";
import { Screen } from "../../components/Screen";
import { colors, typography } from "../../lib/theme";
import { rejoinEventWithTemporaryInvite, supabase, useApp } from "../../lib/app-context";

export default function TemporaryInviteRoute() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>();
  const { displayName } = useApp();
  const [name, setName] = useState(displayName || "");
  const [event, setEvent] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      if (!supabase) {
        if (active) {
          setError("Cloud connection is not configured.");
          setLoading(false);
        }
        return;
      }
      try {
        const { data, error: lookupError } = await supabase.rpc(
          "resolve_event_temporary_invite",
          { p_token: String(token || "") },
        );
        if (lookupError) throw lookupError;
        const row = Array.isArray(data) ? data[0] : data;
        if (!row?.event_id) {
          if (active) setError("This temporary invite has expired or is no longer valid.");
          return;
        }
        if (active) {
          setEvent({ id: row.event_id, name: row.event_name });
        }
      } catch (e: any) {
        if (active) setError(e?.message || "Could not open this invite.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [token]);

  const join = async () => {
    if (!name.trim() || !event) {
      setError("Enter your name to join.");
      return;
    }
    setError("");
    try {
      const participantId = await rejoinEventWithTemporaryInvite(
        String(token || ""),
        name,
      );
      if (!participantId) {
        setError("This temporary invite is no longer valid.");
        return;
      }
      router.replace({ pathname: "/event/[id]", params: { id: event.id } });
    } catch (e: any) {
      setError(e?.message || "Could not join this event.");
    }
  };

  return (
    <Screen>
      <Text style={styles.kicker}>QUICK ACCESS</Text>
      <Text style={styles.title}>{event?.name || "Mefie event"}</Text>
      <Text style={styles.sub}>
        This access link is valid for 5 minutes. Anyone with the link or QR can join the event while it is active. Once you join, you stay in the event.
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
          label={loading ? "Opening invite..." : "Back to Mefie"}
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
  title: {
    color: colors.white,
    fontSize: 34,
        marginTop: 8,
  fontFamily: typography.extraBold, },
  sub: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  fontFamily: typography.regular, },
  error: {
    color: "#FFB4B4",
    fontSize: 13,
    marginBottom: 12,
  fontFamily: typography.regular, },
});
