import { NativeModules, Platform } from "react-native";

export type FloatingSharingStatus = {
  active: boolean;
  paused: boolean;
  eventId: string | null;
  eventName: string | null;
  participantId: string | null;
};

type NativeFloatingBubble = {
  isOverlayPermissionGranted(): Promise<boolean>;
  openOverlaySettings(): Promise<boolean>;
  start(eventId: string, eventName: string, participantId: string): Promise<boolean>;
  pause(): Promise<boolean>;
  resume(): Promise<boolean>;
  stop(): Promise<boolean>;
  getStatus(): Promise<FloatingSharingStatus>;
  openSystemCamera(): Promise<boolean>;
};

const native = Platform.OS === "android"
  ? (NativeModules.MefieFloatingBubble as NativeFloatingBubble | undefined)
  : undefined;

export const floatingCameraSupported = Boolean(native);

export async function getFloatingSharingStatus(): Promise<FloatingSharingStatus> {
  if (!native) return { active: false, paused: false, eventId: null, eventName: null, participantId: null };
  return native.getStatus();
}

export async function hasFloatingOverlayPermission() {
  if (!native) return false;
  return native.isOverlayPermissionGranted();
}

export async function openFloatingOverlaySettings() {
  if (!native) return false;
  return native.openOverlaySettings();
}

export async function startFloatingCameraSharing(eventId: string, eventName: string, participantId: string) {
  if (!native) throw new Error("Floating camera sharing is available on Android only.");
  return native.start(eventId, eventName, participantId);
}

export async function pauseFloatingCameraSharing() {
  if (!native) return false;
  return native.pause();
}

export async function resumeFloatingCameraSharing() {
  if (!native) return false;
  return native.resume();
}

export async function stopFloatingCameraSharing() {
  if (!native) return false;
  return native.stop();
}

export async function openPhoneCamera() {
  if (!native) throw new Error("Phone camera handoff is available on Android only.");
  return native.openSystemCamera();
}
