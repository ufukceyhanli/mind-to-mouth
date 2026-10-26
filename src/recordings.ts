/**
 * Keeps each talk's audio on the device so it can be played back later.
 *
 * Files live in `<documents>/recordings/<sessionId>.<ext>`. Sessions store
 * only the file name, never the absolute URI: iOS moves the documents
 * directory between app installs, so an absolute path would go stale.
 */
import { Directory, File, Paths } from 'expo-file-system';

const RECORDINGS_DIR = 'recordings';

function recordingsDirectory(): Directory {
  return new Directory(Paths.document, RECORDINGS_DIR);
}

function extensionOf(uri: string): string {
  const match = /\.([A-Za-z0-9]+)$/.exec(uri);
  return match ? `.${match[1].toLowerCase()}` : '.wav';
}

/**
 * Moves a freshly recorded file out of the cache into permanent storage and
 * returns the stored file name to keep on the session.
 */
export async function persistRecording(sourceUri: string, sessionId: string): Promise<string> {
  const dir = recordingsDirectory();
  dir.create({ intermediates: true, idempotent: true });
  const name = `${sessionId}${extensionOf(sourceUri)}`;
  const target = new File(dir, name);
  if (target.exists) target.delete();
  await new File(sourceUri).move(target);
  return name;
}

/** Absolute URI for a stored recording, or null if the file is gone. */
export function recordingUri(fileName: string): string | null {
  try {
    const file = new File(recordingsDirectory(), fileName);
    return file.exists ? file.uri : null;
  } catch {
    return null;
  }
}

export function deleteRecording(fileName: string): void {
  try {
    const file = new File(recordingsDirectory(), fileName);
    if (file.exists) file.delete();
  } catch {
    // Nothing to do: the file is already gone or unreadable.
  }
}
