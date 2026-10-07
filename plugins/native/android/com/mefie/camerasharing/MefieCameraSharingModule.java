package com.mefie.camerasharing;

import android.content.Context;
import android.content.Intent;
import android.os.Build;
import androidx.annotation.NonNull;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;

public final class MefieCameraSharingModule extends ReactContextBaseJavaModule {
  public MefieCameraSharingModule(ReactApplicationContext context) { super(context); }
  @NonNull @Override public String getName() { return "MefieCameraSharing"; }

  @ReactMethod public void start(String eventId, String eventName, String participantId, int initialPhotoCount, Promise promise) {
    try {
      if (eventId == null || eventId.trim().isEmpty() || participantId == null || participantId.trim().isEmpty()) { promise.resolve(false); return; }
      Intent intent = new Intent(getReactApplicationContext(), MefieCameraSharingService.class)
        .setAction(MefieCameraSharingService.ACTION_START)
        .putExtra(MefieCameraSharingService.EXTRA_EVENT_ID, eventId)
        .putExtra(MefieCameraSharingService.EXTRA_EVENT_NAME, eventName)
        .putExtra(MefieCameraSharingService.EXTRA_PARTICIPANT_ID, participantId)
        .putExtra(MefieCameraSharingService.EXTRA_INITIAL_PHOTO_COUNT, Math.max(0, initialPhotoCount));
      startServiceCompat(getReactApplicationContext(), intent);
      promise.resolve(true);
    } catch (Throwable e) { promise.reject("CAMERA_SHARING_START_FAILED", e); }
  }

  @ReactMethod public void pause(Promise promise) { send(MefieCameraSharingService.ACTION_PAUSE, promise); }
  @ReactMethod public void resume(Promise promise) { send(MefieCameraSharingService.ACTION_RESUME, promise); }
  @ReactMethod public void stop(Promise promise) { send(MefieCameraSharingService.ACTION_STOP, promise); }

  @ReactMethod public void getStatus(Promise promise) {
    try {
      Context c = getReactApplicationContext();
      WritableMap r = Arguments.createMap();
      r.putBoolean("active", MefieCameraSharingService.isActive(c));
      r.putBoolean("paused", MefieCameraSharingService.isPaused(c));
      r.putString("eventId", MefieCameraSharingService.getEventId(c));
      r.putString("eventName", MefieCameraSharingService.getEventName(c));
      r.putString("participantId", MefieCameraSharingService.getParticipantId(c));
      r.putInt("photoCount", MefieCameraSharingService.getPhotoCount(c));
      promise.resolve(r);
    } catch (Throwable e) { promise.reject("CAMERA_SHARING_STATUS_FAILED", e); }
  }

  @ReactMethod public void incrementSharedPhotoCount(Promise promise) {
    try { MefieCameraSharingService.incrementSharedPhotoCount(getReactApplicationContext()); promise.resolve(true); }
    catch (Throwable e) { promise.reject("CAMERA_SHARING_COUNT_FAILED", e); }
  }

  private void send(String action, Promise promise) {
    try {
      Intent i = new Intent(getReactApplicationContext(), MefieCameraSharingService.class).setAction(action);
      startServiceCompat(getReactApplicationContext(), i);
      promise.resolve(true);
    } catch (Throwable e) { promise.reject("CAMERA_SHARING_ACTION_FAILED", e); }
  }

  private static void startServiceCompat(Context c, Intent i) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) c.startForegroundService(i); else c.startService(i);
  }
}