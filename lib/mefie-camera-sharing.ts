import { NativeModules, Platform } from "react-native";

export type CameraSharingStatus = {
  active: boolean;
  paused: boolean;
  eventId: string | null;
  eventName: string | null;
  participantId: string | null;
  photoCount: number;
};

type NativeCameraSharing = {
  start(eventId: string, eventName: string, participantId: string, initialPhotoCount: number): Promise<boolean>;
  pause(): Promise<boolean>;
  resume(): Promise<boolean>;
  stop(): Promise<boolean>;
  getStatus(): Promise<CameraSharingStatus>;
  incrementSharedPhotoCount(eventId: string): Promise<boolean>;
  openSystemCamera(): Promise<boolean>;
};

const native = Platform.OS === "android"
  ? NativeModules.MefieCameraSharing as NativeCameraSharing | undefined
  : undefined;

export const cameraSharingSupported = Boolean(native);

export async function getCameraSharingStatus(): Promise<CameraSharingStatus> {
  if (!native) return { active:false, paused:false, eventId:null, eventName:null, participantId:null, photoCount:0 };
  return native.getStatus();
}

export async function startCameraSharing(eventId:string,eventName:string,participantId:string,initialPhotoCount=0) {
  if (!native) throw new Error("Phone-camera sharing is available on Android only.");
  return native.start(eventId,eventName,participantId,Math.max(0,initialPhotoCount));
}
export async function pauseCameraSharing(){ return native ? native.pause() : false; }
export async function resumeCameraSharing(){ return native ? native.resume() : false; }
export async function stopCameraSharing(){ return native ? native.stop() : false; }
export async function incrementSharedPhotoCount(eventId: string){ return native ? native.incrementSharedPhotoCount(eventId) : false; }
export async function openSystemCamera() {
  if (!native) throw new Error("Phone-camera handoff is available on Android only.");
  return native.openSystemCamera();
}
