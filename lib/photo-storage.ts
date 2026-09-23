import { supabase } from "./app-context";

export const PHOTO_SIGNED_URL_TTL = 60 * 60;

export async function signPhotoPaths(paths: string[]) {
  if (!supabase || !paths.length) return new Map<string, string>();

  const uniquePaths = [...new Set(paths.filter(Boolean))];
  const { data, error } = await supabase.storage
    .from("photos")
    .createSignedUrls(uniquePaths, PHOTO_SIGNED_URL_TTL);

  if (error) throw error;

  return new Map(
    (data || [])
      .filter((item: any) => item?.path && item?.signedUrl)
      .map((item: any) => [item.path, item.signedUrl]),
  );
}

export async function signPhotoPath(path: string | null | undefined) {
  if (!path) return null;
  const urls = await signPhotoPaths([path]);
  return urls.get(path) || null;
}

export async function attachSignedPhotoUrls<T extends { storage_path?: string | null }>(
  photos: T[],
) {
  const urls = await signPhotoPaths(
    photos.map((photo) => photo.storage_path || ""),
  );

  return photos.map((photo) => ({
    ...photo,
    public_url: photo.storage_path ? urls.get(photo.storage_path) || null : null,
  }));
}
