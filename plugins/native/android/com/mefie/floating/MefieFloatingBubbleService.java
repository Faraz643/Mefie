package com.mefie.floating;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.database.ContentObserver;
import android.database.Cursor;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.provider.MediaStore;
import android.provider.Settings;
import android.text.TextUtils;
import android.util.DisplayMetrics;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.LinearLayout;
import android.widget.PopupWindow;
import android.widget.TextView;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.Locale;
import java.util.UUID;

public final class MefieFloatingBubbleService extends Service {
  public static final String ACTION_START = "com.mefie.floating.START";
  public static final String ACTION_PAUSE = "com.mefie.floating.PAUSE";
  public static final String ACTION_RESUME = "com.mefie.floating.RESUME";
  public static final String ACTION_STOP = "com.mefie.floating.STOP";
  public static final String EXTRA_EVENT_ID = "eventId";
  public static final String EXTRA_EVENT_NAME = "eventName";
  public static final String EXTRA_PARTICIPANT_ID = "participantId";

  private static final String PREFS = "mefie.floating.session";
  private static final String PREF_ACTIVE = "active";
  private static final String PREF_PAUSED = "paused";
  private static final String PREF_EVENT_ID = "eventId";
  private static final String PREF_EVENT_NAME = "eventName";
  private static final String PREF_PARTICIPANT_ID = "participantId";
  private static final String PREF_START_MS = "startMs";
  private static final String PREF_LAST_MEDIA_ID = "lastMediaId";
  private static final String PREF_BUBBLE_X = "bubbleX";
  private static final String PREF_BUBBLE_Y = "bubbleY";
  private static final String CHANNEL_ID = "mefie_camera_sharing";
  private static final int NOTIFICATION_ID = 42017;
  private static final int BUBBLE_DP = 58;
  private static final long SCAN_DEBOUNCE_MS = 450L;

  private final Handler handler = new Handler(Looper.getMainLooper());
  private WindowManager windowManager;
  private Context windowContext;
  private TextView bubble;
  private boolean bubbleAttached;
  private TextView activeDot;
  private View popupView;
  private WindowManager.LayoutParams bubbleParams;
  private WindowManager.LayoutParams popupParams;
  private ContentObserver mediaObserver;
  private Runnable pendingScan;
  private long touchDownX;
  private long touchDownY;
  private int touchStartX;
  private int touchStartY;
  private boolean dragging;
  private boolean popupVisible;

  @Override
  public void onCreate() {
    super.onCreate();
    if (Build.VERSION.SDK_INT >= 30) {
      windowContext = createWindowContext(overlayType(), null);
      windowManager = (WindowManager) windowContext.getSystemService(WINDOW_SERVICE);
    } else {
      windowContext = this;
      windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
    }
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    if (intent != null && ACTION_STOP.equals(intent.getAction())) {
      stopSession();
      return START_NOT_STICKY;
    }

    if (intent != null && ACTION_START.equals(intent.getAction())) {
      String eventId = intent.getStringExtra(EXTRA_EVENT_ID);
      String eventName = intent.getStringExtra(EXTRA_EVENT_NAME);
      String participantId = intent.getStringExtra(EXTRA_PARTICIPANT_ID);
      if (!TextUtils.isEmpty(eventId) && !TextUtils.isEmpty(participantId)) {
        saveSession(eventId, eventName, participantId);
      }
    }

    if (!isActive(this)) return START_NOT_STICKY;
    startForegroundCompat();
    ensureBubble();

    if (ACTION_PAUSE.equals(intent != null ? intent.getAction() : null)) {
      setPaused(true);
    } else if (ACTION_RESUME.equals(intent != null ? intent.getAction() : null)) {
      setPaused(false);
    } else if (!isPaused(this)) {
      registerMediaObserver();
      scheduleScan();
    }
    return START_STICKY;
  }

  private void saveSession(String eventId, String eventName, String participantId) {
    long baseline = findLatestMediaId();
    getPrefs().edit()
      .putBoolean(PREF_ACTIVE, true)
      .putBoolean(PREF_PAUSED, false)
      .putString(PREF_EVENT_ID, eventId)
      .putString(PREF_EVENT_NAME, TextUtils.isEmpty(eventName) ? "Mefie event" : eventName)
      .putString(PREF_PARTICIPANT_ID, participantId)
      .putLong(PREF_START_MS, System.currentTimeMillis())
      .putLong(PREF_LAST_MEDIA_ID, baseline)
      .apply();
  }

