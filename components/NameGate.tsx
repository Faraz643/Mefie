import AsyncStorage from "@react-native-async-storage/async-storage";
import { usePathname, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { View } from "react-native";

const NAME_COMPLETED_KEY = "mefie.nameCompleted";

export function NameGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(NAME_COMPLETED_KEY).then((value) => {
      if (!active) return;
      setChecked(true);
      if (value !== "true" && pathname !== "/name") {
        router.replace("/name");
      }
    });
    return () => {
      active = false;
    };
  }, [pathname, router]);

  if (!checked && pathname !== "/name") {
    return <View style={{ flex: 1, backgroundColor: "#0A0F15" }} />;
  }

  return <>{children}</>;
}
