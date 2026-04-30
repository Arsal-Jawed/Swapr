import { File, Directory, Paths } from 'expo-file-system';

const AVATAR_SUBDIR = 'local_avatars';

export function relativeAvatarPathForUid(uid: string): string {
  return `${AVATAR_SUBDIR}/profile_${uid}.jpg`;
}

function documentBaseUri(): string {
  return Paths.document.uri.replace(/\/$/, '');
}

export async function ensureAvatarDirectory(): Promise<void> {
  const dir = new Directory(Paths.document, AVATAR_SUBDIR);
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
}

/** Saves the picked image under the app document directory (not bundled assets). Returns a short path for Firestore. */
export async function saveAvatarFromPickedUri(sourceUri: string, uid: string): Promise<string> {
  if (!sourceUri?.trim()) throw new Error('No image selected.');
  await ensureAvatarDirectory();
  const destFile = new File(Paths.document, AVATAR_SUBDIR, `profile_${uid}.jpg`);
  if (destFile.exists) {
    destFile.delete();
  }
  const sourceFile = new File(sourceUri);
  sourceFile.copy(destFile);
  return relativeAvatarPathForUid(uid);
}

/** True only for http(s) URLs — safe to store on docs other users read. Local paths only work on the owner’s device. */
export function isRemoteAvatarUrl(stored: string | undefined | null): boolean {
  const s = stored?.trim() ?? '';
  return s.startsWith('http://') || s.startsWith('https://');
}

/** Resolves Firestore `avatar` (https URL, file://, or `local_avatars/...`) for `<Image source={{ uri }} />`. */
export function resolveAvatarUri(stored: string | undefined | null): string | null {
  if (!stored?.trim()) return null;
  const s = stored.trim();
  if (s.startsWith('http://') || s.startsWith('https://')) return s;
  if (s.startsWith('file:')) return s;
  const base = documentBaseUri();
  return `${base}/${s.replace(/^\//, '').replace(/\\/g, '/')}`;
}