  private android.content.SharedPreferences getPrefs() {
    return getSharedPreferences(PREFS, MODE_PRIVATE);
  }

  private void startForegroundCompat() {
    createNotificationChannel();
    Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_menu_camera)
      .setContentTitle("Mefie camera sharing")
      .setContentText(isPaused(this) ? "Sharing paused" : "Sharing photos to " + getEventName(this))
      .setOngoing(true)
      .setCategory(NotificationCompat.CATEGORY_SERVICE)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setContentIntent(openAppPendingIntent())
      .build();

    if (Build.VERSION.SDK_INT >= 34) {
      startForeground(NOTIFICATION_ID, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
    } else if (Build.VERSION.SDK_INT >= 29) {
      startForeground(NOTIFICATION_ID, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_NONE);
    } else {
      startForeground(NOTIFICATION_ID, notification);
    }
  }

  private PendingIntent openAppPendingIntent() {
    Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
    if (launch == null) return null;
    launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
    int flags = PendingIntent.FLAG_UPDATE_CURRENT;
    if (Build.VERSION.SDK_INT >= 23) flags |= PendingIntent.FLAG_IMMUTABLE;
    return PendingIntent.getActivity(this, 42018, launch, flags);
  }

  private void createNotificationChannel() {
    if (Build.VERSION.SDK_INT < 26) return;
    NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
    if (manager == null) return;
    NotificationChannel channel = new NotificationChannel(
      CHANNEL_ID,
      "Mefie camera sharing",
      NotificationManager.IMPORTANCE_LOW
    );
    channel.setDescription("Shows when Mefie is sharing photos captured with the phone camera.");
    manager.createNotificationChannel(channel);
  }

  private void ensureBubble() {
    if (!Settings.canDrawOverlays(this)) return;

    // START can be delivered repeatedly (for example after returning from the
    // system camera). Never create a second overlay window for the same service.
    if (bubble != null) {
      if (bubbleAttached && bubble.getWindowToken() != null) return;
      removeBubbleWindow();
    }

    Context context = windowContext != null ? windowContext : this;
    TextView newBubble = new TextView(context);
    newBubble.setText("M");
    newBubble.setTextColor(Color.WHITE);
    newBubble.setTextSize(20);
    newBubble.setGravity(Gravity.CENTER);
    newBubble.setTypeface(android.graphics.Typeface.DEFAULT, android.graphics.Typeface.BOLD);
    // Do not use View elevation here. On some Android 14 OEM builds it creates
    // large surface insets around the overlay and can make hit testing unreliable.
    newBubble.setElevation(0f);
    newBubble.setContentDescription("Mefie camera sharing");
    newBubble.setClickable(true);
    newBubble.setFocusable(false);
    newBubble.setBackground(circleBackground());
    newBubble.setOnTouchListener(this::handleBubbleTouch);
    newBubble.setOnClickListener(v -> { });

    bubbleParams = new WindowManager.LayoutParams(
      dp(BUBBLE_DP), dp(BUBBLE_DP), overlayType(),
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE |
        WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL |
        WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
      PixelFormat.TRANSLUCENT
    );
    bubbleParams.gravity = Gravity.TOP | Gravity.START;
    bubbleParams.x = clamp(getPrefs().getInt(PREF_BUBBLE_X, defaultX()), 0, screenWidth() - dp(BUBBLE_DP));
    bubbleParams.y = clamp(getPrefs().getInt(PREF_BUBBLE_Y, dp(180)), dp(24), screenHeight() - dp(BUBBLE_DP) - dp(24));

    try {
      windowManager.addView(newBubble, bubbleParams);
      bubble = newBubble;
      bubbleAttached = true;
      activeDot = null;
    } catch (Throwable error) {
      bubbleAttached = false;
      bubble = null;
      activeDot = null;
      bubbleParams = null;
    }
  }

