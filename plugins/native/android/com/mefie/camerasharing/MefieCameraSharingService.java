package com.mefie.camerasharing;

import android.app.*;
import android.content.*;
import android.database.ContentObserver;
import android.database.Cursor;
import android.graphics.Color;
import android.net.Uri;
import android.os.*;
import android.provider.MediaStore;
import android.text.TextUtils;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import java.io.*;
import java.util.Locale;
import java.util.UUID;

public final class MefieCameraSharingService extends Service {
  public static final String ACTION_START="com.mefie.camerasharing.START";
  public static final String ACTION_PAUSE="com.mefie.camerasharing.PAUSE";
  public static final String ACTION_RESUME="com.mefie.camerasharing.RESUME";
  public static final String ACTION_STOP="com.mefie.camerasharing.STOP";
  public static final String EXTRA_EVENT_ID="eventId";
  public static final String EXTRA_EVENT_NAME="eventName";
  public static final String EXTRA_PARTICIPANT_ID="participantId";
  public static final String EXTRA_INITIAL_PHOTO_COUNT="initialPhotoCount";

  private static final String PREFS="mefie.camera.sharing.session";
  private static final String ACTIVE="active", PAUSED="paused", EVENT_ID="eventId", EVENT_NAME="eventName",
    PARTICIPANT_ID="participantId", START_MS="startMs", COUNT="photoCount", GENERATION="generation",
    MEDIA_ID="mediaId", VERSION="version";
  private static final String CHANNEL="mefie_camera_sharing";
  private static final int NOTIFICATION_ID=42017;
  private static final long DEBOUNCE_MS=450L;
  private static final long MAX_SOURCE_BYTES=40L*1024L*1024L;

  private final Handler handler=new Handler(Looper.getMainLooper());
  private ContentObserver observer;
  private Runnable scanRunnable;

  @Override public void onCreate(){ super.onCreate(); createChannel(); }

  @Override public int onStartCommand(Intent intent,int flags,int startId){
    String action=intent==null?null:intent.getAction();
    if(ACTION_STOP.equals(action)){ stopSession(); return START_NOT_STICKY; }

    if(ACTION_START.equals(action)){
      String eventId=intent.getStringExtra(EXTRA_EVENT_ID);
      String eventName=intent.getStringExtra(EXTRA_EVENT_NAME);
      String participantId=intent.getStringExtra(EXTRA_PARTICIPANT_ID);
      int initial=intent.getIntExtra(EXTRA_INITIAL_PHOTO_COUNT,0);
      if(!TextUtils.isEmpty(eventId)&&!TextUtils.isEmpty(participantId)) saveSession(eventId,eventName,participantId,Math.max(0,initial));
    }
    if(!isActive(this)) return START_NOT_STICKY;
    startForegroundCompat();

    if(ACTION_PAUSE.equals(action)) setPaused(true);
    else if(ACTION_RESUME.equals(action)) setPaused(false);
    else if(!isPaused(this)){ registerObserver(); scheduleScan(); }
    return START_STICKY;
  }

  private void saveSession(String eventId,String eventName,String participantId,int initial){
    if(isActive(this)&&TextUtils.equals(eventId,getEventId(this))&&TextUtils.equals(participantId,getParticipantId(this))){
      updateNotification(); return;
    }
    getPrefs().edit()
      .putBoolean(ACTIVE,true).putBoolean(PAUSED,false)
      .putString(EVENT_ID,eventId).putString(EVENT_NAME,TextUtils.isEmpty(eventName)?"Mefie event":eventName)
      .putString(PARTICIPANT_ID,participantId).putLong(START_MS,System.currentTimeMillis())
      .putInt(COUNT,initial).putLong(GENERATION,currentGeneration()).putLong(MEDIA_ID,latestMediaId())
      .putString(VERSION,mediaVersion()).apply();
  }

  private void setPaused(boolean paused){
    if(!isActive(this)) return;
    getPrefs().edit().putBoolean(PAUSED,paused).apply();
    if(paused) unregisterObserver(); else { resetBaseline(); registerObserver(); scheduleScan(); }
    updateNotification();
  }

  private void resetBaseline(){
    getPrefs().edit().putLong(GENERATION,currentGeneration()).putLong(MEDIA_ID,latestMediaId()).putString(VERSION,mediaVersion()).apply();
  }

  private void registerObserver(){
    if(observer!=null||!isActive(this)||isPaused(this)) return;
    observer=new ContentObserver(handler){ @Override public void onChange(boolean selfChange,Uri uri){ scheduleScan(); } };
    try{ getContentResolver().registerContentObserver(MediaStore.Images.Media.EXTERNAL_CONTENT_URI,true,observer); scheduleScan(); }
    catch(Throwable e){ observer=null; }
  }

