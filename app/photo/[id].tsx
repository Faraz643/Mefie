import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system/legacy";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, shadows, typography } from "../../lib/theme";
import { supabase } from "../../lib/app-context";
import { signPhotoPath } from "../../lib/photo-storage";
export default function PhotoView() {
  const router = useRouter();
  const { id, index = "0" } = useLocalSearchParams<{
    id: string;
    index?: string;
  }>();
  const [photo, setPhoto] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    (async () => {
      if (supabase && id) {
        const { data } = await supabase
          .from("photos")
          .select("id,event_id,participant_id,storage_path,thumbnail_path,original_filename,file_size,width,height,public_url,created_at")
          .eq("id", id)
          .maybeSingle();
        if (data) {
          const signedUrl = await signPhotoPath(data.storage_path);
          setPhoto({ ...data, public_url: signedUrl });
        } else {
          setPhoto(null);
        }
      }
    })();
  }, [id]);
  const download = async () => {
    if (!photo?.public_url || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const permission = await MediaLibrary.requestPermissionsAsync(true);
      if (!permission.granted)
        throw new Error("Photo permission is required to save this image.");
      if (!FileSystem.cacheDirectory)
        throw new Error("Local photo storage is unavailable.");
      const target = `${FileSystem.cacheDirectory}mefie-save-${photo.id}.jpg`;
      const download = await FileSystem.downloadAsync(photo.public_url, target);
      if (download.status < 200 || download.status >= 300)
        throw new Error(`Could not download photo (HTTP ${download.status}).`);
      await MediaLibrary.saveToLibraryAsync(download.uri);
      await FileSystem.deleteAsync(download.uri, { idempotent: true }).catch(() => undefined);
      setMessage("Saved to your photos ✓");
    } catch (e: any) {
      setMessage(e?.message || "Could not save photo.");
    } finally {
      setBusy(false);
    }
  };
  const share = () =>
    photo?.public_url && Share.share({ message: photo.public_url });
  const uri = photo?.public_url;
  return (
    <View style={styles.root}>
      {uri ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          resizeMode="contain"
        />
      ) : (
        <View style={styles.loading}>
          {photo === null ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: "#fff" }}>Photo unavailable</Text>
          )}
        </View>
      )}
      <View style={styles.scrimTop} />
      <View style={styles.top}>
        <Pressable
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={styles.icon}
        >
          <MaterialCommunityIcons name="chevron-left" size={27} color="#fff" />
        </Pressable>
        <View style={styles.counter}>
          <Text style={styles.count}>{Number(index) + 1}</Text>
        </View>
        <Pressable
          accessibilityLabel="Share photo"
          onPress={share}
          style={styles.icon}
        >
          <MaterialCommunityIcons
            name="share-variant-outline"
            size={20}
            color="#fff"
          />
        </Pressable>
      </View>
      {message ? (
        <View style={styles.message}>
          <Text style={styles.messageText}>{message}</Text>
        </View>
      ) : null}
      <View style={styles.bottom}>
        <View style={styles.meta}>
          <Text style={styles.name}>
            {photo?.display_name || "Mefie member"}
          </Text>
          <Text style={styles.time}>
            {photo?.created_at
              ? new Date(photo.created_at).toLocaleString()
              : ""}
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Save photo"
          onPress={download}
          style={styles.download}
        >
          {busy ? (
            <ActivityIndicator color="#111" />
          ) : (
            <>
              <MaterialCommunityIcons
                name="download-outline"
                size={19}
                color={colors.black}
              />
              <Text style={styles.downloadText}>Save</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#05080B" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  scrimTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 150,
    backgroundColor: "rgba(0,0,0,.18)",
  },
  top: {
    position: "absolute",
    top: 54,
    left: 18,
    right: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(15,20,26,.46)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  counter: {
    minWidth: 44,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    backgroundColor: "rgba(10,14,18,.42)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  count: { color: "#fff", fontSize: 13, fontFamily: typography.bold },
  bottom: {
    position: "absolute",
    bottom: 28,
    left: 18,
    right: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    borderRadius: 24,
    backgroundColor: "rgba(12,17,22,.54)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.18)",
    ...shadows,
  },
  meta: { flex: 1 },
  name: { color: "#fff", fontSize: 15, fontFamily: typography.extraBold },
  time: { color: colors.muted, fontSize: 11, fontFamily: typography.regular, marginTop: 3 },
  download: {
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(255,255,255,.94)",
    paddingHorizontal: 18,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  downloadText: { color: colors.black, fontSize: 14, fontFamily: typography.extraBold },
  message: {
    position: "absolute",
    top: 112,
    alignSelf: "center",
    backgroundColor: "rgba(10,14,18,.68)",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.14)",
  },
  messageText: { color: "#fff", fontFamily: typography.bold },
});