  private boolean handleBubbleTouch(View view, MotionEvent event) {
    switch (event.getActionMasked()) {
      case MotionEvent.ACTION_DOWN:
        dragging = false;
        touchDownX = Math.round(event.getRawX());
        touchDownY = Math.round(event.getRawY());
        touchStartX = bubbleParams.x;
        touchStartY = bubbleParams.y;
        return true;
      case MotionEvent.ACTION_MOVE:
        int dx = Math.round(event.getRawX()) - (int) touchDownX;
        int dy = Math.round(event.getRawY()) - (int) touchDownY;
        if (Math.abs(dx) > dp(6) || Math.abs(dy) > dp(6)) dragging = true;
        if (dragging) {
          bubbleParams.x = clamp(touchStartX + dx, 0, screenWidth() - dp(BUBBLE_DP));
          bubbleParams.y = clamp(touchStartY + dy, dp(24), screenHeight() - dp(BUBBLE_DP) - dp(24));
          try { windowManager.updateViewLayout(bubble, bubbleParams); } catch (Throwable ignored) {}
        }
        return true;
      case MotionEvent.ACTION_UP:
        if (dragging) {
          snapBubble();
        } else {
          view.performClick();
          togglePopup();
        }
        return true;
      case MotionEvent.ACTION_CANCEL:
        if (dragging) snapBubble();
        return true;
      default:
        return true;
    }
  }

  private void snapBubble() {
    int targetX = bubbleParams.x < screenWidth() / 2 ? dp(4) : screenWidth() - dp(BUBBLE_DP) - dp(4);
    int startX = bubbleParams.x;
    final long duration = 180L;
    final long started = System.currentTimeMillis();
    handler.post(new Runnable() {
      @Override public void run() {
        if (bubble == null) return;
        float progress = Math.min(1f, (System.currentTimeMillis() - started) / (float) duration);
        float eased = 1f - (float) Math.pow(1f - progress, 3);
        bubbleParams.x = Math.round(startX + (targetX - startX) * eased);
        try { windowManager.updateViewLayout(bubble, bubbleParams); } catch (Throwable ignored) {}
        if (progress < 1f) handler.postDelayed(this, 16L);
        else getPrefs().edit().putInt(PREF_BUBBLE_X, bubbleParams.x).putInt(PREF_BUBBLE_Y, bubbleParams.y).apply();
      }
    });
  }

  private void togglePopup() {
    if (popupVisible) hidePopup();
    else showPopup();
  }

  private void showPopup() {
    if (popupVisible || bubble == null) return;
    popupVisible = true;

    LinearLayout card = new LinearLayout(this);
    card.setOrientation(LinearLayout.VERTICAL);
    card.setPadding(dp(18), dp(16), dp(18), dp(14));
    card.setBackground(roundBackground("#151917", dp(22)));
    card.setElevation(dp(14));

    TextView brand = text("Mefie", 12, "#9AA39D");
    brand.setTypeface(android.graphics.Typeface.DEFAULT, android.graphics.Typeface.BOLD);
    TextView event = text(getEventName(this), 18, "#FFFFFF");
    event.setEllipsize(TextUtils.TruncateAt.END);
    event.setMaxLines(1);
    event.setPadding(0, dp(2), 0, dp(8));

    LinearLayout status = new LinearLayout(this);
    status.setGravity(Gravity.CENTER_VERTICAL);
    TextView dot = text("●", 12, isPaused(this) ? "#A8B0AA" : "#69E58A");
    TextView statusText = text(isPaused(this) ? "Sharing paused" : "Sharing ON", 13, "#DCE5DE");
    status.addView(dot, new LinearLayout.LayoutParams(dp(20), dp(22)));
    status.addView(statusText, new LinearLayout.LayoutParams(-2, dp(22)));

    LinearLayout actions = new LinearLayout(this);
    actions.setGravity(Gravity.CENTER_VERTICAL);
    actions.setPadding(0, dp(12), 0, 0);

    TextView pause = actionButton(isPaused(this) ? "Resume" : "Pause", "#242A27");
    TextView stop = actionButton("Stop", "#3A2021");
    actions.addView(pause, new LinearLayout.LayoutParams(0, dp(44), 1));
    LinearLayout.LayoutParams stopParams = new LinearLayout.LayoutParams(0, dp(44), 1);
    stopParams.setMargins(dp(8), 0, 0, 0);
    actions.addView(stop, stopParams);

    pause.setOnClickListener(v -> {
      if (isPaused(this)) setPaused(false); else setPaused(true);
      hidePopup();
      showPopup();
    });
    stop.setOnClickListener(v -> stopSession());

    card.addView(brand);
    card.addView(event);
    card.addView(status);
    card.addView(actions);

    popupParams = new WindowManager.LayoutParams(
      dp(276), WindowManager.LayoutParams.WRAP_CONTENT, overlayType(),
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE |
        WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL |
        WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH,
      PixelFormat.TRANSLUCENT
    );
    popupParams.gravity = Gravity.TOP | Gravity.START;
    popupParams.x = popupX();
    popupParams.y = popupY();

    popupView = card;
    try {
      windowManager.addView(popupView, popupParams);
    } catch (Throwable error) {
      popupView = null;
      popupVisible = false;
    }
  }

