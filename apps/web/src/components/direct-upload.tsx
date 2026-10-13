'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Props = {
  /** Hidden form field that receives the storage path once the upload is done. */
  name: string;
  bucket: 'avatars' | 'verification';
  userId: string;
  /** File name prefix inside the user's folder, e.g. "avatar" or "guide-id". */
  prefix: string;
  accept: string;
  labels: { uploading: string; uploaded: string; error: string };
};

const MAX_SIDE = 1600; // px; photos are shrunk to this before upload
const LIMIT = { avatars: 10, verification: 15 }; // MB, same as the storage buckets

// Phone photos are often 5–12 MB. Shrink big images in the browser (keeps them sharp enough
// for a profile or an ID check) so uploads are quick on mobile data.
async function shrink(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.size < 800 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

// Uploads a file straight from the browser to Supabase Storage (the user's own folder), so large
// files never pass through the website's server. The form only sends the resulting path.
export function DirectUpload({ name, bucket, userId, prefix, accept, labels }: Props) {
  const [path, setPath] = useState('');
  const [state, setState] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const inputRef = useRef<HTMLInputElement>(null);

  // Don't let the form be saved halfway through an upload.
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    const block = (event: Event) => {
      if (state === 'uploading') event.preventDefault();
    };
    form.addEventListener('submit', block);
    return () => form.removeEventListener('submit', block);
  }, [state]);

  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setPath('');
    if (!file) return setState('idle');
    setState('uploading');
    const body = await shrink(file);
    if (body.size > LIMIT[bucket] * 1024 * 1024) return setState('error');
    const type = body.type || file.type;
    const ext = type === 'application/pdf' ? 'pdf' : type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
    const target = `${userId}/${prefix}-${Date.now()}.${ext}`;
    const { error } = await createClient().storage.from(bucket).upload(target, body, { contentType: type, upsert: false });
    if (error) return setState('error');
    setPath(target);
    setState('done');
  }

  return (
    <div className="space-y-1.5">
      <input ref={inputRef} className="field" type="file" accept={accept} onChange={upload} />
      <input type="hidden" name={name} value={path} />
      {state === 'uploading' && (
        <p className="flex items-center gap-1.5 text-sm text-muted"><Loader2 className="size-4 animate-spin" aria-hidden /> {labels.uploading}</p>
      )}
      {state === 'done' && (
        <p className="flex items-center gap-1.5 text-sm font-semibold text-forest"><CheckCircle2 className="size-4" aria-hidden /> {labels.uploaded}</p>
      )}
      {state === 'error' && <p role="alert" className="text-sm text-red-700">{labels.error}</p>}
    </div>
  );
}
