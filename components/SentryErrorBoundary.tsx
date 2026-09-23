import * as Sentry from "@sentry/react-native";
import { PropsWithChildren } from "react";
import { StyleSheet, Text, View } from "react-native";

export function SentryErrorBoundary({ children }: PropsWithChildren) {
  return (
    <Sentry.ErrorBoundary
      fallback={({ resetError }) => (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            Mefie hit an unexpected error. Your moments are safe. Please try
            again.
          </Text>
          <Text style={styles.action} onPress={resetError}>
            Try again
          </Text>
        </View>
      )}
    >
      {children}
    </Sentry.ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    backgroundColor: "#0A0F15",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  message: {
    marginTop: 10,
    color: "#AAB4C0",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  action: {
    marginTop: 20,
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