  private void hidePopup() {
    View view = popupView;
    popupView = null;
    popupVisible = false;
    if (view != null && windowManager != null) {
      try { windowManager.removeViewImmediate(view); } catch (Throwable ignored) {}
    }
    popupParams = null;
  }

  private void removeBubbleWindow() {
    TextView view = bubble;
    bubble = null;
    activeDot = null;
    bubbleAttached = false;
    if (view != null && windowManager != null) {
      try { windowManager.removeViewImmediate(view); } catch (Throwable ignored) {}
    }
    bubbleParams = null;
  }

  private int popupX() {
    int width = dp(276);
    int x = bubbleParams.x + dp(BUBBLE_DP) + dp(8);
    if (x + width > screenWidth() - dp(8)) x = bubbleParams.x - width - dp(8);
    return clamp(x, dp(8), Math.max(dp(8), screenWidth() - width - dp(8)));
  }

  private int popupY() {
    int y = bubbleParams.y - dp(4);
    return clamp(y, dp(28), Math.max(dp(28), screenHeight() - dp(250)));
  }

  private TextView actionButton(String label, String color) {
    TextView view = text(label, 14, "#FFFFFF");
    view.setGravity(Gravity.CENTER);
    view.setTypeface(android.graphics.Typeface.DEFAULT, android.graphics.Typeface.BOLD);
    view.setBackground(roundBackground(color, dp(14)));
    return view;
  }

  private TextView text(String value, int size, String color) {
    TextView view = new TextView(this);
    view.setText(value);
    view.setTextSize(size);
    view.setTextColor(Color.parseColor(color));
    view.setFontFeatureSettings("kern");
    return view;
  }

  private GradientDrawable circleBackground() {
    GradientDrawable drawable = new GradientDrawable();
    drawable.setShape(GradientDrawable.OVAL);
    drawable.setColor(Color.parseColor("#171C19"));
    drawable.setStroke(dp(1), Color.parseColor("#4B5B51"));
    return drawable;
  }

  private GradientDrawable circleColor(String color) {
    GradientDrawable drawable = new GradientDrawable();
    drawable.setShape(GradientDrawable.OVAL);
    drawable.setColor(Color.parseColor(color));
    return drawable;
  }

  private GradientDrawable roundBackground(String color, int radius) {
    GradientDrawable drawable = new GradientDrawable();
    drawable.setColor(Color.parseColor(color));
    drawable.setCornerRadius(radius);
    return drawable;
  }

  private int overlayType() {
    return Build.VERSION.SDK_INT >= 26
      ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
      : WindowManager.LayoutParams.TYPE_PHONE;
  }

  private int dp(int value) {
    return Math.round(value * getResources().getDisplayMetrics().density);
  }

  private int screenWidth() {
    DisplayMetrics metrics = getResources().getDisplayMetrics();
    return metrics.widthPixels;
  }

  private int screenHeight() {
    DisplayMetrics metrics = getResources().getDisplayMetrics();
    return metrics.heightPixels;
  }

  private int defaultX() {
    return Math.max(dp(4), screenWidth() - dp(BUBBLE_DP) - dp(18));
  }

  private int clamp(int value, int min, int max) {
    return Math.max(min, Math.min(max, value));
  }

  private void setPaused(boolean paused) {
    if (!isActive(this)) return;
    getPrefs().edit().putBoolean(PREF_PAUSED, paused).apply();
    if (paused) unregisterMediaObserver();
    else {
      getPrefs().edit().putLong(PREF_LAST_MEDIA_ID, findLatestMediaId()).apply();
      registerMediaObserver();
      scheduleScan();
    }
    startForegroundCompat();
  }