  private void unregisterObserver(){
    if(observer!=null){ try{getContentResolver().unregisterContentObserver(observer);}catch(Throwable ignored){} observer=null; }
    if(scanRunnable!=null){handler.removeCallbacks(scanRunnable);scanRunnable=null;}
  }

  private void scheduleScan(){
    if(!isActive(this)||isPaused(this)) return;
    if(scanRunnable!=null) handler.removeCallbacks(scanRunnable);
    scanRunnable=this::scanForNewPhotos; handler.postDelayed(scanRunnable,DEBOUNCE_MS);
  }

  private void scanForNewPhotos(){
    scanRunnable=null; if(!isActive(this)||isPaused(this)) return;
    Cursor cursor=null;
    long lastGen=getPrefs().getLong(GENERATION,0), lastId=getPrefs().getLong(MEDIA_ID,0);
    String savedVersion=getPrefs().getString(VERSION,""), currentVersion=mediaVersion();
    try{
      if(Build.VERSION.SDK_INT>=30&&!TextUtils.equals(savedVersion,currentVersion)){ resetBaseline(); lastGen=getPrefs().getLong(GENERATION,0); }
      boolean generation=Build.VERSION.SDK_INT>=30;
      String column=generation?MediaStore.Images.Media.GENERATION_ADDED:MediaStore.Images.Media._ID;
      String[] projection={MediaStore.Images.Media._ID,MediaStore.Images.Media.DATE_ADDED,MediaStore.Images.Media.MIME_TYPE,
        MediaStore.Images.Media.DISPLAY_NAME,MediaStore.Images.Media.SIZE,MediaStore.Images.Media.WIDTH,MediaStore.Images.Media.HEIGHT,
        MediaStore.Images.Media.BUCKET_DISPLAY_NAME,Build.VERSION.SDK_INT>=29?MediaStore.Images.Media.RELATIVE_PATH:MediaStore.Images.Media.DATA,column};
      long baseline=generation?lastGen:lastId;
      cursor=getContentResolver().query(MediaStore.Images.Media.EXTERNAL_CONTENT_URI,projection,column+" > ?",new String[]{String.valueOf(baseline)},column+" ASC");
      if(cursor==null)return;
      int idI=cursor.getColumnIndexOrThrow(MediaStore.Images.Media._ID), dateI=cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DATE_ADDED),
        mimeI=cursor.getColumnIndexOrThrow(MediaStore.Images.Media.MIME_TYPE), nameI=cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DISPLAY_NAME),
        sizeI=cursor.getColumnIndexOrThrow(MediaStore.Images.Media.SIZE), widthI=cursor.getColumnIndex(MediaStore.Images.Media.WIDTH),
        heightI=cursor.getColumnIndex(MediaStore.Images.Media.HEIGHT), bucketI=cursor.getColumnIndex(MediaStore.Images.Media.BUCKET_DISPLAY_NAME),
        pathI=cursor.getColumnIndex(Build.VERSION.SDK_INT>=29?MediaStore.Images.Media.RELATIVE_PATH:MediaStore.Images.Media.DATA);
      long start=getPrefs().getLong(START_MS,System.currentTimeMillis()), goodGen=lastGen, goodId=lastId;
      while(cursor.moveToNext()){
        long id=cursor.getLong(idI), value=cursor.getLong(cursor.getColumnIndexOrThrow(column));
        if(cursor.getLong(dateI)*1000L<start-5000L){ if(generation)goodGen=Math.max(goodGen,value);else goodId=Math.max(goodId,id); continue; }
        String mime=cursor.getString(mimeI), name=cursor.getString(nameI), bucket=cursor.getString(bucketI);
        String path=pathI>=0?cursor.getString(pathI):"";
        long size=cursor.getLong(sizeI);
        if(!isCameraPhoto(mime,name,bucket,path,size)){if(generation)goodGen=Math.max(goodGen,value);else goodId=Math.max(goodId,id);continue;}
        int w=widthI>=0?cursor.getInt(widthI):0,h=heightI>=0?cursor.getInt(heightI):0;
        if(!copyAndDispatch(MediaStore.Images.Media.EXTERNAL_CONTENT_URI.buildUpon().appendPath(String.valueOf(id)).build(),mime,w,h)) break;
        if(generation)goodGen=Math.max(goodGen,value);else goodId=Math.max(goodId,id);
      }
      getPrefs().edit().putLong(GENERATION,goodGen).putLong(MEDIA_ID,goodId).putString(VERSION,currentVersion).apply();
    }catch(SecurityException ignored){}catch(Throwable ignored){}finally{if(cursor!=null)cursor.close();}
  }

  private boolean copyAndDispatch(Uri uri,String mime,int width,int height){
    File dir=new File(getFilesDir(),"mefie-native-pending"); if(!dir.exists()&&!dir.mkdirs())return false;
    String lower=mime==null?"":mime.toLowerCase(Locale.ROOT);
    String ext=lower.contains("png")?".png":lower.contains("heic")?".heic":".jpg";
    File target=new File(dir,UUID.randomUUID()+ext);
    try(InputStream in=getContentResolver().openInputStream(uri);FileOutputStream out=new FileOutputStream(target)){
      if(in==null)return false; byte[] buf=new byte[64*1024]; int n; long total=0;
      while((n=in.read(buf))!=-1){total+=n;if(total>MAX_SOURCE_BYTES){target.delete();return false;}out.write(buf,0,n);}
      out.flush();
    }catch(Throwable e){target.delete();return false;}
    Intent task=new Intent(this,MefiePhotoHeadlessService.class).putExtra("id",target.getName().substring(0,target.getName().lastIndexOf('.')))
      .putExtra("uri",Uri.fromFile(target).toString()).putExtra("eventId",getEventId(this)).putExtra("participantId",getParticipantId(this))
      .putExtra("mimeType",mime).putExtra("width",width).putExtra("height",height);
    try{startService(task);return true;}catch(Throwable e){target.delete();return false;}
  }

  private boolean isCameraPhoto(String mime,String name,String bucket,String relativePath,long size){
    if(size<=0||mime==null||!mime.startsWith("image/"))return false;
    String b=bucket==null?"":bucket.toLowerCase(Locale.ROOT), p=relativePath==null?"":relativePath.toLowerCase(Locale.ROOT), n=name==null?"":name.toLowerCase(Locale.ROOT);
    return p.contains("dcim/camera")||p.contains("pictures/camera")||b.equals("camera")||(p.startsWith("dcim/")&&(n.startsWith("img_")||n.startsWith("photo_")||n.startsWith("pic_")));
  }

  private void startForegroundCompat(){
    Notification n=buildNotification();
    if(Build.VERSION.SDK_INT>=34) startForeground(NOTIFICATION_ID,n,android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
    else startForeground(NOTIFICATION_ID,n);
  }

  private Notification buildNotification(){
    boolean paused=isPaused(this); String name=getEventName(this); int count=getPhotoCount(this);
    NotificationCompat.Builder b=new NotificationCompat.Builder(this,CHANNEL)
      .setSmallIcon(android.R.drawable.ic_menu_camera).setContentTitle(paused?"Mefie · Sharing paused":"Mefie · Sharing ON")
      .setContentText(name+" · "+count+(count==1?" photo":" photos"))
      .setStyle(new NotificationCompat.BigTextStyle().bigText((paused?"Sharing paused":"Sharing ON")+" · "+name+" · "+count+(count==1?" photo":" photos")))
      .setOngoing(true).setOnlyAlertOnce(true).setCategory(NotificationCompat.CATEGORY_SERVICE).setPriority(NotificationCompat.PRIORITY_LOW)
      .setColor(Color.rgb(105,229,138)).setContentIntent(openAppPendingIntent());
    b.addAction(paused?android.R.drawable.ic_media_play:android.R.drawable.ic_media_pause,paused?"Resume":"Pause",actionPendingIntent(paused?ACTION_RESUME:ACTION_PAUSE,42019));
    b.addAction(android.R.drawable.ic_menu_close_clear_cancel,"Stop",actionPendingIntent(ACTION_STOP,42020)); return b.build();
  }

  private PendingIntent actionPendingIntent(String action,int code){
    Intent i=new Intent(this,MefieCameraSharingService.class).setAction(action); int flags=PendingIntent.FLAG_UPDATE_CURRENT;
    if(Build.VERSION.SDK_INT>=23)flags|=PendingIntent.FLAG_IMMUTABLE; return PendingIntent.getService(this,code,i,flags);
  }
  private PendingIntent openAppPendingIntent(){
    Intent i=getPackageManager().getLaunchIntentForPackage(getPackageName()); if(i==null)return null;
    i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_SINGLE_TOP); int flags=PendingIntent.FLAG_UPDATE_CURRENT;
    if(Build.VERSION.SDK_INT>=23)flags|=PendingIntent.FLAG_IMMUTABLE; return PendingIntent.getActivity(this,42018,i,flags);
  }
  private void updateNotification(){NotificationManager m=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);if(m!=null&&isActive(this))m.notify(NOTIFICATION_ID,buildNotification());}

  public static void incrementSharedPhotoCount(Context c){
    android.content.SharedPreferences p=c.getSharedPreferences(PREFS,MODE_PRIVATE); if(!p.getBoolean(ACTIVE,false))return;
    p.edit().putInt(COUNT,p.getInt(COUNT,0)+1).apply();
    NotificationManager m=(NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE); if(m!=null)m.notify(NOTIFICATION_ID,buildNotification(c));
  }

  private static Notification buildNotification(Context c){
    boolean paused=isPaused(c);String name=getEventName(c);int count=getPhotoCount(c);
    NotificationCompat.Builder b=new NotificationCompat.Builder(c,CHANNEL).setSmallIcon(android.R.drawable.ic_menu_camera)
      .setContentTitle(paused?"Mefie · Sharing paused":"Mefie · Sharing ON").setContentText(name+" · "+count+(count==1?" photo":" photos"))
      .setOngoing(true).setOnlyAlertOnce(true).setCategory(NotificationCompat.CATEGORY_SERVICE).setPriority(NotificationCompat.PRIORITY_LOW)
      .setColor(Color.rgb(105,229,138));
    Intent launch=c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());
    int flags=PendingIntent.FLAG_UPDATE_CURRENT;if(Build.VERSION.SDK_INT>=23)flags|=PendingIntent.FLAG_IMMUTABLE;
    if(launch!=null)b.setContentIntent(PendingIntent.getActivity(c,42018,launch,flags));
    Intent toggle=new Intent(c,MefieCameraSharingService.class).setAction(paused?ACTION_RESUME:ACTION_PAUSE);
    b.addAction(paused?android.R.drawable.ic_media_play:android.R.drawable.ic_media_pause,paused?"Resume":"Pause",PendingIntent.getService(c,42019,toggle,flags));
    Intent stop=new Intent(c,MefieCameraSharingService.class).setAction(ACTION_STOP);
    b.addAction(android.R.drawable.ic_menu_close_clear_cancel,"Stop",PendingIntent.getService(c,42020,stop,flags)); return b.build();
  }

  private void createChannel(){
    if(Build.VERSION.SDK_INT<26)return; NotificationManager m=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);if(m==null)return;
    NotificationChannel c=new NotificationChannel(CHANNEL,"Mefie camera sharing",NotificationManager.IMPORTANCE_LOW);
    c.setDescription("Controls real-time Mefie phone-camera sharing.");c.setShowBadge(false);m.createNotificationChannel(c);
  }

  private void stopSession(){unregisterObserver();getPrefs().edit().clear().apply();stopForeground(STOP_FOREGROUND_REMOVE);stopSelf();}
  @Override public void onDestroy(){unregisterObserver();super.onDestroy();}
  @Nullable @Override public IBinder onBind(Intent intent){return null;}

  private android.content.SharedPreferences getPrefs(){return getSharedPreferences(PREFS,MODE_PRIVATE);}
  private String mediaVersion(){if(Build.VERSION.SDK_INT<29)return "";try{return MediaStore.getVersion(this,MediaStore.VOLUME_EXTERNAL_PRIMARY);}catch(Throwable e){return "";}}
  private long currentGeneration(){if(Build.VERSION.SDK_INT<30)return 0;try{return MediaStore.getGeneration(this,MediaStore.VOLUME_EXTERNAL_PRIMARY);}catch(Throwable e){return 0;}}
  private long latestMediaId(){Cursor c=null;try{c=getContentResolver().query(MediaStore.Images.Media.EXTERNAL_CONTENT_URI,new String[]{MediaStore.Images.Media._ID},null,null,MediaStore.Images.Media._ID+" DESC LIMIT 1");if(c!=null&&c.moveToFirst())return c.getLong(0);}catch(Throwable ignored){}finally{if(c!=null)c.close();}return 0;}
  public static boolean isActive(Context c){return c.getSharedPreferences(PREFS,MODE_PRIVATE).getBoolean(ACTIVE,false);}
  public static boolean isPaused(Context c){return c.getSharedPreferences(PREFS,MODE_PRIVATE).getBoolean(PAUSED,false);}
  public static String getEventId(Context c){return c.getSharedPreferences(PREFS,MODE_PRIVATE).getString(EVENT_ID,null);}
  public static String getEventName(Context c){return c.getSharedPreferences(PREFS,MODE_PRIVATE).getString(EVENT_NAME,"Mefie event");}
  public static String getParticipantId(Context c){return c.getSharedPreferences(PREFS,MODE_PRIVATE).getString(PARTICIPANT_ID,null);}
  public static int getPhotoCount(Context c){return c.getSharedPreferences(PREFS,MODE_PRIVATE).getInt(COUNT,0);}
}