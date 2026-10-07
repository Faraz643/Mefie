package com.mefie.camerasharing;

import android.content.Intent;
import androidx.annotation.Nullable;
import com.facebook.react.HeadlessJsTaskService;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.jstasks.HeadlessJsTaskConfig;

public final class MefiePhotoHeadlessService extends HeadlessJsTaskService {
  public static final String TASK_NAME = "MefiePhotoDetected";
  @Nullable @Override protected HeadlessJsTaskConfig getTaskConfig(Intent intent) {
    if (intent == null || intent.getExtras() == null) return null;
    return new HeadlessJsTaskConfig(TASK_NAME, Arguments.fromBundle(intent.getExtras()), 120_000, false);
  }
}