  private void registerMediaObserver() {
    if (isPaused(this) || !isActive(this) || mediaObserver != null) return;
    mediaObserver = new ContentObserver(handler) {
      @Override public void onChange(boolean selfChange, Uri uri) {
        scheduleScan();
      }
    };
    try {
      getContentResolver().registerContentObserver(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, true, mediaObserver);
      scheduleScan();
    } catch (Throwable ignored) {}
  }

  private void unregisterMediaObserver() {
    if (mediaObserver == null) return;
    try { getContentResolver().unregisterContentObserver(mediaObserver); } catch (Throwable ignored) {}
    mediaObserver = null;
    if (pendingScan != null) handler.removeCallbacks(pendingScan);
  }

  private void scheduleScan() {
    if (pendingScan != null) handler.removeCallbacks(pendingScan);
    pendingScan = this::scanForNewPhotos;
    handler.postDelayed(pendingScan, SCAN_DEBOUNCE_MS);
  }

  private long findLatestMediaId() {
    Cursor cursor = null;
    try {
      cursor = getContentResolver().query(
        MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
        new String[]{MediaStore.Images.Media._ID},
        null, null,
        MediaStore.Images.Media._ID + " DESC LIMIT 1"
      );
      if (cursor != null && cursor.moveToFirst()) return cursor.getLong(0);
    } catch (Throwable ignored) {
    } finally {
      if (cursor != null) cursor.close();
    }
    return 0L;
  }

