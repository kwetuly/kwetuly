'use client';

// Upload queue for MediaField (slice S4): each file is prepared in the browser, then sent to Storage
// with a progress bar (XHR to a signed upload URL), two at a time; a failed file keeps its place and
// "Try again" picks up where it stopped (an already stored file is not sent twice).
import { useCallback, useEffect, useRef, useState } from 'react';
import { UPLOAD_CONCURRENCY, UPLOAD_SPECS, type CropRect, type MediaErrorCode, type MediaField, type MediaItem, type MediaSubjectKind, type UploadQueueState } from '@kwetuly/shared';
import { DecodeError, TooThinError, encodeImage, type EncodedImage } from '@/lib/image-encode';
import { finishUpload, removeMedia, resumeUpload, startUpload } from '@/lib/media';

export type QueueItem = {
  key: string;
  name: string;
  file: File;
  crop: CropRect | null;
  consent: boolean;
  preview: string;
  status: UploadQueueState;
  /** 0 to 100 */
  progress: number;
  error: MediaErrorCode | null;
  encoded?: EncodedImage;
  mediaId?: string;
  /** Which of the two files are already stored. */
  stored: { main: boolean; thumb: boolean };
};

class UploadHttpError extends Error {}

/** PUT to a signed upload URL with progress. A file that is already there counts as stored. */
function put(url: string, blob: Blob, onProgress: (sent: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', blob.type);
    xhr.setRequestHeader('x-upsert', 'false');
    // Short cache, so a removed photo stops showing soon (paths are never reused).
    xhr.setRequestHeader('cache-control', 'max-age=3600');
    xhr.upload.onprogress = (event) => onProgress(event.loaded);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      if (/Duplicate|already exists/i.test(xhr.responseText)) return resolve();
      reject(new UploadHttpError(`media:${xhr.status === 413 ? 'file_too_big' : 'file_missing'}`));
    };
    xhr.onerror = () => reject(new UploadHttpError('network'));
    xhr.ontimeout = () => reject(new UploadHttpError('network'));
    xhr.send(blob);
  });
}

let counter = 0;

export function useUploadQueue({ field, subjectKind, subjectId, onDone }: { field: MediaField; subjectKind: MediaSubjectKind; subjectId: string; onDone: (item: MediaItem, replaced: string[]) => void }) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const running = useRef(new Set<string>());
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  const patch = useCallback((key: string, change: Partial<QueueItem>) => {
    setItems((list) => list.map((item) => (item.key === key ? { ...item, ...change } : item)));
  }, []);

  const run = useCallback(
    async (item: QueueItem) => {
      const spec = UPLOAD_SPECS[field];
      let { encoded, mediaId } = item;
      const stored = { ...item.stored };
      try {
        if (!encoded) {
          patch(item.key, { status: 'preparing', progress: 0, error: null });
          encoded = await encodeImage(item.file, spec, item.crop);
          patch(item.key, { encoded });
        }
        patch(item.key, { status: 'uploading', error: null });
        const target = mediaId ? await resumeUpload(mediaId) : await startUpload({ field, subjectKind, subjectId, mime: encoded.mime, consent: item.consent });
        if (!target.ok) {
          // The row is gone (for example given up by the sweep): start again from the beginning.
          if (mediaId && target.error === 'file_missing') patch(item.key, { mediaId: undefined, stored: { main: false, thumb: false } });
          throw new UploadHttpError(`media:${target.error}`);
        }
        mediaId = target.id;
        patch(item.key, { mediaId });
        const total = encoded.main.size + encoded.thumb.size;
        const show = (sent: number) => patch(item.key, { progress: Math.min(99, Math.round((sent / total) * 100)) });
        if (!stored.main) {
          await put(target.url, encoded.main, (sent) => show(sent));
          stored.main = true;
          patch(item.key, { stored: { ...stored } });
        }
        if (!stored.thumb) {
          await put(target.thumbUrl, encoded.thumb, (sent) => show(encoded!.main.size + sent));
          stored.thumb = true;
          patch(item.key, { stored: { ...stored } });
        }
        patch(item.key, { status: 'finishing', progress: 100 });
        // The server reads the real width and height from the file.
        const done = await finishUpload({ id: mediaId, placeholder: encoded.placeholder });
        if (!done.ok) {
          // A refused file is deleted and its row removed: the next try starts again from the photo.
          if (['file_type', 'file_too_big', 'bad_size', 'too_thin'].includes(done.error)) patch(item.key, { mediaId: undefined, stored: { main: false, thumb: false } });
          throw new UploadHttpError(`media:${done.error}`);
        }
        patch(item.key, { status: 'done' });
        onDoneRef.current(done.item, done.replaced);
        URL.revokeObjectURL(item.preview);
        setItems((list) => list.filter((i) => i.key !== item.key));
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        const code: MediaErrorCode = error instanceof TooThinError ? 'too_thin' : error instanceof DecodeError ? 'decode' : message === 'network' ? 'network' : ((message.replace(/^media:/, '') || 'generic') as MediaErrorCode);
        patch(item.key, { status: 'failed', error: code });
      } finally {
        running.current.delete(item.key);
        // Wake the queue up for the next file.
        setItems((list) => [...list]);
      }
    },
    [field, subjectKind, subjectId, patch],
  );

  // Starts waiting files while fewer than UPLOAD_CONCURRENCY run.
  useEffect(() => {
    const waiting = items.filter((i) => i.status === 'waiting' && !running.current.has(i.key));
    for (const item of waiting) {
      if (running.current.size >= UPLOAD_CONCURRENCY) break;
      running.current.add(item.key);
      void run(item);
    }
  }, [items, run]);

  const add = useCallback((files: { file: File; crop?: CropRect | null }[], consent: boolean) => {
    setItems((list) => [
      ...list,
      ...files.map(({ file, crop }) => ({
        key: `u${++counter}`,
        name: file.name || 'photo',
        file,
        crop: crop ?? null,
        consent,
        preview: URL.createObjectURL(file),
        status: 'waiting' as const,
        progress: 0,
        error: null,
        stored: { main: false, thumb: false },
      })),
    ]);
  }, []);

  const retry = useCallback((key: string) => patch(key, { status: 'waiting', error: null }), [patch]);

  /** Drops a failed file; its unfinished row is removed so it does not hold a place. */
  const dismiss = useCallback((key: string) => {
    setItems((list) => {
      const item = list.find((i) => i.key === key);
      if (item) {
        URL.revokeObjectURL(item.preview);
        if (item.mediaId) void removeMedia(item.mediaId);
      }
      return list.filter((i) => i.key !== key);
    });
  }, []);

  const busy = items.some((i) => i.status !== 'failed');
  // Leaving the page halfway through asks first.
  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [busy]);

  return { items, add, retry, dismiss, busy };
}
