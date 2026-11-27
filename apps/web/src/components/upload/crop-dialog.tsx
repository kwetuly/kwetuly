'use client';

// Fixed-shape crop for avatar (1:1) and cover (3:1), slice S4. A small native dialog: drag the photo
// with a pointer, zoom with the slider; the keyboard works too (arrow keys move, plus and minus zoom).
// No library. Returns the crop in the source picture's pixels (cropRect in @kwetuly/shared).
import { useEffect, useRef, useState } from 'react';
import { cropRect, type CropRect, type UploadsText } from '@kwetuly/shared';

type Props = { file: File; aspect: number; text: UploadsText['crop']; failedText: string; onCancel: () => void; onConfirm: (crop: CropRect) => void };

const VIEW_WIDTH = 600;

export function CropDialog({ file, aspect, text, failedText, onCancel, onConfirm }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number } | null>(null);
  const viewHeight = Math.round(VIEW_WIDTH / aspect);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    let alive = true;
    let made: ImageBitmap | null = null;
    createImageBitmap(file)
      .then((b) => {
        made = b;
        if (alive) setBitmap(b);
        else b.close();
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      made?.close();
    };
  }, [file]);

  const rect = bitmap ? cropRect(bitmap.width, bitmap.height, aspect, zoom, pan.x, pan.y) : null;

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context || !bitmap || !rect) return;
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, rect.x, rect.y, rect.width, rect.height, 0, 0, canvas.width, canvas.height);
  }, [bitmap, rect]);

  /** Moves the picture by screen pixels: dragging right shows more of the left side. */
  function moveBy(dx: number, dy: number) {
    if (!bitmap || !rect) return;
    const canvas = canvasRef.current;
    const scale = rect.width / (canvas?.clientWidth || VIEW_WIDTH);
    const spareX = (bitmap.width - rect.width) / 2;
    const spareY = (bitmap.height - rect.height) / 2;
    setPan((p) => ({
      x: spareX > 0 ? Math.min(1, Math.max(-1, p.x - (dx * scale) / spareX)) : 0,
      y: spareY > 0 ? Math.min(1, Math.max(-1, p.y - (dy * scale) / spareY)) : 0,
    }));
  }

  function onKeyDown(event: React.KeyboardEvent) {
    const step = 20;
    const keys: Record<string, () => void> = {
      ArrowLeft: () => moveBy(step, 0),
      ArrowRight: () => moveBy(-step, 0),
      ArrowUp: () => moveBy(0, step),
      ArrowDown: () => moveBy(0, -step),
      '+': () => setZoom((z) => Math.min(4, z + 0.1)),
      '=': () => setZoom((z) => Math.min(4, z + 0.1)),
      '-': () => setZoom((z) => Math.max(1, z - 0.1)),
    };
    const action = keys[event.key];
    if (action) {
      event.preventDefault();
      action();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="crop-title"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      className="w-[min(640px,calc(100vw-32px))] rounded-[5px] border border-line bg-white p-0 text-charcoal backdrop:bg-black/50"
    >
      <div className="space-y-4 p-4 sm:p-6">
        <h2 id="crop-title" className="text-xl font-bold">{text.title}</h2>
        <p id="crop-help" className="text-sm text-muted">{text.help}</p>
        {failed ? (
          <div className="rounded-[5px] bg-red-50 p-3 text-sm text-red-900" role="alert">{failedText}</div>
        ) : (
          <canvas
            ref={canvasRef}
            width={VIEW_WIDTH}
            height={viewHeight}
            tabIndex={0}
            role="img"
            aria-label={text.area}
            aria-describedby="crop-help"
            onKeyDown={onKeyDown}
            onPointerDown={(event) => {
              drag.current = { x: event.clientX, y: event.clientY };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (!drag.current) return;
              moveBy(event.clientX - drag.current.x, event.clientY - drag.current.y);
              drag.current = { x: event.clientX, y: event.clientY };
            }}
            onPointerUp={() => (drag.current = null)}
            onPointerCancel={() => (drag.current = null)}
            className={`block h-auto w-full touch-none cursor-grab rounded-[5px] bg-surface ${bitmap ? '' : 'animate-pulse'}`}
            style={{ aspectRatio: `${aspect}` }}
          />
        )}
        <label className="flex items-center gap-3 text-sm font-semibold">
          {text.zoom}
          <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={(event) => setZoom(Number(event.target.value))} className="flex-1 accent-forest" />
        </label>
        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" className="mr-auto text-sm font-semibold text-forest underline" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>{text.centre}</button>
          <button type="button" className="btn-outline" onClick={onCancel}>{text.cancel}</button>
          <button type="button" className="btn" disabled={!rect} onClick={() => rect && onConfirm(rect)}>{text.use}</button>
        </div>
      </div>
    </dialog>
  );
}