  private void scanForNewPhotos() {
    if (!isActive(this) || isPaused(this)) return;
    long lastId = getPrefs().getLong(PREF_LAST_MEDIA_ID, 0L);
    Cursor cursor = null;
    long newestSeen = lastId;
    try {
      String[] projection = new String[]{
        MediaStore.Images.Media._ID,
        MediaStore.Images.Media.DATE_ADDED,
        MediaStore.Images.Media.MIME_TYPE,
        MediaStore.Images.Media.DISPLAY_NAME,
        MediaStore.Images.Media.SIZE,
        MediaStore.Images.Media.WIDTH,
        MediaStore.Images.Media.HEIGHT,
        MediaStore.Images.Media.BUCKET_DISPLAY_NAME,
        Build.VERSION.SDK_INT >= 29 ? MediaStore.Images.Media.RELATIVE_PATH : MediaStore.Images.Media.DATA,
      };
      String selection = MediaStore.Images.Media._ID + " > ?";
      String[] args = new String[]{String.valueOf(lastId)};
      cursor = getContentResolver().query(
        MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
        projection,
        selection,
        args,
        MediaStore.Images.Media._ID + " ASC"
      );
      if (cursor == null) return;

      int idIndex = cursor.getColumnIndexOrThrow(MediaStore.Images.Media._ID);
      int dateIndex = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DATE_ADDED);
      int mimeIndex = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.MIME_TYPE);
      int nameIndex = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DISPLAY_NAME);
      int sizeIndex = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.SIZE);
      int widthIndex = cursor.getColumnIndex(MediaStore.Images.Media.WIDTH);
      int heightIndex = cursor.getColumnIndex(MediaStore.Images.Media.HEIGHT);
      int bucketIndex = cursor.getColumnIndex(MediaStore.Images.Media.BUCKET_DISPLAY_NAME);
      int pathIndex = cursor.getColumnIndex(Build.VERSION.SDK_INT >= 29 ? MediaStore.Images.Media.RELATIVE_PATH : MediaStore.Images.Media.DATA);
      long sessionStart = getPrefs().getLong(PREF_START_MS, System.currentTimeMillis());

      while (cursor.moveToNext()) {
        long id = cursor.getLong(idIndex);
        newestSeen = Math.max(newestSeen, id);
        long dateAdded = cursor.getLong(dateIndex) * 1000L;
        String mime = cursor.getString(mimeIndex);
        String name = cursor.getString(nameIndex);
        long size = cursor.getLong(sizeIndex);
        int width = widthIndex >= 0 ? cursor.getInt(widthIndex) : 0;
        int height = heightIndex >= 0 ? cursor.getInt(heightIndex) : 0;
        String bucket = bucketIndex >= 0 ? cursor.getString(bucketIndex) : "";
        String relativePath = pathIndex >= 0 ? cursor.getString(pathIndex) : "";

        if (dateAdded < sessionStart - 5000L) continue;
        if (!isCameraPhoto(mime, name, bucket, relativePath, size)) continue;
        copyAndDispatch(MediaStore.Images.Media.EXTERNAL_CONTENT_URI.buildUpon().appendPath(String.valueOf(id)).build(), id, mime, width, height);
      }
    } catch (SecurityException ignored) {
      // The JS layer requests media permission before starting this service.
    } catch (Throwable ignored) {
    } finally {
      if (cursor != null) cursor.close();
      if (newestSeen > lastId) getPrefs().edit().putLong(PREF_LAST_MEDIA_ID, newestSeen).apply();
    }
  }

  private boolean isCameraPhoto(String mime, String name, String bucket, String relativePath, long size) {
    if (size <= 0 || mime == null || !mime.startsWith("image/")) return false;
    String bucketLower = bucket == null ? "" : bucket.toLowerCase(Locale.ROOT);
    String pathLower = relativePath == null ? "" : relativePath.toLowerCase(Locale.ROOT);
    String nameLower = name == null ? "" : name.toLowerCase(Locale.ROOT);
    boolean cameraFolder = pathLower.contains("dcim/camera") || pathLower.contains("pictures/camera") || bucketLower.equals("camera");
    boolean commonCameraName = nameLower.startsWith("img_") || nameLower.startsWith("photo_") || nameLower.startsWith("pic_");
    return cameraFolder || (pathLower.startsWith("dcim/") && commonCameraName);
  }

  private void copyAndDispatch(Uri uri, long mediaId, String mime, int width, int height) {
    File pendingDir = new File(getFilesDir(), "mefie-native-pending");
    if (!pendingDir.exists() && !pendingDir.mkdirs()) return;
    String extension = mime != null && mime.contains("png") ? ".png" : mime != null && mime.contains("heic") ? ".heic" : ".jpg";
    File target = new File(pendingDir, UUID.randomUUID().toString() + extension);
    try (InputStream input = getContentResolver().openInputStream(uri); FileOutputStream output = new FileOutputStream(target)) {
      if (input == null) return;
      byte[] buffer = new byte[64 * 1024];
      int count;
      long copied = 0;
      while ((count = input.read(buffer)) != -1) {
        copied += count;
        if (copied > 40L * 1024L * 1024L) {
          target.delete();
          return;
        }
        output.write(buffer, 0, count);
      }
      output.flush();
    } catch (Throwable error) {
      target.delete();
      return;
    }

    Intent task = new Intent(this, MefiePhotoHeadlessService.class);
    task.putExtra("id", target.getName().substring(0, target.getName().lastIndexOf('.')));
    task.putExtra("uri", Uri.fromFile(target).toString());
    task.putExtra("eventId", getEventId(this));
    task.putExtra("participantId", getParticipantId(this));
    task.putExtra("mimeType", mime);
    task.putExtra("width", width);
    task.putExtra("height", height);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startService(task);
    else startService(task);
  }

  private void stopSession() {
    unregisterMediaObserver();
    hidePopup();
    removeBubbleWindow();
    getPrefs().edit().clear().apply();
    stopForeground(STOP_FOREGROUND_REMOVE);
    stopSelf();
  }

  @Override
  public void onDestroy() {
    unregisterMediaObserver();
    hidePopup();
    removeBubbleWindow();
    if (windowContext != null && windowContext != this && Build.VERSION.SDK_INT >= 30) {
      try { windowContext = null; } catch (Throwable ignored) {}
    }
    super.onDestroy();
  }

  @Nullable
  @Override
  public IBinder onBind(Intent intent) { return null; }

  public static boolean isActive(Context context) { return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(PREF_ACTIVE, false); }
  public static boolean isPaused(Context context) { return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(PREF_PAUSED, false); }
  public static String getEventId(Context context) { return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(PREF_EVENT_ID, null); }
  public static String getEventName(Context context) { return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(PREF_EVENT_NAME, "Mefie event"); }
  public static String getParticipantId(Context context) { return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(PREF_PARTICIPANT_ID, null); }
}
