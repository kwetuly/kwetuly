import { Circle, CircleCheck, CircleDashed } from 'lucide-react';
import type { StepProgress as Progress } from '@kwetuly/shared';

type Labels = { progressLabel: string; optional: string; done: string; todo: string; stepStatus: string };

/**
 * The sign-up progress line: "You have finished 3 of 6. 3 more steps to finish.", a bar with one
 * segment per step and a tick under each finished step. Optional steps have a dashed circle and the
 * word "Optional". `current` (0-based) outlines the step being edited.
 */
export function StepProgress({ progress, titles, line, labels, current }: { progress: Progress; titles: readonly string[]; line: string; labels: Labels; current?: number }) {
  return (
    <div className="mt-4">
      <p className="font-semibold text-forest">{line}</p>
      <div
        role="progressbar"
        aria-label={labels.progressLabel}
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-valuenow={progress.finished}
        aria-valuetext={line}
        className="mt-3 flex gap-1.5"
      >
        {progress.steps.map((s, i) => (
          <span
            key={i}
            className={`h-2 flex-1 rounded-[5px] ${s.done ? 'bg-leaf' : 'bg-surface'} ${i === current ? 'outline-2 outline-offset-2 outline-forest' : ''}`}
          />
        ))}
      </div>
      <ol className="mt-2 grid gap-1.5 text-center text-xs" style={{ gridTemplateColumns: `repeat(${progress.total}, minmax(0, 1fr))` }}>
        {progress.steps.map((s, i) => (
          <li key={i} className="flex flex-col items-center gap-0.5">
            {s.done ? (
              <CircleCheck className="size-4 text-leaf-dark" aria-hidden />
            ) : s.optional ? (
              <CircleDashed className="size-4 text-muted" aria-hidden />
            ) : (
              <Circle className="size-4 text-muted" aria-hidden />
            )}
            <span aria-hidden className={`tabular-nums ${i === current ? 'font-bold text-charcoal' : 'text-muted'}`}>{i + 1}</span>
            {s.optional && <span aria-hidden className="leading-tight text-muted">{labels.optional}</span>}
            <span className="sr-only">
              {labels.stepStatus
                .replace('{n}', String(i + 1))
                .replace('{title}', titles[i] ?? '')
                .replace('{status}', `${s.done ? labels.done : labels.todo}${s.optional ? `, ${labels.optional}` : ''}`)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
