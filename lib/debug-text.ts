import React from "react";

// React Native emits this warning from the renderer, which can hide the
// component that supplied the invalid child. In development, capture the
// warning at the moment it is emitted and print the JavaScript stack.
if (__DEV__) {
  const globalObject = globalThis as any;

  if (!globalObject.__mefieTextDebugInstalled) {
    globalObject.__mefieTextDebugInstalled = true;

    const originalError = console.error.bind(console);

    console.error = (...args: any[]) => {
      const message = args
        .map((value) => (typeof value === "string" ? value : String(value)))
        .join(" ");

      if (
        message.includes(
          "Text strings must be rendered within a <Text> component",
        )
      ) {
        originalError(
          "\n[MEFIE TEXT DEBUG] React Native emitted the raw-text warning.\n" +
            "JavaScript stack at warning time:\n" +
            new Error().stack +
            "\n[MEFIE TEXT DEBUG] End diagnostic.\n",
        );
      }

      originalError(...args);
    };
  }
}

export {};
