package com.mefie.floating;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;

public final class MefieFloatingBubbleModule extends ReactContextBaseJavaModule {
  public MefieFloatingBubbleModule(ReactApplicationContext reactContext) {
    super(reactContext);
  }

  @NonNull
  @Override
  public String getName() {
    return "MefieFloatingBubble";
  }

  @ReactMethod
  public void isOverlayPermissionGranted(Promise promise) {
    try {
      promise.resolve(Settings.canDrawOverlays(getReactApplicationContext()));
    } catch (Throwable error) {
      promise.reject("OVERLAY_PERMISSION_CHECK_FAILED", error);
    }
  }

  @ReactMethod
  public void openOverlaySettings(Promise promise) {
    try {
      Context context = getReactApplicationContext();
      Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION);
      intent.setData(Uri.parse("package:" + context.getPackageName()));
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      context.startActivity(intent);
      promise.resolve(true);
    } catch (Throwable error) {
      promise.reject("OVERLAY_SETTINGS_FAILED", error);
    }
  }

  @ReactMethod
  public void start(String eventId, String eventName, String participantId, Promise promise) {
    try {
      if (!Settings.canDrawOverlays(getReactApplicationContext())) {
        promise.resolve(false);
        return;
      }
      Intent intent = new Intent(getReactApplicationContext(), MefieFloatingBubbleService.class);
      intent.setAction(MefieFloatingBubbleService.ACTION_START);
      intent.putExtra(MefieFloatingBubbleService.EXTRA_EVENT_ID, eventId);
      intent.putExtra(MefieFloatingBubbleService.EXTRA_EVENT_NAME, eventName);
      intent.putExtra(MefieFloatingBubbleService.EXTRA_PARTICIPANT_ID, participantId);
      startServiceCompat(intent);
      promise.resolve(true);
    } catch (Throwable error) {
      promise.reject("FLOATING_START_FAILED", error);
    }
  }

  @ReactMethod
  public void pause(Promise promise) {
    sendSimpleAction(MefieFloatingBubbleService.ACTION_PAUSE, promise);
  }

  @ReactMethod
  public void resume(Promise promise) {
    sendSimpleAction(MefieFloatingBubbleService.ACTION_RESUME, promise);
  }

  @ReactMethod
  public void stop(Promise promise) {
    try {
      Context context = getReactApplicationContext();
      Intent intent = new Intent(context, MefieFloatingBubbleService.class);
      intent.setAction(MefieFloatingBubbleService.ACTION_STOP);
      context.startService(intent);
      promise.resolve(true);
    } catch (Throwable error) {
      promise.reject("FLOATING_STOP_FAILED", error);
    }
  }

  @ReactMethod
  public void getStatus(Promise promise) {
    try {
      WritableMap result = Arguments.createMap();
      result.putBoolean("active", MefieFloatingBubbleService.isActive(getReactApplicationContext()));
      result.putBoolean("paused", MefieFloatingBubbleService.isPaused(getReactApplicationContext()));
      result.putString("eventId", MefieFloatingBubbleService.getEventId(getReactApplicationContext()));
      result.putString("eventName", MefieFloatingBubbleService.getEventName(getReactApplicationContext()));
      result.putString("participantId", MefieFloatingBubbleService.getParticipantId(getReactApplicationContext()));
      promise.resolve(result);
    } catch (Throwable error) {
      promise.reject("FLOATING_STATUS_FAILED", error);
    }
  }

  @ReactMethod
  public void openSystemCamera(Promise promise) {
    try {
      Context context = getReactApplicationContext();
      Intent intent = new Intent("android.media.action.IMAGE_CAPTURE");
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      if (intent.resolveActivity(context.getPackageManager()) == null) {
        promise.reject("NO_CAMERA_APP", "No camera app is available on this device.");
        return;
      }
      context.startActivity(intent);
      promise.resolve(true);
    } catch (Throwable error) {
      promise.reject("CAMERA_OPEN_FAILED", error);
    }
  }

  private void sendSimpleAction(String action, Promise promise) {
    try {
      Context context = getReactApplicationContext();
      Intent intent = new Intent(context, MefieFloatingBubbleService.class);
      intent.setAction(action);
      startServiceCompat(intent);
      promise.resolve(true);
    } catch (Throwable error) {
      promise.reject("FLOATING_ACTION_FAILED", error);
    }
  }

  private void startServiceCompat(Intent intent) {
    Context context = getReactApplicationContext();
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      context.startForegroundService(intent);
    } else {
      context.startService(intent);
    }
  }
}
